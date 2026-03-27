<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  totalPages: number
  total?: number
  limit?: number
}>()

const emit = defineEmits<{ change: [page: number] }>()

const pages = computed(() => {
  const total = props.totalPages
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const cur = props.page
  if (cur <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (cur >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', cur - 1, cur, cur + 1, '...', total]
})
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <p v-if="total !== undefined" class="text-muted text-sm">
      {{ total }} resultado{{ total !== 1 ? 's' : '' }}
    </p>
    <nav class="flex items-center gap-1 ml-auto" aria-label="Paginación">
      <button
        class="btn-base btn-ghost btn-sm disabled:!opacity-100 disabled:!text-surface-700"
        :disabled="page <= 1"
        aria-label="Página anterior"
        @click="emit('change', page - 1)"
      >
        <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        <span class="sr-only">Página anterior</span>
      </button>

      <template v-for="p in pages" :key="p">
        <span v-if="p === '...'" class="px-2 text-muted">…</span>
        <button
          v-else
          :aria-label="`Ir a la página ${p}`"
          :aria-current="p === page ? 'page' : undefined"
          :class="[
            'btn-base btn-sm min-w-[32px]',
            p === page ? 'btn-primary' : 'btn-ghost',
          ]"
          @click="emit('change', Number(p))"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="btn-base btn-ghost btn-sm disabled:!opacity-100 disabled:!text-surface-700"
        :disabled="page >= totalPages"
        aria-label="Página siguiente"
        @click="emit('change', page + 1)"
      >
        <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span class="sr-only">Página siguiente</span>
      </button>
    </nav>
  </div>
</template>
