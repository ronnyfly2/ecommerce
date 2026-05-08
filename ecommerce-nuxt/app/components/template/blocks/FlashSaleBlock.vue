<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FlashSaleProps } from '~/types/template'

const input = defineProps<{
  props: FlashSaleProps
}>()

const timeLeft = ref({ h: '00', m: '00', s: '00' })
let timer: ReturnType<typeof setInterval> | null = null

function calcTimeLeft() {
  if (!input.props.endTime) return
  const diff = Math.max(0, new Date(input.props.endTime).getTime() - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  timeLeft.value = {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  }
}

onMounted(() => {
  if (input.props.endTime) {
    calcTimeLeft()
    timer = setInterval(calcTimeLeft, 1000)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const items = computed(() => {
  const limit = input.props.limit ?? 6
  const prefix =
    input.props.source === 'by_category'
      ? input.props.categorySlug ?? 'cat'
      : input.props.source === 'new_arrivals'
        ? 'new'
        : 'sale'

  return Array.from({ length: limit }).map((_, i) => ({
    id: `${prefix}-${i + 1}`,
    name: `Producto ${i + 1}`,
    price: ((i + 1) * 12.99).toFixed(2),
    originalPrice: ((i + 1) * 19.99).toFixed(2),
    imageUrl: `${input.props.placeholderImageBaseUrl || 'https://picsum.photos/seed'}/${prefix}-flash-${i + 1}/480/480`,
    sold: Math.floor(Math.random() * 200),
    available: Math.floor(Math.random() * 150) + 50,
  }))
})
</script>

<template>
  <section class="py-8" :style="{ backgroundColor: props.backgroundColor || '#ffffff' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 class="text-xl font-bold flex items-center gap-2" :style="{ color: props.titleColor || '#1f2937' }">
          <span class="text-red-500">⚡</span>
          {{ props.title ?? 'Flash Sale' }}
        </h2>
        <div v-if="props.endTime" class="flex items-center gap-1 text-sm font-semibold">
          <span class="text-gray-500 mr-1">Termina en:</span>
          <span class="px-2 py-1 rounded" :style="{ backgroundColor: props.timerBackgroundColor || '#1f2937', color: props.timerTextColor || '#ffffff' }">{{ timeLeft.h }}</span>
          <span class="text-gray-600">:</span>
          <span class="px-2 py-1 rounded" :style="{ backgroundColor: props.timerBackgroundColor || '#1f2937', color: props.timerTextColor || '#ffffff' }">{{ timeLeft.m }}</span>
          <span class="text-gray-600">:</span>
          <span class="px-2 py-1 rounded" :style="{ backgroundColor: props.timerBackgroundColor || '#1f2937', color: props.timerTextColor || '#ffffff' }">{{ timeLeft.s }}</span>
        </div>
      </div>

      <!-- Products -->
      <div class="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <div
          v-for="item in items"
          :key="item.id"
          class="border rounded-xl p-3 hover:shadow-md transition-shadow flex flex-col gap-2"
          :style="{ backgroundColor: props.cardBackgroundColor || '#ffffff', borderColor: props.cardBorderColor || '#e5e7eb' }"
        >
          <img :src="item.imageUrl" :alt="item.name" class="aspect-square rounded-lg object-cover">
          <p class="text-xs font-medium text-gray-700 leading-tight line-clamp-2">{{ item.name }}</p>
          <div class="flex items-baseline gap-1">
            <span class="text-sm font-bold" :style="{ color: props.priceColor || '#ef4444' }">${{ item.price }}</span>
            <span class="text-xs text-gray-400 line-through">${{ item.originalPrice }}</span>
          </div>
          <!-- Progress bar sold/available -->
          <div>
            <div class="flex justify-between text-xs text-gray-400 mb-1">
              <span>Vendido: {{ item.sold }}</span>
              <span>{{ item.available }} disp.</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div
                class="h-1.5 rounded-full"
                :style="{
                  backgroundColor: props.progressColor || '#f87171',
                  width: `${Math.min(100, (item.sold / (item.sold + item.available)) * 100)}%`
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
