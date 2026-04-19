<script setup lang="ts">
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import type { TableColumn } from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import type { Product } from '@/types/api'

defineProps<{
  selectedVariantProducts: Product[]
  variantProductsColumns: TableColumn[]
  recommendationImage: (product: Product) => string
  recommendationPrice: (product: Product) => string
  openVariantImageManager: (variantProductId: string) => void
  editVariantProduct: (variantProductId: string) => void
  removeRecommendationProduct: (group: 'related' | 'suggested' | 'variant', productId: string) => void
}>()
</script>

<template>
  <UiCard title="Versiones vinculadas">
    <template #default>
      <div class="p-4">
        <UiTable :data="selectedVariantProducts" :columns="variantProductsColumns" compact :empty="!selectedVariantProducts.length" empty-message="No hay variantes vinculadas">
          <tr v-for="variantProduct in selectedVariantProducts" :key="variantProduct.id" class="table-tr-hover">
            <td class="table-td">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                  <img
                    v-if="recommendationImage(variantProduct)"
                    :src="recommendationImage(variantProduct)"
                    :alt="variantProduct.name"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p class="font-medium text-surface-900">{{ variantProduct.name }}</p>
                  <p class="text-caption font-mono">{{ variantProduct.sku }}</p>
                </div>
              </div>
            </td>
            <td class="table-td text-right">{{ recommendationPrice(variantProduct) }}</td>
            <td class="table-td text-center">
              <UiBadge :color="variantProduct.isActive ? 'success' : 'neutral'" dot>
                {{ variantProduct.isActive ? 'Activo' : 'Desactivo' }}
              </UiBadge>
            </td>
            <td class="table-td table-actions-td text-right">
              <div class="flex items-center justify-end gap-1">
                <UiButton size="sm" variant="secondary" @click="openVariantImageManager(variantProduct.id)">
                  Imágenes
                </UiButton>
                <UiButton size="sm" variant="ghost" @click="editVariantProduct(variantProduct.id)">
                  Editar
                </UiButton>
                <UiButton size="sm" variant="danger" @click="removeRecommendationProduct('variant', variantProduct.id)">
                  Quitar
                </UiButton>
              </div>
            </td>
          </tr>
        </UiTable>
      </div>
    </template>
  </UiCard>
</template>