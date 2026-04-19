import { http } from './http'
import type {
  ApiResponse,
  Category,
  Size,
  Color,
  MeasurementUnit,
  CreateCategoryDto,
  CreateSizeDto,
  CreateColorDto,
  CreateMeasurementUnitDto,
  Tag,
  CreateTagDto,
} from '@/types/api'

type CatalogCrudService<TEntity, TCreateDto> = {
  list: () => Promise<TEntity[]>
  create: (dto: TCreateDto) => Promise<TEntity>
  update: (id: string, dto: Partial<TCreateDto>) => Promise<TEntity>
  remove: (id: string) => Promise<void>
}

function createCatalogService<TEntity, TCreateDto>(endpoint: string): CatalogCrudService<TEntity, TCreateDto> {
  const basePath = `/${endpoint}`

  return {
    async list() {
      const res = await http.get<ApiResponse<TEntity[]>>(basePath)
      return res.data.data
    },
    async create(dto) {
      const res = await http.post<ApiResponse<TEntity>>(basePath, dto)
      return res.data.data
    },
    async update(id, dto) {
      const res = await http.patch<ApiResponse<TEntity>>(`${basePath}/${id}`, dto)
      return res.data.data
    },
    async remove(id) {
      await http.delete(`${basePath}/${id}`)
    },
  }
}

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

export const sizesService = createCatalogService<Size, CreateSizeDto>('sizes')
export const measurementUnitsService = createCatalogService<MeasurementUnit, CreateMeasurementUnitDto>('measurement-units')
export const colorsService = createCatalogService<Color, CreateColorDto>('colors')
export const tagsService = createCatalogService<Tag, CreateTagDto>('tags')
