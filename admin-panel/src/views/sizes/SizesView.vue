<script setup lang="ts">
import { onMounted } from 'vue'
import { sizesService } from '@/services/catalog.service'
import type { Size } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import CatalogAuditHead from '@/components/catalog/CatalogAuditHead.vue'
import CatalogAuditCells from '@/components/catalog/CatalogAuditCells.vue'
import CatalogActionsHead from '@/components/catalog/CatalogActionsHead.vue'
import CatalogActionsCell from '@/components/catalog/CatalogActionsCell.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useResourceList } from '@/composables/useResourceList'
import { useCrudForm } from '@/composables/useCrudForm'

const { items: sizes, loading: tableLoading, load } = useResourceList<Size>(
  () => sizesService.list(),
  'No se pudieron cargar las tallas',
)

function normalizedAbbreviation(value: string) {
  return value.trim().toUpperCase()
}

const { formModal, confirm, openCreate, openEdit, save: saveSize, askDelete, confirmDelete: removeSize } = useCrudForm<
  Size,
  { name: string; abbreviation: string; displayOrder: number }
>({
  service: sizesService,
  entityName: 'Talla',
  formDefaults: () => ({ name: '', abbreviation: '', displayOrder: 0 }),
  fillForm: (form, size) => {
    form.name = size.name
    form.abbreviation = size.abbreviation
    form.displayOrder = Number(size.displayOrder ?? 0)
  },
  buildPayload: (form) => ({
    name: form.name.trim(),
    abbreviation: normalizedAbbreviation(form.abbreviation),
    displayOrder: Number(form.displayOrder),
  }),
  getDeleteName: (size) => size.name,
  onSuccess: load,
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nueva talla</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="sizes" :loading="tableLoading" loading-color="primary" loading-text="Cargando tallas..." empty-message="No hay tallas">
        <template #head>
          <tr>
            <th class="table-th">Nombre</th>
            <th class="table-th">Prefijo</th>
            <th class="table-th text-center">Orden</th>
            <CatalogAuditHead />
            <CatalogActionsHead />
          </tr>
        </template>

        <tr v-for="s in sizes ?? []" :key="s.id" class="table-tr-hover">
          <td class="table-td">
            <span class="font-medium text-surface-900">{{ s.name }}</span>
          </td>
          <td class="table-td font-mono text-xs">{{ s.abbreviation }}</td>
          <td class="table-td text-center">{{ s.displayOrder }}</td>
          <CatalogAuditCells :created-at="s.createdAt" :updated-at="s.updatedAt" />
          <CatalogActionsCell @edit="openEdit(s)" @delete="askDelete(s)" />
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear talla</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar talla' : 'Nueva talla'" @close="formModal.show = false">
      <FormModalLayout :columns="1">
        <UiInput v-model="formModal.name" label="Nombre" size="lg" required placeholder="Large, Medium, Small..." />
        <UiInput
          :model-value="formModal.abbreviation"
          label="Prefijo / abreviatura"
          size="lg"
          required
          placeholder="L, M, S..."
          hint="Ejemplo: Large = L, Medium = M"
          @update:model-value="(value) => formModal.abbreviation = normalizedAbbreviation(String(value ?? ''))"
        />
        <UiInput
          v-model="formModal.displayOrder"
          type="number"
          min="0"
          label="Orden de visualización"
          size="lg"
        />
      </FormModalLayout>
      <template #footer>
        <FormModalActions
          :loading="formModal.loading"
          :save-disabled="!formModal.name.trim() || !formModal.abbreviation.trim()"
          @cancel="formModal.show = false"
          @save="saveSize"
        />
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar talla"
      :message="`¿Eliminar ${confirm.name}?`"
      :loading="confirm.loading"
      @confirm="removeSize"
      @cancel="confirm.show = false"
    />
  </div>
</template>
