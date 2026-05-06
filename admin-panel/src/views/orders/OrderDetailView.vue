<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ordersService } from '@/services/orders.service'
import {
  shipmentsService,
  carriersService,
  type Carrier,
  type Shipment,
  type ShipmentStatus,
} from '@/services/shipments.service'
import {
  paymentsService,
  type Payment,
  type PaymentStatus,
  type PaymentProviderType,
} from '@/services/payments.service'
import type { Order } from '@/types/api'
import { OrderStatus } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import ShipmentDetailDrawer from '@/views/shipments/ShipmentDetailDrawer.vue'
import OrderShipmentCreateModal from '@/views/shipments/OrderShipmentCreateModal.vue'
import OrderPaymentCreateModal from '@/views/payments/OrderPaymentCreateModal.vue'
import PaymentReviewDrawer from '@/views/payments/PaymentReviewDrawer.vue'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'
import { formatMoney } from '@/utils/currency'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const order = ref<Order | null>(null)
const loading = ref(true)
const updating = ref(false)
const selectedStatus = ref<OrderStatus | ''>('')
const canManageOrders = computed(() => auth.can('orders.manage'))
const canManageShipments = computed(() => auth.can('shipments.manage'))
const canCreateShipments = computed(() => auth.can('shipments.create'))
const canCreatePayments = computed(() => auth.can('payments.create'))
const canReviewPayments = computed(() => auth.can('payments.review'))

const shipments = ref<Shipment[]>([])
const shipmentsLoading = ref(false)
const carriers = ref<Carrier[]>([])
const createOpen = ref(false)
const detailShipmentId = ref<string | null>(null)

const payments = ref<Payment[]>([])
const paymentsLoading = ref(false)
const createPaymentOpen = ref(false)
const selectedPayment = ref<Payment | null>(null)

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

const statusOptions = Object.values(OrderStatus).map((status) => ({
  value: status,
  label: statusLabel[status],
}))

const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  PENDING: 'Pendiente',
  READY_TO_SHIP: 'Listo para envio',
  IN_TRANSIT: 'En transito',
  OUT_FOR_DELIVERY: 'En reparto',
  DELIVERED: 'Entregado',
  FAILED: 'Fallido',
  RETURNED: 'Devuelto',
  CANCELLED: 'Cancelado',
}

const shipmentStatusColors: Record<ShipmentStatus, 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'warning',
  READY_TO_SHIP: 'info',
  IN_TRANSIT: 'primary',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success',
  FAILED: 'danger',
  RETURNED: 'neutral',
  CANCELLED: 'neutral',
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  AWAITING_REVIEW: 'Para revisar',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}

const paymentStatusColors: Record<PaymentStatus, 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'> = {
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

const isDelivery = computed(() => order.value?.fulfillmentType !== 'pickup')

const pendingItemsCount = computed(() => {
  if (!order.value) return 0
  const shippedByItem = new Map<string, number>()
  for (const shipment of shipments.value) {
    if (shipment.status === 'CANCELLED') continue
    for (const sItem of shipment.items ?? []) {
      const id = sItem.orderItem?.id
      if (!id) continue
      shippedByItem.set(id, (shippedByItem.get(id) ?? 0) + Number(sItem.quantity))
    }
  }
  return order.value.items.reduce((acc, item) => {
    const shipped = shippedByItem.get(item.id) ?? 0
    return acc + Math.max(0, item.quantity - shipped)
  }, 0)
})

const canOpenCreate = computed(
  () => canCreateShipments.value && isDelivery.value && pendingItemsCount.value > 0,
)

const approvedPayment = computed(() => payments.value.find((p) => p.status === 'APPROVED') ?? null)
const openPayment = computed(
  () => payments.value.find((p) => ['PENDING', 'AWAITING_REVIEW'].includes(p.status)) ?? null,
)

const paymentSummary = computed<{
  label: string
  color: 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'
} | null>(() => {
  if (paymentsLoading.value) return null
  if (approvedPayment.value) return { label: 'Pagado', color: 'success' }
  if (openPayment.value) {
    return {
      label: paymentStatusLabels[openPayment.value.status],
      color: paymentStatusColors[openPayment.value.status],
    }
  }
  if (payments.value.length === 0) return { label: 'Sin pago', color: 'warning' }
  const last = payments.value[payments.value.length - 1]
  return { label: paymentStatusLabels[last.status], color: paymentStatusColors[last.status] }
})

const canOpenCreatePayment = computed(
  () => canCreatePayments.value && !approvedPayment.value,
)

