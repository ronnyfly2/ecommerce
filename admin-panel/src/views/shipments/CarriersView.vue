<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import LeafletAddressPicker from '@/components/maps/LeafletAddressPicker.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { carriersService, type Carrier, type UpsertCarrierDto } from '@/services/shipments.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

const toast = useToast()
const carriers = ref<Carrier[]>([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const askDeleteId = ref<string | null>(null)

type CarrierOperationMode = 'THIRD_PARTY' | 'OWN_FLEET'
type MapProvider = 'OPENSTREETMAP' | 'GOOGLE_MAPS' | 'MAPBOX' | 'HERE'
type GeolocationMode = 'NONE' | 'MANUAL' | 'GPS_DEVICE' | 'MOBILE_APP'

type CarrierOperationalConfig = {
  operationMode: CarrierOperationMode
  mapProvider: MapProvider
  geolocationMode: GeolocationMode
  supportsRealtimeTracking: boolean
  supportsRouteOptimization: boolean
  supportsProofOfDelivery: boolean
  defaultHubLat: string
  defaultHubLng: string
  /** Coverage radius in km used for auto-carrier suggestion (own-fleet only) */
  coverageRadiusKm: string
  hubAddress: string
  dispatchContactPhone: string
}

const OPERATION_MODE_OPTIONS = [
  { value: 'THIRD_PARTY', label: 'Tercero (courier externo)' },
  { value: 'OWN_FLEET', label: 'Transporte propio' },
]

const MAP_PROVIDER_OPTIONS = [
  { value: 'OPENSTREETMAP', label: 'OpenStreetMap (sin costo de licencia)' },
  { value: 'GOOGLE_MAPS', label: 'Google Maps (mayor cobertura)' },
  { value: 'MAPBOX', label: 'Mapbox (customización avanzada)' },
  { value: 'HERE', label: 'HERE Maps (foco logístico/empresarial)' },
]

const GEO_MODE_OPTIONS = [
  { value: 'NONE', label: 'Sin geolocalización' },
  { value: 'MANUAL', label: 'Actualización manual por operador' },
  { value: 'GPS_DEVICE', label: 'GPS por dispositivo vehicular' },
  { value: 'MOBILE_APP', label: 'GPS por app móvil de repartidor' },
]

const defaultOperationalConfig = (): CarrierOperationalConfig => ({
  operationMode: 'THIRD_PARTY',
  mapProvider: 'OPENSTREETMAP',
  geolocationMode: 'MANUAL',
  supportsRealtimeTracking: false,
  supportsRouteOptimization: false,
  supportsProofOfDelivery: false,
  defaultHubLat: '',
  defaultHubLng: '',
  coverageRadiusKm: '',
  hubAddress: '',
  dispatchContactPhone: '',
})

const emptyForm = (): UpsertCarrierDto & { configJson: string } & CarrierOperationalConfig => ({
  code: '',
  label: '',
  description: '',
  trackingUrlTemplate: '',
  logoUrl: '',
  isEnabled: true,
  displayOrder: 0,
  config: {},
  configJson: '{}',
  ...defaultOperationalConfig(),
})

const form = reactive(emptyForm())
const configError = ref<string | null>(null)
const isEnabledModel = computed<boolean>({
  get: () => form.isEnabled ?? true,
  set: (value) => {
    form.isEnabled = value
  },
})

async function load() {
  loading.value = true
  try {
    carriers.value = await carriersService.list()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar las transportadoras'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, emptyForm())
  editingId.value = null
  configError.value = null
  showForm.value = true
}

function openCreateOwnFleet() {
  Object.assign(form, emptyForm())
  form.code = 'own-fleet'
  form.label = 'Transporte propio'
  form.description = 'Flota interna con operación y seguimiento gestionado por la empresa.'
  form.operationMode = 'OWN_FLEET'
  form.geolocationMode = 'MOBILE_APP'
  form.supportsRealtimeTracking = true
  form.supportsRouteOptimization = true
  form.supportsProofOfDelivery = true
  form.configJson = '{}'
  editingId.value = null
  configError.value = null
  showForm.value = true
}

function normalizeOperationalConfig(config?: Record<string, unknown>): CarrierOperationalConfig {
  const operationalRaw = (config?.operational as Record<string, unknown> | undefined) ?? {}
  const defaults = defaultOperationalConfig()
  const operationMode =
    operationalRaw.operationMode === 'OWN_FLEET' || operationalRaw.operationMode === 'THIRD_PARTY'
      ? (operationalRaw.operationMode as CarrierOperationMode)
      : defaults.operationMode
  const mapProvider =
    operationalRaw.mapProvider === 'OPENSTREETMAP' ||
    operationalRaw.mapProvider === 'GOOGLE_MAPS' ||
    operationalRaw.mapProvider === 'MAPBOX' ||
    operationalRaw.mapProvider === 'HERE'
      ? (operationalRaw.mapProvider as MapProvider)
      : defaults.mapProvider
  const geolocationMode =
    operationalRaw.geolocationMode === 'NONE' ||
    operationalRaw.geolocationMode === 'MANUAL' ||
    operationalRaw.geolocationMode === 'GPS_DEVICE' ||
    operationalRaw.geolocationMode === 'MOBILE_APP'
      ? (operationalRaw.geolocationMode as GeolocationMode)
      : defaults.geolocationMode

  return {
    operationMode,
    mapProvider,
    geolocationMode,
    supportsRealtimeTracking: Boolean(operationalRaw.supportsRealtimeTracking),
    supportsRouteOptimization: Boolean(operationalRaw.supportsRouteOptimization),
    supportsProofOfDelivery: Boolean(operationalRaw.supportsProofOfDelivery),
    defaultHubLat:
      operationalRaw.defaultHubLat == null ? '' : String(operationalRaw.defaultHubLat),
    defaultHubLng:
      operationalRaw.defaultHubLng == null ? '' : String(operationalRaw.defaultHubLng),
    coverageRadiusKm:
      operationalRaw.coverageRadiusKm == null ? '' : String(operationalRaw.coverageRadiusKm),
    hubAddress: operationalRaw.hubAddress == null ? '' : String(operationalRaw.hubAddress),
    dispatchContactPhone:
      operationalRaw.dispatchContactPhone == null ? '' : String(operationalRaw.dispatchContactPhone),
  }
}

function assignOperationalConfigToForm(config?: Record<string, unknown>) {
  Object.assign(form, normalizeOperationalConfig(config))
}

function openEdit(carrier: Carrier) {
  editingId.value = carrier.id
  form.code = carrier.code
  form.label = carrier.label
  form.description = carrier.description ?? ''
  form.trackingUrlTemplate = carrier.trackingUrlTemplate ?? ''
  form.logoUrl = carrier.logoUrl ?? ''
  form.isEnabled = carrier.isEnabled
  form.displayOrder = carrier.displayOrder
  form.config = carrier.config ?? {}
  form.configJson = JSON.stringify(carrier.config ?? {}, null, 2)
  assignOperationalConfigToForm(carrier.config)
  configError.value = null
  showForm.value = true
}

function parseConfig(): Record<string, unknown> | null {
  const raw = form.configJson.trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      configError.value = null
      return parsed as Record<string, unknown>
    }
    configError.value = 'La configuracion debe ser un objeto JSON'
    return null
  } catch (error) {
    configError.value = `JSON invalido: ${(error as Error).message}`
    return null
  }
}

async function save() {
  const baseConfig = parseConfig()
  if (!baseConfig) return

  const config = {
    ...baseConfig,
    operational: {
      operationMode: form.operationMode,
      mapProvider: form.mapProvider,
      geolocationMode: form.geolocationMode,
      supportsRealtimeTracking: form.supportsRealtimeTracking,
      supportsRouteOptimization: form.supportsRouteOptimization,
      supportsProofOfDelivery: form.supportsProofOfDelivery,
      defaultHubLat: form.defaultHubLat ? Number(form.defaultHubLat) : null,
      defaultHubLng: form.defaultHubLng ? Number(form.defaultHubLng) : null,
      coverageRadiusKm: form.coverageRadiusKm ? Number(form.coverageRadiusKm) : null,
      hubAddress: form.hubAddress.trim() || null,
      dispatchContactPhone: form.dispatchContactPhone.trim() || null,
    },
  }
  const payload: UpsertCarrierDto = {
    code: form.code.trim(),
    label: form.label.trim(),
    description: form.description?.trim() || undefined,
    trackingUrlTemplate: form.trackingUrlTemplate?.trim() || undefined,
    logoUrl: form.logoUrl?.trim() || undefined,
    isEnabled: form.isEnabled,
    displayOrder: form.displayOrder ?? 0,
    config,
  }
  saving.value = true
  try {
    if (editingId.value) {
      await carriersService.update(editingId.value, payload)
      toast.success('Actualizada', 'La transportadora fue actualizada')
    } else {
      await carriersService.create(payload)
      toast.success('Creada', 'La transportadora fue creada')
    }
    showForm.value = false
    await load()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!askDeleteId.value) return
  deleting.value = true
  try {
    await carriersService.remove(askDeleteId.value)
    toast.success('Eliminada', 'La transportadora fue eliminada')
    askDeleteId.value = null
    await load()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    deleting.value = false
  }
}

onMounted(load)

function carrierOperationalConfig(carrier: Carrier): CarrierOperationalConfig {
  return normalizeOperationalConfig(carrier.config)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold text-surface-900">Transportadoras</h1>
      <p class="text-sm text-surface-600">
        Administra las transportadoras disponibles para generar envios.
      </p>
    </div>

    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nueva transportadora</UiButton>
        <UiButton variant="secondary" @click="openCreateOwnFleet">Transporte propio</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <div v-if="loading" class="p-10 flex justify-center">
        <UiSpinner />
      </div>
      <div v-else-if="carriers.length === 0" class="p-10 text-center text-muted text-sm">
        Aun no hay transportadoras registradas.
      </div>
      <ul v-else class="divide-y divide-surface-200">
        <li
          v-for="c in carriers"
          :key="c.id"
          class="px-4 py-3 flex items-start justify-between gap-3 hover:bg-surface-50"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-medium text-surface-900">{{ c.label }}</p>
              <UiBadge v-if="!c.isEnabled" color="neutral">Desactivada</UiBadge>
              <UiBadge v-if="c.trackingUrlTemplate" color="info">Tracking URL</UiBadge>
              <UiBadge
                v-if="carrierOperationalConfig(c).operationMode === 'OWN_FLEET'"
                color="primary"
              >
                Transporte propio
              </UiBadge>
              <UiBadge
                v-if="carrierOperationalConfig(c).geolocationMode !== 'NONE'"
                color="success"
              >
                Geolocalización
              </UiBadge>
            </div>
            <p class="text-xs text-muted mt-1 font-mono">{{ c.code }}</p>
            <p v-if="c.description" class="text-sm text-surface-600 mt-1">{{ c.description }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UiButton size="sm" variant="ghost" @click="openEdit(c)">Editar</UiButton>
            <UiButton size="sm" variant="ghost" @click="askDeleteId = c.id">Eliminar</UiButton>
          </div>
        </li>
      </ul>
    </UiCard>

    <UiModal
      :show="showForm"
      :title="editingId ? 'Editar transportadora' : 'Nueva transportadora'"
      size="lg"
      @close="showForm = false"
    >
      <div class="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UiInput v-model="form.code" label="Codigo" placeholder="shalom" :disabled="!!editingId" />
          <UiInput v-model="form.label" label="Nombre visible" placeholder="Shalom" />
        </div>
        <UiTextarea v-model="form.description" label="Descripcion" :rows="2" />
        <UiInput
          v-model="form.trackingUrlTemplate"
          label="Template de URL de tracking"
          placeholder="https://tracking.shalom.com/{tracking}"
        />
        <p class="text-xs text-muted">
          Usa <code>{tracking}</code> como placeholder. Se reemplazara por el numero al crear el envio.
        </p>
        <UiInput v-model="form.logoUrl" label="URL del logo (opcional)" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <FormToggleField v-model="isEnabledModel" label="Activa" />
          <UiInput v-model.number="form.displayOrder" type="number" label="Orden" />
        </div>

        <div class="rounded-lg border border-surface-200 bg-surface-50 p-3 space-y-3">
          <p class="text-sm font-medium text-surface-800">Operacion logística y seguimiento</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UiSelect
              v-model="form.operationMode"
              label="Modelo operativo"
              :options="OPERATION_MODE_OPTIONS"
            />
            <UiSelect
              v-model="form.mapProvider"
              label="Proveedor de mapas"
              :options="MAP_PROVIDER_OPTIONS"
            />
          </div>
          <UiSelect
            v-model="form.geolocationMode"
            label="Modo de geolocalizacion"
            :options="GEO_MODE_OPTIONS"
          />
          <p class="text-xs text-muted">
            Alternativas de mapas recomendadas: OpenStreetMap, Google Maps, Mapbox o HERE.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label class="flex items-center gap-2 text-sm text-surface-700">
              <input
                v-model="form.supportsRealtimeTracking"
                type="checkbox"
                class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              Tracking en tiempo real
            </label>
            <label class="flex items-center gap-2 text-sm text-surface-700">
              <input
                v-model="form.supportsRouteOptimization"
                type="checkbox"
                class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              Optimizacion de ruta
            </label>
            <label class="flex items-center gap-2 text-sm text-surface-700">
              <input
                v-model="form.supportsProofOfDelivery"
                type="checkbox"
                class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              Prueba de entrega (POD)
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <UiInput v-model="form.defaultHubLat" label="Hub latitud (opcional)" placeholder="-12.0464" />
            <UiInput v-model="form.defaultHubLng" label="Hub longitud (opcional)" placeholder="-77.0428" />
            <UiInput v-model="form.dispatchContactPhone" label="Telefono despacho" placeholder="+51 999 999 999" />
          </div>
          <div v-if="form.operationMode === 'OWN_FLEET'" class="flex items-start gap-2 rounded-md bg-success-50 border border-success-200 px-3 py-2">
            <div class="flex-1 min-w-0">
              <UiInput
                v-model="form.coverageRadiusKm"
                type="number"
                label="Radio de cobertura (km)"
                placeholder="30"
              />
              <p class="text-xs text-success-700 mt-1">
                Distancia máxima desde el hub para asignar transporte propio automáticamente.
                Se usa en la sugerencia inteligente de transportadora al crear un envío.
              </p>
            </div>
          </div>

          <LeafletAddressPicker
            v-model:lat="form.defaultHubLat"
            v-model:lng="form.defaultHubLng"
            v-model:address="form.hubAddress"
          />
        </div>

        <div>
          <label class="text-sm font-medium text-surface-800 block mb-1">
            Configuracion (JSON)
          </label>
          <textarea
            v-model="form.configJson"
            rows="5"
            class="w-full border border-surface-300 rounded-md px-3 py-2 font-mono text-xs"
            placeholder='{"apiKey": "...", "accountId": "..."}'
          />
          <p v-if="configError" class="text-xs text-danger-600 mt-1">{{ configError }}</p>
          <p class="text-xs text-muted mt-1">
            Configura credenciales de API, IDs de cuenta u otros parametros.
          </p>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="showForm = false">Cancelar</UiButton>
        <UiButton :loading="saving" @click="save">
          {{ editingId ? 'Actualizar' : 'Crear' }}
        </UiButton>
      </template>
    </UiModal>

    <UiConfirm
      :show="!!askDeleteId"
      title="Eliminar transportadora"
      message="Solo se puede eliminar si no tiene envios asociados."
      variant="danger"
      confirm-label="Eliminar"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="askDeleteId = null"
    />
  </div>
</template>
