<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { http } from '@/services/http'
import type { ApiListData, ApiResponse, ConversationSummary, User } from '@/types/api'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'

const auth = useAuthStore()
const chat = useChatStore()

// ─── Estado ────────────────────────────────────────────────────────────────
const activeUserId = ref<string | null>(null)
const activeConversation = computed<ConversationSummary | null>(
  () => chat.conversations.find((c) => c.userId === activeUserId.value) ?? null,
)
const activeMessages = computed(() => (activeUserId.value ? chat.messages[activeUserId.value] ?? [] : []))

const draft = ref('')
const sending = ref(false)
const loadingMessages = ref(false)
const convSearch = ref('')

const msgContainer = ref<HTMLDivElement | null>(null)

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
const userSearch = ref('')
const userSearchResults = ref<User[]>([])
const searchingUsers = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

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

// ─── Enviar mensaje ──────────────────────────────────────────────────────────
async function send() {
  const text = draft.value.trim()
  if (!text || !activeUserId.value || sending.value) return
  sending.value = true
  draft.value = ''
  try {
    await chat.sendMessage(activeUserId.value, text)
    scrollToBottom()
  } catch {
    draft.value = text
  } finally {
    sending.value = false
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
        gifResults.value = []
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
    } catch {
      gifResults.value = []
    } finally {
      searchingGifs.value = false
    }
  }, 400)
}

function insertGif(gifUrl: string) {
  draft.value += `\n${gifUrl}`
  showGifPicker.value = false
  gifSearch.value = ''
  gifResults.value = []
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  await chat.fetchConversations()
  chat.startRealtime()
})

onUnmounted(() => {
  chat.stopRealtime()
})

watch(
  () => activeMessages.value.length,
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
          <button
            class="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Nuevo mensaje"
            @click="showUserPicker = true"
          >
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
          </button>
        </div>
        <UiInput
          v-model="convSearch"
          placeholder="Buscar conversación..."
          size="sm"
        />
      </div>

      <!-- Lista -->
      <div class="flex-1 overflow-y-auto">
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
            activeUserId === conv.userId ? 'bg-primary-50 border-r-2 border-primary-500' : '',
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
              {{ conv.lastMessageContent || 'Sin mensajes aún' }}
            </p>
          </div>
        </button>
      </div>
    </aside>

    <!-- ── Panel derecho: conversación activa ──────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 bg-surface-50">

      <!-- Sin conversación seleccionada -->
      <div v-if="!activeUserId" class="flex-1 flex flex-col items-center justify-center gap-3 text-surface-400">
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
            v-if="!activeConversation?.avatar"
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
              {{ activeConversation ? fullName(activeConversation) : '' }}
            </p>
            <p class="text-xs text-surface-500">{{ activeConversation?.email }}</p>
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

          <div v-else-if="activeMessages.length === 0" class="flex flex-col items-center justify-center h-full gap-2 text-surface-400">
            <p class="text-sm">No hay mensajes. Sé el primero en escribir.</p>
          </div>

          <template v-else>
            <div
              v-for="msg in activeMessages"
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
                <p class="leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
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
            </div>

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
              :disabled="!draft.trim() || sending"
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
</template>
