<script setup lang="ts">
import { onMounted } from 'vue'
import { tagsService } from '@/services/catalog.service'
import type { Tag } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import CatalogAuditHead from '@/components/catalog/CatalogAuditHead.vue'
import CatalogAuditCells from '@/components/catalog/CatalogAuditCells.vue'
import CatalogActionsHead from '@/components/catalog/CatalogActionsHead.vue'
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
      <UiTable :data="tags" :loading="tableLoading" loading-color="primary" loading-text="Cargando tags..." empty-message="No hay tags">
        <template #head>
          <tr>
            <th class="table-th">Nombre</th>
            <th class="table-th">Slug</th>
            <th class="table-th text-center">Estado</th>
            <CatalogAuditHead />
            <CatalogActionsHead />
          </tr>
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
