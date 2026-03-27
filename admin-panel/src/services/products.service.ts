import { http } from './http'
import type {
  ApiResponse,
  ApiListData,
  Product,
  ProductVariant,
  CreateProductDto,
  UpdateProductDto,
  ProductImage,
  CreateProductImageDto,
  UpdateProductImageDto,
  CreateProductVariantDto,
  QueryProductsDto,
} from '@/types/api'

export const productsService = {
  async list(params?: QueryProductsDto) {
    const res = await http.get<ApiResponse<ApiListData<Product>>>('/products', { params })
    return res.data.data
  },

  async get(id: string) {
    const res = await http.get<ApiResponse<Product>>(`/products/${id}`)
    return res.data.data
  },

  async getRecommendations(id: string) {
    const res = await http.get<ApiResponse<{ product: Pick<Product, 'id' | 'name' | 'sku'>; relatedProducts: Product[]; suggestedProducts: Product[]; variantProducts: Product[] }>>(
      `/products/${id}/recommendations`,
    )
    return res.data.data
  },

  async create(dto: CreateProductDto) {
    const res = await http.post<ApiResponse<Product>>('/products', dto)
    return res.data.data
  },

  async update(id: string, dto: UpdateProductDto) {
    const res = await http.patch<ApiResponse<Product>>(`/products/${id}`, dto)
    return res.data.data
  },

  async remove(id: string) {
    await http.delete(`/products/${id}`)
  },

  // Variantes
  async getVariants(productId: string) {
    const res = await http.get<ApiResponse<ProductVariant[]>>(`/products/${productId}/variants`)
    return res.data.data
  },

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    const res = await http.post<ApiResponse<ProductVariant>>(`/products/${productId}/variants`, dto)
    return res.data.data
  },

  async updateVariant(productId: string, variantId: string, dto: Partial<CreateProductVariantDto>) {
    const res = await http.patch<ApiResponse<ProductVariant>>(
      `/products/${productId}/variants/${variantId}`,
      dto,
    )
    return res.data.data
  },

  async removeVariant(productId: string, variantId: string) {
    await http.delete(`/products/${productId}/variants/${variantId}`)
  },

  // Imágenes
  async uploadImageAsset(file: File) {
    const form = new FormData()
    form.append('image', file)
    const res = await http.post<ApiResponse<string>>('/images/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async createImage(productId: string, dto: CreateProductImageDto) {
    const res = await http.post<ApiResponse<ProductImage>>(`/products/${productId}/images`, dto)
    return res.data.data
  },

  async updateImage(productId: string, imageId: string, dto: UpdateProductImageDto) {
    const res = await http.patch<ApiResponse<ProductImage>>(`/products/${productId}/images/${imageId}`, dto)
    return res.data.data
  },

  async removeImage(productId: string, imageId: string) {
    await http.delete(`/products/${productId}/images/${imageId}`)
  },
}
