<script setup lang="ts">
defineProps<{
  title?: string
  padding?: boolean
}>()
</script>

<template>
  <div class="card">
    <div v-if="title" class="px-6 py-4 border-b border-[--color-surface-200]">
      <h3 class="text-heading-3">{{ title }}</h3>
    </div>
    <div :class="padding !== false ? 'p-6' : ''">
      <slot />
    </div>
  </div>
</template>