function fmt(n: string | number, currencyCode = order.value?.currencyCode || getSystemCurrencyCode()) {
  return formatMoney(n, currencyCode)
}

function orderItemName(item: Order['items'][number]) {
  return item.product?.name ?? item.variant?.product?.name ?? item.snapshotProductName ?? 'Producto'
}

function orderItemSku(item: Order['items'][number]) {
  return item.variant?.sku ?? item.product?.sku ?? item.snapshotSku ?? 'SIN-SKU'
}

function orderItemDescriptor(item: Order['items'][number]) {
  if (item.variant) {
    return `${item.variant.size.name} / ${item.variant.color.name}`
  }
  return item.snapshotDescriptor ?? 'Producto directo'
}

async function loadShipments() {
  if (!order.value) return
  shipmentsLoading.value = true
  try {
    shipments.value = await shipmentsService.byOrder(order.value.id)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar los envios'))
    shipments.value = []
  } finally {
    shipmentsLoading.value = false
  }
}

async function loadPayments() {
  if (!order.value) return
  paymentsLoading.value = true
  try {
    const data = await paymentsService.list({ orderId: order.value.id, limit: 100 })
    payments.value = data.items
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar los pagos'))
    payments.value = []
  } finally {
    paymentsLoading.value = false
  }
}

async function loadCarriers() {
  try {
    carriers.value = await carriersService.list()
  } catch {
    carriers.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const data = await ordersService.get(String(route.params.id))
    order.value = data
    selectedStatus.value = data.status
    await Promise.all([
      loadShipments(),
      loadPayments(),
      carriers.value.length ? Promise.resolve() : loadCarriers(),
    ])
  } catch {
    toast.error('Error', 'No se pudo cargar la orden')
    router.push({ name: 'orders' })
  } finally {
    loading.value = false
  }
}

async function updateStatus() {
  if (!order.value || !selectedStatus.value || selectedStatus.value === order.value.status) return

  updating.value = true
  try {
    order.value = await ordersService.updateStatus(order.value.id, { status: selectedStatus.value })
    toast.success('Estado actualizado', `La orden quedó en "${statusLabel[selectedStatus.value]}"`)
  } catch {
    toast.error('Error', 'No se pudo actualizar el estado')
  } finally {
    updating.value = false
  }
}

function handleShipmentCreated(shipment: Shipment) {
  shipments.value = [...shipments.value, shipment]
  createOpen.value = false
  detailShipmentId.value = shipment.id
}

function handleShipmentUpdated(updated: Shipment) {
  const idx = shipments.value.findIndex((s) => s.id === updated.id)
  if (idx >= 0) shipments.value[idx] = updated
}

function handlePaymentCreated(payment: Payment) {
  payments.value = [...payments.value, payment]
  createPaymentOpen.value = false
  if (canReviewPayments.value && payment.status === 'AWAITING_REVIEW') {
    selectedPayment.value = payment
  }
}

