<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { dashboardService } from '@/services/dashboard.service'
import { ordersService } from '@/services/orders.service'
import type {
  DashboardInventoryAlerts,
  DashboardSalesInsights,
  DashboardSummaryQuery,
  OrderStats,
  Order,
} from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import DashboardKpiCard from '@/components/shared/DashboardKpiCard.vue'
import DashboardKpiIcon from '@/components/shared/DashboardKpiIcon.vue'
import DashboardStatusCard from '@/components/shared/DashboardStatusCard.vue'
import {
  DASHBOARD_KPI_SPECS,
  DASHBOARD_PIPELINE_ORDER,
  DASHBOARD_STATUS_META,
  getDashboardStatusCount,
} from './dashboard.config'
import { normalizeApiList } from '@/utils/api-list'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const stats = ref<OrderStats | null>(null)
const sales = ref<DashboardSalesInsights | null>(null)
const inventoryAlerts = ref<DashboardInventoryAlerts | null>(null)
const recentOrders = ref<Order[]>([])
const loading = ref(true)
const salesLoading = ref(false)

type SalesPreset = '7d' | '30d' | 'month' | 'custom'

const salesPreset = ref<SalesPreset>('7d')
const salesMonth = ref(formatMonthInput(new Date()))
const salesFrom = ref(formatDateInput(addDays(new Date(), -6)))
const salesTo = ref(formatDateInput(new Date()))

const salesPresetOptions: Array<{ id: SalesPreset; label: string }> = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Por mes' },
  { id: 'custom', label: 'Rango' },
]

const customQuickRanges = [
  { days: 1, label: 'Hoy' },
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
]

function fmt(n: number | string) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
}

const kpis = computed(() => {
  if (!stats.value) return []

  return DASHBOARD_KPI_SPECS.map((spec) => {
    const rawValue = stats.value?.[spec.field]

    return {
      id: spec.id,
      title: spec.title,
      value: spec.currency ? fmt(rawValue ?? 0) : String(rawValue ?? 0),
      tone: spec.tone,
      icon: spec.icon,
    }
  })
})

const pipelineCards = computed(() => {
  if (!stats.value) return []
  const s = stats.value

  return DASHBOARD_PIPELINE_ORDER.map((status) => ({
    status,
    label: DASHBOARD_STATUS_META[status].label,
    badgeColor: DASHBOARD_STATUS_META[status].badgeColor,
    value: getDashboardStatusCount(s, status),
  }))
})

const salesMaxRevenue = computed(() => {
  if (!sales.value) return 1
  return Math.max(...sales.value.trend.points.map((point) => point.revenue), 1)
})

const weekDeltaTone = computed(() => {
  const delta = sales.value?.comparison.deltaPercent
  if (delta === null || delta === undefined) return 'neutral'
  return delta >= 0 ? 'success' : 'danger'
})

