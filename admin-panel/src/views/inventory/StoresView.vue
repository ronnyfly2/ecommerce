<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { inventoryService } from '@/services/inventory.service'
import { extractErrorMessage } from '@/utils/error'
import type { Store } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { hasRolePermission } from '@/utils/permissions'

const toast = useToast()
const auth = useAuthStore()
const canManage = computed(() => hasRolePermission(auth.user?.role, 'inventory.manage'))

const stores = ref<Store[] | null>(null)
const tableLoading = computed(() => stores.value === null)

const formModal = reactive({
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

const confirm = reactive({ show: false, id: '', name: '', loading: false })

async function load() {
  stores.value = null
  try {
    stores.value = await inventoryService.allStores()
  } catch {
    stores.value = []
    toast.error('Error', 'No se pudieron cargar las tiendas')
  }
}

function resetForm() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.code = ''
  formModal.name = ''
  formModal.city = ''
  formModal.country = ''
  formModal.address = ''
  formModal.isActive = true
}

function openCreate() {
  resetForm()
  formModal.show = true
}

function openEdit(store: Store) {
  formModal.isEdit = true
  formModal.id = store.id
  formModal.code = store.code
  formModal.name = store.name
  formModal.city = store.city
  formModal.country = store.country
  formModal.address = store.address ?? ''
  formModal.isActive = store.isActive
  formModal.show = true
}

async function submitForm() {
  if (!formModal.code.trim() || !formModal.name.trim() || !formModal.city.trim() || !formModal.country.trim()) {
    toast.warning('Campos requeridos', 'Completa código, nombre, ciudad y país')
    return
  }
  formModal.loading = true
  try {
    const dto = {
      code: formModal.code.trim(),
      name: formModal.name.trim(),
      city: formModal.city.trim(),
      country: formModal.country.trim(),
      address: formModal.address.trim() || undefined,
      isActive: formModal.isActive,
    }
    if (formModal.isEdit) {
      await inventoryService.updateStore(formModal.id, dto)
      toast.success('Tienda actualizada', formModal.name)
    } else {
      await inventoryService.createStore(dto)
      toast.success('Tienda creada', formModal.name)
    }
    formModal.show = false
    await load()
  } catch (err) {
    toast.error('Error', extractErrorMessage(err))
  } finally {
    formModal.loading = false
  }
}

function openDelete(store: Store) {
  confirm.id = store.id
  confirm.name = store.name
  confirm.show = true
}

async function confirmDelete() {
  confirm.loading = true
  try {
    await inventoryService.deleteStore(confirm.id)
    toast.success('Tienda eliminada', confirm.name)
    confirm.show = false
    await load()
  } catch (err) {
    toast.error('Error', extractErrorMessage(err))
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
        <UiButton v-if="canManage" @click="openCreate">Nueva tienda</UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable
        :data="stores"
        :loading="tableLoading"
        :empty="!tableLoading && !stores?.length"
        empty-message="Sin tiendas registradas"
      >
        <template #head>
          <tr>
            <th class="table-th">Código</th>
            <th class="table-th">Nombre</th>
            <th class="table-th">Ciudad / País</th>
            <th class="table-th">Dirección</th>
            <th class="table-th">Estado</th>
            <th class="table-th w-28"></th>
          </tr>
        </template>

        <tr v-for="store in stores" :key="store.id" class="table-tr-hover">
          <td class="table-td font-mono font-semibold text-surface-900">{{ store.code }}</td>
          <td class="table-td font-medium">{{ store.name }}</td>
          <td class="table-td text-muted">{{ store.city }}, {{ store.country }}</td>
          <td class="table-td text-muted text-sm">{{ store.address ?? '—' }}</td>
          <td class="table-td">
            <UiBadge :color="store.isActive ? 'success' : 'neutral'">
              {{ store.isActive ? 'Activa' : 'Inactiva' }}
            </UiBadge>
          </td>
          <td class="table-td">
            <div v-if="canManage" class="flex items-center gap-2 justify-end">
              <UiButton variant="ghost" size="sm" @click="openEdit(store)">Editar</UiButton>
              <UiButton variant="danger" size="sm" @click="openDelete(store)">Eliminar</UiButton>
            </div>
          </td>
        </tr>
      </UiTable>
    </UiCard>

    <!-- Form modal -->
    <UiModal :show="formModal.show" :title="formModal.isEdit ? 'Editar tienda' : 'Nueva tienda'" @close="formModal.show = false">
      <FormModalLayout>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiInput
            v-model="formModal.code"
            label="Código"
            placeholder="Ej: MIRAFLORES"
            :disabled="formModal.isEdit"
            required
          />
          <UiInput
            v-model="formModal.name"
            label="Nombre"
            placeholder="Ej: Tienda Miraflores"
            required
          />
          <UiInput
            v-model="formModal.city"
            label="Ciudad"
            placeholder="Lima"
            required
          />
          <UiInput
            v-model="formModal.country"
            label="País"
            placeholder="Perú"
            required
          />
          <div class="md:col-span-2">
            <UiInput
              v-model="formModal.address"
              label="Dirección"
              placeholder="Av. Principal 123"
            />
          </div>
          <div class="md:col-span-2">
            <FormToggleField
              v-model="formModal.isActive"
              label="Tienda activa"
              description="Solo tiendas activas aparecen como destino de retiro en órdenes"
            />
          </div>
        </div>
      </FormModalLayout>
      <template #footer>
        <FormModalActions
          :loading="formModal.loading"
          :submit-label="formModal.isEdit ? 'Guardar' : 'Crear tienda'"
          @submit="submitForm"
          @cancel="formModal.show = false"
        />
      </template>
    </UiModal>

    <!-- Delete confirm -->
    <UiConfirm
      :show="confirm.show"
      title="Eliminar tienda"
      :message="`¿Eliminar la tienda &quot;${confirm.name}&quot;? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar"
      variant="danger"
      :loading="confirm.loading"
      @confirm="confirmDelete"
      @cancel="confirm.show = false"
    />
  </div>
</template>
