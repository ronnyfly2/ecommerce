<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { inventoryService } from '@/services/inventory.service'
import type { Store, CreateStoreDto, UpdateStoreDto } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const stores = ref<Store[] | null>(null)
const search = ref('')

const form = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  code: '',
  name: '',
  city: '',
  country: '',
  address: '',
  isActive: true,
})

const confirm = reactive({
  show: false,
  loading: false,
  id: '',
  name: '',
})

const tableLoading = computed(() => stores.value === null)
const filteredStores = computed(() => {
  const rows = stores.value ?? []
  const q = search.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((s) =>
    [s.code, s.name, s.city, s.country].join(' ').toLowerCase().includes(q),
  )
})

function resetForm() {
  form.id = ''
  form.code = ''
  form.name = ''
  form.city = ''
  form.country = ''
  form.address = ''
  form.isActive = true
  form.isEdit = false
}

function openCreate() {
  resetForm()
  form.show = true
}

function openEdit(store: Store) {
  form.isEdit = true
  form.id = store.id
  form.code = store.code
  form.name = store.name
  form.city = store.city
  form.country = store.country
  form.address = store.address ?? ''
  form.isActive = store.isActive
  form.show = true
}

function openDelete(store: Store) {
  confirm.id = store.id
  confirm.name = store.name
  confirm.show = true
}

async function load() {
  stores.value = null
  try {
    stores.value = await inventoryService.allStores()
  } catch {
    stores.value = []
    toast.error('Error', 'No se pudieron cargar las tiendas')
  }
}

async function submit() {
  if (!form.code.trim() || !form.name.trim() || !form.city.trim() || !form.country.trim()) {
    toast.warning('Campos requeridos', 'Completa código, nombre, ciudad y país')
    return
  }

  form.loading = true
  try {
    if (form.isEdit) {
      const dto: UpdateStoreDto = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        address: form.address.trim() || undefined,
        isActive: form.isActive,
      }
      await inventoryService.updateStore(form.id, dto)
      toast.success('Tienda actualizada', 'Los cambios se guardaron correctamente')
    } else {
      const dto: CreateStoreDto = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        address: form.address.trim() || undefined,
        isActive: form.isActive,
      }
      await inventoryService.createStore(dto)
      toast.success('Tienda creada', 'La tienda se creó correctamente')
    }

    form.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo guardar la tienda')
  } finally {
    form.loading = false
  }
}

async function removeStore() {
  confirm.loading = true
  try {
    await inventoryService.deleteStore(confirm.id)
    confirm.show = false
    toast.success('Tienda eliminada', 'Se eliminó correctamente')
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar la tienda')
  } finally {
    confirm.loading = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <UiInput v-model="search" size="sm" label="Buscar" placeholder="Código, nombre, ciudad o país" />
      </template>
      <template #actions>
        <UiButton @click="openCreate">Nueva tienda</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable
        :data="filteredStores"
        :loading="tableLoading"
        :empty="!tableLoading && filteredStores.length === 0"
        empty-message="Sin tiendas"
      >
        <template #head>
          <tr>
            <th class="table-th">Código</th>
            <th class="table-th">Nombre</th>
            <th class="table-th">Ubicación</th>
            <th class="table-th">Estado</th>
            <th class="table-th w-48 text-right">Acciones</th>
          </tr>
        </template>

        <tr v-for="store in filteredStores" :key="store.id" class="table-tr-hover">
          <td class="table-td font-mono">{{ store.code }}</td>
          <td class="table-td">
            <p class="font-medium">{{ store.name }}</p>
            <p class="text-xs text-muted">{{ store.address || 'Sin dirección' }}</p>
          </td>
          <td class="table-td">{{ store.city }}, {{ store.country }}</td>
          <td class="table-td">
            <UiBadge :color="store.isActive ? 'success' : 'neutral'">
              {{ store.isActive ? 'Activa' : 'Inactiva' }}
            </UiBadge>
          </td>
          <td class="table-td text-right">
            <div class="inline-flex gap-2">
              <UiButton size="sm" variant="secondary" @click="openEdit(store)">Editar</UiButton>
              <UiButton size="sm" variant="danger" @click="openDelete(store)">Eliminar</UiButton>
            </div>
          </td>
        </tr>
      </UiTable>
    </UiCard>

    <UiModal :show="form.show" :title="form.isEdit ? 'Editar tienda' : 'Nueva tienda'" size="lg" @close="form.show = false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <UiInput v-model="form.code" label="Código" placeholder="Ej: LA_MOLINA" />
        <UiInput v-model="form.name" label="Nombre" placeholder="Ej: Tienda La Molina" />
        <UiInput v-model="form.city" label="Ciudad" />
        <UiInput v-model="form.country" label="País" />
      </div>

      <UiInput v-model="form.address" class="mt-3" label="Dirección" placeholder="Opcional" />

      <label class="mt-3 inline-flex items-center gap-2 text-sm text-muted">
        <input v-model="form.isActive" type="checkbox" class="rounded border-surface-300" />
        Tienda activa
      </label>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton variant="ghost" @click="form.show = false">Cancelar</UiButton>
          <UiButton :loading="form.loading" @click="submit">Guardar</UiButton>
        </div>
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar tienda"
      :message="`Se eliminará la tienda ${confirm.name}. Esta acción no se puede deshacer.`"
      confirm-label="Eliminar"
      :loading="confirm.loading"
      @confirm="removeStore"
      @cancel="confirm.show = false"
    />
  </div>
</template>
