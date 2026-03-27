<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'

const props = withDefaults(defineProps<{
  editLabel?: string
  deleteLabel?: string
  deleteVariant?: 'danger' | 'ghost' | 'secondary'
  disableDelete?: boolean
}>(), {
  editLabel: 'Editar',
  deleteLabel: 'Eliminar',
  deleteVariant: 'danger',
  disableDelete: false,
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
}>()
</script>

<template>
  <td class="table-td table-actions-td text-right">
    <div class="flex items-center gap-2 justify-end">
      <UiButton size="sm" variant="ghost" @click="emit('edit')">{{ props.editLabel }}</UiButton>
      <UiButton size="sm" :variant="props.deleteVariant" :disabled="props.disableDelete" @click="emit('delete')">
        {{ props.deleteLabel }}
      </UiButton>
    </div>
  </td>
</template>
