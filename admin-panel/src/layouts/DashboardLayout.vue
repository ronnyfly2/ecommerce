<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import AppSidebar from '@/components/shared/AppSidebar.vue'
import AppTopbar  from '@/components/shared/AppTopbar.vue'
import UiToastContainer from '@/components/ui/UiToastContainer.vue'

const ui = useUiStore()
</script>

<template>
  <div class="min-h-screen bg-[--color-surface-100]">
    <AppSidebar />
    <AppTopbar />

    <!-- Main content -->
    <main
      :class="[
        'pt-16 min-h-screen transition-all duration-300',
        ui.sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-[260px]',
      ]"
    >
      <div class="p-6">
        <router-view />
      </div>
    </main>

    <UiToastContainer />
  </div>
</template>
