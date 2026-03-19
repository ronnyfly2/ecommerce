<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineProps<{
  label?: string
  error?: string
  hint?: string
  required?: boolean
  rows?: number
}>()

const model = defineModel<string>()
const attrs = useAttrs()
const fallbackId = `ui-textarea-${Math.random().toString(36).slice(2, 10)}`
const textareaId = computed(() => String(attrs.id ?? fallbackId))
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="textareaId" class="text-sm font-medium text-[--color-surface-700]">
      {{ label }}
      <span v-if="required" class="text-[--color-danger-500] ml-0.5">*</span>
    </label>
    <textarea
      :id="textareaId"
      v-model="model"
      v-bind="$attrs"
      :rows="rows ?? 3"
      :class="['input-base resize-y', error ? 'input-error' : '']"
    />
    <p v-if="error" class="text-xs text-[--color-danger-600]">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-[--color-surface-500]">{{ hint }}</p>
  </div>
</template>
