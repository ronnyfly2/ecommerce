<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import PaymentReviewDrawer from './PaymentReviewDrawer.vue'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { paymentsService, type Payment, type PaymentStatus, type PaymentProviderType } from '@/services/payments.service'
import { formatMoney } from '@/utils/currency'
import { extractErrorMessage } from '@/utils/error'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const pg = usePagination(20)
const auth = useAuthStore()

const payments = ref<Payment[] | null>(null)
const selected = ref<Payment | null>(null)
const drawerOpen = ref(false)
const initialized = ref(false)

const filters = reactive<{ status: '' | PaymentStatus; provider: '' | PaymentProviderType }>({
  status: '',
  provider: '',
})

const canReview = computed(() => auth.can('payments.review'))

const statusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  AWAITING_REVIEW: 'Para revisar',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}

const statusColors: Record<PaymentStatus, 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'warning',
  AWAITING_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  REFUNDED: 'neutral',
  FAILED: 'danger',
  CANCELLED: 'neutral',
}

const providerLabels: Record<PaymentProviderType, string> = {
  MANUAL_TRANSFER: 'Transferencia',
  STRIPE: 'Stripe',
  CASH_ON_DELIVERY: 'Contra entrega',
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...(Object.keys(statusLabels) as PaymentStatus[]).map((s) => ({
    value: s,
    label: statusLabels[s],
  })),
]

const providerOptions = [
  { value: '', label: 'Todos los metodos' },
  ...(Object.keys(providerLabels) as PaymentProviderType[]).map((p) => ({
    value: p,
    label: providerLabels[p],
  })),
]

const tableColumns = [
  { key: 'id', label: 'Pago' },
  { key: 'order', label: 'Orden' },
  { key: 'customer', label: 'Cliente' },
  { key: 'provider', label: 'Metodo' },
  { key: 'amount', label: 'Monto', align: 'right' as const },
  { key: 'status', label: 'Estado' },
  { key: 'createdAt', label: 'Fecha' },
  { key: 'actions', actions: true },
]

const tableLoading = computed(() => payments.value === null)
const tableEmpty = computed(() => !tableLoading.value && payments.value!.length === 0)

async function load() {
  payments.value = null
  try {
    const data = await paymentsService.list({
      page: pg.page.value,
      limit: pg.limit.value,
      status: filters.status || undefined,
      provider: filters.provider || undefined,
    })
    if (Array.isArray(data)) {
      payments.value = data
      pg.total.value = data.length
    } else {
      payments.value = data.items
      pg.total.value = data.meta.total
    }
  } catch (error) {
    payments.value = []
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar los pagos'))
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.status) query.status = filters.status
  if (filters.provider) query.provider = filters.provider
  router.replace({ query })
}

function openDetail(payment: Payment) {
  selected.value = payment
  drawerOpen.value = true
}

function handleUpdated(updated: Payment) {
  const idx = payments.value?.findIndex((p) => p.id === updated.id)
  if (idx !== undefined && idx >= 0 && payments.value) {
    payments.value[idx] = updated
  }
  selected.value = updated
}

watch([pg.page, () => filters.status, () => filters.provider], async () => {
  if (!initialized.value) return
  syncQuery()
  await load()
})

onMounted(async () => {
  const page = Number(route.query.page ?? 1)
  pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  if (typeof route.query.status === 'string') {
    filters.status = route.query.status as PaymentStatus
  }
  if (typeof route.query.provider === 'string') {
    filters.provider = route.query.provider as PaymentProviderType
  }
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
          v-model="filters.provider"
          label="Metodo"
          size="sm"
          :options="providerOptions"
          class="min-w-48"
        />
      </template>
      <template #actions>
        <UiButton variant="ghost" size="sm" @click="router.push({ name: 'payment-methods' })">
          Configurar metodos
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable
        :data="payments ?? []"
        :loading="tableLoading"
        :empty="tableEmpty"
        :columns="tableColumns"
        loading-text="Cargando pagos..."
        empty-message="No hay pagos para mostrar"
      >
        <tr v-for="p in payments ?? []" :key="p.id" class="table-tr-hover">
          <td class="table-td font-mono text-xs text-surface-500">#{{ p.id.slice(0, 8) }}</td>
          <td class="table-td font-mono text-xs">
            <RouterLink
              :to="{ name: 'orders-detail', params: { id: p.order.id } }"
              class="text-primary-700 hover:underline"
            >
              #{{ p.order.id.slice(0, 8) }}
            </RouterLink>
          </td>
          <td class="table-td text-sm">{{ p.order?.user?.email ?? '—' }}</td>
          <td class="table-td text-sm">
            <div class="flex flex-col">
              <span>{{ providerLabels[p.provider] }}</span>
              <span v-if="p.method" class="text-xs text-muted">{{ p.method.label }}</span>
            </div>
          </td>
          <td class="table-td text-right font-medium">{{ formatMoney(p.amount, p.currencyCode) }}</td>
          <td class="table-td">
            <UiBadge :color="statusColors[p.status]" dot>{{ statusLabels[p.status] }}</UiBadge>
          </td>
          <td class="table-td text-muted text-xs">{{ new Date(p.createdAt).toLocaleString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <UiButton size="sm" variant="ghost" @click="openDetail(p)">
              {{ canReview && p.status === 'AWAITING_REVIEW' ? 'Revisar' : 'Ver' }}
            </UiButton>
          </td>
        </tr>
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

    <PaymentReviewDrawer
      v-if="drawerOpen && selected"
      :payment="selected"
      :can-review="canReview"
      @close="drawerOpen = false"
      @updated="handleUpdated"
    />
  </div>
</template>
