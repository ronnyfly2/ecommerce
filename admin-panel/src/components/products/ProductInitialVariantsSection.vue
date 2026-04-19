<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiTable from '@/components/ui/UiTable.vue'
import type { TableColumn } from '@/components/ui/UiTable.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'

type InitialVariantDraft = {
  sku: string
  sizeId: string
  colorId: string
  additionalPrice: number | string
  isActive: boolean
}

type InitialVariantErrors = {
  sku: string
  sizeId: string
  colorId: string
  additionalPrice: string
}

type InitialVariantItem = {
  sku: string
  sizeId: string
  colorId: string
  additionalPrice: number
  isActive: boolean
}

defineProps<{
  visible: boolean
  initialVariantDraft: InitialVariantDraft
  initialVariantErrors: InitialVariantErrors
  initialVariantSkuPreview: string
  initialVariants: InitialVariantItem[]
  initialVariantsColumns: TableColumn[]
  sizeOptions: Array<{ value: string; label: string }>
  colorOptions: Array<{ value: string; label: string }>
  onInitialVariantSkuInput: (value: string | number | undefined) => void
  resetInitialVariantSku: () => void
  addInitialVariant: () => void
  removeInitialVariant: (index: number) => void
  sizeNameById: (sizeId: string) => string
  colorNameById: (colorId: string) => string
  fmt: (n: number | string, currencyCode?: string) => string
}>()
</script>

<template>
  <div v-if="visible" class="lg:col-span-2 space-y-3">
    <p class="text-sm font-medium text-surface-700">Crear variantes iniciales por talla/color</p>
    <p class="text-xs text-surface-500">
      Usa este bloque sólo cuando la categoría trabaje con talla y color. Cada combinación se crea como producto independiente.
    </p>

    <div class="form-panel space-y-4">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <UiInput
          :model-value="initialVariantDraft.sku"
          label="SKU"
          size="lg"
          placeholder="SKU-REM-BLK-M"
          :error="initialVariantErrors.sku"
          @update:model-value="onInitialVariantSkuInput"
        />
        <UiSelect
          v-model="initialVariantDraft.sizeId"
          label="Talla"
          searchable
          size="lg"
          :options="sizeOptions"
          placeholder="Seleccionar talla"
          search-placeholder="Buscar talla..."
          :error="initialVariantErrors.sizeId"
        />
        <UiSelect
          v-model="initialVariantDraft.colorId"
          label="Color"
          searchable
          size="lg"
          :options="colorOptions"
          placeholder="Seleccionar color"
          search-placeholder="Buscar color..."
          :error="initialVariantErrors.colorId"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <UiInput
          v-model="initialVariantDraft.additionalPrice"
          type="number"
          min="0"
          step="0.01"
          label="Ajuste de precio"
          size="lg"
          :error="initialVariantErrors.additionalPrice"
        />
        <div class="flex items-end">
          <FormToggleField v-model="initialVariantDraft.isActive" label="Variante activa" variant="card" size="lg" class="w-full" />
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 text-xs text-surface-500">
        <span>Sugerido: {{ initialVariantSkuPreview || 'SIN-SKU' }}</span>
        <button type="button" class="font-medium text-primary-700 hover:text-primary-800" @click="resetInitialVariantSku">
          Usar sugerencia
        </button>
      </div>

      <div class="flex justify-end">
        <UiButton type="button" size="sm" @click="addInitialVariant">Agregar combinación</UiButton>
      </div>

      <div>
        <UiTable :data="initialVariants" :columns="initialVariantsColumns" compact empty-message="Aun no agregaste variantes iniciales">
          <tr v-for="(item, index) in initialVariants" :key="item.sku" class="table-tr-hover">
            <td class="table-td font-mono text-xs">{{ item.sku }}</td>
            <td class="table-td">{{ sizeNameById(item.sizeId) }}</td>
            <td class="table-td">{{ colorNameById(item.colorId) }}</td>
            <td class="table-td text-right">{{ fmt(item.additionalPrice) }}</td>
            <td class="table-td text-center">
              <UiBadge :color="item.isActive ? 'success' : 'neutral'" dot>
                {{ item.isActive ? 'Activo' : 'Desactivo' }}
              </UiBadge>
            </td>
            <td class="table-td table-actions-td text-right">
              <UiButton type="button" variant="danger" size="sm" @click="removeInitialVariant(index)">
                Quitar
              </UiButton>
            </td>
          </tr>
        </UiTable>
      </div>
    </div>
  </div>
</template>