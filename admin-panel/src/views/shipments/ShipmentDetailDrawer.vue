<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import ShipmentMapEmbed from './ShipmentMapEmbed.vue'
import {
  shipmentsService,
  type Carrier,
  type Shipment,
  type ShipmentEvent,
  type ShipmentStatus,
} from '@/services/shipments.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

const props = defineProps<{
  shipmentId: string
  carriers: Carrier[]
  canManage: boolean
}>()
const emit = defineEmits<{ close: []; updated: [shipment: Shipment] }>()

const toast = useToast()
const loading = ref(false)
const shipment = ref<Shipment | null>(null)
const events = ref<ShipmentEvent[]>([])
const savingStatus = ref(false)
const savingEvent = ref(false)
const savingEdit = ref(false)

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

const statusTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['READY_TO_SHIP', 'IN_TRANSIT', 'CANCELLED'],
  READY_TO_SHIP: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  FAILED: ['IN_TRANSIT', 'CANCELLED'],
  RETURNED: [],
  CANCELLED: [],
}

const statusForm = reactive<{ status: ShipmentStatus | ''; note: string; location: string }>({
  status: '',
  note: '',
  location: '',
})

const eventForm = reactive<{
  description: string
  location: string
  lat: string
  lng: string
}>({
  description: '',
  location: '',
  lat: '',
  lng: '',
})

