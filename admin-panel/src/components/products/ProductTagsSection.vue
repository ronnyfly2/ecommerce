<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import type { Tag } from '@/types/api'

defineProps<{
  tags: Tag[]
  selectedTagIds: string[]
  newTagName: string
  creatingTag: boolean
  toggleTag: (tagId: string) => void
  createTagInline: () => Promise<void>
}>()

defineEmits<{
  'update:newTagName': [value: string]
}>()
</script>

<template>
  <div class="lg:col-span-2 space-y-2">
    <p class="text-sm font-medium text-surface-700">Etiquetas (tags)</p>

    <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
      <UiInput
        :model-value="newTagName"
        placeholder="Crear nueva etiqueta..."
        hint="Presiona Enter o haz click en Crear"
        @update:model-value="$emit('update:newTagName', String($event ?? ''))"
        @keyup.enter="createTagInline"
      />
      <UiButton
        size="sm"
        :loading="creatingTag"
        :disabled="!newTagName.trim()"
        @click="createTagInline"
      >
        Crear tag
      </UiButton>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="px-3 py-1.5 rounded-full border text-sm transition-colors"
        :class="selectedTagIds.includes(tag.id)
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-surface-0 text-surface-700 border-surface-300 hover:border-primary-400'"
        @click="toggleTag(tag.id)"
      >
        {{ tag.name }}
      </button>
      <span v-if="!tags.length" class="text-xs text-surface-500">No hay tags activos disponibles</span>
    </div>
  </div>
</template>