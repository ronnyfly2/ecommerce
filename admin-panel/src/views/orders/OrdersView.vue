<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ordersService } from '@/services/orders.service'
import type { Order } from '@/types/api'
import { OrderStatus } from '@/types/api'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { normalizeApiList } from '@/utils/api-list'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSortHeader from '@/components/ui/UiSortHeader.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const pg = usePagination(15)

const orders = ref<Order[]>([])
const loading = ref(false)
const filters = reactive<{ status: '' | OrderStatus }>({ status: '' })
const initialized = ref(false)
const sortBy = ref<'createdAt' | 'total'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.status) query.status = filters.status
  router.replace({ query })
}

const statusColor: Record<OrderStatus, 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'> = {
  [OrderStatus.PENDING]: 'warning',
  [OrderStatus.CONFIRMED]: 'info',
  [OrderStatus.SHIPPED]: 'primary',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
}

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendiente',
  [OrderStatus.CONFIRMED]: 'Confirmada',
  [OrderStatus.SHIPPED]: 'Enviada',
  [OrderStatus.DELIVERED]: 'Entregada',
  [OrderStatus.CANCELLED]: 'Cancelada',
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...Object.values(OrderStatus).map((status) => ({ value: status, label: statusLabel[status] })),
]

function fmt(n: string | number) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
}

async function load() {
  loading.value = true
  try {
    const data = await ordersService.list({
      page: pg.page.value,
      limit: pg.limit.value,
      status: filters.status || undefined,
    })
    const result = normalizeApiList(data)
    orders.value = result.items
    pg.total.value = result.total
  } catch {
    toast.error('Error', 'No se pudieron cargar las órdenes')
  } finally {
    loading.value = false
  }
}

const displayedOrders = computed(() => {
  const list = [...orders.value]
  return list.sort((a, b) => {
    const factor = sortDir.value === 'asc' ? 1 : -1

    if (sortBy.value === 'total') {
      return (Number(a.total) - Number(b.total)) * factor
    }

    const aTime = new Date(a.createdAt).getTime()
    const bTime = new Date(b.createdAt).getTime()
    return (aTime - bTime) * factor
  })
})

function toggleSort(column: 'createdAt' | 'total') {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortBy.value = column
  sortDir.value = 'desc'
}

watch([() => pg.page.value, () => filters.status], async () => {
  if (!initialized.value) return
  syncQuery()
  await load()
})

onMounted(async () => {
  const page = Number(route.query.page ?? 1)
  pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1

  const status = route.query.status
  if (typeof status === 'string' && Object.values(OrderStatus).includes(status as OrderStatus)) {
    filters.status = status as OrderStatus
  }

  initialized.value = true
  await load()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <UiSelect
        v-model="filters.status"
        :options="statusOptions"
        class="min-w-[220px]"
      />
    </div>

    <UiCard :padding="false">
      <UiTable :loading="loading" :empty="!loading && !orders.length" empty-message="No hay órdenes">
        <template #head>
          <tr>
            <th class="table-th">ID</th>
            <th class="table-th">Cliente</th>
            <th class="table-th">Estado</th>
            <th class="table-th text-right">
              <UiSortHeader
                label="Total"
                :active="sortBy === 'total'"
                :direction="sortDir"
                @toggle="toggleSort('total')"
              />
            </th>
            <th class="table-th">
              <UiSortHeader
                label="Fecha"
                :active="sortBy === 'createdAt'"
                :direction="sortDir"
                @toggle="toggleSort('createdAt')"
              />
            </th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="o in displayedOrders" :key="o.id" class="table-tr-hover">
          <td class="table-td font-mono text-xs text-[--color-surface-500]">#{{ o.id.slice(0, 8) }}</td>
          <td class="table-td">{{ o.user.email }}</td>
          <td class="table-td">
            <UiBadge :color="statusColor[o.status]" dot>{{ statusLabel[o.status] }}</UiBadge>
          </td>
          <td class="table-td text-right font-medium">{{ fmt(o.total) }}</td>
          <td class="table-td text-muted text-xs">{{ new Date(o.createdAt).toLocaleDateString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <UiButton size="sm" variant="ghost" @click="router.push({ name: 'orders-detail', params: { id: o.id } })">
              Ver detalle
            </UiButton>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="filters.status = ''">Limpiar filtros</UiButton>
        </template>
      </UiTable>

      <div class="p-4 border-t border-[--color-surface-200]">
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
