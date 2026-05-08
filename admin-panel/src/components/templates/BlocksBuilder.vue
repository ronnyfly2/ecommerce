<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiFileInput from '@/components/ui/UiFileInput.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import { BLOCK_CATEGORIES, BLOCK_TYPES_CONFIG, getBlockConfig } from '@/config/template-blocks.config'
import { useToast } from '@/composables/useToast'
import { productsService } from '@/services/products.service'
import { extractErrorMessage } from '@/utils/error'

interface TemplateBlock {
  id: string
  componentKey: string
  order: number
  layoutWidth?: 'basic' | 'wide' | 'full'
  spacingY?: 'default' | 'compact' | 'none'
  spacingX?: 'default' | 'compact' | 'none'
  props: Record<string, unknown>
}

const props = defineProps<{
  blocks: TemplateBlock[]
  lockThemeColors?: boolean
  contrastMinRatio?: number
  contrastProfileLabel?: string
}>()

const emit = defineEmits<{
  update: [blocks: TemplateBlock[]]
}>()

const expandedBlockId = ref<string | null>(null)
const showBlockPicker = ref(false)
const filterCategory = ref<string | null>(null)
const uploadingSlideImageKey = ref<string | null>(null)
const pendingSlideFiles = ref<Record<string, File | null>>({})
const pendingSlidePreviewUrls = ref<Record<string, string>>({})
const slideDropActiveKey = ref<string | null>(null)
const activeHeroSlideEditors = ref<Record<string, number>>({})
const draggingHeroSlideKey = ref<string | null>(null)
const heroSlideDropTargetKey = ref<string | null>(null)
const touchDraggingHeroSlideKey = ref<string | null>(null)
const heroZoomSnapEnabled = ref(true)
const toast = useToast()

const HERO_ZOOM_SNAP_STORAGE_KEY = 'templates:hero-zoom-snap'

const orderedBlocks = computed(() => [...props.blocks].sort((a, b) => a.order - b.order))
const filteredBlocks = computed(() => {
  const all = Object.values(BLOCK_TYPES_CONFIG)
  if (!filterCategory.value) return all
  return all.filter((b) => b.category === filterCategory.value)
})

function updateAll(next: TemplateBlock[]) {
  emit('update', next)
}

function updateBlockProp(blockId: string, key: string, value: unknown) {
  const normalizedValue =
    value === 'true'
      ? true
      : value === 'false'
        ? false
        : value

  updateAll(
    props.blocks.map((block) =>
      block.id === blockId ? { ...block, props: { ...block.props, [key]: normalizedValue } } : block,
    ),
  )
}

function updateBlockLayoutWidth(blockId: string, width: 'basic' | 'wide' | 'full') {
  updateAll(
    props.blocks.map((block) =>
      block.id === blockId ? { ...block, layoutWidth: width } : block,
    ),
  )
}

function updateBlockSpacingY(blockId: string, spacingY: 'default' | 'compact' | 'none') {
  updateAll(
    props.blocks.map((block) =>
      block.id === blockId ? { ...block, spacingY } : block,
    ),
  )
}

function updateBlockSpacingX(blockId: string, spacingX: 'default' | 'compact' | 'none') {
  updateAll(
    props.blocks.map((block) =>
      block.id === blockId ? { ...block, spacingX } : block,
    ),
  )
}

function applySectionLayoutPreset(blockId: string, preset: 'edge' | 'standard' | 'editorial') {
  if (preset === 'edge') {
    updateAll(
      props.blocks.map((block) =>
        block.id === blockId ? { ...block, layoutWidth: 'full', spacingY: 'none', spacingX: 'none' } : block,
      ),
    )
    return
  }

  if (preset === 'editorial') {
    updateAll(
      props.blocks.map((block) =>
        block.id === blockId ? { ...block, layoutWidth: 'wide', spacingY: 'default', spacingX: 'default' } : block,
      ),
    )
    return
  }

  updateAll(
    props.blocks.map((block) =>
      block.id === blockId ? { ...block, layoutWidth: 'basic', spacingY: 'default', spacingX: 'default' } : block,
    ),
  )
}

function addBlock(componentKey: string) {
  const newOrder = Math.max(...props.blocks.map((b) => b.order), 0) + 1
  const next: TemplateBlock = {
    id: `${componentKey}-${Date.now()}`,
    componentKey,
    order: newOrder,
    props: {},
  }
  updateAll([...props.blocks, next])
  expandedBlockId.value = next.id
  showBlockPicker.value = false
}

function removeBlock(id: string) {
  updateAll(props.blocks.filter((block) => block.id !== id))
}

function moveBlockUp(id: string) {
  const sorted = [...orderedBlocks.value]
  const idx = sorted.findIndex((b) => b.id === id)
  if (idx <= 0) return
  const above = sorted[idx - 1]
  const current = sorted[idx]
  updateAll(
    props.blocks.map((block) => {
      if (block.id === current.id) return { ...block, order: above.order }
      if (block.id === above.id) return { ...block, order: current.order }
      return block
    }),
  )
}

function moveBlockDown(id: string) {
  const sorted = [...orderedBlocks.value]
  const idx = sorted.findIndex((b) => b.id === id)
  if (idx === -1 || idx >= sorted.length - 1) return
  const below = sorted[idx + 1]
  const current = sorted[idx]
  updateAll(
    props.blocks.map((block) => {
      if (block.id === current.id) return { ...block, order: below.order }
      if (block.id === below.id) return { ...block, order: current.order }
      return block
    }),
  )
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

function addArrayItem(block: TemplateBlock, key: string) {
  const current = asArray(block.props[key])
  const defaultItem =
    key === 'categories'
      ? { label: 'Nueva categoria', slug: 'nueva-categoria', imageUrl: '' }
      : key === 'brands'
        ? { name: 'Nueva marca', slug: 'nueva-marca', logoUrl: '' }
        : key === 'badges'
          ? { icon: '✅', title: 'Nueva garantia', description: '' }
          : key === 'banners'
            ? { title: 'Nuevo banner', subtitle: '', imageUrl: '', href: '/search', textPosition: 'bottom-left' }
            : key === 'slides'
              ? {
                  title: 'Nuevo slide',
                  subtitle: 'Descripcion breve de la promocion.',
                  ctaLabel: 'Ver mas',
                  ctaHref: '/search',
                  imageUrl: 'https://picsum.photos/seed/hero-slide/1200/700',
                  imageLayout: 'background',
                  imageWidth: 'half',
                  imageFocus: 'center',
                  imageZoom: 100,
                  contentWidth: 'regular',
                }
            : {}
  updateBlockProp(block.id, key, [...current, defaultItem])
}

function removeArrayItem(block: TemplateBlock, key: string, index: number) {
  const current = asArray(block.props[key])
  updateBlockProp(block.id, key, current.filter((_, idx) => idx !== index))
}

function updateArrayItem(block: TemplateBlock, key: string, index: number, field: string, value: unknown) {
  const current = asArray(block.props[key])
  const next = current.map((item, idx) => {
    if (idx !== index) return item
    return { ...item, [field]: value }
  })
  updateBlockProp(block.id, key, next)
}

function patchArrayItem(block: TemplateBlock, key: string, index: number, patch: Record<string, unknown>) {
  const current = asArray(block.props[key])
  const next = current.map((item, idx) => {
    if (idx !== index) return item
    return { ...item, ...patch }
  })
  updateBlockProp(block.id, key, next)
}

function moveArrayItem(block: TemplateBlock, key: string, index: number, direction: -1 | 1) {
  const current = asArray(block.props[key])
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= current.length) return

  const next = [...current]
  const temp = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = temp
  updateBlockProp(block.id, key, next)
}

