<script setup lang="ts">
import type { BrandCarouselProps } from '~/types/template'

defineProps<{
  props: BrandCarouselProps
}>()
</script>

<template>
  <section class="py-8 border-y" :style="{ backgroundColor: props.backgroundColor || '#f9fafb', borderColor: props.cardBorderColor || '#f3f4f6' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 v-if="props.title" class="text-xl font-semibold mb-6 text-center" :style="{ color: props.titleColor || '#1f2937' }">
        {{ props.title }}
      </h2>
      <div class="flex gap-6 overflow-x-auto pb-2 items-center justify-start sm:justify-center scrollbar-hide flex-wrap">
        <NuxtLink
          v-for="brand in props.brands"
          :key="brand.name"
          :to="brand.slug ? `/search?brand=${brand.slug}` : '#'"
          class="flex-shrink-0 flex flex-col items-center gap-1 group"
        >
          <div
            class="h-14 w-28 rounded-lg border flex items-center justify-center px-3 group-hover:border-primary-400 group-hover:shadow-sm transition-all"
            :style="{ backgroundColor: props.cardBackgroundColor || '#ffffff', borderColor: props.cardBorderColor || '#e5e7eb' }"
          >
            <img
              v-if="brand.logoUrl"
              :src="brand.logoUrl"
              :alt="brand.name"
              class="max-h-8 max-w-full object-contain grayscale group-hover:grayscale-0 transition-all"
            />
            <span v-else class="text-sm font-semibold text-gray-500 group-hover:text-primary-600 text-center">
              {{ brand.name }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
