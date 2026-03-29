import { http } from './http'
import type {
  ApiResponse,
  ApiListData,
  Order,
  OrderStats,
  UpdateOrderStatusDto,
  QueryOrdersDto,
  CreateOrderDto,
} from '@/types/api'

export const ordersService = {
  async create(dto: CreateOrderDto) {
    const res = await http.post<ApiResponse<Order>>('/orders', dto)
    return res.data.data
  },

  async list(params?: QueryOrdersDto) {
    const res = await http.get<ApiResponse<ApiListData<Order>>>('/orders', { params })
    return res.data.data
  },

  async get(id: string) {
    const res = await http.get<ApiResponse<Order>>(`/orders/${id}`)
    return res.data.data
  },

  async stats() {
    const res = await http.get<ApiResponse<OrderStats>>('/orders/stats')
    return res.data.data
  },

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const res = await http.patch<ApiResponse<Order>>(`/orders/${id}/status`, dto)
    return res.data.data
  },
}
