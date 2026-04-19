<script setup lang="ts">
import type { CategoryAttributeDefinition } from '@/types/api'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'

type ProductFormLogisticsModel = {
  attributeValues: Record<string, string | number | boolean>
  weightValue: number | string
  weightUnit: string
  lengthValue: number | string
  widthValue: number | string
  heightValue: number | string
  dimensionUnit: string
}

defineProps<{
  form: ProductFormLogisticsModel
  activeAttributeCount: number
  selectedCategoryAttributeDefinitions: CategoryAttributeDefinition[]
  categorySupportsWeight: boolean
  categorySupportsDimensions: boolean
  weightUnitOptions: Array<{ value: string; label: string }>
  dimensionUnitOptions: Array<{ value: string; label: string }>
  attributeFieldHint: (definition: CategoryAttributeDefinition) => string
  attributeUnitSuggestions: (definition: CategoryAttributeDefinition) => Array<{ value: string; label: string }>
  booleanAttributeValue: (key: string) => boolean
  updateBooleanAttributeValue: (key: string, value: boolean) => void
  textAttributeValue: (key: string) => string | number
  updateTextAttributeValue: (key: string, value: string | number | null | undefined) => void
}>()
</script>

<template>
  <div v-if="activeAttributeCount" class="lg:col-span-2 form-panel space-y-3">
    <div>
      <p class="text-sm font-medium text-surface-700">Atributos dinámicos del rubro</p>
      <p class="text-xs text-surface-500">
        Estos campos cambian según la categoría elegida y permiten usar el ecommerce en distintos rubros.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <template v-for="definition in selectedCategoryAttributeDefinitions" :key="definition.key">
        <FormToggleField
          v-if="definition.type === 'boolean'"
          :model-value="booleanAttributeValue(definition.key)"
          :label="definition.label"
          variant="card"
          size="lg"
          @update:model-value="updateBooleanAttributeValue(definition.key, $event)"
        />
        <UiSelect
          v-else-if="definition.type === 'select'"
          :model-value="textAttributeValue(definition.key)"
          :label="definition.label"
          size="lg"
          :hint="attributeFieldHint(definition)"
          :options="definition.options.map(option => ({ value: option, label: option }))"
          @update:model-value="updateTextAttributeValue(definition.key, $event)"
        />
        <UiInput
          v-else
          :model-value="textAttributeValue(definition.key)"
          :type="definition.type === 'number' ? 'number' : 'text'"
          :step="definition.type === 'number' ? '0.01' : undefined"
          :label="definition.label"
          size="lg"
          :hint="attributeFieldHint(definition)"
          @update:model-value="updateTextAttributeValue(definition.key, $event)"
        />
        <div
          v-if="definition.type === 'number' && attributeUnitSuggestions(definition).length"
          class="-mt-1 flex flex-wrap gap-2 md:col-span-1"
        >
          <span class="text-[11px] font-medium text-surface-500">Tipos de medida opcionales:</span>
          <span
            v-for="unit in attributeUnitSuggestions(definition)"
            :key="`${definition.key}-${unit.value}`"
            class="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] text-surface-600"
          >
            {{ unit.label }} ({{ unit.value }})
          </span>
        </div>
      </template>
    </div>
  </div>

  <div v-if="categorySupportsWeight || categorySupportsDimensions" class="lg:col-span-2 form-panel space-y-3">
    <div>
      <p class="text-sm font-medium text-surface-700">Ficha logística y técnica</p>
      <p class="text-xs text-surface-500">
        Define peso y medidas cuando el rubro lo requiera para envíos, almacenaje o fichas técnicas.
      </p>
    </div>

    <div v-if="categorySupportsWeight" class="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
      <UiInput
        v-model="form.weightValue"
        type="number"
        min="0"
        step="0.001"
        label="Peso"
        size="lg"
        hint="Opcional. Útil para logística y cálculo de envío."
      />
      <UiSelect v-model="form.weightUnit" label="Unidad de peso" size="lg" :options="weightUnitOptions" />
      <div class="md:col-span-2 flex flex-wrap gap-2">
        <button
          v-for="option in weightUnitOptions"
          :key="`weight-${option.value}`"
          type="button"
          class="rounded-full border px-2.5 py-1 text-xs transition"
          :class="form.weightUnit === option.value
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-surface-300 text-surface-700 hover:border-primary-400 hover:text-primary-700'"
          @click="form.weightUnit = String(option.value)"
        >
          {{ option.value }}
        </button>
      </div>
    </div>

    <div v-if="categorySupportsDimensions" class="space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <UiInput v-model="form.lengthValue" type="number" min="0" step="0.01" label="Largo" size="lg" />
        <UiInput v-model="form.widthValue" type="number" min="0" step="0.01" label="Ancho" size="lg" />
        <UiInput v-model="form.heightValue" type="number" min="0" step="0.01" label="Alto" size="lg" />
      </div>
      <UiSelect v-model="form.dimensionUnit" label="Unidad de medida" size="lg" :options="dimensionUnitOptions" class="max-w-xs" />
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in dimensionUnitOptions"
          :key="`dimension-${option.value}`"
          type="button"
          class="rounded-full border px-2.5 py-1 text-xs transition"
          :class="form.dimensionUnit === option.value
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-surface-300 text-surface-700 hover:border-primary-400 hover:text-primary-700'"
          @click="form.dimensionUnit = String(option.value)"
        >
          {{ option.value }}
        </button>
      </div>
    </div>
  </div>
</template>