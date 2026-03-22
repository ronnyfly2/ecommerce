<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { sizesService } from '@/services/catalog.service'
import type { Size } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const sizes = ref<Size[] | null>(null)
const tableLoading = computed(() => sizes.value === null)

const formModal = reactive({ show: false, loading: false, isEdit: false, id: '', name: '', abbreviation: '' })
const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  sizes.value = null
  try {
    sizes.value = await sizesService.list()
  } catch {
    sizes.value = []
    toast.error('Error', 'No se pudieron cargar las tallas')
  }
}

function openCreate() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.name = ''
  formModal.abbreviation = ''
  formModal.show = true
}

function openEdit(size: Size) {
  formModal.isEdit = true
  formModal.id = size.id
  formModal.name = size.name
  formModal.abbreviation = size.abbreviation
  formModal.show = true
}

function normalizedAbbreviation(value: string) {
  return value.trim().toUpperCase()
}

async function saveSize() {
  formModal.loading = true
  try {
    const payload = {
      name: formModal.name.trim(),
      abbreviation: normalizedAbbreviation(formModal.abbreviation),
    }

    if (formModal.isEdit) {
      await sizesService.update(formModal.id, payload)
      toast.success('Talla actualizada')
    } else {
      await sizesService.create(payload)
      toast.success('Talla creada')
    }

    formModal.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo guardar la talla')
  } finally {
    formModal.loading = false
  }
}

function askDelete(size: Size) {
  confirm.id = size.id
  confirm.name = size.name
  confirm.show = true
}

async function removeSize() {
  confirm.loading = true
  try {
    await sizesService.remove(confirm.id)
    toast.success('Talla eliminada')
    confirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar la talla')
  } finally {
    confirm.loading = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <UiButton @click="openCreate">Nueva talla</UiButton>
    </div>

    <UiCard :padding="false">
      <UiTable :data="sizes" :loading="tableLoading" loading-color="primary" loading-text="Cargando tallas..." no-min-width empty-message="No hay tallas">
        <template #head>
          <tr>
            <th class="table-th">Nombre</th>
            <th class="table-th">Prefijo</th>
            <th class="table-th">Creado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="s in sizes ?? []" :key="s.id" class="table-tr-hover">
          <td class="table-td font-medium">{{ s.name }}</td>
          <td class="table-td font-mono text-xs">{{ s.abbreviation }}</td>
          <td class="table-td text-muted text-xs">{{ new Date(s.createdAt).toLocaleDateString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <div class="flex items-center gap-2 justify-end">
              <UiButton size="sm" variant="ghost" @click="openEdit(s)">Editar</UiButton>
              <UiButton size="sm" variant="danger" @click="askDelete(s)">Eliminar</UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton size="sm" @click="openCreate">Crear talla</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar talla' : 'Nueva talla'" @close="formModal.show = false">
      <div class="space-y-4">
        <UiInput v-model="formModal.name" label="Nombre" required placeholder="Large, Medium, Small..." />
        <UiInput
          :model-value="formModal.abbreviation"
          label="Prefijo / abreviatura"
          required
          placeholder="L, M, S..."
          hint="Ejemplo: Large = L, Medium = M"
          @update:model-value="(value) => formModal.abbreviation = normalizedAbbreviation(String(value ?? ''))"
        />
      </div>
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
