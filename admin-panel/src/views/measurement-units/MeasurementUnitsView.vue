<script setup lang="ts">
import { onMounted } from 'vue'
import { measurementUnitsService } from '@/services/catalog.service'
import type { MeasurementUnit, MeasurementUnitFamily } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
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

const familyLabels: Record<MeasurementUnitFamily, string> = {
  weight: 'Peso',
  length: 'Longitud',
  volume: 'Volumen',
  area: 'Area',
  count: 'Conteo',
  temperature: 'Temperatura',
  time: 'Tiempo',
}

const familyOptions = (Object.keys(familyLabels) as MeasurementUnitFamily[]).map((family) => ({
  value: family,
  label: familyLabels[family],
}))

const { items: measurementUnits, loading: tableLoading, load } = useResourceList<MeasurementUnit>(
  async () => {
    const data = await measurementUnitsService.list()
    return [...data].sort((a, b) => {
      if (a.family !== b.family) return a.family.localeCompare(b.family, 'es')
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
      return a.label.localeCompare(b.label, 'es')
    })
  },
  'No se pudieron cargar los tipos de medida',
)

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

type MeasurementUnitForm = { code: string; label: string; family: MeasurementUnitFamily; displayOrder: number; isActive: boolean }

const {
  formModal,
  confirm,
  openCreate,
  openEdit,
  save: saveMeasurementUnit,
  askDelete,
  confirmDelete: removeMeasurementUnit,
} = useCrudForm<MeasurementUnit, MeasurementUnitForm>({
  service: measurementUnitsService,
  entityName: 'Tipo de medida',
  formDefaults: () => ({ code: '', label: '', family: 'weight' as MeasurementUnitFamily, displayOrder: 0, isActive: true }),
  fillForm: (form, unit) => {
    form.code = unit.code
    form.label = unit.label
    form.family = unit.family
    form.displayOrder = Number(unit.displayOrder ?? 0)
    form.isActive = unit.isActive
  },
  buildPayload: (form) => ({
    code: normalizeCode(form.code),
    label: form.label.trim(),
    family: form.family,
    displayOrder: Number(form.displayOrder),
    isActive: form.isActive,
  }),
  getDeleteName: (unit) => unit.label,
  onSuccess: load,
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #actions>
        <UiButton @click="openCreate">Nuevo tipo de medida</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable
        :data="measurementUnits"
        :loading="tableLoading"
        loading-color="primary"
        loading-text="Cargando tipos de medida..."
        empty-message="No hay tipos de medida"
      >
        <template #head>
          <tr>
            <th class="table-th">Codigo</th>
            <th class="table-th">Etiqueta</th>
            <th class="table-th">Familia</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th text-center">Orden</th>
            <CatalogAuditHead />
            <CatalogActionsHead />
          </tr>
        </template>

        <tr v-for="unit in measurementUnits ?? []" :key="unit.id" class="table-tr-hover">
          <td class="table-td font-mono text-xs">{{ unit.code }}</td>
          <td class="table-td font-medium">{{ unit.label }}</td>
          <td class="table-td">
            <UiBadge color="neutral">{{ familyLabels[unit.family] }}</UiBadge>
          </td>
          <td class="table-td text-center">
            <UiBadge :color="unit.isActive ? 'success' : 'neutral'" dot>
              {{ unit.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <td class="table-td text-center">{{ unit.displayOrder }}</td>
          <CatalogAuditCells :created-at="unit.createdAt" :updated-at="unit.updatedAt" />
          <CatalogActionsCell @edit="openEdit(unit)" @delete="askDelete(unit)" />
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear tipo de medida</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal
      :show="formModal.show"
      :title="formModal.isEdit ? 'Editar tipo de medida' : 'Nuevo tipo de medida'"
      @close="formModal.show = false"
    >
      <FormModalLayout>
        <UiInput
          :model-value="formModal.code"
          label="Codigo"
          size="lg"
          required
          placeholder="kg"
          hint="Se guarda en minusculas y sin espacios"
          @update:model-value="(value) => formModal.code = normalizeCode(String(value ?? ''))"
        />
        <UiInput
          v-model="formModal.label"
          label="Etiqueta"
          size="lg"
          required
          placeholder="Kilogramos"
        />
        <UiSelect
          v-model="formModal.family"
          label="Familia"
          size="lg"
          :options="familyOptions"
        />
        <UiInput
          v-model="formModal.displayOrder"
          type="number"
          min="0"
          label="Orden de visualizacion"
          size="lg"
        />
        <div class="md:col-span-2">
          <FormToggleField v-model="formModal.isActive" label="Activo" />
        </div>
      </FormModalLayout>

      <template #footer>
        <FormModalActions
          :loading="formModal.loading"
          :save-disabled="!formModal.code.trim() || !formModal.label.trim()"
          @cancel="formModal.show = false"
          @save="saveMeasurementUnit"
        />
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar tipo de medida"
      :message="`¿Eliminar ${confirm.name}?`"
      :loading="confirm.loading"
      @confirm="removeMeasurementUnit"
      @cancel="confirm.show = false"
    />
  </div>
</template>
