<script setup lang="ts">
defineProps<{
  slugPreview: string
  productSkuPreview: string
  categoryName: string
  categorySupportsSizeColorVariants: boolean
  stock: number | string
  activeAttributeCount: number
  shippingProfileSummary: string | null
  couponCode: string
}>()
</script>

<template>
  <div class="form-panel space-y-2">
    <p class="text-caption">Resumen rapido</p>
    <p class="text-sm text-surface-700">
      Slug estimado: <span class="font-mono text-xs">{{ slugPreview || 'sin-slug' }}</span>
    </p>
    <p class="text-sm text-surface-700">
      SKU: <span class="font-mono text-xs">{{ productSkuPreview || 'sin-sku' }}</span>
    </p>
    <p class="text-sm text-surface-700">
      Categoria: <strong>{{ categoryName }}</strong>
    </p>
    <p class="text-sm text-surface-700">
      Rubro configurado: <strong>{{ categorySupportsSizeColorVariants ? 'Con talla/color' : 'Sin talla/color' }}</strong>
    </p>
    <p class="text-sm text-surface-700">
      Stock base: <strong>{{ stock }} unidad(es)</strong>
    </p>
    <p class="text-sm text-surface-700">
      Atributos activos: <strong>{{ activeAttributeCount }}</strong>
    </p>
    <p v-if="shippingProfileSummary" class="text-sm text-surface-700">
      Perfil logístico:
      <strong>{{ shippingProfileSummary }}</strong>
    </p>
    <p class="text-sm text-surface-700">
      Cupon: <strong>{{ couponCode }}</strong>
    </p>
  </div>
</template>