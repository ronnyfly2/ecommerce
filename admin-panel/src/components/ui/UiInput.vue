<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineProps<{
  label?: string
  error?: string
  hint?: string
  required?: boolean
}>()

const model = defineModel<string | number>()
const attrs = useAttrs()
const fallbackId = `ui-input-${Math.random().toString(36).slice(2, 10)}`
const inputId = computed(() => String(attrs.id ?? fallbackId))
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-[--color-surface-700]">
      {{ label }}
      <span v-if="required" class="text-[--color-danger-500] ml-0.5">*</span>
    </label>
    <input
      :id="inputId"
      v-model="model"
      v-bind="$attrs"
      :class="['input-base', error ? 'input-error' : '']"
    />
    <p v-if="error" class="text-xs text-[--color-danger-600]">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-[--color-surface-500]">{{ hint }}</p>
  </div>
</template>
