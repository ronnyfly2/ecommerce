<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import UiToast from './UiToast.vue'

const store = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-4 right-4 flex flex-col gap-2 z-[var(--z-toast)]"
      style="z-index: var(--z-toast)"
      role="region"
      aria-label="Notificaciones emergentes"
      aria-live="polite"
      aria-relevant="additions text"
    >
      <TransitionGroup name="slide-up">
        <UiToast
          v-for="t in store.toasts"
          :key="t.id"
          :type="t.type"
          :title="t.title"
          :message="t.message"
          @close="store.remove(t.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>
