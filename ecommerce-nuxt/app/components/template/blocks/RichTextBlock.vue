<script setup lang="ts">
import type { RichTextProps } from '~/types/template'

defineProps<{
  props: RichTextProps
}>()
</script>

<template>
  <UContainer class="py-8">
    <h2 v-if="props.title" class="text-xl font-semibold mb-3">
      {{ props.title }}
    </h2>
    <div class="prose dark:prose-invert max-w-none" v-html="props.body" />
  </UContainer>
</template>
