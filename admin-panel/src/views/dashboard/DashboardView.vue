<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { ordersService } from '@/services/orders.service'
import type { OrderStats, Order } from '@/types/api'
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

onMounted(async () => {
  try {
    const [s, orders] = await Promise.all([
      ordersService.stats(),
      ordersService.list({ limit: 5, page: 1 }),
    ])
    stats.value = s
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
