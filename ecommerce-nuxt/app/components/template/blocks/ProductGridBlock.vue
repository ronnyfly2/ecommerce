<script setup lang="ts">
import { computed } from 'vue'
import type { ProductGridProps } from '~/types/template'

const input = defineProps<{
  props: ProductGridProps
}>()

const items = computed(() => {
  const limit = input.props.limit ?? 8
  const prefix = input.props.source === 'by_category'
    ? `Categoria: ${input.props.categorySlug ?? 'general'}`
    : input.props.source === 'new_arrivals'
      ? 'Nuevo'
      : 'Destacado'

  return Array.from({ length: limit }).map((_, index) => ({
    id: `${prefix}-${index + 1}`,
    name: `${prefix} producto ${index + 1}`,
    price: ((index + 1) * 5).toFixed(2),
    imageUrl: `${input.props.placeholderImageBaseUrl || 'https://picsum.photos/seed'}/${prefix}-${index + 1}/480/480`
  }))
})
</script>

<template>
  <section class="py-8" :style="{ backgroundColor: props.backgroundColor || '#ffffff' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-xl font-semibold mb-4" :style="{ color: props.titleColor || '#111827' }">
      {{ props.title ?? 'Productos' }}
    </h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article
        v-for="item in items"
        :key="item.id"
        class="rounded-xl overflow-hidden border"
        :style="{
          backgroundColor: props.cardBackgroundColor || '#ffffff',
          borderColor: props.cardBorderColor || '#e5e7eb'
        }"
      >
        <img :src="item.imageUrl" :alt="item.name" class="w-full aspect-square object-cover">
        <div class="p-3">
          <h3 class="text-sm font-semibold text-gray-800 line-clamp-2">{{ item.name }}</h3>
          <div class="text-xs text-neutral-500 mt-1 mb-2">
            SKU: {{ item.id }}
          </div>
          <div class="font-semibold" :style="{ color: props.priceColor || '#dc2626' }">
            ${{ item.price }}
          </div>
        </div>
      </article>
    </div>
    </div>
  </section>
</template>
