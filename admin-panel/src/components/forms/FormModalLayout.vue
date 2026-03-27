<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    columns?: 1 | 2
  }>(),
  {
    columns: 2,
  },
)

const layoutClass = computed(() => {
  return props.columns === 1
    ? 'space-y-4'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4'
})
</script>

<template>
  <div :class="layoutClass">
    <slot />
  </div>
</template>
