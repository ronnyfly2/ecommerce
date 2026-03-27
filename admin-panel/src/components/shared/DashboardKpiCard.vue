<script setup lang="ts">
import UiCard from '@/components/ui/UiCard.vue'

defineProps<{
  title: string
  value: string | number
  tone?: 'primary' | 'success' | 'warning' | 'info' | 'neutral'
}>()
</script>

<template>
  <UiCard :padding="false">
    <div class="p-5 sm:p-6 flex items-center gap-4 min-h-[112px]">
      <div
        :class="[
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          tone === 'success'
            ? 'bg-success-100 text-success-700'
            : tone === 'warning'
              ? 'bg-warning-100 text-warning-800'
              : tone === 'info'
                ? 'bg-info-100 text-info-700'
                : tone === 'neutral'
                  ? 'bg-surface-100 text-surface-600'
                  : 'bg-primary-100 text-primary-700',
        ]"
      >
        <slot name="icon" />
      </div>

      <div class="min-w-0">
        <p class="text-caption uppercase tracking-wide">{{ title }}</p>
        <p class="text-[1.75rem] leading-tight font-bold text-surface-900 mt-1 truncate">
          {{ value }}
        </p>
      </div>
    </div>
  </UiCard>
</template>
