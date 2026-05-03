<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/auth.service'
import { extractErrorMessage } from '@/utils/error'
import type { RefreshTokenRecord } from '@/types/api'
import {
  PERMISSION_RESOURCES,
  CRUD_ACTIONS,
  PERMISSION_LABELS,
  PERMISSION_ACTION_LABELS,
  type PermissionResource,
  type CrudAction,
} from '@/utils/permissions'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import { useToast } from '@/composables/useToast'
import { adminToolsService } from '@/services/admin-tools.service'
import type { SeedCleanMode } from '@/types/api'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const sessions = ref<RefreshTokenRecord[] | null>(null)
const closingAll = ref(false)
const revokingId = ref<string | null>(null)
const tableLoading = computed(() => sessions.value === null)

const tableColumns = [
  { key: 'device', label: 'Dispositivo' },
  { key: 'ip', label: 'IP' },
  { key: 'created', label: 'Creada' },
  { key: 'lastUsed', label: 'Último uso' },
  { key: 'expires', label: 'Expira' },
  { key: 'actions', actions: true },
]
const showLocalSeedConfig = import.meta.env.DEV
const seedActionLoading = ref<
  'run' | 'clean-seed' | 'clean-seed-force' | 'clean-users-all' | 'clean-all' | null
>(null)
const seedActionResult = ref<Record<string, unknown> | null>(null)
const seedActionError = ref('')
const confirmModalOpen = ref(false)
const confirmInput = ref('')
const pendingDestructiveAction = ref<
  'clean-seed-force' | 'clean-users-all' | 'clean-all' | null
>(null)
const confirmKeyword = 'CONFIRMAR'
const savingProfile = ref(false)
const uploadingAvatar = ref(false)
const profileForm = reactive({
  firstName: '',
  lastName: '',
  avatar: '',
})

const profileInitials = computed(() => {
  const parts = [profileForm.firstName, profileForm.lastName]
    .map((value) => value.trim())
    .filter(Boolean)

  if (!parts.length) {
    return (auth.user?.email?.[0] ?? '?').toUpperCase()
  }

  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('')
})

const profileAvatarPreview = computed(() => {
  if (profileForm.avatar.trim()) {
    return profileForm.avatar.trim()
  }
  return auth.user?.avatar ?? ''
})

const seedModeLabel = computed(() => {
  const mode = seedActionResult.value?.mode
  return typeof mode === 'string' ? mode : '—'
})

const seedModeBadgeColor = computed(() => {
  const mode = seedModeLabel.value
  if (mode === 'seed-run' || mode === 'seed-safe') return 'success'
  if (mode === 'seed-force') return 'warning'
  if (mode === 'users-all' || mode === 'all') return 'danger'
  return 'neutral'
})

const seedModeDisplayLabel = computed(() => {
  const mode = seedModeLabel.value
  if (mode === 'seed-run') return 'Seed ejecutado'
  if (mode === 'seed-safe') return 'Limpieza seed (safe)'
  if (mode === 'seed-force') return 'Limpieza seed (force)'
  if (mode === 'users-all') return 'Borrado total de usuarios'
  if (mode === 'all') return 'Vaciado total de BD'
  return mode
})

const seedResultPanelClass = computed(() => {
  const mode = seedModeLabel.value
  if (mode === 'seed-run' || mode === 'seed-safe') {
    return 'border-success-200 bg-success-50'
  }
  if (mode === 'seed-force') {
    return 'border-warning-200 bg-warning-50'
  }
  if (mode === 'users-all' || mode === 'all') {
    return 'border-danger-200 bg-danger-50'
  }
  return 'border-surface-200 bg-surface-0'
})

const confirmModalBadgeColor = computed(() => {
  const action = pendingDestructiveAction.value
  if (action === 'clean-seed-force') return 'warning'
  if (action === 'clean-users-all' || action === 'clean-all') return 'danger'
  return 'neutral'
})

const confirmModalPanelClass = computed(() => {
  const action = pendingDestructiveAction.value
  if (action === 'clean-seed-force') return 'border-warning-200 bg-warning-50'
  if (action === 'clean-users-all' || action === 'clean-all') return 'border-danger-200 bg-danger-50'
  return 'border-surface-200 bg-surface-50'
})

