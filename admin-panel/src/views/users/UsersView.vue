<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usersService } from '@/services/users.service'
import { Role } from '@/types/api'
import type { User } from '@/types/api'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { normalizeApiList } from '@/utils/api-list'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormModalLayout from '@/components/forms/FormModalLayout.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import type { CreateUserDto, UpdateUserDto } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()
const pg = usePagination(15)
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const users = ref<User[] | null>(null)
const filters = reactive({ search: '', role: '' as '' | Role, isActive: '' as '' | 'true' | 'false' })
const initialized = ref(false)
const tableLoading = computed(() => users.value === null)
const canManageUsers = computed(() => auth.can('users.manage'))
const canDeleteUsers = computed(() => auth.can('users.delete'))
const searchFilter = toRef(filters, 'search')
const roleFilter = toRef(filters, 'role')
const isActiveFilter = toRef(filters, 'isActive')

function syncQuery() {
  const query: Record<string, string> = {}
  if (pg.page.value > 1) query.page = String(pg.page.value)
  if (filters.search.trim()) query.search = filters.search.trim()
  if (filters.role) query.role = filters.role
  if (filters.isActive) query.isActive = filters.isActive
  router.replace({ query })
}

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: Role.ADMIN as Role,
  isActive: true,
})

const confirm = reactive({ show: false, id: '', name: '', loading: false })

const roleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: Role.SUPER_ADMIN, label: 'Super Admin' },
  { value: Role.ADMIN, label: 'Admin' },
  { value: Role.BOSS, label: 'Boss' },
  { value: Role.MARKETING, label: 'Marketing' },
  { value: Role.SALES, label: 'Sales' },
]

const activeOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]

async function load() {
  users.value = null
  try {
    const data = await usersService.list({
      page: pg.page.value,
      limit: pg.limit.value,
      search: filters.search || undefined,
      role: filters.role || undefined,
      isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
    })
    const result = normalizeApiList(data)
    users.value = result.items
    pg.total.value = result.total
  } catch {
    users.value = []
    toast.error('Error', 'No se pudieron cargar los usuarios')
  }
}

watch([pg.page, searchFilter, roleFilter, isActiveFilter], async () => {
  if (!initialized.value) return
  syncQuery()
  await load()
})

onMounted(async () => {
  const page = Number(route.query.page ?? 1)
  pg.page.value = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1

  filters.search = typeof route.query.search === 'string' ? route.query.search : ''

  const roleQuery = route.query.role
  if (typeof roleQuery === 'string' && Object.values(Role).includes(roleQuery as Role)) {
    filters.role = roleQuery as Role
  }

  const isActiveQuery = route.query.isActive
  if (isActiveQuery === 'true' || isActiveQuery === 'false') {
    filters.isActive = isActiveQuery
  }

  initialized.value = true
  await load()
})

function resetForm() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.email = ''
  formModal.password = ''
  formModal.firstName = ''
  formModal.lastName = ''
  formModal.role = Role.ADMIN
  formModal.isActive = true
}

function openCreate() {
  resetForm()
  formModal.show = true
}

function openEdit(user: User) {
  formModal.isEdit = true
  formModal.id = user.id
  formModal.email = user.email
  formModal.password = ''
  formModal.firstName = user.firstName ?? ''
  formModal.lastName = user.lastName ?? ''
  formModal.role = user.role
  formModal.isActive = user.isActive
  formModal.show = true
}