function replaceArrayItems(block: TemplateBlock, key: string, items: Record<string, unknown>[]) {
  updateBlockProp(block.id, key, items)
}

function heroSlides(block: TemplateBlock, key: string): Record<string, unknown>[] {
  return asArray(block.props[key])
}

function activeHeroSlideIndex(blockId: string, total: number): number {
  if (total <= 0) return 0
  const rawIndex = activeHeroSlideEditors.value[blockId] ?? 0
  return Math.min(Math.max(rawIndex, 0), total - 1)
}

function setActiveHeroSlideIndex(blockId: string, index: number) {
  activeHeroSlideEditors.value = {
    ...activeHeroSlideEditors.value,
    [blockId]: index,
  }
}

function activeHeroSlideEntries(block: TemplateBlock, key: string): Array<{ item: Record<string, unknown>; index: number }> {
  const slides = heroSlides(block, key)
  if (slides.length === 0) return []

  const index = activeHeroSlideIndex(block.id, slides.length)
  return [{ item: slides[index], index }]
}

function removeHeroSlide(block: TemplateBlock, key: string, index: number) {
  removeArrayItem(block, key, index)
  const nextTotal = Math.max(heroSlides(block, key).length - 1, 0)
  setActiveHeroSlideIndex(block.id, Math.min(activeHeroSlideIndex(block.id, heroSlides(block, key).length), Math.max(nextTotal - 1, 0)))
}

function moveHeroSlide(block: TemplateBlock, key: string, index: number, direction: -1 | 1) {
  const slides = heroSlides(block, key)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= slides.length) return

  const currentActiveIndex = activeHeroSlideIndex(block.id, slides.length)
  moveArrayItem(block, key, index, direction)

  if (currentActiveIndex === index) {
    setActiveHeroSlideIndex(block.id, targetIndex)
    return
  }

  if (currentActiveIndex === targetIndex) {
    setActiveHeroSlideIndex(block.id, index)
  }
}

function heroSlideDragKey(blockId: string, index: number): string {
  return `${blockId}:${index}`
}

function onHeroSlideThumbDragStart(blockId: string, index: number) {
  draggingHeroSlideKey.value = heroSlideDragKey(blockId, index)
}

function onHeroSlideThumbDragEnd() {
  draggingHeroSlideKey.value = null
  heroSlideDropTargetKey.value = null
}

function resolveTouchTargetSlideKey(touch: Touch): string | null {
  if (typeof document === 'undefined') return null
  const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
  const target = element?.closest('[data-hero-slide-thumb-key]') as HTMLElement | null
  return target?.dataset.heroSlideThumbKey ?? null
}

function onHeroSlideThumbTouchStart(blockId: string, index: number) {
  const key = heroSlideDragKey(blockId, index)
  touchDraggingHeroSlideKey.value = key
  heroSlideDropTargetKey.value = null
}

function onHeroSlideThumbTouchMove(event: TouchEvent) {
  if (!touchDraggingHeroSlideKey.value) return
  const touch = event.touches[0]
  if (!touch) return
  const targetKey = resolveTouchTargetSlideKey(touch)
  if (targetKey && targetKey !== touchDraggingHeroSlideKey.value) {
    heroSlideDropTargetKey.value = targetKey
  }
}

function onHeroSlideThumbTouchEnd(block: TemplateBlock, key: string, event: TouchEvent) {
  const dragKey = touchDraggingHeroSlideKey.value
  touchDraggingHeroSlideKey.value = null

  if (!dragKey) {
    heroSlideDropTargetKey.value = null
    return
  }

  const touch = event.changedTouches[0]
  const targetKey = touch ? resolveTouchTargetSlideKey(touch) : null
  heroSlideDropTargetKey.value = null
  if (!targetKey) return

  const [dragBlockId, dragIndexRaw] = dragKey.split(':')
  const [dropBlockId, dropIndexRaw] = targetKey.split(':')
  if (dragBlockId !== block.id || dropBlockId !== block.id) return

  const fromIndex = Number(dragIndexRaw)
  const toIndex = Number(dropIndexRaw)
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return

  const slides = heroSlides(block, key)
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= slides.length || toIndex >= slides.length) return

  const next = [...slides]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  replaceArrayItems(block, key, next)

  const currentActiveIndex = activeHeroSlideIndex(block.id, slides.length)
  if (currentActiveIndex === fromIndex) {
    setActiveHeroSlideIndex(block.id, toIndex)
  } else if (fromIndex < currentActiveIndex && toIndex >= currentActiveIndex) {
    setActiveHeroSlideIndex(block.id, currentActiveIndex - 1)
  } else if (fromIndex > currentActiveIndex && toIndex <= currentActiveIndex) {
    setActiveHeroSlideIndex(block.id, currentActiveIndex + 1)
  }
}

function onHeroSlideThumbDragOver(blockId: string, index: number, event: DragEvent) {
  event.preventDefault()
  const key = heroSlideDragKey(blockId, index)
  if (draggingHeroSlideKey.value && draggingHeroSlideKey.value !== key) {
    heroSlideDropTargetKey.value = key
  }
}

function onHeroSlideThumbDragLeave(blockId: string, index: number) {
  const key = heroSlideDragKey(blockId, index)
  if (heroSlideDropTargetKey.value === key) {
    heroSlideDropTargetKey.value = null
  }
}

function onHeroSlideThumbDrop(block: TemplateBlock, key: string, toIndex: number, event: DragEvent) {
  event.preventDefault()
  heroSlideDropTargetKey.value = null

  const dragKey = draggingHeroSlideKey.value
  draggingHeroSlideKey.value = null
  if (!dragKey) return

  const [dragBlockId, dragIndexRaw] = dragKey.split(':')
  if (dragBlockId !== block.id) return

  const fromIndex = Number(dragIndexRaw)
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex === toIndex) return

  const slides = heroSlides(block, key)
  if (fromIndex >= slides.length || toIndex < 0 || toIndex >= slides.length) return

  const next = [...slides]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  replaceArrayItems(block, key, next)

  const currentActiveIndex = activeHeroSlideIndex(block.id, slides.length)
  if (currentActiveIndex === fromIndex) {
    setActiveHeroSlideIndex(block.id, toIndex)
  } else if (fromIndex < currentActiveIndex && toIndex >= currentActiveIndex) {
    setActiveHeroSlideIndex(block.id, currentActiveIndex - 1)
  } else if (fromIndex > currentActiveIndex && toIndex <= currentActiveIndex) {
    setActiveHeroSlideIndex(block.id, currentActiveIndex + 1)
  }
}

function onHeroSlideThumbKeydown(block: TemplateBlock, key: string, index: number, event: KeyboardEvent) {
  const slides = heroSlides(block, key)
  if (slides.length <= 1) return

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (event.altKey || event.metaKey) {
      moveHeroSlide(block, key, index, -1)
    } else {
      setActiveHeroSlideIndex(block.id, Math.max(0, index - 1))
    }
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    if (event.altKey || event.metaKey) {
      moveHeroSlide(block, key, index, 1)
    } else {
      setActiveHeroSlideIndex(block.id, Math.min(slides.length - 1, index + 1))
    }
  }
}

