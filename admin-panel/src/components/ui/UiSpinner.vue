<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  tone?: 'primary' | 'neutral'
  color?: string
  label?: string
  inline?: boolean
}>(), {
  size: 'md',
  tone: 'primary',
  color: '',
  label: '',
  inline: false,
})

const toneClass = computed(() => {
  if (props.color) return props.color
  return props.tone === 'neutral' ? 'text-[--color-surface-500]' : 'text-[--color-primary-600]'
})

const labelClass = computed(() => {
  return props.tone === 'neutral' ? 'text-[--color-surface-600]' : 'text-[--color-surface-700]'
})

const iconClass = computed(() => {
  if (props.size === 'sm') return 'w-4 h-4'
  if (props.size === 'lg') return 'w-8 h-8'
  return 'w-6 h-6'
})

const textClass = computed(() => {
  return props.size === 'sm' ? 'text-xs' : 'text-sm'
})
</script>

<template>
  <div :class="inline ? 'inline-flex items-center gap-2' : 'flex items-center justify-center gap-2'" role="status" :aria-label="label || 'Cargando'">
    <svg
      :class="['animate-spin', toneClass, iconClass]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
    <span v-if="label" :class="[textClass, labelClass]">{{ label }}</span>
  </div>
</template>
