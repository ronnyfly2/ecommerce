<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import { useToast } from '@/composables/useToast'
import { useCarrierSuggestion } from '@/composables/useCarrierSuggestion'
import { extractErrorMessage } from '@/utils/error'
import {
  shipmentsService,
  type Carrier,
  type CreateShipmentDto,
  type Shipment,
} from '@/services/shipments.service'
import type { Order, OrderItem, ShippingAddress } from '@/types/api'

const props = defineProps<{
  order: Order
  carriers: Carrier[]
  existingShipments: Shipment[]
}>()
const emit = defineEmits<{ close: []; created: [shipment: Shipment] }>()

const toast = useToast()
const submitting = ref(false)

interface ItemRow {
  orderItem: OrderItem
  remaining: number
  selected: boolean
  quantity: number
}

const itemRows = ref<ItemRow[]>([])

const primaryAddress = computed<ShippingAddress | null>(
  () => props.order.shippingAddresses?.find((a) => a.isDefault) ?? props.order.shippingAddresses?.[0] ?? null,
)

const form = reactive({
  carrierId: '',
  trackingNumber: '',
  trackingUrl: '',
  shippingCost: '0',
  estimatedDeliveryAt: '',
  shipToName: '',
  shipToStreet: '',
  shipToCity: '',
  shipToState: '',
  shipToPostalCode: '',
  shipToCountry: '',
  shipToPhone: '',
  shipToLat: '',
  shipToLng: '',
  notes: '',
})

const carriersRef = computed(() => props.carriers)
const latRef = computed(() => form.shipToLat)
const lngRef = computed(() => form.shipToLng)
const { suggestion } = useCarrierSuggestion(carriersRef, latRef, lngRef)

const suggestionApplied = computed(
  () => suggestion.value != null && form.carrierId === suggestion.value.carrier.id,
)

const carrierOptions = computed(() => [
  { value: '', label: 'Envio manual (sin transportadora)' },
  ...props.carriers
    .filter((c) => c.isEnabled)
    .map((c) => ({ value: c.id, label: c.label })),
])

const hasShippableItems = computed(() => itemRows.value.some((row) => row.remaining > 0))

const selectedItemCount = computed(
  () => itemRows.value.filter((row) => row.selected && row.quantity > 0).length,
)

const canSubmit = computed(() => selectedItemCount.value > 0 && !submitting.value)

function buildItemRows() {
  const shippedByItem = new Map<string, number>()
  for (const shipment of props.existingShipments) {
    if (shipment.status === 'CANCELLED') continue
    for (const sItem of shipment.items ?? []) {
      const id = sItem.orderItem?.id
      if (!id) continue
      shippedByItem.set(id, (shippedByItem.get(id) ?? 0) + Number(sItem.quantity))
    }
  }

  itemRows.value = (props.order.items ?? []).map((orderItem) => {
    const shipped = shippedByItem.get(orderItem.id) ?? 0
    const remaining = Math.max(0, orderItem.quantity - shipped)
    return {
      orderItem,
      remaining,
      selected: remaining > 0,
      quantity: remaining,
    }
  })
}

function prefillAddress() {
  const a = primaryAddress.value
  if (!a) return
  form.shipToName = [a.firstName, a.lastName].filter(Boolean).join(' ').trim()
  form.shipToStreet = a.street ?? ''
  form.shipToCity = a.city ?? ''
  form.shipToState = a.state ?? ''
  form.shipToPostalCode = a.postalCode ?? ''
  form.shipToCountry = a.country ?? ''
  form.shipToPhone = a.phoneNumber ?? ''
  form.shipToLat = a.lat ?? ''
  form.shipToLng = a.lng ?? ''
}

function itemName(item: OrderItem) {
  return item.product?.name ?? item.variant?.product?.name ?? item.snapshotProductName ?? 'Producto'
}

