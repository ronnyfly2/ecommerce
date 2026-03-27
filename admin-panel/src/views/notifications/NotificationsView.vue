<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { NotificationType, type Notification } from '@/types/api'
import { notificationsService } from '@/services/notifications.service'
import { useNotificationsStore } from '@/stores/notifications'
import UiCard from '@/components/ui/UiCard.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const notificationsStore = useNotificationsStore()

const items = ref<Notification[] | null>(null)
const unreadCount = ref(0)
const meta = reactive({
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
})
const filters = reactive<{
  unreadOnly: boolean
  type: NotificationType | ''
}>({
  unreadOnly: false,
  type: '',
})

const loading = computed(() => items.value === null)
const empty = computed(() => !loading.value && (items.value?.length ?? 0) === 0)

const typeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: NotificationType.ORDER_CREATED, label: 'Compras' },
  { value: NotificationType.ORDER_STATUS_CHANGED, label: 'Cambios de estado' },
  { value: NotificationType.USER_REGISTERED, label: 'Registros' },
]

function formatRelative(dateValue: string): string {
  const date = new Date(dateValue)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'Hace instantes'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  return `Hace ${diffDays} d`
}

function typeLabel(type: NotificationType): string {
  if (type === NotificationType.ORDER_CREATED) return 'Compra'
  if (type === NotificationType.ORDER_STATUS_CHANGED) return 'Estado'
  return 'Registro'
}

function typeColor(type: NotificationType): 'primary' | 'success' | 'warning' {
  if (type === NotificationType.ORDER_CREATED) return 'success'
  if (type === NotificationType.ORDER_STATUS_CHANGED) return 'warning'
  return 'primary'
}

async function load(page = meta.page) {
  items.value = null

  try {
    const data = await notificationsService.list({
      page,
      limit: meta.limit,
      unreadOnly: filters.unreadOnly || undefined,
      type: filters.type || undefined,
    })

    items.value = data.items as Notification[]
    meta.total = data.meta.total
    meta.page = data.meta.page
    meta.limit = data.meta.limit
    meta.totalPages = data.meta.totalPages
    unreadCount.value = data.unreadCount
  } catch {
    items.value = []
    toast.error('Error', 'No se pudo cargar el historial de notificaciones')
  }
}

async function markAsRead(item: Notification) {
  if (item.isRead) {
    return
  }

  await notificationsService.markAsRead(item.id)
  item.isRead = true
  item.readAt = new Date().toISOString()
  unreadCount.value = Math.max(0, unreadCount.value - 1)
  await notificationsStore.fetchLatest({ type: notificationsStore.activeTypeFilter })
}

async function markAllAsRead() {
  if (unreadCount.value <= 0) {
    return
  }

  await notificationsService.markAllAsRead()
  items.value = (items.value ?? []).map((item) => ({
    ...item,
    isRead: true,
    readAt: item.readAt ?? new Date().toISOString(),
  }))
  unreadCount.value = 0
  await notificationsStore.fetchLatest({ type: notificationsStore.activeTypeFilter })
}

function applyFilters() {
  void load(1)
}

function goToPage(page: number) {
  if (page < 1 || page > meta.totalPages || page === meta.page) {
    return
  }

  void load(page)
}

onMounted(() => {
  void load(1)
})
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <div>
          <h2 class="text-heading-2">Historial de notificaciones</h2>
          <p class="text-sm text-surface-600">
            Tienes {{ unreadCount }} notificaciones sin leer.
          </p>
        </div>
      </template>
      <template #actions>
        <UiButton :disabled="unreadCount <= 0" @click="markAllAsRead">
          Marcar todas como leidas
        </UiButton>
      </template>
    </ListViewToolbar>

    <UiCard :padding="false">
      <div class="p-4 border-b border-surface-200 flex flex-col sm:flex-row gap-3">
        <UiSelect
          v-model="filters.type"
          label="Filtrar por tipo"
          size="sm"
          :options="typeOptions"
          class="sm:min-w-60"
          @update:model-value="applyFilters"
        />
        <FormToggleField v-model="filters.unreadOnly" label="Solo no leidas" size="sm" @update:model-value="applyFilters" />
      </div>

      <UiTable :data="items" :loading="loading" :empty="empty" loading-text="Cargando notificaciones..." empty-message="No hay notificaciones para este filtro">
        <template #head>
          <tr>
            <th class="table-th">Tipo</th>
            <th class="table-th">Mensaje</th>
            <th class="table-th">Fecha</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="item in items ?? []" :key="item.id" class="table-tr-hover">
          <td class="table-td">
            <UiBadge :color="typeColor(item.type)" dot>{{ typeLabel(item.type) }}</UiBadge>
          </td>
          <td class="table-td">
            <p class="font-medium text-surface-900">{{ item.title }}</p>
            <p class="text-xs text-surface-600 mt-1">{{ item.message }}</p>
          </td>
          <td class="table-td text-xs text-surface-600">
            <p>{{ formatRelative(item.createdAt) }}</p>
            <p>{{ new Date(item.createdAt).toLocaleString('es-AR') }}</p>
          </td>
          <td class="table-td text-center">
            <UiBadge :color="item.isRead ? 'neutral' : 'primary'" dot>
              {{ item.isRead ? 'Leida' : 'No leida' }}
            </UiBadge>
          </td>
          <td class="table-td table-actions-td text-right">
            <UiButton
              v-if="!item.isRead"
              variant="ghost"
              size="sm"
              @click="markAsRead(item)"
            >
              Marcar leida
            </UiButton>
            <router-link
              v-if="item.link"
              :to="item.link"
              class="btn-base btn-ghost btn-sm"
            >
              Ver
            </router-link>
          </td>
        </tr>
      </UiTable>

      <div class="p-4 border-t border-surface-200">
        <UiPagination
          :page="meta.page"
          :total-pages="meta.totalPages"
          :total="meta.total"
          @change="goToPage"
        />
      </div>
    </UiCard>
  </div>
</template>
