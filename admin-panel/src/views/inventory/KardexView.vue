<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { inventoryService } from '@/services/inventory.service'
import { productsService } from '@/services/products.service'
import { InventoryChannel, InventoryMovementType } from '@/types/api'
import type { KardexResult, Product, Store } from '@/types/api'
import { normalizeApiList } from '@/utils/api-list'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'

const toast = useToast()
const pg = usePagination(20)
const route = useRoute()
const router = useRouter()

// ── State ──────────────────────────────────────────────────
const result = ref<KardexResult | null>(null)
const products = ref<Product[]>([])
const stores = ref<Store[]>([])
const loading = ref(false)
const initialized = ref(false)
const exporting = ref(false)

const filters = reactive({
  productId: '',
  channelType: '' as InventoryChannel | '',
  storeId: '',
  startDate: '',
  endDate: '',
})

// ── Computed helpers ────────────────────────────────────────
const tableEmpty = computed(() => !loading.value && (result.value?.items.length ?? 0) === 0)
const selectedProduct = computed(() => products.value.find((p) => p.id === filters.productId) ?? null)

const tableColumns = [
  { key: 'n', label: '#', align: 'right' as const },
  { key: 'date', label: 'Fecha' },
  { key: 'type', label: 'Tipo' },
  { key: 'channel', label: 'Canal' },
  { key: 'store', label: 'Tienda' },
  { key: 'variant', label: 'Variante' },
  { key: 'entrada', label: 'Entrada', align: 'right' as const },
  { key: 'salida', label: 'Salida', align: 'right' as const },
  { key: 'balance', label: 'Saldo', align: 'right' as const },
  { key: 'reason', label: 'Motivo' },
  { key: 'user', label: 'Usuario' },
]

const productOptions = computed(() => [
  { value: '', label: 'Seleccionar producto...' },
  ...products.value.map((p) => ({ value: p.id, label: `${p.name} · ${p.sku}` })),
])

const channelOptions = [
  { value: '', label: 'Todos los canales' },
  { value: InventoryChannel.DELIVERY, label: 'Delivery / Online' },
  { value: InventoryChannel.PICKUP, label: 'Retiro en tienda' },
]

const storeOptions = computed(() => [
  { value: '', label: 'Todas las tiendas' },
  ...stores.value.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
])

// ── Helpers ─────────────────────────────────────────────────
function typeLabel(type: InventoryMovementType) {
  const map: Record<InventoryMovementType, string> = {
    [InventoryMovementType.PURCHASE]: 'Compra',
    [InventoryMovementType.SALE]: 'Venta',
    [InventoryMovementType.ADJUSTMENT]: 'Ajuste',
    [InventoryMovementType.RETURN]: 'Devolución',
  }
  return map[type] ?? type
}

function typeBadgeVariant(type: InventoryMovementType): 'success' | 'danger' | 'info' | 'warning' {
  if (type === InventoryMovementType.PURCHASE) return 'success'
  if (type === InventoryMovementType.SALE) return 'danger'
  if (type === InventoryMovementType.RETURN) return 'info'
  return 'warning'
}

function channelLabel(channel: InventoryChannel | null) {
  if (channel === InventoryChannel.DELIVERY) return 'Delivery'
  if (channel === InventoryChannel.PICKUP) return 'Tienda'
  return '—'
}

function rowN(index: number) {
  return (pg.page.value - 1) * pg.limit.value + index + 1
}

// ── Row balance color ───────────────────────────────────────
function balanceClass(balance: number) {
  if (balance < 0) return 'text-danger-600 font-semibold'
  if (balance === 0) return 'text-surface-500'
  return 'text-surface-900 font-semibold'
}

// ── Data loading ────────────────────────────────────────────
async function loadProducts() {
  const data = await productsService.list({ page: 1, limit: 200 })
  products.value = normalizeApiList(data).items
}

async function loadStores() {
  stores.value = await inventoryService.stores()
}

async function loadKardex() {
  if (!filters.productId) {
    result.value = null
    return
  }

  loading.value = true
  result.value = null
  try {
    const data = await inventoryService.kardex({
      productId: filters.productId,
      channelType: filters.channelType || undefined,
      storeId: filters.storeId || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page: pg.page.value,
      limit: pg.limit.value,
    })
    result.value = data
    pg.total.value = data.meta.total
  } catch {
    toast.error('Error', 'No se pudo cargar el kardex de inventario')
  } finally {
    loading.value = false
  }
}

