<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  label?: string
  hint?: string
  required?: boolean
  accept?: string
  size?: 'sm' | 'md' | 'lg'
}>()

const attrs = useAttrs()
const fallbackId = `ui-file-${Math.random().toString(36).slice(2, 10)}`
const inputId = computed(() => String(attrs.id ?? fallbackId))
const hintId = computed(() => `${inputId.value}-hint`)
const controlSizeClass = computed(() => {
  if (props.size === 'sm') return 'min-h-9 py-1.5 text-sm'
  if (props.size === 'lg') return 'min-h-11 py-2.5 text-base'
  return 'min-h-10 py-2 text-sm'
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="props.label" :for="inputId" class="text-sm font-medium text-surface-700">
      {{ props.label }}
      <span v-if="props.required" class="text-danger-500 ml-0.5" aria-hidden="true">*</span>
      <span v-if="props.required" class="sr-only"> (requerido)</span>
    </label>
    <input
      :id="inputId"
      v-bind="$attrs"
      type="file"
      :accept="props.accept"
      :aria-describedby="props.hint ? hintId : undefined"
      :aria-required="props.required ? 'true' : undefined"
      :class="['input-base file:mr-3 file:rounded-lg file:border-0 file:bg-surface-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-surface-700 hover:file:bg-surface-200', controlSizeClass]"
    />
    <p v-if="props.hint" :id="hintId" class="text-xs text-surface-500">{{ props.hint }}</p>
  </div>
</template>