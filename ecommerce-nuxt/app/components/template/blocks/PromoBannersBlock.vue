<script setup lang="ts">
import type { PromoBannersProps } from '~/types/template'

defineProps<{
  props: PromoBannersProps
}>()

function positionClass(pos?: string) {
  switch (pos) {
    case 'top-left': return 'items-start justify-start'
    case 'center': return 'items-center justify-center text-center'
    case 'bottom-right': return 'items-end justify-end text-right'
    case 'bottom-left':
    default: return 'items-end justify-start'
  }
}
</script>

<template>
  <section class="py-8" :style="{ backgroundColor: props.backgroundColor || '#ffffff' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div
        class="grid gap-4"
        :class="props.columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'"
      >
        <NuxtLink
          v-for="(banner, i) in props.banners"
          :key="i"
          :to="banner.href ?? '#'"
          class="relative overflow-hidden rounded-xl aspect-[4/3] sm:aspect-[3/2] bg-gray-200 flex group"
        >
          <img
            v-if="banner.imageUrl"
            :src="banner.imageUrl"
            :alt="banner.title ?? ''"
            class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <!-- Overlay gradient -->
          <div
            class="absolute inset-0"
            :style="{ background: `linear-gradient(to top, ${props.overlayColor || 'rgba(0,0,0,0.5)'}, transparent)` }"
          />
          <!-- Text overlay -->
          <div
            v-if="banner.title || banner.subtitle"
            class="relative z-10 flex flex-col gap-1 p-5 w-full"
            :class="positionClass(banner.textPosition)"
          >
            <p v-if="banner.subtitle" class="text-xs font-medium text-white/80 uppercase tracking-wider">
              {{ banner.subtitle }}
            </p>
            <h3 class="text-lg sm:text-xl font-bold text-white drop-shadow leading-tight">
              {{ banner.title }}
            </h3>
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
