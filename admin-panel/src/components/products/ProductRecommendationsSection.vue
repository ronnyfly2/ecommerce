<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import type { Product } from '@/types/api'

defineProps<{
  variantProductSearch: string
  relatedProductSearch: string
  suggestedProductSearch: string
  selectedVariantProducts: Product[]
  filteredVariantProducts: Product[]
  selectedRelatedProducts: Product[]
  filteredRelatedProducts: Product[]
  selectedSuggestedProducts: Product[]
  filteredSuggestedProducts: Product[]
  recommendationImage: (product: Product) => string
  recommendationPrice: (product: Product) => string
  openVariantImageManager: (variantProductId: string) => void
  editVariantProduct: (variantProductId: string) => void
  toggleRecommendationProduct: (group: 'related' | 'suggested' | 'variant', productId: string) => void
  removeRecommendationProduct: (group: 'related' | 'suggested' | 'variant', productId: string) => void
  onRecommendationDragStart: (group: 'related' | 'suggested', productId: string) => void
  onRecommendationDragOver: (event: DragEvent) => void
  onRecommendationDrop: (group: 'related' | 'suggested', targetProductId: string) => void
  onRecommendationDragEnd: () => void
}>()

defineEmits<{
  'update:variantProductSearch': [value: string]
  'update:relatedProductSearch': [value: string]
  'update:suggestedProductSearch': [value: string]
}>()
</script>