const seedStartedAtLabel = computed(() => {
  const startedAt = seedActionResult.value?.startedAt
  if (typeof startedAt !== 'string') return '—'
  return new Date(startedAt).toLocaleString('es-AR')
})

const seedFinishedAtLabel = computed(() => {
  const finishedAt = seedActionResult.value?.finishedAt
  if (typeof finishedAt !== 'string') return '—'
  return new Date(finishedAt).toLocaleString('es-AR')
})

const seedDurationMsLabel = computed(() => {
  const durationMs = seedActionResult.value?.durationMs
  if (typeof durationMs !== 'number') return '—'
  return `${durationMs} ms`
})

const seedTablesTruncatedLabel = computed(() => {
  const tablesTruncated = seedActionResult.value?.tablesTruncated
  if (typeof tablesTruncated !== 'number') return '—'
  return String(tablesTruncated)
})

const seedTruncatedTables = computed(() => {
  const tables = seedActionResult.value?.truncatedTables
  if (!Array.isArray(tables)) return []
  return tables.filter((item): item is string => typeof item === 'string')
})

const seedActionResultPretty = computed(() => {
  if (!seedActionResult.value) return ''
  return JSON.stringify(seedActionResult.value, null, 2)
})

function parseSeedEmails(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback
  return value
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

const localSeedConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  superAdminEmail: import.meta.env.VITE_SEED_SUPER_ADMIN_EMAIL || 'superadmin@local.dev',
  superAdminPassword: import.meta.env.VITE_SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin2026!',
  adminEmail: import.meta.env.VITE_SEED_ADMIN_EMAIL || 'admin@local.dev',
  adminPassword: import.meta.env.VITE_SEED_ADMIN_PASSWORD || 'Admin2026!',
  customerPassword: import.meta.env.VITE_SEED_CUSTOMER_PASSWORD || 'Customer2026!',
  superAdminEmails: parseSeedEmails(import.meta.env.VITE_SEED_SUPER_ADMIN_EMAILS, [
    'superadmin@local.dev',
    'superadmin2@local.dev',
  ]),
  adminEmails: parseSeedEmails(import.meta.env.VITE_SEED_ADMIN_EMAILS, [
    'admin@local.dev',
    'admin2@local.dev',
    'admin3@local.dev',
  ]),
  customerEmails: parseSeedEmails(import.meta.env.VITE_SEED_CUSTOMER_EMAILS, [
    'customer1@local.dev',
    'customer2@local.dev',
    'customer3@local.dev',
  ]),
}

async function copyRoleCredentials(role: 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER') {
  const byRole = {
    SUPER_ADMIN: {
      emails: localSeedConfig.superAdminEmails,
      password: localSeedConfig.superAdminPassword,
    },
    ADMIN: {
      emails: localSeedConfig.adminEmails,
      password: localSeedConfig.adminPassword,
    },
    CUSTOMER: {
      emails: localSeedConfig.customerEmails,
      password: localSeedConfig.customerPassword,
    },
  }

  const selected = byRole[role]
  const payload = `ROLE: ${role}\nEMAILS:\n- ${selected.emails.join('\n- ')}\nPASSWORD: ${selected.password}`

  try {
    await navigator.clipboard.writeText(payload)
    toast.success('Credenciales copiadas', `Se copiaron las credenciales de ${role}`)
  } catch {
    toast.error('Error', 'No se pudieron copiar las credenciales')
  }
}

