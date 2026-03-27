<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { http } from '@/services/http'
import type { ApiListData, ApiResponse, ChatMessage, ConversationSummary, GroupConversationSummary, User } from '@/types/api'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'

const auth = useAuthStore()
const chat = useChatStore()

// ─── Estado ────────────────────────────────────────────────────────────────
const activeUserId = ref<string | null>(null)
const activeGroupId = ref<string | null>(null)
const activeScope = ref<'direct' | 'group'>('direct')
const activeConversation = computed<ConversationSummary | null>(
  () => chat.conversations.find((c) => c.userId === activeUserId.value) ?? null,
)
const activeGroupConversation = computed<GroupConversationSummary | null>(
  () => chat.groupConversations.find((g) => g.groupId === activeGroupId.value) ?? null,
)
const activeMessages = computed(() => (activeUserId.value ? chat.messages[activeUserId.value] ?? [] : []))
const activeGroupMessages = computed(() => (activeGroupId.value ? chat.groupMessages[activeGroupId.value] ?? [] : []))
const threadMessages = computed<ChatMessage[]>(() =>
  activeScope.value === 'direct' ? activeMessages.value : activeGroupMessages.value,
)
const hasActiveThread = computed(() =>
  activeScope.value === 'direct' ? Boolean(activeUserId.value) : Boolean(activeGroupId.value),
)

const draft = ref('')
const sending = ref(false)
const loadingMessages = ref(false)
const convSearch = ref('')
const groupSearch = ref('')

const msgContainer = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadingFile = ref(false)

// ─── Emoticones y GIFs ──────────────────────────────────────────────────────
const showEmojiPicker = ref(false)
const showGifPicker = ref(false)
const gifSearch = ref('')
const gifResults = ref<{ id: string; title: string; url: string }[]>([])
const searchingGifs = ref(false)
let gifDebounceTimer: ReturnType<typeof setTimeout> | null = null

const emojis = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
  '😍', '🥰', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
  '😌', '😔', '😑', '😐', '😶', '🤐', '😏', '😒', '🙁', '😲',
  '😞', '😖', '😤', '😢', '😭', '😱', '😳', '🥺', '😦', '😧',
  '😨', '😰', '😥', '😢', '😂', '🤣', '👍', '👎', '👋', '✋',
  '❤️', '💔', '💕', '💖', '💗', '💙', '💚', '⭐', '🎉', '🎊',
  '🔥', '✨', '💯', '👀', '🙈', '🙉', '🙊', '🐶', '🐱', '🦁',
]


const showUserPicker = ref(false)
const showGroupCreator = ref(false)
const userSearch = ref('')
const userSearchResults = ref<User[]>([])
const searchingUsers = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const groupName = ref('')
const selectedGroupMemberIds = ref<string[]>([])

// ─── Conversaciones filtradas ───────────────────────────────────────────────
const filteredConversations = computed(() => {
  const q = convSearch.value.trim().toLowerCase()
  if (!q) return chat.conversations
  return chat.conversations.filter(
    (c) =>
      c.email.toLowerCase().includes(q) ||
      (c.firstName ?? '').toLowerCase().includes(q) ||
      (c.lastName ?? '').toLowerCase().includes(q),
  )
})

const filteredGroups = computed(() => {
  const q = groupSearch.value.trim().toLowerCase()
  if (!q) return chat.groupConversations
  return chat.groupConversations.filter((g) => g.name.toLowerCase().includes(q))
})

// ─── Helpers ────────────────────────────────────────────────────────────────
function fullName(user: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.email
}

function initials(user: { firstName: string | null; lastName: string | null; email: string }) {
  const fn = user.firstName?.[0] ?? ''
  const ln = user.lastName?.[0] ?? ''
  if (fn || ln) return `${fn}${ln}`.toUpperCase()
  return user.email.slice(0, 2).toUpperCase()
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return date.toLocaleDateString('es', { weekday: 'short' })
  return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })
}

type MessagePart = { type: 'text' | 'image'; value: string }

function isImageUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const hasImageExtension = /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?.*)?$/i.test(trimmed)
  const isGiphyUrl = /^https?:\/\/(media\d*\.)?giphy\.com\//i.test(trimmed) || /^https?:\/\/i\.giphy\.com\//i.test(trimmed)
  return hasImageExtension || isGiphyUrl
}

function getMessageParts(content: string): MessagePart[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return [{ type: 'text', value: content }]

  return lines.map((line) => ({
    type: isImageUrl(line) ? 'image' : 'text',
    value: line,
  }))
}

