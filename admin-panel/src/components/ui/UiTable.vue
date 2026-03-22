<script setup lang="ts">
import { computed } from 'vue'

type LoadingColor = 'primary' | 'info' | 'success' | 'danger' | 'neutral'

const props = withDefaults(defineProps<{
  data?: unknown[] | null
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  loadingText?: string
  loadingColor?: LoadingColor
  compact?: boolean
  noMinWidth?: boolean
}>(), {
  loadingText: 'Cargando...',
  loadingColor: 'primary',
  compact: false,
  noMinWidth: false,
})
const isLoading = computed(() => props.loading ?? props.data === null)
const isEmpty = computed(() => {
  if (typeof props.empty === 'boolean') return props.empty
  if (isLoading.value) return false
  return Array.isArray(props.data) && props.data.length === 0
})

const loadingToneClass = computed(() => {
  const tones: Record<LoadingColor, string> = {
    primary: 'bg-[--color-primary-600]',
    info: 'bg-[--color-info-600]',
    success: 'bg-[--color-success-600]',
    danger: 'bg-[--color-danger-600]',
    neutral: 'bg-[--color-surface-700]',
  }

  return tones[props.loadingColor]
})
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="py-12">
    <div
      :class="loadingToneClass"
      class="mx-auto flex w-fit min-w-56 flex-col items-center justify-center gap-3 rounded-xl px-6 py-5 md:min-w-64 md:gap-4"
    >
      <div class="flex items-center gap-2" role="status" aria-label="Cargando">
        <span class="h-3 w-3 rounded-full bg-primary-800 animate-bounce md:h-4 md:w-4 [animation-duration:700ms] md:[animation-duration:550ms]" style="animation-delay: 0ms" />
        <span class="h-3 w-3 rounded-full bg-primary-800 animate-bounce md:h-4 md:w-4 [animation-duration:700ms] md:[animation-duration:550ms]" style="animation-delay: 120ms" />
        <span class="h-3 w-3 rounded-full bg-primary-800 animate-bounce md:h-4 md:w-4 [animation-duration:700ms] md:[animation-duration:550ms]" style="animation-delay: 240ms" />
      </div>
      <p class="text-sm font-medium text-black">{{ loadingText }}</p>
    </div>
  </div>

  <!-- Empty state -->
  <div
    v-else-if="isEmpty"
    class="flex flex-col items-center justify-center py-16 text-center"
  >
    <svg class="w-12 h-12 text-[--color-primary-800] mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
    <p class="text-muted">{{ emptyMessage ?? 'No hay resultados' }}</p>
    <div v-if="$slots['empty-actions']" class="mt-4">
      <slot name="empty-actions" />
    </div>
  </div>

  <!-- Table -->
  <div
    v-else
    :class="[
      'overflow-x-auto border border-[--color-surface-200] bg-[--color-surface-0] shadow-(--shadow-xs)',
      compact ? 'rounded-lg' : 'rounded-xl',
    ]"
  >
    <table :class="[
      'table-base',
      noMinWidth ? 'min-w-0' : compact ? 'min-w-130 md:min-w-140' : 'min-w-160 md:min-w-180',
      compact ? 'table-base-compact' : '',
    ]">
      <thead>
        <slot name="head" />
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>
