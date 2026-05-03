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
import {
  CRUD_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_LABELS,
  PERMISSION_RESOURCES,
  expandPermissionKeys,
  type CrudAction,
  type PermissionKey,
  type PermissionResource,
} from '@/utils/permissions'

const toast = useToast()
const pg = usePagination(15)
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const users = ref<User[] | null>(null)
const filters = reactive({ search: '', role: '' as '' | Role, isActive: '' as '' | 'true' | 'false' })
const initialized = ref(false)
const tableLoading = computed(() => users.value === null)

const tableColumns = [
  { key: 'email', label: 'Usuario' },
  { key: 'name', label: 'Nombre' },
  { key: 'role', label: 'Rol', align: 'center' as const },
  { key: 'permissions', label: 'Permisos', align: 'center' as const },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'createdAt', label: 'Creado' },
  { key: 'actions', actions: true },
]
const canCreateUsers = computed(() => auth.can('users.create'))
const canUpdateUsers = computed(() => auth.can('users.update'))
const canDeleteUsers = computed(() => auth.can('users.delete'))
const canAssignDelegatedPermissions = computed(() => auth.isSuperAdmin || auth.can('users.update'))
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
  grantedPermissions: [] as string[],
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
  { value: Role.CUSTOMER, label: 'Customer' },
]

const permissionResources = PERMISSION_RESOURCES.filter((resource) =>
  !['profile', 'admin-tools', 'images'].includes(resource),
)

function permissionKey(resource: PermissionResource, action: CrudAction) {
  return `${resource}.${action}`
}

const directPermissionSet = computed(() => new Set<PermissionKey>(formModal.grantedPermissions as PermissionKey[]))
const effectivePermissionSet = computed(() => new Set<PermissionKey>(expandPermissionKeys(formModal.grantedPermissions)))
const impliedPermissionSet = computed(() => {
  const implied = new Set<PermissionKey>()
  for (const key of effectivePermissionSet.value) {
    if (!directPermissionSet.value.has(key)) {
      implied.add(key)
    }
  }
  return implied
})

function permissionStatus(resource: PermissionResource, action: CrudAction): 'direct' | 'implied' | 'none' {
  const key = permissionKey(resource, action) as PermissionKey
  if (directPermissionSet.value.has(key)) return 'direct'
  if (impliedPermissionSet.value.has(key)) return 'implied'
  return 'none'
}

