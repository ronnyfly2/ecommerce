import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/services/http'
import type {
  ApiResponse,
  ChatMessage,
  ChatMessagesData,
  ConversationSummary,
  CreateChatGroupDto,
  GroupConversationSummary,
} from '@/types/api'
import { connectChatRealtime, disconnectChatRealtime } from '@/services/chat-realtime.service'
import { useAuthStore } from './auth'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ConversationSummary[]>([])
  const groupConversations = ref<GroupConversationSummary[]>([])
  const messages = ref<Record<string, ChatMessage[]>>({})
  const groupMessages = ref<Record<string, ChatMessage[]>>({})
  const realtimeConnected = ref(false)
  const loadingConversations = ref(false)
  const loadingGroups = ref(false)

  async function fetchConversations() {
    loadingConversations.value = true
    try {
      const res = await http.get<ApiResponse<ConversationSummary[]>>('/chat/conversations')
      conversations.value = res.data.data
    } finally {
      loadingConversations.value = false
    }
  }

  async function fetchMessages(userId: string, page = 1, limit = 40): Promise<ChatMessagesData> {
    const res = await http.get<ApiResponse<ChatMessagesData>>(`/chat/${userId}/messages`, {
      params: { page, limit },
    })
    const data = res.data.data
    if (page === 1) {
      messages.value[userId] = data.items
    } else {
      messages.value[userId] = [...data.items, ...(messages.value[userId] ?? [])]
    }
    return data
  }

  async function fetchGroupConversations() {
    loadingGroups.value = true
    try {
      const res = await http.get<ApiResponse<GroupConversationSummary[]>>('/chat/groups')
      groupConversations.value = res.data.data
    } finally {
      loadingGroups.value = false
    }
  }

  async function fetchGroupMessages(groupId: string, page = 1, limit = 40): Promise<ChatMessagesData> {
    const res = await http.get<ApiResponse<ChatMessagesData>>(`/chat/groups/${groupId}/messages`, {
      params: { page, limit },
    })
    const data = res.data.data
    if (page === 1) {
      groupMessages.value[groupId] = data.items
    } else {
      groupMessages.value[groupId] = [...data.items, ...(groupMessages.value[groupId] ?? [])]
    }
    return data
  }

  async function sendMessage(userId: string, content: string): Promise<ChatMessage> {
    const res = await http.post<ApiResponse<ChatMessage>>(`/chat/${userId}/messages`, { content })
    const msg = res.data.data
    // NO agregar aquí, dejar que el WebSocket lo agregue para evitar duplicados
    // messages.value[userId] = [...(messages.value[userId] ?? []), msg]
    updateConversationWithMessage(userId, msg)
    return msg
  }

  async function sendAttachment(userId: string, file: File): Promise<ChatMessage> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiResponse<ChatMessage>>(`/chat/${userId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  }

  async function sendGroupAttachment(groupId: string, file: File): Promise<ChatMessage> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiResponse<ChatMessage>>(`/chat/groups/${groupId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  }

  async function createGroup(dto: CreateChatGroupDto) {
    await http.post('/chat/groups', dto)
    await fetchGroupConversations()
  }

  async function sendGroupMessage(groupId: string, content: string): Promise<ChatMessage> {
    const res = await http.post<ApiResponse<ChatMessage>>(`/chat/groups/${groupId}/messages`, { content })
    const msg = res.data.data
    updateGroupConversationWithMessage(groupId, msg)
    return msg
  }

  async function markAsRead(userId: string) {
    await http.patch(`/chat/${userId}/read`)
    const conv = conversations.value.find((c) => c.userId === userId)
    if (conv) {
      conv.unreadCount = 0
    }
  }

  async function markGroupAsRead(groupId: string) {
    await http.patch(`/chat/groups/${groupId}/read`)
    const group = groupConversations.value.find((g) => g.groupId === groupId)
    if (group) {
      group.unreadCount = 0
    }
  }

  function startRealtime() {
    const auth = useAuthStore()
    const token = localStorage.getItem('access_token')
    if (!token || realtimeConnected.value) return

    connectChatRealtime(token, {
      onMessage(message) {
        const otherId =
          message.senderId === auth.user?.id ? message.recipientId : message.senderId
        if (!otherId) return

        if (messages.value[otherId]) {
          // Evitar duplicado: no agregar si ya existe el mensaje por ID
          const exists = messages.value[otherId].some((m) => m.id === message.id)
          if (!exists) {
            messages.value[otherId] = [...messages.value[otherId], message]
          }
        }
        updateConversationWithMessage(otherId, message)
      },
      onReadReceipt({ userId }) {
        if (messages.value[userId]) {
          messages.value[userId] = messages.value[userId].map((m) =>
            m.senderId === useAuthStore().user?.id ? { ...m, isRead: true } : m,
          )
        }
      },
      onGroupMessage(message) {
        const groupId = message.groupId
        if (!groupId) return

        if (groupMessages.value[groupId]) {
          const exists = groupMessages.value[groupId].some((m) => m.id === message.id)
          if (!exists) {
            groupMessages.value[groupId] = [...groupMessages.value[groupId], message]
          }
        }
        updateGroupConversationWithMessage(groupId, message)
      },
      onGroupReadReceipt({ groupId }) {
        const auth = useAuthStore()
        if (groupMessages.value[groupId]) {
          groupMessages.value[groupId] = groupMessages.value[groupId].map((m) =>
            m.senderId === auth.user?.id ? { ...m, isRead: true } : m,
          )
        }
      },
    })

    realtimeConnected.value = true
  }

  function stopRealtime() {
    disconnectChatRealtime()
    realtimeConnected.value = false
  }

  function updateConversationWithMessage(userId: string, msg: ChatMessage) {
    const existing = conversations.value.find((c) => c.userId === userId)
    if (existing) {
      existing.lastMessageContent = msg.content
      existing.lastMessageAt = msg.createdAt
      existing.lastMessageSenderId = msg.senderId
      conversations.value = [
        existing,
        ...conversations.value.filter((c) => c.userId !== userId),
      ]
    }
  }

  function updateGroupConversationWithMessage(groupId: string, msg: ChatMessage) {
    const existing = groupConversations.value.find((g) => g.groupId === groupId)
    if (existing) {
      existing.lastMessageContent = msg.content
      existing.lastMessageAt = msg.createdAt
      existing.lastMessageSenderId = msg.senderId
      groupConversations.value = [
        existing,
        ...groupConversations.value.filter((g) => g.groupId !== groupId),
      ]
    }
  }

  return {
    conversations,
    groupConversations,
    messages,
    groupMessages,
    realtimeConnected,
    loadingConversations,
    loadingGroups,
    fetchConversations,
    fetchMessages,
    fetchGroupConversations,
    fetchGroupMessages,
    sendMessage,
    sendGroupMessage,
    sendAttachment,
    sendGroupAttachment,
    createGroup,
    markAsRead,
    markGroupAsRead,
    startRealtime,
    stopRealtime,
  }
})
