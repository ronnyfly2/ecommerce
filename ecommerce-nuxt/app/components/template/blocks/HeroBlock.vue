<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { HeroProps } from '~/types/template'

const props = defineProps<{
  props: HeroProps
}>()

type ResolvedHeroSlide = {
  title: string
  subtitle?: string
  imageUrl?: string
  ctaLabel?: string
  ctaHref?: string
  imageLayout: 'background' | 'side-left' | 'side-right'
  imageWidth: 'quarter' | 'half'
  height: 'compact' | 'tall' | 'screen'
  sideImageHeight: 'match' | 'compact' | 'tall' | 'screen'
  imageFocus: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  imageZoom: number
  contentAlignment: 'left' | 'center' | 'right'
  contentWidth: 'narrow' | 'regular' | 'wide' | 'full'
  overlayColor?: string
  titleColor: string
  titleBackgroundColor?: string
  titleBackgroundSize: 'fit' | 'wide' | 'full'
  subtitleColor: string
  subtitleBackgroundColor?: string
  subtitleBackgroundSize: 'fit' | 'wide' | 'full'
  buttonBackgroundColor: string
  buttonTextColor: string
  buttonSize: 'sm' | 'md' | 'lg'
}

const currentSlideIndex = ref(0)
let autoPlayTimer: ReturnType<typeof setInterval> | null = null

const slides = computed<ResolvedHeroSlide[]>(() => {
  if (Array.isArray(props.props.slides) && props.props.slides.length > 0) {
    return props.props.slides.map((slide) => ({
      title: slide.title,
      subtitle: slide.subtitle,
      imageUrl: slide.imageUrl,
      ctaLabel: slide.ctaLabel,
      ctaHref: slide.ctaHref,
      imageLayout: slide.imageLayout || 'side-right',
      imageWidth: slide.imageWidth || 'half',
      height: slide.height || 'tall',
      sideImageHeight: slide.sideImageHeight || 'match',
      imageFocus: slide.imageFocus || 'center',
      imageZoom: typeof slide.imageZoom === 'number' ? Math.min(200, Math.max(100, slide.imageZoom)) : 100,
      contentAlignment: slide.contentAlignment || 'left',
      contentWidth: slide.contentWidth || 'regular',
      overlayColor: slide.overlayColor,
      titleColor: slide.titleColor || props.props.titleColor || '#0f172a',
      titleBackgroundColor: slide.titleBackgroundColor,
      titleBackgroundSize: slide.titleBackgroundSize || 'fit',
      subtitleColor: slide.subtitleColor || props.props.subtitleColor || '#475569',
      subtitleBackgroundColor: slide.subtitleBackgroundColor,
      subtitleBackgroundSize: slide.subtitleBackgroundSize || 'fit',
      buttonBackgroundColor: slide.buttonBackgroundColor || props.props.buttonBackgroundColor || '#0f172a',
      buttonTextColor: slide.buttonTextColor || props.props.buttonTextColor || '#ffffff',
      buttonSize: slide.buttonSize || 'md',
    }))
  }

  return [
    {
      title: props.props.title,
      subtitle: props.props.subtitle,
      imageUrl: props.props.imageUrl,
      ctaLabel: props.props.ctaLabel,
      ctaHref: props.props.ctaHref,
      imageLayout: 'side-right',
      imageWidth: 'half',
      height: 'tall',
      sideImageHeight: 'match',
      imageFocus: 'center',
      imageZoom: 100,
      contentAlignment: 'left',
      contentWidth: 'regular',
      titleColor: props.props.titleColor || '#0f172a',
      titleBackgroundSize: 'fit',
      subtitleColor: props.props.subtitleColor || '#475569',
      subtitleBackgroundSize: 'fit',
      buttonBackgroundColor: props.props.buttonBackgroundColor || '#0f172a',
      buttonTextColor: props.props.buttonTextColor || '#ffffff',
      buttonSize: 'md',
    },
  ]
})