function resetHeroSlideFraming(block: TemplateBlock, key: string, index: number) {
  patchArrayItem(block, key, index, {
    imageFocus: 'center',
    imageZoom: 100,
  })
}

function zoomSnapEnabledForBlock(_blockId: string): boolean {
  return heroZoomSnapEnabled.value
}

function setZoomSnapEnabledForBlock(_blockId: string, enabled: boolean) {
  heroZoomSnapEnabled.value = enabled
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(HERO_ZOOM_SNAP_STORAGE_KEY, enabled ? 'true' : 'false')
  }
}

function snapZoomValue(value: number): number {
  const stops = [100, 110, 125, 150, 175, 200]
  let nearest = stops[0]
  let bestDistance = Math.abs(value - nearest)

  for (const stop of stops.slice(1)) {
    const distance = Math.abs(value - stop)
    if (distance < bestDistance) {
      nearest = stop
      bestDistance = distance
    }
  }

  return nearest
}

function updateSlideZoom(block: TemplateBlock, key: string, index: number, rawValue: number) {
  const clamped = Math.min(200, Math.max(100, rawValue))
  const nextZoom = zoomSnapEnabledForBlock(block.id) ? snapZoomValue(clamped) : clamped
  updateArrayItem(block, key, index, 'imageZoom', nextZoom)
}

function zoomRecommendation(item: Record<string, unknown>): string {
  const layout = String(item.imageLayout ?? 'background')
  const width = String(item.imageWidth ?? 'half')

  if (layout === 'background') {
    return 'Recomendado: 105%-130% para mantener impacto visual sin perder contexto.'
  }

  if (width === 'quarter') {
    return 'Recomendado: 120%-170% para destacar mejor la imagen en columna 1/4.'
  }

  return 'Recomendado: 110%-145% para layout lateral equilibrado.'
}

const heroFramingPresetOptions = [
  { value: 'fashion', label: 'Moda (rostro/producto)' },
  { value: 'home', label: 'Hogar (ambiente)' },
  { value: 'tech', label: 'Tech (detalle de producto)' },
]

function applyHeroFramingPreset(block: TemplateBlock, key: string, index: number, preset: string) {
  if (preset === 'fashion') {
    patchArrayItem(block, key, index, { imageFocus: 'top', imageZoom: 130 })
    return
  }

  if (preset === 'home') {
    patchArrayItem(block, key, index, { imageFocus: 'center', imageZoom: 110 })
    return
  }

  if (preset === 'tech') {
    patchArrayItem(block, key, index, { imageFocus: 'center', imageZoom: 150 })
  }
}

function slideFileKey(blockId: string, index: number): string {
  return `${blockId}:${index}`
}

function clearSlidePreview(blockId: string, index: number) {
  const key = slideFileKey(blockId, index)
  const previewUrl = pendingSlidePreviewUrls.value[key]
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl)
    delete pendingSlidePreviewUrls.value[key]
  }
}

function setPendingSlideFile(blockId: string, index: number, file: File | null) {
  const key = slideFileKey(blockId, index)
  clearSlidePreview(blockId, index)
  pendingSlideFiles.value[key] = file

  if (file) {
    pendingSlidePreviewUrls.value[key] = URL.createObjectURL(file)
  }
}

function onHeroSlideFileSelected(blockId: string, index: number, event: Event) {
  const target = event.target as HTMLInputElement
  setPendingSlideFile(blockId, index, target.files?.[0] ?? null)
}

function onHeroSlideDragOver(blockId: string, index: number, event: DragEvent) {
  event.preventDefault()
  slideDropActiveKey.value = slideFileKey(blockId, index)
}

function onHeroSlideDragLeave(blockId: string, index: number) {
  if (slideDropActiveKey.value === slideFileKey(blockId, index)) {
    slideDropActiveKey.value = null
  }
}

function onHeroSlideDrop(blockId: string, index: number, event: DragEvent) {
  event.preventDefault()
  slideDropActiveKey.value = null

  const file = event.dataTransfer?.files?.[0] ?? null
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.warning('Archivo no valido', 'Solo puedes soltar imagenes en este espacio')
    return
  }

  setPendingSlideFile(blockId, index, file)
}

async function uploadHeroSlideImage(block: TemplateBlock, key: string, index: number) {
  const fileKey = slideFileKey(block.id, index)
  const file = pendingSlideFiles.value[fileKey]
  if (!file) {
    toast.warning('Falta archivo', 'Selecciona una imagen antes de subirla')
    return
  }

  uploadingSlideImageKey.value = fileKey
  try {
    const url = await productsService.uploadImageAsset(file)
    updateArrayItem(block, key, index, 'imageUrl', url)
    setPendingSlideFile(block.id, index, null)
    toast.success('Imagen subida', 'La imagen del slide se actualizo correctamente')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo subir la imagen del slide'))
  } finally {
    uploadingSlideImageKey.value = null
  }
}

const bannerTextPositionOptions = [
  { value: 'top-left', label: 'Arriba izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom-left', label: 'Abajo izquierda' },
  { value: 'bottom-right', label: 'Abajo derecha' },
]

const heroImageLayoutOptions = [
  { value: 'background', label: 'Imagen de fondo' },
  { value: 'side-left', label: 'Imagen lateral izquierda' },
  { value: 'side-right', label: 'Imagen lateral derecha' },
]

const heroImageWidthOptions = [
  { value: 'quarter', label: '1/4 del ancho' },
  { value: 'half', label: '1/2 del ancho' },
]

const heroContentAlignmentOptions = [
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
]

