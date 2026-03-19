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
            ? 'bg-[--color-success-100] text-[--color-success-600]'
            : tone === 'warning'
              ? 'bg-[--color-warning-100] text-[--color-warning-600]'
              : tone === 'info'
                ? 'bg-[--color-info-100] text-[--color-info-600]'
                : tone === 'neutral'
                  ? 'bg-[--color-surface-100] text-[--color-surface-600]'
                  : 'bg-[--color-primary-100] text-[--color-primary-600]',
        ]"
      >
        <slot name="icon" />
      </div>

      <div class="min-w-0">
        <p class="text-caption uppercase tracking-wide">{{ title }}</p>
        <p class="text-[1.75rem] leading-tight font-bold text-[--color-surface-900] mt-1 truncate">
          {{ value }}
        </p>
      </div>
    </div>
  </UiCard>
</template>
