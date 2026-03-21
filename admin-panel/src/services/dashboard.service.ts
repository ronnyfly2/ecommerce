import { http } from './http'
import type { ApiResponse, DashboardSummary, DashboardSummaryQuery } from '@/types/api'

export const dashboardService = {
  async summary(params?: DashboardSummaryQuery) {
    const res = await http.get<ApiResponse<DashboardSummary>>('/dashboard/summary', { params })
    return res.data.data
  },
}