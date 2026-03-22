<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ordersService } from '@/services/orders.service'
import { currenciesService } from '@/services/currencies.service'
import type { Order } from '@/types/api'
import type { Currency } from '@/types/api'
import { OrderStatus } from '@/types/api'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { normalizeApiList } from '@/utils/api-list'
import { formatMoney } from '@/utils/currency'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSortHeader from '@/components/ui/UiSortHeader.vue'
import { getSystemCurrencyCode } from '@/utils/system-currency'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const pg = usePagination(15)

const orders = ref<Order[] | null>(null)
const currencies = ref<Currency[]>([])
const filters = reactive<{ status: '' | OrderStatus; currencyCode: string }>({ status: '', currencyCode: '' })
const initialized = ref(false)
const sortBy = ref<'createdAt' | 'total'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const tableLoading = computed(() => orders.value === null)
const statusFilter = toRef(filters, 'status')
const currencyCodeFilter = toRef(filters, 'currencyCode')

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.status) query.status = filters.status
  if (filters.currencyCode) query.currencyCode = filters.currencyCode
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

function fmt(n: string | number, currencyCode = getSystemCurrencyCode()) {
  return formatMoney(n, currencyCode)
}

async function load() {
  orders.value = null
  try {
    const data = await ordersService.list({
      page: pg.page.value,
      limit: pg.limit.value,
      status: filters.status || undefined,
      currencyCode: filters.currencyCode || undefined,
    })
    const result = normalizeApiList(data)
    orders.value = result.items
    pg.total.value = result.total
  } catch {
    orders.value = []
    toast.error('Error', 'No se pudieron cargar las órdenes')
  }
}

const displayedOrders = computed(() => {
  const list = [...(orders.value ?? [])]
  return list.sort((a, b) => {
    const factor = sortDir.value === 'asc' ? 1 : -1

    if (sortBy.value === 'total') {
      const aRate = Number(a.exchangeRateToUsd || 1)
      const bRate = Number(b.exchangeRateToUsd || 1)
      const aUsd = Number(a.total) / aRate
      const bUsd = Number(b.total) / bRate
      return (aUsd - bUsd) * factor
    }

    const aTime = new Date(a.createdAt).getTime()
    const bTime = new Date(b.createdAt).getTime()
    return (aTime - bTime) * factor
  })
})
const tableEmpty = computed(() => !tableLoading.value && displayedOrders.value.length === 0)

function toggleSort(column: 'createdAt' | 'total') {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortBy.value = column
  sortDir.value = 'desc'
}

watch([pg.page, statusFilter, currencyCodeFilter], async () => {
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

  if (typeof route.query.currencyCode === 'string') {
    filters.currencyCode = route.query.currencyCode
  }

  try {
    const list = await currenciesService.list()
    currencies.value = list.filter((item) => item.isActive)
  } catch {
    currencies.value = []
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
        class="min-w-55"
      />
      <UiSelect
        v-model="filters.currencyCode"
        :options="[
          { value: '', label: 'Todas las monedas' },
          ...currencies.map((currency) => ({
            value: currency.code,
            label: `${currency.code} (${currency.symbol})`,
          })),
        ]"
        class="min-w-55"
      />
    </div>

    <UiCard :padding="false">
      <UiTable :data="displayedOrders" :loading="tableLoading" :empty="tableEmpty" loading-color="primary" loading-text="Cargando órdenes..." empty-message="No hay órdenes">
        <template #head>
          <tr>
            <th class="table-th">ID</th>
            <th class="table-th">Cliente</th>
            <th class="table-th">Estado</th>
            <th class="table-th">Moneda</th>
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
          <td class="table-td text-muted text-xs">{{ o.currencyCode }}</td>
          <td class="table-td text-right font-medium">{{ fmt(o.total, o.currencyCode) }}</td>
          <td class="table-td text-muted text-xs">{{ new Date(o.createdAt).toLocaleDateString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <UiButton size="sm" variant="ghost" @click="router.push({ name: 'orders-detail', params: { id: o.id } })">
              Ver detalle
            </UiButton>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="filters.status = ''; filters.currencyCode = ''">Limpiar filtros</UiButton>
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