// ── URL sync ────────────────────────────────────────────────
function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.productId) query.productId = filters.productId
  if (filters.channelType) query.channelType = filters.channelType
  if (filters.storeId) query.storeId = filters.storeId
  if (filters.startDate) query.startDate = filters.startDate
  if (filters.endDate) query.endDate = filters.endDate
  router.replace({ query })
}

// ── CSV Export ───────────────────────────────────────────────
async function exportCsv() {
  if (!filters.productId) return

  exporting.value = true
  try {
    // Fetch all pages for export (up to 1000 rows)
    const data = await inventoryService.kardex({
      productId: filters.productId,
      channelType: filters.channelType || undefined,
      storeId: filters.storeId || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page: 1,
      limit: 1000,
    })

    const headers = ['#', 'Fecha', 'Tipo', 'Canal', 'Tienda', 'Variante', 'Entrada', 'Salida', 'Saldo', 'Motivo', 'Usuario']
    const rows = data.items.map((entry, idx) => [
      idx + 1,
      new Date(entry.date).toLocaleString('es-PE'),
      typeLabel(entry.type),
      channelLabel(entry.channelType),
      entry.store?.name ?? '',
      entry.variant ? `${entry.variant.sku}` : '',
      entry.entrada,
      entry.salida,
      entry.balance,
      entry.reason ?? '',
      entry.createdBy?.email ?? '',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const productName = selectedProduct.value?.sku ?? 'producto'
    const date = new Date().toISOString().split('T')[0]
    link.download = `kardex_${productName}_${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Exportado', `Kardex de ${data.items.length} movimientos descargado`)
  } catch {
    toast.error('Error', 'No se pudo exportar el kardex')
  } finally {
    exporting.value = false
  }
}

// ── Watchers ────────────────────────────────────────────────
watch(() => filters.productId, () => {
  pg.page.value = 1
  filters.channelType = ''
  filters.storeId = ''
})

watch(
  [
    () => filters.productId,
    () => filters.channelType,
    () => filters.storeId,
    () => filters.startDate,
    () => filters.endDate,
    pg.page,
  ],
  async () => {
    if (!initialized.value) return
    syncQuery()
    await loadKardex()
  },
)

// ── Init ─────────────────────────────────────────────────────
onMounted(async () => {
  try {
    await Promise.all([loadProducts(), loadStores()])
    const page = Number(route.query.page ?? 1)
    pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    filters.productId = typeof route.query.productId === 'string' ? route.query.productId : ''
    filters.channelType = typeof route.query.channelType === 'string' ? (route.query.channelType as InventoryChannel) : ''
    filters.storeId = typeof route.query.storeId === 'string' ? route.query.storeId : ''
    filters.startDate = typeof route.query.startDate === 'string' ? route.query.startDate : ''
    filters.endDate = typeof route.query.endDate === 'string' ? route.query.endDate : ''
    initialized.value = true
    if (filters.productId) {
      await loadKardex()
    }
  } catch {
    toast.error('Error', 'No se pudo inicializar el kardex')
  }
})
</script>

<template>
  <div class="space-y-4">

    <!-- Filtros -->
    <ListViewToolbar>
      <template #filters>
        <div class="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <UiSelect
            v-model="filters.productId"
            searchable
            size="sm"
            search-placeholder="Buscar producto..."
            :options="productOptions"
            class="xl:col-span-2"
          />
          <UiSelect
            v-model="filters.channelType"
            size="sm"
            :options="channelOptions"
          />
          <UiSelect
            v-model="filters.storeId"
            size="sm"
            :options="storeOptions"
            :disabled="filters.channelType !== InventoryChannel.PICKUP"
          />
          <div class="flex gap-2 items-center">
            <UiInput
              v-model="filters.startDate"
              type="date"
              size="sm"
              class="flex-1"
              placeholder="Desde"
            />
            <span class="text-surface-400 text-xs">—</span>
            <UiInput
              v-model="filters.endDate"
              type="date"
              size="sm"
              class="flex-1"
              placeholder="Hasta"
            />
          </div>
        </div>
      </template>
      <template #actions>
        <UiButton
          variant="secondary"
          size="sm"
          :loading="exporting"
          :disabled="!filters.productId || !result?.items.length"
          @click="exportCsv"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar CSV
        </UiButton>
      </template>
    </ListViewToolbar>

    <!-- Resumen del producto seleccionado -->
    <div v-if="result?.product" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <UiCard padding class="p-4!">
        <p class="text-xs text-muted mb-1">Producto</p>
        <p class="font-semibold text-surface-900 truncate">{{ result.product.name }}</p>
        <p class="text-xs text-muted">{{ result.product.sku }}</p>
      </UiCard>
      <UiCard padding class="p-4!">
        <p class="text-xs text-muted mb-1">Stock actual</p>
        <p :class="['text-2xl font-bold', result.product.stock < 0 ? 'text-danger-600' : result.product.stock === 0 ? 'text-warning-600' : 'text-success-700']">
          {{ result.product.stock }}
        </p>
      </UiCard>
      <UiCard padding class="p-4!">
        <p class="text-xs text-muted mb-1">Total movimientos</p>
        <p class="text-2xl font-bold text-surface-900">{{ result.meta.total }}</p>
      </UiCard>
      <UiCard padding class="p-4!">
        <p class="text-xs text-muted mb-1">Saldo al inicio de página</p>
        <p :class="['text-2xl font-bold', result.meta.balanceBefore < 0 ? 'text-danger-600' : 'text-surface-900']">
          {{ result.meta.balanceBefore }}
        </p>
      </UiCard>
    </div>

    <!-- Estado inicial (sin producto seleccionado) -->
    <UiCard v-if="!filters.productId && !loading" :padding="false">
      <div class="flex flex-col items-center justify-center py-16 text-center px-6">
        <svg class="w-12 h-12 text-surface-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p class="text-surface-500 text-sm">Selecciona un producto para ver su kardex de inventario</p>
      </div>
    </UiCard>

    <!-- Tabla kardex -->
    <UiCard v-else :padding="false">
      <UiTable
        :data="loading ? null : (result?.items ?? [])"
        :loading="loading"
        :empty="tableEmpty"
        :columns="tableColumns"
        loading-color="primary"
        loading-text="Calculando saldo acumulado..."
        empty-message="Sin movimientos para los filtros seleccionados"
      >
        <template #empty-icon>
          <svg class="w-12 h-12 text-primary-800 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </template>

        <tr
          v-for="(entry, idx) in result?.items ?? []"
          :key="entry.id"
          class="table-tr-hover"
        >
          <!-- # -->
          <td class="table-td text-right text-xs text-muted w-10">{{ rowN(idx) }}</td>

          <!-- Fecha -->
          <td class="table-td text-xs text-muted whitespace-nowrap">
            {{ new Date(entry.date).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) }}
          </td>

          <!-- Tipo -->
          <td class="table-td">
            <UiBadge :variant="typeBadgeVariant(entry.type)" size="sm">
              {{ typeLabel(entry.type) }}
            </UiBadge>
          </td>

          <!-- Canal -->
          <td class="table-td text-xs text-muted">{{ channelLabel(entry.channelType) }}</td>

          <!-- Tienda -->
          <td class="table-td text-xs text-muted">{{ entry.store?.code ?? '—' }}</td>

          <!-- Variante -->
          <td class="table-td text-xs text-muted">
            <template v-if="entry.variant">
              <span class="font-mono">{{ entry.variant.sku }}</span>
              <span v-if="entry.variant.size || entry.variant.color" class="ml-1 text-surface-400">
                · {{ [entry.variant.size?.name, entry.variant.color?.name].filter(Boolean).join('/') }}
              </span>
            </template>
            <span v-else class="text-surface-300">—</span>
          </td>

          <!-- Entrada -->
          <td class="table-td text-right">
            <span v-if="entry.entrada > 0" class="text-success-700 font-semibold">
              +{{ entry.entrada }}
            </span>
            <span v-else class="text-surface-300">—</span>
          </td>

          <!-- Salida -->
          <td class="table-td text-right">
            <span v-if="entry.salida > 0" class="text-danger-600 font-semibold">
              −{{ entry.salida }}
            </span>
            <span v-else class="text-surface-300">—</span>
          </td>

          <!-- Saldo -->
          <td class="table-td text-right">
            <span :class="balanceClass(entry.balance)">{{ entry.balance }}</span>
          </td>

          <!-- Motivo -->
          <td class="table-td text-xs text-muted max-w-40 truncate" :title="entry.reason ?? ''">
            {{ entry.reason || '—' }}
          </td>

          <!-- Usuario -->
          <td class="table-td text-xs text-muted">{{ entry.createdBy?.email ?? '—' }}</td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" variant="secondary" @click="loadKardex">Reintentar</UiButton>
        </template>
      </UiTable>

      <div class="p-4 border-t border-surface-200">
        <UiPagination
          :page="pg.page.value"
          :total-pages="pg.totalPages.value"
          :total="pg.total.value"
          @change="pg.goTo"
        />
      </div>
    </UiCard>

  </div>
</template>
