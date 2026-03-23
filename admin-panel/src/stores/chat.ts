import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/services/http'
import type { ApiResponse, ChatMessage, ChatMessagesData, ConversationSummary } from '@/types/api'
import { connectChatRealtime, disconnectChatRealtime } from '@/services/chat-realtime.service'
import { useAuthStore } from './auth'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ConversationSummary[]>([])
  const messages = ref<Record<string, ChatMessage[]>>({})
  const realtimeConnected = ref(false)
  const loadingConversations = ref(false)

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

  async function sendMessage(userId: string, content: string): Promise<ChatMessage> {
    const res = await http.post<ApiResponse<ChatMessage>>(`/chat/${userId}/messages`, { content })
    const msg = res.data.data
    messages.value[userId] = [...(messages.value[userId] ?? []), msg]
    updateConversationWithMessage(userId, msg)
    return msg
  }

  async function markAsRead(userId: string) {
    await http.patch(`/chat/${userId}/read`)
    const conv = conversations.value.find((c) => c.userId === userId)
    if (conv) {
      conv.unreadCount = 0
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

  return {
    conversations,
    messages,
    realtimeConnected,
    loadingConversations,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead,
    startRealtime,
    stopRealtime,
  }
})