async function saveUser() {
  formModal.loading = true
  try {
    const basePayload: UpdateUserDto = {
      email: formModal.email,
      password: formModal.password || undefined,
      firstName: formModal.firstName || undefined,
      lastName: formModal.lastName || undefined,
      role: formModal.role,
      isActive: formModal.isActive,
    }

    if (formModal.isEdit) {
      await usersService.update(formModal.id, basePayload)
      toast.success('Usuario actualizado')
    } else {
      if (!formModal.password) {
        toast.warning('Falta contraseña', 'Debes ingresar contraseña para crear usuario')
        return
      }
      const createPayload: CreateUserDto = {
        email: formModal.email,
        password: formModal.password,
        firstName: formModal.firstName || undefined,
        lastName: formModal.lastName || undefined,
        role: formModal.role,
      }
      await usersService.create(createPayload)
      toast.success('Usuario creado')
    }

    formModal.show = false
    await load()
  } catch (e: unknown) {
    const msg =
      typeof e === 'object' &&
      e !== null &&
      'response' in e &&
      typeof (e as { response?: { data?: { message?: unknown } } }).response?.data?.message !== 'undefined'
        ? (e as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined
    toast.error('Error', Array.isArray(msg) ? msg[0] : (msg ?? 'No se pudo guardar'))
  } finally {
    formModal.loading = false
  }
}

function askDelete(user: User) {
  confirm.id = user.id
  confirm.name = user.email
  confirm.show = true
}

async function removeUser() {
  confirm.loading = true
  try {
    await usersService.remove(confirm.id)
    toast.success('Usuario eliminado')
    confirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar el usuario')
  } finally {
    confirm.loading = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <UiInput v-model="filters.search" label="Buscar usuarios" size="sm" placeholder="Buscar por email o nombre…" class="min-w-60" />
        <UiSelect v-model="filters.role" label="Filtrar por rol" size="sm" :options="roleOptions" class="min-w-45" />
        <UiSelect v-model="filters.isActive" label="Filtrar por estado" size="sm" :options="activeOptions" class="min-w-40" />
      </template>
      <template #actions>
        <UiButton v-if="canManageUsers" @click="openCreate">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo usuario
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="users" :loading="tableLoading" loading-color="primary" loading-text="Cargando usuarios..." empty-message="No hay usuarios">
        <template #head>
          <tr>
            <th class="table-th">Usuario</th>
            <th class="table-th">Nombre</th>
            <th class="table-th text-center">Rol</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th">Creado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="u in users ?? []" :key="u.id" class="table-tr-hover">
          <td class="table-td font-medium">{{ u.email }}</td>
          <td class="table-td">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || '—' }}</td>
          <td class="table-td text-center">
            <UiBadge :color="u.role === Role.SUPER_ADMIN ? 'primary' : u.role === Role.ADMIN ? 'info' : 'neutral'">
              {{ u.role }}
            </UiBadge>
          </td>
          <td class="table-td text-center">
            <UiBadge :color="u.isActive ? 'success' : 'danger'" dot>
              {{ u.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <td class="table-td text-muted text-xs">{{ new Date(u.createdAt).toLocaleDateString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <div v-if="canManageUsers || canDeleteUsers" class="flex items-center gap-2 justify-end">
              <UiButton v-if="canManageUsers" variant="ghost" size="sm" @click="openEdit(u)">Editar</UiButton>
              <UiButton v-if="canDeleteUsers" variant="danger" size="sm" @click="askDelete(u)">Eliminar</UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton
            size="sm"
            variant="secondary"
            @click="filters.search = ''; filters.role = ''; filters.isActive = ''"
          >
            Limpiar filtros
          </UiButton>
        </template>
      </UiTable>

      <div class="p-4 border-t border-surface-200">
        <UiPagination
          :page="pg.page.value"
          :total-pages="pg.totalPages.value"
          :total="pg.total.value"
          @change="pg.goTo"
        />
      </div>
    </UiCard>

    <UiModal
      v-if="canManageUsers"
      :show="formModal.show"
      :title="formModal.isEdit ? 'Editar usuario' : 'Nuevo usuario'"
      size="md"
      @close="formModal.show = false"
    >
      <FormModalLayout>
        <UiInput v-model="formModal.email" label="Email" size="lg" type="email" required class="md:col-span-2" />
        <UiInput
          v-model="formModal.password"
          :label="formModal.isEdit ? 'Contraseña (opcional)' : 'Contraseña'"
          type="password"
          size="lg"
          :required="!formModal.isEdit"
          class="md:col-span-2"
        />
        <UiInput v-model="formModal.firstName" label="Nombre" size="lg" />
        <UiInput v-model="formModal.lastName" label="Apellido" size="lg" />
        <UiSelect
          v-model="formModal.role"
          label="Rol"
          size="lg"
          :options="roleOptions.filter(opt => opt.value !== '')"
        />
        <div class="flex items-center pt-7">
          <FormToggleField v-model="formModal.isActive" label="Activo" />
        </div>
      </FormModalLayout>

      <template #footer>
        <FormModalActions :loading="formModal.loading" @cancel="formModal.show = false" @save="saveUser" />
      </template>
    </UiModal>

    <UiConfirm
      v-if="canDeleteUsers"
      :show="confirm.show"
      title="Eliminar usuario"
      :message="`¿Eliminar el usuario ${confirm.name}?`"
      :loading="confirm.loading"
      @confirm="removeUser"
      @cancel="confirm.show = false"
    />
  </div>
</template>
