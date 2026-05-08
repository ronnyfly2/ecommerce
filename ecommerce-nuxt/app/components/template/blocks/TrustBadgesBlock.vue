<script setup lang="ts">
import type { TrustBadgesProps } from '~/types/template'

defineProps<{
  props: TrustBadgesProps
}>()
</script>

<template>
  <section class="py-10 border-y" :style="{ backgroundColor: props.backgroundColor || '#ffffff', borderColor: '#f3f4f6' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div
        class="grid gap-6"
        :class="{
          'grid-cols-2 sm:grid-cols-4': props.badges.length === 4,
          'grid-cols-1 sm:grid-cols-3': props.badges.length === 3,
          'grid-cols-2': props.badges.length === 2,
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4': props.badges.length > 4,
        }"
      >
        <div
          v-for="(badge, i) in props.badges"
          :key="i"
          class="flex flex-col items-center text-center gap-3 px-4"
        >
          <div class="w-12 h-12 flex items-center justify-center text-3xl">
            <span v-if="badge.icon">{{ badge.icon }}</span>
            <span v-else class="text-primary-500">✓</span>
          </div>
          <div>
            <p class="font-semibold text-sm" :style="{ color: props.titleColor || '#1f2937' }">{{ badge.title }}</p>
            <p v-if="badge.description" class="text-xs mt-1 leading-relaxed" :style="{ color: props.textColor || '#6b7280' }">
              {{ badge.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
