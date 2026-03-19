import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth.service'
import { clearTokens } from '@/services/http'
import type { User, LoginDto } from '@/types/api'
import { Role } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isSuperAdmin = computed(() => user.value?.role === Role.SUPER_ADMIN)
  const isAdmin = computed(
    () => user.value?.role === Role.ADMIN || user.value?.role === Role.SUPER_ADMIN,
  )
  const fullName = computed(() => {
    if (!user.value) return ''
    const parts = [user.value.firstName, user.value.lastName].filter(Boolean)
    return parts.length ? parts.join(' ') : user.value.email
  })

  async function login(dto: LoginDto) {
    loading.value = true
    try {
      const { user: me } = await authService.login(dto)
      user.value = me
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    try {
      user.value = await authService.me()
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function logout() {
    await authService.logout()
    user.value = null
  }

  function reset() {
    user.value = null
    clearTokens()
  }

  return { user, loading, initialized, isAuthenticated, isSuperAdmin, isAdmin, fullName, login, fetchMe, logout, reset }
})
