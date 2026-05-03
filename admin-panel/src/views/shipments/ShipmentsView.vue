<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiInput from '@/components/ui/UiInput.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import ShipmentDetailDrawer from './ShipmentDetailDrawer.vue'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import {
  shipmentsService,
  carriersService,
  type Shipment,
  type ShipmentStatus,
  type Carrier,
} from '@/services/shipments.service'
import { extractErrorMessage } from '@/utils/error'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const pg = usePagination(20)
const auth = useAuthStore()

const shipments = ref<Shipment[] | null>(null)
const carriers = ref<Carrier[]>([])
const selectedId = ref<string | null>(null)
const drawerOpen = ref(false)
const initialized = ref(false)

const filters = reactive<{
  status: '' | ShipmentStatus
  carrierId: string
  trackingNumber: string
}>({
  status: '',
  carrierId: '',
  trackingNumber: '',
})

const canManage = computed(() => auth.can('shipments.manage'))

const statusLabels: Record<ShipmentStatus, string> = {
  PENDING: 'Pendiente',
  READY_TO_SHIP: 'Listo para envio',
  IN_TRANSIT: 'En transito',
  OUT_FOR_DELIVERY: 'En reparto',
  DELIVERED: 'Entregado',
  FAILED: 'Fallido',
  RETURNED: 'Devuelto',
  CANCELLED: 'Cancelado',
}

const statusColors: Record<
  ShipmentStatus,
  'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'
> = {
  PENDING: 'warning',
  READY_TO_SHIP: 'info',
  IN_TRANSIT: 'primary',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success',
  FAILED: 'danger',
  RETURNED: 'neutral',
  CANCELLED: 'neutral',
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...(Object.keys(statusLabels) as ShipmentStatus[]).map((s) => ({
    value: s,
    label: statusLabels[s],
  })),
]

const carrierOptions = computed(() => [
  { value: '', label: 'Todas las transportadoras' },
  ...carriers.value.map((c) => ({ value: c.id, label: c.label })),
])

const tableColumns = [
  { key: 'id', label: 'Envio' },
  { key: 'order', label: 'Orden' },
  { key: 'customer', label: 'Cliente' },
  { key: 'carrier', label: 'Transportadora' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'status', label: 'Estado' },
  { key: 'createdAt', label: 'Fecha' },
  { key: 'actions', actions: true },
]

const tableLoading = computed(() => shipments.value === null)
const tableEmpty = computed(() => !tableLoading.value && shipments.value!.length === 0)

async function loadCarriers() {
  try {
    carriers.value = await carriersService.list()
  } catch {
    carriers.value = []
  }
}

async function load() {
  shipments.value = null
  try {
    const data = await shipmentsService.list({
      page: pg.page.value,
      limit: pg.limit.value,
      status: filters.status || undefined,
      carrierId: filters.carrierId || undefined,
      trackingNumber: filters.trackingNumber.trim() || undefined,
    })
    shipments.value = data.items
    pg.total.value = data.meta.total
  } catch (error) {
    shipments.value = []
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar los envios'))
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.status) query.status = filters.status
  if (filters.carrierId) query.carrierId = filters.carrierId
  if (filters.trackingNumber) query.tracking = filters.trackingNumber
  router.replace({ query })
}

function openDetail(shipment: Shipment) {
  selectedId.value = shipment.id
  drawerOpen.value = true
}

function handleUpdated(updated: Shipment) {
  const idx = shipments.value?.findIndex((s) => s.id === updated.id)
  if (idx !== undefined && idx >= 0 && shipments.value) {
    shipments.value[idx] = updated
  }
}

watch(
  [pg.page, () => filters.status, () => filters.carrierId],
  async () => {
    if (!initialized.value) return
    syncQuery()
    await load()
  },
)

let trackingTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => filters.trackingNumber,
  () => {
    if (!initialized.value) return
    if (trackingTimer) clearTimeout(trackingTimer)
    trackingTimer = setTimeout(async () => {
      syncQuery()
      await load()
    }, 400)
  },
)

onMounted(async () => {
  const page = Number(route.query.page ?? 1)
  pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  if (typeof route.query.status === 'string') {
    filters.status = route.query.status as ShipmentStatus
  }
  if (typeof route.query.carrierId === 'string') {
    filters.carrierId = route.query.carrierId
  }
  if (typeof route.query.tracking === 'string') {
    filters.trackingNumber = route.query.tracking
  }
  await loadCarriers()
  initialized.value = true
  await load()
})
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <UiSelect
          v-model="filters.status"
          label="Estado"
          size="sm"
          :options="statusOptions"
          class="min-w-48"
        />
        <UiSelect
          v-model="filters.carrierId"
          label="Transportadora"
          size="sm"
          :options="carrierOptions"
          class="min-w-48"
        />
        <UiInput
          v-model="filters.trackingNumber"
          label="Tracking"
          size="sm"
          placeholder="Numero de guia"
          class="min-w-48"
        />
      </template>
      <template #actions>
        <UiButton
          v-if="canManage"
          variant="ghost"
          size="sm"
          @click="router.push({ name: 'carriers' })"
        >
          Configurar transportadoras
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable
        :data="shipments ?? []"
        :loading="tableLoading"
        :empty="tableEmpty"
        :columns="tableColumns"
        loading-text="Cargando envios..."
        empty-message="No hay envios para mostrar"
      >
        <template #empty-icon>
          <svg class="w-12 h-12 text-primary-800 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </template>

        <tr v-for="s in shipments ?? []" :key="s.id" class="table-tr-hover">
          <td class="table-td font-mono text-xs text-surface-500">#{{ s.id.slice(0, 8) }}</td>
          <td class="table-td font-mono text-xs">
            <RouterLink
              :to="{ name: 'orders-detail', params: { id: s.order.id } }"
              class="text-primary-700 hover:underline"
            >
              #{{ s.order.id.slice(0, 8) }}
            </RouterLink>
          </td>
          <td class="table-td text-sm">{{ s.order?.user?.email ?? '—' }}</td>
          <td class="table-td text-sm">
            <div class="flex flex-col">
              <span>{{ s.carrier?.label ?? 'Envio manual' }}</span>
              <span v-if="s.carrier?.code" class="text-xs text-muted font-mono">{{ s.carrier.code }}</span>
            </div>
          </td>
          <td class="table-td text-sm">
            <a
              v-if="s.trackingUrl"
              :href="s.trackingUrl"
              target="_blank"
              rel="noopener"
              class="text-primary-700 hover:underline font-mono text-xs"
            >
              {{ s.trackingNumber ?? '—' }}
            </a>
            <span v-else class="font-mono text-xs text-muted">
              {{ s.trackingNumber ?? '—' }}
            </span>
          </td>
          <td class="table-td">
            <UiBadge :color="statusColors[s.status]" dot>{{ statusLabels[s.status] }}</UiBadge>
          </td>
          <td class="table-td text-muted text-xs">{{ new Date(s.createdAt).toLocaleString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <UiButton size="sm" variant="ghost" @click="openDetail(s)">Ver</UiButton>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" variant="secondary" @click="filters.status = ''; filters.carrierId = ''; filters.trackingNumber = ''; pg.page.value = 1; load()">
            Limpiar filtros
          </UiButton>
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

    <ShipmentDetailDrawer
      v-if="drawerOpen && selectedId"
      :shipment-id="selectedId"
      :carriers="carriers"
      :can-manage="canManage"
      @close="drawerOpen = false"
      @updated="handleUpdated"
    />
  </div>
</template>
