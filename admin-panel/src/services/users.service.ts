import { http } from './http'
import type { ApiResponse, ApiListData, User, CreateUserDto, UpdateUserDto, QueryUsersDto } from '@/types/api'

export const usersService = {
  async list(params?: QueryUsersDto) {
    const res = await http.get<ApiResponse<ApiListData<User>>>('/users', { params })
    return res.data.data
  },

  async get(id: string) {
    const res = await http.get<ApiResponse<User>>(`/users/${id}`)
    return res.data.data
  },

  async create(dto: CreateUserDto) {
    const res = await http.post<ApiResponse<User>>('/users', dto)
    return res.data.data
  },

  async update(id: string, dto: UpdateUserDto) {
    const res = await http.patch<ApiResponse<User>>(`/users/${id}`, dto)
    return res.data.data
  },

  async remove(id: string) {
    await http.delete(`/users/${id}`)
  },
}
