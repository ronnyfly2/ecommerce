import { http } from './http'
import type {
  ApiResponse,
  ApiPaginatedData,
  ProductReview,
  ReviewStats,
  CreateReviewDto,
  UpdateReviewDto,
  QueryReviewsDto,
} from '@/types/api'

export const reviewsService = {
  async listByProduct(productId: string, params?: QueryReviewsDto) {
    const res = await http.get<ApiResponse<ApiPaginatedData<ProductReview>>>(
      `/products/${productId}/reviews`,
      { params },
    )
    return res.data.data
  },

  async listAllByProduct(productId: string, params?: QueryReviewsDto) {
    const res = await http.get<ApiResponse<ApiPaginatedData<ProductReview>>>(
      `/products/${productId}/reviews/all`,
      { params },
    )
    return res.data.data
  },

  async stats(productId: string) {
    const res = await http.get<ApiResponse<ReviewStats>>(
      `/products/${productId}/reviews/stats`,
    )
    return res.data.data
  },

  async create(productId: string, dto: CreateReviewDto) {
    const res = await http.post<ApiResponse<ProductReview>>(
      `/products/${productId}/reviews`,
      dto,
    )
    return res.data.data
  },

  async getMine(productId: string) {
    const res = await http.get<ApiResponse<ProductReview | null>>(
      `/products/${productId}/reviews/me`,
    )
    return res.data.data
  },

  async update(productId: string, id: string, dto: UpdateReviewDto) {
    const res = await http.patch<ApiResponse<ProductReview>>(`/products/${productId}/reviews/${id}`, dto)
    return res.data.data
  },

  async remove(productId: string, id: string) {
    await http.delete(`/products/${productId}/reviews/${id}`)
  },
}
