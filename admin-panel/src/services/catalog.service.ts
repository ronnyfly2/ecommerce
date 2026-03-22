import { http } from './http'
import type {
  ApiResponse,
  Category,
  Size,
  Color,
  CreateCategoryDto,
  CreateSizeDto,
  CreateColorDto,
  Tag,
  CreateTagDto,
} from '@/types/api'

export const categoriesService = {
  async list() {
    const res = await http.get<ApiResponse<Category[]>>('/categories')
    return res.data.data
  },
  async tree() {
    const res = await http.get<ApiResponse<Category[]>>('/categories/tree')
    return res.data.data
  },
  async create(dto: CreateCategoryDto) {
    const res = await http.post<ApiResponse<Category>>('/categories', dto)
    return res.data.data
  },
  async update(id: string, dto: Partial<CreateCategoryDto>) {
    const res = await http.patch<ApiResponse<Category>>(`/categories/${id}`, dto)
    return res.data.data
  },
  async remove(id: string) {
    await http.delete(`/categories/${id}`)
  },
}

export const sizesService = {
  async list() {
    const res = await http.get<ApiResponse<Size[]>>('/sizes')
    return res.data.data
  },
  async create(dto: CreateSizeDto) {
    const res = await http.post<ApiResponse<Size>>('/sizes', dto)
    return res.data.data
  },
  async update(id: string, dto: Partial<CreateSizeDto>) {
    const res = await http.patch<ApiResponse<Size>>(`/sizes/${id}`, dto)
    return res.data.data
  },
  async remove(id: string) {
    await http.delete(`/sizes/${id}`)
  },
}

export const colorsService = {
  async list() {
    const res = await http.get<ApiResponse<Color[]>>('/colors')
    return res.data.data
  },
  async create(dto: CreateColorDto) {
    const res = await http.post<ApiResponse<Color>>('/colors', dto)
    return res.data.data
  },
  async update(id: string, dto: Partial<CreateColorDto>) {
    const res = await http.patch<ApiResponse<Color>>(`/colors/${id}`, dto)
    return res.data.data
  },
  async remove(id: string) {
    await http.delete(`/colors/${id}`)
  },
}

export const tagsService = {
  async list() {
    const res = await http.get<ApiResponse<Tag[]>>('/tags')
    return res.data.data
  },
  async create(dto: CreateTagDto) {
    const res = await http.post<ApiResponse<Tag>>('/tags', dto)
    return res.data.data
  },
  async update(id: string, dto: Partial<CreateTagDto>) {
    const res = await http.patch<ApiResponse<Tag>>(`/tags/${id}`, dto)
    return res.data.data
  },
  async remove(id: string) {
    await http.delete(`/tags/${id}`)
  },
}
