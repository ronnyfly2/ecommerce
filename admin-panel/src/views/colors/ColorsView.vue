<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { colorsService } from '@/services/catalog.service'
import type { Color } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const colors = ref<Color[]>([])
const loading = ref(false)

const formModal = reactive({ show: false, loading: false, isEdit: false, id: '', name: '', hexCode: '#000000' })
const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  loading.value = true
  try {
    colors.value = await colorsService.list()
  } catch {
    toast.error('Error', 'No se pudieron cargar los colores')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.name = ''
  formModal.hexCode = '#000000'
  formModal.show = true
}

function openEdit(color: Color) {
  formModal.isEdit = true
  formModal.id = color.id
  formModal.name = color.name
  formModal.hexCode = color.hexCode
  formModal.show = true
}

async function saveColor() {
  formModal.loading = true
  try {
    const payload = { name: formModal.name, hexCode: formModal.hexCode }

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
    <div class="flex justify-end">
      <UiButton @click="openCreate">Nuevo color</UiButton>
    </div>

    <UiCard :padding="false">
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 6" :key="i" class="h-11 rounded-lg bg-[--color-surface-100] animate-pulse" />
      </div>
      <div v-else-if="!colors.length" class="text-muted text-center py-16">No hay colores</div>
      <div v-else class="overflow-x-auto -mb-6">
        <table class="table-base">
          <thead>
            <tr>
              <th class="table-th">Color</th>
              <th class="table-th">HEX</th>
              <th class="table-th">Creado</th>
              <th class="table-th" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in colors" :key="c.id" class="table-tr-hover">
              <td class="table-td">
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 rounded-full border border-[--color-surface-300]" :style="{ backgroundColor: c.hexCode }" />
                  <span class="font-medium">{{ c.name }}</span>
                </div>
              </td>
              <td class="table-td font-mono text-xs">{{ c.hexCode }}</td>
              <td class="table-td text-muted text-xs">{{ new Date(c.createdAt).toLocaleDateString('es-AR') }}</td>
              <td class="table-td text-right">
                <div class="flex items-center gap-2 justify-end">
                  <UiButton size="sm" variant="ghost" @click="openEdit(c)">Editar</UiButton>
                  <UiButton size="sm" variant="danger" @click="askDelete(c)">Eliminar</UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar color' : 'Nuevo color'" @close="formModal.show = false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput v-model="formModal.name" label="Nombre" required placeholder="Rojo" />
        <div class="flex items-end gap-3">
          <UiInput v-model="formModal.hexCode" label="HEX" required placeholder="#FF0000" />
          <input v-model="formModal.hexCode" type="color" class="h-10 w-12 rounded border border-[--color-surface-300] bg-white" />
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="formModal.show = false">Cancelar</UiButton>
        <UiButton :loading="formModal.loading" @click="saveColor">Guardar</UiButton>
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
