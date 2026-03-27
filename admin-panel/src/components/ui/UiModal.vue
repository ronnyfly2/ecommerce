<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps<{
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{ close: [] }>()

const dialogTitleId = `ui-modal-title-${Math.random().toString(36).slice(2, 10)}`
const dialogBodyId = `ui-modal-body-${Math.random().toString(36).slice(2, 10)}`
const accessibleLabel = computed(() => props.title ?? 'Diálogo')
const panelRef = ref<HTMLElement | null>(null)

useDialogA11y(computed(() => props.show), panelRef, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 flex items-center justify-center p-4"
        style="z-index: var(--z-modal)"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="$emit('close')"
        />
        <!-- Panel -->
        <div
          ref="panelRef"
          :class="[
            'relative card w-full',
            props.size === 'sm' ? 'max-w-sm'  :
            props.size === 'lg' ? 'max-w-2xl' :
            props.size === 'xl' ? 'max-w-4xl' :
                            'max-w-lg',
          ]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="props.title || $slots.header ? dialogTitleId : undefined"
          :aria-label="props.title || $slots.header ? undefined : accessibleLabel"
          :aria-describedby="dialogBodyId"
          tabindex="-1"
        >
          <!-- Header -->
          <div v-if="props.title || $slots.header" class="flex items-center justify-between px-6 py-4 border-b border-surface-200">
            <slot name="header">
              <h2 :id="dialogTitleId" class="text-heading-3">{{ props.title }}</h2>
            </slot>
            <button
              class="btn-base btn-ghost btn-sm -mr-2"
              aria-label="Cerrar diálogo"
              @click="$emit('close')"
            >
              <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Body -->
          <div :id="dialogBodyId" class="p-6">
            <slot />
          </div>
          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 border-t border-surface-200 flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
