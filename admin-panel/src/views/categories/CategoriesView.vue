<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { categoriesService } from '@/services/catalog.service'
import { extractErrorMessage } from '@/utils/error'
import type { Category } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
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
import type { CategoryAttributeDefinition } from '@/types/api'
import { suggestMeasurementUnits } from '@/utils/measurement-units'

const toast = useToast()
const categories = ref<Category[] | null>(null)
const tableLoading = computed(() => categories.value === null)

type CategoryAttributeDraft = Omit<CategoryAttributeDefinition, 'unit' | 'helpText'> & {
  unit: string
  helpText: string
  optionsText: string
}

const attributeTypeOptions = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'select', label: 'Selección' },
]

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  name: '',
  description: '',
  image: '',
  displayOrder: 0,
  parentId: '' as string | '',
  isActive: true,
  supportsSizeColorVariants: true,
  supportsDimensions: false,
  supportsWeight: false,
  attributeDefinitions: [] as CategoryAttributeDraft[],
})

const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  categories.value = null
  try {
    categories.value = await categoriesService.list()
  } catch {
    categories.value = []
    toast.error('Error', 'No se pudieron cargar las categorías')
  }
}

function resetForm() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.name = ''
  formModal.description = ''
  formModal.image = ''
  formModal.displayOrder = 0
  formModal.parentId = ''
  formModal.isActive = true
  formModal.supportsSizeColorVariants = true
  formModal.supportsDimensions = false
  formModal.supportsWeight = false
  formModal.attributeDefinitions = []
}

function openCreate() {
  resetForm()
  formModal.show = true
}

function openEdit(category: Category) {
  formModal.isEdit = true
  formModal.id = category.id
  formModal.name = category.name
  formModal.description = category.description ?? ''
  formModal.image = category.image ?? ''
  formModal.displayOrder = category.displayOrder
  formModal.parentId = category.parent?.id ?? ''
  formModal.isActive = category.isActive
  formModal.supportsSizeColorVariants = category.supportsSizeColorVariants
  formModal.supportsDimensions = category.supportsDimensions
  formModal.supportsWeight = category.supportsWeight
  formModal.attributeDefinitions = (category.attributeDefinitions ?? []).map(mapAttributeDefinitionToDraft)
  formModal.show = true
}

function mapAttributeDefinitionToDraft(definition: CategoryAttributeDefinition): CategoryAttributeDraft {
  return {
    ...definition,
    unit: definition.unit ?? '',
    helpText: definition.helpText ?? '',
    optionsText: definition.options.join(', '),
  }
}

function addAttributeDefinition() {
  formModal.attributeDefinitions.push({
    key: '',
    label: '',
    type: 'text',
      unit: '',
    required: false,
    options: [],
    optionsText: '',
      helpText: '',
    displayOrder: formModal.attributeDefinitions.length,
    isActive: true,
  })
}

function removeAttributeDefinition(index: number) {
  formModal.attributeDefinitions.splice(index, 1)
  formModal.attributeDefinitions.forEach((definition, position) => {
    definition.displayOrder = position
  })
}

function suggestedUnits(definition: CategoryAttributeDraft) {
  return suggestMeasurementUnits(definition)
}

async function saveCategory() {
  formModal.loading = true
  try {
    const payload = {
      name: formModal.name,
      description: formModal.description || undefined,
      image: formModal.image || undefined,
      displayOrder: Number(formModal.displayOrder),
      parentId: formModal.parentId || undefined,
      isActive: formModal.isActive,
      supportsSizeColorVariants: formModal.supportsSizeColorVariants,
      supportsDimensions: formModal.supportsDimensions,
      supportsWeight: formModal.supportsWeight,
      attributeDefinitions: formModal.attributeDefinitions.map((definition, index) => ({
        key: definition.key.trim() || definition.label,
        label: definition.label.trim(),
        type: definition.type,
        unit: definition.unit.trim() || null,
        required: definition.required,
        options: definition.type === 'select'
          ? definition.optionsText.split(',').map((option) => option.trim()).filter(Boolean)
          : [],
        helpText: definition.helpText.trim() || null,
        displayOrder: index,
        isActive: definition.isActive,
      })),
    }

    if (formModal.isEdit) {
      await categoriesService.update(formModal.id, payload)
      toast.success('Categoría actualizada')
    } else {
      await categoriesService.create(payload)
      toast.success('Categoría creada')
    }

    formModal.show = false
    await load()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo guardar'))
  } finally {
    formModal.loading = false
  }
}

function askDelete(category: Category) {
  confirm.id = category.id
  confirm.name = category.name
  confirm.show = true
}

