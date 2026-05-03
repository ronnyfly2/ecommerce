<script setup lang="ts">
import { computed, ref } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import { useToast } from '@/composables/useToast'
import { adminToolsService } from '@/services/admin-tools.service'
import { useAuthStore } from '@/stores/auth'
import type { SeedCleanMode, SeedRunTarget } from '@/types/api'
import { extractErrorMessage } from '@/utils/error'

type SeedAction = 'run' | 'clean-seed' | 'clean-seed-force' | 'clean-users-all' | 'clean-all'
type ModuleFilter =
  | 'all'
  | 'access'
  | 'reference'
  | 'taxonomy'
  | 'products'
  | 'sales'
  | 'logistics'
  | 'marketing'
  | 'maintenance'
type ExecStatus = 'success' | 'error' | 'running'

interface DryRunEntity {
  table: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRUNCATE'
  estimatedCount: string
  risk: 'low' | 'medium' | 'high'
}

interface SeedModuleAction {
  id: string
  action: SeedAction
  label: string
  description: string
  runTargets?: SeedRunTarget[]
  cleanTargets?: SeedRunTarget[]
  dryRun: DryRunEntity[]
}

interface SeedModule {
  id: string
  filterKey: ModuleFilter
  title: string
  detail: string
  impact: string[]
  actions: SeedModuleAction[]
}

interface ExecutionEntry {
  id: string
  timestamp: string
  action: SeedAction
  actionLabel: string
  moduleId: string
  actorEmail: string
  status: ExecStatus
  durationMs: number | null
  result: Record<string, unknown> | null
  error: string | null
}

const HISTORY_KEY = 'seed_manager_history'
const HISTORY_MAX = 50

function loadHistory(): ExecutionEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as ExecutionEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(entries: ExecutionEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)))
  } catch {
    // ignore local storage failures
  }
}

const auth = useAuthStore()
const toast = useToast()

const confirmKeyword = 'CONFIRMAR'
const showLocalSeedConfig = import.meta.env.DEV
const runtimeMode = import.meta.env.MODE

const localSeedConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  superAdminEmail: import.meta.env.VITE_SEED_SUPER_ADMIN_EMAIL || 'superadmin@local.dev',
  superAdminPassword: import.meta.env.VITE_SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin2026!',
  adminEmail: import.meta.env.VITE_SEED_ADMIN_EMAIL || 'admin@local.dev',
  adminPassword: import.meta.env.VITE_SEED_ADMIN_PASSWORD || 'Admin2026!',
  customerPassword: import.meta.env.VITE_SEED_CUSTOMER_PASSWORD || 'Customer2026!',
}

const destructiveActions = new Set<SeedAction>(['clean-seed-force', 'clean-users-all', 'clean-all'])

