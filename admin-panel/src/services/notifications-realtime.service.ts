import { io, type Socket } from 'socket.io-client'
import type { Notification } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
const WS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '')

type NotificationUpdatedPayload = {
  id: string
  isRead: boolean
  readAt: string | null
}

type NotificationsRealtimeEvents = {
  onCreated: (notification: Notification) => void
  onUpdated: (payload: NotificationUpdatedPayload) => void
  onReadAll: () => void
}

let socket: Socket | null = null

export function connectNotificationsRealtime(token: string, events: NotificationsRealtimeEvents): Socket {
  if (socket) {
    return socket
  }

  socket = io(`${WS_BASE_URL}/notifications`, {
    transports: ['websocket'],
    auth: {
      token: `Bearer ${token}`,
    },
  })

  socket.on('notification.created', events.onCreated)
  socket.on('notification.updated', events.onUpdated)
  socket.on('notification.read-all', events.onReadAll)

  return socket
}

export function disconnectNotificationsRealtime(): void {
  if (!socket) {
    return
  }

  socket.disconnect()
  socket = null
}
