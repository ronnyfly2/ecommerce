<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'

const ui    = useUiStore()
const route = useRoute()

const title = computed(() => String(route.meta.title ?? 'Admin Panel'))
</script>

<template>
  <header
    :class="[
      'fixed top-0 right-0 left-0 h-16 bg-[--color-surface-0] border-b border-[--color-surface-200] flex items-center px-4 gap-4 transition-all duration-300 z-40',
      ui.sidebarCollapsed ? 'lg:left-16' : 'lg:left-[260px]',
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
      <slot />
    </div>
  </header>
</template>
