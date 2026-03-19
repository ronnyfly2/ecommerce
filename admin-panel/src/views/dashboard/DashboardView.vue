<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { dashboardService } from '@/services/dashboard.service'
import { ordersService } from '@/services/orders.service'
import type { DashboardInventoryAlerts, DashboardSalesInsights, OrderStats, Order } from '@/types/api'
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
  return Math.max(...sales.value.trendLast7Days.points.map((point) => point.revenue), 1)
})

const weekDeltaTone = computed(() => {
  const delta = sales.value?.weekComparison.deltaPercent
  if (delta === null || delta === undefined) return 'neutral'
  return delta >= 0 ? 'success' : 'danger'
})

const weekDeltaLabel = computed(() => {
  const delta = sales.value?.weekComparison.deltaPercent
  if (delta === null || delta === undefined) return 'Sin semana previa comparable'
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta}% vs semana anterior`
})

onMounted(async () => {
  try {
    const [summary, orders] = await Promise.all([
      dashboardService.summary(),
      ordersService.list({ limit: 5, page: 1 }),
    ])
    stats.value = summary.orderStats
    sales.value = summary.sales
    inventoryAlerts.value = summary.inventoryAlerts
    recentOrders.value = normalizeApiList(orders).items.slice(0, 5)
  } catch {
    toast.error('Error', 'No se pudo cargar el dashboard')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-5">

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
    <div v-if="stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <DashboardStatusCard
        v-for="item in pipelineCards"
        :key="item.status"
        :label="item.label"
        :value="item.value"
        :badge-color="item.badgeColor"
      />
    </div>

    <UiCard v-if="sales" title="Ventas (ultimos 7 dias)">
      <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div>
          <div class="mb-3 flex items-center justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Revenue semanal</p>
              <p class="text-2xl font-semibold text-[--color-surface-950]">{{ fmt(sales.trendLast7Days.totalRevenue) }}</p>
            </div>
            <UiBadge :color="weekDeltaTone" dot>
              {{ weekDeltaLabel }}
            </UiBadge>
          </div>

          <div class="grid grid-cols-7 gap-2 h-40 items-end">
            <div v-for="point in sales.trendLast7Days.points" :key="point.date" class="flex flex-col items-center gap-2">
              <div class="w-full rounded-t-md bg-[--color-primary-500]" :style="{ height: `${Math.max((point.revenue / salesMaxRevenue) * 100, 4)}%` }" />
              <div class="text-[11px] uppercase tracking-wide text-[--color-surface-500]">{{ point.label }}</div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="rounded-2xl border border-[--color-surface-200] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Esta semana</p>
            <p class="mt-1 text-xl font-semibold text-[--color-surface-950]">{{ fmt(sales.weekComparison.currentWeekRevenue) }}</p>
          </div>
          <div class="rounded-2xl border border-[--color-surface-200] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Semana anterior</p>
            <p class="mt-1 text-xl font-semibold text-[--color-surface-950]">{{ fmt(sales.weekComparison.previousWeekRevenue) }}</p>
          </div>
          <div class="rounded-2xl border border-[--color-surface-200] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-surface-500]">Ordenes 7 dias</p>
            <p class="mt-1 text-xl font-semibold text-[--color-surface-950]">{{ sales.trendLast7Days.totalOrders }}</p>
          </div>
        </div>
      </div>
    </UiCard>

    <div v-if="inventoryAlerts" class="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5">
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
        <div v-else class="space-y-3">
          <div
            v-for="variant in inventoryAlerts.lowStockVariants"
            :key="variant.id"
            class="flex items-start justify-between gap-4 rounded-2xl border border-[--color-surface-200] px-4 py-3"
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
      <div v-if="loading" class="space-y-3">
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
