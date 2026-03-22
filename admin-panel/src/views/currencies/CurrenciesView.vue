<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { currenciesService } from '@/services/currencies.service'
import type { Currency } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import { useToast } from '@/composables/useToast'
import { setSystemCurrencyFromList } from '@/utils/system-currency'

const toast = useToast()
const currencies = ref<Currency[] | null>(null)
const tableLoading = computed(() => currencies.value === null)

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  code: '',
  name: '',
  symbol: '',
  exchangeRateToUsd: 1,
  isActive: true,
  isDefault: false,
})

const confirm = reactive({ show: false, id: '', code: '', loading: false })

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

async function load() {
  currencies.value = null
  try {
    currencies.value = await currenciesService.list()
    setSystemCurrencyFromList(currencies.value)
  } catch {
    currencies.value = []
    toast.error('Error', 'No se pudieron cargar las monedas')
  }
}

function resetForm() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.code = ''
  formModal.name = ''
  formModal.symbol = ''
  formModal.exchangeRateToUsd = 1
  formModal.isActive = true
  formModal.isDefault = false
}

function openCreate() {
  resetForm()
  formModal.show = true
}

function openEdit(currency: Currency) {
  formModal.isEdit = true
  formModal.id = currency.id
  formModal.code = currency.code
  formModal.name = currency.name
  formModal.symbol = currency.symbol
  formModal.exchangeRateToUsd = Number(currency.exchangeRateToUsd)
  formModal.isActive = currency.isActive
  formModal.isDefault = currency.isDefault
  formModal.show = true
}

async function saveCurrency() {
  formModal.loading = true
  try {
    const payload = {
      code: normalizeCode(formModal.code),
      name: formModal.name.trim(),
      symbol: formModal.symbol.trim(),
      exchangeRateToUsd: Number(formModal.exchangeRateToUsd),
      isActive: formModal.isActive,
      isDefault: formModal.isDefault,
    }

    if (formModal.isEdit) {
      await currenciesService.update(formModal.id, payload)
      toast.success('Moneda actualizada')
    } else {
      await currenciesService.create(payload)
      toast.success('Moneda creada')
    }

    formModal.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo guardar la moneda')
  } finally {
    formModal.loading = false
  }
}

function askDelete(currency: Currency) {
  confirm.id = currency.id
  confirm.code = currency.code
  confirm.show = true
}

async function removeCurrency() {
  confirm.loading = true
  try {
    await currenciesService.remove(confirm.id)
    toast.success('Moneda eliminada')
    confirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar la moneda')
  } finally {
    confirm.loading = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold text-[--color-surface-900]">Tipo de moneda</h1>
      <p class="text-sm text-[--color-surface-600]">
        Administra monedas activas y su tipo de cambio respecto a USD.
      </p>
    </div>

    <div class="flex justify-end">
      <UiButton @click="openCreate">Nueva moneda</UiButton>
    </div>

    <UiCard :padding="false">
      <UiTable :data="currencies" :loading="tableLoading" loading-color="primary" loading-text="Cargando monedas..." empty-message="No hay monedas">
        <template #head>
          <tr>
            <th class="table-th">Codigo</th>
            <th class="table-th">Nombre</th>
            <th class="table-th">Simbolo</th>
            <th class="table-th text-right">Tipo de cambio (1 USD = X)</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="c in currencies ?? []" :key="c.id" class="table-tr-hover">
          <td class="table-td font-mono text-xs">{{ c.code }}</td>
          <td class="table-td font-medium">
            {{ c.name }}
            <UiBadge v-if="c.isDefault" color="primary" class="ml-2">Default</UiBadge>
          </td>
          <td class="table-td">{{ c.symbol }}</td>
          <td class="table-td text-right">{{ Number(c.exchangeRateToUsd).toFixed(6) }}</td>
          <td class="table-td text-center">
            <UiBadge :color="c.isActive ? 'success' : 'neutral'" dot>
              {{ c.isActive ? 'Activa' : 'Inactiva' }}
            </UiBadge>
          </td>
          <td class="table-td table-actions-td text-right">
            <div class="flex items-center gap-2 justify-end">
              <UiButton size="sm" variant="ghost" @click="openEdit(c)">Editar</UiButton>
              <UiButton size="sm" variant="danger" @click="askDelete(c)">Eliminar</UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear moneda</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar moneda' : 'Nueva moneda'" @close="formModal.show = false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput
          :model-value="formModal.code"
          label="Codigo"
          required
          placeholder="USD"
          hint="Tres letras, por ejemplo USD, PEN"
          @update:model-value="(value) => formModal.code = normalizeCode(String(value ?? ''))"
        />
        <UiInput v-model="formModal.name" label="Nombre" required placeholder="US Dollar" />
        <UiInput v-model="formModal.symbol" label="Simbolo" required placeholder="$" />
        <UiInput
          v-model="formModal.exchangeRateToUsd"
          type="number"
          step="0.000001"
          min="0.000001"
          label="Tipo de cambio"
          hint="Cuantas unidades de esta moneda equivalen a 1 USD"
        />
        <div class="md:col-span-2 flex gap-6">
          <FormToggleField v-model="formModal.isActive" label="Activa" />
          <FormToggleField v-model="formModal.isDefault" label="Default" />
        </div>
      </div>

      <template #footer>
        <FormModalActions
          :loading="formModal.loading"
          :save-disabled="!formModal.code || !formModal.name.trim() || !formModal.symbol.trim()"
          @cancel="formModal.show = false"
          @save="saveCurrency"
        />
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar moneda"
      :message="`¿Eliminar la moneda ${confirm.code}?`"
      :loading="confirm.loading"
      @confirm="removeCurrency"
      @cancel="confirm.show = false"
    />
  </div>
</template>
