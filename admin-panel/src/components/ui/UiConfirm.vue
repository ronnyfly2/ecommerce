<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps<{
  show: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const titleId = `ui-confirm-title-${Math.random().toString(36).slice(2, 10)}`
const descriptionId = `ui-confirm-description-${Math.random().toString(36).slice(2, 10)}`
const panelRef = ref<HTMLElement | null>(null)

useDialogA11y(computed(() => props.show), panelRef, () => emit('cancel'))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="props.show"
        class="fixed inset-0 flex items-center justify-center p-4"
        style="z-index: var(--z-modal)"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" @click="$emit('cancel')" />
        <div
          ref="panelRef"
          class="relative card w-full max-w-sm p-6"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
          tabindex="-1"
        >
          <div class="flex items-start gap-4">
            <div
              :class="[
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                props.variant === 'warning'
                  ? 'bg-warning-100 text-warning-800'
                  : 'bg-danger-100  text-danger-700',
              ]"
            >
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 :id="titleId" class="text-heading-3 mb-1">{{ props.title ?? '¿Estás seguro?' }}</h3>
              <p :id="descriptionId" class="text-muted">{{ props.message ?? 'Esta acción no se puede deshacer.' }}</p>
            </div>
          </div>
          <div class="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
            <button class="btn-base btn-secondary w-full sm:w-auto" :disabled="props.loading" @click="$emit('cancel')">
              {{ props.cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              :class="['btn-base w-full sm:w-auto', props.variant === 'warning' ? 'btn-secondary' : 'btn-danger']"
              :disabled="props.loading"
              :aria-busy="props.loading ? 'true' : undefined"
              @click="$emit('confirm')"
            >
              <svg v-if="props.loading" class="w-4 h-4 animate-spin" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {{ props.confirmLabel ?? 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