const editMode = ref(false)
const editForm = reactive<{
  carrierId: string
  trackingNumber: string
  trackingUrl: string
  estimatedDeliveryAt: string
  shipToName: string
  shipToStreet: string
  shipToCity: string
  shipToState: string
  shipToPostalCode: string
  shipToCountry: string
  shipToPhone: string
  shipToLat: string
  shipToLng: string
  notes: string
}>({
  carrierId: '',
  trackingNumber: '',
  trackingUrl: '',
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

const nextStatusOptions = computed(() => {
  if (!shipment.value) return []
  return statusTransitions[shipment.value.status].map((s) => ({
    value: s,
    label: statusLabels[s],
  }))
})

const carrierOptions = computed(() => [
  { value: '', label: 'Envio manual (sin transportadora)' },
  ...props.carriers.map((c) => ({ value: c.id, label: c.label })),
])

async function load() {
  loading.value = true
  try {
    const [s, evs] = await Promise.all([
      shipmentsService.get(props.shipmentId),
      shipmentsService.events(props.shipmentId),
    ])
    shipment.value = s
    events.value = evs
    hydrateEditForm(s)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo cargar el envio'))
  } finally {
    loading.value = false
  }
}

function hydrateEditForm(s: Shipment) {
  editForm.carrierId = s.carrier?.id ?? ''
  editForm.trackingNumber = s.trackingNumber ?? ''
  editForm.trackingUrl = s.trackingUrl ?? ''
  editForm.estimatedDeliveryAt = s.estimatedDeliveryAt?.slice(0, 10) ?? ''
  editForm.shipToName = s.shipToName ?? ''
  editForm.shipToStreet = s.shipToStreet ?? ''
  editForm.shipToCity = s.shipToCity ?? ''
  editForm.shipToState = s.shipToState ?? ''
  editForm.shipToPostalCode = s.shipToPostalCode ?? ''
  editForm.shipToCountry = s.shipToCountry ?? ''
  editForm.shipToPhone = s.shipToPhone ?? ''
  editForm.shipToLat = s.shipToLat ?? ''
  editForm.shipToLng = s.shipToLng ?? ''
  editForm.notes = s.notes ?? ''
}

async function applyStatusChange() {
  if (!shipment.value || !statusForm.status) return
  savingStatus.value = true
  try {
    const updated = await shipmentsService.updateStatus(shipment.value.id, {
      status: statusForm.status as ShipmentStatus,
      note: statusForm.note.trim() || undefined,
      location: statusForm.location.trim() || undefined,
    })
    shipment.value = updated
    statusForm.status = ''
    statusForm.note = ''
    statusForm.location = ''
    events.value = await shipmentsService.events(updated.id)
    emit('updated', updated)
    toast.success('Estado actualizado', `Ahora: ${statusLabels[updated.status]}`)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    savingStatus.value = false
  }
}

async function addEvent() {
  if (!shipment.value) return
  if (!eventForm.description && !eventForm.location) {
    toast.error('Datos faltantes', 'Agrega una descripcion o ubicacion')
    return
  }
  savingEvent.value = true
  try {
    await shipmentsService.addEvent(shipment.value.id, {
      type: 'NOTE',
      description: eventForm.description.trim() || undefined,
      location: eventForm.location.trim() || undefined,
      lat: eventForm.lat ? Number(eventForm.lat) : undefined,
      lng: eventForm.lng ? Number(eventForm.lng) : undefined,
    })
    eventForm.description = ''
    eventForm.location = ''
    eventForm.lat = ''
    eventForm.lng = ''
    events.value = await shipmentsService.events(shipment.value.id)
    toast.success('Evento agregado', 'El historial fue actualizado')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    savingEvent.value = false
  }
}

async function saveEdit() {
  if (!shipment.value) return
  savingEdit.value = true
  try {
    const updated = await shipmentsService.update(shipment.value.id, {
      carrierId: editForm.carrierId || null,
      trackingNumber: editForm.trackingNumber.trim() || null,
      trackingUrl: editForm.trackingUrl.trim() || null,
      estimatedDeliveryAt: editForm.estimatedDeliveryAt || null,
      shipToName: editForm.shipToName.trim() || null,
      shipToStreet: editForm.shipToStreet.trim() || null,
      shipToCity: editForm.shipToCity.trim() || null,
      shipToState: editForm.shipToState.trim() || null,
      shipToPostalCode: editForm.shipToPostalCode.trim() || null,
      shipToCountry: editForm.shipToCountry.trim() || null,
      shipToPhone: editForm.shipToPhone.trim() || null,
      shipToLat: editForm.shipToLat ? Number(editForm.shipToLat) : null,
      shipToLng: editForm.shipToLng ? Number(editForm.shipToLng) : null,
      notes: editForm.notes.trim() || null,
    })
    shipment.value = updated
    hydrateEditForm(updated)
    editMode.value = false
    emit('updated', updated)
    toast.success('Actualizado', 'El envio fue actualizado')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    savingEdit.value = false
  }
}

watch(() => props.shipmentId, load, { immediate: false })
onMounted(load)
</script>

<template>
  <UiModal :show="true" size="xl" title="Detalle del envio" @close="emit('close')">
    <div v-if="loading || !shipment" class="flex justify-center py-10">
      <UiSpinner />
    </div>
    <div v-else class="space-y-5">
      <!-- Summary -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-muted">Envio</p>
          <p class="font-mono">#{{ shipment.id.slice(0, 8) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Orden</p>
          <p class="font-mono">#{{ shipment.order.id.slice(0, 8) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Cliente</p>
          <p>{{ shipment.order?.user?.email ?? '—' }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Estado</p>
          <UiBadge :color="statusColors[shipment.status]" dot>
            {{ statusLabels[shipment.status] }}
          </UiBadge>
        </div>
        <div>
          <p class="text-xs text-muted">Transportadora</p>
          <p>{{ shipment.carrier?.label ?? 'Envio manual' }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Tracking</p>
          <a
            v-if="shipment.trackingUrl"
            :href="shipment.trackingUrl"
            target="_blank"
            rel="noopener"
            class="text-primary-700 hover:underline font-mono text-xs"
          >
            {{ shipment.trackingNumber ?? '—' }}
          </a>
          <span v-else class="font-mono text-xs text-muted">
            {{ shipment.trackingNumber ?? '—' }}
          </span>
        </div>
        <div v-if="shipment.estimatedDeliveryAt">
          <p class="text-xs text-muted">Entrega estimada</p>
          <p>{{ new Date(shipment.estimatedDeliveryAt).toLocaleDateString('es-AR') }}</p>
        </div>
        <div v-if="shipment.deliveredAt">
          <p class="text-xs text-muted">Entregado el</p>
          <p>{{ new Date(shipment.deliveredAt).toLocaleString('es-AR') }}</p>
        </div>
      </div>

      <!-- Destination -->
      <div v-if="!editMode" class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-surface-800">Destino</p>
          <UiButton v-if="canManage" variant="ghost" size="sm" @click="editMode = true">
            Editar envio
          </UiButton>
        </div>
        <div class="text-sm text-surface-700 space-y-1">
          <p v-if="shipment.shipToName" class="font-medium">{{ shipment.shipToName }}</p>
          <p v-if="shipment.shipToStreet">{{ shipment.shipToStreet }}</p>
          <p v-if="shipment.shipToCity || shipment.shipToState">
            {{
              [shipment.shipToCity, shipment.shipToState, shipment.shipToPostalCode]
                .filter(Boolean)
                .join(', ')
            }}
          </p>
          <p v-if="shipment.shipToCountry">{{ shipment.shipToCountry }}</p>
          <p v-if="shipment.shipToPhone" class="text-xs text-muted">{{ shipment.shipToPhone }}</p>
        </div>
        <ShipmentMapEmbed
          :lat="shipment.shipToLat"
          :lng="shipment.shipToLng"
          :label="shipment.shipToName ?? shipment.shipToStreet"
        />
      </div>

      <!-- Items -->
      <div>
        <p class="text-sm font-medium text-surface-800 mb-2">Items enviados</p>
        <ul class="divide-y divide-surface-200 rounded-md border border-surface-200">
          <li
            v-for="item in shipment.items ?? []"
            :key="item.id"
            class="px-3 py-2 flex items-start justify-between gap-3 text-sm"
          >
            <div class="flex-1 min-w-0">
              <p class="truncate">
                {{ item.orderItem?.snapshotProductName ?? item.orderItem?.product?.name ?? 'Producto' }}
              </p>
              <p class="text-xs text-muted font-mono">
                {{ item.orderItem?.snapshotSku ?? '—' }}
              </p>
            </div>
            <p class="text-sm font-medium">x{{ item.quantity }}</p>
          </li>
          <li v-if="!shipment.items?.length" class="px-3 py-4 text-center text-sm text-muted">
            Sin items registrados
          </li>
        </ul>
      </div>

      <!-- Status controls -->
      <div v-if="canManage && nextStatusOptions.length" class="rounded-md bg-surface-50 p-3 space-y-2">
        <p class="text-sm font-medium text-surface-800">Cambiar estado</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <UiSelect
            v-model="statusForm.status"
            label="Nuevo estado"
            size="sm"
            :options="[{ value: '', label: 'Selecciona...' }, ...nextStatusOptions]"
          />
          <UiInput
            v-model="statusForm.location"
            label="Ubicacion"
            size="sm"
            placeholder="Ej: Lima, Peru"
          />
          <UiInput
            v-model="statusForm.note"
            label="Nota"
            size="sm"
            placeholder="Observaciones opcionales"
          />
        </div>
        <div class="flex justify-end">
          <UiButton
            size="sm"
            :loading="savingStatus"
            :disabled="!statusForm.status"
            @click="applyStatusChange"
          >
            Aplicar cambio
          </UiButton>
        </div>
      </div>

      <!-- Add event -->
      <div v-if="canManage" class="rounded-md bg-surface-50 p-3 space-y-2">
        <p class="text-sm font-medium text-surface-800">Agregar evento de seguimiento</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <UiInput
            v-model="eventForm.location"
            label="Ubicacion"
            size="sm"
            placeholder="Ciudad o direccion"
          />
          <UiTextarea
            v-model="eventForm.description"
            label="Descripcion"
            :rows="1"
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <UiInput
            v-model="eventForm.lat"
            label="Latitud (opcional)"
            size="sm"
            placeholder="Ej: -12.0464"
          />
          <UiInput
            v-model="eventForm.lng"
            label="Longitud (opcional)"
            size="sm"
            placeholder="Ej: -77.0428"
          />
        </div>
        <div class="flex justify-end">
          <UiButton size="sm" variant="ghost" :loading="savingEvent" @click="addEvent">
            Registrar evento
          </UiButton>
        </div>
      </div>

      <!-- Events timeline -->
      <div>
        <p class="text-sm font-medium text-surface-800 mb-2">Historial</p>
        <ul v-if="events.length" class="space-y-2">
          <li
            v-for="ev in events"
            :key="ev.id"
            class="rounded-md border border-surface-200 px-3 py-2 text-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <UiBadge
                    v-if="ev.status"
                    :color="statusColors[ev.status]"
                    dot
                  >
                    {{ statusLabels[ev.status] }}
                  </UiBadge>
                  <span v-else class="text-xs text-muted uppercase tracking-wider">
                    {{ ev.type }}
                  </span>
                  <span v-if="ev.location" class="text-xs text-surface-600">· {{ ev.location }}</span>
                </div>
                <p v-if="ev.description" class="text-surface-700 mt-1 whitespace-pre-wrap">
                  {{ ev.description }}
                </p>
                <p v-if="ev.lat && ev.lng" class="text-xs text-muted mt-1 font-mono">
                  {{ ev.lat }}, {{ ev.lng }}
                  <a
                    :href="`https://www.openstreetmap.org/?mlat=${ev.lat}&mlon=${ev.lng}#map=15/${ev.lat}/${ev.lng}`"
                    target="_blank"
                    rel="noopener"
                    class="text-primary-700 hover:underline ml-1"
                  >
                    Ver mapa
                  </a>
                </p>
              </div>
              <p class="text-xs text-muted shrink-0">
                {{ new Date(ev.occurredAt).toLocaleString('es-AR') }}
              </p>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted italic">Sin eventos registrados.</p>
      </div>

      <!-- Edit form -->
      <div v-if="editMode" class="rounded-md border border-surface-200 p-3 space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-surface-800">Editar envio</p>
          <UiButton variant="ghost" size="sm" @click="editMode = false">Cancelar</UiButton>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <UiSelect
            v-model="editForm.carrierId"
            label="Transportadora"
            size="sm"
            :options="carrierOptions"
          />
          <UiInput v-model="editForm.trackingNumber" label="Tracking" size="sm" />
          <UiInput v-model="editForm.trackingUrl" label="URL de tracking (override)" size="sm" />
          <UiInput
            v-model="editForm.estimatedDeliveryAt"
            type="date"
            label="Entrega estimada"
            size="sm"
          />
          <UiInput v-model="editForm.shipToName" label="Destinatario" size="sm" />
          <UiInput v-model="editForm.shipToPhone" label="Telefono" size="sm" />
          <UiInput v-model="editForm.shipToStreet" label="Direccion" size="sm" />
          <UiInput v-model="editForm.shipToCity" label="Ciudad" size="sm" />
          <UiInput v-model="editForm.shipToState" label="Estado/Provincia" size="sm" />
          <UiInput v-model="editForm.shipToPostalCode" label="Codigo postal" size="sm" />
          <UiInput v-model="editForm.shipToCountry" label="Pais" size="sm" />
          <UiInput v-model="editForm.shipToLat" label="Latitud" size="sm" placeholder="-12.0464" />
          <UiInput v-model="editForm.shipToLng" label="Longitud" size="sm" placeholder="-77.0428" />
        </div>
        <UiTextarea v-model="editForm.notes" label="Notas" :rows="2" />
        <div class="flex justify-end">
          <UiButton size="sm" :loading="savingEdit" @click="saveEdit">Guardar cambios</UiButton>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cerrar</UiButton>
    </template>
  </UiModal>
</template>
