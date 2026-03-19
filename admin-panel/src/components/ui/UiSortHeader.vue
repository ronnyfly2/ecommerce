<script setup lang="ts">
const props = defineProps<{
  label: string
  active?: boolean
  direction?: 'asc' | 'desc'
}>()

const emit = defineEmits<{ toggle: [] }>()

function onToggle() {
  emit('toggle')
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 font-inherit text-inherit hover:text-[--color-surface-700] transition-colors"
    @click="onToggle"
  >
    <span>{{ label }}</span>
    <span class="inline-flex flex-col leading-none -space-y-0.5">
      <svg
        class="w-2.5 h-2.5"
        :class="active && direction === 'asc' ? 'text-[--color-primary-600]' : 'text-[--color-surface-300]'"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 5l-4 5h8l-4-5z" />
      </svg>
      <svg
        class="w-2.5 h-2.5"
        :class="active && direction === 'desc' ? 'text-[--color-primary-600]' : 'text-[--color-surface-300]'"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 15l4-5H6l4 5z" />
      </svg>
    </span>
  </button>
</template>
