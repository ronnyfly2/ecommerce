<script setup lang="ts">
import { onMounted } from 'vue'
import { colorsService } from '@/services/catalog.service'
import type { Color } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiColorInput from '@/components/ui/UiColorInput.vue'
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
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import { useResourceList } from '@/composables/useResourceList'
import { useCrudForm } from '@/composables/useCrudForm'

const { items: colors, loading: tableLoading, load } = useResourceList<Color>(
  () => colorsService.list(),
  'No se pudieron cargar los colores',
)

const { formModal, confirm, openCreate, openEdit, save: saveColor, askDelete, confirmDelete: removeColor } = useCrudForm<
  Color,
  { name: string; hexCode: string; isActive: boolean }
>({
  service: colorsService,
  entityName: 'Color',
  formDefaults: () => ({ name: '', hexCode: '#000000', isActive: true }),
  fillForm: (form, color) => {
    form.name = color.name
    form.hexCode = color.hexCode
    form.isActive = color.isActive
  },
  buildPayload: (form) => ({ name: form.name, hexCode: form.hexCode, isActive: form.isActive }),
  getDeleteName: (color) => color.name,
  onSuccess: load,
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nuevo color</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="colors" :loading="tableLoading" loading-color="primary" loading-text="Cargando colores..." empty-message="No hay colores">
        <template #head>
          <tr>
            <th class="table-th">Nombre</th>
            <th class="table-th">HEX</th>
            <th class="table-th text-center">Estado</th>
            <CatalogAuditHead />
            <CatalogActionsHead />
          </tr>
        </template>

        <tr v-for="c in colors ?? []" :key="c.id" class="table-tr-hover">
          <td class="table-td">
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full border border-surface-300" :style="{ backgroundColor: c.hexCode }" />
              <span class="font-medium">{{ c.name }}</span>
            </div>
          </td>
          <td class="table-td font-mono text-xs">{{ c.hexCode }}</td>
          <td class="table-td text-center">
            <UiBadge :color="c.isActive ? 'success' : 'neutral'" dot>
              {{ c.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <CatalogAuditCells :created-at="c.createdAt" :updated-at="c.updatedAt" />
          <CatalogActionsCell @edit="openEdit(c)" @delete="askDelete(c)" />
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear color</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar color' : 'Nuevo color'" @close="formModal.show = false">
      <FormModalLayout>
        <UiInput v-model="formModal.name" label="Nombre" size="lg" required placeholder="Rojo" />
        <div class="flex items-end gap-3">
          <UiInput v-model="formModal.hexCode" label="HEX" size="lg" required placeholder="#FF0000" />
          <UiColorInput v-model="formModal.hexCode" label="Vista" size="lg" />
        </div>
        <div class="md:col-span-2">
          <FormToggleField v-model="formModal.isActive" label="Activo" />
        </div>
      </FormModalLayout>

      <template #footer>
        <FormModalActions :loading="formModal.loading" @cancel="formModal.show = false" @save="saveColor" />
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar color"
      :message="`¿Eliminar ${confirm.name}?`"
      :loading="confirm.loading"
      @confirm="removeColor"
      @cancel="confirm.show = false"
    />
  </div>
</template>
