import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth.service'
import { clearTokens } from '@/services/http'
import { useNotificationsStore } from '@/stores/notifications'
import type { User, LoginDto } from '@/types/api'
import { Role } from '@/types/api'
import { hasRolePermission, hasRouteAccess, type PermissionKey } from '@/utils/permissions'

export const useAuthStore = defineStore('auth', () => {
  const notifications = useNotificationsStore()
  const user = ref<User | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const currentRole = computed(() => user.value?.role ?? null)
  const isSuperAdmin = computed(() => user.value?.role === Role.SUPER_ADMIN)
  const isBoss = computed(() => user.value?.role === Role.BOSS)
  const isAdmin = computed(
    () =>
      user.value?.role === Role.ADMIN ||
      user.value?.role === Role.SUPER_ADMIN ||
      user.value?.role === Role.BOSS ||
      user.value?.role === Role.MARKETING ||
      user.value?.role === Role.SALES,
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
      notifications.reset()
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
      notifications.reset()
    } finally {
      initialized.value = true
    }
  }

  async function logout() {
    await authService.logout()
    notifications.reset()
    user.value = null
  }

  function reset() {
    notifications.reset()
    user.value = null
    clearTokens()
  }

  function can(permission: PermissionKey) {
    return hasRolePermission(currentRole.value, permission)
  }

  function canAccessRoles(roles?: readonly Role[]) {
    return hasRouteAccess(currentRole.value, roles)
  }

  return { user, loading, initialized, isAuthenticated, currentRole, isSuperAdmin, isBoss, isAdmin, fullName, login, fetchMe, logout, reset, can, canAccessRoles }
})
