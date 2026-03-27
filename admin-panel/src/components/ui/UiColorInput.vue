<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  label?: string
  hint?: string
  size?: 'sm' | 'md' | 'lg'
}>()

const model = defineModel<string>()
const attrs = useAttrs()
const fallbackId = `ui-color-${Math.random().toString(36).slice(2, 10)}`
const inputId = computed(() => String(attrs.id ?? fallbackId))
const hintId = computed(() => `${inputId.value}-hint`)
const controlSizeClass = computed(() => {
  if (props.size === 'sm') return 'h-9 w-11'
  if (props.size === 'lg') return 'h-11 w-14'
  return 'h-10 w-12'
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="props.label" :for="inputId" class="text-sm font-medium text-surface-700">
      {{ props.label }}
    </label>
    <input
      :id="inputId"
      v-model="model"
      v-bind="$attrs"
      type="color"
      :aria-describedby="props.hint ? hintId : undefined"
      :class="['rounded-xl border border-surface-300 bg-surface-0 p-1', controlSizeClass]"
    />
    <p v-if="props.hint" :id="hintId" class="text-xs text-surface-500">{{ props.hint }}</p>
  </div>
</template>