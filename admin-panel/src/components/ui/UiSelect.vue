<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineProps<{
  label?: string
  error?: string
  hint?: string
  required?: boolean
  options: { value: string | number; label: string }[]
  placeholder?: string
}>()

const model = defineModel<string | number>()
const attrs = useAttrs()
const fallbackId = `ui-select-${Math.random().toString(36).slice(2, 10)}`
const selectId = computed(() => String(attrs.id ?? fallbackId))
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="selectId" class="text-sm font-medium text-[--color-surface-700]">
      {{ label }}
      <span v-if="required" class="text-[--color-danger-500] ml-0.5">*</span>
    </label>
    <select
      :id="selectId"
      v-model="model"
      v-bind="$attrs"
      :class="['input-base pr-9', error ? 'input-error' : '']"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <p v-if="error" class="text-xs text-[--color-danger-600]">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-[--color-surface-500]">{{ hint }}</p>
  </div>
</template>