async function removeCategory() {
  confirm.loading = true
  try {
    await categoriesService.remove(confirm.id)
    toast.success('Categoría eliminada')
    confirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar la categoría')
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
        <UiButton @click="openCreate">Nueva categoría</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="categories" :loading="tableLoading" loading-color="primary" loading-text="Cargando categorías..." empty-message="No hay categorías">
        <template #head>
          <tr>
            <th class="table-th">Nombre</th>
            <th class="table-th">Padre</th>
            <th class="table-th">Capacidades</th>
            <th class="table-th text-center">Orden</th>
            <th class="table-th text-center">Estado</th>
            <CatalogAuditHead />
            <CatalogActionsHead />
          </tr>
        </template>

        <tr v-for="c in categories ?? []" :key="c.id" class="table-tr-hover">
          <td class="table-td">
            <div class="font-medium">{{ c.name }}</div>
            <div class="text-xs text-muted">{{ c.slug }}</div>
          </td>
          <td class="table-td">{{ c.parent?.name ?? '—' }}</td>
          <td class="table-td">
            <div class="flex flex-wrap gap-1">
              <UiBadge v-if="c.supportsSizeColorVariants" color="info">Talla/Color</UiBadge>
              <UiBadge v-if="c.supportsDimensions" color="primary">Medidas</UiBadge>
              <UiBadge v-if="c.supportsWeight" color="warning">Peso</UiBadge>
              <UiBadge v-if="c.attributeDefinitions?.length" color="neutral">{{ c.attributeDefinitions.length }} atributo(s)</UiBadge>
              <span v-if="!c.supportsSizeColorVariants && !c.supportsDimensions && !c.supportsWeight" class="text-xs text-muted">Genérico</span>
            </div>
          </td>
          <td class="table-td text-center">{{ c.displayOrder }}</td>
          <td class="table-td text-center">
            <UiBadge :color="c.isActive ? 'success' : 'neutral'" dot>{{ c.isActive ? 'Activa' : 'Inactiva' }}</UiBadge>
          </td>
          <CatalogAuditCells :created-at="c.createdAt" :updated-at="c.updatedAt" />
          <CatalogActionsCell @edit="openEdit(c)" @delete="askDelete(c)" />
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear categoría</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar categoría' : 'Nueva categoría'" @close="formModal.show = false">
      <FormModalLayout>
        <UiInput v-model="formModal.name" label="Nombre" size="lg" required class="md:col-span-2" />
        <UiInput v-model="formModal.image" label="Imagen (URL)" size="lg" class="md:col-span-2" />
        <UiInput v-model="formModal.displayOrder" type="number" size="lg" min="0" label="Orden de visualización" />
        <div class="flex items-center pt-7">
          <FormToggleField v-model="formModal.isActive" label="Activa" />
        </div>
        <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormToggleField v-model="formModal.supportsSizeColorVariants" label="Usa talla/color" variant="card" size="lg" />
          <FormToggleField v-model="formModal.supportsDimensions" label="Usa medidas" variant="card" size="lg" />
          <FormToggleField v-model="formModal.supportsWeight" label="Usa peso" variant="card" size="lg" />
        </div>
        <div class="md:col-span-2">
          <UiInput
            v-model="formModal.parentId"
            label="ID categoría padre (opcional)"
            size="lg"
            placeholder="UUID"
            hint="Opcional: define jerarquía"
          />
        </div>
        <div class="md:col-span-2">
          <UiTextarea v-model="formModal.description" label="Descripción" size="lg" :rows="3" />
        </div>
        <div class="md:col-span-2 space-y-4 rounded-2xl border border-surface-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-surface-900">Atributos dinámicos del rubro</p>
              <p class="text-xs text-muted">Definen campos flexibles para los productos de esta categoría.</p>
            </div>
            <UiButton type="button" variant="secondary" size="sm" @click="addAttributeDefinition">Agregar atributo</UiButton>
          </div>

          <div v-if="!formModal.attributeDefinitions.length" class="rounded-xl border border-dashed border-surface-300 px-4 py-5 text-sm text-muted">
            Esta categoría no tiene atributos dinámicos.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="(definition, index) in formModal.attributeDefinitions"
              :key="`${definition.key || definition.label || 'attribute'}-${index}`"
              class="grid grid-cols-1 gap-3 rounded-2xl border border-surface-200 p-4 md:grid-cols-2"
            >
              <UiInput v-model="definition.label" label="Etiqueta" size="lg" placeholder="Ej. Material" />
              <UiInput v-model="definition.key" label="Clave técnica" size="lg" placeholder="Ej. material" hint="Si lo dejas vacío se genera desde la etiqueta" />
              <UiSelect v-model="definition.type" label="Tipo" size="lg" :options="attributeTypeOptions" />
              <UiInput v-model="definition.unit" label="Unidad" size="lg" placeholder="Ej. kg, cm, L, ml, m2" />
              <UiTextarea v-model="definition.helpText" label="Ayuda interna" size="lg" :rows="2" class="md:col-span-2" />
              <div v-if="definition.type === 'number'" class="md:col-span-2 space-y-2">
                <p class="text-xs text-surface-500">Sugerencias de unidad</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="unit in suggestedUnits(definition)"
                    :key="`${definition.key || definition.label || 'attribute'}-${unit.value}`"
                    type="button"
                    class="rounded-full border px-2.5 py-1 text-xs transition"
                    :class="definition.unit === unit.value
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-surface-300 text-surface-700 hover:border-primary-400 hover:text-primary-700'"
                    @click="definition.unit = unit.value"
                  >
                    {{ unit.value }}
                  </button>
                </div>
              </div>
              <UiInput
                v-if="definition.type === 'select'"
                v-model="definition.optionsText"
                label="Opciones"
                size="lg"
                placeholder="Ej. Acero, Plástico, Madera"
                hint="Separa cada opción con coma"
                class="md:col-span-2"
              />
              <div class="flex flex-wrap items-center gap-3 md:col-span-2">
                <FormToggleField v-model="definition.required" label="Obligatorio" variant="card" size="sm" />
                <FormToggleField v-model="definition.isActive" label="Activo" variant="card" size="sm" />
                <UiButton type="button" variant="danger" size="sm" @click="removeAttributeDefinition(index)">Quitar</UiButton>
              </div>
            </div>
          </div>
        </div>
      </FormModalLayout>

      <template #footer>
        <FormModalActions :loading="formModal.loading" @cancel="formModal.show = false" @save="saveCategory" />
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar categoría"
      :message="`¿Eliminar ${confirm.name}?`"
      :loading="confirm.loading"
      @confirm="removeCategory"
      @cancel="confirm.show = false"
    />
  </div>
</template>
