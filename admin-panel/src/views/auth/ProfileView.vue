<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/auth.service'
import { extractErrorMessage } from '@/utils/error'
import type { RefreshTokenRecord } from '@/types/api'
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

onMounted(loadSessions)
</script>

<template>
  <div class="space-y-6">
    <UiCard title="Mi perfil">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
    </UiCard>

    <UiCard title="Sesiones activas">
      <div class="flex justify-end mb-4">
        <UiButton variant="danger" :loading="closingAll" @click="logoutAll">
          Cerrar todas las sesiones
        </UiButton>
      </div>

      <div class="-mx-6 -mb-6">
        <UiTable :data="sessions" :loading="tableLoading" loading-color="primary" loading-text="Cargando sesiones..." empty-message="No hay sesiones activas">
          <template #head>
            <tr>
              <th class="table-th">Dispositivo</th>
              <th class="table-th">IP</th>
              <th class="table-th">Creada</th>
              <th class="table-th">Último uso</th>
              <th class="table-th">Expira</th>
              <th class="table-th table-actions-th" />
            </tr>
          </template>

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
