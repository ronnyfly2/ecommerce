<script setup lang="ts">
defineProps<{
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  dot?: boolean
}>()
</script>

<template>
  <span
    :class="[
      'badge-base',
      color === 'success' ? 'bg-[--color-success-100] text-[--color-success-700]' :
      color === 'warning' ? 'bg-[--color-warning-100] text-[--color-warning-700]' :
      color === 'danger'  ? 'bg-[--color-danger-100]  text-[--color-danger-700]'  :
      color === 'info'    ? 'bg-[--color-info-100]    text-[--color-info-700]'    :
      color === 'primary' ? 'bg-[--color-primary-100] text-[--color-primary-700]' :
                            'bg-[--color-surface-100] text-[--color-surface-600]',
    ]"
  >
    <span
      v-if="dot"
      class="inline-block w-1.5 h-1.5 rounded-full bg-current"
    />
    <slot />
  </span>
</template>
