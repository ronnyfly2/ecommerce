<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
import { useToast } from '@/composables/useToast'
import { adminToolsService } from '@/services/admin-tools.service'
import type { SeedCleanMode } from '@/types/api'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const sessions = ref<RefreshTokenRecord[]>([])
const loading = ref(true)
const closingAll = ref(false)
const revokingId = ref<string | null>(null)
const showLocalSeedConfig = import.meta.env.DEV
const seedActionLoading = ref<
  'run' | 'clean-seed' | 'clean-seed-force' | 'clean-users-all' | 'clean-all' | null
>(null)
const seedActionResult = ref<string>('')
const confirmModalOpen = ref(false)
const confirmInput = ref('')
const pendingDestructiveAction = ref<
  'clean-seed-force' | 'clean-users-all' | 'clean-all' | null
>(null)
const confirmKeyword = 'CONFIRMAR'

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
  seedActionResult.value = ''

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

      const force = action === 'clean-seed-force'
      result = (await adminToolsService.cleanSeed(modeByAction[action], force, confirmationPhrase)) as Record<string, unknown>
    }

    seedActionResult.value = JSON.stringify(result, null, 2)
    toast.success('Seed ejecutado')

    // Si se regeneran usuarios seed, refresca sesión para actualizar estado local.
    await auth.fetchMe()
  } catch (error) {
    const printable = extractErrorMessage(error, 'No se pudo ejecutar la accion de seed')
    toast.error('Error', printable)
    seedActionResult.value = printable
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
  loading.value = true
  try {
    sessions.value = await authService.sessions()
  } catch {
    toast.error('Error', 'No se pudieron cargar las sesiones activas')
  } finally {
    loading.value = false
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
          <p class="font-medium text-[--color-surface-900]">{{ auth.fullName || '—' }}</p>
        </div>
        <div>
          <p class="text-caption mb-1">Email</p>
          <p class="font-medium text-[--color-surface-900]">{{ auth.user?.email }}</p>
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

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="h-12 rounded-lg bg-[--color-surface-100] animate-pulse" />
      </div>

      <div v-else-if="!sessions.length" class="text-muted text-center py-8">
        No hay sesiones activas
      </div>

      <div v-else class="overflow-x-auto -mx-6 -mb-6">
        <table class="table-base">
          <thead>
            <tr>
              <th class="table-th">Dispositivo</th>
              <th class="table-th">IP</th>
              <th class="table-th">Creada</th>
              <th class="table-th">Último uso</th>
              <th class="table-th">Expira</th>
              <th class="table-th" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="s.tokenId" class="table-tr-hover">
              <td class="table-td">
                <p class="font-medium text-[--color-surface-900]">{{ s.deviceName || 'Dispositivo desconocido' }}</p>
                <p class="text-caption truncate max-w-[260px]">{{ s.userAgent || '—' }}</p>
              </td>
              <td class="table-td text-muted">{{ s.ipAddress || '—' }}</td>
              <td class="table-td text-xs text-muted">{{ new Date(s.createdAt).toLocaleString('es-AR') }}</td>
              <td class="table-td text-xs text-muted">{{ s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString('es-AR') : 'Nunca' }}</td>
              <td class="table-td text-xs text-muted">{{ new Date(s.expiresAt).toLocaleString('es-AR') }}</td>
              <td class="table-td text-right">
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
          </tbody>
        </table>
      </div>
    </UiCard>

    <UiCard v-if="showLocalSeedConfig" title="Configuracion local (seed)">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div class="md:col-span-2">
          <p class="text-caption mb-1">API base URL</p>
          <p class="font-mono text-xs bg-[--color-surface-100] rounded-md px-3 py-2 text-[--color-surface-800]">
            {{ localSeedConfig.apiBaseUrl }}
          </p>
        </div>

        <div class="rounded-lg border border-[--color-surface-200] p-4">
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
              class="font-medium text-[--color-surface-900] break-all"
            >
              {{ email }}
            </p>
          </div>
          <p class="font-mono text-xs text-muted mt-1">{{ localSeedConfig.superAdminPassword }}</p>
        </div>

        <div class="rounded-lg border border-[--color-surface-200] p-4">
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
              class="font-medium text-[--color-surface-900] break-all"
            >
              {{ email }}
            </p>
          </div>
          <p class="font-mono text-xs text-muted mt-1">{{ localSeedConfig.adminPassword }}</p>
        </div>

        <div class="rounded-lg border border-[--color-surface-200] p-4 md:col-span-2">
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
              class="font-medium text-[--color-surface-900] break-all"
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
          Vaciar toda la BD
        </UiButton>
      </div>

      <div v-if="seedActionResult" class="mt-4 rounded-lg bg-[--color-surface-900] text-[--color-surface-0] p-3 overflow-auto">
        <pre class="text-xs whitespace-pre-wrap">{{ seedActionResult }}</pre>
      </div>

      <template #footer>
        <p class="text-caption">
          Estos valores vienen de variables <span class="font-mono">VITE_SEED_*</span> y se muestran solo en desarrollo.
        </p>
      </template>
    </UiCard>

    <UiModal :show="confirmModalOpen" title="Confirmar accion destructiva" @close="closeConfirmModal">
      <div class="space-y-3 text-sm">
        <p class="text-[--color-surface-800]">
          Estás por ejecutar: <strong>{{ getActionLabel(pendingDestructiveAction) }}</strong>
        </p>
        <p class="text-muted">
          Para continuar, escribí <span class="font-mono">{{ confirmKeyword }}</span>.
        </p>
        <UiInput
          v-model="confirmInput"
          label="Confirmación"
          :placeholder="confirmKeyword"
        />
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="closeConfirmModal">Cancelar</UiButton>
        <UiButton
          variant="danger"
          :disabled="confirmInput.trim() !== confirmKeyword"
          @click="confirmDestructiveSeedAction"
        >
          Confirmar y ejecutar
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
