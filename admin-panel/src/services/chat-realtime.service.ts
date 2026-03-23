import { io, type Socket } from 'socket.io-client'
import type { ChatMessage } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
const WS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '')

type ChatRealtimeEvents = {
  onMessage: (message: ChatMessage) => void
  onReadReceipt: (payload: { userId: string }) => void
}

let socket: Socket | null = null

export function connectChatRealtime(token: string, events: ChatRealtimeEvents): Socket {
  if (socket) {
    return socket
  }

  socket = io(`${WS_BASE_URL}/chat`, {
    transports: ['websocket'],
    auth: {
      token: `Bearer ${token}`,
    },
  })

  socket.on('chat.message', events.onMessage)
  socket.on('chat.read', events.onReadReceipt)

  return socket
}

export function disconnectChatRealtime(): void {
  if (!socket) {
    return
  }

  socket.disconnect()
  socket = null
}
