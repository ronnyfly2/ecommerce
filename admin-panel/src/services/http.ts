import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import type { ApiResponse } from '@/types/api'

let _refreshing: Promise<string> | null = null
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

function getAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

export function hasAccessToken(): boolean {
  return !!getAccessToken()
}

function setAccessToken(token: string): void {
  localStorage.setItem('access_token', token)
}

export function clearTokens(): void {
  localStorage.removeItem('access_token')
}

// ----------------------------------------------------------
// Instancia principal
// ----------------------------------------------------------
const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // enviar cookie refresh automáticamente
})

// Attach access token
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh automático en 401
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const requestUrl = originalRequest?.url ?? ''

    // Evita refresh en endpoints de auth para no crear loops.
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password')

    if (isAuthEndpoint) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        if (!_refreshing) {
          _refreshing = axios
            .post<ApiResponse<{ accessToken: string }>>(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
            .then((res) => {
              const newToken = res.data.data.accessToken
              setAccessToken(newToken)
              _refreshing = null
              return newToken
            })
            .catch((err) => {
              _refreshing = null
              clearTokens()
              // Evita recarga infinita si ya estamos en login.
              if (window.location.pathname !== '/login') {
                window.location.replace('/login')
              }
              return Promise.reject(err)
            })
        }

        const newToken = await _refreshing
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return http(originalRequest)
      } catch {
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export { http, setAccessToken }
