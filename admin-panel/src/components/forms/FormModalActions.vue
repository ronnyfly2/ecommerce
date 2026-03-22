<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'

withDefaults(
  defineProps<{
    loading?: boolean
    saveDisabled?: boolean
    cancelLabel?: string
    saveLabel?: string
    cancelVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    saveVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  }>(),
  {
    loading: false,
    saveDisabled: false,
    cancelLabel: 'Cancelar',
    saveLabel: 'Guardar',
    cancelVariant: 'secondary',
    saveVariant: 'primary',
  },
)

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'save'): void
}>()
</script>

<template>
  <UiButton :variant="cancelVariant" @click="emit('cancel')">{{ cancelLabel }}</UiButton>
  <UiButton :variant="saveVariant" :loading="loading" :disabled="saveDisabled" @click="emit('save')">{{ saveLabel }}</UiButton>
</template>
