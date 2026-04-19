<script setup lang="ts">
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'

defineProps<{
  nameReady: boolean
  categoryReady: boolean
  skuReady: boolean
  priceReady: boolean
}>()
</script>

<template>
  <UiCard title="Estado del formulario">
    <div class="space-y-3 text-sm p-4">
      <div class="flex items-center justify-between">
        <span class="text-surface-600">Nombre</span>
        <UiBadge :color="nameReady ? 'success' : 'warning'" dot>
          {{ nameReady ? 'OK' : 'Pendiente' }}
        </UiBadge>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-surface-600">Categoria</span>
        <UiBadge :color="categoryReady ? 'success' : 'warning'" dot>
          {{ categoryReady ? 'OK' : 'Pendiente' }}
        </UiBadge>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-surface-600">SKU</span>
        <UiBadge :color="skuReady ? 'success' : 'warning'" dot>
          {{ skuReady ? 'OK' : 'Pendiente' }}
        </UiBadge>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-surface-600">Precio</span>
        <UiBadge :color="priceReady ? 'success' : 'warning'" dot>
          {{ priceReady ? 'OK' : 'Pendiente' }}
        </UiBadge>
      </div>
      <div class="divider" />
      <p class="text-xs text-surface-500">
        Tip: este formulario ya soporta productos genéricos; talla/color sólo aparece si la categoría lo necesita.
      </p>
    </div>
  </UiCard>
</template>