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
  rows?: number
  size?: 'sm' | 'md' | 'lg'
}>()

const model = defineModel<string>()
const attrs = useAttrs()
const fallbackId = `ui-textarea-${Math.random().toString(36).slice(2, 10)}`
const textareaId = computed(() => String(attrs.id ?? fallbackId))
const errorId = computed(() => `${textareaId.value}-error`)
const hintId = computed(() => `${textareaId.value}-hint`)
const describedBy = computed(() => {
  if (props.error) return errorId.value
  if (props.hint) return hintId.value
  return undefined
})
const controlSizeClass = computed(() => {
  if (props.size === 'sm') return 'py-1.5 text-sm'
  if (props.size === 'lg') return 'py-3 text-base'
  return 'py-2 text-sm'
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="props.label" :for="textareaId" class="text-sm font-medium text-surface-700">
      {{ props.label }}
      <span v-if="props.required" class="text-danger-500 ml-0.5" aria-hidden="true">*</span>
      <span v-if="props.required" class="sr-only"> (requerido)</span>
    </label>
    <textarea
      :id="textareaId"
      v-model="model"
      v-bind="$attrs"
      :aria-describedby="describedBy"
      :aria-errormessage="props.error ? errorId : undefined"
      :aria-invalid="props.error ? 'true' : 'false'"
      :aria-required="props.required ? 'true' : undefined"
      :rows="props.rows ?? 3"
      :class="['input-base resize-y', controlSizeClass, props.error ? 'input-error' : '']"
    />
    <p v-if="props.error" :id="errorId" class="text-xs text-danger-600" role="alert" aria-live="polite">{{ props.error }}</p>
    <p v-else-if="props.hint" :id="hintId" class="text-xs text-surface-500">{{ props.hint }}</p>
  </div>
</template>