<template>
  <div class="lg:col-span-2 form-panel space-y-3">
    <div>
      <p class="text-sm font-medium text-surface-700">Versiones o variantes vinculadas</p>
      <p class="text-xs text-surface-500">
        Vincula aquí otras versiones del producto. Esto sirve tanto para moda como para electrónica, hogar o cualquier otro rubro.
      </p>
    </div>

    <UiInput
      :model-value="variantProductSearch"
      placeholder="Buscar variantes por nombre, SKU o slug..."
      @update:model-value="$emit('update:variantProductSearch', String($event ?? ''))"
    />

    <div v-if="selectedVariantProducts.length" class="space-y-2">
      <div
        v-for="(variantProduct, index) in selectedVariantProducts"
        :key="variantProduct.id"
        class="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-surface-0 px-3 py-2"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
            <img v-if="recommendationImage(variantProduct)" :src="recommendationImage(variantProduct)" :alt="variantProduct.name" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <p class="font-medium text-surface-900 truncate">{{ index + 1 }}. {{ variantProduct.name }}</p>
            <p class="text-xs font-mono text-surface-500 truncate">{{ variantProduct.sku }}</p>
            <p class="text-xs text-surface-700">{{ recommendationPrice(variantProduct) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UiButton type="button" size="sm" variant="secondary" @click="openVariantImageManager(variantProduct.id)">
            Imágenes
          </UiButton>
          <UiButton type="button" size="sm" variant="ghost" @click="editVariantProduct(variantProduct.id)">
            Editar
          </UiButton>
          <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('variant', variantProduct.id)">
            Quitar
          </UiButton>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-2">
      <button
        v-for="variantProduct in filteredVariantProducts"
        :key="variantProduct.id"
        type="button"
        class="rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-left hover:border-primary-300"
        @click="toggleRecommendationProduct('variant', variantProduct.id)"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
            <img v-if="recommendationImage(variantProduct)" :src="recommendationImage(variantProduct)" :alt="variantProduct.name" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <p class="font-medium text-surface-900 truncate">{{ variantProduct.name }}</p>
            <p class="text-xs font-mono text-surface-500 truncate">{{ variantProduct.sku }}</p>
            <p class="text-xs text-surface-700">{{ recommendationPrice(variantProduct) }}</p>
          </div>
        </div>
      </button>
    </div>

    <p v-if="!filteredVariantProducts.length" class="text-xs text-surface-500">
      No hay más productos disponibles para variantes.
    </p>
  </div>

  <div class="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
    <div class="form-panel space-y-3">
      <div>
        <p class="text-sm font-medium text-surface-700">Productos relacionados</p>
        <p class="text-xs text-surface-500">Se muestran como productos similares o complementarios.</p>
      </div>

      <UiInput
        :model-value="relatedProductSearch"
        placeholder="Buscar relacionados por nombre, SKU o slug..."
        @update:model-value="$emit('update:relatedProductSearch', String($event ?? ''))"
      />

      <div v-if="selectedRelatedProducts.length" class="space-y-2">
        <div
          v-for="(related, index) in selectedRelatedProducts"
          :key="related.id"
          class="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-surface-0 px-3 py-2 cursor-move"
          draggable="true"
          @dragstart="onRecommendationDragStart('related', related.id)"
          @dragover="onRecommendationDragOver"
          @drop="onRecommendationDrop('related', related.id)"
          @dragend="onRecommendationDragEnd"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
              <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ index + 1 }}. {{ related.name }}</p>
              <p class="text-xs font-mono text-surface-500 truncate">{{ related.sku }}</p>
              <p class="text-xs text-surface-700">{{ recommendationPrice(related) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-xs text-surface-500">Arrastra</span>
            <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('related', related.id)">Quitar</UiButton>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2">
        <button
          v-for="related in filteredRelatedProducts"
          :key="related.id"
          type="button"
          class="rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-left hover:border-primary-300"
          @click="toggleRecommendationProduct('related', related.id)"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
              <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ related.name }}</p>
              <p class="text-xs font-mono text-surface-500 truncate">{{ related.sku }}</p>
              <p class="text-xs text-surface-700">{{ recommendationPrice(related) }}</p>
            </div>
          </div>
        </button>
      </div>

      <p v-if="!filteredRelatedProducts.length" class="text-xs text-surface-500">
        No hay más productos disponibles para relacionados.
      </p>
    </div>

    <div class="form-panel space-y-3">
      <div>
        <p class="text-sm font-medium text-surface-700">Productos sugeridos</p>
        <p class="text-xs text-surface-500">Se pueden priorizar para recomendaciones destacadas.</p>
      </div>

      <UiInput
        :model-value="suggestedProductSearch"
        placeholder="Buscar sugeridos por nombre, SKU o slug..."
        @update:model-value="$emit('update:suggestedProductSearch', String($event ?? ''))"
      />

      <div v-if="selectedSuggestedProducts.length" class="space-y-2">
        <div
          v-for="(suggested, index) in selectedSuggestedProducts"
          :key="suggested.id"
          class="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-surface-0 px-3 py-2 cursor-move"
          draggable="true"
          @dragstart="onRecommendationDragStart('suggested', suggested.id)"
          @dragover="onRecommendationDragOver"
          @drop="onRecommendationDrop('suggested', suggested.id)"
          @dragend="onRecommendationDragEnd"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
              <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ index + 1 }}. {{ suggested.name }}</p>
              <p class="text-xs font-mono text-surface-500 truncate">{{ suggested.sku }}</p>
              <p class="text-xs text-surface-700">{{ recommendationPrice(suggested) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-xs text-surface-500">Arrastra</span>
            <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('suggested', suggested.id)">Quitar</UiButton>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2">
        <button
          v-for="suggested in filteredSuggestedProducts"
          :key="suggested.id"
          type="button"
          class="rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-left hover:border-primary-300"
          @click="toggleRecommendationProduct('suggested', suggested.id)"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
              <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-surface-900 truncate">{{ suggested.name }}</p>
              <p class="text-xs font-mono text-surface-500 truncate">{{ suggested.sku }}</p>
              <p class="text-xs text-surface-700">{{ recommendationPrice(suggested) }}</p>
            </div>
          </div>
        </button>
      </div>

      <p v-if="!filteredSuggestedProducts.length" class="text-xs text-surface-500">
        No hay más productos disponibles para sugeridos.
      </p>
    </div>
  </div>
</template>