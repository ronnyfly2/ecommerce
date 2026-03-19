import { http } from './http'
import type { ApiResponse, DashboardSummary } from '@/types/api'

export const dashboardService = {
  async summary() {
    const res = await http.get<ApiResponse<DashboardSummary>>('/dashboard/summary')
    return res.data.data
  },
}