const weekDeltaLabel = computed(() => {
  const delta = sales.value?.comparison.deltaPercent
  if (delta === null || delta === undefined) return 'Sin periodo previo comparable'
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta}% vs periodo anterior`
})

const salesColumns = computed(() => {
  if (!sales.value) return []

  return sales.value.trend.points.map((point) => ({
    ...point,
    height: Math.max((point.revenue / salesMaxRevenue.value) * 100, 6),
  }))
})

const customRangeError = computed(() => {
  if (salesPreset.value !== 'custom') return ''
  if (!salesFrom.value || !salesTo.value) return 'Selecciona fecha desde y hasta'
  if (salesFrom.value > salesTo.value) return 'La fecha desde no puede ser mayor que hasta'
  return ''
})

const customRangeDays = computed(() => {
  if (!salesFrom.value || !salesTo.value || customRangeError.value) return null
  const from = new Date(salesFrom.value)
  const to = new Date(salesTo.value)
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1
})

const canApplyCustomRange = computed(() => salesPreset.value === 'custom' && !customRangeError.value)

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number) {
  const [yearRaw, monthRaw] = month.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const date = new Date(year, monthIndex + delta, 1)
  return formatMonthInput(date)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function buildSalesQuery(): DashboardSummaryQuery {
  if (salesPreset.value === 'custom') {
    return {
      salesPreset: 'custom',
      from: salesFrom.value,
      to: salesTo.value,
    }
  }

  if (salesPreset.value === 'month') {
    return {
      salesPreset: 'month',
      month: salesMonth.value,
    }
  }

  return { salesPreset: salesPreset.value }
}

async function loadSummary(params?: DashboardSummaryQuery) {
  const summary = await dashboardService.summary(params)
  stats.value = summary.orderStats
  sales.value = summary.sales
  inventoryAlerts.value = summary.inventoryAlerts
}

async function loadRecentOrders() {
  const orders = await ordersService.list({ limit: 5, page: 1 })
  recentOrders.value = normalizeApiList(orders).items.slice(0, 5)
}

async function refreshSales() {
  salesLoading.value = true
  try {
    await loadSummary(buildSalesQuery())
  } catch {
    toast.error('Error', 'No se pudo actualizar el rango de ventas')
  } finally {
    salesLoading.value = false
  }
}

function applyCustomSalesRange() {
  if (customRangeError.value) {
    toast.warning('Rango invalido', customRangeError.value)
    return
  }

  void refreshSales()
}

function applyQuickCustomRange(days: number) {
  const to = new Date()
  const from = addDays(to, -(days - 1))
  salesFrom.value = formatDateInput(from)
  salesTo.value = formatDateInput(to)
}

function isQuickRangeActive(days: number) {
  const to = formatDateInput(new Date())
  const from = formatDateInput(addDays(new Date(), -(days - 1)))
  return salesFrom.value === from && salesTo.value === to
}

function useCurrentMonth() {
  salesMonth.value = formatMonthInput(new Date())
}

function usePreviousMonth() {
  salesMonth.value = shiftMonth(formatMonthInput(new Date()), -1)
}

watch(salesPreset, (preset) => {
  if (preset !== 'custom') {
    void refreshSales()
  }
})

watch(salesMonth, () => {
  if (salesPreset.value === 'month') {
    void refreshSales()
  }
})

onMounted(async () => {
  try {
    await Promise.all([
      loadSummary(buildSalesQuery()),
      loadRecentOrders(),
    ])
  } catch {
    toast.error('Error', 'No se pudo cargar el dashboard')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6 px-3 sm:px-4 lg:px-6">

    <!-- KPI cards -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="card p-6 h-28 animate-pulse bg-[--color-surface-100]" />
    </div>

    <div v-else-if="stats" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <DashboardKpiCard
        v-for="kpi in kpis"
        :key="kpi.id"
        :title="kpi.title"
        :value="kpi.value"
        :tone="kpi.tone"
      >
        <template #icon>
          <DashboardKpiIcon :name="kpi.icon" />
        </template>
      </DashboardKpiCard>
    </div>

    <!-- Estado pipeline -->
    <div v-if="stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <DashboardStatusCard
        v-for="item in pipelineCards"
        :key="item.status"
        :label="item.label"
        :value="item.value"
        :badge-color="item.badgeColor"
      />
    </div>

    <UiCard v-if="sales" title="Ventas">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="min-w-0">
          <div class="mb-6 flex flex-col gap-4">
            <div class="flex flex-wrap items-center gap-3">
              <button
                v-for="option in salesPresetOptions"
                :key="option.id"
                type="button"
                class="rounded-full border px-4 py-2 text-xs font-semibold transition"
                :class="option.id === salesPreset
                  ? 'border-[--color-primary-600] bg-[--color-primary-600] text-white'
                  : 'border-[--color-surface-300] text-[--color-surface-700] hover:border-[--color-primary-400] hover:text-[--color-primary-700]'"
                @click="salesPreset = option.id"
              >
                {{ option.label }}
              </button>
            </div>

            <div v-if="salesPreset === 'month'" class="rounded-2xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 sm:p-5">
              <div class="mb-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="rounded-xl border border-[--color-surface-300] px-4 py-2 text-xs font-semibold text-[--color-surface-700] transition hover:border-[--color-primary-400] hover:text-[--color-primary-700]"
                  @click="useCurrentMonth"
                >
                  Este mes
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-[--color-surface-300] px-4 py-2 text-xs font-semibold text-[--color-surface-700] transition hover:border-[--color-primary-400] hover:text-[--color-primary-700]"
                  @click="usePreviousMonth"
                >
                  Mes anterior
                </button>
              </div>

              <div class="max-w-56">
                <label class="mb-3 block text-xs font-semibold uppercase tracking-[0.14em] text-[--color-surface-500]">Seleccionar mes</label>
                <input
                  v-model="salesMonth"
                  type="month"
                  class="input-base"
                >
              </div>
            </div>

            <div v-else-if="salesPreset === 'custom'" class="rounded-2xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 sm:p-5">
              <div class="mb-4 flex flex-wrap items-center gap-3">
                <button
                  v-for="range in customQuickRanges"
                  :key="range.label"
                  type="button"
                  class="rounded-xl border px-4 py-2 text-xs font-semibold transition"
                  :class="isQuickRangeActive(range.days)
                    ? 'border-[--color-primary-600] bg-[--color-primary-600] text-white'
                    : 'border-[--color-surface-300] text-[--color-surface-700] hover:border-[--color-primary-400] hover:text-[--color-primary-700]'"
                  @click="applyQuickCustomRange(range.days)"
                >
                  {{ range.label }}
                </button>
              </div>

              <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <div class="min-w-0">
                  <label class="mb-3 block text-xs font-semibold uppercase tracking-[0.14em] text-[--color-surface-500]">Desde</label>
                  <input
                    v-model="salesFrom"
                    type="date"
                    class="input-base min-w-0 max-w-full"
                  >
                </div>
                <div class="min-w-0">
                  <label class="mb-3 block text-xs font-semibold uppercase tracking-[0.14em] text-[--color-surface-500]">Hasta</label>
                  <input
                    v-model="salesTo"
                    type="date"
                    class="input-base min-w-0 max-w-full"
                  >
                </div>
              </div>

              <p v-if="customRangeError" class="mt-3 text-sm text-[--color-danger-600]">
                {{ customRangeError }}
              </p>
              <p v-else-if="customRangeDays" class="mt-3 text-sm text-[--color-surface-600]">
                Rango seleccionado: {{ customRangeDays }} dias
              </p>

              <div class="mt-4 flex justify-end">
                <button
                  type="button"
                  class="w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition sm:w-auto"
                  :class="canApplyCustomRange
                    ? 'bg-[--color-primary-600] hover:bg-[--color-primary-700]'
                    : 'cursor-not-allowed bg-[--color-surface-400]'"
                  :disabled="!canApplyCustomRange"
                  @click="applyCustomSalesRange"
                >
                  Aplicar rango
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">
                {{ sales.period.label }}
              </p>
              <UiBadge :color="weekDeltaTone" dot>
                {{ weekDeltaLabel }}
              </UiBadge>
            </div>
          </div>

          <div class="mb-6 flex items-center justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Revenue del periodo</p>
              <p class="text-2xl font-semibold text-[--color-surface-950]">{{ fmt(sales.trend.totalRevenue) }}</p>
            </div>
            <p v-if="salesLoading" class="text-xs font-semibold text-[--color-surface-500]">Actualizando...</p>
          </div>

          <div class="rounded-2xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 sm:p-5">
            <div class="overflow-x-auto">
              <div class="flex h-44 min-w-max items-end gap-4">
                <div v-for="point in salesColumns" :key="point.date" class="flex w-10 flex-col items-center gap-3">
                  <div class="w-full rounded-t-md bg-[--color-primary-500] transition-all" :style="{ height: `${point.height}%` }" />
                  <div class="text-[11px] font-semibold text-[--color-surface-500]">{{ point.label }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="min-w-0 rounded-2xl border border-[--color-surface-200] bg-[--color-surface-50] px-4 py-6 sm:px-5 lg:px-6">
          <div class="space-y-4">
            <div class="rounded-2xl border border-[--color-surface-200] bg-white px-6 py-5" data-test="sales-card-current">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Periodo actual</p>
              <p class="mt-4 text-xl font-semibold text-[--color-surface-950]">{{ fmt(sales.comparison.currentRevenue) }}</p>
            </div>
            <div class="rounded-2xl border border-[--color-surface-200] bg-white px-6 py-5" data-test="sales-card-previous">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Periodo anterior</p>
              <p class="mt-4 text-xl font-semibold text-[--color-surface-950]">{{ fmt(sales.comparison.previousRevenue) }}</p>
            </div>
            <div class="rounded-2xl border border-[--color-surface-200] bg-white px-6 py-5" data-test="sales-card-orders">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Ordenes del periodo</p>
              <p class="mt-4 text-xl font-semibold text-[--color-surface-950]">{{ sales.trend.totalOrders }}</p>
            </div>
          </div>
        </div>
      </div>
    </UiCard>

    <div v-if="inventoryAlerts" class="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
      <UiCard :title="`Alertas de inventario (umbral ${inventoryAlerts.threshold})`">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-[--color-warning-200] bg-[--color-warning-50] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-warning-700]">Stock bajo</p>
            <p class="mt-2 text-3xl font-semibold text-[--color-warning-900]">{{ inventoryAlerts.lowStockCount }}</p>
            <p class="mt-1 text-sm text-[--color-warning-800]">Variantes activas con pocas unidades disponibles</p>
          </div>

          <div class="rounded-2xl border border-[--color-danger-200] bg-[--color-danger-50] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-danger-700]">Sin stock</p>
            <p class="mt-2 text-3xl font-semibold text-[--color-danger-900]">{{ inventoryAlerts.outOfStockCount }}</p>
            <p class="mt-1 text-sm text-[--color-danger-800]">Variantes activas agotadas y listas para reposición</p>
          </div>
        </div>
      </UiCard>

      <UiCard title="Variantes críticas">
        <div v-if="!inventoryAlerts.lowStockVariants.length" class="text-muted text-center py-8">
          No hay variantes con stock crítico
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="variant in inventoryAlerts.lowStockVariants"
            :key="variant.id"
            class="flex items-start justify-between gap-4 rounded-2xl border border-[--color-surface-200] px-4 py-4"
          >
            <div>
              <p class="font-medium text-[--color-surface-950]">{{ variant.productName }}</p>
              <p class="text-sm text-[--color-surface-600]">{{ variant.sizeName }} / {{ variant.colorName }}</p>
              <p class="mt-1 font-mono text-xs text-[--color-surface-500]">{{ variant.sku }}</p>
            </div>
            <UiBadge :color="variant.stock === 0 ? 'danger' : 'warning'" dot>
              {{ variant.stock }} u.
            </UiBadge>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Órdenes recientes -->
    <UiCard title="Órdenes recientes">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="h-10 rounded-lg bg-[--color-surface-100] animate-pulse" />
      </div>
      <div v-else-if="!recentOrders.length" class="text-muted text-center py-8">
        Sin órdenes aún
      </div>
      <div v-else class="overflow-x-auto -mx-6 -mb-6">
        <table class="table-base">
          <thead>
            <tr>
              <th class="table-th">ID</th>
              <th class="table-th">Cliente</th>
              <th class="table-th">Estado</th>
              <th class="table-th text-right">Total</th>
              <th class="table-th">Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="o in recentOrders"
              :key="o.id"
              class="table-tr-hover cursor-pointer"
              @click="$router.push({ name: 'orders-detail', params: { id: o.id } })"
            >
              <td class="table-td font-mono text-xs text-[--color-surface-500]">
                #{{ o.id.slice(0, 8) }}
              </td>
              <td class="table-td">{{ o.user.email }}</td>
              <td class="table-td">
                <UiBadge :color="DASHBOARD_STATUS_META[o.status].badgeColor" dot>
                  {{ DASHBOARD_STATUS_META[o.status].label }}
                </UiBadge>
              </td>
              <td class="table-td text-right font-medium">{{ fmt(o.total) }}</td>
              <td class="table-td text-muted text-xs">
                {{ new Date(o.createdAt).toLocaleDateString('es-AR') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>
