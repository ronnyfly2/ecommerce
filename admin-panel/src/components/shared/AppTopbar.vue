<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useNotificationsStore } from '@/stores/notifications'
import { NotificationType } from '@/types/api'

const ui    = useUiStore()
const route = useRoute()
const router = useRouter()
const notifications = useNotificationsStore()
const menuRef = ref<HTMLElement | null>(null)
const panelOpen = ref(false)
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
  panelOpen.value = false

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
    panelOpen.value = false
  }
}

onMounted(() => {
  notifications.startRealtime()
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  notifications.stopRealtime()
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <header
    :class="[
      'fixed top-0 right-0 left-0 h-16 bg-[--color-surface-0] border-b border-[--color-surface-200] flex items-center px-4 gap-4 transition-all duration-300 z-40',
      ui.sidebarCollapsed ? 'lg:left-16' : 'lg:left-65',
    ]"
    style="z-index: 40"
  >
    <!-- Toggle sidebar (desktop) -->
    <button
      class="btn-base btn-ghost btn-sm p-2 hidden lg:flex"
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
          class="btn-base btn-ghost btn-sm p-2 relative"
          title="Notificaciones"
          @click.stop="toggleNotifications"
        >
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9a6 6 0 00-12 0v.05c0 .243 0 .487-.002.7A8.967 8.967 0 013.69 15.77a23.848 23.848 0 005.454 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span
            v-if="notifications.unreadCount > 0"
            class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center"
          >
            {{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}
          </span>
        </button>

        <div
          v-if="panelOpen"
          class="absolute right-0 mt-2 w-85 max-w-[90vw] bg-[--color-surface-0] border border-[--color-surface-200] rounded-xl shadow-xl overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-[--color-surface-200] flex items-center justify-between">
            <h3 class="text-sm font-semibold text-[--color-surface-900]">Notificaciones</h3>
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

          <div class="px-3 py-2 border-b border-[--color-surface-200] flex gap-1 overflow-x-auto">
            <button
              v-for="option in typeOptions"
              :key="option.label"
              class="px-2.5 py-1 text-xs rounded-full border whitespace-nowrap"
              :class="notifications.activeTypeFilter === option.value
                ? 'bg-[--color-primary-600] text-white border-[--color-primary-600]'
                : 'bg-[--color-surface-0] text-[--color-surface-700] border-[--color-surface-300]'"
              @click="handleTypeFilterChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <div v-if="notifications.loading" class="p-4 text-sm text-[--color-surface-500]">
            Cargando...
          </div>

          <div
            v-else-if="notifications.items.length === 0"
            class="p-4 text-sm text-[--color-surface-500]"
          >
            No hay notificaciones recientes.
          </div>

          <ul v-else class="max-h-105 overflow-y-auto divide-y divide-[--color-surface-200]">
            <li
              v-for="item in notifications.items"
              :key="item.id"
              class="px-4 py-3 hover:bg-[--color-surface-100] cursor-pointer"
              @click="handleNotificationClick(item.id, item.link)"
            >
              <div class="flex items-start gap-2">
                <span
                  class="mt-1 w-2 h-2 rounded-full"
                  :class="item.isRead ? 'bg-[--color-surface-300]' : 'bg-[--color-primary-500]'"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-[--color-surface-900] truncate">{{ item.title }}</p>
                  <p class="text-xs text-[--color-surface-600] mt-0.5">{{ item.message }}</p>
                  <p class="text-[11px] text-[--color-surface-500] mt-1">{{ formatRelative(item.createdAt) }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <slot />
    </div>
  </header>
</template>
