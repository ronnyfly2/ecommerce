<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { tagsService } from '@/services/catalog.service'
import type { Tag } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import CatalogAuditCells from '@/components/catalog/CatalogAuditCells.vue'
import CatalogActionsCell from '@/components/catalog/CatalogActionsCell.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useResourceList } from '@/composables/useResourceList'
import { useCrudForm } from '@/composables/useCrudForm'

const { items: tags, loading: tableLoading, load } = useResourceList<Tag>(
  () => tagsService.list(),
  'No se pudieron cargar los tags',
)
const tableEmpty = computed(() => !tableLoading.value && (tags.value?.length ?? 0) === 0)
const tableColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'slug', label: 'Slug' },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'createdAt', label: 'Creado', align: 'center' as const },
  { key: 'updatedAt', label: 'Actualizado', align: 'center' as const },
  { key: 'actions', actions: true },
]

const { formModal, confirm, openCreate, openEdit, save: saveTag, askDelete, confirmDelete: removeTag } = useCrudForm<
  Tag,
  { name: string; isActive: boolean }
>({
  service: tagsService,
  entityName: 'Tag',
  formDefaults: () => ({ name: '', isActive: true }),
  fillForm: (form, tag) => {
    form.name = tag.name
    form.isActive = tag.isActive
  },
  buildPayload: (form) => ({ name: form.name, isActive: form.isActive }),
  getDeleteName: (tag) => tag.name,
  onSuccess: load,
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nuevo tag</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="tags" :loading="tableLoading" :empty="tableEmpty" :columns="tableColumns" loading-color="primary" loading-text="Cargando tags..." empty-message="No hay tags">
        <template #empty-icon>
          <svg class="w-12 h-12 text-primary-800 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </template>

        <tr v-for="t in tags ?? []" :key="t.id" class="table-tr-hover">
          <td class="table-td font-medium">{{ t.name }}</td>
          <td class="table-td text-muted text-xs">{{ t.slug }}</td>
          <td class="table-td text-center">
            <UiBadge :color="t.isActive ? 'success' : 'neutral'" dot>
              {{ t.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <CatalogAuditCells :created-at="t.createdAt" :updated-at="t.updatedAt" />
          <CatalogActionsCell @edit="openEdit(t)" @delete="askDelete(t)" />
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear tag</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal
      :show="formModal.show"
      :title="formModal.isEdit ? 'Editar tag' : 'Nuevo tag'"
      @close="formModal.show = false"
    >
      <FormModalLayout :columns="1">
        <UiInput v-model="formModal.name" label="Nombre" size="lg" required placeholder="ej: Nuevo, Oferta, Destacado..." />
        <FormToggleField v-model="formModal.isActive" label="Activo" />
      </FormModalLayout>

      <template #footer>
        <FormModalActions :loading="formModal.loading" @cancel="formModal.show = false" @save="saveTag" />
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar tag"
      :message="`¿Eliminar el tag &quot;${confirm.name}&quot;?`"
      :loading="confirm.loading"
      @confirm="removeTag"
      @cancel="confirm.show = false"
    />
  </div>
</template>
