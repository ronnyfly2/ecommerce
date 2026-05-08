<script setup lang="ts">
import type { CategoryStripProps } from '~/types/template'

defineProps<{
  props: CategoryStripProps
}>()
</script>

<template>
  <section class="py-8" :style="{ backgroundColor: props.backgroundColor || '#ffffff' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 v-if="props.title" class="text-xl font-semibold mb-6" :style="{ color: props.titleColor || '#1f2937' }">
        {{ props.title }}
      </h2>
      <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        <NuxtLink
          v-for="cat in props.categories"
          :key="cat.slug"
          :to="`/category/${cat.slug}`"
          class="flex-shrink-0 flex flex-col items-center gap-2 group w-20"
        >
          <div
            class="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center border group-hover:border-primary-400 transition-colors"
            :style="{
              backgroundColor: props.itemBackgroundColor || '#f3f4f6',
              borderColor: props.itemBorderColor || '#e5e7eb'
            }"
          >
            <img
              v-if="cat.imageUrl"
              :src="cat.imageUrl"
              :alt="cat.label"
              class="w-full h-full object-cover"
            />
            <span v-else-if="cat.icon" class="text-2xl">{{ cat.icon }}</span>
            <span v-else class="text-xs text-gray-400 text-center leading-tight px-1">
              {{ cat.label }}
            </span>
          </div>
          <span
            class="text-xs text-center group-hover:text-primary-600 font-medium leading-tight"
            :style="{ color: props.itemTextColor || '#4b5563' }"
          >
            {{ cat.label }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