function itemSku(item: OrderItem) {
  return item.variant?.sku ?? item.product?.sku ?? item.snapshotSku ?? '—'
}

function clampQuantity(row: ItemRow) {
  if (row.quantity < 1) row.quantity = 1
  if (row.quantity > row.remaining) row.quantity = row.remaining
}

async function submit() {
  if (!canSubmit.value) return

  const items = itemRows.value
    .filter((row) => row.selected && row.quantity > 0 && row.remaining > 0)
    .map((row) => ({ orderItemId: row.orderItem.id, quantity: row.quantity }))

  if (items.length === 0) {
    toast.error('Sin items', 'Selecciona al menos un item para despachar')
    return
  }

  const dto: CreateShipmentDto = {
    orderId: props.order.id,
    items,
    carrierId: form.carrierId || undefined,
    trackingNumber: form.trackingNumber.trim() || undefined,
    trackingUrl: form.trackingUrl.trim() || undefined,
    shippingCost: form.shippingCost.trim() || undefined,
    currencyCode: props.order.currencyCode,
    estimatedDeliveryAt: form.estimatedDeliveryAt || undefined,
    shipToName: form.shipToName.trim() || undefined,
    shipToStreet: form.shipToStreet.trim() || undefined,
    shipToCity: form.shipToCity.trim() || undefined,
    shipToState: form.shipToState.trim() || undefined,
    shipToPostalCode: form.shipToPostalCode.trim() || undefined,
    shipToCountry: form.shipToCountry.trim() || undefined,
    shipToPhone: form.shipToPhone.trim() || undefined,
    shipToLat: form.shipToLat ? Number(form.shipToLat) : undefined,
    shipToLng: form.shipToLng ? Number(form.shipToLng) : undefined,
    notes: form.notes.trim() || undefined,
  }

  submitting.value = true
  try {
    const created = await shipmentsService.create(dto)
    toast.success('Envio creado', `Se generó el envio #${created.id.slice(0, 8)}`)
    emit('created', created)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo crear el envio'))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  buildItemRows()
  prefillAddress()
})
</script>

