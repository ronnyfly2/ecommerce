import { http } from './http'
import type { ApiResponse, NotificationListData, QueryNotificationsDto } from '@/types/api'

export const notificationsService = {
  async list(params?: QueryNotificationsDto) {
    const res = await http.get<ApiResponse<NotificationListData>>('/notifications', { params })
    return res.data.data
  },

  async markAsRead(id: string) {
    await http.patch<ApiResponse<{ updated: boolean }>>(`/notifications/${id}/read`)
  },

  async markAllAsRead() {
    await http.patch<ApiResponse<{ updatedCount: number }>>('/notifications/read-all')
  },
}
