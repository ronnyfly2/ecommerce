<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { currenciesService } from '@/services/currencies.service'
import type { Currency } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiTable from '@/components/ui/UiTable.vue'
import CatalogActionsCell from '@/components/catalog/CatalogActionsCell.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useResourceList } from '@/composables/useResourceList'
import { useCrudForm } from '@/composables/useCrudForm'
import { setSystemCurrencyFromList } from '@/utils/system-currency'

const { items: currencies, loading: tableLoading, load } = useResourceList<Currency>(
  async () => {
    const data = await currenciesService.list()
    setSystemCurrencyFromList(data)
    return data
  },
  'No se pudieron cargar las monedas',
)

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

type CurrencyForm = { code: string; name: string; symbol: string; exchangeRateToUsd: number; isActive: boolean; isDefault: boolean }

const { formModal, confirm, openCreate, openEdit, save: saveCurrency, askDelete, confirmDelete: removeCurrency } = useCrudForm<
  Currency,
  CurrencyForm
>({
  service: currenciesService,
  entityName: 'Moneda',
  formDefaults: () => ({ code: '', name: '', symbol: '', exchangeRateToUsd: 1, isActive: true, isDefault: false }),
  fillForm: (form, currency) => {
    form.code = currency.code
    form.name = currency.name
    form.symbol = currency.symbol
    form.exchangeRateToUsd = Number(currency.exchangeRateToUsd)
    form.isActive = currency.isActive
    form.isDefault = currency.isDefault
  },
  buildPayload: (form) => ({
    code: normalizeCode(form.code),
    name: form.name.trim(),
    symbol: form.symbol.trim(),
    exchangeRateToUsd: Number(form.exchangeRateToUsd),
    isActive: form.isActive,
    isDefault: form.isDefault,
  }),
  getDeleteName: (currency) => currency.code,
  onSuccess: load,
})

const tableColumns = [
  { key: 'code', label: 'Codigo' },
  { key: 'name', label: 'Nombre' },
  { key: 'symbol', label: 'Simbolo' },
  { key: 'rate', label: 'Tipo de cambio (1 USD = X)', align: 'right' as const },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'actions', actions: true },
]

const tableEmpty = computed(() => !tableLoading.value && (currencies.value?.length ?? 0) === 0)

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold text-surface-900">Tipo de moneda</h1>
      <p class="text-sm text-surface-600">
        Administra monedas activas y su tipo de cambio respecto a USD.
      </p>
    </div>

    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nueva moneda</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="currencies" :loading="tableLoading" :empty="tableEmpty" :columns="tableColumns" loading-color="primary" loading-text="Cargando monedas..." empty-message="No hay monedas">
        <template #empty-icon>
          <svg class="w-12 h-12 text-primary-800 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
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
          <CatalogActionsCell
            :disable-delete="c.isDefault"
            @edit="openEdit(c)"
            @delete="askDelete(c)"
          />
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear moneda</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar moneda' : 'Nueva moneda'" @close="formModal.show = false">
      <FormModalLayout>
        <UiInput
          :model-value="formModal.code"
          label="Codigo"
          size="lg"
          required
          placeholder="USD"
          hint="Tres letras, por ejemplo USD, PEN"
          @update:model-value="(value) => formModal.code = normalizeCode(String(value ?? ''))"
        />
        <UiInput v-model="formModal.name" label="Nombre" size="lg" required placeholder="US Dollar" />
        <UiInput v-model="formModal.symbol" label="Simbolo" size="lg" required placeholder="$" />
        <UiInput
          v-model="formModal.exchangeRateToUsd"
          type="number"
          step="0.000001"
          min="0.000001"
          label="Tipo de cambio"
          size="lg"
          hint="Cuantas unidades de esta moneda equivalen a 1 USD"
        />
        <div class="md:col-span-2 flex gap-6">
          <FormToggleField v-model="formModal.isActive" label="Activa" />
          <FormToggleField v-model="formModal.isDefault" label="Default" />
        </div>
      </FormModalLayout>

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
      :message="`¿Eliminar la moneda ${confirm.name}?`"
      :loading="confirm.loading"
      @confirm="removeCurrency"
      @cancel="confirm.show = false"
    />
  </div>
</template>
