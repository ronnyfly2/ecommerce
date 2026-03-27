<script setup lang="ts">
import type { ToastType } from '@/stores/toast'

defineProps<{
  type: ToastType
  title: string
  message?: string
}>()

defineEmits<{ close: [] }>()

const icons: Record<ToastType, string> = {
  success: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
  error:   `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>`,
  warning: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>`,
  info:    `<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>`,
}

const colors: Record<ToastType, string> = {
  success: 'text-success-700 bg-success-50 border-success-200',
  error:   'text-danger-700  bg-danger-50  border-danger-200',
  warning: 'text-warning-800 bg-warning-50 border-warning-200',
  info:    'text-info-700    bg-info-50    border-info-200',
}

const iconColors: Record<ToastType, string> = {
  success: 'text-success-700',
  error:   'text-danger-700',
  warning: 'text-warning-800',
  info:    'text-info-700',
}
</script>

<template>
  <div
    :role="type === 'error' || type === 'warning' ? 'alert' : 'status'"
    :aria-live="type === 'error' || type === 'warning' ? 'assertive' : 'polite'"
    aria-atomic="true"
    :class="['flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full', colors[type]]"
  >
    <svg
      :class="['w-5 h-5 shrink-0 mt-0.5', iconColors[type]]"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      v-html="icons[type]"
    />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium">{{ title }}</p>
      <p v-if="message" class="text-xs mt-0.5 opacity-80">{{ message }}</p>
    </div>
    <button @click="$emit('close')" class="shrink-0 opacity-50 hover:opacity-100 transition-opacity" aria-label="Cerrar notificación">
      <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
