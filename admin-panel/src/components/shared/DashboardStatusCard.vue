<script setup lang="ts">
import UiCard from '@/components/ui/UiCard.vue'
import UiBadge from '@/components/ui/UiBadge.vue'

defineProps<{
  label: string
  value: number
  badgeColor: 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'
}>()
</script>

<template>
  <UiCard :padding="false">
    <div class="p-4 sm:p-5 min-h-[76px] flex items-center justify-between gap-3">
      <UiBadge :color="badgeColor" dot>{{ label }}</UiBadge>
      <p class="text-xl sm:text-2xl font-semibold text-[--color-surface-900]">{{ value }}</p>
    </div>
  </UiCard>
</template>
