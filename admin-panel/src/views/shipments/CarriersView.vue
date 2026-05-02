<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
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

const emptyForm = (): UpsertCarrierDto & { configJson: string } => ({
  code: '',
  label: '',
  description: '',
  trackingUrlTemplate: '',
  logoUrl: '',
  isEnabled: true,
  displayOrder: 0,
  config: {},
  configJson: '{}',
})

const form = reactive(emptyForm())
const configError = ref<string | null>(null)

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
  const config = parseConfig()
  if (!config) return
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
      <div class="space-y-3">
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
          <FormToggleField v-model="form.isEnabled" label="Activa" />
          <UiInput v-model.number="form.displayOrder" type="number" label="Orden" />
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