async function executeSeedAction(
  action: 'run' | 'clean-seed' | 'clean-seed-force' | 'clean-users-all' | 'clean-all',
  confirmationPhrase?: string,
) {
  seedActionLoading.value = action
  seedActionResult.value = null
  seedActionError.value = ''

  try {
    let result: Record<string, unknown>

    if (action === 'run') {
      result = (await adminToolsService.runSeed()) as Record<string, unknown>
    } else {
      const modeByAction: Record<
        'clean-seed' | 'clean-seed-force' | 'clean-users-all' | 'clean-all',
        SeedCleanMode
      > = {
        'clean-seed': 'seed',
        'clean-seed-force': 'seed',
        'clean-users-all': 'users-all',
        'clean-all': 'all',
      }

      const force = action === 'clean-seed-force' || action === 'clean-all'
      result = (await adminToolsService.cleanSeed(modeByAction[action], force, confirmationPhrase)) as Record<string, unknown>
    }

    seedActionResult.value = result
    toast.success('Seed ejecutado')

    // Si se regeneran usuarios seed, refresca sesión para actualizar estado local.
    await auth.fetchMe()
  } catch (error) {
    const printable = extractErrorMessage(error, 'No se pudo ejecutar la accion de seed')
    toast.error('Error', printable)
    seedActionError.value = printable
  } finally {
    seedActionLoading.value = null
  }
}

function closeConfirmModal() {
  confirmModalOpen.value = false
  confirmInput.value = ''
  pendingDestructiveAction.value = null
}

function requestSeedAction(
  action: 'run' | 'clean-seed' | 'clean-seed-force' | 'clean-users-all' | 'clean-all',
) {
  if (action === 'clean-seed-force' || action === 'clean-users-all' || action === 'clean-all') {
    pendingDestructiveAction.value = action
    confirmInput.value = ''
    confirmModalOpen.value = true
    return
  }

  void executeSeedAction(action)
}

async function confirmDestructiveSeedAction() {
  if (!pendingDestructiveAction.value) return
  if (confirmInput.value.trim() !== confirmKeyword) return

  const action = pendingDestructiveAction.value
  const confirmationPhrase = confirmInput.value.trim()
  closeConfirmModal()
  await executeSeedAction(action, confirmationPhrase)
}

function getActionLabel(action: 'clean-seed-force' | 'clean-users-all' | 'clean-all' | null) {
  if (action === 'clean-seed-force') return 'Limpiar seed (force)'
  if (action === 'clean-users-all') return 'Borrar todos los usuarios'
  if (action === 'clean-all') return 'Vaciar toda la BD'
  return ''
}

async function loadSessions() {
  sessions.value = null
  try {
    sessions.value = await authService.sessions()
  } catch {
    sessions.value = []
    toast.error('Error', 'No se pudieron cargar las sesiones activas')
  }
}

async function revokeSession(tokenId: string) {
  revokingId.value = tokenId
  try {
    await authService.revokeSession(tokenId)
    toast.success('Sesión revocada')
    await loadSessions()
  } catch {
    toast.error('Error', 'No se pudo revocar la sesión')
  } finally {
    revokingId.value = null
  }
}

async function logoutAll() {
  if (!window.confirm('Esto cerrará todas tus sesiones activas. ¿Continuar?')) return

  closingAll.value = true
  try {
    await authService.logoutAll()
    auth.reset()
    toast.success('Sesiones cerradas', 'Volvé a iniciar sesión')
    router.push('/login')
  } catch {
    toast.error('Error', 'No se pudieron cerrar todas las sesiones')
  } finally {
    closingAll.value = false
  }
}

function hydrateProfileForm() {
  profileForm.firstName = auth.user?.firstName ?? ''
  profileForm.lastName = auth.user?.lastName ?? ''
  profileForm.avatar = auth.user?.avatar ?? ''
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await auth.updateProfile({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      avatar: profileForm.avatar,
    })
    toast.success('Perfil actualizado')
    hydrateProfileForm()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo actualizar el perfil'))
  } finally {
    savingProfile.value = false
  }
}

async function onAvatarSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingAvatar.value = true
  try {
    const avatarUrl = await authService.uploadAvatar(file)
    profileForm.avatar = avatarUrl
    toast.success('Avatar cargado', 'Recuerda guardar cambios')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo subir la imagen'))
  } finally {
    uploadingAvatar.value = false
    target.value = ''
  }
}

// ──────────── Effective permissions matrix ────────────
const directPermSet = computed(() =>
  new Set<string>(auth.user?.grantedPermissions ?? []),
)
const effectivePermSet = computed(() =>
  new Set<string>(auth.user?.effectivePermissions ?? auth.user?.grantedPermissions ?? []),
)
const impliedPermSet = computed(() => {
  const s = new Set<string>()
  for (const perm of effectivePermSet.value) {
    if (!directPermSet.value.has(perm)) s.add(perm)
  }
  return s
})

