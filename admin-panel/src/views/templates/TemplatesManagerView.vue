<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import BlocksBuilder from '@/components/templates/BlocksBuilder.vue'
import { THEME_PRESETS, applyThemeToSections } from '@/config/template-themes.config'
import ListViewToolbar from '@/components/shared/ListViewToolbar.vue'
import TemplatePreviewRenderer from '@/components/templates/TemplatePreviewRenderer.vue'
import {
  templatesService,
  type TemplatePageType,
  type TemplateRecord,
} from '@/services/templates.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const records = ref<TemplateRecord[]>([])
const selectedId = ref<string | null>(null)

const templateKey = ref('home.minimal')
const pageType = ref<TemplatePageType>('home')
const schemaVersion = ref('1.0.0')
const publishNote = ref('')
const rollbackVersion = ref('')
const contentJson = ref('{\n  "meta": {\n    "templateKey": "home.minimal",\n    "channel": "web",\n    "pageType": "home",\n    "schemaVersion": "1.0.0"\n  },\n  "sections": []\n}')
const editMode = ref<'visual' | 'json'>('visual')
const selectedThemeId = ref('minimal-clean')
const lockThemeColors = ref(false)

const wcagProfileOptions = [
  { value: 'aa-normal', label: 'AA normal (4.5:1)' },
  { value: 'aa-large', label: 'AA texto grande (3:1)' },
  { value: 'aaa', label: 'AAA (7:1)' },
] as const

type WcagProfile = (typeof wcagProfileOptions)[number]['value']
const wcagProfile = ref<WcagProfile>('aa-normal')
const WCAG_PROFILE_STORAGE_KEY = 'templates.wcag.profile'
const THEME_ID_STORAGE_KEY = 'templates.theme.id'
const THEME_LOCK_STORAGE_KEY = 'templates.theme.lock'

function isWcagProfile(value: unknown): value is WcagProfile {
  return wcagProfileOptions.some((option) => option.value === value)
}

function readPersistedWcagProfile(): WcagProfile | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(WCAG_PROFILE_STORAGE_KEY)
  if (!raw) return null
  return isWcagProfile(raw) ? raw : null
}

function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && THEME_PRESETS.some((theme) => theme.id === value)
}

function readPersistedThemeId(): string | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(THEME_ID_STORAGE_KEY)
  if (!raw) return null
  return isThemeId(raw) ? raw : null
}

function readPersistedThemeLock(): boolean | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(THEME_LOCK_STORAGE_KEY)
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

type VisualSection = VisualDocument['sections'][number]
type ContrastPair = {
  label: string
  foregroundKey: string
  backgroundKey: string
}

const pageTypeOptions = [
  { value: 'home', label: 'Home' },
  { value: 'category', label: 'Category' },
]

const keyOptions = [
  { value: 'home.minimal', label: 'home.minimal' },
  { value: 'home.main', label: 'home.main' },
  { value: 'category.default', label: 'category.default' },
]

type VisualDocument = {
  meta: {
    templateKey: string
    channel: string
    pageType: string
    schemaVersion: string
  }
  sections: Array<{
    id: string
    componentKey: string
    order: number
    layoutWidth?: 'basic' | 'wide' | 'full'
    spacingY?: 'default' | 'compact' | 'none'
    spacingX?: 'default' | 'compact' | 'none'
    props: Record<string, unknown>
  }>
}

const selectedRecord = computed(() => records.value.find((r) => r.id === selectedId.value) ?? null)

const sortedByVersion = computed(() =>
  [...records.value].sort((a, b) => b.version - a.version)
)

const storefrontPreviewBaseUrl =
  (import.meta.env.VITE_STOREFRONT_PREVIEW_URL as string | undefined) || 'http://localhost:3003/preview'

const previewRemoteUrl = computed(() => {
  const params = new URLSearchParams({
    templateKey: templateKey.value,
  })

  const selectedVersion = selectedRecord.value?.version
  if (typeof selectedVersion === 'number' && selectedVersion > 0) {
    params.set('version', String(selectedVersion))
  }

  return `${storefrontPreviewBaseUrl}?${params.toString()}`
})

