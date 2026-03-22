<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { categoriesService } from '@/services/catalog.service'
import { extractErrorMessage } from '@/utils/error'
import type { Category } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const categories = ref<Category[] | null>(null)
const tableLoading = computed(() => categories.value === null)

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
  formModal.show = true
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
    <div class="flex justify-end">
      <UiButton @click="openCreate">Nueva categoría</UiButton>
    </div>

    <UiCard :padding="false">
      <UiTable :data="categories" :loading="tableLoading" loading-color="primary" loading-text="Cargando categorías..." empty-message="No hay categorías">
        <template #head>
          <tr>
            <th class="table-th">Nombre</th>
            <th class="table-th">Padre</th>
            <th class="table-th text-center">Orden</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="c in categories ?? []" :key="c.id" class="table-tr-hover">
          <td class="table-td">
            <div class="font-medium">{{ c.name }}</div>
            <div class="text-xs text-muted">{{ c.slug }}</div>
          </td>
          <td class="table-td">{{ c.parent?.name ?? '—' }}</td>
          <td class="table-td text-center">{{ c.displayOrder }}</td>
          <td class="table-td text-center">
            <UiBadge :color="c.isActive ? 'success' : 'neutral'" dot>{{ c.isActive ? 'Activa' : 'Inactiva' }}</UiBadge>
          </td>
          <td class="table-td table-actions-td text-right">
            <div class="flex items-center gap-2 justify-end">
              <UiButton size="sm" variant="ghost" @click="openEdit(c)">Editar</UiButton>
              <UiButton size="sm" variant="danger" @click="askDelete(c)">Eliminar</UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear categoría</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar categoría' : 'Nueva categoría'" @close="formModal.show = false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput v-model="formModal.name" label="Nombre" required class="md:col-span-2" />
        <UiInput v-model="formModal.image" label="Imagen (URL)" class="md:col-span-2" />
        <UiInput v-model="formModal.displayOrder" type="number" min="0" label="Orden de visualización" />
        <div class="flex items-center pt-7">
          <FormToggleField v-model="formModal.isActive" label="Activa" />
        </div>
        <div class="md:col-span-2">
          <UiInput
            v-model="formModal.parentId"
            label="ID categoría padre (opcional)"
            placeholder="UUID"
            hint="Opcional: define jerarquía"
          />
        </div>
        <div class="md:col-span-2">
          <UiTextarea v-model="formModal.description" label="Descripción" :rows="3" />
        </div>
      </div>

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
