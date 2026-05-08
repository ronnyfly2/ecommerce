<script setup lang="ts">
import { computed } from 'vue'
import type { BannerProps } from '~/types/template'

const input = defineProps<{
  props: BannerProps
}>()

const color = computed(() => {
  if (input.props.tone === 'success') return 'success'
  if (input.props.tone === 'warning') return 'warning'
  if (input.props.tone === 'danger') return 'error'
  return 'info'
})
</script>

<template>
  <UContainer class="py-4">
    <UAlert :color="color" :description="props.text" variant="soft" />
  </UContainer>
</template>
