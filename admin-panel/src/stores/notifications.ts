import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notificationsService } from '@/services/notifications.service'
import {
  connectNotificationsRealtime,
  disconnectNotificationsRealtime,
} from '@/services/notifications-realtime.service'
import type { Notification, NotificationType } from '@/types/api'

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const initialized = ref(false)
  const realtimeConnected = ref(false)
  const activeTypeFilter = ref<NotificationType | ''>('')

  const hasUnread = computed(() => unreadCount.value > 0)

  async function fetchLatest(options?: { limit?: number; unreadOnly?: boolean; type?: NotificationType | '' }) {
    loading.value = true
    try {
      const limit = options?.limit ?? 8
      const unreadOnly = options?.unreadOnly
      const type = options?.type ?? activeTypeFilter.value

      const data = await notificationsService.list({
        page: 1,
        limit,
        unreadOnly,
        type: type || undefined,
      })
      items.value = data.items
      unreadCount.value = data.unreadCount
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  function setTypeFilter(type: NotificationType | '') {
    activeTypeFilter.value = type
  }

  function startRealtime() {
    if (realtimeConnected.value) {
      return
    }

    const accessToken = localStorage.getItem('access_token')
    if (!accessToken) {
      return
    }

    void fetchLatest()

    connectNotificationsRealtime(accessToken, {
      onCreated: (notification) => {
        const exists = items.value.some((item) => item.id === notification.id)
        if (!exists) {
          if (!activeTypeFilter.value || notification.type === activeTypeFilter.value) {
            items.value = [notification, ...items.value].slice(0, 8)
          }
          unreadCount.value += 1
        }
      },
      onUpdated: ({ id, isRead, readAt }) => {
        const target = items.value.find((item) => item.id === id)
        if (target) {
          const wasRead = target.isRead
          target.isRead = isRead
          target.readAt = readAt

          if (!wasRead && isRead) {
            unreadCount.value = Math.max(0, unreadCount.value - 1)
          }
        }
      },
      onReadAll: () => {
        items.value = items.value.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt ?? new Date().toISOString(),
        }))
        unreadCount.value = 0
      },
    })

    realtimeConnected.value = true
  }

  function stopRealtime() {
    disconnectNotificationsRealtime()
    realtimeConnected.value = false
  }

  async function markAsRead(id: string) {
    const target = items.value.find((item) => item.id === id)
    if (!target || target.isRead) {
      return
    }

    await notificationsService.markAsRead(id)
    target.isRead = true
    target.readAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  async function markAllAsRead() {
    if (!hasUnread.value) {
      return
    }

    await notificationsService.markAllAsRead()
    items.value = items.value.map((item) => ({
      ...item,
      isRead: true,
      readAt: item.readAt ?? new Date().toISOString(),
    }))
    unreadCount.value = 0
  }

  return {
    items,
    unreadCount,
    loading,
    initialized,
    realtimeConnected,
    activeTypeFilter,
    hasUnread,
    fetchLatest,
    setTypeFilter,
    startRealtime,
    stopRealtime,
    markAsRead,
    markAllAsRead,
  }
})
