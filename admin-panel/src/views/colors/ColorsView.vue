<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
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
import { useToast } from '@/composables/useToast'

const toast = useToast()
const colors = ref<Color[] | null>(null)
const tableLoading = computed(() => colors.value === null)

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  name: '',
  hexCode: '#000000',
  isActive: true,
})
const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  colors.value = null
  try {
    colors.value = await colorsService.list()
  } catch {
    colors.value = []
    toast.error('Error', 'No se pudieron cargar los colores')
  }
}

function openCreate() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.name = ''
  formModal.hexCode = '#000000'
  formModal.isActive = true
  formModal.show = true
}

function openEdit(color: Color) {
  formModal.isEdit = true
  formModal.id = color.id
  formModal.name = color.name
  formModal.hexCode = color.hexCode
  formModal.isActive = color.isActive
  formModal.show = true
}

async function saveColor() {
  formModal.loading = true
  try {
    const payload = {
      name: formModal.name,
      hexCode: formModal.hexCode,
      isActive: formModal.isActive,
    }

    if (formModal.isEdit) {
      await colorsService.update(formModal.id, payload)
      toast.success('Color actualizado')
    } else {
      await colorsService.create(payload)
      toast.success('Color creado')
    }

    formModal.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo guardar el color')
  } finally {
    formModal.loading = false
  }
}

function askDelete(color: Color) {
  confirm.id = color.id
  confirm.name = color.name
  confirm.show = true
}

async function removeColor() {
  confirm.loading = true
  try {
    await colorsService.remove(confirm.id)
    toast.success('Color eliminado')
    confirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar el color')
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
