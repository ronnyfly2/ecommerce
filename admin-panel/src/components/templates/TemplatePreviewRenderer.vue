<script setup lang="ts">
import { computed } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiCard from '@/components/ui/UiCard.vue'

interface TemplateSection {
  id: string
  componentKey: 'hero' | 'banner' | 'product-grid' | 'rich-text' | 'cta' | 'category-strip' | 'flash-sale' | 'brand-carousel' | 'trust-badges' | 'promo-banners'
  order: number
  layoutWidth?: 'basic' | 'wide' | 'full'
  spacingY?: 'default' | 'compact' | 'none'
  spacingX?: 'default' | 'compact' | 'none'
  props: Record<string, unknown>
}

interface TemplateDocument {
  meta: {
    templateKey: string
    channel: string
    pageType: string
    schemaVersion: string
  }
  sections: TemplateSection[]
}

const props = defineProps<{
  document: TemplateDocument
}>()

const orderedSections = computed(() =>
  [...props.document.sections].sort((a, b) => a.order - b.order)
)

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

function heroImageStyle(slide: Record<string, unknown>): Record<string, string> {
  const focus = String(slide.imageFocus ?? 'center')
  const zoomRaw = Number(slide.imageZoom ?? 100)
  const zoom = Number.isFinite(zoomRaw) ? Math.min(200, Math.max(100, zoomRaw)) : 100

  const positions: Record<string, string> = {
    center: 'center center',
    top: 'center top',
    bottom: 'center bottom',
    left: 'left center',
    right: 'right center',
    'top-left': 'left top',
    'top-right': 'right top',
    'bottom-left': 'left bottom',
    'bottom-right': 'right bottom',
  }

  const position = positions[focus] || positions.center
  return {
    objectPosition: position,
    transformOrigin: position,
    transform: `scale(${zoom / 100})`,
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UiBadge color="info">{{ document.meta.templateKey }}</UiBadge>
      <UiBadge color="neutral">{{ document.meta.pageType }}</UiBadge>
      <UiBadge color="neutral">schema {{ document.meta.schemaVersion }}</UiBadge>
      <UiBadge color="neutral">{{ orderedSections.length }} secciones</UiBadge>
    </div>

    <div class="space-y-3">
      <UiCard
        v-for="section in orderedSections"
        :key="section.id"
      >
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-semibold">{{ section.componentKey }}</p>
          <p class="text-xs text-muted">order {{ section.order }} · ancho {{ section.layoutWidth ?? 'basic' }} · spacingY {{ section.spacingY ?? 'default' }} · spacingX {{ section.spacingX ?? 'default' }}</p>
        </div>

        <template v-if="section.componentKey === 'hero'">
          <template v-if="asObjectArray(section.props.slides).length > 0">
            <p class="text-xs text-muted mb-2">{{ asObjectArray(section.props.slides).length }} slide(s)</p>
            <div class="rounded-lg border border-surface-200 bg-surface-50 p-3">
              <div class="mb-3 overflow-hidden rounded-md border border-surface-200 bg-surface-100">
                <div v-if="asText(asObjectArray(section.props.slides)[0]?.imageUrl)" class="relative aspect-[16/6]">
                  <img
                    :src="asText(asObjectArray(section.props.slides)[0]?.imageUrl)"
                    alt="Mini preview hero"
                    class="absolute inset-0 h-full w-full object-cover"
                    :style="heroImageStyle(asObjectArray(section.props.slides)[0] ?? {})"
                  >
                </div>
                <div v-else class="flex aspect-[16/6] items-center justify-center text-xs text-surface-500">
                  Sin imagen en el primer slide
                </div>
              </div>

              <h3 class="text-lg font-semibold">
                {{ asText(asObjectArray(section.props.slides)[0]?.title, 'Sin titulo') }}
              </h3>
              <p v-if="asText(asObjectArray(section.props.slides)[0]?.subtitle)" class="text-sm text-muted mt-1">
                {{ asText(asObjectArray(section.props.slides)[0]?.subtitle) }}
              </p>
              <p class="text-xs text-muted mt-2">
                Layout:
                {{ asText(asObjectArray(section.props.slides)[0]?.imageLayout, 'background') }}
                · Ancho:
                {{ asText(asObjectArray(section.props.slides)[0]?.imageWidth, 'half') }}
                · Alineacion:
                {{ asText(asObjectArray(section.props.slides)[0]?.contentAlignment, 'left') }}
                · Ancho texto:
                {{ asText(asObjectArray(section.props.slides)[0]?.contentWidth, 'regular') }}
                · Altura:
                {{ asText(asObjectArray(section.props.slides)[0]?.height, 'tall') }}
                · Altura imagen lateral:
                {{ asText(asObjectArray(section.props.slides)[0]?.sideImageHeight, 'match') }}
                · Enfoque imagen:
                {{ asText(asObjectArray(section.props.slides)[0]?.imageFocus, 'center') }}
                · Zoom:
                {{ asNumber(asObjectArray(section.props.slides)[0]?.imageZoom, 100) }}%
              </p>
            </div>
          </template>

          <template v-else>
            <h3 class="text-lg font-semibold">{{ asText(section.props.title, 'Sin titulo') }}</h3>
            <p v-if="asText(section.props.subtitle)" class="text-sm text-muted mt-1">{{ asText(section.props.subtitle) }}</p>
          </template>
          <a
            v-if="(
              asText(section.props.ctaHref) && asText(section.props.ctaLabel)
            ) || (
              asObjectArray(section.props.slides).length > 0 &&
              asText(asObjectArray(section.props.slides)[0]?.ctaHref) &&
              asText(asObjectArray(section.props.slides)[0]?.ctaLabel)
            )"
            :href="
              asText(section.props.ctaHref)
                ? asText(section.props.ctaHref)
                : asText(asObjectArray(section.props.slides)[0]?.ctaHref)
            "
            class="inline-flex mt-3 text-sm font-medium text-primary-700"
          >
            {{ asText(section.props.ctaLabel) || asText(asObjectArray(section.props.slides)[0]?.ctaLabel) }}
          </a>
        </template>

        <template v-else-if="section.componentKey === 'banner'">
          <div class="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm">
            {{ asText(section.props.text, 'Sin texto de banner') }}
          </div>
        </template>

        <template v-else-if="section.componentKey === 'product-grid'">
          <p class="text-sm font-medium mb-2">{{ asText(section.props.title, 'Productos') }}</p>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div
              v-for="idx in Math.max(1, asNumber(section.props.limit, 6))"
              :key="`${section.id}-${idx}`"
              class="rounded-md border border-surface-200 p-2 text-xs"
            >
              Producto {{ idx }}
            </div>
          </div>
        </template>

        <template v-else-if="section.componentKey === 'rich-text'">
          <h4 v-if="asText(section.props.title)" class="text-sm font-semibold mb-1">{{ asText(section.props.title) }}</h4>
          <div class="text-sm text-surface-700" v-html="asText(section.props.body, '')" />
        </template>

        <template v-else-if="section.componentKey === 'cta'">
          <p class="text-base font-semibold">{{ asText(section.props.title, 'Sin titulo') }}</p>
          <p v-if="asText(section.props.description)" class="text-sm text-muted mt-1">{{ asText(section.props.description) }}</p>
          <a
            v-if="asText(section.props.buttonHref)"
            :href="asText(section.props.buttonHref)"
            class="inline-flex mt-3 text-sm font-medium text-primary-700"
          >
            {{ asText(section.props.buttonLabel, 'Accion') }}
          </a>
        </template>

        <template v-else-if="section.componentKey === 'category-strip'">
          <p class="text-sm font-medium mb-2">{{ asText(section.props.title, 'Categorias') }}</p>
          <div class="flex gap-2 flex-wrap">
            <span
              v-for="(cat, i) in (Array.isArray(section.props.categories) ? section.props.categories : [])"
              :key="i"
              class="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-1 text-xs"
            >
              <span v-if="(cat as Record<string, unknown>).icon">{{ (cat as Record<string, unknown>).icon }}</span>
              {{ asText((cat as Record<string, unknown>).label, '?') }}
            </span>
          </div>
        </template>

        <template v-else-if="section.componentKey === 'flash-sale'">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-bold">⚡ {{ asText(section.props.title, 'Flash Sale') }}</span>
            <span v-if="asText(section.props.endTime)" class="text-xs text-muted">Hasta: {{ asText(section.props.endTime) }}</span>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <div
              v-for="idx in Math.max(1, asNumber(section.props.limit, 6))"
              :key="`flash-${section.id}-${idx}`"
              class="rounded-md border border-surface-200 bg-red-50 p-1 text-xs text-center"
            >
              Producto {{ idx }}
            </div>
          </div>
        </template>

        <template v-else-if="section.componentKey === 'brand-carousel'">
          <p class="text-sm font-medium mb-2">{{ asText(section.props.title, 'Marcas') }}</p>
          <div class="flex gap-2 flex-wrap">
            <span
              v-for="(brand, i) in (Array.isArray(section.props.brands) ? section.props.brands : [])"
              :key="i"
              class="inline-block rounded border border-surface-200 bg-white px-3 py-1 text-xs font-medium"
            >
              {{ asText((brand as Record<string, unknown>).name, '?') }}
            </span>
          </div>
        </template>

        <template v-else-if="section.componentKey === 'trust-badges'">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div
              v-for="(badge, i) in (Array.isArray(section.props.badges) ? section.props.badges : [])"
              :key="i"
              class="flex flex-col items-center text-center p-2 rounded border border-surface-100 bg-surface-50"
            >
              <span v-if="(badge as Record<string, unknown>).icon" class="text-xl mb-1">{{ (badge as Record<string, unknown>).icon }}</span>
              <p class="text-xs font-semibold">{{ asText((badge as Record<string, unknown>).title, '?') }}</p>
            </div>
          </div>
        </template>

        <template v-else-if="section.componentKey === 'promo-banners'">
          <p class="text-xs text-muted mb-2">{{ (Array.isArray(section.props.banners) ? section.props.banners : []).length }} banners · {{ asNumber(section.props.columns, 2) }} columnas</p>
          <div class="grid gap-1" :class="asNumber(section.props.columns, 2) === 3 ? 'grid-cols-3' : 'grid-cols-2'">
            <div
              v-for="(banner, i) in (Array.isArray(section.props.banners) ? section.props.banners : [])"
              :key="i"
              class="aspect-video rounded-md bg-surface-200 flex items-end p-2 relative overflow-hidden"
            >
              <img
                v-if="asText((banner as Record<string, unknown>).imageUrl)"
                :src="asText((banner as Record<string, unknown>).imageUrl)"
                class="absolute inset-0 w-full h-full object-cover opacity-70"
              />
              <p class="relative text-xs font-medium truncate">{{ asText((banner as Record<string, unknown>).title, 'Banner') }}</p>
            </div>
          </div>
        </template>
      </UiCard>
    </div>
  </div>
</template>