const heroImageFocusOptions = [
  { value: 'center', label: 'Centro' },
  { value: 'top', label: 'Arriba' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
  { value: 'top-left', label: 'Arriba izquierda' },
  { value: 'top-right', label: 'Arriba derecha' },
  { value: 'bottom-left', label: 'Abajo izquierda' },
  { value: 'bottom-right', label: 'Abajo derecha' },
]

const heroContentWidthOptions = [
  { value: 'narrow', label: 'Estrecho' },
  { value: 'regular', label: 'Normal' },
  { value: 'wide', label: 'Amplio' },
  { value: 'full', label: 'Completo' },
]

const heroHeightOptions = [
  { value: 'compact', label: 'Compacta' },
  { value: 'tall', label: 'Alta destacada' },
  { value: 'screen', label: 'Pantalla completa' },
]

const heroSideImageHeightOptions = [
  { value: 'match', label: 'Igual al banner' },
  { value: 'compact', label: 'Compacta' },
  { value: 'tall', label: 'Alta destacada' },
  { value: 'screen', label: 'Pantalla completa' },
]

function slidePreviewSrc(blockId: string, index: number, item: Record<string, unknown>): string {
  return pendingSlidePreviewUrls.value[slideFileKey(blockId, index)] || String(item.imageUrl ?? '')
}

function slideImageFocusStyle(item: Record<string, unknown>): Record<string, string> {
  const value = String(item.imageFocus ?? 'center')
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

  return { objectPosition: positions[value] || positions.center }
}

function slideImageZoomStyle(item: Record<string, unknown>): Record<string, string> {
  const zoomRaw = Number(item.imageZoom ?? 100)
  const zoom = Number.isFinite(zoomRaw) ? Math.min(200, Math.max(100, zoomRaw)) : 100
  const position = slideImageFocusStyle(item).objectPosition || 'center center'

  return {
    objectPosition: position,
    transformOrigin: position,
    transform: `scale(${zoom / 100})`,
  }
}

function slideImageZoomValue(item: Record<string, unknown>): number {
  const zoomRaw = Number(item.imageZoom ?? 100)
  return Number.isFinite(zoomRaw) ? Math.min(200, Math.max(100, zoomRaw)) : 100
}

onMounted(() => {
  if (typeof window === 'undefined') return
  const raw = window.localStorage.getItem(HERO_ZOOM_SNAP_STORAGE_KEY)
  if (raw === 'true') heroZoomSnapEnabled.value = true
  if (raw === 'false') heroZoomSnapEnabled.value = false
})

onBeforeUnmount(() => {
  for (const previewUrl of Object.values(pendingSlidePreviewUrls.value)) {
    URL.revokeObjectURL(previewUrl)
  }
})

const backgroundSizeOptions = [
  { value: 'fit', label: 'Ajustado al contenido' },
  { value: 'wide', label: 'Ancho destacado' },
  { value: 'full', label: 'Ancho completo' },
]

const buttonSizeOptions = [
  { value: 'sm', label: 'Pequeno' },
  { value: 'md', label: 'Mediano' },
  { value: 'lg', label: 'Grande' },
]

const sectionWidthOptions = [
  { value: 'basic', label: 'Basico' },
  { value: 'wide', label: 'Ancho amplio' },
  { value: 'full', label: 'Full width' },
]

const sectionSpacingOptions = [
  { value: 'default', label: 'Normal (con padding)' },
  { value: 'compact', label: 'Compacto' },
  { value: 'none', label: 'Sin padding vertical' },
]

const sectionSpacingXOptions = [
  { value: 'default', label: 'Normal (con padding)' },
  { value: 'compact', label: 'Compacto' },
  { value: 'none', label: 'Sin padding horizontal' },
]

function duplicateBlock(block: TemplateBlock) {
  const insertOrder = block.order + 1
  const shifted = props.blocks.map((row) =>
    row.order >= insertOrder ? { ...row, order: row.order + 1 } : row,
  )

  const clone: TemplateBlock = {
    ...block,
    id: `${block.componentKey}-${Date.now()}`,
    order: insertOrder,
    props: JSON.parse(JSON.stringify(block.props)) as Record<string, unknown>,
  }

  updateAll([...shifted, clone])
  expandedBlockId.value = clone.id
}

function resetBlockColors(block: TemplateBlock) {
  const colorFields = (getBlockConfig(block.componentKey)?.fields ?? []).filter((field) => field.type === 'color')
  if (colorFields.length === 0) return

  const nextProps = { ...block.props }
  for (const field of colorFields) {
    nextProps[field.key] = field.placeholder ?? '#111827'
  }

  updateAll(
    props.blocks.map((row) =>
      row.id === block.id
        ? { ...row, props: nextProps }
        : row,
    ),
  )
}

function parseColor(input: string): [number, number, number] | null {
  const value = input.trim().toLowerCase()

  if (/^#([0-9a-f]{3})$/.test(value)) {
    const hex = value.slice(1)
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return [r, g, b]
  }

  if (/^#([0-9a-f]{6})$/.test(value)) {
    const hex = value.slice(1)
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return [r, g, b]
  }

  const rgb = value.match(/^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\)$/)
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  }

  return null
}

function luminance([r, g, b]: [number, number, number]): number {
  const normalized = [r, g, b].map((channel) => {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2]
}

function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return null

  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
}

function blockColorDefaults(componentKey: string): Record<string, string> {
  const map: Record<string, Record<string, string>> = {
    hero: {
      backgroundColor: '#f8fafc',
      titleColor: '#0f172a',
      subtitleColor: '#475569',
      buttonBackgroundColor: '#111827',
      buttonTextColor: '#ffffff',
    },
    'category-strip': {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      itemBackgroundColor: '#f3f4f6',
      itemTextColor: '#374151',
    },
    'product-grid': {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      cardBackgroundColor: '#ffffff',
      priceColor: '#dc2626',
    },
    'flash-sale': {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      timerBackgroundColor: '#111827',
      timerTextColor: '#ffffff',
      cardBackgroundColor: '#ffffff',
      priceColor: '#ef4444',
    },
    'brand-carousel': {
      backgroundColor: '#f9fafb',
      titleColor: '#111827',
    },
    'trust-badges': {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      textColor: '#6b7280',
    },
  }

  return map[componentKey] ?? {}
}

function colorValue(block: TemplateBlock, key: string): string {
  const value = block.props[key]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }
  return blockColorDefaults(block.componentKey)[key] ?? '#ffffff'
}

function getContrastWarnings(block: TemplateBlock): string[] {
  const checks: Array<{ label: string; fg: string; bg: string }> = []

  if (block.componentKey === 'hero') {
    checks.push(
      { label: 'Titulo vs fondo', fg: colorValue(block, 'titleColor'), bg: colorValue(block, 'backgroundColor') },
      { label: 'Subtitulo vs fondo', fg: colorValue(block, 'subtitleColor'), bg: colorValue(block, 'backgroundColor') },
      { label: 'Texto boton vs fondo boton', fg: colorValue(block, 'buttonTextColor'), bg: colorValue(block, 'buttonBackgroundColor') },
    )
  }

  if (block.componentKey === 'category-strip') {
    checks.push(
      { label: 'Titulo vs fondo', fg: colorValue(block, 'titleColor'), bg: colorValue(block, 'backgroundColor') },
      { label: 'Texto item vs fondo item', fg: colorValue(block, 'itemTextColor'), bg: colorValue(block, 'itemBackgroundColor') },
    )
  }

  if (block.componentKey === 'product-grid') {
    checks.push(
      { label: 'Titulo vs fondo', fg: colorValue(block, 'titleColor'), bg: colorValue(block, 'backgroundColor') },
      { label: 'Precio vs fondo tarjeta', fg: colorValue(block, 'priceColor'), bg: colorValue(block, 'cardBackgroundColor') },
    )
  }

  if (block.componentKey === 'flash-sale') {
    checks.push(
      { label: 'Titulo vs fondo', fg: colorValue(block, 'titleColor'), bg: colorValue(block, 'backgroundColor') },
      { label: 'Texto timer vs fondo timer', fg: colorValue(block, 'timerTextColor'), bg: colorValue(block, 'timerBackgroundColor') },
      { label: 'Precio vs fondo tarjeta', fg: colorValue(block, 'priceColor'), bg: colorValue(block, 'cardBackgroundColor') },
    )
  }

  if (block.componentKey === 'brand-carousel') {
    checks.push({ label: 'Titulo vs fondo', fg: colorValue(block, 'titleColor'), bg: colorValue(block, 'backgroundColor') })
  }

  if (block.componentKey === 'trust-badges') {
    checks.push(
      { label: 'Titulo vs fondo', fg: colorValue(block, 'titleColor'), bg: colorValue(block, 'backgroundColor') },
      { label: 'Texto descripcion vs fondo', fg: colorValue(block, 'textColor'), bg: colorValue(block, 'backgroundColor') },
    )
  }

  return checks
    .map((pair) => {
      const ratio = contrastRatio(pair.fg, pair.bg)
      if (ratio === null) return null
      if (ratio < 4.5) {
        return `${pair.label}: contraste bajo (${ratio}:1). Recomendado 4.5:1 o mas.`
      }
      return null
    })
    .filter((item): item is string => item !== null)
}

