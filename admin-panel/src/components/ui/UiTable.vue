<script setup lang="ts">
defineProps<{
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
}>()
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loading" class="space-y-3">
    <div v-for="i in 5" :key="i" class="h-12 rounded-lg bg-[--color-surface-100] animate-pulse" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="empty"
    class="flex flex-col items-center justify-center py-16 text-center"
  >
    <svg class="w-12 h-12 text-[--color-surface-300] mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
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
    class="overflow-x-auto rounded-xl border border-[--color-surface-200] bg-[--color-surface-0] shadow-[var(--shadow-xs)]"
  >
    <table class="table-base">
      <thead>
        <slot name="head" />
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>
