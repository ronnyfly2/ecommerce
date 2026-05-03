<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import {
  paymentMethodsService,
  type PaymentMethod,
  type PaymentMethodType,
  type PaymentProviderType,
  type UpsertPaymentMethodDto,
} from '@/services/payments.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

const toast = useToast()
const methods = ref<PaymentMethod[]>([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const askDeleteId = ref<string | null>(null)

const providerOptions: { value: PaymentProviderType; label: string }[] = [
  { value: 'MANUAL_TRANSFER', label: 'Transferencia manual' },
  { value: 'STRIPE', label: 'Stripe (hosted checkout)' },
  { value: 'CASH_ON_DELIVERY', label: 'Contra entrega' },
]

const typeOptions: { value: PaymentMethodType; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Transferencia bancaria' },
  { value: 'CREDIT_CARD', label: 'Tarjeta' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'DIGITAL_WALLET', label: 'Billetera digital' },
]

const emptyForm = (): UpsertPaymentMethodDto & { configJson: string } => ({
  code: '',
  label: '',
  description: '',
  provider: 'MANUAL_TRANSFER',
  type: 'BANK_TRANSFER',
  isEnabled: true,
  displayOrder: 0,
  instructions: '',
  config: {},
  configJson: '{}',
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
    methods.value = await paymentMethodsService.list()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar los metodos de pago'))
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

function openEdit(method: PaymentMethod) {
  editingId.value = method.id
  form.code = method.code
  form.label = method.label
  form.description = method.description ?? ''
  form.provider = method.provider
  form.type = method.type
  form.isEnabled = method.isEnabled
  form.displayOrder = method.displayOrder
  form.instructions = method.instructions ?? ''
  form.config = method.config ?? {}
  form.configJson = JSON.stringify(method.config ?? {}, null, 2)
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
  const payload: UpsertPaymentMethodDto = {
    code: form.code.trim(),
    label: form.label.trim(),
    description: form.description?.trim() || undefined,
    provider: form.provider,
    type: form.type,
    isEnabled: form.isEnabled,
    displayOrder: form.displayOrder ?? 0,
    instructions: form.instructions?.trim() || undefined,
    config,
  }
  saving.value = true
  try {
    if (editingId.value) {
      await paymentMethodsService.update(editingId.value, payload)
      toast.success('Actualizado', 'El metodo de pago fue actualizado')
    } else {
      await paymentMethodsService.create(payload)
      toast.success('Creado', 'El metodo de pago fue creado')
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
    await paymentMethodsService.remove(askDeleteId.value)
    toast.success('Eliminado', 'El metodo fue eliminado')
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
      <h1 class="text-xl font-semibold text-surface-900">Metodos de pago</h1>
      <p class="text-sm text-surface-600">
        Administra los metodos disponibles en el checkout y sus credenciales.
      </p>
    </div>

    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nuevo metodo</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <div v-if="loading" class="p-10 flex justify-center">
        <UiSpinner />
      </div>
      <div v-else-if="methods.length === 0" class="p-10 text-center text-muted text-sm">
        Aun no hay metodos configurados.
      </div>
      <ul v-else class="divide-y divide-surface-200">
        <li
          v-for="m in methods"
          :key="m.id"
          class="px-4 py-3 flex items-start justify-between gap-3 hover:bg-surface-50"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-medium text-surface-900">{{ m.label }}</p>
              <UiBadge v-if="!m.isEnabled" color="neutral">Desactivado</UiBadge>
              <UiBadge color="info">{{ m.provider }}</UiBadge>
            </div>
            <p class="text-xs text-muted mt-1 font-mono">{{ m.code }}</p>
            <p v-if="m.description" class="text-sm text-surface-600 mt-1">{{ m.description }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UiButton size="sm" variant="ghost" @click="openEdit(m)">Editar</UiButton>
            <UiButton size="sm" variant="ghost" @click="askDeleteId = m.id">Eliminar</UiButton>
          </div>
        </li>
      </ul>
    </UiCard>

    <UiModal
      :show="showForm"
      :title="editingId ? 'Editar metodo' : 'Nuevo metodo de pago'"
      size="lg"
      @close="showForm = false"
    >
      <div class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UiInput v-model="form.code" label="Codigo" placeholder="bank-main" :disabled="!!editingId" />
          <UiInput v-model="form.label" label="Etiqueta" placeholder="Transferencia BanXYZ" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UiSelect
            v-model="form.provider"
            label="Proveedor"
            :options="providerOptions"
          />
          <UiSelect
            v-model="form.type"
            label="Tipo"
            :options="typeOptions"
          />
        </div>
        <UiTextarea
          v-model="form.description"
          label="Descripcion corta"
          placeholder="Visible en el checkout"
          :rows="2"
        />
        <UiTextarea
          v-model="form.instructions"
          label="Instrucciones para el cliente"
          placeholder="Ej: Realiza la transferencia a CBU... y adjunta el comprobante"
          :rows="3"
        />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <FormToggleField v-model="isEnabledModel" label="Activo" />
          <UiInput
            v-model.number="form.displayOrder"
            type="number"
            label="Orden"
          />
        </div>
        <div>
          <label class="text-sm font-medium text-surface-800 block mb-1">
            Configuracion (JSON)
          </label>
          <textarea
            v-model="form.configJson"
            rows="6"
            class="w-full border border-surface-300 rounded-md px-3 py-2 font-mono text-xs"
            placeholder='{"secretKey": "sk_test_...", "webhookSecret": "whsec_..."}'
          />
          <p v-if="configError" class="text-xs text-danger-600 mt-1">{{ configError }}</p>
          <p class="text-xs text-muted mt-1">
            Usa este campo para credenciales (Stripe), datos bancarios o parametros especificos.
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
      title="Eliminar metodo"
      message="Solo se puede eliminar si no tiene pagos asociados."
      variant="danger"
      confirm-label="Eliminar"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="askDeleteId = null"
    />
  </div>
</template>
