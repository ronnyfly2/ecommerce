<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Role } from '@/types/api'
import {
  BACKOFFICE_ROLES,
  CATALOG_MANAGE_ROLES,
  COUPON_READ_ROLES,
  CURRENCY_MANAGE_ROLES,
  INVENTORY_READ_ROLES,
  ORDER_READ_ROLES,
  PRODUCT_READ_ROLES,
  USER_READ_ROLES,
} from '@/utils/permissions'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()
const ui     = useUiStore()

interface NavItem {
  name: string
  label: string
  icon: string
  roles?: readonly Role[]
}

const nav: NavItem[] = [
  {
    name: 'dashboard',
    label: 'Dashboard',
    roles: BACKOFFICE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>`,
  },
  {
    name: 'products',
    label: 'Productos',
    roles: PRODUCT_READ_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>`,
  },
  {
    name: 'orders',
    label: 'Órdenes',
    roles: ORDER_READ_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>`,
  },
  {
    name: 'notifications',
    label: 'Notificaciones',
    roles: BACKOFFICE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9a6 6 0 00-12 0v.05c0 .243 0 .487-.002.7A8.967 8.967 0 013.69 15.77a23.848 23.848 0 005.454 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>`,
  },
  {
    name: 'coupons',
    label: 'Cupones',
    roles: COUPON_READ_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>`,
  },
  {
    name: 'inventory',
    label: 'Inventario',
    roles: INVENTORY_READ_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>`,
  },
  {
    name: 'users',
    label: 'Usuarios',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>`,
    roles: USER_READ_ROLES,
  },
]

const catalogNav: NavItem[] = [
  {
    name: 'categories',
    label: 'Categorías',
    roles: CATALOG_MANAGE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/>`,
  },
  {
    name: 'sizes',
    label: 'Tallas',
    roles: CATALOG_MANAGE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/>`,
  },
  {
    name: 'colors',
    label: 'Colores',
    roles: CATALOG_MANAGE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z"/>`,
  },
  {
    name: 'currencies',
    label: 'Tipo de moneda',
    roles: CURRENCY_MANAGE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25c-1.657 0-3 .84-3 1.875S10.343 12 12 12s3-.84 3-1.875-1.343-1.875-3-1.875z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 12c-1.657 0-3 .84-3 1.875S10.343 15.75 12 15.75s3-.84 3-1.875"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75c-1.657 0-3 .84-3 1.875S10.343 19.5 12 19.5s3-.84 3-1.875V10.125M4.5 6.75v10.5A2.25 2.25 0 006.75 19.5h10.5A2.25 2.25 0 0019.5 17.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75z"/>`,
  },
  {
    name: 'tags',
    label: 'Tags',
    roles: CATALOG_MANAGE_ROLES,
    icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/>`,
  },
]

function isActive(name: string) {
  return route.name === name || String(route.name).startsWith(name + '-')
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <!-- Overlay móvil -->
  <Transition name="fade">
    <div
      v-if="ui.sidebarMobileOpen"
      class="fixed inset-0 bg-black/50 z-[--z-overlay] lg:hidden"
      style="z-index: var(--z-overlay)"
      @click="ui.closeMobileSidebar"
    />
  </Transition>

  <!-- Sidebar -->
  <aside
    :class="[
      'fixed top-0 left-0 h-full bg-[--color-surface-0] border-r border-[--color-surface-200] flex flex-col transition-all duration-300 z-[--z-sticky]',
      ui.sidebarCollapsed ? 'w-16' : 'w-[260px]',
      ui.sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
    style="z-index: var(--z-sticky)"
  >
    <!-- Logo -->
    <div class="flex items-center gap-3 px-4 h-16 border-b border-[--color-surface-200] shrink-0">
      <div class="w-8 h-8 rounded-lg bg-[--color-primary-600] flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
        </svg>
      </div>
      <Transition name="fade">
        <span v-if="!ui.sidebarCollapsed" class="font-semibold text-[--color-surface-900] text-sm whitespace-nowrap">
          Admin Panel
        </span>
      </Transition>
    </div>

    <!-- Nav principal -->
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      <template v-for="item in nav" :key="item.name">
        <router-link
          v-if="auth.canAccessRoles(item.roles)"
          :to="{ name: item.name }"
          :class="['sidebar-item', isActive(item.name) ? 'sidebar-item-active' : '']"
          :title="ui.sidebarCollapsed ? item.label : undefined"
          @click="ui.closeMobileSidebar"
        >
          <svg class="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" v-html="item.icon" />
          <Transition name="fade">
            <span v-if="!ui.sidebarCollapsed">{{ item.label }}</span>
          </Transition>
        </router-link>
      </template>

      <!-- Catálogo -->
      <div class="pt-3">
        <p
          v-if="!ui.sidebarCollapsed"
          class="text-caption uppercase tracking-wider px-3 mb-1"
        >
          Catálogo
        </p>
        <div v-else class="divider my-2" />
        <template v-for="item in catalogNav" :key="item.name">
          <router-link
            v-if="auth.canAccessRoles(item.roles)"
            :to="{ name: item.name }"
            :class="['sidebar-item', isActive(item.name) ? 'sidebar-item-active' : '']"
            :title="ui.sidebarCollapsed ? item.label : undefined"
            @click="ui.closeMobileSidebar"
          >
            <svg class="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" v-html="item.icon" />
            <Transition name="fade">
              <span v-if="!ui.sidebarCollapsed">{{ item.label }}</span>
            </Transition>
          </router-link>
        </template>
      </div>
    </nav>

    <!-- Footer: usuario + logout -->
    <div class="p-3 border-t border-[--color-surface-200] shrink-0">
      <div
        v-if="!ui.sidebarCollapsed"
        class="flex items-center gap-3 px-3 py-2 rounded-lg"
      >
        <div class="w-8 h-8 rounded-full bg-[--color-primary-100] flex items-center justify-center text-[--color-primary-700] font-semibold text-sm shrink-0">
          {{ auth.fullName.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-[--color-surface-800] truncate">{{ auth.fullName }}</p>
          <p class="text-caption truncate">{{ auth.user?.role }}</p>
        </div>
        <router-link
          :to="{ name: 'profile' }"
          class="btn-base btn-ghost btn-sm p-1"
          title="Perfil y sesiones"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </router-link>
        <button
          class="btn-base btn-ghost btn-sm p-1"
          title="Cerrar sesión"
          @click="handleLogout"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
        </button>
      </div>
      <button
        v-else
        class="sidebar-item w-full justify-center"
        title="Perfil y sesiones"
        @click="router.push({ name: 'profile' })"
      >
        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <button
        v-if="ui.sidebarCollapsed"
        class="sidebar-item w-full justify-center"
        title="Cerrar sesión"
        @click="handleLogout"
      >
        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
      </button>
    </div>
  </aside>
</template>
