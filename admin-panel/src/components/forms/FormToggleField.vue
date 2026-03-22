<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label: string
    description?: string
    disabled?: boolean
  }>(),
  {
    description: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <label class="flex items-center gap-2 text-sm text-[--color-surface-700]" :class="{ 'opacity-60 cursor-not-allowed': disabled }">
    <input
      :checked="props.modelValue"
      type="checkbox"
      class="accent-[--color-primary-600]"
      :disabled="disabled"
      @change="onChange"
    />
    <span>{{ label }}</span>
    <span v-if="description" class="text-xs text-[--color-surface-500]">{{ description }}</span>
  </label>
</template>
