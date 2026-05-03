<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { colorsService } from '@/services/catalog.service'
import type { Color } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiColorInput from '@/components/ui/UiColorInput.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import CatalogAuditCells from '@/components/catalog/CatalogAuditCells.vue'
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
const tableEmpty = computed(() => !tableLoading.value && (colors.value?.length ?? 0) === 0)
const tableColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'hex', label: 'HEX' },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'createdAt', label: 'Creado', align: 'center' as const },
  { key: 'updatedAt', label: 'Actualizado', align: 'center' as const },
  { key: 'actions', actions: true },
]

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
      <UiTable :data="colors" :loading="tableLoading" :empty="tableEmpty" :columns="tableColumns" loading-color="primary" loading-text="Cargando colores..." empty-message="No hay colores">
        <template #empty-icon>
          <svg class="w-12 h-12 text-primary-800 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
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
