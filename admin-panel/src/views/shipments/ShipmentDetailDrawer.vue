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
import LeafletRoutePlanner from '@/components/maps/LeafletRoutePlanner.vue'
import { inventoryService } from '@/services/inventory.service'
import {
  shipmentsService,
  type Carrier,
  type Shipment,
  type ShipmentEvent,
  type ShipmentStatus,
} from '@/services/shipments.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'
import { useCarrierSuggestion } from '@/composables/useCarrierSuggestion'
import type { Store } from '@/types/api'

const props = defineProps<{
  shipmentId: string
  carriers: Carrier[]
  canManage: boolean
}>()
const emit = defineEmits<{ close: []; updated: [shipment: Shipment] }>()

const toast = useToast()
const loading = ref(false)
const loadingStores = ref(false)
const shipment = ref<Shipment | null>(null)
const events = ref<ShipmentEvent[]>([])
const stores = ref<Store[]>([])
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

// ── Carrier suggestion ────────────────────────────────────────────────────────
const carriersRef = computed(() => props.carriers)
const editLatRef  = computed(() => editForm.shipToLat)
const editLngRef  = computed(() => editForm.shipToLng)

const { suggestion } = useCarrierSuggestion(carriersRef, editLatRef, editLngRef)

/** True when the user has already selected the suggested carrier */
const suggestionAlreadyApplied = computed(
  () => suggestion.value != null && editForm.carrierId === suggestion.value.carrier.id,
)

const routePreview = reactive<{
  storeId: string
  storeLat: string
  storeLng: string
  extraStops: Array<{ label: string; lat: string; lng: string }>
}>({
  storeId: '',
  storeLat: '',
  storeLng: '',
  extraStops: [],
})

const storeGeoLoading = ref(false)
const storeGeoError = ref<string | null>(null)

function parseCoord(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function carrierHub(carrier: Carrier | null): { lat: number; lng: number } | null {
  if (!carrier) return null
  const operational = (carrier.config?.operational as Record<string, unknown> | undefined) ?? {}
  const lat = parseCoord(operational.defaultHubLat as string | number | null | undefined)
  const lng = parseCoord(operational.defaultHubLng as string | number | null | undefined)
  if (lat == null || lng == null) return null
  return { lat, lng }
}

const selectedCarrier = computed(() => {
  if (!editForm.carrierId) return null
  return props.carriers.find((carrier) => carrier.id === editForm.carrierId) ?? null
})

const storeOptions = computed(() => [
  { value: '', label: 'Seleccionar tienda de recojo (A)' },
  ...stores.value.map((store) => ({
    value: store.id,
    label: `${store.code} · ${store.name} (${store.city})`,
  })),
])

const selectedStore = computed(() => {
  if (!routePreview.storeId) return null
  return stores.value.find((store) => store.id === routePreview.storeId) ?? null
})

// If no carrier is manually selected yet, use the suggested one as default for preview.
const effectiveCarrierForRoute = computed<Carrier | null>(() => {
  return selectedCarrier.value ?? suggestion.value?.carrier ?? null
})

const routeOrigin = computed(() => {
  const lat = parseCoord(routePreview.storeLat)
  const lng = parseCoord(routePreview.storeLng)
  if (lat != null && lng != null) return { lat, lng }
  // Fallback to carrier hub if store coordinates are not available yet.
  return carrierHub(effectiveCarrierForRoute.value)
})

const routeStops = computed<Array<{ lat: string; lng: string; label: string }>>(() => {
  const stops: Array<{ lat: string; lng: string; label: string }> = []

  if (editForm.shipToLat && editForm.shipToLng) {
    stops.push({
      lat: editForm.shipToLat,
      lng: editForm.shipToLng,
      label: 'B - Cliente principal',
    })
  }

  routePreview.extraStops.forEach((stop, index) => {
    if (stop.lat && stop.lng) {
      const label = stop.label.trim() || `Parada ${index + 2}`
      stops.push({ lat: stop.lat, lng: stop.lng, label })
    }
  })

  return stops
})

async function geocodeSelectedStore() {
  const store = selectedStore.value
  if (!store) {
    routePreview.storeLat = ''
    routePreview.storeLng = ''
    storeGeoError.value = null
    return
  }

  const query = [store.address, store.city, store.country].filter(Boolean).join(', ')
  if (!query) {
    storeGeoError.value = 'La tienda seleccionada no tiene dirección suficiente para geolocalizar.'
    return
  }

  storeGeoLoading.value = true
  storeGeoError.value = null
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '1',
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { 'Accept-Language': 'es' },
    })
    if (!response.ok) {
      throw new Error('No se pudo consultar geocodificación de tienda')
    }

    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>
    const first = data[0]
    const lat = first?.lat ? Number(first.lat) : NaN
    const lng = first?.lon ? Number(first.lon) : NaN

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('No se encontró coordenada válida para la tienda')
    }

    routePreview.storeLat = lat.toFixed(6)
    routePreview.storeLng = lng.toFixed(6)
  } catch (error) {
    routePreview.storeLat = ''
    routePreview.storeLng = ''
    storeGeoError.value = extractErrorMessage(error, 'No se pudo ubicar la tienda seleccionada')
  } finally {
    storeGeoLoading.value = false
  }
}

