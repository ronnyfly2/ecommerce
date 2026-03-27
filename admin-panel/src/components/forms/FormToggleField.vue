<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label: string
    description?: string
    disabled?: boolean
    variant?: 'inline' | 'card'
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    description: '',
    disabled: false,
    variant: 'inline',
    size: 'md',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}

const rootClass = computed(() => {
  const sizeClass = props.size === 'sm'
    ? 'gap-2 px-3 py-2 text-sm'
    : props.size === 'lg'
      ? 'gap-3 px-4 py-3 text-sm'
      : 'gap-2 px-3 py-2.5 text-sm'

  if (props.variant === 'card') {
    return `rounded-xl border border-surface-200 bg-surface-50 ${sizeClass}`
  }

  return sizeClass
})
</script>

<template>
  <label class="flex items-center text-surface-700" :class="[rootClass, { 'opacity-60 cursor-not-allowed': disabled }]">
    <input
      :checked="props.modelValue"
      type="checkbox"
      class="accent-primary-600"
      :disabled="disabled"
      @change="onChange"
    />
    <span>{{ label }}</span>
    <span v-if="description" class="text-xs text-surface-500">{{ description }}</span>
  </label>
</template>
