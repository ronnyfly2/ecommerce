<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useNotificationsStore } from '@/stores/notifications'
import { NotificationType } from '@/types/api'

const ui    = useUiStore()
const route = useRoute()
const router = useRouter()
const notifications = useNotificationsStore()
const menuRef = ref<HTMLElement | null>(null)
const notificationButtonRef = ref<HTMLButtonElement | null>(null)
const notificationPanelRef = ref<HTMLElement | null>(null)
const panelOpen = ref(false)
const panelId = `notifications-panel-${Math.random().toString(36).slice(2, 10)}`
const typeOptions: Array<{ value: '' | NotificationType; label: string }> = [
  { value: '', label: 'Todas' },
  { value: NotificationType.ORDER_CREATED, label: 'Compras' },
  { value: NotificationType.ORDER_STATUS_CHANGED, label: 'Estados' },
  { value: NotificationType.USER_REGISTERED, label: 'Registros' },
]

const title = computed(() => String(route.meta.title ?? 'Admin Panel'))

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

function closeNotifications(options?: { restoreFocus?: boolean }) {
  panelOpen.value = false
  if (options?.restoreFocus !== false) {
    notificationButtonRef.value?.focus()
  }
}

function notificationButtonLabel() {
  if (notifications.unreadCount <= 0) return 'Notificaciones'
  return `Notificaciones, ${notifications.unreadCount} sin leer`
}

function toggleNotifications() {
  panelOpen.value = !panelOpen.value
  if (panelOpen.value && !notifications.initialized) {
    void notifications.fetchLatest({ type: notifications.activeTypeFilter })
  }
}

function handleTypeFilterChange(type: '' | NotificationType) {
  notifications.setTypeFilter(type)
  void notifications.fetchLatest({ type })
}

async function handleMarkAllRead() {
  await notifications.markAllAsRead()
}

async function handleNotificationClick(id: string, link: string | null) {
  await notifications.markAsRead(id)
  closeNotifications({ restoreFocus: false })

  if (link) {
    await router.push(link)
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!panelOpen.value || !menuRef.value) {
    return
  }

  const target = event.target as Node | null
  if (target && !menuRef.value.contains(target)) {
    closeNotifications({ restoreFocus: false })
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (!panelOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeNotifications()
  }
}

watch(panelOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    notificationPanelRef.value?.focus()
  }
})

onMounted(() => {
  notifications.startRealtime()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  notifications.stopRealtime()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <header
    :class="[
      'fixed top-0 right-0 left-0 h-16 bg-surface-100 border-b border-surface-200 flex items-center px-4 gap-4 transition-all duration-300 z-40',
      ui.sidebarCollapsed ? 'lg:left-16' : 'lg:left-65',
    ]"
  >
    <!-- Toggle sidebar (desktop) -->
    <button
      class="btn-base btn-ghost btn-sm p-2 hidden lg:flex"
      :aria-label="ui.sidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'"
      @click="ui.toggleSidebar"
      :title="ui.sidebarCollapsed ? 'Expandir' : 'Colapsar'"
    >
      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>

    <!-- Toggle sidebar (mobile) -->
    <button
      class="btn-base btn-ghost btn-sm p-2 lg:hidden"
      aria-label="Abrir menú lateral"
      @click="ui.toggleMobileSidebar"
    >
      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>

    <h1 class="text-heading-3 text-base">{{ title }}</h1>

    <div class="ml-auto flex items-center gap-2">
      <div ref="menuRef" class="relative">
        <button
          ref="notificationButtonRef"
          class="btn-base btn-ghost btn-sm p-2 relative"
          title="Notificaciones"
          :aria-label="notificationButtonLabel()"
          :aria-controls="panelOpen ? panelId : undefined"
          :aria-expanded="panelOpen ? 'true' : 'false'"
          aria-haspopup="dialog"
          @click.stop="toggleNotifications"
        >
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9a6 6 0 00-12 0v.05c0 .243 0 .487-.002.7A8.967 8.967 0 013.69 15.77a23.848 23.848 0 005.454 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span
            v-if="notifications.unreadCount > 0"
            class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center"
            aria-hidden="true"
          >
            {{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}
          </span>
        </button>

        <div
          v-if="panelOpen"
          :id="panelId"
          ref="notificationPanelRef"
          class="absolute right-0 mt-2 w-85 max-w-[90vw] bg-surface-0 border border-surface-200 rounded-xl shadow-xl overflow-hidden"
          role="dialog"
          aria-modal="false"
          aria-label="Panel de notificaciones"
          tabindex="-1"
        >
          <div class="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-surface-900">Notificaciones</h3>
            <div class="flex items-center gap-1">
              <button
                class="btn-base btn-ghost btn-sm px-2 py-1 text-xs"
                :disabled="!notifications.hasUnread"
                @click="handleMarkAllRead"
              >
                Marcar todas
              </button>
              <button
                class="btn-base btn-ghost btn-sm px-2 py-1 text-xs"
                @click="router.push({ name: 'notifications' }); panelOpen = false"
              >
                Historial
              </button>
            </div>
          </div>

          <div class="px-3 py-2 border-b border-surface-200 flex gap-1 overflow-x-auto">
            <button
              v-for="option in typeOptions"
              :key="option.label"
              class="px-2.5 py-1 text-xs rounded-full border whitespace-nowrap"
              :aria-pressed="notifications.activeTypeFilter === option.value ? 'true' : 'false'"
              :class="notifications.activeTypeFilter === option.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-surface-0 text-surface-700 border-surface-300'"
              @click="handleTypeFilterChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <div v-if="notifications.loading" class="p-4 text-sm text-surface-500">
            Cargando...
          </div>

          <div
            v-else-if="notifications.items.length === 0"
            class="p-4 text-sm text-surface-500"
          >
            No hay notificaciones recientes.
          </div>

          <ul v-else class="max-h-105 overflow-y-auto divide-y divide-surface-200">
            <li
              v-for="item in notifications.items"
              :key="item.id"
            >
              <button
                type="button"
                class="w-full px-4 py-3 text-left hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px]"
                :aria-label="`${item.title}. ${item.message}. ${formatRelative(item.createdAt)}`"
                @click="handleNotificationClick(item.id, item.link)"
              >
                <div class="flex items-start gap-2">
                  <span
                    class="mt-1 w-2 h-2 rounded-full"
                    :class="item.isRead ? 'bg-surface-300' : 'bg-primary-500'"
                    aria-hidden="true"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-surface-900 truncate">{{ item.title }}</p>
                    <p class="text-xs text-surface-600 mt-0.5">{{ item.message }}</p>
                    <p class="text-[11px] text-surface-500 mt-1">{{ formatRelative(item.createdAt) }}</p>
                  </div>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <slot />
    </div>
  </header>
</template>