const previewState = computed(() => {
  const errors: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(contentJson.value)
  } catch {
    return {
      valid: false,
      errors: ['JSON invalido: corrige el formato para habilitar preview'],
      document: null as Record<string, unknown> | null,
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('El contenido raiz debe ser un objeto JSON')
  }

  const document = parsed as Record<string, unknown>
  const meta = document.meta as Record<string, unknown> | undefined
  const sections = document.sections

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    errors.push('meta es requerido y debe ser objeto')
  } else {
    if (typeof meta.templateKey !== 'string') errors.push('meta.templateKey es requerido')
    if (typeof meta.channel !== 'string') errors.push('meta.channel es requerido')
    if (typeof meta.pageType !== 'string') errors.push('meta.pageType es requerido')
    if (typeof meta.schemaVersion !== 'string') errors.push('meta.schemaVersion es requerido')
  }

  if (!Array.isArray(sections)) {
    errors.push('sections es requerido y debe ser array')
  } else {
    if (sections.length < 1) errors.push('sections debe tener al menos una seccion')

    const seenOrders = new Set<number>()
    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i] as Record<string, unknown>
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        errors.push(`sections[${i}] debe ser objeto`)
        continue
      }

      if (typeof section.id !== 'string') errors.push(`sections[${i}].id es requerido`)
      if (typeof section.componentKey !== 'string') errors.push(`sections[${i}].componentKey es requerido`)
      if (!section.props || typeof section.props !== 'object' || Array.isArray(section.props)) {
        errors.push(`sections[${i}].props debe ser objeto`)
      }

      if (typeof section.order !== 'number' || !Number.isInteger(section.order)) {
        errors.push(`sections[${i}].order debe ser entero`)
      } else if (seenOrders.has(section.order)) {
        errors.push(`sections[${i}].order no puede repetirse`)
      } else {
        seenOrders.add(section.order)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    document,
  }
})

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function statusColor(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'draft') return 'warning'
  return 'neutral'
}

function syncFormFromRecord(record: TemplateRecord) {
  selectedId.value = record.id
  templateKey.value = record.templateKey
  pageType.value = record.pageType
  schemaVersion.value = record.schemaVersion
  publishNote.value = record.publishNote ?? ''
  contentJson.value = JSON.stringify(record.content, null, 2)
}

function parseContentOrThrow(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(contentJson.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El contenido debe ser un objeto JSON valido.')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'JSON invalido'))
  }
}

function parseVisualDocument(): VisualDocument {
  try {
    const parsed = JSON.parse(contentJson.value) as Record<string, unknown>
    const meta = (parsed.meta ?? {}) as Record<string, unknown>
    const sections = Array.isArray(parsed.sections) ? parsed.sections : []

    return {
      meta: {
        templateKey: typeof meta.templateKey === 'string' ? meta.templateKey : templateKey.value,
        channel: typeof meta.channel === 'string' ? meta.channel : 'web',
        pageType: typeof meta.pageType === 'string' ? meta.pageType : pageType.value,
        schemaVersion: typeof meta.schemaVersion === 'string' ? meta.schemaVersion : schemaVersion.value,
      },
      sections: sections
        .filter((section) => section && typeof section === 'object')
        .map((section, index) => {
          const row = section as Record<string, unknown>
          return {
            id: typeof row.id === 'string' ? row.id : `section-${index + 1}`,
            componentKey: typeof row.componentKey === 'string' ? row.componentKey : 'hero',
            order: typeof row.order === 'number' ? row.order : index + 1,
            layoutWidth:
              row.layoutWidth === 'wide' || row.layoutWidth === 'full' || row.layoutWidth === 'basic'
                ? row.layoutWidth
                : 'basic',
            spacingY:
              row.spacingY === 'none' || row.spacingY === 'default' || row.spacingY === 'compact'
                ? row.spacingY
                : 'default',
            spacingX:
              row.spacingX === 'none' || row.spacingX === 'default' || row.spacingX === 'compact'
                ? row.spacingX
                : 'default',
            props: row.props && typeof row.props === 'object' && !Array.isArray(row.props)
              ? (row.props as Record<string, unknown>)
              : {},
          }
        }),
    }
  } catch {
    return {
      meta: {
        templateKey: templateKey.value,
        channel: 'web',
        pageType: pageType.value,
        schemaVersion: schemaVersion.value,
      },
      sections: [],
    }
  }
}