<template>
  <UiModal :show="true" size="xl" title="Crear envio" @close="emit('close')">
    <div class="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
      <!-- Items selection -->
      <section>
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium text-surface-800">Items a despachar</p>
          <p class="text-xs text-muted">
            Orden #{{ order.id.slice(0, 8) }} · Moneda {{ order.currencyCode }}
          </p>
        </div>

        <div v-if="!hasShippableItems" class="rounded-md bg-surface-50 border border-surface-200 px-3 py-4 text-sm text-muted text-center">
          Todos los items de esta orden ya fueron despachados.
        </div>

        <ul v-else class="divide-y divide-surface-200 rounded-md border border-surface-200">
          <li
            v-for="row in itemRows"
            :key="row.orderItem.id"
            class="px-3 py-2.5 flex items-start gap-3 text-sm"
            :class="{ 'opacity-60': row.remaining === 0 }"
          >
            <input
              type="checkbox"
              class="mt-1"
              :disabled="row.remaining === 0"
              v-model="row.selected"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ itemName(row.orderItem) }}</p>
              <p class="text-xs text-muted font-mono">{{ itemSku(row.orderItem) }}</p>
              <p class="text-xs text-muted">
                Pedido: {{ row.orderItem.quantity }} · Pendiente:
                <span class="font-medium text-surface-700">{{ row.remaining }}</span>
              </p>
            </div>
            <div class="w-24">
              <UiInput
                v-model.number="row.quantity"
                type="number"
                :min="1"
                :max="row.remaining"
                size="sm"
                :disabled="!row.selected || row.remaining === 0"
                @blur="clampQuantity(row)"
              />
            </div>
            <UiBadge v-if="row.remaining === 0" color="success">Despachado</UiBadge>
          </li>
        </ul>
      </section>

      <!-- Carrier suggestion -->
      <Transition name="fade">
        <div
          v-if="suggestion"
          class="rounded-md px-3 py-2.5 text-sm flex items-start justify-between gap-3"
          :class="
            suggestion.reason === 'OWN_FLEET_IN_COVERAGE'
              ? 'bg-success-50 border border-success-200'
              : 'bg-info-50 border border-info-200'
          "
        >
          <div class="min-w-0 space-y-0.5">
            <p
              class="font-medium"
              :class="suggestion.reason === 'OWN_FLEET_IN_COVERAGE' ? 'text-success-700' : 'text-info-700'"
            >
              {{
                suggestion.reason === 'OWN_FLEET_IN_COVERAGE'
                  ? 'Transporte propio disponible'
                  : 'Courier externo recomendado'
              }}
              — {{ suggestion.carrier.label }}
            </p>
            <p
              class="text-xs"
              :class="suggestion.reason === 'OWN_FLEET_IN_COVERAGE' ? 'text-success-600' : 'text-info-600'"
            >
              <template v-if="suggestion.reason === 'OWN_FLEET_IN_COVERAGE'">
                Destino a {{ suggestion.distanceKm!.toFixed(1) }} km del hub (cobertura {{ suggestion.coverageRadiusKm }} km)
              </template>
              <template v-else>El destino esta fuera del radio de la flota propia</template>
            </p>
          </div>
          <UiButton
            v-if="!suggestionApplied"
            size="sm"
            :variant="suggestion.reason === 'OWN_FLEET_IN_COVERAGE' ? 'primary' : 'ghost'"
            class="shrink-0"
            @click="form.carrierId = suggestion!.carrier.id"
          >
            Aplicar
          </UiButton>
        </div>
      </Transition>

      <!-- Carrier + tracking -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <UiSelect
          v-model="form.carrierId"
          label="Transportadora"
          size="sm"
          :options="carrierOptions"
        />
        <UiInput
          v-model="form.shippingCost"
          label="Costo de envio"
          size="sm"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
        />
        <UiInput v-model="form.trackingNumber" label="Numero de tracking" size="sm" />
        <UiInput
          v-model="form.trackingUrl"
          label="URL de tracking (override)"
          size="sm"
          placeholder="Se genera desde el carrier si vacio"
        />
        <UiInput
          v-model="form.estimatedDeliveryAt"
          type="date"
          label="Entrega estimada"
          size="sm"
        />
      </section>

      <!-- Destination -->
      <section>
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium text-surface-800">Destino del envio</p>
          <UiButton
            v-if="primaryAddress"
            variant="ghost"
            size="sm"
            type="button"
            @click="prefillAddress"
          >
            Reusar direccion de la orden
          </UiButton>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UiInput v-model="form.shipToName" label="Destinatario" size="sm" />
          <UiInput v-model="form.shipToPhone" label="Telefono" size="sm" />
          <UiInput v-model="form.shipToStreet" label="Direccion" size="sm" class="md:col-span-2" />
          <UiInput v-model="form.shipToCity" label="Ciudad" size="sm" />
          <UiInput v-model="form.shipToState" label="Estado/Provincia" size="sm" />
          <UiInput v-model="form.shipToPostalCode" label="Codigo postal" size="sm" />
          <UiInput v-model="form.shipToCountry" label="Pais" size="sm" />
          <UiInput v-model="form.shipToLat" label="Latitud (opcional)" size="sm" placeholder="-12.0464" />
          <UiInput v-model="form.shipToLng" label="Longitud (opcional)" size="sm" placeholder="-77.0428" />
        </div>
      </section>

      <UiTextarea v-model="form.notes" label="Notas internas" :rows="2" />
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cancelar</UiButton>
      <UiButton :loading="submitting" :disabled="!canSubmit" @click="submit">
        Crear envio ({{ selectedItemCount }} item{{ selectedItemCount === 1 ? '' : 's' }})
      </UiButton>
    </template>
  </UiModal>
</template>
