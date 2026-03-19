import { http, setAccessToken, clearTokens } from './http'
import type { ApiResponse, LoginDto, LoginResponse, User, RefreshTokenRecord } from '@/types/api'

export const authService = {
  async login(dto: LoginDto) {
    const res = await http.post<ApiResponse<LoginResponse>>('/auth/login', dto)
    const { accessToken, user } = res.data.data
    setAccessToken(accessToken)
    return { accessToken, user }
  },

  async me() {
    const res = await http.get<ApiResponse<User>>('/auth/me')
    return res.data.data
  },

  async logout() {
    try {
      await http.post('/auth/logout', {})
    } finally {
      clearTokens()
    }
  },

  async logoutAll() {
    try {
      await http.post('/auth/logout-all', {})
    } finally {
      clearTokens()
    }
  },

  async sessions() {
    const res = await http.get<ApiResponse<RefreshTokenRecord[]>>('/auth/sessions')
    return res.data.data
  },

  async revokeSession(tokenId: string) {
    await http.post('/auth/logout-device', { tokenId })
  },
}
