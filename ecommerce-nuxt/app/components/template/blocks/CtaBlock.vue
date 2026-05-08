<script setup lang="ts">
import type { CtaProps } from '~/types/template'

defineProps<{
  props: CtaProps
}>()
</script>

<template>
  <UContainer class="py-8">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ props.title }}
        </h3>
      </template>

      <p v-if="props.description" class="mb-4 text-neutral-600 dark:text-neutral-300">
        {{ props.description }}
      </p>

      <UButton :to="props.buttonHref" trailing-icon="i-lucide-arrow-right">
        {{ props.buttonLabel }}
      </UButton>
    </UCard>
  </UContainer>
</template>
