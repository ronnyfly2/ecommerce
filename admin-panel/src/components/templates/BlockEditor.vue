<script setup lang="ts">
import UiCard from '@/components/ui/UiCard.vue'

export interface TemplateBlock {
  id: string
  componentKey: string
  order: number
  props: Record<string, unknown>
}

defineProps<{
  modelValue: TemplateBlock
  blockLabel?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: TemplateBlock): void
  (e: 'update', block: TemplateBlock): void
  (e: 'delete'): void
}>()
</script>

<template>
  <UiCard>
    <div class="space-y-2">
      <h3 class="text-sm font-semibold">Editor de bloque (legacy)</h3>
      <p class="text-xs text-muted">
        Este editor fue reemplazado por el modo facil del Gestor de Templates.
      </p>
      <p class="text-xs text-muted">
        Usa la vista principal para editar textos, colores, temas y estructura de forma visual.
      </p>
    </div>
  </UiCard>
</template>
