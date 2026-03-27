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
      color === 'success' ? 'bg-success-100 text-success-700' :
      color === 'warning' ? 'bg-warning-100 text-warning-700' :
      color === 'danger'  ? 'bg-danger-100  text-danger-700'  :
      color === 'info'    ? 'bg-info-100    text-info-700'    :
      color === 'primary' ? 'bg-primary-100 text-primary-700' :
                            'bg-surface-100 text-surface-600',
    ]"
  >
    <span
      v-if="dot"
      class="inline-block w-1.5 h-1.5 rounded-full bg-current"
    />
    <slot />
  </span>
</template>
