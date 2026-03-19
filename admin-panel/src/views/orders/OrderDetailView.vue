<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ordersService } from '@/services/orders.service'
import type { Order } from '@/types/api'
import { OrderStatus } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const order = ref<Order | null>(null)
const loading = ref(true)
const updating = ref(false)
const selectedStatus = ref<OrderStatus | ''>('')

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

function fmt(n: string | number) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
}

async function load() {
  loading.value = true
  try {
    const data = await ordersService.get(String(route.params.id))
    order.value = data
    selectedStatus.value = data.status
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
        <div v-if="!order.items.length" class="text-muted text-center py-8">Sin ítems</div>
        <div v-else class="space-y-3">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="p-4 rounded-lg border border-[--color-surface-200] bg-[--color-surface-50]"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-[--color-surface-900]">{{ item.variant.product?.name ?? 'Producto' }}</p>
                <p class="text-xs text-muted">SKU: {{ item.variant.sku }}</p>
                <p class="text-xs text-muted">{{ item.variant.size.name }} / {{ item.variant.color.name }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm">x{{ item.quantity }}</p>
                <p class="font-medium">{{ fmt(item.subtotal) }}</p>
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
          <div class="divider my-2" />
          <div class="flex justify-between">
            <span class="text-muted">Subtotal</span>
            <span>{{ fmt(order.subtotal) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Descuento</span>
            <span>- {{ fmt(order.discount) }}</span>
          </div>
          <div class="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{{ fmt(order.total) }}</span>
          </div>
        </div>

        <div class="divider my-4" />

        <UiSelect
          v-model="selectedStatus"
          label="Cambiar estado"
          :options="statusOptions"
        />

        <UiButton class="w-full mt-3" :loading="updating" @click="updateStatus">
          Actualizar estado
        </UiButton>
      </UiCard>
    </div>

    <UiCard title="Dirección de envío">
      <div v-if="order.shippingAddresses?.length" class="text-sm text-[--color-surface-700]">
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
  </div>
</template>
