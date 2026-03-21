<script setup lang="ts">
defineProps<{
  show: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
}>()

defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 flex items-center justify-center p-4"
        style="z-index: var(--z-modal)"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('cancel')" />
        <div class="relative card w-full max-w-sm p-6">
          <div class="flex items-start gap-4">
            <div
              :class="[
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                variant === 'warning'
                  ? 'bg-[--color-warning-100] text-[--color-warning-600]'
                  : 'bg-[--color-danger-100]  text-[--color-danger-600]',
              ]"
            >
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 class="text-heading-3 mb-1">{{ title ?? '¿Estás seguro?' }}</h3>
              <p class="text-muted">{{ message ?? 'Esta acción no se puede deshacer.' }}</p>
            </div>
          </div>
          <div class="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
            <button class="btn-base btn-secondary w-full sm:w-auto" :disabled="loading" @click="$emit('cancel')">
              {{ cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              :class="['btn-base w-full sm:w-auto', variant === 'warning' ? 'btn-secondary' : 'btn-danger']"
              :disabled="loading"
              @click="$emit('confirm')"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {{ confirmLabel ?? 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