function getFieldBackgroundPair(block: TemplateBlock, fieldKey: string): { foreground: string; background: string } | null {
  if (block.componentKey === 'hero') {
    if (fieldKey === 'titleColor') {
      return { foreground: colorValue(block, 'titleColor'), background: colorValue(block, 'backgroundColor') }
    }
    if (fieldKey === 'subtitleColor') {
      return { foreground: colorValue(block, 'subtitleColor'), background: colorValue(block, 'backgroundColor') }
    }
    if (fieldKey === 'buttonTextColor') {
      return { foreground: colorValue(block, 'buttonTextColor'), background: colorValue(block, 'buttonBackgroundColor') }
    }
  }

  if (block.componentKey === 'category-strip') {
    if (fieldKey === 'titleColor') {
      return { foreground: colorValue(block, 'titleColor'), background: colorValue(block, 'backgroundColor') }
    }
    if (fieldKey === 'itemTextColor') {
      return { foreground: colorValue(block, 'itemTextColor'), background: colorValue(block, 'itemBackgroundColor') }
    }
  }

  if (block.componentKey === 'product-grid') {
    if (fieldKey === 'titleColor') {
      return { foreground: colorValue(block, 'titleColor'), background: colorValue(block, 'backgroundColor') }
    }
    if (fieldKey === 'priceColor') {
      return { foreground: colorValue(block, 'priceColor'), background: colorValue(block, 'cardBackgroundColor') }
    }
  }

  if (block.componentKey === 'flash-sale') {
    if (fieldKey === 'titleColor') {
      return { foreground: colorValue(block, 'titleColor'), background: colorValue(block, 'backgroundColor') }
    }
    if (fieldKey === 'timerTextColor') {
      return { foreground: colorValue(block, 'timerTextColor'), background: colorValue(block, 'timerBackgroundColor') }
    }
    if (fieldKey === 'priceColor') {
      return { foreground: colorValue(block, 'priceColor'), background: colorValue(block, 'cardBackgroundColor') }
    }
  }

  if (block.componentKey === 'brand-carousel' && fieldKey === 'titleColor') {
    return { foreground: colorValue(block, 'titleColor'), background: colorValue(block, 'backgroundColor') }
  }

  if (block.componentKey === 'trust-badges') {
    if (fieldKey === 'titleColor') {
      return { foreground: colorValue(block, 'titleColor'), background: colorValue(block, 'backgroundColor') }
    }
    if (fieldKey === 'textColor') {
      return { foreground: colorValue(block, 'textColor'), background: colorValue(block, 'backgroundColor') }
    }
  }

  return null
}

