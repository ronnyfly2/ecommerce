<script setup lang="ts">
import { computed } from 'vue'
import { templateRegistry } from '~/components/template/registry'
import type { TemplateDocument } from '~/types/template'

const props = defineProps<{
  template: TemplateDocument
}>()

const orderedSections = computed(() =>
  [...props.template.sections].sort((a, b) => a.order - b.order)
)

function sectionLayoutClass(layoutWidth?: 'basic' | 'wide' | 'full'): string {
  if (layoutWidth === 'wide') return 'template-section-layout-wide'
  if (layoutWidth === 'full') return 'template-section-layout-full'
  return 'template-section-layout-basic'
}

function sectionSpacingClass(spacingY?: 'default' | 'compact' | 'none'): string {
  if (spacingY === 'none') return 'template-section-spacing-none'
  if (spacingY === 'compact') return 'template-section-spacing-compact'
  return 'template-section-spacing-default'
}

function sectionSpacingXClass(spacingX?: 'default' | 'compact' | 'none'): string {
  if (spacingX === 'none') return 'template-section-spacing-x-none'
  if (spacingX === 'compact') return 'template-section-spacing-x-compact'
  return 'template-section-spacing-x-default'
}
</script>

<template>
  <div>
    <div
      v-for="section in orderedSections"
      :key="section.id"
      :class="[
        sectionLayoutClass(section.layoutWidth),
        sectionSpacingClass(section.spacingY),
        sectionSpacingXClass(section.spacingX),
      ]"
    >
      <component
        :is="templateRegistry[section.componentKey]"
        :props="section.props"
      />
    </div>
  </div>
</template>

<style scoped>
.template-section-layout-wide :deep(.max-w-7xl),
.template-section-layout-wide :deep(.max-w-6xl),
.template-section-layout-wide :deep(.container) {
  max-width: 88rem;
}

.template-section-layout-full :deep(.max-w-7xl),
.template-section-layout-full :deep(.max-w-6xl),
.template-section-layout-full :deep(.container) {
  max-width: none;
  width: 100%;
}

.template-section-spacing-none > * {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.template-section-spacing-compact > * {
  padding-top: 1rem !important;
  padding-bottom: 1rem !important;
}

.template-section-spacing-x-none :deep(.px-4),
.template-section-spacing-x-none :deep(.sm\:px-6),
.template-section-spacing-x-none :deep(.lg\:px-8),
.template-section-spacing-x-none :deep(.container),
.template-section-spacing-x-none :deep([class*='px-']) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.template-section-spacing-x-compact :deep(.px-4),
.template-section-spacing-x-compact :deep(.sm\:px-6),
.template-section-spacing-x-compact :deep(.lg\:px-8),
.template-section-spacing-x-compact :deep(.container),
.template-section-spacing-x-compact :deep([class*='px-']) {
  padding-left: 0.75rem !important;
  padding-right: 0.75rem !important;
}
</style>
