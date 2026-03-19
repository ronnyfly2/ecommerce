<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    :class="[
      'btn-base',
      variant === 'secondary' ? 'btn-secondary' :
      variant === 'danger'    ? 'btn-danger'    :
      variant === 'ghost'     ? 'btn-ghost'     :
                                'btn-primary',
      size === 'sm' ? 'btn-sm' :
      size === 'lg' ? 'btn-lg' : '',
    ]"
  >
    <svg
      v-if="loading"
      class="animate-spin"
      :style="{ width: size === 'sm' ? '12px' : '16px', height: size === 'sm' ? '12px' : '16px' }"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
    <slot />
  </button>
</template>
