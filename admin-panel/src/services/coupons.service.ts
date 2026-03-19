import { http } from './http'
import type { ApiResponse, Coupon, CreateCouponDto, UpdateCouponDto } from '@/types/api'

export const couponsService = {
  async list() {
    const res = await http.get<ApiResponse<Coupon[]>>('/coupons')
    return res.data.data
  },

  async get(id: string) {
    const res = await http.get<ApiResponse<Coupon>>(`/coupons/${id}`)
    return res.data.data
  },

  async create(dto: CreateCouponDto) {
    const res = await http.post<ApiResponse<Coupon>>('/coupons', dto)
    return res.data.data
  },

  async update(id: string, dto: UpdateCouponDto) {
    const res = await http.patch<ApiResponse<Coupon>>(`/coupons/${id}`, dto)
    return res.data.data
  },

  async remove(id: string) {
    await http.delete(`/coupons/${id}`)
  },

  async validate(code: string, orderAmount: number) {
    const res = await http.post<ApiResponse<{ isValid: boolean; discount: number; type: string }>>(
      '/coupons/validate',
      { code, orderAmount },
    )
    return res.data.data
  },
}