const seedModules: SeedModule[] = [
  {
    id: 'access-control',
    filterKey: 'access',
    title: 'Roles y accesos',
    detail: 'Crea cuentas seed por tipo de permiso para probar RBAC y perfiles internos.',
    impact: ['SUPER_ADMIN', 'ADMIN', 'BOSS', 'MARKETING', 'SALES', 'CUSTOMER'],
    actions: [
      {
        id: 'run-access',
        action: 'run',
        label: 'Seed de roles y accesos',
        description: 'Genera usuarios seed segmentados por rol y actualiza credenciales de prueba.',
        runTargets: ['access'],
        dryRun: [
          { table: 'users', operation: 'CREATE', estimatedCount: '11 cuentas seed', risk: 'low' },
          { table: 'users', operation: 'UPDATE', estimatedCount: 'Roles y contraseñas existentes', risk: 'low' },
        ],
      },
      {
        id: 'clean-users-all',
        action: 'clean-users-all',
        label: 'Borrar todos los usuarios',
        description: 'Trunca completamente usuarios y sus dependencias asociadas.',
        dryRun: [
          { table: 'users', operation: 'TRUNCATE', estimatedCount: 'Todos los usuarios', risk: 'high' },
          { table: 'refresh_tokens', operation: 'TRUNCATE', estimatedCount: 'Tokens y sesiones', risk: 'high' },
        ],
      },
    ],
  },
  {
    id: 'reference-attributes',
    filterKey: 'reference',
    title: 'Atributos base',
    detail: 'Carga tallas y colores utilizados por productos con variantes.',
    impact: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Black', 'White', 'Red'],
    actions: [
      {
        id: 'run-attributes',
        action: 'run',
        label: 'Seed de tallas y colores',
        description: 'Crea o actualiza atributos base de catálogo para variantes.',
        runTargets: ['sizes', 'colors'],
        dryRun: [
          { table: 'sizes', operation: 'CREATE', estimatedCount: '6 tallas seed', risk: 'low' },
          { table: 'colors', operation: 'CREATE', estimatedCount: '8 colores seed', risk: 'low' },
        ],
      },
    ],
  },
  {
    id: 'reference-currencies',
    filterKey: 'reference',
    title: 'Monedas',
    detail: 'Carga monedas operativas y deja USD como moneda por defecto para el entorno local.',
    impact: ['USD default', 'PEN', 'MXN', 'COP', 'CLP'],
    actions: [
      {
        id: 'run-currencies',
        action: 'run',
        label: 'Seed de monedas',
        description: 'Crea o actualiza monedas y tasas base del catálogo.',
        runTargets: ['currencies'],
        dryRun: [
          { table: 'currencies', operation: 'CREATE', estimatedCount: '5 monedas base', risk: 'low' },
          { table: 'currencies', operation: 'UPDATE', estimatedCount: 'USD como default', risk: 'low' },
        ],
      },
    ],
  },
  {
    id: 'taxonomy-categories',
    filterKey: 'taxonomy',
    title: 'Categorías',
    detail: 'Carga la jerarquía principal y subcategorías de demostración con atributos dinámicos.',
    impact: ['Indumentaria', 'Hidratación', 'Alimentos', 'Subcategorías'],
    actions: [
      {
        id: 'run-categories',
        action: 'run',
        label: 'Seed de categorías',
        description: 'Crea categorías raíz y subcategorías con definiciones de atributos.',
        runTargets: ['categories'],
        dryRun: [
          { table: 'categories', operation: 'CREATE', estimatedCount: '6 categorías', risk: 'low' },
          { table: 'categories', operation: 'UPDATE', estimatedCount: 'Jerarquías y atributos', risk: 'low' },
        ],
      },
    ],
  },
  {
    id: 'taxonomy-tags',
    filterKey: 'taxonomy',
    title: 'Tags comerciales',
    detail: 'Carga etiquetas reutilizables para merchandising y destacados del catálogo.',
    impact: ['nuevo', 'destacado', 'outdoor', 'cafe-especialidad'],
    actions: [
      {
        id: 'run-tags',
        action: 'run',
        label: 'Seed de tags',
        description: 'Crea o actualiza tags comerciales usados por productos demo.',
        runTargets: ['tags'],
        dryRun: [
          { table: 'tags', operation: 'CREATE', estimatedCount: '4 tags', risk: 'low' },
          { table: 'tags', operation: 'UPDATE', estimatedCount: 'Nombres/estado', risk: 'low' },
        ],
      },
    ],
  },
  {
    id: 'product-catalog',
    filterKey: 'products',
    title: 'Productos demo',
    detail: 'Carga productos demostrativos con imágenes, atributos y variantes para pruebas end-to-end.',
    impact: ['APP-POLO-PIMA', 'HOME-TERMO-750', 'FOOD-CAFE-GEISHA-1KG', '3 variantes'],
    actions: [
      {
        id: 'run-products',
        action: 'run',
        label: 'Seed de productos',
        description: 'Carga productos demo y resuelve dependencias base necesarias automáticamente.',
        runTargets: ['products'],
        dryRun: [
          { table: 'categories', operation: 'UPDATE', estimatedCount: 'Dependencias si faltan', risk: 'low' },
          { table: 'tags', operation: 'UPDATE', estimatedCount: 'Dependencias si faltan', risk: 'low' },
          { table: 'products', operation: 'CREATE', estimatedCount: '3 productos demo', risk: 'low' },
          { table: 'product_images', operation: 'CREATE', estimatedCount: '3 imágenes principales', risk: 'low' },
          { table: 'product_variants', operation: 'CREATE', estimatedCount: '3 variantes', risk: 'low' },
        ],
      },
    ],
  },
  {
    id: 'sales-coupons-orders',
    filterKey: 'sales',
    title: 'Ventas y pedidos',
    detail: 'Carga cupones y ordenes demo con items, direcciones y estados operativos.',
    impact: ['WELCOME10', 'BULK15', 'Ordenes PENDING/CONFIRMED/DELIVERED'],
    actions: [
      {
        id: 'run-sales',
        action: 'run',
        label: 'Seed de ventas',
        description: 'Genera cupones y pedidos segmentados para pruebas de flujo comercial.',
        runTargets: ['coupons', 'orders'],
        dryRun: [
          { table: 'coupons', operation: 'CREATE', estimatedCount: '2 cupones demo', risk: 'low' },
          { table: 'orders', operation: 'CREATE', estimatedCount: '3 órdenes seed', risk: 'medium' },
          { table: 'order_items', operation: 'CREATE', estimatedCount: '5 items de orden', risk: 'medium' },
        ],
      },
      {
        id: 'clean-sales',
        action: 'clean-seed',
        label: 'Limpiar ventas seed',
        description: 'Limpia ordenes y cupones generados por el seed segmentado.',
        cleanTargets: ['orders', 'coupons'],
        dryRun: [
          { table: 'orders', operation: 'DELETE', estimatedCount: 'Órdenes con prefijo seed', risk: 'high' },
          { table: 'coupon_usages', operation: 'DELETE', estimatedCount: 'Usos asociados', risk: 'high' },
          { table: 'coupons', operation: 'DELETE', estimatedCount: 'Cupones seed', risk: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'logistics-shipments',
    filterKey: 'logistics',
    title: 'Logística y carriers',
    detail: 'Configura carriers y genera envíos con eventos sobre órdenes seed.',
    impact: ['own-fleet', 'external-courier', 'Shipments con tracking'],
    actions: [
      {
        id: 'run-logistics',
        action: 'run',
        label: 'Seed de logística',
        description: 'Crea carriers y envíos segmentados enlazados a órdenes seed.',
        runTargets: ['carriers', 'shipments'],
        dryRun: [
          { table: 'carriers', operation: 'CREATE', estimatedCount: '2 carriers', risk: 'low' },
          { table: 'shipments', operation: 'CREATE', estimatedCount: '1 envío por orden seed', risk: 'medium' },
          { table: 'shipment_events', operation: 'CREATE', estimatedCount: 'Evento inicial por envío', risk: 'medium' },
        ],
      },
      {
        id: 'clean-logistics',
        action: 'clean-seed',
        label: 'Limpiar logística seed',
        description: 'Elimina envíos y carriers creados por el seed segmentado.',
        cleanTargets: ['shipments', 'carriers'],
        dryRun: [
          { table: 'shipments', operation: 'DELETE', estimatedCount: 'Envíos con metadata seed', risk: 'high' },
          { table: 'shipment_events', operation: 'DELETE', estimatedCount: 'Eventos en cascada', risk: 'high' },
          { table: 'carriers', operation: 'DELETE', estimatedCount: 'Carriers seed si no hay bloqueo', risk: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'marketing-notifications',
    filterKey: 'marketing',
    title: 'Notificaciones operativas',
    detail: 'Genera notificaciones internas para validar bandeja y eventos de orden.',
    impact: ['ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'Admins internos'],
    actions: [
      {
        id: 'run-notifications',
        action: 'run',
        label: 'Seed de notificaciones',
        description: 'Crea notificaciones demo para usuarios internos.',
        runTargets: ['notifications'],
        dryRun: [
          { table: 'notifications', operation: 'CREATE', estimatedCount: '1 notificación por rol interno', risk: 'low' },
        ],
      },
      {
        id: 'clean-notifications',
        action: 'clean-seed',
        label: 'Limpiar notificaciones seed',
        description: 'Elimina notificaciones creadas por el seed segmentado.',
        cleanTargets: ['notifications'],
        dryRun: [
          { table: 'notifications', operation: 'DELETE', estimatedCount: 'Notificaciones con metadata seed', risk: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'maintenance-seed',
    filterKey: 'maintenance',
    title: 'Limpieza segmentada completa',
    detail: 'Ejecuta limpieza total de los targets segmentados en orden seguro.',
    impact: ['Notificaciones', 'Envíos', 'Órdenes', 'Cupones', 'Productos', 'Accesos'],
    actions: [
      {
        id: 'clean-seed',
        action: 'clean-seed',
        label: 'Limpiar seed (safe)',
        description: 'Limpia todos los targets segmentados en modo seguro.',
        dryRun: [
          { table: 'notifications', operation: 'DELETE', estimatedCount: 'Notificaciones seed', risk: 'medium' },
          { table: 'shipments', operation: 'DELETE', estimatedCount: 'Envíos seed', risk: 'high' },
          { table: 'orders', operation: 'DELETE', estimatedCount: 'Órdenes seed', risk: 'high' },
          { table: 'products', operation: 'DELETE', estimatedCount: 'Productos demo', risk: 'high' },
          { table: 'users', operation: 'DELETE', estimatedCount: 'Usuarios seed', risk: 'high' },
        ],
      },
      {
        id: 'clean-seed-force',
        action: 'clean-seed-force',
        label: 'Limpiar seed (force)',
        description: 'Misma limpieza segmentada con confirmación destructiva.',
        dryRun: [
          { table: 'notifications', operation: 'DELETE', estimatedCount: 'Notificaciones seed', risk: 'high' },
          { table: 'shipments', operation: 'DELETE', estimatedCount: 'Envíos seed', risk: 'high' },
          { table: 'orders', operation: 'DELETE', estimatedCount: 'Órdenes seed', risk: 'high' },
          { table: 'products', operation: 'DELETE', estimatedCount: 'Productos demo', risk: 'high' },
          { table: 'users', operation: 'DELETE', estimatedCount: 'Usuarios seed', risk: 'high' },
        ],
      },
    ],
  },
  {
    id: 'maintenance-database',
    filterKey: 'maintenance',
    title: 'Base de datos completa',
    detail: 'Acciones destructivas de mantenimiento extremo del entorno local.',
    impact: ['TRUNCATE', 'RESET IDs', 'CASCADE', 'Mantiene SUPER_ADMIN'],
    actions: [
      {
        id: 'clean-all',
        action: 'clean-all',
        label: 'Vaciar toda la BD',
        description: 'Trunca todas las tablas públicas excepto migrations y deja solo usuarios SUPER_ADMIN.',
        dryRun: [
          { table: 'Todas las tablas públicas', operation: 'TRUNCATE', estimatedCount: 'Todos los registros', risk: 'high' },
          { table: 'users', operation: 'DELETE', estimatedCount: 'Se borran no-SUPER_ADMIN', risk: 'high' },
          { table: 'migrations', operation: 'TRUNCATE', estimatedCount: 'Omitida', risk: 'low' },
        ],
      },
    ],
  },
]

const moduleFilterOptions: Array<{ key: ModuleFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'access', label: 'Accesos' },
  { key: 'reference', label: 'Base' },
  { key: 'taxonomy', label: 'Taxonomía' },
  { key: 'products', label: 'Productos' },
  { key: 'sales', label: 'Ventas' },
  { key: 'logistics', label: 'Logística' },
  { key: 'marketing', label: 'Notificaciones' },
  { key: 'maintenance', label: 'Mantenimiento' },
]

const activeModuleFilter = ref<ModuleFilter>('all')
const seedActionLoading = ref<string | null>(null)
const seedActionResult = ref<Record<string, unknown> | null>(null)
const seedActionError = ref('')
const executionHistory = ref<ExecutionEntry[]>(loadHistory())
const historyDetailEntry = ref<ExecutionEntry | null>(null)
const historyDetailOpen = ref(false)
const dryRunSelectedAction = ref<SeedModuleAction | null>(null)
const dryRunModalOpen = ref(false)
const pendingDestructiveAction = ref<SeedModuleAction | null>(null)
const pendingModuleId = ref<string | null>(null)
const confirmModalOpen = ref(false)
const confirmInput = ref('')

const filteredModules = computed(() =>
  activeModuleFilter.value === 'all'
    ? seedModules
    : seedModules.filter((module) => module.filterKey === activeModuleFilter.value),
)

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

const seedResultPanelClass = computed(() => {
  const mode = seedModeLabel.value
  if (mode === 'seed-run' || mode === 'seed-safe') return 'border-success-200 bg-success-50'
  if (mode === 'seed-force') return 'border-warning-200 bg-warning-50'
  if (mode === 'users-all' || mode === 'all') return 'border-danger-200 bg-danger-50'
  return 'border-surface-200 bg-surface-0'
})

const seedActionResultPretty = computed(() => {
  if (!seedActionResult.value) return ''
  return JSON.stringify(seedActionResult.value, null, 2)
})

const dryRunTitle = computed(() => dryRunSelectedAction.value?.label ?? '')
const isDryRunDestructive = computed(() =>
  dryRunSelectedAction.value ? destructiveActions.has(dryRunSelectedAction.value.action) : false,
)

function statusBadgeColor(status: ExecStatus) {
  if (status === 'success') return 'success'
  if (status === 'error') return 'danger'
  return 'neutral'
}

function statusLabel(status: ExecStatus) {
  if (status === 'success') return 'Éxito'
  if (status === 'error') return 'Error'
  return 'Ejecutando'
}

function riskBadgeColor(risk: DryRunEntity['risk']) {
  if (risk === 'high') return 'danger'
  if (risk === 'medium') return 'warning'
  return 'success'
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number | null) {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function addHistoryEntry(entry: ExecutionEntry) {
  executionHistory.value = [entry, ...executionHistory.value].slice(0, HISTORY_MAX)
  saveHistory(executionHistory.value)
}

function clearHistory() {
  executionHistory.value = []
  localStorage.removeItem(HISTORY_KEY)
}

function openHistoryDetail(entry: ExecutionEntry) {
  historyDetailEntry.value = entry
  historyDetailOpen.value = true
}

function closeConfirmModal() {
  confirmModalOpen.value = false
  confirmInput.value = ''
  pendingDestructiveAction.value = null
  pendingModuleId.value = null
}

function openDryRun(action: SeedModuleAction) {
  dryRunSelectedAction.value = action
  dryRunModalOpen.value = true
}

async function copyRoleCredentials(role: 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER') {
  const byRole = {
    SUPER_ADMIN: {
      emails: [localSeedConfig.superAdminEmail, 'superadmin2@local.dev'],
      password: localSeedConfig.superAdminPassword,
    },
    ADMIN: {
      emails: [localSeedConfig.adminEmail, 'admin2@local.dev', 'admin3@local.dev'],
      password: localSeedConfig.adminPassword,
    },
    CUSTOMER: {
      emails: ['customer1@local.dev', 'customer2@local.dev', 'customer3@local.dev'],
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

async function executeSeedAction(moduleId: string, selectedAction: SeedModuleAction, confirmationPhrase?: string) {
  if (!auth.isSuperAdmin) {
    toast.error('Permisos insuficientes', 'Solo SUPER_ADMIN puede ejecutar seeds')
    return
  }

  const entryId = crypto.randomUUID()
  const startedAt = Date.now()
  const timestamp = new Date().toISOString()

  addHistoryEntry({
    id: entryId,
    timestamp,
    action: selectedAction.action,
    actionLabel: selectedAction.label,
    moduleId,
    actorEmail: auth.user?.email ?? 'unknown',
    status: 'running',
    durationMs: null,
    result: null,
    error: null,
  })

  seedActionLoading.value = selectedAction.id
  seedActionResult.value = null
  seedActionError.value = ''

  try {
    let result: Record<string, unknown>

    if (selectedAction.action === 'run') {
      result = (await adminToolsService.runSeed(selectedAction.runTargets)) as Record<string, unknown>
    } else {
      const modeByAction: Record<Exclude<SeedAction, 'run'>, SeedCleanMode> = {
        'clean-seed': 'seed',
        'clean-seed-force': 'seed',
        'clean-users-all': 'users-all',
        'clean-all': 'all',
      }
      const force = selectedAction.action === 'clean-seed-force' || selectedAction.action === 'clean-all'
      result = (
        await adminToolsService.cleanSeed(
          modeByAction[selectedAction.action],
          force,
          confirmationPhrase,
          selectedAction.cleanTargets,
        )
      ) as Record<string, unknown>
    }

    const durationMs = Date.now() - startedAt
    executionHistory.value = executionHistory.value.map((entry) =>
      entry.id === entryId ? { ...entry, status: 'success', durationMs, result } : entry,
    )
    saveHistory(executionHistory.value)

    seedActionResult.value = result
    toast.success('Seed ejecutado', selectedAction.label)
    await auth.fetchMe()
  } catch (error) {
    const printable = extractErrorMessage(error, 'No se pudo ejecutar la acción de seed')
    const durationMs = Date.now() - startedAt
    executionHistory.value = executionHistory.value.map((entry) =>
      entry.id === entryId ? { ...entry, status: 'error', durationMs, error: printable } : entry,
    )
    saveHistory(executionHistory.value)

    seedActionError.value = printable
    toast.error('Error', printable)
  } finally {
    seedActionLoading.value = null
  }
}

function requestSeedAction(moduleId: string, selectedAction: SeedModuleAction) {
  if (destructiveActions.has(selectedAction.action)) {
    pendingDestructiveAction.value = selectedAction
    pendingModuleId.value = moduleId
    confirmInput.value = ''
    confirmModalOpen.value = true
    return
  }

  void executeSeedAction(moduleId, selectedAction)
}

async function confirmDestructiveSeedAction() {
  if (!pendingDestructiveAction.value || !pendingModuleId.value) return
  if (confirmInput.value.trim() !== confirmKeyword) return

  const action = pendingDestructiveAction.value
  const moduleId = pendingModuleId.value
  const confirmationPhrase = confirmInput.value.trim()
  closeConfirmModal()
  await executeSeedAction(moduleId, action, confirmationPhrase)
}

function proceedFromDryRun(moduleId: string, action: SeedModuleAction) {
  dryRunModalOpen.value = false
  requestSeedAction(moduleId, action)
}
</script>

<template>
  <div class="space-y-6">
    <UiCard title="Seed Manager Segmentado">
      <div class="space-y-3 text-sm px-6 py-4">
        <p class="text-surface-800">
          Los seeds ahora están separados por dominio: accesos, atributos base, monedas, categorías, tags y productos demo.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <UiBadge color="info" dot>Entorno: {{ runtimeMode }}</UiBadge>
          <UiBadge :color="auth.isSuperAdmin ? 'success' : 'danger'" dot>
            {{ auth.isSuperAdmin ? 'SUPER_ADMIN autorizado' : 'Solo lectura' }}
          </UiBadge>
          <UiBadge color="neutral">{{ executionHistory.length }} ejecuciones</UiBadge>
        </div>
      </div>
    </UiCard>

    <UiCard title="Filtrar dominios">
      <div class="flex flex-wrap gap-2 px-6 py-4">
        <button
          v-for="option in moduleFilterOptions"
          :key="option.key"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            activeModuleFilter === option.key
              ? 'bg-primary-600 text-white'
              : 'bg-surface-100 text-surface-700 hover:bg-surface-200',
          ]"
          @click="activeModuleFilter = option.key"
        >
          {{ option.label }}
        </button>
      </div>
    </UiCard>

    <UiCard
      v-for="module in filteredModules"
      :key="module.id"
      :title="module.title"
    >
      <div class="space-y-4 px-6 py-4">
        <p class="text-sm text-surface-700">{{ module.detail }}</p>

        <div class="flex flex-wrap gap-2">
          <UiBadge v-for="tag in module.impact" :key="tag" color="neutral">{{ tag }}</UiBadge>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="action in module.actions"
            :key="action.id"
            class="rounded-lg border border-surface-200 bg-surface-50 p-3 space-y-3"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-medium text-surface-900">{{ action.label }}</p>
              <UiBadge :color="destructiveActions.has(action.action) ? 'danger' : 'primary'" dot>
                {{ destructiveActions.has(action.action) ? 'Destructivo' : 'Seed parcial' }}
              </UiBadge>
            </div>

            <p class="text-xs text-muted">{{ action.description }}</p>

            <div class="flex gap-2">
              <UiButton
                size="sm"
                variant="ghost"
                class="flex-1"
                :disabled="!auth.isSuperAdmin"
                @click="openDryRun(action)"
              >
                Vista previa
              </UiButton>
              <UiButton
                size="sm"
                :variant="destructiveActions.has(action.action) ? 'danger' : 'primary'"
                :loading="seedActionLoading === action.id"
                :disabled="!auth.isSuperAdmin"
                class="flex-1"
                @click="requestSeedAction(module.id, action)"
              >
                Ejecutar
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard v-if="showLocalSeedConfig" title="Credenciales seed de desarrollo">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div class="md:col-span-2 rounded-lg border border-surface-200 p-3">
          <p class="text-caption mb-1">API base URL</p>
          <p class="font-mono text-xs text-surface-800">{{ localSeedConfig.apiBaseUrl }}</p>
        </div>

        <div class="rounded-lg border border-surface-200 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-caption">SUPER_ADMIN</p>
            <UiButton size="sm" variant="ghost" @click="copyRoleCredentials('SUPER_ADMIN')">Copiar</UiButton>
          </div>
          <p class="font-medium">{{ localSeedConfig.superAdminEmail }}</p>
          <p class="font-mono text-xs text-muted">{{ localSeedConfig.superAdminPassword }}</p>
        </div>

        <div class="rounded-lg border border-surface-200 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-caption">ADMIN</p>
            <UiButton size="sm" variant="ghost" @click="copyRoleCredentials('ADMIN')">Copiar</UiButton>
          </div>
          <p class="font-medium">{{ localSeedConfig.adminEmail }}</p>
          <p class="font-mono text-xs text-muted">{{ localSeedConfig.adminPassword }}</p>
        </div>

        <div class="rounded-lg border border-surface-200 p-3 space-y-2 md:col-span-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-caption">CUSTOMER</p>
            <UiButton size="sm" variant="ghost" @click="copyRoleCredentials('CUSTOMER')">Copiar</UiButton>
          </div>
          <p class="font-medium">customer1@local.dev, customer2@local.dev, customer3@local.dev</p>
          <p class="font-mono text-xs text-muted">{{ localSeedConfig.customerPassword }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard v-if="seedActionResult || seedActionError" title="Resultado y detalle">
      <div class="space-y-3">
        <div v-if="seedActionError" class="rounded-lg border border-danger-200 bg-danger-50 p-3 text-danger-800 text-sm">
          {{ seedActionError }}
        </div>

        <div v-if="seedActionResult" class="rounded-lg border p-4 space-y-3" :class="seedResultPanelClass">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-surface-900">Resultado del proceso</p>
            <UiBadge :color="seedModeBadgeColor" dot>{{ seedModeLabel }}</UiBadge>
          </div>

          <details>
            <summary class="text-xs text-surface-600 cursor-pointer">Ver JSON completo</summary>
            <pre class="mt-2 rounded-lg bg-surface-900 text-surface-0 p-3 text-xs whitespace-pre-wrap overflow-auto">{{ seedActionResultPretty }}</pre>
          </details>
        </div>
      </div>
    </UiCard>

    <UiCard title="Historial de ejecuciones">
      <div class="space-y-3 px-6 py-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-muted">
            {{ executionHistory.length === 0 ? 'Aún no hay ejecuciones registradas.' : `${executionHistory.length} ejecuciones registradas` }}
          </p>
          <UiButton v-if="executionHistory.length > 0" size="sm" variant="ghost" @click="clearHistory">
            Limpiar historial
          </UiButton>
        </div>

        <div v-if="executionHistory.length > 0" class="overflow-x-auto rounded-lg border border-surface-200">
          <table class="w-full text-sm">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase tracking-wide">Fecha/Hora</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase tracking-wide">Acción</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase tracking-wide">Actor</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase tracking-wide">Estado</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase tracking-wide">Duración</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="entry in executionHistory" :key="entry.id" class="hover:bg-surface-50 transition-colors">
                <td class="px-3 py-2 text-xs font-mono text-surface-700 whitespace-nowrap">{{ formatTimestamp(entry.timestamp) }}</td>
                <td class="px-3 py-2 text-xs text-surface-800 whitespace-nowrap">{{ entry.actionLabel }}</td>
                <td class="px-3 py-2 text-xs text-muted truncate max-w-35">{{ entry.actorEmail }}</td>
                <td class="px-3 py-2">
                  <UiBadge :color="statusBadgeColor(entry.status)" dot>{{ statusLabel(entry.status) }}</UiBadge>
                </td>
                <td class="px-3 py-2 text-xs text-muted whitespace-nowrap">{{ formatDuration(entry.durationMs) }}</td>
                <td class="px-3 py-2">
                  <UiButton size="sm" variant="ghost" @click="openHistoryDetail(entry)">Ver</UiButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UiCard>

    <UiModal :show="dryRunModalOpen" :title="`Vista previa: ${dryRunTitle}`" @close="dryRunModalOpen = false">
      <div v-if="dryRunSelectedAction" class="space-y-4 text-sm">
        <p class="text-surface-700">
          Esta acción afectará los siguientes datos. La vista previa es informativa y refleja el objetivo esperado del seed seleccionado.
        </p>

        <div class="rounded-lg border border-surface-200 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase">Tabla</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase">Operación</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase">Estimado</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-surface-600 uppercase">Riesgo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="(entity, index) in dryRunSelectedAction.dryRun" :key="index">
                <td class="px-3 py-2 font-mono text-xs text-surface-800">{{ entity.table }}</td>
                <td class="px-3 py-2">
                  <UiBadge :color="entity.operation === 'CREATE' || entity.operation === 'UPDATE' ? 'info' : 'danger'" dot>
                    {{ entity.operation }}
                  </UiBadge>
                </td>
                <td class="px-3 py-2 text-xs text-muted">{{ entity.estimatedCount }}</td>
                <td class="px-3 py-2">
                  <UiBadge :color="riskBadgeColor(entity.risk)">{{ entity.risk }}</UiBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-muted italic">
          Si el seed es parcial de productos, el backend resuelve automáticamente sus dependencias base.
        </p>
      </div>

      <template #footer>
        <FormModalActions
          cancel-label="Cancelar"
          :save-label="isDryRunDestructive ? 'Proceder con confirmación' : 'Ejecutar ahora'"
          cancel-variant="ghost"
          :save-variant="isDryRunDestructive ? 'danger' : 'primary'"
          :save-disabled="!auth.isSuperAdmin || !dryRunSelectedAction"
          @cancel="dryRunModalOpen = false"
          @save="dryRunSelectedAction ? proceedFromDryRun(seedModules.find((m) => m.actions.some((a) => a.id === dryRunSelectedAction?.id))?.id || '', dryRunSelectedAction) : undefined"
        />
      </template>
    </UiModal>

    <UiModal :show="historyDetailOpen" :title="`Detalle: ${historyDetailEntry?.actionLabel ?? ''}`" @close="historyDetailOpen = false">
      <div v-if="historyDetailEntry" class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg border border-surface-200 p-3 space-y-1">
            <p class="text-caption">Fecha/Hora</p>
            <p class="font-mono text-xs">{{ formatTimestamp(historyDetailEntry.timestamp) }}</p>
          </div>
          <div class="rounded-lg border border-surface-200 p-3 space-y-1">
            <p class="text-caption">Estado</p>
            <UiBadge :color="statusBadgeColor(historyDetailEntry.status)" dot>{{ statusLabel(historyDetailEntry.status) }}</UiBadge>
          </div>
          <div class="rounded-lg border border-surface-200 p-3 space-y-1">
            <p class="text-caption">Actor</p>
            <p class="text-xs truncate">{{ historyDetailEntry.actorEmail }}</p>
          </div>
          <div class="rounded-lg border border-surface-200 p-3 space-y-1">
            <p class="text-caption">Duración</p>
            <p class="font-mono text-xs">{{ formatDuration(historyDetailEntry.durationMs) }}</p>
          </div>
        </div>

        <div v-if="historyDetailEntry.error" class="rounded-lg border border-danger-200 bg-danger-50 p-3 text-danger-800 text-xs">
          {{ historyDetailEntry.error }}
        </div>

        <div v-if="historyDetailEntry.result">
          <p class="text-caption mb-1">Respuesta del servidor</p>
          <pre class="rounded-lg bg-surface-900 text-surface-0 p-3 text-xs whitespace-pre-wrap overflow-auto max-h-60">{{ JSON.stringify(historyDetailEntry.result, null, 2) }}</pre>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UiButton variant="ghost" @click="historyDetailOpen = false">Cerrar</UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal :show="confirmModalOpen" title="Confirmar acción destructiva" @close="closeConfirmModal">
      <div class="space-y-3 text-sm rounded-lg border border-danger-200 bg-danger-50 p-3">
        <p class="text-surface-800">
          Estás por ejecutar: <strong>{{ pendingDestructiveAction?.label ?? '' }}</strong>
        </p>
        <p class="text-muted">
          Para continuar, escribe <span class="font-mono">{{ confirmKeyword }}</span>.
        </p>
        <UiInput v-model="confirmInput" label="Confirmación" size="lg" :placeholder="confirmKeyword" />
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