function updateFromVisualBlocks(blocks: VisualDocument['sections']) {
  const current = parseVisualDocument()
  const normalizedBlocks = lockThemeColors.value
    ? applyThemeToSections(blocks, selectedThemeId.value)
    : blocks

  const next: VisualDocument = {
    meta: {
      templateKey: templateKey.value,
      channel: 'web',
      pageType: pageType.value,
      schemaVersion: schemaVersion.value,
    },
    sections: normalizedBlocks,
  }
  contentJson.value = JSON.stringify(next, null, 2)
  if (!current.meta) {
    contentJson.value = JSON.stringify(next, null, 2)
  }
}

function applyThemePreset(themeId: string) {
  const doc = parseVisualDocument()
  if (doc.sections.length === 0) {
    toast.warning('Sin bloques', 'Agrega al menos un bloque antes de aplicar tema')
    return
  }

  const themedSections = applyThemeToSections(doc.sections, themeId)
  updateFromVisualBlocks(themedSections)
  toast.success('Tema aplicado', 'Los colores del template fueron actualizados')
}

async function loadRecords() {
  loading.value = true
  try {
    records.value = await templatesService.list({
      templateKey: templateKey.value,
      sortBy: 'version',
      sortOrder: 'DESC',
    })

    if (records.value.length > 0) {
      syncFormFromRecord(records.value[0])
      rollbackVersion.value = String(records.value[0].version)
    } else {
      selectedId.value = null
      rollbackVersion.value = ''
    }
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo cargar el historial de templates'))
  } finally {
    loading.value = false
  }
}

async function loadLatestPublished() {
  loading.value = true
  try {
    const record = await templatesService.getPublished(templateKey.value, { channel: 'web' })
    syncFormFromRecord(record)
    toast.success('Template cargado', `Cargado ${record.templateKey} v${record.version}`)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo cargar el template publicado'))
  } finally {
    loading.value = false
  }
}

async function createDraft() {
  saving.value = true
  try {
    const created = await templatesService.create({
      templateKey: templateKey.value,
      channel: 'web',
      pageType: pageType.value,
      schemaVersion: schemaVersion.value,
      content: parseContentOrThrow(),
    })

    toast.success('Draft creado', `${created.templateKey} listo para publicar`)
    await loadRecords()
    syncFormFromRecord(created)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo crear el draft'))
  } finally {
    saving.value = false
  }
}

async function updateDraft() {
  if (!selectedRecord.value || selectedRecord.value.status !== 'draft') {
    toast.warning('Accion no valida', 'Selecciona un draft para actualizar')
    return
  }

  saving.value = true
  try {
    const updated = await templatesService.update(selectedRecord.value.id, {
      schemaVersion: schemaVersion.value,
      content: parseContentOrThrow(),
    })

    toast.success('Draft actualizado', `${updated.templateKey} actualizado`)
    await loadRecords()
    syncFormFromRecord(updated)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo actualizar el draft'))
  } finally {
    saving.value = false
  }
}

async function publishDraft() {
  if (!selectedRecord.value || selectedRecord.value.status !== 'draft') {
    toast.warning('Accion no valida', 'Selecciona un draft para publicar')
    return
  }

  publishing.value = true
  try {
    const published = await templatesService.publish(selectedRecord.value.id, publishNote.value || undefined)
    toast.success('Publicado', `${published.templateKey} v${published.version} publicado`)
    await loadRecords()
    syncFormFromRecord(published)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo publicar el draft'))
  } finally {
    publishing.value = false
  }
}

