<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { sizesService } from '@/services/catalog.service'
import type { Size } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const sizes = ref<Size[]>([])
const loading = ref(false)

const formModal = reactive({ show: false, loading: false, isEdit: false, id: '', name: '' })
const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  loading.value = true
  try {
    sizes.value = await sizesService.list()
  } catch {
    toast.error('Error', 'No se pudieron cargar las tallas')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.name = ''
  formModal.show = true
}

function openEdit(size: Size) {
  formModal.isEdit = true
  formModal.id = size.id
  formModal.name = size.name
  formModal.show = true
}

async function saveSize() {
  formModal.loading = true
  try {
    if (formModal.isEdit) {
      await sizesService.update(formModal.id, { name: formModal.name })
      toast.success('Talla actualizada')
    } else {
      await sizesService.create({ name: formModal.name })
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
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 6" :key="i" class="h-11 rounded-lg bg-[--color-surface-100] animate-pulse" />
      </div>
      <div v-else-if="!sizes.length" class="text-muted text-center py-16">No hay tallas</div>
      <div v-else class="overflow-x-auto -mb-6">
        <table class="table-base">
          <thead>
            <tr>
              <th class="table-th">Nombre</th>
              <th class="table-th">Creado</th>
              <th class="table-th" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sizes" :key="s.id" class="table-tr-hover">
              <td class="table-td font-medium">{{ s.name }}</td>
              <td class="table-td text-muted text-xs">{{ new Date(s.createdAt).toLocaleDateString('es-AR') }}</td>
              <td class="table-td text-right">
                <div class="flex items-center gap-2 justify-end">
                  <UiButton size="sm" variant="ghost" @click="openEdit(s)">Editar</UiButton>
                  <UiButton size="sm" variant="danger" @click="askDelete(s)">Eliminar</UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar talla' : 'Nueva talla'" @close="formModal.show = false">
      <UiInput v-model="formModal.name" label="Nombre" required placeholder="M, L, XL..." />
      <template #footer>
        <UiButton variant="secondary" @click="formModal.show = false">Cancelar</UiButton>
        <UiButton :loading="formModal.loading" @click="saveSize">Guardar</UiButton>
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
