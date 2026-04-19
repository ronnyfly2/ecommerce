import { http, setAccessToken, clearTokens } from './http'
import type {
  ApiResponse,
  ForgotPasswordDto,
  LoginDto,
  LoginResponse,
  RegisterDto,
  RefreshTokenRecord,
  ResetPasswordDto,
  UpdateProfileDto,
  User,
} from '@/types/api'

export const authService = {
  async login(dto: LoginDto) {
    const res = await http.post<ApiResponse<LoginResponse>>('/auth/login', dto)
    const { accessToken, user } = res.data.data
    setAccessToken(accessToken)
    return { accessToken, user }
  },

  async register(dto: RegisterDto) {
    const res = await http.post<ApiResponse<LoginResponse>>('/auth/register', dto)
    const { accessToken, user } = res.data.data
    setAccessToken(accessToken)
    return { accessToken, user }
  },

  async me() {
    const res = await http.get<ApiResponse<User>>('/auth/me')
    return res.data.data
  },

  async updateMe(dto: UpdateProfileDto) {
    const res = await http.patch<ApiResponse<User>>('/auth/me', dto)
    return res.data.data
  },

  async uploadAvatar(file: File) {
    const form = new FormData()
    form.append('image', file)
    const res = await http.post<ApiResponse<{ url: string; filename: string }>>('/images/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data.url
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const res = await http.post<ApiResponse<{ message: string }>>('/auth/forgot-password', dto)
    return res.data.data
  },

  async resetPassword(dto: ResetPasswordDto) {
    const res = await http.post<ApiResponse<{ message: string }>>('/auth/reset-password', dto)
    return res.data.data
  },
}