async function rollbackFromVersion() {
  if (!selectedRecord.value || !rollbackVersion.value) {
    toast.warning('Accion no valida', 'Selecciona un template y una version origen')
    return
  }

  const sourceVersion = Number(rollbackVersion.value)
  if (!Number.isInteger(sourceVersion) || sourceVersion < 1) {
    toast.warning('Version invalida', 'Ingresa una version valida para rollback')
    return
  }

  publishing.value = true
  try {
    const published = await templatesService.rollback(selectedRecord.value.id, sourceVersion)
    toast.success('Rollback publicado', `${published.templateKey} v${published.version}`)
    await loadRecords()
    syncFormFromRecord(published)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo ejecutar rollback'))
  } finally {
    publishing.value = false
  }
}

const deletingId = ref<string | null>(null)
const confirmDeleteRecord = ref<TemplateRecord | null>(null)

function requestDeleteRecord(record: TemplateRecord) {
  confirmDeleteRecord.value = record
}

async function confirmDelete() {
  const record = confirmDeleteRecord.value
  if (!record) return

  deletingId.value = record.id
  try {
    await templatesService.remove(record.id)
    toast.success('Eliminado', `${record.templateKey} v${record.version} eliminado`)
    if (selectedId.value === record.id) {
      selectedId.value = null
    }
    await loadRecords()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo eliminar la version'))
  } finally {
    deletingId.value = null
    confirmDeleteRecord.value = null
  }
}

function cancelDelete() {
  confirmDeleteRecord.value = null
}

onMounted(async () => {
  const persistedProfile = readPersistedWcagProfile()
  if (persistedProfile) {
    wcagProfile.value = persistedProfile
  }

  const persistedThemeId = readPersistedThemeId()
  if (persistedThemeId) {
    selectedThemeId.value = persistedThemeId
  }

  const persistedThemeLock = readPersistedThemeLock()
  if (persistedThemeLock !== null) {
    lockThemeColors.value = persistedThemeLock
  }

  await loadRecords()
})

watch(wcagProfile, (next) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WCAG_PROFILE_STORAGE_KEY, next)
})

watch(selectedThemeId, (next) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THEME_ID_STORAGE_KEY, next)
})

watch(lockThemeColors, (next) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THEME_LOCK_STORAGE_KEY, String(next))
})

const visualDocument = computed(() => parseVisualDocument())