const currentSlide = computed(() => slides.value[currentSlideIndex.value] ?? slides.value[0])
const canSlide = computed(() => slides.value.length > 1)
const showDots = computed(() => props.props.showDots ?? true)
const showArrows = computed(() => props.props.showArrows ?? true)
const autoPlayEnabled = computed(() => (props.props.autoPlay ?? true) && canSlide.value)
const autoPlayIntervalMs = computed(() => {
  const value = props.props.autoPlayIntervalMs ?? 5000
  return Math.min(15000, Math.max(2000, value))
})

function nextSlide() {
  if (!canSlide.value) return
  currentSlideIndex.value = (currentSlideIndex.value + 1) % slides.value.length
}

function previousSlide() {
  if (!canSlide.value) return
  currentSlideIndex.value = (currentSlideIndex.value - 1 + slides.value.length) % slides.value.length
}

function selectSlide(index: number) {
  if (!canSlide.value) return
  currentSlideIndex.value = index
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

function startAutoPlay() {
  stopAutoPlay()
  if (!autoPlayEnabled.value) return

  autoPlayTimer = setInterval(() => {
    nextSlide()
  }, autoPlayIntervalMs.value)
}

function sideGridClass(slide: ResolvedHeroSlide): string {
  if (slide.imageWidth === 'quarter') {
    return 'grid-cols-1 md:grid-cols-4'
  }
  return 'grid-cols-1 md:grid-cols-2'
}

function textColumnClass(slide: ResolvedHeroSlide): string {
  return slide.imageWidth === 'quarter' ? 'md:col-span-3' : 'md:col-span-1'
}

function imageColumnClass(slide: ResolvedHeroSlide): string {
  return slide.imageWidth === 'quarter' ? 'md:col-span-1' : 'md:col-span-1'
}

function backgroundSizeClass(size: 'fit' | 'wide' | 'full'): string {
  if (size === 'full') return 'block w-full'
  if (size === 'wide') return 'inline-block min-w-[65%] max-w-full'
  return 'inline-block max-w-full'
}

function textBackgroundStyle(color?: string): Record<string, string> | undefined {
  if (!color) return undefined
  return { backgroundColor: color }
}

function imageObjectPositionStyle(
  focus: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
): Record<string, string> {
  const positions: Record<string, string> = {
    center: 'center center',
    top: 'center top',
    bottom: 'center bottom',
    left: 'left center',
    right: 'right center',
    'top-left': 'left top',
    'top-right': 'right top',
    'bottom-left': 'left bottom',
    'bottom-right': 'right bottom'
  }

  return { objectPosition: positions[focus] || positions.center }
}

function imageTransformStyle(slide: ResolvedHeroSlide): Record<string, string> {
  const scale = Math.min(200, Math.max(100, slide.imageZoom)) / 100
  const focus = imageObjectPositionStyle(slide.imageFocus).objectPosition
  return {
    objectPosition: focus,
    transformOrigin: focus,
    transform: `scale(${scale})`,
  }
}

function buttonSizeClass(size: 'sm' | 'md' | 'lg'): string {
  if (size === 'sm') return 'px-4 py-2 text-sm'
  if (size === 'lg') return 'px-6 py-4 text-lg'
  return 'px-5 py-3 text-base'
}

function slideHeightClass(height: 'compact' | 'tall' | 'screen'): string {
  if (height === 'screen') return 'min-h-[100svh]'
  if (height === 'compact') return 'min-h-[320px] sm:min-h-[380px]'
  return 'min-h-[480px] sm:min-h-[560px]'
}

function sideImageHeightClass(height: 'match' | 'compact' | 'tall' | 'screen'): string {
  if (height === 'screen') return 'min-h-[100svh]'
  if (height === 'compact') return 'min-h-[320px] sm:min-h-[380px]'
  if (height === 'tall') return 'min-h-[480px] sm:min-h-[560px]'
  return 'h-full min-h-[240px]'
}

function contentAlignmentClass(alignment: 'left' | 'center' | 'right'): string {
  if (alignment === 'center') return 'items-center text-center mx-auto'
  if (alignment === 'right') return 'items-end text-right ml-auto'
  return 'items-start text-left'
}

function contentWidthClass(width: 'narrow' | 'regular' | 'wide' | 'full'): string {
  if (width === 'full') return 'w-full max-w-none'
  if (width === 'wide') return 'max-w-4xl'
  if (width === 'narrow') return 'max-w-xl'
  return 'max-w-2xl'
}

const BORDER_RADIUS_MAP: Record<string, string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
}