const permissionPreviewResources = computed(() =>
  permissionResources.filter((resource) =>
    CRUD_ACTIONS.some((action) => effectivePermissionSet.value.has(permissionKey(resource, action) as PermissionKey)),
  ),
)

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
  formModal.grantedPermissions = []
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
  formModal.grantedPermissions = [...(user.grantedPermissions ?? [])]
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
      grantedPermissions: canAssignDelegatedPermissions.value
        ? formModal.grantedPermissions
        : undefined,
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
        grantedPermissions: canAssignDelegatedPermissions.value
          ? formModal.grantedPermissions
          : undefined,
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
        <UiButton v-if="canCreateUsers" @click="openCreate">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo usuario
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <UiTable :data="users" :loading="tableLoading" :columns="tableColumns" loading-color="primary" loading-text="Cargando usuarios..." empty-message="No hay usuarios">

        <tr v-for="u in users ?? []" :key="u.id" class="table-tr-hover">
          <td class="table-td font-medium">{{ u.email }}</td>
          <td class="table-td">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || '—' }}</td>
          <td class="table-td text-center">
            <UiBadge :color="u.role === Role.SUPER_ADMIN ? 'primary' : u.role === Role.ADMIN ? 'info' : 'neutral'">
              {{ u.role }}
            </UiBadge>
          </td>
          <td class="table-td text-center text-xs text-muted">
            <span v-if="u.role === Role.SUPER_ADMIN">Acceso total</span>
            <span v-else-if="(u.grantedPermissions ?? []).length > 0">{{ u.grantedPermissions.length }} permisos</span>
            <span v-else>Sin permisos delegados</span>
          </td>
          <td class="table-td text-center">
            <UiBadge :color="u.isActive ? 'success' : 'danger'" dot>
              {{ u.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <td class="table-td text-muted text-xs">{{ new Date(u.createdAt).toLocaleDateString('es-AR') }}</td>
          <td class="table-td table-actions-td text-right">
            <div v-if="canUpdateUsers || canDeleteUsers" class="flex items-center gap-2 justify-end">
              <UiButton v-if="canUpdateUsers" variant="ghost" size="sm" @click="openEdit(u)">Editar</UiButton>
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
      v-if="canCreateUsers || canUpdateUsers"
      :show="formModal.show"
      :title="formModal.isEdit ? 'Editar usuario' : 'Nuevo usuario'"
      size="md"
      @close="formModal.show = false"
    >
      <div class="max-h-[78vh] overflow-y-auto pr-1">
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
        <div v-if="canAssignDelegatedPermissions && formModal.role !== Role.SUPER_ADMIN && formModal.role !== Role.CUSTOMER" class="md:col-span-2 space-y-3">
          <div>
            <p class="text-sm font-medium text-surface-800 mb-1">Permisos CRUD por modulo (directos)</p>
            <p class="text-xs text-muted">
              Los checks guardan permisos directos. El panel calcula permisos implicados por dependencias de API para preview.
            </p>
          </div>
          <div class="space-y-3 border border-surface-200 rounded-lg p-3 bg-surface-50 max-h-72 overflow-y-auto">
            <div
              v-for="resource in permissionResources"
              :key="resource"
              class="grid grid-cols-[160px_1fr] gap-2 items-center"
            >
              <p class="text-sm font-medium text-surface-800">{{ PERMISSION_LABELS[resource] }}</p>
              <div class="flex flex-wrap gap-3">
                <label
                  v-for="action in CRUD_ACTIONS"
                  :key="`${resource}-${action}`"
                  class="flex items-center gap-2 text-xs text-surface-700"
                >
                  <input
                    v-model="formModal.grantedPermissions"
                    type="checkbox"
                    :value="permissionKey(resource, action)"
                    class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{{ PERMISSION_ACTION_LABELS[action] }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center text-xs">
            <div class="rounded-lg border border-primary-200 bg-primary-50 px-2 py-2">
              <p class="text-lg font-bold tabular-nums text-primary-700">{{ directPermissionSet.size }}</p>
              <p class="text-caption">Directos</p>
            </div>
            <div class="rounded-lg border border-primary-100 bg-primary-50/40 px-2 py-2">
              <p class="text-lg font-bold tabular-nums text-primary-400">{{ impliedPermissionSet.size }}</p>
              <p class="text-caption">Implicados</p>
            </div>
            <div class="rounded-lg border border-surface-200 bg-surface-50 px-2 py-2">
              <p class="text-lg font-bold tabular-nums text-surface-700">{{ effectivePermissionSet.size }}</p>
              <p class="text-caption">Total efectivo</p>
            </div>
          </div>

          <div v-if="permissionPreviewResources.length" class="max-h-72 rounded-lg border border-surface-200 overflow-auto">
            <table class="min-w-full border-collapse text-xs">
              <thead>
                <tr class="border-b border-surface-200 bg-surface-50">
                  <th class="py-2.5 px-3 text-left text-caption font-medium text-surface-600">Recurso</th>
                  <th
                    v-for="action in CRUD_ACTIONS"
                    :key="action"
                    class="min-w-16 py-2.5 px-2 text-center text-caption font-medium text-surface-600"
                  >
                    {{ PERMISSION_ACTION_LABELS[action] }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100">
                <tr v-for="resource in permissionPreviewResources" :key="resource">
                  <td class="py-2 px-3 font-medium text-surface-800">{{ PERMISSION_LABELS[resource] }}</td>
                  <td v-for="action in CRUD_ACTIONS" :key="`${resource}-preview-${action}`" class="py-2 px-2 text-center">
                    <span
                      v-if="permissionStatus(resource, action) === 'direct'"
                      class="inline-flex h-5 w-5 items-center justify-center rounded bg-primary-500 text-white"
                      :title="`${resource}.${action} - directo`"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
                    </span>
                    <span
                      v-else-if="permissionStatus(resource, action) === 'implied'"
                      class="inline-flex h-5 w-5 items-center justify-center rounded border border-primary-200 bg-primary-100 text-primary-600"
                      :title="`${resource}.${action} - implicado`"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-primary-500"></span>
                    </span>
                    <span v-else class="inline-flex h-5 w-5 items-center justify-center rounded bg-surface-100">
                      <span class="h-px w-2 rounded bg-surface-300"></span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="flex items-center pt-7">
          <FormToggleField v-model="formModal.isActive" label="Activo" />
        </div>
      </FormModalLayout>
      </div>

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