function conversationPreview(content: string): string {
  const parts = getMessageParts(content)
  const hasImage = parts.some((part) => part.type === 'image')
  const textParts = parts.filter((part) => part.type === 'text').map((part) => part.value)
  const text = textParts.join(' ').trim()

  if (hasImage && text) return `${text} • GIF`
  if (hasImage) return 'GIF'
  return text || 'Sin mensajes aun'
}

function getFileUrl(path: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
  const host = apiBase.replace(/\/api\/?$/, '')
  return `${host}${path.startsWith('/') ? '' : '/'}${path}`
}

function scrollToBottom() {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTop = msgContainer.value.scrollHeight
    }
  })
}

// ─── Seleccionar conversación ────────────────────────────────────────────────
async function selectConversation(userId: string) {
  if (activeUserId.value === userId) return
  activeScope.value = 'direct'
  activeGroupId.value = null
  activeUserId.value = userId
  draft.value = ''
  loadingMessages.value = true
  try {
    await chat.fetchMessages(userId)
    await chat.markAsRead(userId)
    scrollToBottom()
  } finally {
    loadingMessages.value = false
  }
}

async function selectGroupConversation(groupId: string) {
  if (activeGroupId.value === groupId) return
  activeScope.value = 'group'
  activeUserId.value = null
  activeGroupId.value = groupId
  draft.value = ''
  loadingMessages.value = true
  try {
    await chat.fetchGroupMessages(groupId)
    await chat.markGroupAsRead(groupId)
    scrollToBottom()
  } finally {
    loadingMessages.value = false
  }
}

// ─── Enviar mensaje ──────────────────────────────────────────────────────────
async function send() {
  const text = draft.value.trim()
  if (!text || sending.value || !hasActiveThread.value) return
  sending.value = true
  draft.value = ''
  try {
    if (activeScope.value === 'direct' && activeUserId.value) {
      await chat.sendMessage(activeUserId.value, text)
    } else if (activeScope.value === 'group' && activeGroupId.value) {
      await chat.sendGroupMessage(activeGroupId.value, text)
    }
    scrollToBottom()
  } catch {
    draft.value = text
  } finally {
    sending.value = false
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || uploadingFile.value || !hasActiveThread.value) return

  uploadingFile.value = true
  try {
    if (activeScope.value === 'direct' && activeUserId.value) {
      await chat.sendAttachment(activeUserId.value, file)
    } else if (activeScope.value === 'group' && activeGroupId.value) {
      await chat.sendGroupAttachment(activeGroupId.value, file)
    }
    scrollToBottom()
  } finally {
    uploadingFile.value = false
    target.value = ''
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
}

// ─── Búsqueda de usuarios para nuevo chat ────────────────────────────────────
function onUserSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(searchUsers, 350)
}

async function searchUsers() {
  const q = userSearch.value.trim()
  if (!q) {
    userSearchResults.value = []
    return
  }
  searchingUsers.value = true
  try {
    const res = await http.get<ApiResponse<ApiListData<User>>>('/users', { params: { search: q, limit: 10 } })
    const data = res.data.data
    userSearchResults.value = Array.isArray(data) ? data : data.items ?? []
  } catch {
    userSearchResults.value = []
  } finally {
    searchingUsers.value = false
  }
}

async function startConversationWith(user: User) {
  showUserPicker.value = false
  userSearch.value = ''
  userSearchResults.value = []

  const exists = chat.conversations.find((c) => c.userId === user.id)
  if (!exists) {
    chat.conversations.unshift({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      lastMessageContent: '',
      lastMessageAt: new Date().toISOString(),
      lastMessageSenderId: null,
      unreadCount: 0,
    })
  }
  await selectConversation(user.id)
}

function toggleGroupMember(userId: string) {
  if (selectedGroupMemberIds.value.includes(userId)) {
    selectedGroupMemberIds.value = selectedGroupMemberIds.value.filter((id) => id !== userId)
  } else {
    selectedGroupMemberIds.value = [...selectedGroupMemberIds.value, userId]
  }
}

async function createGroup() {
  const name = groupName.value.trim()
  if (!name || selectedGroupMemberIds.value.length === 0) return

  await chat.createGroup({
    name,
    memberIds: selectedGroupMemberIds.value,
  })

  groupName.value = ''
  selectedGroupMemberIds.value = []
  userSearch.value = ''
  userSearchResults.value = []
  showGroupCreator.value = false
}