function addExtraStop() {
  routePreview.extraStops.push({
    label: '',
    lat: '',
    lng: '',
  })
}

function removeExtraStop(index: number) {
  routePreview.extraStops.splice(index, 1)
}
// ─────────────────────────────────────────────────────────────────────────────

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
    loadingStores.value = true
    const [s, evs, storesData] = await Promise.all([
      shipmentsService.get(props.shipmentId),
      shipmentsService.events(props.shipmentId),
      inventoryService.stores().catch(() => []),
    ])
    shipment.value = s
    events.value = evs
    stores.value = storesData
    hydrateEditForm(s)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo cargar el envio'))
  } finally {
    loadingStores.value = false
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
  routePreview.storeId = s.order?.pickupStore?.id ?? ''
  routePreview.storeLat = ''
  routePreview.storeLng = ''
  routePreview.extraStops = []

  if (routePreview.storeId) {
    void geocodeSelectedStore()
  }
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

watch(
  () => routePreview.storeId,
  () => {
    void geocodeSelectedStore()
  },
)
</script>

<template>
  <UiModal :show="true" size="xl" title="Detalle del envio" @close="emit('close')">
    <div v-if="loading || !shipment" class="flex justify-center py-10">
      <UiSpinner />
    </div>
    <div v-else class="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
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

        <!-- Smart carrier suggestion ────────────────────────────── -->
        <Transition name="fade">
          <div
            v-if="suggestion"
            class="rounded-md px-3 py-2.5 text-sm flex items-start justify-between gap-3 transition-colors"
            :class="
              suggestion.reason === 'OWN_FLEET_IN_COVERAGE'
                ? 'bg-success-50 border border-success-200'
                : 'bg-info-50 border border-info-200'
            "
          >
            <div class="min-w-0 space-y-0.5">
              <p
                class="font-medium flex items-center gap-1.5"
                :class="suggestion.reason === 'OWN_FLEET_IN_COVERAGE' ? 'text-success-700' : 'text-info-700'"
              >
                <svg
                  class="w-4 h-4 shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    v-if="suggestion.reason === 'OWN_FLEET_IN_COVERAGE'"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375c-.621 0-1.125-.504-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-2.25"
                  />
                  <path
                    v-else
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25-2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  />
                </svg>
                <span>
                  {{
                    suggestion.reason === 'OWN_FLEET_IN_COVERAGE'
                      ? 'Transporte propio disponible'
                      : 'Courier externo recomendado'
                  }}
                  &mdash; {{ suggestion.carrier.label }}
                </span>
                <svg
                  v-if="suggestionAlreadyApplied"
                  class="w-4 h-4 shrink-0 text-success-600"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                    clip-rule="evenodd"
                  />
                </svg>
              </p>
              <p
                class="text-xs"
                :class="suggestion.reason === 'OWN_FLEET_IN_COVERAGE' ? 'text-success-600' : 'text-info-600'"
              >
                <template v-if="suggestion.reason === 'OWN_FLEET_IN_COVERAGE'">
                  Destino a {{ suggestion.distanceKm!.toFixed(1) }} km del hub &mdash; dentro del radio de cobertura ({{ suggestion.coverageRadiusKm }} km)
                </template>
                <template v-else>
                  El destino est&aacute; fuera del radio de cobertura de la flota propia
                </template>
              </p>
            </div>
            <UiButton
              v-if="!suggestionAlreadyApplied"
              size="sm"
              :variant="suggestion.reason === 'OWN_FLEET_IN_COVERAGE' ? 'primary' : 'ghost'"
              class="shrink-0"
              @click="editForm.carrierId = suggestion!.carrier.id"
            >
              Aplicar
            </UiButton>
          </div>
        </Transition>
        <!-- ─────────────────────────────────────────────────────── -->

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

        <div class="rounded-md border border-surface-200 bg-surface-50 p-3 space-y-3">
          <p class="text-sm font-medium text-surface-800">
            Plan de ruta A → B → C (origen en tienda)
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <UiSelect
              v-model="routePreview.storeId"
              label="Tienda de recojo (A)"
              size="sm"
              :options="storeOptions"
            />
            <div class="flex items-end">
              <UiButton
                variant="ghost"
                size="sm"
                class="w-full"
                :loading="storeGeoLoading || loadingStores"
                @click="geocodeSelectedStore"
              >
                Ubicar tienda en mapa
              </UiButton>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <UiInput
              v-model="routePreview.storeLat"
              label="A latitud"
              size="sm"
              placeholder="-12.0464"
            />
            <UiInput
              v-model="routePreview.storeLng"
              label="A longitud"
              size="sm"
              placeholder="-77.0428"
            />
          </div>

          <p v-if="storeGeoError" class="text-xs text-warning-700">
            {{ storeGeoError }}
          </p>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm text-surface-700">Paradas adicionales (C en adelante)</p>
              <UiButton size="sm" variant="ghost" @click="addExtraStop">Agregar parada</UiButton>
            </div>

            <div
              v-for="(stop, index) in routePreview.extraStops"
              :key="`stop-${index}`"
              class="grid grid-cols-1 md:grid-cols-4 gap-2"
            >
              <UiInput
                v-model="stop.label"
                :label="`Parada ${index + 2} nombre`"
                size="sm"
                placeholder="Cliente adicional"
              />
              <UiInput
                v-model="stop.lat"
                :label="`Parada ${index + 2} lat`"
                size="sm"
                placeholder="-12.0600"
              />
              <UiInput
                v-model="stop.lng"
                :label="`Parada ${index + 2} lng`"
                size="sm"
                placeholder="-77.0300"
              />
              <div class="flex items-end">
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="w-full"
                  @click="removeExtraStop(index)"
                >
                  Quitar
                </UiButton>
              </div>
            </div>
          </div>
        </div>

        <LeafletRoutePlanner
          v-if="routeOrigin && routeStops.length > 0"
          :origin-lat="routeOrigin.lat"
          :origin-lng="routeOrigin.lng"
          :stops="routeStops"
          :origin-label="selectedStore?.name ?? effectiveCarrierForRoute?.label ?? 'A - Origen'"
          height-class="h-80"
        />
        <p v-else class="text-xs text-muted rounded-md bg-surface-50 border border-surface-200 px-3 py-2">
          Selecciona la tienda de recojo (A), coordendas del cliente principal (B) y opcionalmente agrega C, D... para visualizar la ruta consecutiva.
        </p>

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
