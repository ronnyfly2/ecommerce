<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch } from 'vue'

defineOptions({
  inheritAttrs: false,
})

type SelectOption = {
  value: string | number
  label: string
  disabled?: boolean
}

const props = defineProps<{
  label?: string
  error?: string
  hint?: string
  required?: boolean
  options: SelectOption[]
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  emptySearchText?: string
  size?: 'sm' | 'md' | 'lg'
}>()

const model = defineModel<string | number | null | undefined>()
const attrs = useAttrs()
const fallbackId = `ui-select-${Math.random().toString(36).slice(2, 10)}`
const selectId = computed(() => String(attrs.id ?? fallbackId))
const errorId = computed(() => `${selectId.value}-error`)
const hintId = computed(() => `${selectId.value}-hint`)
const hasEmptyValue = computed(() => model.value === '' || model.value === null || model.value === undefined)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')
const activeIndex = ref(-1)
const listboxId = computed(() => `${selectId.value}-listbox`)
const activeOptionId = computed(() => activeIndex.value >= 0 ? `${selectId.value}-option-${activeIndex.value}` : undefined)
const describedBy = computed(() => {
  if (props.error) return errorId.value
  if (props.hint) return hintId.value
  return undefined
})
const selectedOption = computed(() => props.options.find((option) => String(option.value) === String(model.value ?? '')))
const filteredOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return props.options.filter((option) => {
    if (option.disabled) return false
    if (!query) return true
    return option.label.toLowerCase().includes(query)
  })
})
const controlSizeClass = computed(() => {
  if (props.size === 'sm') return 'min-h-9 py-1.5 text-sm'
  if (props.size === 'lg') return 'min-h-12 py-3 text-base'
  return 'min-h-10 py-2 text-sm'
})
const triggerText = computed(() => selectedOption.value?.label ?? props.placeholder ?? 'Seleccionar')

function syncActiveIndex() {
  if (filteredOptions.value.length === 0) {
    activeIndex.value = -1
    return
  }

  const selectedIndex = filteredOptions.value.findIndex((option) => String(option.value) === String(model.value ?? ''))
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : 0
}

async function openDropdown() {
  if (attrs.disabled !== undefined || attrs['aria-disabled'] === 'true') {
    return
  }

  isOpen.value = true
  searchQuery.value = ''
  syncActiveIndex()
  await nextTick()
  searchInputRef.value?.focus()
}

function closeDropdown(restoreFocus = false) {
  if (!isOpen.value) {
    return
  }

  isOpen.value = false
  searchQuery.value = ''
  activeIndex.value = -1

  if (restoreFocus) {
    void nextTick(() => {
      triggerRef.value?.focus()
    })
  }
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
    return
  }

  void openDropdown()
}

function selectOption(option: SelectOption) {
  if (option.disabled) {
    return
  }

  model.value = option.value
  closeDropdown(true)
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (!props.searchable) {
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void openDropdown()
  }
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDropdown(true)
    return
  }

  if (filteredOptions.value.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = activeIndex.value < filteredOptions.value.length - 1 ? activeIndex.value + 1 : 0
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value > 0 ? activeIndex.value - 1 : filteredOptions.value.length - 1
    return
  }

  if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    selectOption(filteredOptions.value[activeIndex.value])
  }
}

function handleDocumentPointerDown(event: MouseEvent) {
  if (!isOpen.value || !rootRef.value) {
    return
  }

  if (!rootRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

watch(filteredOptions, () => {
  if (props.searchable && isOpen.value) {
    syncActiveIndex()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
})

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('mousedown', handleDocumentPointerDown)
    return
  }

  document.removeEventListener('mousedown', handleDocumentPointerDown)
})
</script>

<template>
  <div ref="rootRef" class="flex flex-col gap-1">
    <label v-if="props.label" :for="selectId" class="text-sm font-medium text-surface-700">
      {{ props.label }}
      <span v-if="props.required" class="text-danger-500 ml-0.5" aria-hidden="true">*</span>
      <span v-if="props.required" class="sr-only"> (requerido)</span>
    </label>
    <div v-if="!props.searchable" class="relative">
      <select
        :id="selectId"
        v-model="model"
        v-bind="$attrs"
        :aria-describedby="describedBy"
        :aria-errormessage="props.error ? errorId : undefined"
        :aria-invalid="props.error ? 'true' : 'false'"
        :aria-required="props.required ? 'true' : undefined"
        :class="[
          'input-base appearance-none pr-10',
          controlSizeClass,
          hasEmptyValue ? 'text-surface-500' : '',
          props.error ? 'input-error' : '',
        ]"
      >
        <option v-if="props.placeholder" value="" :disabled="props.required">{{ props.placeholder }}</option>
        <option v-for="opt in props.options" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
          {{ opt.label }}
        </option>
      </select>
      <span class="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-surface-500" aria-hidden="true">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </div>
    <div v-else class="relative">
      <button
        :id="selectId"
        ref="triggerRef"
        type="button"
        v-bind="$attrs"
        :aria-describedby="describedBy"
        :aria-errormessage="props.error ? errorId : undefined"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-haspopup="'listbox'"
        :aria-controls="listboxId"
        :aria-invalid="props.error ? 'true' : 'false'"
        :aria-required="props.required ? 'true' : undefined"
        :class="[
          'input-base flex w-full items-center justify-between gap-3 text-left pr-10',
          controlSizeClass,
          hasEmptyValue ? 'text-surface-500' : '',
          props.error ? 'input-error' : '',
        ]"
        @click="toggleDropdown"
        @keydown="handleTriggerKeydown"
      >
        <span class="truncate">{{ triggerText }}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-surface-500" aria-hidden="true">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>

      <div v-if="isOpen" class="absolute z-30 mt-2 w-full rounded-xl border border-surface-200 bg-surface-0 p-2 shadow-lg">
        <input
          ref="searchInputRef"
          type="text"
          class="input-base mb-2"
          :class="controlSizeClass"
          role="combobox"
          :aria-controls="listboxId"
          :aria-expanded="'true'"
          :aria-activedescendant="activeOptionId"
          :placeholder="props.searchPlaceholder ?? 'Buscar opción...'"
          v-model="searchQuery"
          @keydown="handleSearchKeydown"
        />

        <div :id="listboxId" role="listbox" class="max-h-60 overflow-y-auto">
          <button
            v-for="(option, index) in filteredOptions"
            :id="`${selectId}-option-${index}`"
            :key="option.value"
            type="button"
            role="option"
            :aria-selected="String(option.value) === String(model ?? '') ? 'true' : 'false'"
            :class="[
              'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
              String(option.value) === String(model ?? '') ? 'bg-primary-50 text-primary-700' : 'text-surface-700',
              index === activeIndex ? 'bg-surface-100' : '',
            ]"
            @mouseenter="activeIndex = index"
            @click="selectOption(option)"
          >
            <span class="truncate">{{ option.label }}</span>
          </button>

          <p v-if="filteredOptions.length === 0" class="px-3 py-2 text-sm text-surface-500">
            {{ props.emptySearchText ?? 'No hay opciones que coincidan.' }}
          </p>
        </div>
      </div>
    </div>
    <p v-if="props.error" :id="errorId" class="text-xs text-danger-600" role="alert" aria-live="polite">{{ props.error }}</p>
    <p v-else-if="props.hint" :id="hintId" class="text-xs text-surface-500">{{ props.hint }}</p>
  </div>
</template>
