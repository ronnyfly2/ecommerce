<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { tagsService } from '@/services/catalog.service'
import { extractErrorMessage } from '@/utils/error'
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
import { useToast } from '@/composables/useToast'

const toast = useToast()
const tags = ref<Tag[] | null>(null)
const tableLoading = computed(() => tags.value === null)

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  name: '',
  isActive: true,
})

const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  tags.value = null
  try {
    tags.value = await tagsService.list()
  } catch {
    tags.value = []
    toast.error('Error', 'No se pudieron cargar los tags')
  }
}

function openCreate() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.name = ''
  formModal.isActive = true
  formModal.show = true
}

function openEdit(tag: Tag) {
  formModal.isEdit = true
  formModal.id = tag.id
  formModal.name = tag.name
  formModal.isActive = tag.isActive
  formModal.show = true
}

async function saveTag() {
  formModal.loading = true
  try {
    if (formModal.isEdit) {
      await tagsService.update(formModal.id, { name: formModal.name, isActive: formModal.isActive })
      toast.success('Tag actualizado')
    } else {
      await tagsService.create({ name: formModal.name, isActive: formModal.isActive })
      toast.success('Tag creado')
    }
    formModal.show = false
    await load()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo guardar'))
  } finally {
    formModal.loading = false
  }
}

function askDelete(tag: Tag) {
  confirm.id = tag.id
  confirm.name = tag.name
  confirm.show = true
}

async function removeTag() {
  confirm.loading = true
  try {
    await tagsService.remove(confirm.id)
    toast.success('Tag eliminado')
    confirm.show = false
    await load()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo eliminar'))
  } finally {
    confirm.loading = false
  }
}

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