function permStatus(resource: PermissionResource, action: CrudAction): 'direct' | 'implied' | 'none' {
  const key = `${resource}.${action}`
  if (directPermSet.value.has(key)) return 'direct'
  if (impliedPermSet.value.has(key)) return 'implied'
  return 'none'
}

const visibleResources = computed(() => {
  if (auth.isSuperAdmin) return [...PERMISSION_RESOURCES]
  return [...PERMISSION_RESOURCES].filter((r) =>
    CRUD_ACTIONS.some((a) => effectivePermSet.value.has(`${r}.${a}`)),
  )
})

onMounted(async () => {
  await loadSessions()
  hydrateProfileForm()
})
</script>

<template>
  <div class="space-y-6">
    <UiCard title="Mi perfil">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
        <div class="lg:col-span-1">
          <p class="text-caption mb-2">Avatar</p>
          <div class="flex items-center gap-3">
            <img
              v-if="profileAvatarPreview"
              :src="profileAvatarPreview"
              alt="Avatar"
              class="h-16 w-16 rounded-full object-cover border border-surface-200"
            />
            <div
              v-else
              class="h-16 w-16 rounded-full bg-primary-100 text-primary-700 border border-primary-200 flex items-center justify-center text-lg font-semibold"
            >
              {{ profileInitials }}
            </div>
            <div class="space-y-2">
              <input
                type="file"
                accept="image/*"
                class="block text-xs text-surface-600"
                :disabled="uploadingAvatar"
                @change="onAvatarSelected"
              />
              <UiButton size="sm" variant="ghost" :loading="uploadingAvatar" @click="profileForm.avatar = ''">
                Usar inicial
              </UiButton>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UiInput v-model="profileForm.firstName" label="Nombre" />
          <UiInput v-model="profileForm.lastName" label="Apellido" />
          <UiInput v-model="profileForm.avatar" class="sm:col-span-2" label="URL de avatar (opcional)" />
        </div>

        <div class="lg:col-span-3 flex justify-end">
          <UiButton :loading="savingProfile" @click="saveProfile">Guardar perfil</UiButton>
        </div>

        <div class="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p class="text-caption mb-1">Nombre</p>
          <p class="font-medium text-surface-900">{{ auth.fullName || '—' }}</p>
        </div>
        <div>
          <p class="text-caption mb-1">Email</p>
          <p class="font-medium text-surface-900">{{ auth.user?.email }}</p>
        </div>
        <div>
          <p class="text-caption mb-1">Rol</p>
          <UiBadge color="primary">{{ auth.user?.role }}</UiBadge>
        </div>
        <div>
          <p class="text-caption mb-1">Estado</p>
          <UiBadge :color="auth.user?.isActive ? 'success' : 'danger'" dot>
            {{ auth.user?.isActive ? 'Activo' : 'Inactivo' }}
          </UiBadge>
        </div>
      </div>
      </div>
    </UiCard>

    <!-- ── Permisos efectivos ── -->
    <UiCard title="Permisos efectivos">
      <!-- SUPER_ADMIN: acceso total -->
      <div
        v-if="auth.isSuperAdmin"
        class="flex items-center gap-4 rounded-lg border border-primary-200 bg-primary-50 px-5 py-4"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
            <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
          </svg>
        </span>
        <div>
          <p class="font-semibold text-primary-800">Acceso total — SUPER_ADMIN</p>
          <p class="mt-0.5 text-sm text-primary-600">Este rol tiene acceso irrestricto a todas las funcionalidades y recursos del sistema.</p>
        </div>
      </div>

      <!-- Otros roles -->
      <div v-else class="space-y-5">
        <!-- Rol + roles delegados -->
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-caption">Rol base:</span>
          <UiBadge color="primary">{{ auth.user?.role }}</UiBadge>
          <template v-if="auth.user?.grantedRoles?.length">
            <span class="text-caption ml-1">Roles delegados:</span>
            <UiBadge v-for="r in auth.user.grantedRoles" :key="r" color="neutral">{{ r }}</UiBadge>
          </template>
        </div>

        <!-- Estadísticas -->
        <div class="grid grid-cols-3 gap-3 text-center text-sm">
          <div class="rounded-lg border border-primary-200 bg-primary-50 px-2 py-3">
            <p class="text-2xl font-bold tabular-nums text-primary-700">{{ directPermSet.size }}</p>
            <p class="mt-0.5 text-caption">Directos</p>
          </div>
          <div class="rounded-lg border border-primary-100 bg-primary-50/40 px-2 py-3">
            <p class="text-2xl font-bold tabular-nums text-primary-400">{{ impliedPermSet.size }}</p>
            <p class="mt-0.5 text-caption">Implicados</p>
          </div>
          <div class="rounded-lg border border-surface-200 bg-surface-50 px-2 py-3">
            <p class="text-2xl font-bold tabular-nums text-surface-700">{{ effectivePermSet.size }}</p>
            <p class="mt-0.5 text-caption">Total efectivos</p>
          </div>
        </div>

        <!-- Sin permisos -->
        <div
          v-if="!visibleResources.length"
          class="rounded-lg border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-muted"
        >
          Este usuario no tiene permisos asignados aún.
        </div>

        <!-- Matriz de permisos -->
        <div v-else class="-mx-6 overflow-x-auto">
          <table class="min-w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-surface-200 bg-surface-50">
                <th class="py-2.5 pl-6 pr-4 text-left text-caption font-medium text-surface-600">Recurso</th>
                <th
                  v-for="action in CRUD_ACTIONS"
                  :key="action"
                  class="min-w-18 py-2.5 px-2 text-center text-caption font-medium text-surface-600"
                >
                  {{ PERMISSION_ACTION_LABELS[action] }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr
                v-for="resource in visibleResources"
                :key="resource"
                class="transition-colors hover:bg-surface-50"
              >
                <td class="py-2 pl-6 pr-4 font-medium text-surface-800">
                  {{ PERMISSION_LABELS[resource] }}
                </td>
                <td
                  v-for="action in CRUD_ACTIONS"
                  :key="action"
                  class="py-2 px-2 text-center"
                >
                  <!-- Directo -->
                  <span
                    v-if="permStatus(resource, action) === 'direct'"
                    class="inline-flex h-6 w-6 items-center justify-center rounded bg-primary-500 text-white"
                    :title="`${resource}.${action} — asignado directo`"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                      <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                    </svg>
                  </span>
                  <!-- Implicado -->
                  <span
                    v-else-if="permStatus(resource, action) === 'implied'"
                    class="inline-flex h-6 w-6 items-center justify-center rounded bg-primary-100 text-primary-500"
                    :title="`${resource}.${action} — implicado por dependencia de API`"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3">
                      <path fill-rule="evenodd" d="M10.21 14.77a.75.75 0 01.02-1.06L14.168 10 10.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                      <path fill-rule="evenodd" d="M4.21 14.77a.75.75 0 01.02-1.06L8.168 10 4.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    </svg>
                  </span>
                  <!-- Sin acceso -->
                  <span
                    v-else
                    class="inline-flex h-6 w-6 items-center justify-center rounded bg-surface-100"
                    :title="`${resource}.${action} — sin acceso`"
                  >
                    <span class="h-px w-3 rounded bg-surface-300"></span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Leyenda -->
        <div class="flex flex-wrap items-center gap-5 text-xs text-muted">
          <div class="flex items-center gap-1.5">
            <span class="h-4 w-4 shrink-0 rounded bg-primary-500"></span>
            <span>Asignado directo</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-4 w-4 shrink-0 rounded border border-primary-200 bg-primary-100"></span>
            <span>Implicado por dependencia de API</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-4 w-4 shrink-0 rounded border border-surface-200 bg-surface-100"></span>
            <span>Sin acceso</span>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard title="Sesiones activas">
      <div class="flex justify-end mb-4">
        <UiButton variant="danger" :loading="closingAll" @click="logoutAll">
          Cerrar todas las sesiones
        </UiButton>
      </div>

      <div class="-mx-6 -mb-6">
        <UiTable :data="sessions" :loading="tableLoading" :columns="tableColumns" loading-color="primary" loading-text="Cargando sesiones..." empty-message="No hay sesiones activas">

          <tr v-for="s in sessions ?? []" :key="s.tokenId" class="table-tr-hover">
            <td class="table-td">
              <p class="font-medium text-surface-900">{{ s.deviceName || 'Dispositivo desconocido' }}</p>
              <p class="text-caption truncate max-w-65">{{ s.userAgent || '—' }}</p>
            </td>
            <td class="table-td text-muted">{{ s.ipAddress || '—' }}</td>
            <td class="table-td text-xs text-muted">{{ new Date(s.createdAt).toLocaleString('es-AR') }}</td>
            <td class="table-td text-xs text-muted">{{ s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString('es-AR') : 'Nunca' }}</td>
            <td class="table-td text-xs text-muted">{{ new Date(s.expiresAt).toLocaleString('es-AR') }}</td>
            <td class="table-td table-actions-td text-right">
              <UiButton
                size="sm"
                variant="danger"
                :loading="revokingId === s.tokenId"
                @click="revokeSession(s.tokenId)"
              >
                Revocar
              </UiButton>
            </td>
          </tr>
        </UiTable>
      </div>
    </UiCard>

    <UiCard v-if="showLocalSeedConfig" title="Configuracion local (seed)">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div class="md:col-span-2">
          <p class="text-caption mb-1">API base URL</p>
          <p class="font-mono text-xs bg-surface-100 rounded-md px-3 py-2 text-surface-800">
            {{ localSeedConfig.apiBaseUrl }}
          </p>
        </div>

        <div class="rounded-lg border border-surface-200 p-4">
          <div class="flex items-start justify-between gap-3 mb-2">
            <p class="text-caption">SUPER_ADMIN</p>
            <UiButton size="sm" variant="ghost" @click="copyRoleCredentials('SUPER_ADMIN')">
              Copiar
            </UiButton>
          </div>
          <div class="space-y-1">
            <p
              v-for="email in localSeedConfig.superAdminEmails"
              :key="email"
              class="font-medium text-surface-900 break-all"
            >
              {{ email }}
            </p>
          </div>
          <p class="font-mono text-xs text-muted mt-1">{{ localSeedConfig.superAdminPassword }}</p>
        </div>

        <div class="rounded-lg border border-surface-200 p-4">
          <div class="flex items-start justify-between gap-3 mb-2">
            <p class="text-caption">ADMIN</p>
            <UiButton size="sm" variant="ghost" @click="copyRoleCredentials('ADMIN')">
              Copiar
            </UiButton>
          </div>
          <div class="space-y-1">
            <p
              v-for="email in localSeedConfig.adminEmails"
              :key="email"
              class="font-medium text-surface-900 break-all"
            >
              {{ email }}
            </p>
          </div>
          <p class="font-mono text-xs text-muted mt-1">{{ localSeedConfig.adminPassword }}</p>
        </div>

        <div class="rounded-lg border border-surface-200 p-4 md:col-span-2">
          <div class="flex items-start justify-between gap-3 mb-2">
            <p class="text-caption">CUSTOMER</p>
            <UiButton size="sm" variant="ghost" @click="copyRoleCredentials('CUSTOMER')">
              Copiar
            </UiButton>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <p
              v-for="email in localSeedConfig.customerEmails"
              :key="email"
              class="font-medium text-surface-900 break-all"
            >
              {{ email }}
            </p>
          </div>
          <p class="font-mono text-xs text-muted mt-2">{{ localSeedConfig.customerPassword }}</p>
        </div>
      </div>

      <div v-if="auth.isSuperAdmin" class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2">
        <UiButton :loading="seedActionLoading === 'run'" @click="requestSeedAction('run')">
          Ejecutar seed
        </UiButton>
        <UiButton variant="secondary" :loading="seedActionLoading === 'clean-seed'" @click="requestSeedAction('clean-seed')">
          Limpiar seed (safe)
        </UiButton>
        <UiButton variant="danger" :loading="seedActionLoading === 'clean-seed-force'" @click="requestSeedAction('clean-seed-force')">
          Limpiar seed (force)
        </UiButton>
        <UiButton variant="danger" :loading="seedActionLoading === 'clean-users-all'" @click="requestSeedAction('clean-users-all')">
          Borrar todos los usuarios
        </UiButton>
        <UiButton class="md:col-span-2" variant="danger" :loading="seedActionLoading === 'clean-all'" @click="requestSeedAction('clean-all')">
          Vaciar toda la BD (force)
        </UiButton>
      </div>

      <div v-if="seedActionResult || seedActionError" class="mt-4 space-y-3">
        <div v-if="seedActionError" class="rounded-lg border border-danger-200 bg-danger-50 p-3 text-danger-800 text-sm">
          {{ seedActionError }}
        </div>

        <div v-if="seedActionResult" class="rounded-lg border p-4 space-y-3" :class="seedResultPanelClass">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-surface-900">Resultado de seed</p>
            <UiBadge :color="seedModeBadgeColor" dot>{{ seedModeDisplayLabel }}</UiBadge>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div class="rounded-md bg-surface-100 px-3 py-2">
              <p class="text-caption">Modo</p>
              <p class="font-medium text-surface-900">{{ seedModeLabel }}</p>
            </div>
            <div class="rounded-md bg-surface-100 px-3 py-2">
              <p class="text-caption">Inicio</p>
              <p class="font-medium text-surface-900">{{ seedStartedAtLabel }}</p>
            </div>
            <div class="rounded-md bg-surface-100 px-3 py-2">
              <p class="text-caption">Fin</p>
              <p class="font-medium text-surface-900">{{ seedFinishedAtLabel }}</p>
            </div>
            <div class="rounded-md bg-surface-100 px-3 py-2">
              <p class="text-caption">Duracion</p>
              <p class="font-medium text-surface-900">{{ seedDurationMsLabel }}</p>
            </div>
            <div class="rounded-md bg-surface-100 px-3 py-2">
              <p class="text-caption">Tablas truncadas</p>
              <p class="font-medium text-surface-900">{{ seedTablesTruncatedLabel }}</p>
            </div>
          </div>

          <div v-if="seedTruncatedTables.length" class="space-y-2">
            <p class="text-sm font-medium text-surface-800">Listado de tablas truncadas</p>
            <div class="flex flex-wrap gap-2">
              <UiBadge
                v-for="tableName in seedTruncatedTables"
                :key="tableName"
                color="neutral"
              >
                {{ tableName }}
              </UiBadge>
            </div>
          </div>

          <details>
            <summary class="text-xs text-surface-600 cursor-pointer">Ver JSON completo</summary>
            <pre class="mt-2 rounded-lg bg-surface-900 text-surface-0 p-3 text-xs whitespace-pre-wrap overflow-auto">{{ seedActionResultPretty }}</pre>
          </details>
        </div>
      </div>

      <template #footer>
        <p class="text-caption">
          Estos valores vienen de variables <span class="font-mono">VITE_SEED_*</span> y se muestran solo en desarrollo.
        </p>
      </template>
    </UiCard>

    <UiModal :show="confirmModalOpen" title="Confirmar accion destructiva" @close="closeConfirmModal">
      <div class="space-y-3 text-sm rounded-lg border p-3" :class="confirmModalPanelClass">
        <div class="flex items-center justify-between gap-2">
          <p class="text-surface-800">
            Estás por ejecutar: <strong>{{ getActionLabel(pendingDestructiveAction) }}</strong>
          </p>
          <UiBadge :color="confirmModalBadgeColor" dot>{{ getActionLabel(pendingDestructiveAction) }}</UiBadge>
        </div>
        <p class="text-muted">
          Para continuar, escribí <span class="font-mono">{{ confirmKeyword }}</span>.
        </p>
        <UiInput
          v-model="confirmInput"
          label="Confirmación"
          size="lg"
          :placeholder="confirmKeyword"
        />
      </div>

      <template #footer>
        <FormModalActions
          cancel-label="Cancelar"
          save-label="Confirmar y ejecutar"
          cancel-variant="ghost"
          save-variant="danger"
          :save-disabled="confirmInput.trim() !== confirmKeyword"
          @cancel="closeConfirmModal"
          @save="confirmDestructiveSeedAction"
        />
      </template>
    </UiModal>
  </div>
</template>