function handlePaymentUpdated(updated: Payment) {
  const idx = payments.value.findIndex((p) => p.id === updated.id)
  if (idx >= 0) payments.value[idx] = updated
  selectedPayment.value = updated
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-16">
    <UiSpinner size="lg" />
  </div>

  <div v-else-if="order" class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-heading-2">Orden #{{ order.id.slice(0, 8) }}</h2>
        <p class="text-muted">{{ new Date(order.createdAt).toLocaleString('es-AR') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UiButton variant="secondary" @click="router.push({ name: 'orders' })">Volver</UiButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <UiCard class="lg:col-span-2" title="Items">
        <UiEmptyState v-if="!order.items.length" title="Sin ítems" compact />
        <div v-else class="space-y-3">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="p-4 rounded-lg border border-surface-200 bg-surface-50"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-surface-900">{{ orderItemName(item) }}</p>
                <p class="text-xs text-muted">SKU: {{ orderItemSku(item) }}</p>
                <p class="text-xs text-muted">{{ orderItemDescriptor(item) }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm">x{{ item.quantity }}</p>
                <p class="font-medium">{{ fmt(item.subtotal, order.currencyCode) }}</p>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <UiCard title="Resumen">
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-muted">Cliente</span>
            <span class="font-medium text-right">{{ order.user.email }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Estado</span>
            <UiBadge :color="statusColor[order.status]" dot>
              {{ statusLabel[order.status] }}
            </UiBadge>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Fulfillment</span>
            <span class="font-medium text-right">
              {{ order.fulfillmentType === 'pickup' ? `Retiro en tienda (${order.pickupStore?.code ?? 'N/A'})` : 'Delivery' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Pago</span>
            <UiBadge v-if="paymentSummary" :color="paymentSummary.color" dot>
              {{ paymentSummary.label }}
            </UiBadge>
            <UiSpinner v-else size="sm" />
          </div>
          <div class="divider my-2" />
          <div class="flex justify-between">
            <span class="text-muted">Subtotal</span>
            <span>{{ fmt(order.subtotal, order.currencyCode) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Descuento</span>
            <span>- {{ fmt(order.discount, order.currencyCode) }}</span>
          </div>
          <div class="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{{ fmt(order.total, order.currencyCode) }}</span>
          </div>
        </div>

        <div class="divider my-4" />

        <template v-if="canManageOrders">
          <UiSelect
            v-model="selectedStatus"
            label="Cambiar estado"
            size="lg"
            :options="statusOptions"
          />

          <UiButton class="w-full mt-3" :loading="updating" @click="updateStatus">
            Actualizar estado
          </UiButton>
        </template>
        <p v-else class="text-sm text-muted">Tu rol tiene acceso de lectura sobre la orden.</p>
      </UiCard>
    </div>

    <UiCard v-if="isDelivery">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-heading-3">Envios</h3>
          <UiBadge v-if="pendingItemsCount > 0" color="warning">
            {{ pendingItemsCount }} item{{ pendingItemsCount === 1 ? '' : 's' }} por despachar
          </UiBadge>
          <UiBadge v-else-if="shipments.length" color="success">Orden despachada</UiBadge>
        </div>
        <UiButton
          v-if="canOpenCreate"
          size="sm"
          @click="createOpen = true"
        >
          Crear envio
        </UiButton>
      </div>

      <div v-if="shipmentsLoading" class="py-8 flex justify-center">
        <UiSpinner />
      </div>

      <UiEmptyState
        v-else-if="!shipments.length"
        title="Sin envios"
        :description="canCreateShipments
          ? 'Crea el primer envio para comenzar a despachar esta orden.'
          : 'Esta orden aun no tiene envios registrados.'"
        compact
      />

      <ul v-else class="divide-y divide-surface-200 rounded-md border border-surface-200">
        <li
          v-for="s in shipments"
          :key="s.id"
          class="px-4 py-3 flex items-start justify-between gap-4"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-mono text-sm text-surface-700">#{{ s.id.slice(0, 8) }}</p>
              <UiBadge :color="shipmentStatusColors[s.status]" dot>
                {{ shipmentStatusLabels[s.status] }}
              </UiBadge>
              <span class="text-xs text-muted">
                · {{ s.carrier?.label ?? 'Envio manual' }}
              </span>
            </div>
            <div class="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Items: {{ (s.items ?? []).reduce((acc, i) => acc + Number(i.quantity), 0) }}
              </span>
              <span v-if="s.trackingNumber">
                Tracking:
                <a
                  v-if="s.trackingUrl"
                  :href="s.trackingUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-700 hover:underline font-mono"
                >
                  {{ s.trackingNumber }}
                </a>
                <span v-else class="font-mono">{{ s.trackingNumber }}</span>
              </span>
              <span v-if="s.estimatedDeliveryAt">
                Entrega est.: {{ new Date(s.estimatedDeliveryAt).toLocaleDateString('es-AR') }}
              </span>
              <span v-if="s.deliveredAt">
                Entregado: {{ new Date(s.deliveredAt).toLocaleString('es-AR') }}
              </span>
            </div>
          </div>
          <UiButton size="sm" variant="ghost" @click="detailShipmentId = s.id">
            {{ canManageShipments ? 'Gestionar' : 'Ver' }}
          </UiButton>
        </li>
      </ul>
    </UiCard>

    <UiCard>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-heading-3">Pagos</h3>
          <UiBadge v-if="approvedPayment" color="success">Cobrado</UiBadge>
          <UiBadge v-else-if="openPayment" :color="paymentStatusColors[openPayment.status]">
            {{ paymentStatusLabels[openPayment.status] }}
          </UiBadge>
          <UiBadge v-else-if="!paymentsLoading" color="warning">Sin pago</UiBadge>
        </div>
        <UiButton
          v-if="canOpenCreatePayment"
          size="sm"
          @click="createPaymentOpen = true"
        >
          Registrar pago
        </UiButton>
      </div>

      <div v-if="paymentsLoading" class="py-8 flex justify-center">
        <UiSpinner />
      </div>

      <UiEmptyState
        v-else-if="!payments.length"
        title="Sin pagos"
        :description="canCreatePayments
          ? 'Registra el primer pago para esta orden.'
          : 'Aun no se ha registrado ningun pago.'"
        compact
      />

      <ul v-else class="divide-y divide-surface-200 rounded-md border border-surface-200">
        <li
          v-for="p in payments"
          :key="p.id"
          class="px-4 py-3 flex items-start justify-between gap-4"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-mono text-sm text-surface-700">#{{ p.id.slice(0, 8) }}</p>
              <UiBadge :color="paymentStatusColors[p.status]" dot>
                {{ paymentStatusLabels[p.status] }}
              </UiBadge>
              <span class="text-xs text-muted">
                · {{ providerLabels[p.provider] }}
                <span v-if="p.method"> · {{ p.method.label }}</span>
              </span>
            </div>
            <div class="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
              <span class="font-medium text-surface-700">
                {{ formatMoney(p.amount, p.currencyCode) }}
              </span>
              <span v-if="p.receiptUrl">Comprobante adjunto</span>
              <span v-if="p.reviewedAt">
                Revisado: {{ new Date(p.reviewedAt).toLocaleString('es-AR') }}
              </span>
              <span>Creado: {{ new Date(p.createdAt).toLocaleString('es-AR') }}</span>
            </div>
            <p
              v-if="p.rejectionReason"
              class="text-xs text-danger-700 mt-1"
            >
              Rechazo: {{ p.rejectionReason }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <a
              v-if="p.checkoutUrl && p.status === 'PENDING'"
              :href="p.checkoutUrl"
              target="_blank"
              rel="noopener"
              class="text-xs text-primary-700 hover:underline"
            >
              Abrir checkout
            </a>
            <UiButton size="sm" variant="ghost" @click="selectedPayment = p">
              {{ canReviewPayments && p.status === 'AWAITING_REVIEW' ? 'Revisar' : 'Ver' }}
            </UiButton>
          </div>
        </li>
      </ul>
    </UiCard>

    <UiCard :title="order.fulfillmentType === 'pickup' ? 'Retiro en tienda' : 'Dirección de envío'">
      <div v-if="order.fulfillmentType === 'pickup'" class="text-sm text-surface-700">
        <p class="font-medium">{{ order.pickupStore?.name ?? 'Tienda no especificada' }}</p>
        <p class="text-muted">Código: {{ order.pickupStore?.code ?? '—' }}</p>
        <p v-if="order.pickupStore?.address">{{ order.pickupStore.address }}</p>
        <p>{{ order.pickupStore?.city ?? '—' }}, {{ order.pickupStore?.country ?? '—' }}</p>
      </div>
      <div v-else-if="order.shippingAddresses?.length" class="text-sm text-surface-700">
        <p class="font-medium">
          {{ order.shippingAddresses[0].firstName }} {{ order.shippingAddresses[0].lastName }}
        </p>
        <p>{{ order.shippingAddresses[0].street }}</p>
        <p>{{ order.shippingAddresses[0].city }}, {{ order.shippingAddresses[0].state }} {{ order.shippingAddresses[0].postalCode }}</p>
        <p>{{ order.shippingAddresses[0].country }}</p>
        <p v-if="order.shippingAddresses[0].phoneNumber">{{ order.shippingAddresses[0].phoneNumber }}</p>
      </div>
      <p v-else class="text-muted">Sin dirección cargada</p>
    </UiCard>

    <OrderShipmentCreateModal
      v-if="createOpen && order"
      :order="order"
      :carriers="carriers"
      :existing-shipments="shipments"
      @close="createOpen = false"
      @created="handleShipmentCreated"
    />

    <ShipmentDetailDrawer
      v-if="detailShipmentId"
      :shipment-id="detailShipmentId"
      :carriers="carriers"
      :can-manage="canManageShipments"
      @close="detailShipmentId = null"
      @updated="handleShipmentUpdated"
    />

    <OrderPaymentCreateModal
      v-if="createPaymentOpen && order"
      :order="order"
      :existing-payments="payments"
      @close="createPaymentOpen = false"
      @created="handlePaymentCreated"
    />

    <PaymentReviewDrawer
      v-if="selectedPayment"
      :payment="selectedPayment"
      :can-review="canReviewPayments"
      @close="selectedPayment = null"
      @updated="handlePaymentUpdated"
    />
  </div>
</template>