function fieldContrastInfo(block: TemplateBlock, fieldKey: string): { ratio: number; isAA: boolean } | null {
  const pair = getFieldBackgroundPair(block, fieldKey)
  if (!pair) return null
  const ratio = contrastRatio(pair.foreground, pair.background)
  if (ratio === null) return null

  const minRatio = props.contrastMinRatio ?? 4.5
  return {
    ratio,
    isAA: ratio >= minRatio,
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-bold text-surface-900 mb-2">Estructura de la pagina</h3>
      <p class="text-sm text-muted">Agrega bloques, cambia textos y colores, y organiza el orden de aparicion.</p>
    </div>

    <div v-if="orderedBlocks.length === 0" class="p-8 text-center border-2 border-dashed border-surface-200 rounded-lg">
      <p class="text-muted mb-3">Tu pagina aun no tiene bloques.</p>
      <UiButton variant="primary" @click="showBlockPicker = true">Agregar primer bloque</UiButton>
    </div>

    <div v-for="(block, idx) in orderedBlocks" :key="block.id" class="border border-surface-200 rounded-lg overflow-hidden">
      <button
        class="w-full p-4 text-left bg-surface-50 hover:bg-surface-100 flex items-center justify-between"
        @click="expandedBlockId = expandedBlockId === block.id ? null : block.id"
      >
        <div>
          <p class="text-sm font-semibold text-surface-900">
            {{ getBlockConfig(block.componentKey)?.icon }} {{ getBlockConfig(block.componentKey)?.label }}
          </p>
          <p class="text-xs text-muted mt-1">{{ getBlockConfig(block.componentKey)?.description }}</p>
        </div>
        <span class="text-xs bg-surface-200 rounded px-2 py-1">Bloque {{ idx + 1 }}</span>
      </button>

      <div v-if="expandedBlockId === block.id" class="p-4 border-t border-surface-200 space-y-3">
        <UiSelect
          label="Ancho de esta seccion"
          :model-value="(block.layoutWidth as string | number | null) ?? 'basic'"
          :options="sectionWidthOptions"
          hint="Controla el ancho visual del bloque en storefront: basico, ancho amplio o full width."
          @update:model-value="updateBlockLayoutWidth(block.id, String($event) as 'basic' | 'wide' | 'full')"
        />

        <UiSelect
          label="Espaciado vertical de esta seccion"
          :model-value="(block.spacingY as string | number | null) ?? 'default'"
          :options="sectionSpacingOptions"
          hint="Controla el padding vertical del hijo directo de la seccion (normal, compacto o sin padding)."
          @update:model-value="updateBlockSpacingY(block.id, String($event) as 'default' | 'compact' | 'none')"
        />

        <UiSelect
          label="Espaciado horizontal de esta seccion"
          :model-value="(block.spacingX as string | number | null) ?? 'default'"
          :options="sectionSpacingXOptions"
          hint="Controla padding izquierdo/derecho del hijo directo (normal, compacto o sin padding)."
          @update:model-value="updateBlockSpacingX(block.id, String($event) as 'default' | 'compact' | 'none')"
        />

        <div class="rounded-lg border border-surface-200 bg-surface-50 p-3">
          <p class="text-xs font-semibold text-surface-800 mb-2">Preset rapido de layout</p>
          <div class="flex flex-wrap gap-2">
            <UiButton size="sm" variant="secondary" @click="applySectionLayoutPreset(block.id, 'edge')">Edge to edge</UiButton>
            <UiButton size="sm" variant="secondary" @click="applySectionLayoutPreset(block.id, 'standard')">Standard</UiButton>
            <UiButton size="sm" variant="secondary" @click="applySectionLayoutPreset(block.id, 'editorial')">Editorial</UiButton>
          </div>
          <p class="text-xs text-surface-500 mt-2">Edge to edge: full + sin padding vertical/horizontal · Standard: basico + normal · Editorial: wide + normal.</p>
        </div>

        <div class="rounded-lg border border-surface-200 bg-surface-50 p-3">
          <p class="text-xs font-semibold text-surface-800 mb-2">Recomendacion de accesibilidad</p>
          <ul v-if="getContrastWarnings(block).length > 0" class="text-xs text-amber-700 list-disc pl-4 space-y-1">
            <li v-for="warning in getContrastWarnings(block)" :key="warning">{{ warning }}</li>
          </ul>
          <p v-else class="text-xs text-emerald-700">Buen contraste visual en los colores principales.</p>
        </div>

        <div v-for="field in getBlockConfig(block.componentKey)?.fields ?? []" :key="`${block.id}-${field.key}`">
          <UiInput
            v-if="field.type === 'text'"
            :label="field.label"
            :hint="field.helpText"
            :model-value="String(block.props[field.key] ?? '')"
            :placeholder="field.placeholder"
            @update:model-value="updateBlockProp(block.id, field.key, $event)"
          />

          <UiInput
            v-else-if="field.type === 'number'"
            type="number"
            :label="field.label"
            :hint="field.helpText"
            :model-value="String(block.props[field.key] ?? '')"
            :placeholder="field.placeholder"
            @update:model-value="updateBlockProp(block.id, field.key, Number($event))"
          />

          <UiTextarea
            v-else-if="field.type === 'textarea'"
            :label="field.label"
            :hint="field.helpText"
            :model-value="String(block.props[field.key] ?? '')"
            :placeholder="field.placeholder"
            :rows="4"
            @update:model-value="updateBlockProp(block.id, field.key, $event)"
          />

          <UiSelect
            v-else-if="field.type === 'select' && field.options"
            :label="field.label"
            :hint="field.helpText"
            :model-value="typeof block.props[field.key] === 'boolean' ? String(block.props[field.key]) : (block.props[field.key] as string | number | null) ?? ''"
            :options="field.options"
            @update:model-value="updateBlockProp(block.id, field.key, $event)"
          />

          <div v-else-if="field.type === 'color'" class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label class="text-sm font-medium text-surface-700">{{ field.label }}</label>
              <UiBadge
                v-if="fieldContrastInfo(block, field.key)"
                :color="fieldContrastInfo(block, field.key)?.isAA ? 'success' : 'warning'"
              >
                {{ fieldContrastInfo(block, field.key)?.isAA ? (props.contrastProfileLabel ?? 'AA') : `No ${props.contrastProfileLabel ?? 'AA'}` }}
                {{ fieldContrastInfo(block, field.key)?.ratio }}:1
              </UiBadge>
            </div>
            <div class="flex items-center gap-3">
              <input
                type="color"
                class="h-10 w-14 rounded border border-surface-200"
                :value="String(block.props[field.key] ?? '#111827')"
                :disabled="props.lockThemeColors"
                @input="updateBlockProp(block.id, field.key, ($event.target as HTMLInputElement).value)"
              >
              <UiInput
                class="flex-1"
                :model-value="String(block.props[field.key] ?? '')"
                :placeholder="field.placeholder"
                :disabled="props.lockThemeColors"
                @update:model-value="updateBlockProp(block.id, field.key, $event)"
              />
            </div>
            <p v-if="props.lockThemeColors" class="text-xs text-primary-700">
              Colores bloqueados por tema activo. Desactiva el bloqueo para personalizar este color.
            </p>
            <p v-if="field.helpText" class="text-xs text-surface-500">{{ field.helpText }}</p>
          </div>

          <div v-else-if="field.type === 'array'" class="space-y-3 rounded-lg border border-surface-200 p-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium">{{ field.label }}</p>
              <UiButton variant="secondary" size="sm" @click="addArrayItem(block, field.key)">Agregar</UiButton>
            </div>

            <div v-if="field.key === 'categories'" class="space-y-3">
              <div v-for="(item, itemIdx) in asArray(block.props[field.key])" :key="`cat-${itemIdx}`" class="grid grid-cols-1 md:grid-cols-3 gap-2 border border-surface-200 rounded p-2">
                <UiInput label="Nombre" :model-value="String(item.label ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'label', $event)" />
                <UiInput label="Slug" :model-value="String(item.slug ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'slug', $event)" />
                <UiInput label="URL de imagen" :model-value="String(item.imageUrl ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'imageUrl', $event)" />
                <div class="md:col-span-3">
                  <UiButton size="sm" variant="danger" @click="removeArrayItem(block, field.key, itemIdx)">Eliminar item</UiButton>
                </div>
              </div>
            </div>

            <div v-else-if="field.key === 'brands'" class="space-y-3">
              <div v-for="(item, itemIdx) in asArray(block.props[field.key])" :key="`brand-${itemIdx}`" class="grid grid-cols-1 md:grid-cols-3 gap-2 border border-surface-200 rounded p-2">
                <UiInput label="Marca" :model-value="String(item.name ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'name', $event)" />
                <UiInput label="Slug" :model-value="String(item.slug ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'slug', $event)" />
                <UiInput label="Logo URL" :model-value="String(item.logoUrl ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'logoUrl', $event)" />
                <div class="md:col-span-3">
                  <UiButton size="sm" variant="danger" @click="removeArrayItem(block, field.key, itemIdx)">Eliminar item</UiButton>
                </div>
              </div>
            </div>

            <div v-else-if="field.key === 'badges'" class="space-y-3">
              <div v-for="(item, itemIdx) in asArray(block.props[field.key])" :key="`badge-${itemIdx}`" class="grid grid-cols-1 md:grid-cols-3 gap-2 border border-surface-200 rounded p-2">
                <UiInput label="Icono" :model-value="String(item.icon ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'icon', $event)" />
                <UiInput label="Titulo" :model-value="String(item.title ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'title', $event)" />
                <UiInput label="Descripcion" :model-value="String(item.description ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'description', $event)" />
                <div class="md:col-span-3">
                  <UiButton size="sm" variant="danger" @click="removeArrayItem(block, field.key, itemIdx)">Eliminar item</UiButton>
                </div>
              </div>
            </div>

            <div v-else-if="field.key === 'banners'" class="space-y-3">
              <div v-for="(item, itemIdx) in asArray(block.props[field.key])" :key="`banner-${itemIdx}`" class="grid grid-cols-1 md:grid-cols-2 gap-2 border border-surface-200 rounded p-2">
                <UiInput label="Titulo" :model-value="String(item.title ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'title', $event)" />
                <UiInput label="Subtitulo" :model-value="String(item.subtitle ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'subtitle', $event)" />
                <UiInput label="Imagen URL" :model-value="String(item.imageUrl ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'imageUrl', $event)" />
                <UiInput label="Destino" :model-value="String(item.href ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'href', $event)" />
                <UiSelect
                  label="Posicion del texto"
                  :model-value="(item.textPosition as string | number | null) ?? 'bottom-left'"
                  :options="bannerTextPositionOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'textPosition', $event)"
                />
                <div class="md:col-span-2">
                  <UiButton size="sm" variant="danger" @click="removeArrayItem(block, field.key, itemIdx)">Eliminar item</UiButton>
                </div>
              </div>
            </div>

            <div v-else-if="field.key === 'slides'" class="space-y-3">
              <div class="flex gap-2 overflow-x-auto pb-1">
                <button
                  v-for="(item, itemIdx) in heroSlides(block, field.key)"
                  :key="`slide-thumb-${itemIdx}`"
                  type="button"
                  :data-hero-slide-thumb-key="heroSlideDragKey(block.id, itemIdx)"
                  draggable="true"
                  class="group relative min-w-[140px] overflow-hidden rounded-xl border text-left transition"
                  :class="[
                    activeHeroSlideIndex(block.id, heroSlides(block, field.key).length) === itemIdx
                      ? 'border-primary-500 ring-2 ring-primary-200'
                      : 'border-surface-200 hover:border-primary-300',
                    heroSlideDropTargetKey === heroSlideDragKey(block.id, itemIdx)
                      ? 'bg-primary-50 border-primary-500'
                      : '',
                  ]"
                  @click="setActiveHeroSlideIndex(block.id, itemIdx)"
                  @dragstart="onHeroSlideThumbDragStart(block.id, itemIdx)"
                  @dragend="onHeroSlideThumbDragEnd"
                  @dragover="onHeroSlideThumbDragOver(block.id, itemIdx, $event)"
                  @dragleave="onHeroSlideThumbDragLeave(block.id, itemIdx)"
                  @drop="onHeroSlideThumbDrop(block, field.key, itemIdx, $event)"
                  @keydown="onHeroSlideThumbKeydown(block, field.key, itemIdx, $event)"
                  @touchstart="onHeroSlideThumbTouchStart(block.id, itemIdx)"
                  @touchmove="onHeroSlideThumbTouchMove($event)"
                  @touchend="onHeroSlideThumbTouchEnd(block, field.key, $event)"
                >
                  <div
                    v-if="heroSlideDropTargetKey === heroSlideDragKey(block.id, itemIdx)"
                    class="pointer-events-none absolute inset-y-2 -left-0.5 z-20 w-1 rounded-full bg-primary-500"
                  />
                  <div class="relative aspect-[4/3] bg-surface-100">
                    <img
                      v-if="slidePreviewSrc(block.id, itemIdx, item)"
                      :src="slidePreviewSrc(block.id, itemIdx, item)"
                      alt="Miniatura del slide"
                      class="absolute inset-0 h-full w-full object-cover"
                      :style="slideImageZoomStyle(item)"
                    >
                    <div v-else class="absolute inset-0 flex items-center justify-center text-[11px] text-surface-500">
                      Sin imagen
                    </div>
                  </div>
                  <div class="px-3 py-2">
                    <p class="truncate text-xs font-semibold text-surface-800">{{ String(item.title ?? `Slide ${itemIdx + 1}`) }}</p>
                    <p class="truncate text-[11px] text-surface-500">{{ itemIdx + 1 }} de {{ heroSlides(block, field.key).length }}</p>
                  </div>
                </button>
              </div>

              <div v-for="({ item, index: itemIdx }) in activeHeroSlideEntries(block, field.key)" :key="`slide-${itemIdx}`" class="grid grid-cols-1 md:grid-cols-2 gap-2 border border-surface-200 rounded p-2">
                <div class="md:col-span-2 overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
                  <div v-if="slidePreviewSrc(block.id, itemIdx, item)" class="relative aspect-[16/6] bg-surface-100">
                    <img
                      :src="slidePreviewSrc(block.id, itemIdx, item)"
                      alt="Preview del slide"
                      class="absolute inset-0 h-full w-full object-cover"
                      :style="slideImageZoomStyle(item)"
                    >
                    <div class="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-white text-xs">
                      Preview del slide {{ itemIdx + 1 }}
                    </div>
                  </div>
                  <div v-else class="flex aspect-[16/6] items-center justify-center text-xs text-surface-500">
                    Aun no hay imagen para este slide.
                  </div>
                </div>
                <UiInput label="Titulo" :model-value="String(item.title ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'title', $event)" />
                <UiInput label="Subtitulo" :model-value="String(item.subtitle ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'subtitle', $event)" />
                <UiInput label="Texto del boton" :model-value="String(item.ctaLabel ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'ctaLabel', $event)" />
                <UiInput label="Destino del boton" :model-value="String(item.ctaHref ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'ctaHref', $event)" />
                <UiInput label="Imagen URL" :model-value="String(item.imageUrl ?? '')" @update:model-value="updateArrayItem(block, field.key, itemIdx, 'imageUrl', $event)" />
                <div class="space-y-2">
                  <div
                    class="rounded-xl border-2 border-dashed p-4 text-center transition-colors"
                    :class="slideDropActiveKey === slideFileKey(block.id, itemIdx) ? 'border-primary-500 bg-primary-50' : 'border-surface-300 bg-surface-50'"
                    @dragover="onHeroSlideDragOver(block.id, itemIdx, $event)"
                    @dragleave="onHeroSlideDragLeave(block.id, itemIdx)"
                    @drop="onHeroSlideDrop(block.id, itemIdx, $event)"
                  >
                    <p class="text-sm font-medium text-surface-800">Arrastra y suelta una imagen aqui</p>
                    <p class="text-xs text-surface-500 mt-1">o selecciona un archivo manualmente abajo.</p>
                    <p v-if="pendingSlideFiles[slideFileKey(block.id, itemIdx)]" class="text-xs text-primary-700 mt-2">
                      Lista para subir: {{ pendingSlideFiles[slideFileKey(block.id, itemIdx)]?.name }}
                    </p>
                  </div>
                  <UiFileInput
                    accept="image/*"
                    label="Subir imagen del slide"
                    hint="Puedes arrastrar y soltar o elegir archivo. Luego presiona Subir imagen."
                    @change="onHeroSlideFileSelected(block.id, itemIdx, $event)"
                  />
                  <UiButton
                    size="sm"
                    variant="secondary"
                    :loading="uploadingSlideImageKey === slideFileKey(block.id, itemIdx)"
                    :disabled="!pendingSlideFiles[slideFileKey(block.id, itemIdx)]"
                    @click="uploadHeroSlideImage(block, field.key, itemIdx)"
                  >
                    Subir imagen
                  </UiButton>
                </div>
                <UiSelect
                  label="Tipo de imagen"
                  :model-value="(item.imageLayout as string | number | null) ?? 'background'"
                  :options="heroImageLayoutOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'imageLayout', $event)"
                />
                <UiSelect
                  label="Alineacion del contenido"
                  :model-value="(item.contentAlignment as string | number | null) ?? 'left'"
                  :options="heroContentAlignmentOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'contentAlignment', $event)"
                />
                <UiSelect
                  label="Ancho del bloque de texto"
                  :model-value="(item.contentWidth as string | number | null) ?? 'regular'"
                  :options="heroContentWidthOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'contentWidth', $event)"
                />
                <UiSelect
                  label="Ancho de imagen lateral"
                  :model-value="(item.imageWidth as string | number | null) ?? 'half'"
                  :options="heroImageWidthOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'imageWidth', $event)"
                />
                <UiSelect
                  label="Altura del banner"
                  :model-value="(item.height as string | number | null) ?? 'tall'"
                  :options="heroHeightOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'height', $event)"
                />
                <UiSelect
                  label="Altura de la imagen lateral"
                  :model-value="(item.sideImageHeight as string | number | null) ?? 'match'"
                  :options="heroSideImageHeightOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'sideImageHeight', $event)"
                />
                <UiSelect
                  label="Enfoque de la imagen"
                  :model-value="(item.imageFocus as string | number | null) ?? 'center'"
                  :options="heroImageFocusOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'imageFocus', $event)"
                />
                <div class="space-y-2">
                  <label class="text-sm font-medium text-surface-700">Zoom de la imagen</label>
                  <div class="flex items-center justify-between gap-2 text-xs text-surface-600">
                    <label class="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        :checked="zoomSnapEnabledForBlock(block.id)"
                        @change="setZoomSnapEnabledForBlock(block.id, ($event.target as HTMLInputElement).checked)"
                      >
                      Ajuste inteligente (snap)
                    </label>
                    <span :title="zoomRecommendation(item)" class="cursor-help text-primary-700">ⓘ Recomendacion</span>
                  </div>
                  <UiSelect
                    label="Preset de encuadre"
                    :model-value="''"
                    :options="heroFramingPresetOptions"
                    hint="Aplica un encuadre recomendado segun tipo de campana."
                    @update:model-value="applyHeroFramingPreset(block, field.key, itemIdx, String($event))"
                  />
                  <div class="flex items-center gap-3">
                    <input
                      type="range"
                      class="w-full"
                      min="100"
                      max="200"
                      step="1"
                      :value="slideImageZoomValue(item)"
                      @input="updateSlideZoom(block, field.key, itemIdx, Number(($event.target as HTMLInputElement).value))"
                    >
                    <UiBadge color="neutral" class="min-w-[4.5rem] justify-center">{{ slideImageZoomValue(item) }}%</UiBadge>
                  </div>
                  <p class="text-xs text-surface-500">Tip teclado miniaturas: ←/→ navega, ⌥+←/→ reordena.</p>
                  <UiButton size="sm" variant="secondary" @click="resetHeroSlideFraming(block, field.key, itemIdx)">
                    Restablecer foco y zoom
                  </UiButton>
                </div>
                <UiInput
                  label="Sombra sobre imagen de fondo"
                  :model-value="String(item.overlayColor ?? '')"
                  placeholder="rgba(0,0,0,0.35)"
                  hint="Sirve para oscurecer un poco la foto y que el texto se lea mejor. Solo aplica cuando la imagen va de fondo."
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'overlayColor', $event)"
                />
                <div class="space-y-2">
                  <label class="text-sm font-medium text-surface-700">Fondo del titulo</label>
                  <div class="flex items-center gap-3">
                    <input
                      type="color"
                      class="h-10 w-14 rounded border border-surface-200"
                      :value="String(item.titleBackgroundColor ?? '#ffffff')"
                      @input="updateArrayItem(block, field.key, itemIdx, 'titleBackgroundColor', ($event.target as HTMLInputElement).value)"
                    >
                    <UiInput
                      class="flex-1"
                      :model-value="String(item.titleBackgroundColor ?? '')"
                      placeholder="Ej: rgba(255,255,255,0.9)"
                      @update:model-value="updateArrayItem(block, field.key, itemIdx, 'titleBackgroundColor', $event)"
                    />
                  </div>
                </div>
                <UiSelect
                  label="Tamano del fondo del titulo"
                  :model-value="(item.titleBackgroundSize as string | number | null) ?? 'fit'"
                  :options="backgroundSizeOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'titleBackgroundSize', $event)"
                />
                <div class="space-y-2">
                  <label class="text-sm font-medium text-surface-700">Fondo del subtitulo</label>
                  <div class="flex items-center gap-3">
                    <input
                      type="color"
                      class="h-10 w-14 rounded border border-surface-200"
                      :value="String(item.subtitleBackgroundColor ?? '#ffffff')"
                      @input="updateArrayItem(block, field.key, itemIdx, 'subtitleBackgroundColor', ($event.target as HTMLInputElement).value)"
                    >
                    <UiInput
                      class="flex-1"
                      :model-value="String(item.subtitleBackgroundColor ?? '')"
                      placeholder="Ej: rgba(255,255,255,0.82)"
                      @update:model-value="updateArrayItem(block, field.key, itemIdx, 'subtitleBackgroundColor', $event)"
                    />
                  </div>
                </div>
                <UiSelect
                  label="Tamano del fondo del subtitulo"
                  :model-value="(item.subtitleBackgroundSize as string | number | null) ?? 'fit'"
                  :options="backgroundSizeOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'subtitleBackgroundSize', $event)"
                />
                <UiSelect
                  label="Tamano del boton"
                  :model-value="(item.buttonSize as string | number | null) ?? 'md'"
                  :options="buttonSizeOptions"
                  @update:model-value="updateArrayItem(block, field.key, itemIdx, 'buttonSize', $event)"
                />
                <div class="md:col-span-2 flex flex-wrap gap-2">
                  <UiButton size="sm" variant="secondary" :disabled="itemIdx === 0" @click="moveHeroSlide(block, field.key, itemIdx, -1)">Subir slide</UiButton>
                  <UiButton size="sm" variant="secondary" :disabled="itemIdx === asArray(block.props[field.key]).length - 1" @click="moveHeroSlide(block, field.key, itemIdx, 1)">Bajar slide</UiButton>
                  <UiButton size="sm" variant="danger" @click="removeHeroSlide(block, field.key, itemIdx)">Eliminar slide</UiButton>
                </div>
              </div>
            </div>

            <p v-if="field.helpText" class="text-xs text-surface-500">{{ field.helpText }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-2 border-t border-surface-100 mt-4">
          <UiButton v-if="idx > 0" size="sm" variant="secondary" @click="moveBlockUp(block.id)">Subir</UiButton>
          <UiButton v-if="idx < orderedBlocks.length - 1" size="sm" variant="secondary" @click="moveBlockDown(block.id)">Bajar</UiButton>
          <UiButton size="sm" variant="secondary" @click="duplicateBlock(block)">Duplicar bloque</UiButton>
          <UiButton size="sm" variant="secondary" :disabled="props.lockThemeColors" @click="resetBlockColors(block)">Restablecer colores</UiButton>
          <UiButton size="sm" variant="danger" class="ml-auto" @click="removeBlock(block.id)">Eliminar bloque</UiButton>
        </div>
      </div>
    </div>

    <div class="relative">
      <UiButton v-if="!showBlockPicker && orderedBlocks.length > 0" variant="primary" class="w-full" @click="showBlockPicker = true">
        Agregar otro bloque
      </UiButton>

      <UiCard v-if="showBlockPicker" class="absolute top-0 left-0 right-0 z-50 max-w-3xl">
        <div class="flex items-center justify-between mb-4">
          <h4 class="font-semibold">Elige un bloque</h4>
          <button class="text-surface-400 hover:text-surface-700" @click="showBlockPicker = false">Cerrar</button>
        </div>

        <div class="flex flex-wrap gap-2 mb-4 pb-4 border-b border-surface-200">
          <button
            class="px-3 py-1 rounded text-sm font-medium"
            :class="filterCategory === null ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-700'"
            @click="filterCategory = null"
          >
            Todos
          </button>
          <button
            v-for="cat in BLOCK_CATEGORIES"
            :key="cat.id"
            class="px-3 py-1 rounded text-sm font-medium"
            :class="filterCategory === cat.id ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-700'"
            @click="filterCategory = cat.id"
          >
            {{ cat.icon }} {{ cat.label }}
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            v-for="blockType in filteredBlocks"
            :key="blockType.id"
            class="p-4 border border-surface-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 text-left"
            @click="addBlock(blockType.id)"
          >
            <p class="text-base font-semibold">{{ blockType.icon }} {{ blockType.label }}</p>
            <p class="text-xs text-muted mt-1">{{ blockType.description }}</p>
          </button>
        </div>
      </UiCard>
    </div>
  </div>
</template>