// ─── Emojis y GIFs ──────────────────────────────────────────────────────────
function insertEmoji(emoji: string) {
  draft.value += emoji
  showEmojiPicker.value = false
}

function searchGifs() {
  if (gifDebounceTimer) clearTimeout(gifDebounceTimer)
  gifDebounceTimer = setTimeout(async () => {
    const q = gifSearch.value.trim()
    if (!q) {
      gifResults.value = []
      return
    }
    searchingGifs.value = true
    try {
      // Usando Giphy API (requiere VITE_GIPHY_API_KEY)
      const apiKey = import.meta.env.VITE_GIPHY_API_KEY
      if (!apiKey) {
        gifResults.value = [{
          id: 'error',
          title: 'No configurado',
          url: '',
        }]
        return
      }
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=6&offset=0&rating=g&lang=es`,
      )
      const data = await res.json()
      gifResults.value = (data.data ?? []).map((gif: any) => ({
        id: gif.id,
        title: gif.title,
        url: gif.images.fixed_height.url,
      }))
    } catch (err) {
      gifResults.value = [{
        id: 'error',
        title: 'Error al buscar',
        url: '',
      }]
    } finally {
      searchingGifs.value = false
    }
  }, 400)
}

function insertGif(gifUrl: string) {
  if (!gifUrl) return // Ignora clics en elementos de error
  draft.value += `\n${gifUrl}`
  showGifPicker.value = false
  gifSearch.value = ''
  gifResults.value = []
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  await chat.fetchConversations()
  await chat.fetchGroupConversations()
  chat.startRealtime()
})

onUnmounted(() => {
  chat.stopRealtime()
})

watch(
  () => threadMessages.value.length,
  () => scrollToBottom(),
)
</script>

<template>
  <div class="flex h-[calc(100vh-7rem)] -m-6 overflow-hidden rounded-xl border border-surface-200 shadow-sm">

    <!-- ── Panel izquierdo: lista de conversaciones ─────────────────────── -->
    <aside class="w-72 shrink-0 flex flex-col border-r border-surface-200 bg-surface-0">

      <!-- Cabecera -->
      <div class="px-4 pt-4 pb-3 border-b border-surface-200 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-surface-900">Mensajes</h2>
          <div class="flex items-center gap-1">
            <button
              class="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Nuevo mensaje"
              @click="showUserPicker = true"
            >
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
            </button>
            <button
              class="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Nuevo grupo"
              @click="showGroupCreator = true"
            >
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5a3 3 0 11-6 0 3 3 0 016 0zM6 10.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM3.75 18a4.5 4.5 0 019 0m3.75-3h3m-1.5-1.5v3"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UiButton size="sm" :variant="activeScope === 'direct' ? 'primary' : 'ghost'" @click="activeScope = 'direct'">
            Directo
          </UiButton>
          <UiButton size="sm" :variant="activeScope === 'group' ? 'primary' : 'ghost'" @click="activeScope = 'group'">
            Grupos
          </UiButton>
        </div>
        <UiInput
          v-model="convSearch"
          placeholder="Buscar conversación..."
          size="sm"
        />
        <UiInput
          v-model="groupSearch"
          placeholder="Buscar grupo..."
          size="sm"
        />
      </div>

      <!-- Lista -->
      <div class="flex-1 overflow-y-auto divide-y divide-surface-100">
        <div v-if="chat.loadingConversations" class="flex justify-center py-10">
          <UiSpinner size="md" />
        </div>

        <div v-else-if="filteredConversations.length === 0" class="px-4 py-10 text-center text-surface-400 text-sm">
          <p v-if="convSearch">Sin resultados para "{{ convSearch }}"</p>
          <div v-else>
            <p class="mb-2">No hay conversaciones</p>
            <UiButton size="sm" variant="ghost" @click="showUserPicker = true">Iniciar nuevo mensaje</UiButton>
          </div>
        </div>

        <button
          v-for="conv in filteredConversations"
          :key="conv.userId"
          :class="[
            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50',
            activeScope === 'direct' && activeUserId === conv.userId ? 'bg-primary-50 border-r-2 border-primary-500' : '',
          ]"
          @click="selectConversation(conv.userId)"
        >
          <!-- Avatar -->
          <div class="relative shrink-0">
            <span
              v-if="!conv.avatar"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold"
            >
              {{ initials(conv) }}
            </span>
            <img v-else :src="conv.avatar" :alt="fullName(conv)" class="h-9 w-9 rounded-full object-cover" />

            <span
              v-if="conv.unreadCount > 0"
              class="absolute -top-1 -right-1 flex h-4 w-4 min-w-4 items-center justify-center rounded-full bg-primary-600 text-white text-[10px] font-bold leading-none"
            >
              {{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}
            </span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-surface-900 truncate">{{ fullName(conv) }}</span>
              <span class="text-[11px] text-surface-400 shrink-0">{{ timeLabel(conv.lastMessageAt) }}</span>
            </div>
            <p class="text-xs text-surface-500 truncate mt-0.5">
              <span v-if="conv.lastMessageSenderId === auth.user?.id" class="mr-0.5 text-surface-400">Tú:</span>
              {{ conversationPreview(conv.lastMessageContent) }}
            </p>
          </div>
        </button>

        <div class="px-4 py-2 bg-surface-50 border-t border-b border-surface-100 text-xs font-semibold text-surface-500">
          Grupos
        </div>
        <div v-if="chat.loadingGroups" class="flex justify-center py-4">
          <UiSpinner size="sm" />
        </div>
        <div v-else-if="filteredGroups.length === 0" class="px-4 py-4 text-xs text-surface-400">
          Sin grupos
        </div>
        <button
          v-for="group in filteredGroups"
          :key="group.groupId"
          :class="[
            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50',
            activeScope === 'group' && activeGroupId === group.groupId ? 'bg-primary-50 border-r-2 border-primary-500' : '',
          ]"
          @click="selectGroupConversation(group.groupId)"
        >
          <div class="relative shrink-0">
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
              GR
            </span>
            <span
              v-if="group.unreadCount > 0"
              class="absolute -top-1 -right-1 flex h-4 w-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none"
            >
              {{ group.unreadCount > 9 ? '9+' : group.unreadCount }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-surface-900 truncate">{{ group.name }}</span>
              <span class="text-[11px] text-surface-400 shrink-0">{{ timeLabel(group.lastMessageAt) }}</span>
            </div>
            <p class="text-xs text-surface-500 truncate mt-0.5">{{ conversationPreview(group.lastMessageContent) }}</p>
          </div>
        </button>
      </div>
    </aside>

    <!-- ── Panel derecho: conversación activa ──────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 bg-surface-50">

      <!-- Sin conversación seleccionada -->
      <div v-if="!hasActiveThread" class="flex-1 flex flex-col items-center justify-center gap-3 text-surface-400">
        <svg class="w-12 h-12 opacity-40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
        </svg>
        <p class="text-sm font-medium">Selecciona una conversación</p>
        <UiButton size="sm" @click="showUserPicker = true">Nuevo mensaje</UiButton>
      </div>

      <template v-else>
        <!-- Cabecera de conversación -->
        <header class="flex items-center gap-3 px-5 py-3 bg-surface-0 border-b border-surface-200 shrink-0">
          <span
            v-if="activeScope === 'group'"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold shrink-0"
          >
            GR
          </span>
          <span
            v-else-if="!activeConversation?.avatar"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold shrink-0"
          >
            {{ activeConversation ? initials(activeConversation) : '' }}
          </span>
          <img
            v-else
            :src="activeConversation.avatar"
            :alt="activeConversation ? fullName(activeConversation) : ''"
            class="h-9 w-9 rounded-full object-cover shrink-0"
          />
          <div>
            <p class="font-semibold text-surface-900 text-sm leading-tight">
              {{
                activeScope === 'group'
                  ? (activeGroupConversation?.name ?? '')
                  : (activeConversation ? fullName(activeConversation) : '')
              }}
            </p>
            <p class="text-xs text-surface-500">
              {{ activeScope === 'group' ? `${activeGroupConversation?.memberCount ?? 0} miembros` : activeConversation?.email }}
            </p>
          </div>
        </header>

        <!-- Mensajes -->
        <div
          ref="msgContainer"
          class="flex-1 overflow-y-auto px-5 py-5 space-y-3 min-h-0"
        >
          <div v-if="loadingMessages" class="flex justify-center py-6">
            <UiSpinner size="md" />
          </div>

          <div v-else-if="threadMessages.length === 0" class="flex flex-col items-center justify-center h-full gap-2 text-surface-400">
            <p class="text-sm">No hay mensajes. Sé el primero en escribir.</p>
          </div>

          <template v-else>
            <div
              v-for="msg in threadMessages"
              :key="msg.id"
              :class="[
                'flex',
                msg.senderId === auth.user?.id ? 'justify-end' : 'justify-start',
              ]"
            >
              <div
                :class="[
                  'max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-xs wrap-break-word',
                  msg.senderId === auth.user?.id
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-surface-0 text-surface-900 border border-surface-200 rounded-tl-sm',
                ]"
              >
                <div class="space-y-2">
                  <img
                    v-if="msg.messageType === 'IMAGE' && msg.attachmentUrl"
                    :src="getFileUrl(msg.attachmentUrl)"
                    :alt="msg.attachmentName || 'Imagen'"
                    class="max-w-full w-55 sm:w-70 h-auto rounded-lg border border-black/10"
                    loading="lazy"
                  />
                  <a
                    v-if="msg.messageType === 'DOCUMENT' && msg.attachmentUrl"
                    :href="getFileUrl(msg.attachmentUrl)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block rounded-lg border border-surface-300 bg-surface-100/80 px-3 py-2 text-surface-700 hover:border-primary-300"
                  >
                    <p class="text-xs font-semibold uppercase tracking-wide opacity-70">Documento</p>
                    <p class="text-sm truncate">{{ msg.attachmentName || msg.content }}</p>
                  </a>
                  <template v-for="(part, index) in getMessageParts(msg.content)" :key="`${msg.id}-part-${index}`">
                    <p v-if="part.type === 'text'" class="leading-relaxed whitespace-pre-wrap">{{ part.value }}</p>
                    <img
                      v-else-if="msg.messageType === 'TEXT'"
                      :src="part.value"
                      alt="GIF"
                      class="max-w-full w-55 sm:w-70 h-auto rounded-lg border border-black/10"
                      loading="lazy"
                    />
                  </template>
                </div>
                <p
                  :class="[
                    'text-[11px] mt-1 text-right',
                    msg.senderId === auth.user?.id ? 'text-primary-200' : 'text-surface-400',
                  ]"
                >
                  {{ timeLabel(msg.createdAt) }}
                  <span v-if="msg.senderId === auth.user?.id && msg.isRead" class="ml-1 opacity-75">✓✓</span>
                  <span v-else-if="msg.senderId === auth.user?.id" class="ml-1 opacity-50">✓</span>
                </p>
              </div>
            </div>
          </template>
        </div>

        <!-- Input de mensaje -->
        <footer class="px-5 py-3 bg-surface-0 border-t border-surface-200 shrink-0">
          <form class="flex items-end gap-2" @submit.prevent="send">
            <!-- Botones auxiliares -->
            <div class="flex gap-1">
              <button
                type="button"
                class="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                title="Emojis"
                @click="showEmojiPicker = !showEmojiPicker"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                title="GIFs"
                @click="showGifPicker = !showGifPicker"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                title="Adjuntar imagen o documento"
                :disabled="uploadingFile || !hasActiveThread"
                @click="openFilePicker"
              >
                <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a3 3 0 11-4.243-4.243l9.544-9.544a1.5 1.5 0 112.121 2.122l-9.546 9.545a.75.75 0 11-1.06-1.06l7.425-7.425" />
                </svg>
              </button>
            </div>

            <input
              ref="fileInput"
              type="file"
              class="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              @change="onFileSelected"
            />

            <textarea
              v-model="draft"
              placeholder="Escribe un mensaje… (Enter para enviar)"
              rows="1"
              class="flex-1 resize-none rounded-xl border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors min-h-10 max-h-32 overflow-y-auto"
              @keydown="handleKeydown"
              @input="(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 128)}px` }"
            />
            <UiButton
              type="submit"
              :disabled="!draft.trim() || sending || !hasActiveThread"
              class="shrink-0"
            >
              <svg v-if="!sending" class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
              </svg>
              <UiSpinner v-else size="sm" />
            </UiButton>
          </form>

          <!-- Emoji Picker -->
          <div v-if="showEmojiPicker" class="mt-3 p-3 bg-surface-50 rounded-lg border border-surface-200 grid grid-cols-10 gap-2">
            <button
              v-for="emoji in emojis"
              :key="emoji"
              type="button"
              class="text-2xl hover:scale-125 transition-transform"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>

          <!-- GIF Picker -->
          <div v-if="showGifPicker" class="mt-3 p-3 bg-surface-50 rounded-lg border border-surface-200">
            <input
              v-model="gifSearch"
              type="text"
              placeholder="Buscar GIFs…"
              class="w-full px-3 py-2 rounded border border-surface-300 text-sm mb-2"
              @input="searchGifs"
            />
            <div v-if="searchingGifs" class="flex justify-center py-4">
              <UiSpinner size="sm" />
            </div>
            <div v-else-if="gifResults.length === 1 && gifResults[0].id === 'error'">
              <div class="text-xs text-surface-500 p-2 rounded border border-amber-200 bg-amber-50">
                <p class="font-semibold mb-1 text-amber-900">⚠️ {{ gifResults[0].title }}</p>
                <p v-if="gifResults[0].title === 'No configurado'" class="text-[11px] text-amber-800">
                  Para usar GIFs, configura <code class="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono text-xs">VITE_GIPHY_API_KEY</code> en <code class="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono text-xs">.env.local</code>.
                  <br />Obtén una gratis en <a href="https://giphy.com/apps" target="_blank" class="underline font-semibold hover:text-amber-700">giphy.com/apps</a>
                </p>
                <p v-else class="text-[11px] text-amber-800">Error en la llamada a Giphy API. Verifica tu API key.</p>
              </div>
            </div>
            <div v-else-if="gifResults.length > 0" class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              <button
                v-for="gif in gifResults"
                :key="gif.id"
                type="button"
                class="rounded overflow-hidden hover:opacity-80 transition-opacity"
                :title="gif.title"
                @click="insertGif(gif.url)"
              >
                <img :src="gif.url" :alt="gif.title" class="w-full h-20 object-cover" />
              </button>
            </div>
            <p v-else class="text-xs text-surface-400 text-center py-2">Escribe para buscar GIFs</p>
          </div>
        </footer>
      </template>
    </div>
  </div>

  <!-- ── Modal: seleccionar usuario para nuevo mensaje ──────────────────── -->
  <UiModal
    :show="showUserPicker"
    title="Nuevo mensaje"
    @close="showUserPicker = false"
  >
    <div class="space-y-4">
      <UiInput
        v-model="userSearch"
        placeholder="Buscar usuario por nombre o email…"
        autofocus
        @input="onUserSearchInput"
      />

      <div v-if="searchingUsers" class="flex justify-center py-4">
        <UiSpinner size="md" />
      </div>

      <div v-else-if="userSearch && userSearchResults.length === 0" class="py-4 text-center text-sm text-surface-400">
        Sin resultados para "{{ userSearch }}"
      </div>

      <ul v-else-if="userSearchResults.length > 0" class="divide-y divide-surface-100 rounded-xl border border-surface-200 overflow-hidden">
        <li v-for="user in userSearchResults" :key="user.id">
          <button
            class="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left"
            @click="startConversationWith(user)"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold shrink-0">
              {{ initials(user) }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-surface-900 truncate">{{ fullName(user) }}</p>
              <p class="text-xs text-surface-500 truncate">{{ user.email }}</p>
            </div>
          </button>
        </li>
      </ul>

      <p v-else class="text-sm text-surface-400 text-center py-2">
        Escribe para buscar un usuario
      </p>
    </div>
  </UiModal>

  <UiModal
    :show="showGroupCreator"
    title="Nuevo grupo de chat"
    @close="showGroupCreator = false"
  >
    <div class="space-y-4">
      <UiInput v-model="groupName" placeholder="Nombre del grupo" />

      <UiInput
        v-model="userSearch"
        placeholder="Buscar usuarios para agregar..."
        @input="onUserSearchInput"
      />

      <div class="rounded-xl border border-surface-200 max-h-56 overflow-y-auto divide-y divide-surface-100">
        <label
          v-for="user in userSearchResults"
          :key="`group-member-${user.id}`"
          class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-50"
        >
          <input
            type="checkbox"
            :checked="selectedGroupMemberIds.includes(user.id)"
            @change="toggleGroupMember(user.id)"
          />
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
            {{ initials(user) }}
          </span>
          <div class="min-w-0">
            <p class="text-sm text-surface-900 truncate">{{ fullName(user) }}</p>
            <p class="text-xs text-surface-500 truncate">{{ user.email }}</p>
          </div>
        </label>
        <p v-if="!userSearchResults.length" class="px-3 py-4 text-xs text-surface-400 text-center">
          Busca usuarios para agregarlos al grupo.
        </p>
      </div>

      <div class="flex items-center justify-between text-xs text-surface-500">
        <span>Seleccionados: {{ selectedGroupMemberIds.length }}</span>
      </div>

      <div class="flex justify-end gap-2">
        <UiButton variant="ghost" @click="showGroupCreator = false">Cancelar</UiButton>
        <UiButton
          :disabled="!groupName.trim() || selectedGroupMemberIds.length === 0"
          @click="createGroup"
        >
          Crear grupo
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>
