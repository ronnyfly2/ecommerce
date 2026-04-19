<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiButton from '@/components/ui/UiButton.vue'

type BasicInfoFormModel = {
  name: string
  sku: string
  categoryId: string
  basePrice: number | string
  stock: number | string
  currencyCode: string
}

type BasicInfoErrors = {
  name: string
  sku: string
  categoryId: string
  basePrice: string
  stock: string
}

type StockModel = {
  pickupStocks: Array<{
    storeId: string
    storeName: string
  }>
}

defineProps<{
  form: BasicInfoFormModel
  formErrors: BasicInfoErrors
  categories: Array<{ id: string; name: string }>
  currencies: Array<{ code: string; symbol: string }>
  productSkuPreview: string
  basePricePreview: string
  isEdit: boolean
  productStock: StockModel | null
  stockTotal: number
  stockDirty: boolean
  savingStock: boolean
  stockDraft: {
    deliveryStock: number
    pickupStocks: Record<string, number>
  }
  stockOriginal: {
    deliveryStock: number
    pickupStocks: Record<string, number>
  }
  onSkuInput: (value: string | number | undefined) => void
  resetSkuFromName: () => void
  saveProductStock: () => Promise<void>
}>()
</script>

<template>
  <UiInput
    v-model="form.name"
    label="Nombre"
    size="lg"
    required
    placeholder="Remera Oversize"
    :error="formErrors.name"
    hint="Usa un nombre claro para busqueda y catalogo"
  />

  <div class="space-y-2">
    <UiInput
      :model-value="form.sku"
      label="SKU del producto"
      size="lg"
      required
      placeholder="REMERA-OVERSIZE-NEGRA"
      :error="formErrors.sku"
      hint="Identificador unico del producto"
      @update:model-value="onSkuInput"
    />
    <div class="flex items-center justify-between gap-3 text-xs text-surface-500">
      <span>Vista previa: {{ productSkuPreview || 'SIN-SKU' }}</span>
      <button type="button" class="font-medium text-primary-700 hover:text-primary-800" @click="resetSkuFromName">
        Regenerar desde el nombre
      </button>
    </div>
  </div>

  <UiSelect
    v-model="form.categoryId"
    label="Categoria"
    required
    searchable
    size="lg"
    :options="categories.map(c => ({ value: c.id, label: c.name }))"
    placeholder="Seleccionar categoria"
    search-placeholder="Buscar categoria..."
    :error="formErrors.categoryId"
  />

  <UiInput
    v-model="form.basePrice"
    type="number"
    min="0"
    step="0.01"
    label="Precio base"
    size="lg"
    required
    :error="formErrors.basePrice"
    :hint="`Vista previa: ${basePricePreview}`"
  />

  <UiInput
    v-model="form.stock"
    type="number"
    min="0"
    step="1"
    label="Stock base"
    size="lg"
    :error="formErrors.stock"
    hint="Disponible para rubros sin variantes por talla/color"
  />

  <UiSelect
    v-model="form.currencyCode"
    label="Moneda"
    size="lg"
    :options="currencies.map(c => ({ value: c.code, label: `${c.code} (${c.symbol})` }))"
    placeholder="Seleccionar moneda"
  />

  <div v-if="isEdit && productStock" class="lg:col-span-2 form-panel space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-surface-700">Stock por canal de entrega</p>
        <p class="text-xs text-surface-500">
          Total: <strong>{{ stockTotal }} unidades</strong> — edita y guarda sin salir del formulario.
        </p>
      </div>
      <UiButton
        v-if="stockDirty"
        type="button"
        size="sm"
        :loading="savingStock"
        @click="saveProductStock"
      >
        Guardar stock
      </UiButton>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <UiInput
          v-model="stockDraft.deliveryStock"
          type="number"
          min="0"
          size="lg"
          label="Delivery"
          :class="stockDraft.deliveryStock !== stockOriginal.deliveryStock ? 'ring-2 ring-amber-400 ring-offset-1 rounded-md' : ''"
        />
      </div>
      <div v-for="storeStock in productStock.pickupStocks" :key="storeStock.storeId">
        <UiInput
          v-model="stockDraft.pickupStocks[storeStock.storeId]"
          type="number"
          min="0"
          size="lg"
          :label="`Retiro — ${storeStock.storeName}`"
          :class="stockDraft.pickupStocks[storeStock.storeId] !== stockOriginal.pickupStocks[storeStock.storeId] ? 'ring-2 ring-amber-400 ring-offset-1 rounded-md' : ''"
        />
      </div>
    </div>
  </div>
</template>
