<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  label?: string
  error?: string
  hint?: string
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()

const model = defineModel<string | number>()
const attrs = useAttrs()
const fallbackId = `ui-input-${Math.random().toString(36).slice(2, 10)}`
const inputId = computed(() => String(attrs.id ?? fallbackId))
const errorId = computed(() => `${inputId.value}-error`)
const hintId = computed(() => `${inputId.value}-hint`)
const describedBy = computed(() => {
  if (props.error) return errorId.value
  if (props.hint) return hintId.value
  return undefined
})
const controlSizeClass = computed(() => {
  if (props.size === 'sm') return 'min-h-9 py-1.5 text-sm'
  if (props.size === 'lg') return 'min-h-12 py-3 text-base'
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
      v-model="model"
      v-bind="$attrs"
      :aria-describedby="describedBy"
      :aria-errormessage="props.error ? errorId : undefined"
      :aria-invalid="props.error ? 'true' : 'false'"
      :aria-required="props.required ? 'true' : undefined"
      :class="['input-base', controlSizeClass, props.error ? 'input-error' : '']"
    />
    <p v-if="props.error" :id="errorId" class="text-xs text-danger-600" role="alert" aria-live="polite">{{ props.error }}</p>
    <p v-else-if="props.hint" :id="hintId" class="text-xs text-surface-500">{{ props.hint }}</p>
  </div>
</template>