const cardWrapperStyle = computed(() => {
  const p = props.props
  const radius = BORDER_RADIUS_MAP[p.cardBorderRadius ?? '2xl'] ?? '1rem'
  const borderVisible = p.cardBorderVisible !== false
  const borderColor = p.cardBorderColor || '#f1f5f9'
  const bgColor = p.cardBackgroundColor || '#ffffff'
  return {
    borderRadius: radius,
    border: borderVisible ? `1px solid ${borderColor}` : 'none',
    backgroundColor: bgColor,
  }
})

watch(
  () => slides.value.length,
  () => {
    if (currentSlideIndex.value >= slides.value.length) {
      currentSlideIndex.value = 0
    }
    startAutoPlay()
  },
)

watch([autoPlayEnabled, autoPlayIntervalMs], () => {
  startAutoPlay()
})

onMounted(() => {
  startAutoPlay()
})

onBeforeUnmount(() => {
  stopAutoPlay()
})
</script>

<template>
  <section class="py-8" :style="{ backgroundColor: props.props.backgroundColor || '#f8fafc' }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="overflow-hidden" :style="cardWrapperStyle">
        <Transition name="hero-slide" mode="out-in">
          <div
            v-if="currentSlide.imageLayout === 'background'"
            :key="`hero-background-${currentSlideIndex}`"
            class="relative"
            :class="slideHeightClass(currentSlide.height)"
          >
          <img
            v-if="currentSlide.imageUrl"
            :src="currentSlide.imageUrl"
            :alt="currentSlide.title"
            class="absolute inset-0 w-full h-full object-cover"
            :style="imageTransformStyle(currentSlide)"
          >
          <div
            class="absolute inset-0"
            :style="{ backgroundColor: currentSlide.overlayColor || 'rgba(15,23,42,0.35)' }"
          />

          <div
            class="relative z-10 p-6 sm:p-10 lg:p-14 flex flex-col h-full justify-center"
            :class="[contentAlignmentClass(currentSlide.contentAlignment), contentWidthClass(currentSlide.contentWidth)]"
          >
            <div
              class="rounded-xl px-4 py-3"
              :class="backgroundSizeClass(currentSlide.titleBackgroundSize)"
              :style="textBackgroundStyle(currentSlide.titleBackgroundColor)"
            >
              <h1 class="text-3xl sm:text-4xl font-bold leading-tight" :style="{ color: currentSlide.titleColor }">
                {{ currentSlide.title }}
              </h1>
            </div>
            <div
              v-if="currentSlide.subtitle"
              class="mt-4 rounded-xl px-4 py-3"
              :class="backgroundSizeClass(currentSlide.subtitleBackgroundSize)"
              :style="textBackgroundStyle(currentSlide.subtitleBackgroundColor)"
            >
              <p
                class="text-base sm:text-lg leading-relaxed"
                :style="{ color: currentSlide.subtitleColor }"
              >
                {{ currentSlide.subtitle }}
              </p>
            </div>

            <NuxtLink
              v-if="currentSlide.ctaLabel && currentSlide.ctaHref"
              :to="currentSlide.ctaHref"
              class="inline-flex mt-6 rounded-lg font-semibold shadow-sm"
              :class="buttonSizeClass(currentSlide.buttonSize)"
              :style="{ backgroundColor: currentSlide.buttonBackgroundColor, color: currentSlide.buttonTextColor }"
            >
              {{ currentSlide.ctaLabel }}
            </NuxtLink>
          </div>
          </div>

          <div
            v-else
            :key="`hero-side-${currentSlideIndex}`"
            class="grid items-stretch"
            :class="[sideGridClass(currentSlide), slideHeightClass(currentSlide.height)]"
          >
          <div
            class="p-6 sm:p-10 flex flex-col justify-center"
            :class="[
              textColumnClass(currentSlide),
              currentSlide.imageLayout === 'side-left' ? 'md:order-2' : 'md:order-1',
              contentAlignmentClass(currentSlide.contentAlignment),
              contentWidthClass(currentSlide.contentWidth),
            ]"
          >
            <div
              class="rounded-xl px-4 py-3"
              :class="backgroundSizeClass(currentSlide.titleBackgroundSize)"
              :style="textBackgroundStyle(currentSlide.titleBackgroundColor)"
            >
              <h1 class="text-3xl sm:text-4xl font-bold leading-tight" :style="{ color: currentSlide.titleColor }">
                {{ currentSlide.title }}
              </h1>
            </div>
            <div
              v-if="currentSlide.subtitle"
              class="mt-4 rounded-xl px-4 py-3"
              :class="backgroundSizeClass(currentSlide.subtitleBackgroundSize)"
              :style="textBackgroundStyle(currentSlide.subtitleBackgroundColor)"
            >
              <p
                class="text-base sm:text-lg leading-relaxed"
                :style="{ color: currentSlide.subtitleColor }"
              >
                {{ currentSlide.subtitle }}
              </p>
            </div>

            <NuxtLink
              v-if="currentSlide.ctaLabel && currentSlide.ctaHref"
              :to="currentSlide.ctaHref"
              class="inline-flex mt-6 rounded-lg font-semibold shadow-sm w-fit"
              :class="buttonSizeClass(currentSlide.buttonSize)"
              :style="{ backgroundColor: currentSlide.buttonBackgroundColor, color: currentSlide.buttonTextColor }"
            >
              {{ currentSlide.ctaLabel }}
            </NuxtLink>
          </div>

          <div
            class="relative bg-gray-100"
            :class="[
              sideImageHeightClass(currentSlide.sideImageHeight),
              imageColumnClass(currentSlide),
              currentSlide.imageLayout === 'side-left' ? 'md:order-1' : 'md:order-2',
            ]"
          >
            <img
              v-if="currentSlide.imageUrl"
              :src="currentSlide.imageUrl"
              :alt="currentSlide.title"
              class="absolute inset-0 w-full h-full object-cover"
              :style="imageTransformStyle(currentSlide)"
            >
            <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Imagen principal
            </div>
          </div>
          </div>
        </Transition>

        <div
          v-if="canSlide && (showDots || showArrows)"
          class="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white"
        >
          <button
            v-if="showArrows"
            type="button"
            class="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 hover:bg-gray-50"
            @click="previousSlide"
          >
            Anterior
          </button>
          <div v-else />

          <div v-if="showDots" class="flex items-center gap-2">
            <button
              v-for="(_, idx) in slides"
              :key="`hero-dot-${idx}`"
              type="button"
              class="h-2.5 rounded-full transition-all"
              :class="currentSlideIndex === idx ? 'w-7 bg-gray-900' : 'w-2.5 bg-gray-300 hover:bg-gray-400'"
              :aria-label="`Ir al slide ${idx + 1}`"
              @click="selectSlide(idx)"
            />
          </div>
          <div v-else />

          <button
            v-if="showArrows"
            type="button"
            class="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 hover:bg-gray-50"
            @click="nextSlide"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-slide-enter-active,
.hero-slide-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.hero-slide-enter-from,
.hero-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