function blockLabel(componentKey: string): string {
  const labels: Record<string, string> = {
    hero: 'Banner principal',
    'category-strip': 'Categorias destacadas',
    'product-grid': 'Grilla de productos',
    'flash-sale': 'Venta rapida',
    'brand-carousel': 'Marcas',
    'trust-badges': 'Confianza',
    'promo-banners': 'Banners promocionales',
  }

  return labels[componentKey] ?? componentKey
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

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mixColor(
  source: [number, number, number],
  target: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.round(source[0] + (target[0] - source[0]) * amount),
    Math.round(source[1] + (target[1] - source[1]) * amount),
    Math.round(source[2] + (target[2] - source[2]) * amount),
  ]
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

function colorDefaults(componentKey: string): Record<string, string> {
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

function colorValue(section: VisualSection, key: string): string {
  const value = section.props[key]
  if (typeof value === 'string' && value.trim().length > 0) return value
  return colorDefaults(section.componentKey)[key] ?? '#ffffff'
}

function getContrastPairs(section: VisualSection): ContrastPair[] {
  if (section.componentKey === 'hero') {
    return [
      { label: 'Titulo vs fondo', foregroundKey: 'titleColor', backgroundKey: 'backgroundColor' },
      { label: 'Subtitulo vs fondo', foregroundKey: 'subtitleColor', backgroundKey: 'backgroundColor' },
      { label: 'Texto boton vs fondo boton', foregroundKey: 'buttonTextColor', backgroundKey: 'buttonBackgroundColor' },
    ]
  }

  if (section.componentKey === 'category-strip') {
    return [
      { label: 'Titulo vs fondo', foregroundKey: 'titleColor', backgroundKey: 'backgroundColor' },
      { label: 'Texto item vs fondo item', foregroundKey: 'itemTextColor', backgroundKey: 'itemBackgroundColor' },
    ]
  }

  if (section.componentKey === 'product-grid') {
    return [
      { label: 'Titulo vs fondo', foregroundKey: 'titleColor', backgroundKey: 'backgroundColor' },
      { label: 'Precio vs fondo tarjeta', foregroundKey: 'priceColor', backgroundKey: 'cardBackgroundColor' },
    ]
  }

  if (section.componentKey === 'flash-sale') {
    return [
      { label: 'Titulo vs fondo', foregroundKey: 'titleColor', backgroundKey: 'backgroundColor' },
      { label: 'Texto timer vs fondo timer', foregroundKey: 'timerTextColor', backgroundKey: 'timerBackgroundColor' },
      { label: 'Precio vs fondo tarjeta', foregroundKey: 'priceColor', backgroundKey: 'cardBackgroundColor' },
    ]
  }

  if (section.componentKey === 'brand-carousel') {
    return [
      { label: 'Titulo vs fondo', foregroundKey: 'titleColor', backgroundKey: 'backgroundColor' },
    ]
  }

  if (section.componentKey === 'trust-badges') {
    return [
      { label: 'Titulo vs fondo', foregroundKey: 'titleColor', backgroundKey: 'backgroundColor' },
      { label: 'Texto descripcion vs fondo', foregroundKey: 'textColor', backgroundKey: 'backgroundColor' },
    ]
  }

  return []
}

const wcagThreshold = computed(() => {
  if (wcagProfile.value === 'aaa') return 7
  if (wcagProfile.value === 'aa-large') return 3
  return 4.5
})

const wcagBadgeLabel = computed(() => {
  if (wcagProfile.value === 'aaa') return 'AAA'
  return 'AA'
})

const contrastHealth = computed(() => {
  const issues: Array<{
    sectionId: string
    block: string
    label: string
    ratio: number
    minRatio: number
  }> = []

  let knownChecks = 0

  for (const section of visualDocument.value.sections) {
    for (const pair of getContrastPairs(section)) {
      const ratio = contrastRatio(colorValue(section, pair.foregroundKey), colorValue(section, pair.backgroundKey))
      if (ratio === null) continue
      knownChecks += 1
      if (ratio < wcagThreshold.value) {
        issues.push({
          sectionId: section.id,
          block: blockLabel(section.componentKey),
          label: pair.label,
          ratio,
          minRatio: wcagThreshold.value,
        })
      }
    }
  }

  if (knownChecks === 0) {
    return {
      color: 'neutral' as const,
      title: 'Sin datos de contraste',
      subtitle: 'Agrega bloques con colores para evaluar accesibilidad.',
      issues,
      knownChecks,
    }
  }

  const failed = issues.length
  const failRate = failed / knownChecks

  if (failed === 0) {
    return {
      color: 'success' as const,
      title: 'Semaforo: Verde',
      subtitle: `Todos los contrastes principales cumplen AA (${knownChecks}/${knownChecks}).`,
      issues,
      knownChecks,
    }
  }

  if (failRate <= 0.35) {
    return {
      color: 'warning' as const,
      title: 'Semaforo: Amarillo',
      subtitle: `${failed} de ${knownChecks} contrastes no cumplen AA.`,
      issues,
      knownChecks,
    }
  }

  return {
    color: 'danger' as const,
    title: 'Semaforo: Rojo',
    subtitle: `${failed} de ${knownChecks} contrastes no cumplen AA.`,
    issues,
    knownChecks,
  }
})

function distance(a: [number, number, number], b: [number, number, number]): number {
  return ((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2)
}

function findAccessibleForeground(foreground: string, background: string, minRatio: number): string {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return foreground

  const current = contrastRatio(foreground, background)
  if (current !== null && current >= minRatio) return foreground

  const targets: [number, number, number][] = [[0, 0, 0], [255, 255, 255]]

  let bestColor: [number, number, number] | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const target of targets) {
    for (let step = 1; step <= 60; step += 1) {
      const amount = step / 60
      const candidate = mixColor(fg, target, amount)
      const ratio = contrastRatio(rgbToHex(candidate), rgbToHex(bg))
      if (ratio === null || ratio < minRatio) continue

      const d = distance(fg, candidate)
      if (d < bestDistance) {
        bestDistance = d
        bestColor = candidate
      }
      break
    }
  }

  return bestColor ? rgbToHex(bestColor) : foreground
}

function autoFixContrast() {
  if (editMode.value !== 'visual') {
    toast.warning('Modo visual recomendado', 'Cambia a modo facil para usar la autocorreccion de contraste')
    return
  }

  if (lockThemeColors.value) {
    toast.warning('Bloqueo activo', 'Desactiva el bloqueo de colores para aplicar autocorreccion')
    return
  }

  const doc = parseVisualDocument()
  if (doc.sections.length === 0) {
    toast.warning('Sin bloques', 'Agrega al menos un bloque para corregir contraste')
    return
  }

  let changed = 0

  const nextSections = doc.sections.map((section) => {
    const nextProps = { ...section.props }

    for (const pair of getContrastPairs(section)) {
      const foreground = typeof nextProps[pair.foregroundKey] === 'string'
        ? String(nextProps[pair.foregroundKey])
        : colorValue(section, pair.foregroundKey)
      const background = typeof nextProps[pair.backgroundKey] === 'string'
        ? String(nextProps[pair.backgroundKey])
        : colorValue(section, pair.backgroundKey)

      const ratio = contrastRatio(foreground, background)
      if (ratio === null || ratio >= wcagThreshold.value) continue

      const adjusted = findAccessibleForeground(foreground, background, wcagThreshold.value)
      if (adjusted !== foreground) {
        nextProps[pair.foregroundKey] = adjusted
        changed += 1
      }
    }

    return {
      ...section,
      props: nextProps,
    }
  })

  if (changed === 0) {
    toast.info('Sin cambios', 'No se detectaron colores ajustables con bajo contraste')
    return
  }

  updateFromVisualBlocks(nextSections)
  toast.success('Autocorreccion aplicada', `Se ajustaron ${changed} colores para cumplir ${wcagBadgeLabel.value}`)
}

function openRemotePreview() {
  if (!selectedRecord.value || selectedRecord.value.status !== 'draft') {
    window.open(previewRemoteUrl.value, '_blank', 'noopener,noreferrer')
    return
  }

  publishing.value = true
  templatesService
    .createPreviewToken(selectedRecord.value.id)
    .then((payload) => {
      const params = new URLSearchParams({
        draftId: payload.templateId,
        token: payload.token,
      })
      window.open(`${storefrontPreviewBaseUrl}?${params.toString()}`, '_blank', 'noopener,noreferrer')
    })
    .catch((error) => {
      toast.error('Error', extractErrorMessage(error, 'No se pudo generar token de preview'))
    })
    .finally(() => {
      publishing.value = false
    })
}
</script>

<template>
  <div class="space-y-4">
    <ListViewToolbar>
      <template #filters>
        <UiSelect
          v-model="templateKey"
          label="Template key"
          :options="keyOptions"
          size="sm"
        />
      </template>
      <template #actions>
        <UiButton variant="secondary" size="sm" :loading="loading" @click="loadRecords">
          Refrescar historial
        </UiButton>
        <UiButton variant="secondary" size="sm" :loading="loading" @click="loadLatestPublished">
          Cargar publicado
        </UiButton>
        <UiButton variant="secondary" size="sm" @click="openRemotePreview">
          Abrir preview remoto
        </UiButton>
      </template>
    </ListViewToolbar>

    <div class="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      <UiCard :padding="false">
        <div class="p-4 border-b border-surface-200">
          <h2 class="text-base font-semibold">Historial de versiones</h2>
          <p class="text-xs text-muted mt-1">{{ templateKey }}</p>
        </div>

        <div v-if="loading" class="p-8 flex justify-center">
          <UiSpinner />
        </div>

        <div v-else-if="sortedByVersion.length === 0" class="p-6 text-sm text-muted text-center">
          No hay versiones para este template.
        </div>

        <div v-else class="divide-y divide-surface-200 max-h-[70vh] overflow-y-auto">
          <div
            v-for="row in sortedByVersion"
            :key="row.id"
            class="group flex items-stretch hover:bg-surface-50 transition-colors"
            :class="selectedId === row.id ? 'bg-primary-50 border-l-2 border-primary-600' : ''"
          >
            <button
              type="button"
              class="flex-1 text-left p-4 min-w-0"
              @click="syncFormFromRecord(row)"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-semibold">v{{ row.version }}</p>
                <UiBadge :color="statusColor(row.status)">{{ row.status }}</UiBadge>
              </div>
              <p class="text-xs text-muted mt-1">Actualizado: {{ formatDate(row.updatedAt) }}</p>
              <p class="text-xs text-muted">Publicado: {{ formatDate(row.publishedAt) }}</p>
            </button>
            <div class="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                class="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                :disabled="deletingId === row.id || row.status === 'published'"
                :title="row.status === 'published' ? 'Primero depreca la version publicada' : 'Eliminar esta version'"
                @click.stop="requestDeleteRecord(row)"
              >
                <svg v-if="deletingId === row.id" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </UiCard>

      <UiCard>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UiSelect v-model="templateKey" label="Template key" :options="keyOptions" />
            <UiSelect v-model="pageType" label="Page type" :options="pageTypeOptions" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UiInput v-model="schemaVersion" label="Schema version" placeholder="1.0.0" />
            <UiInput
              v-model="rollbackVersion"
              label="Version para rollback"
              type="number"
              min="1"
            />
          </div>

          <UiInput v-model="publishNote" label="Nota de publicacion" placeholder="Opcional" />

          <div class="space-y-3 rounded-lg border border-surface-200 p-3 bg-surface-50">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-surface-900">Editor del template</h3>
              <div class="flex gap-2">
                <UiButton size="sm" :variant="editMode === 'visual' ? 'primary' : 'secondary'" @click="editMode = 'visual'">
                  Modo facil
                </UiButton>
                <UiButton size="sm" :variant="editMode === 'json' ? 'primary' : 'secondary'" @click="editMode = 'json'">
                  Modo avanzado (JSON)
                </UiButton>
              </div>
            </div>
            <p class="text-xs text-muted">
              Modo facil recomendado para negocio: agrega bloques, cambia textos, colores y orden sin tocar JSON.
            </p>
          </div>

          <BlocksBuilder
            v-if="editMode === 'visual'"
            :blocks="visualDocument.sections"
            :lock-theme-colors="lockThemeColors"
            :contrast-min-ratio="wcagThreshold"
            :contrast-profile-label="wcagBadgeLabel"
            @update="updateFromVisualBlocks"
          />

          <UiCard v-if="editMode === 'visual'">
            <div class="space-y-3">
              <h3 class="text-sm font-semibold">Temas de color (1 clic)</h3>
              <p class="text-xs text-muted">
                Elige una paleta bonita para toda la pagina. Luego puedes ajustar colores por bloque si lo deseas.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  v-for="theme in THEME_PRESETS"
                  :key="theme.id"
                  type="button"
                  class="rounded-lg border p-3 text-left transition-colors"
                  :class="selectedThemeId === theme.id ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-primary-300'"
                  @click="selectedThemeId = theme.id"
                >
                  <p class="text-sm font-semibold">{{ theme.name }}</p>
                  <p class="text-xs text-muted mt-1">{{ theme.description }}</p>
                  <div class="flex gap-1 mt-3">
                    <span
                      v-for="sw in theme.swatches"
                      :key="`${theme.id}-${sw}`"
                      class="h-5 w-5 rounded border border-surface-200"
                      :style="{ backgroundColor: sw }"
                    />
                  </div>
                </button>
              </div>

              <div class="flex justify-end">
                <div class="flex flex-wrap items-center gap-2">
                  <UiButton
                    size="sm"
                    :variant="lockThemeColors ? 'primary' : 'secondary'"
                    @click="lockThemeColors = !lockThemeColors"
                  >
                    {{ lockThemeColors ? 'Bloqueo de colores: ACTIVO' : 'Bloqueo de colores: INACTIVO' }}
                  </UiButton>
                  <UiButton variant="secondary" @click="applyThemePreset(selectedThemeId)">
                    Aplicar tema seleccionado
                  </UiButton>
                </div>
              </div>
              <p class="text-xs text-muted">
                Con bloqueo activo, los colores se mantienen segun el tema y evitas inconsistencias visuales.
              </p>
            </div>
          </UiCard>

          <UiCard v-if="editMode === 'visual'">
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-sm font-semibold">Salud de contraste</h3>
                  <p class="text-xs text-muted">Semaforo global para detectar riesgos de legibilidad.</p>
                </div>
                <UiBadge :color="contrastHealth.color">{{ contrastHealth.title }}</UiBadge>
              </div>

              <UiSelect
                v-model="wcagProfile"
                label="Perfil WCAG"
                :options="wcagProfileOptions as unknown as Array<{ value: string; label: string }>"
              />

              <p class="text-xs text-surface-700">{{ contrastHealth.subtitle }}</p>

              <div
                v-if="contrastHealth.issues.length > 0"
                class="rounded-lg border border-warning-200 bg-warning-50 p-3"
              >
                <p class="text-xs font-semibold text-warning-700 mb-1">Revisar primero:</p>
                <ul class="text-xs text-warning-700 list-disc pl-4 space-y-1 max-h-32 overflow-auto">
                  <li v-for="issue in contrastHealth.issues" :key="`${issue.sectionId}-${issue.label}`">
                    {{ issue.block }}: {{ issue.label }} ({{ issue.ratio }}:1)
                  </li>
                </ul>
              </div>

              <div class="flex justify-end">
                <UiButton
                  variant="secondary"
                  :disabled="lockThemeColors"
                  @click="autoFixContrast"
                >
                  Corregir contraste automaticamente
                </UiButton>
              </div>
              <p v-if="lockThemeColors" class="text-xs text-primary-700">
                Desactiva el bloqueo de tema para aplicar autocorreccion.
              </p>
            </div>
          </UiCard>

          <UiTextarea
            v-else
            v-model="contentJson"
            label="Template content (JSON)"
            :rows="20"
            hint="Modo avanzado: usa JSON solo si necesitas ajustes tecnicos"
          />

          <UiCard>
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Preview en vivo</h3>
                <UiBadge :color="previewState.valid ? 'success' : 'warning'">
                  {{ previewState.valid ? 'Valido' : 'Con observaciones' }}
                </UiBadge>
              </div>

              <div v-if="!previewState.valid" class="rounded-lg border border-warning-200 bg-warning-50 p-3">
                <p class="text-xs font-medium text-warning-700 mb-1">Corrige antes de publicar:</p>
                <ul class="text-xs text-warning-700 list-disc pl-4 space-y-1">
                  <li v-for="(error, idx) in previewState.errors" :key="`preview-error-${idx}`">{{ error }}</li>
                </ul>
              </div>

              <TemplatePreviewRenderer
                v-if="previewState.valid && previewState.document"
                :document="previewState.document as any"
              />
            </div>
          </UiCard>

          <div class="flex flex-wrap gap-2">
            <UiButton :loading="saving" @click="createDraft">Crear draft</UiButton>
            <UiButton variant="secondary" :loading="saving" @click="updateDraft">Actualizar draft</UiButton>
            <UiButton variant="secondary" :loading="publishing" @click="publishDraft">Publicar draft</UiButton>
            <UiButton variant="danger" :loading="publishing" @click="rollbackFromVersion">Rollback</UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </div>

  <UiConfirm
    :show="confirmDeleteRecord !== null"
    variant="danger"
    title="Eliminar version"
    :message="confirmDeleteRecord ? `¿Eliminar ${confirmDeleteRecord.templateKey} v${confirmDeleteRecord.version}? Esta accion no se puede deshacer.` : ''"
    confirm-label="Eliminar"
    cancel-label="Cancelar"
    :loading="deletingId !== null"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>
