<script setup lang="ts">
defineProps<{
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

defineEmits<{ close: [] }>()
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
          @click="$emit('close')"
        />
        <!-- Panel -->
        <div
          :class="[
            'relative card w-full',
            size === 'sm' ? 'max-w-sm'  :
            size === 'lg' ? 'max-w-2xl' :
            size === 'xl' ? 'max-w-4xl' :
                            'max-w-lg',
          ]"
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="flex items-center justify-between px-6 py-4 border-b border-[--color-surface-200]">
            <slot name="header">
              <h2 class="text-heading-3">{{ title }}</h2>
            </slot>
            <button
              class="btn-base btn-ghost btn-sm -mr-2"
              @click="$emit('close')"
            >
              <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Body -->
          <div class="p-6">
            <slot />
          </div>
          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 py-4 border-t border-[--color-surface-200] flex items-center justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
