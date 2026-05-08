<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import SignaturePad from 'signature_pad'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import { adminToolsService } from '@/services/admin-tools.service'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'

type ToolMode = 'select' | 'text' | 'signature' | 'highlight' | 'stamp' | 'pencil' | 'image'
type AnnotationType = 'text' | 'signature' | 'highlight' | 'stamp' | 'drawing' | 'image'
type FontFamily = 'sans' | 'serif' | 'mono'

interface AnnotationItem {
  id: string
  page: number
  type: AnnotationType
  x: number
  y: number
  width: number
  height: number
  text?: string
  fontSize?: number
  color?: string
  imageDataUrl?: string
  strokeWidth?: number
  points?: Array<{ x: number; y: number }>
  fontFamily?: FontFamily
  bold?: boolean
  italic?: boolean
}

interface PdfEditorDraft {
  version: 1
  documentKey: string
  fileName: string
  totalPages: number
  annotations: AnnotationItem[]
}

interface PdfEditorTestApi {
  bootstrapMockDocument: (payload?: {
    fileName?: string
    documentKey?: string
    totalPages?: number
  }) => void
}

interface ImageQueueItem {
  id: string
  file: File
  previewUrl: string
}

type ImagePageSize = 'a4' | 'letter' | 'fit'
type SourceMode = 'pdf' | 'images' | 'text' | 'docx'

const DRAFT_STORAGE_KEY_PREFIX = 'admin-panel:pdf-editor:draft:v1'
const MAX_UNDO_STEPS = 80
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const LETTER_WIDTH_PT = 612
const LETTER_HEIGHT_PT = 792
const SUPPORTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

GlobalWorkerOptions.workerSrc = workerSrc

const toast = useToast()

const fileName = ref('')
const documentKey = ref('')
const fileBytes = ref<Uint8Array | null>(null)
const pdfDocument = shallowRef<PDFDocumentProxy | null>(null)

const currentPage = ref(1)
const totalPages = ref(0)
const renderScale = ref(1.3)

const pageCanvas = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const signatureCanvas = ref<HTMLCanvasElement | null>(null)

const pageWidth = ref(0)
const pageHeight = ref(0)
const loadingPage = ref(false)
const exporting = ref(false)

const selectedTool = ref<ToolMode>('select')
const selectedAnnotationId = ref<string | null>(null)
const annotations = ref<AnnotationItem[]>([])
const undoStack = ref<AnnotationItem[][]>([])
const redoStack = ref<AnnotationItem[][]>([])
const draftAvailable = ref(false)
const serverDraftAvailable = ref(false)

const textDraft = ref('Texto editable')
const textColorDraft = ref('#111827')
const textSizeDraft = ref(0.03)
const textPreset = ref<'normal' | 'titulo' | 'caption'>('normal')
const fontFamilyDraft = ref<FontFamily>('sans')
const fontBoldDraft = ref(false)
const fontItalicDraft = ref(false)
const signaturePreset = ref<'compacta' | 'ancha'>('compacta')
const highlightColorDraft = ref('#facc15')
const stampTextDraft = ref('APROBADO')
const stampColorDraft = ref('#b91c1c')
const pencilColorDraft = ref('#111827')
const pencilWidthDraft = ref(0.005)

const showSignaturePad = ref(false)
const snapGuideX = ref<number | null>(null)
const snapGuideY = ref<number | null>(null)
const isRibbonCompact = ref(false)
const pendingInsertPosition = ref<{ x: number; y: number } | null>(null)
const editingTextId = ref<string | null>(null)
const editingTextValue = ref('')
const replacingSignatureId = ref<string | null>(null)

const isDraggingFile = ref(false)
const isConverting = ref(false)
const conversionLabel = ref('')
const showImagesModal = ref(false)
const showTextModal = ref(false)
const imageQueue = ref<ImageQueueItem[]>([])
const imagePageSize = ref<ImagePageSize>('a4')
const imageMargin = ref(24)
const textComposerName = ref('documento.pdf')
const textComposerValue = ref('')
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null
let signaturePad: SignaturePad | null = null
let onKeyDownHandler: ((event: KeyboardEvent) => void) | null = null
let onScrollHandler: (() => void) | null = null
let installedTestApiWindow: (Window & { __pdfEditorTestApi?: PdfEditorTestApi; Cypress?: unknown }) | null = null

let activeDrag: {
  id: string
  startX: number
  startY: number
  baseX: number
  baseY: number
  snapshot: AnnotationItem[]
} | null = null

let activeResize: {
  id: string
  handle: 'nw' | 'ne' | 'sw' | 'se'
  startX: number
  startY: number
  baseX: number
  baseY: number
  baseWidth: number
  baseHeight: number
  snapshot: AnnotationItem[]
} | null = null

const activeDraw = ref<{
  points: Array<{ x: number; y: number }>
} | null>(null)

const pageAnnotations = computed(() =>
  annotations.value.filter((annotation) => annotation.page === currentPage.value),
)
const pageShapeAnnotations = computed(() =>
  pageAnnotations.value.filter((annotation) => annotation.type === 'drawing'),
)

const hasDocument = computed(() => Boolean(fileBytes.value && pdfDocument.value))
const canSaveOrExport = computed(() => hasDocument.value && Boolean(documentKey.value))
const draftStatusLabel = computed(() => {
  if (!hasDocument.value) return 'Sin documento cargado'
  if (serverDraftAvailable.value) return 'Borrador disponible en servidor'
  if (draftAvailable.value) return 'Borrador disponible en este navegador'
  return 'Sin borrador guardado'
})
const selectedToolLabel = computed(() => {
  if (selectedTool.value === 'text') return 'Texto'
  if (selectedTool.value === 'signature') return 'Firma'
  if (selectedTool.value === 'highlight') return 'Resaltar'
  if (selectedTool.value === 'stamp') return 'Sello'
  if (selectedTool.value === 'pencil') return 'Lapiz'
  if (selectedTool.value === 'image') return 'Imagen'
  return 'Seleccion'
})
const zoomPercent = computed(() => Math.round(renderScale.value * 100))

const selectedAnnotation = computed(() =>
  annotations.value.find((annotation) => annotation.id === selectedAnnotationId.value) ?? null,
)
const totalAnnotationCount = computed(() => annotations.value.length)
const pageAnnotationCount = computed(() => pageAnnotations.value.length)
const pageNumberList = computed(() =>
  Array.from({ length: totalPages.value }, (_, index) => index + 1),
)

function clamp01(value: number) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function snapWithGuide(value: number) {
  const snapPoints = [0, 0.25, 0.5, 0.75, 1]
  const threshold = 0.015

  let nearestPoint: number | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const point of snapPoints) {
    const distance = Math.abs(value - point)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestPoint = point
    }
  }

  if (nearestPoint !== null && nearestDistance <= threshold) {
    return {
      value: nearestPoint,
      guide: nearestPoint,
    }
  }

  return {
    value,
    guide: null,
  }
}

function annotationCountForPage(page: number) {
  return annotations.value.reduce((count, annotation) => {
    if (annotation.page === page) {
      return count + 1
    }
    return count
  }, 0)
}

function getPointerPositionOnOverlay(event: MouseEvent | PointerEvent) {
  if (!overlayRef.value) {
    return { x: 0.1, y: 0.1 }
  }

  const rect = overlayRef.value.getBoundingClientRect()
  const rawX = (event.clientX - rect.left) / Math.max(1, rect.width)
  const rawY = (event.clientY - rect.top) / Math.max(1, rect.height)

  return {
    x: clamp01(rawX),
    y: clamp01(rawY),
  }
}

function minAnnotationSize() {
  const minWidth = 20 / Math.max(1, pageWidth.value)
  const minHeight = 20 / Math.max(1, pageHeight.value)
  return {
    width: Math.max(0.02, minWidth),
    height: Math.max(0.02, minHeight),
  }
}

function onOverlayPointerDown(event: PointerEvent) {
  if (!hasDocument.value || !overlayRef.value) return
  if (selectedTool.value !== 'pencil') return
  if (event.target !== overlayRef.value) return

  const start = getPointerPositionOnOverlay(event)
  activeDraw.value = {
    points: [start],
  }
}

function onOverlayClick(event: MouseEvent) {
  if (!hasDocument.value) return
  if (editingTextId.value) return

  if (selectedTool.value === 'text') {
    const position = getPointerPositionOnOverlay(event)
    addTextAnnotation(position)
    return
  }

  if (selectedTool.value === 'signature') {
    pendingInsertPosition.value = getPointerPositionOnOverlay(event)
    openSignaturePad()
    return
  }

  if (selectedTool.value === 'highlight') {
    addHighlightAnnotation(getPointerPositionOnOverlay(event))
    return
  }

  if (selectedTool.value === 'stamp') {
    addStampAnnotation(getPointerPositionOnOverlay(event))
    return
  }

  if (selectedTool.value === 'image') {
    void addImageAnnotation(getPointerPositionOnOverlay(event))
    return
  }

  if (selectedTool.value === 'pencil') {
    return
  }

  selectedAnnotationId.value = null
}

function startInlineTextEdit(annotationId: string) {
  const annotation = annotations.value.find((item) => item.id === annotationId)
  if (!annotation || annotation.type !== 'text') return

  selectedAnnotationId.value = annotationId
  editingTextId.value = annotationId
  editingTextValue.value = annotation.text ?? ''
}

function cancelInlineTextEdit() {
  editingTextId.value = null
  editingTextValue.value = ''
}

function saveInlineTextEdit() {
  if (!editingTextId.value) return
  const nextText = editingTextValue.value.trim()
  if (!nextText) {
    toast.warning('Texto requerido', 'El texto no puede quedar vacio')
    return
  }

  const targetId = editingTextId.value
  withHistory(() => {
    const annotation = annotations.value.find((item) => item.id === targetId)
    if (!annotation || annotation.type !== 'text') return
    annotation.text = nextText
  })

  cancelInlineTextEdit()
}

function getLocalDraftStorageKey() {
  if (!documentKey.value) return ''
  return `${DRAFT_STORAGE_KEY_PREFIX}:${documentKey.value}`
}

async function buildDocumentKey(file: File, bytes: Uint8Array, pages: number) {
  try {
    const encoder = new TextEncoder()
    const meta = encoder.encode(`${file.name}|${file.size}|${pages}`)
    const payload = new Uint8Array(meta.length + bytes.length)
    payload.set(meta, 0)
    payload.set(bytes, meta.length)

    const digest = await crypto.subtle.digest('SHA-256', payload)
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    return hash
  } catch {
    return `${file.name}:${file.size}:${pages}`
  }
}

function cloneAnnotations(list: AnnotationItem[]) {
  return list.map((annotation) => ({ ...annotation }))
}

function pushUndoSnapshot(snapshot: AnnotationItem[]) {
  undoStack.value.push(snapshot)
  if (undoStack.value.length > MAX_UNDO_STEPS) {
    undoStack.value.shift()
  }
}

function commitHistorySnapshot(snapshot: AnnotationItem[]) {
  pushUndoSnapshot(snapshot)
  redoStack.value = []
}

function withHistory(mutator: () => void) {
  const before = cloneAnnotations(annotations.value)
  mutator()
  commitHistorySnapshot(before)
}

function clearHistory() {
  undoStack.value = []
  redoStack.value = []
}

function undo() {
  const previous = undoStack.value.pop()
  if (!previous) return

  redoStack.value.push(cloneAnnotations(annotations.value))
  annotations.value = cloneAnnotations(previous)
  if (selectedAnnotationId.value && !annotations.value.some((item) => item.id === selectedAnnotationId.value)) {
    selectedAnnotationId.value = null
  }
}

function redo() {
  const next = redoStack.value.pop()
  if (!next) return

  pushUndoSnapshot(cloneAnnotations(annotations.value))
  annotations.value = cloneAnnotations(next)
  if (selectedAnnotationId.value && !annotations.value.some((item) => item.id === selectedAnnotationId.value)) {
    selectedAnnotationId.value = null
  }
}

function parseStoredDraft() {
  if (typeof window === 'undefined') return null

  const storageKey = getLocalDraftStorageKey()
  if (!storageKey) return null

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PdfEditorDraft>
    if (
      parsed.version !== 1
      || parsed.documentKey !== documentKey.value
      || typeof parsed.fileName !== 'string'
      || typeof parsed.totalPages !== 'number'
      || !Array.isArray(parsed.annotations)
    ) {
      return null
    }

    return parsed as PdfEditorDraft
  } catch {
    return null
  }
}

async function refreshDraftAvailability() {
  const stored = parseStoredDraft()
  const localAvailable = Boolean(
    stored
    && fileName.value
    && stored.fileName === fileName.value
    && stored.totalPages === totalPages.value,
  )

  let remoteAvailable = false
  if (documentKey.value) {
    try {
      const result = await adminToolsService.getPdfDraft(documentKey.value)
      remoteAvailable = result !== null
    } catch (error) {
      console.warn('No se pudo validar borrador remoto', error)
    }
  }

  serverDraftAvailable.value = remoteAvailable
  draftAvailable.value = localAvailable || remoteAvailable
}

function saveLocalDraftSilently() {
  if (!fileName.value || !pdfDocument.value) {
    return
  }

  if (typeof window === 'undefined') return
  const storageKey = getLocalDraftStorageKey()
  if (!storageKey) return

  const draft: PdfEditorDraft = {
    version: 1,
    documentKey: documentKey.value,
    fileName: fileName.value,
    totalPages: totalPages.value,
    annotations: cloneAnnotations(annotations.value),
  }

  window.localStorage.setItem(storageKey, JSON.stringify(draft))
}

function loadLocalDraftSilently() {
  if (!fileName.value || !pdfDocument.value) {
    return false
  }

  const stored = parseStoredDraft()
  if (!stored) {
    return false
  }

  if (stored.fileName !== fileName.value || stored.totalPages !== totalPages.value) {
    return false
  }

  withHistory(() => {
    annotations.value = cloneAnnotations(stored.annotations)
    selectedAnnotationId.value = null
  })

  return true
}

async function saveDraft() {
  if (!fileName.value || !pdfDocument.value || !documentKey.value) {
    toast.warning('Sin documento', 'Primero carga un PDF para guardar el borrador')
    return
  }

  const draftPayload = {
    version: 1,
    annotations: cloneAnnotations(annotations.value),
  }

  let remoteSaved = false
  try {
    await adminToolsService.savePdfDraft({
      documentKey: documentKey.value,
      fileName: fileName.value,
      totalPages: totalPages.value,
      draft: draftPayload,
    })
    remoteSaved = true
  } catch (error) {
    toast.warning('Servidor no disponible', extractErrorMessage(error, 'Se guardara solo en borrador local'))
  }

  saveLocalDraftSilently()
  await refreshDraftAvailability()

  toast.success(
    'Borrador guardado',
    remoteSaved
      ? 'Se guardo en servidor y local'
      : 'Se guardo solo en este navegador',
  )
}

async function loadDraft() {
  if (!fileName.value || !pdfDocument.value || !documentKey.value) {
    toast.warning('Sin documento', 'Primero carga el PDF para recuperar el borrador')
    return
  }

  try {
    const serverDraft = await adminToolsService.getPdfDraft(documentKey.value)
    if (serverDraft !== null) {
      const annotationsFromServer = Array.isArray(serverDraft.draft?.annotations)
        ? (serverDraft.draft.annotations as AnnotationItem[])
        : []

      withHistory(() => {
        annotations.value = cloneAnnotations(annotationsFromServer)
        selectedAnnotationId.value = null
      })

      saveLocalDraftSilently()
      await refreshDraftAvailability()
      toast.success('Borrador cargado', 'Se restauro el borrador guardado en servidor')
      return
    }
  } catch (error) {
    toast.warning('Sin conexion', extractErrorMessage(error, 'Intentando cargar borrador local'))
  }

  const loadedLocal = loadLocalDraftSilently()
  if (loadedLocal) {
    await refreshDraftAvailability()
    toast.success('Borrador cargado', 'Se restauro el borrador local del navegador')
    return
  }

  toast.warning('Sin borrador', 'No se encontro borrador para este documento')
}

async function clearDraft() {
  if (!documentKey.value) {
    toast.warning('Sin documento', 'Primero carga el PDF')
    return
  }

  if (typeof window !== 'undefined') {
    const storageKey = getLocalDraftStorageKey()
    if (storageKey) {
      window.localStorage.removeItem(storageKey)
    }
  }

  try {
    await adminToolsService.deletePdfDraft(documentKey.value)
  } catch (error) {
    toast.warning('Error en servidor', extractErrorMessage(error, 'No se pudo limpiar el borrador remoto'))
  }

  await refreshDraftAvailability()
  toast.success('Borrador eliminado', 'Se limpio el borrador remoto/local del documento')
}

function annotationStyle(annotation: AnnotationItem) {
  const top = annotation.y * pageHeight.value
  const left = annotation.x * pageWidth.value
  const width = Math.max(8, annotation.width * pageWidth.value)
  const height = Math.max(8, annotation.height * pageHeight.value)

  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
    border: selectedAnnotationId.value === annotation.id ? '2px solid rgb(37 99 235)' : '1px dashed rgb(148 163 184)',
  }
}

function detectMode(file: File): SourceMode | null {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  if (SUPPORTED_IMAGE_MIME.includes(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) return 'images'
  if (file.type === DOCX_MIME || /\.docx$/i.test(file.name)) return 'docx'
  if (file.type === 'text/plain' || /\.txt$/i.test(file.name) || /\.md$/i.test(file.name)) return 'text'
  return null
}

async function loadPdfFromBytes(bytes: Uint8Array, suggestedName: string) {
  const loadedPdf = await getDocument({ data: bytes.slice() }).promise
  const blobBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const pseudoFile = new File([blobBuffer], suggestedName, { type: 'application/pdf' })

  fileName.value = suggestedName
  fileBytes.value = bytes
  pdfDocument.value = loadedPdf
  documentKey.value = await buildDocumentKey(pseudoFile, bytes, loadedPdf.numPages)
  totalPages.value = loadedPdf.numPages
  currentPage.value = 1
  annotations.value = []
  selectedAnnotationId.value = null
  clearHistory()
  await nextTick()
  await renderPage(1)
  void refreshDraftAvailability()
}

async function handleIncomingFiles(files: File[]) {
  if (!files.length) return

  const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES)
  if (oversizedFiles.length) {
    toast.error('Archivo muy grande', 'El limite actual es 25 MB por archivo')
    return
  }

  const groups = new Map<SourceMode, File[]>()
  const unsupported: File[] = []
  for (const file of files) {
    const mode = detectMode(file)
    if (!mode) {
      unsupported.push(file)
      continue
    }
    const list = groups.get(mode) ?? []
    list.push(file)
    groups.set(mode, list)
  }

  if (unsupported.length) {
    toast.warning('Formato no soportado', `Se omitieron ${unsupported.length} archivo(s) no compatibles`)
  }

  if (groups.has('pdf')) {
    const pdf = groups.get('pdf')![0]
    await loadFromPdfFile(pdf)
    return
  }

  if (groups.has('images')) {
    const images = groups.get('images')!
    addImagesToQueue(images)
    showImagesModal.value = true
    return
  }

  if (groups.has('docx')) {
    const docx = groups.get('docx')![0]
    await convertDocxToPdf(docx)
    return
  }

  if (groups.has('text')) {
    const txt = groups.get('text')![0]
    await convertTextFileToPdf(txt)
  }
}

async function loadFromPdfFile(file: File) {
  try {
    isConverting.value = true
    conversionLabel.value = 'Abriendo PDF...'
    const bytes = new Uint8Array(await file.arrayBuffer())
    await loadPdfFromBytes(bytes, file.name)
    toast.success('PDF cargado', 'Puedes agregar texto, firma y mas sobre el documento')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo abrir el PDF'))
  } finally {
    isConverting.value = false
    conversionLabel.value = ''
  }
}

function addImagesToQueue(files: File[]) {
  for (const file of files) {
    if (!SUPPORTED_IMAGE_MIME.includes(file.type) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      continue
    }
    const previewUrl = URL.createObjectURL(file)
    imageQueue.value.push({ id: crypto.randomUUID(), file, previewUrl })
  }
}

function removeImageFromQueue(id: string) {
  const item = imageQueue.value.find((entry) => entry.id === id)
  if (item) URL.revokeObjectURL(item.previewUrl)
  imageQueue.value = imageQueue.value.filter((entry) => entry.id !== id)
}

function moveImageInQueue(id: string, delta: -1 | 1) {
  const index = imageQueue.value.findIndex((entry) => entry.id === id)
  if (index < 0) return
  const target = index + delta
  if (target < 0 || target >= imageQueue.value.length) return
  const next = imageQueue.value.slice()
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  imageQueue.value = next
}

function clearImageQueue() {
  for (const entry of imageQueue.value) URL.revokeObjectURL(entry.previewUrl)
  imageQueue.value = []
}

function closeImagesModal() {
  showImagesModal.value = false
  clearImageQueue()
}

async function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = url
  })
}

async function rasterizeToPng(file: File): Promise<Uint8Array> {
  const url = URL.createObjectURL(file)
  try {
    const { width, height } = await loadImageDimensions(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    const bitmap = await createImageBitmap(file)
    ctx.drawImage(bitmap, 0, 0)
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo convertir imagen'))), 'image/png')
    })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function buildPdfFromImages(items: ImageQueueItem[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()

  for (const item of items) {
    const { file } = item
    let image
    if (file.type === 'image/png') {
      const bytes = new Uint8Array(await file.arrayBuffer())
      image = await pdf.embedPng(bytes)
    } else if (file.type === 'image/jpeg') {
      const bytes = new Uint8Array(await file.arrayBuffer())
      image = await pdf.embedJpg(bytes)
    } else {
      const pngBytes = await rasterizeToPng(file)
      image = await pdf.embedPng(pngBytes)
    }

    let pageWidth: number
    let pageHeight: number
    const isLandscape = image.width > image.height

    if (imagePageSize.value === 'fit') {
      pageWidth = image.width
      pageHeight = image.height
    } else if (imagePageSize.value === 'letter') {
      pageWidth = isLandscape ? LETTER_HEIGHT_PT : LETTER_WIDTH_PT
      pageHeight = isLandscape ? LETTER_WIDTH_PT : LETTER_HEIGHT_PT
    } else {
      pageWidth = isLandscape ? A4_HEIGHT_PT : A4_WIDTH_PT
      pageHeight = isLandscape ? A4_WIDTH_PT : A4_HEIGHT_PT
    }

    const page = pdf.addPage([pageWidth, pageHeight])
    const margin = imagePageSize.value === 'fit' ? 0 : Math.max(0, imageMargin.value)
    const maxW = pageWidth - margin * 2
    const maxH = pageHeight - margin * 2
    const scale = Math.min(maxW / image.width, maxH / image.height)
    const drawW = image.width * scale
    const drawH = image.height * scale
    const x = (pageWidth - drawW) / 2
    const y = (pageHeight - drawH) / 2
    page.drawImage(image, { x, y, width: drawW, height: drawH })
  }

  const result = await pdf.save()
  return result instanceof Uint8Array ? result : new Uint8Array(result)
}

async function generatePdfFromImages() {
  if (!imageQueue.value.length) {
    toast.warning('Sin imagenes', 'Agrega al menos una imagen para crear el PDF')
    return
  }
  try {
    isConverting.value = true
    conversionLabel.value = `Generando PDF de ${imageQueue.value.length} imagen(es)...`
    const bytes = await buildPdfFromImages(imageQueue.value)
    const baseName = imageQueue.value[0].file.name.replace(/\.[^.]+$/, '') || 'imagenes'
    await loadPdfFromBytes(bytes, `${baseName}-imagenes.pdf`)
    toast.success('PDF creado', `Se generaron ${imageQueue.value.length} pagina(s)`)
    closeImagesModal()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo generar el PDF de imagenes'))
  } finally {
    isConverting.value = false
    conversionLabel.value = ''
  }
}

function buildTextLines(text: string, font: import('pdf-lib').PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      const width = font.widthOfTextAtSize(candidate, fontSize)
      if (width <= maxWidth) {
        current = candidate
        continue
      }
      if (current) lines.push(current)
      const wordWidth = font.widthOfTextAtSize(word, fontSize)
      if (wordWidth > maxWidth) {
        let chunk = ''
        for (const char of word) {
          const next = chunk + char
          if (font.widthOfTextAtSize(next, fontSize) > maxWidth) {
            lines.push(chunk)
            chunk = char
          } else {
            chunk = next
          }
        }
        current = chunk
      } else {
        current = word
      }
    }
    if (current) lines.push(current)
  }

  return lines
}

async function buildPdfFromText(text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontSize = 11
  const lineHeight = 16
  const margin = 56
  const maxWidth = A4_WIDTH_PT - margin * 2
  const usableHeight = A4_HEIGHT_PT - margin * 2
  const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight))

  const lines = buildTextLines(text, font, fontSize, maxWidth)
  if (!lines.length) lines.push('')

  for (let cursor = 0; cursor < lines.length; cursor += linesPerPage) {
    const page = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
    let y = A4_HEIGHT_PT - margin
    const slice = lines.slice(cursor, cursor + linesPerPage)
    for (const line of slice) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.07, 0.09, 0.15),
      })
      y -= lineHeight
    }
  }

  const result = await pdf.save()
  return result instanceof Uint8Array ? result : new Uint8Array(result)
}

async function convertTextFileToPdf(file: File) {
  try {
    isConverting.value = true
    conversionLabel.value = `Convirtiendo ${file.name}...`
    const text = await file.text()
    const bytes = await buildPdfFromText(text)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'texto'
    await loadPdfFromBytes(bytes, `${baseName}.pdf`)
    toast.success('PDF creado', 'Se convirtio el archivo de texto')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo convertir el texto'))
  } finally {
    isConverting.value = false
    conversionLabel.value = ''
  }
}

async function generatePdfFromTextComposer() {
  const text = textComposerValue.value
  if (!text.trim()) {
    toast.warning('Sin contenido', 'Escribe o pega texto antes de generar')
    return
  }
  try {
    isConverting.value = true
    conversionLabel.value = 'Generando PDF de texto...'
    const bytes = await buildPdfFromText(text)
    const safeName = textComposerName.value.trim().replace(/\.[^.]+$/, '') || 'texto'
    await loadPdfFromBytes(bytes, `${safeName}.pdf`)
    toast.success('PDF creado', 'Se genero el PDF a partir del texto')
    showTextModal.value = false
    textComposerValue.value = ''
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo generar el PDF'))
  } finally {
    isConverting.value = false
    conversionLabel.value = ''
  }
}

async function convertDocxToPdf(file: File) {
  try {
    isConverting.value = true
    conversionLabel.value = `Convirtiendo ${file.name}...`
    const mammoth = await import('mammoth/mammoth.browser')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value || ''
    if (!text.trim()) {
      toast.warning('Documento vacio', 'No se pudo extraer texto del DOCX')
      return
    }
    const bytes = await buildPdfFromText(text)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'documento'
    await loadPdfFromBytes(bytes, `${baseName}.pdf`)
    toast.success('PDF creado', 'Se convirtio el documento DOCX (texto plano)')
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo convertir el DOCX'))
  } finally {
    isConverting.value = false
    conversionLabel.value = ''
  }
}

function onWindowDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
    dragLeaveTimer = null
  }
  isDraggingFile.value = true
}

function onWindowDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
}

function onWindowDragLeave(event: DragEvent) {
  if (event.relatedTarget) return
  if (dragLeaveTimer) clearTimeout(dragLeaveTimer)
  dragLeaveTimer = setTimeout(() => {
    isDraggingFile.value = false
  }, 80)
}

async function onWindowDrop(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  if (dragLeaveTimer) clearTimeout(dragLeaveTimer)
  isDraggingFile.value = false
  const files = Array.from(event.dataTransfer.files)
  await handleIncomingFiles(files)
}

function openFilePicker(accept: string, multiple = false) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.onchange = async () => {
    const files = Array.from(input.files ?? [])
    if (files.length) await handleIncomingFiles(files)
  }
  input.click()
}

function openPdfPicker() {
  openFilePicker('application/pdf,.pdf')
}

function openImagesPicker() {
  openFilePicker('image/png,image/jpeg,image/webp,image/gif', true)
}

function openDocxPicker() {
  openFilePicker('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

function openTextComposer() {
  textComposerValue.value = ''
  textComposerName.value = 'documento.pdf'
  showTextModal.value = true
}

async function renderPage(pageNumber: number) {
  if (!pdfDocument.value || !pageCanvas.value) return

  loadingPage.value = true
  try {
    const page = await pdfDocument.value.getPage(pageNumber)
    const viewport = page.getViewport({ scale: renderScale.value })
    const canvas = pageCanvas.value
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    pageWidth.value = canvas.width
    pageHeight.value = canvas.height

    await page.render({
      canvasContext: context,
      viewport,
    }).promise
  } finally {
    loadingPage.value = false
  }
}

async function changePage(nextPage: number) {
  if (!pdfDocument.value) return
  if (nextPage < 1 || nextPage > totalPages.value) return

  cancelInlineTextEdit()
  currentPage.value = nextPage
  selectedAnnotationId.value = null
  await renderPage(nextPage)
}

async function jumpToPage(event: Event) {
  const target = event.target as HTMLInputElement
  const nextPage = Number(target.value)
  if (!Number.isFinite(nextPage)) {
    target.value = String(currentPage.value)
    return
  }

  await changePage(Math.round(nextPage))
  target.value = String(currentPage.value)
}

async function updateZoom(nextScale: number) {
  if (!pdfDocument.value) return
  const clamped = Math.min(2.5, Math.max(0.7, nextScale))
  if (Math.abs(clamped - renderScale.value) < 0.001) return

  renderScale.value = clamped
  await renderPage(currentPage.value)
}

function installCypressTestApi() {
  if (typeof window === 'undefined') return

  const maybeWindow = window as Window & { __pdfEditorTestApi?: PdfEditorTestApi; Cypress?: unknown }
  if (!maybeWindow.Cypress) return

  maybeWindow.__pdfEditorTestApi = {
    bootstrapMockDocument(payload) {
      fileName.value = payload?.fileName ?? 'editor-e2e.pdf'
      documentKey.value = payload?.documentKey ?? 'pdf-editor-e2e-key'
      totalPages.value = Math.max(1, payload?.totalPages ?? 1)
      currentPage.value = 1
      fileBytes.value = new Uint8Array([1, 2, 3])
      pdfDocument.value = {
        numPages: totalPages.value,
      } as unknown as PDFDocumentProxy
      pageWidth.value = 800
      pageHeight.value = 1100
      annotations.value = []
      selectedAnnotationId.value = null
      clearHistory()
      void refreshDraftAvailability()
    },
  }

  installedTestApiWindow = maybeWindow
}

function fontFamilyCss(family: FontFamily | undefined): string {
  if (family === 'serif') return '"Times New Roman", Times, serif'
  if (family === 'mono') return '"Courier New", Courier, monospace'
  return 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'
}

function resolveStandardFont(family: FontFamily | undefined, bold: boolean | undefined, italic: boolean | undefined): StandardFonts {
  if (family === 'serif') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (family === 'mono') {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold) return StandardFonts.HelveticaBold
  if (italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

function addTextAnnotation(position?: { x: number; y: number }) {
  if (!pdfDocument.value) {
    toast.warning('Sin documento', 'Primero carga un archivo PDF')
    return
  }

  const content = textDraft.value.trim()
  if (!content) {
    toast.warning('Texto requerido', 'Escribe un texto para insertar')
    return
  }

  const annotation: AnnotationItem = {
    id: crypto.randomUUID(),
    page: currentPage.value,
    type: 'text',
    x: position?.x ?? 0.08,
    y: position?.y ?? 0.08,
    width: 0.32,
    height: 0.07,
    text: content,
    fontSize: clamp01(textSizeDraft.value),
    color: textColorDraft.value,
    fontFamily: fontFamilyDraft.value,
    bold: fontBoldDraft.value,
    italic: fontItalicDraft.value,
  }

  withHistory(() => {
    annotations.value.push(annotation)
    selectedAnnotationId.value = annotation.id
    selectedTool.value = 'select'
  })
}

async function pickImageForAnnotation(): Promise<{ dataUrl: string; ratio: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/gif'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      try {
        const dataUrl = await new Promise<string>((ok, fail) => {
          const reader = new FileReader()
          reader.onload = () => ok(String(reader.result))
          reader.onerror = () => fail(new Error('No se pudo leer la imagen'))
          reader.readAsDataURL(file)
        })
        const dims = await new Promise<{ width: number; height: number }>((ok, fail) => {
          const img = new Image()
          img.onload = () => ok({ width: img.naturalWidth, height: img.naturalHeight })
          img.onerror = () => fail(new Error('No se pudo leer la imagen'))
          img.src = dataUrl
        })
        const ratio = dims.height === 0 ? 1 : dims.width / dims.height
        resolve({ dataUrl, ratio })
      } catch (error) {
        toast.error('Error', extractErrorMessage(error, 'No se pudo leer la imagen'))
        resolve(null)
      }
    }
    input.click()
  })
}

async function addImageAnnotation(position?: { x: number; y: number }) {
  if (!pdfDocument.value) {
    toast.warning('Sin documento', 'Primero carga un archivo PDF')
    return
  }

  const picked = await pickImageForAnnotation()
  if (!picked) return

  const targetWidth = 0.3
  const ratio = picked.ratio || 1
  const pageRatio = pageWidth.value && pageHeight.value ? pageWidth.value / pageHeight.value : 0.75
  const targetHeight = Math.min(0.6, (targetWidth / ratio) * pageRatio)

  const annotation: AnnotationItem = {
    id: crypto.randomUUID(),
    page: currentPage.value,
    type: 'image',
    x: position?.x ?? 0.1,
    y: position?.y ?? 0.1,
    width: targetWidth,
    height: targetHeight,
    imageDataUrl: picked.dataUrl,
  }

  withHistory(() => {
    annotations.value.push(annotation)
    selectedAnnotationId.value = annotation.id
    selectedTool.value = 'select'
  })
}

function addHighlightAnnotation(position: { x: number; y: number }) {
  if (!pdfDocument.value) {
    toast.warning('Sin documento', 'Primero carga un archivo PDF')
    return
  }

  const annotation: AnnotationItem = {
    id: crypto.randomUUID(),
    page: currentPage.value,
    type: 'highlight',
    x: position.x,
    y: position.y,
    width: 0.28,
    height: 0.06,
    color: highlightColorDraft.value,
  }

  withHistory(() => {
    annotations.value.push(annotation)
    selectedAnnotationId.value = annotation.id
    selectedTool.value = 'select'
  })
}

function addStampAnnotation(position: { x: number; y: number }) {
  if (!pdfDocument.value) {
    toast.warning('Sin documento', 'Primero carga un archivo PDF')
    return
  }

  const text = stampTextDraft.value.trim() || 'APROBADO'
  const annotation: AnnotationItem = {
    id: crypto.randomUUID(),
    page: currentPage.value,
    type: 'stamp',
    x: position.x,
    y: position.y,
    width: 0.28,
    height: 0.08,
    text,
    color: stampColorDraft.value,
    fontSize: 0.04,
  }

  withHistory(() => {
    annotations.value.push(annotation)
    selectedAnnotationId.value = annotation.id
    selectedTool.value = 'select'
  })
}

function startReplaceSignature(annotationId: string) {
  const annotation = annotations.value.find((item) => item.id === annotationId)
  if (!annotation || annotation.type !== 'signature') return

  replacingSignatureId.value = annotationId
  pendingInsertPosition.value = { x: annotation.x, y: annotation.y }
  openSignaturePad()
}

function openSignaturePad() {
  if (!pdfDocument.value) {
    toast.warning('Sin documento', 'Primero carga un archivo PDF')
    return
  }

  showSignaturePad.value = true
  nextTick(() => {
    if (!signatureCanvas.value) return
    signaturePad = new SignaturePad(signatureCanvas.value, {
      minWidth: 1,
      maxWidth: 2.5,
      penColor: 'rgb(17, 24, 39)',
      backgroundColor: 'rgb(255,255,255)',
    })
    signaturePad.clear()
  })
}

function clearSignaturePad() {
  signaturePad?.clear()
}

function closeSignaturePad() {
  showSignaturePad.value = false
  pendingInsertPosition.value = null
  replacingSignatureId.value = null
  signaturePad = null
}

function saveSignature() {
  if (!signaturePad || signaturePad.isEmpty()) {
    toast.warning('Firma vacia', 'Dibuja una firma antes de guardar')
    return
  }

  const imageDataUrl = signaturePad.toDataURL('image/png')
  const presetSize = signaturePreset.value === 'ancha'
    ? { width: 0.42, height: 0.1 }
    : { width: 0.3, height: 0.12 }
  if (replacingSignatureId.value) {
    const replaceId = replacingSignatureId.value
    withHistory(() => {
      const annotation = annotations.value.find((item) => item.id === replaceId)
      if (!annotation || annotation.type !== 'signature') return
      annotation.imageDataUrl = imageDataUrl
      annotation.width = presetSize.width
      annotation.height = presetSize.height
      selectedAnnotationId.value = annotation.id
      selectedTool.value = 'select'
    })
  } else {
    const annotation: AnnotationItem = {
      id: crypto.randomUUID(),
      page: currentPage.value,
      type: 'signature',
      x: pendingInsertPosition.value?.x ?? 0.1,
      y: pendingInsertPosition.value?.y ?? 0.2,
      width: presetSize.width,
      height: presetSize.height,
      imageDataUrl,
    }

    withHistory(() => {
      annotations.value.push(annotation)
      selectedAnnotationId.value = annotation.id
      selectedTool.value = 'select'
    })
  }

  closeSignaturePad()
}

function removeSelectedAnnotation() {
  if (!selectedAnnotationId.value) return

  withHistory(() => {
    annotations.value = annotations.value.filter((annotation) => annotation.id !== selectedAnnotationId.value)
    selectedAnnotationId.value = null
  })
}

function duplicateSelectedAnnotation() {
  if (!selectedAnnotation.value) return

  const source = selectedAnnotation.value
  const duplicate: AnnotationItem = {
    ...source,
    id: crypto.randomUUID(),
    x: clamp01(source.x + 0.02),
    y: clamp01(source.y + 0.02),
  }

  withHistory(() => {
    annotations.value.push(duplicate)
    selectedAnnotationId.value = duplicate.id
  })
}

function nudgeSelectedAnnotation(deltaX: number, deltaY: number) {
  if (!selectedAnnotation.value) return

  withHistory(() => {
    if (!selectedAnnotation.value) return
    selectedAnnotation.value.x = clamp01(selectedAnnotation.value.x + deltaX)
    selectedAnnotation.value.y = clamp01(selectedAnnotation.value.y + deltaY)
  })
}

function selectAnnotation(annotationId: string) {
  selectedAnnotationId.value = annotationId
  selectedTool.value = 'select'
}

function startDrag(annotation: AnnotationItem, event: PointerEvent) {
  if (selectedTool.value === 'pencil') return
  if (!overlayRef.value) return

  activeDrag = {
    id: annotation.id,
    startX: event.clientX,
    startY: event.clientY,
    baseX: annotation.x,
    baseY: annotation.y,
    snapshot: cloneAnnotations(annotations.value),
  }

  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function startResize(annotation: AnnotationItem, handle: 'nw' | 'ne' | 'sw' | 'se', event: PointerEvent) {
  if (!overlayRef.value) return

  activeResize = {
    id: annotation.id,
    handle,
    startX: event.clientX,
    startY: event.clientY,
    baseX: annotation.x,
    baseY: annotation.y,
    baseWidth: annotation.width,
    baseHeight: annotation.height,
    snapshot: cloneAnnotations(annotations.value),
  }

  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onDrag(event: PointerEvent) {
  if (activeDraw.value && selectedTool.value === 'pencil') {
    activeDraw.value.points.push(getPointerPositionOnOverlay(event))
    return
  }

  if (activeResize && !activeDrag) {
    const annotation = annotations.value.find((item) => item.id === activeResize?.id)
    if (!annotation) return

    const dx = (event.clientX - activeResize.startX) / Math.max(1, pageWidth.value)
    const dy = (event.clientY - activeResize.startY) / Math.max(1, pageHeight.value)
    const minSize = minAnnotationSize()

    let nextX = activeResize.baseX
    let nextY = activeResize.baseY
    let nextWidth = activeResize.baseWidth
    let nextHeight = activeResize.baseHeight

    if (activeResize.handle === 'se' || activeResize.handle === 'ne') {
      nextWidth = activeResize.baseWidth + dx
    }
    if (activeResize.handle === 'sw' || activeResize.handle === 'nw') {
      nextX = activeResize.baseX + dx
      nextWidth = activeResize.baseWidth - dx
    }
    if (activeResize.handle === 'se' || activeResize.handle === 'sw') {
      nextHeight = activeResize.baseHeight + dy
    }
    if (activeResize.handle === 'ne' || activeResize.handle === 'nw') {
      nextY = activeResize.baseY + dy
      nextHeight = activeResize.baseHeight - dy
    }

    nextWidth = Math.max(minSize.width, nextWidth)
    nextHeight = Math.max(minSize.height, nextHeight)
    nextX = clamp01(Math.min(nextX, 1 - nextWidth))
    nextY = clamp01(Math.min(nextY, 1 - nextHeight))

    annotation.x = nextX
    annotation.y = nextY
    annotation.width = clamp01(nextWidth)
    annotation.height = clamp01(nextHeight)
    return
  }

  if (!activeDrag || !overlayRef.value) return

  const annotation = annotations.value.find((item) => item.id === activeDrag?.id)
  if (!annotation) return

  const dx = event.clientX - activeDrag.startX
  const dy = event.clientY - activeDrag.startY

  const nextX = activeDrag.baseX + dx / Math.max(1, pageWidth.value)
  const nextY = activeDrag.baseY + dy / Math.max(1, pageHeight.value)
  const snappedX = snapWithGuide(clamp01(nextX))
  const snappedY = snapWithGuide(clamp01(nextY))

  annotation.x = snappedX.value
  annotation.y = snappedY.value
  snapGuideX.value = snappedX.guide
  snapGuideY.value = snappedY.guide
}

function endDrag() {
  if (activeDraw.value && activeDraw.value.points.length > 1) {
    const points = activeDraw.value.points
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const drawing: AnnotationItem = {
      id: crypto.randomUUID(),
      page: currentPage.value,
      type: 'drawing',
      x: minX,
      y: minY,
      width: Math.max(0.01, maxX - minX),
      height: Math.max(0.01, maxY - minY),
      color: pencilColorDraft.value,
      strokeWidth: pencilWidthDraft.value,
      points,
    }

    withHistory(() => {
      annotations.value.push(drawing)
      selectedAnnotationId.value = drawing.id
      selectedTool.value = 'select'
    })
  }

  if (activeResize) {
    const resized = annotations.value.find((item) => item.id === activeResize?.id)
    if (
      resized
      && (
        resized.x !== activeResize.baseX
        || resized.y !== activeResize.baseY
        || resized.width !== activeResize.baseWidth
        || resized.height !== activeResize.baseHeight
      )
    ) {
      commitHistorySnapshot(activeResize.snapshot)
    }
  }

  activeDraw.value = null
  activeResize = null

  if (!activeDrag) return

  const moved = annotations.value.find((item) => item.id === activeDrag?.id)
  if (moved && (moved.x !== activeDrag.baseX || moved.y !== activeDrag.baseY)) {
    commitHistorySnapshot(activeDrag.snapshot)
  }

  snapGuideX.value = null
  snapGuideY.value = null
  activeDrag = null
}

function updateSelectedSize(field: 'width' | 'height', value: number) {
  if (!selectedAnnotation.value) return
  withHistory(() => {
    if (!selectedAnnotation.value) return
    selectedAnnotation.value[field] = clamp01(value)
  })
}

function updateSelectedTextSize(value: number) {
  if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
  withHistory(() => {
    if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
    selectedAnnotation.value.fontSize = clamp01(value)
  })
}

function updateSelectedFontFamily(value: FontFamily) {
  if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
  withHistory(() => {
    if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
    selectedAnnotation.value.fontFamily = value
  })
}

function toggleSelectedBold() {
  if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
  withHistory(() => {
    if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
    selectedAnnotation.value.bold = !selectedAnnotation.value.bold
  })
}

function toggleSelectedItalic() {
  if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
  withHistory(() => {
    if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'text') return
    selectedAnnotation.value.italic = !selectedAnnotation.value.italic
  })
}

function updateSelectedTextColor(value: string) {
  if (!selectedAnnotation.value) return
  if (!['text', 'highlight', 'stamp', 'drawing'].includes(selectedAnnotation.value.type)) return
  withHistory(() => {
    if (!selectedAnnotation.value) return
    if (!['text', 'highlight', 'stamp', 'drawing'].includes(selectedAnnotation.value.type)) return
    selectedAnnotation.value.color = value
  })
}

function updateSelectedStrokeWidth(value: number) {
  if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'drawing') return
  withHistory(() => {
    if (!selectedAnnotation.value || selectedAnnotation.value.type !== 'drawing') return
    selectedAnnotation.value.strokeWidth = Math.max(0.001, Math.min(0.03, value))
  })
}

function annotationTypeLabel(annotation: AnnotationItem): string {
  if (annotation.type === 'text') return 'Texto'
  if (annotation.type === 'signature') return 'Firma'
  if (annotation.type === 'image') return 'Imagen'
  if (annotation.type === 'highlight') return 'Resaltado'
  if (annotation.type === 'stamp') return 'Sello'
  return 'Dibujo'
}

function annotationTextStyle(annotation: AnnotationItem) {
  const fontSize = (annotation.fontSize ?? 0.03) * pageHeight.value
  return {
    fontSize: `${Math.max(10, fontSize)}px`,
    color: annotation.color ?? '#111827',
    lineHeight: '1.2',
    fontFamily: fontFamilyCss(annotation.fontFamily ?? 'sans'),
    fontWeight: annotation.bold ? '700' : '400',
    fontStyle: annotation.italic ? 'italic' : 'normal',
  }
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) return rgb(0, 0, 0)

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255

  return rgb(Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0)
}

async function exportPdf() {
  if (!fileBytes.value || !pdfDocument.value) {
    toast.warning('Sin documento', 'Carga un PDF antes de exportar')
    return
  }

  exporting.value = true
  try {
    const pdf = await PDFDocument.load(fileBytes.value)
    const fontCache = new Map<StandardFonts, import('pdf-lib').PDFFont>()
    const ensureFont = async (id: StandardFonts) => {
      const existing = fontCache.get(id)
      if (existing) return existing
      const font = await pdf.embedFont(id)
      fontCache.set(id, font)
      return font
    }

    for (const annotation of annotations.value) {
      const page = pdf.getPage(annotation.page - 1)
      const pageWidthPoints = page.getWidth()
      const pageHeightPoints = page.getHeight()

      if (annotation.type === 'text' && annotation.text) {
        const fontSize = Math.max(8, (annotation.fontSize ?? 0.03) * pageHeightPoints)
        const x = annotation.x * pageWidthPoints
        const yTop = annotation.y * pageHeightPoints
        const y = pageHeightPoints - yTop - fontSize
        const font = await ensureFont(resolveStandardFont(annotation.fontFamily, annotation.bold, annotation.italic))

        page.drawText(annotation.text, {
          x,
          y,
          size: fontSize,
          color: hexToRgb(annotation.color ?? '#111827'),
          font,
        })
      }

      if ((annotation.type === 'signature' || annotation.type === 'image') && annotation.imageDataUrl) {
        const dataUrl = annotation.imageDataUrl
        const isJpeg = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')
        const embedded = isJpeg
          ? await pdf.embedJpg(dataUrl)
          : await pdf.embedPng(dataUrl)
        const x = annotation.x * pageWidthPoints
        const yTop = annotation.y * pageHeightPoints
        const width = Math.max(24, annotation.width * pageWidthPoints)
        const height = Math.max(18, annotation.height * pageHeightPoints)
        const y = pageHeightPoints - yTop - height

        page.drawImage(embedded, {
          x,
          y,
          width,
          height,
        })
      }

      if (annotation.type === 'highlight') {
        const x = annotation.x * pageWidthPoints
        const yTop = annotation.y * pageHeightPoints
        const width = Math.max(24, annotation.width * pageWidthPoints)
        const height = Math.max(18, annotation.height * pageHeightPoints)
        const y = pageHeightPoints - yTop - height

        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: hexToRgb(annotation.color ?? '#facc15'),
          opacity: 0.35,
          borderWidth: 0,
        })
      }

      if (annotation.type === 'stamp' && annotation.text) {
        const fontSize = Math.max(10, (annotation.fontSize ?? 0.04) * pageHeightPoints)
        const x = annotation.x * pageWidthPoints
        const yTop = annotation.y * pageHeightPoints
        const y = pageHeightPoints - yTop - fontSize

        page.drawText(annotation.text.toUpperCase(), {
          x,
          y,
          size: fontSize,
          color: hexToRgb(annotation.color ?? '#b91c1c'),
        })
      }

      if (annotation.type === 'drawing' && annotation.points && annotation.points.length > 1) {
        const strokeWidth = Math.max(0.5, (annotation.strokeWidth ?? 0.005) * pageHeightPoints)

        for (let index = 1; index < annotation.points.length; index += 1) {
          const from = annotation.points[index - 1]
          const to = annotation.points[index]

          page.drawLine({
            start: {
              x: from.x * pageWidthPoints,
              y: pageHeightPoints - from.y * pageHeightPoints,
            },
            end: {
              x: to.x * pageWidthPoints,
              y: pageHeightPoints - to.y * pageHeightPoints,
            },
            thickness: strokeWidth,
            color: hexToRgb(annotation.color ?? '#111827'),
          })
        }
      }
    }

    const exportedBytes = await pdf.save()
    const outputBytes = exportedBytes instanceof Uint8Array ? exportedBytes : new Uint8Array(exportedBytes)
    const outputBuffer = outputBytes.buffer.slice(
      outputBytes.byteOffset,
      outputBytes.byteOffset + outputBytes.byteLength,
    ) as ArrayBuffer
    const blob = new Blob([outputBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = fileName.value.replace(/\.pdf$/i, '')

    link.href = url
    link.download = `${safeName || 'documento'}-editado.pdf`
    link.click()

    URL.revokeObjectURL(url)
    toast.success('PDF exportado', 'Se descargo el documento editado')
  } catch {
    toast.error('Error', 'No se pudo exportar el PDF')
  } finally {
    exporting.value = false
  }
}

watch(currentPage, async (page) => {
  if (!pdfDocument.value) return
  await renderPage(page)
})

watch(textPreset, (preset) => {
  if (preset === 'titulo') {
    textSizeDraft.value = 0.055
    textColorDraft.value = '#111827'
    return
  }

  if (preset === 'caption') {
    textSizeDraft.value = 0.02
    textColorDraft.value = '#374151'
    return
  }

  textSizeDraft.value = 0.03
  textColorDraft.value = '#111827'
})

onMounted(() => {
  refreshDraftAvailability()
  installCypressTestApi()

  onScrollHandler = () => {
    isRibbonCompact.value = window.scrollY > 80
  }
  onScrollHandler()
  window.addEventListener('scroll', onScrollHandler, { passive: true })

  onKeyDownHandler = (event: KeyboardEvent) => {
    const activeElement = document.activeElement
    if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
      return
    }

    if (selectedAnnotation.value) {
      const step = event.shiftKey ? 0.02 : 0.005
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        nudgeSelectedAnnotation(-step, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        nudgeSelectedAnnotation(step, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        nudgeSelectedAnnotation(0, -step)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        nudgeSelectedAnnotation(0, step)
        return
      }
    }

    if (!(event.metaKey || event.ctrlKey)) return

    const key = event.key.toLowerCase()
    if (key === 'z' && event.shiftKey) {
      event.preventDefault()
      redo()
      return
    }

    if (key === 'z') {
      event.preventDefault()
      undo()
    }
  }

  window.addEventListener('keydown', onKeyDownHandler)
  window.addEventListener('dragenter', onWindowDragEnter)
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('dragleave', onWindowDragLeave)
  window.addEventListener('drop', onWindowDrop)
})

onBeforeUnmount(() => {
  cancelInlineTextEdit()
  if (installedTestApiWindow?.__pdfEditorTestApi) {
    delete installedTestApiWindow.__pdfEditorTestApi
  }
  installedTestApiWindow = null

  if (onKeyDownHandler) {
    window.removeEventListener('keydown', onKeyDownHandler)
    onKeyDownHandler = null
  }

  if (onScrollHandler) {
    window.removeEventListener('scroll', onScrollHandler)
    onScrollHandler = null
  }
  signaturePad = null
  replacingSignatureId.value = null
  pendingInsertPosition.value = null

  window.removeEventListener('dragenter', onWindowDragEnter)
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('dragleave', onWindowDragLeave)
  window.removeEventListener('drop', onWindowDrop)
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
    dragLeaveTimer = null
  }
  clearImageQueue()
})
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-heading-2">Editor PDF</h1>
      <p class="text-sm text-surface-600">
        Carga un PDF, agrega texto y firma visual, mueve elementos y exporta el resultado final.
      </p>
    </header>

    <UiCard title="Barra de herramientas" :class="['sticky z-30 transition-all duration-200', isRibbonCompact ? 'top-2' : 'top-4']">
      <div class="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm">
        <div
          class="flex gap-2 overflow-x-auto border-b border-surface-200 bg-surface-50 transition-all"
          :class="isRibbonCompact ? 'p-1.5' : 'p-2.5'"
        >
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'text' ? 'border-red-300 bg-red-50 text-red-700' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'text'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M10 6v12m4-12v12" /></svg>
            <span v-show="!isRibbonCompact">Editar texto</span>
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'select' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'select'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3l14 8-6 2-2 6-6-16z" /></svg>
            <span v-show="!isRibbonCompact">Seleccionar</span>
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'signature' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'signature'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18c3-4 6-6 9-6 3 0 4 2 7 2M4 21h16" /></svg>
            <span v-show="!isRibbonCompact">Firma</span>
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'highlight' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'highlight'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14v5H5z" /></svg>
            <span v-show="!isRibbonCompact">Resaltar</span>
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'stamp' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'stamp'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 10h8M8 14h5" /></svg>
            <span v-show="!isRibbonCompact">Sello</span>
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'pencil' ? 'border-slate-300 bg-slate-100 text-slate-800' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'pencil'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l6-6M14 4l6 6-10 10H4v-6z" /></svg>
            <span v-show="!isRibbonCompact">Lapiz</span>
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="selectedTool === 'image' ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-surface-300 bg-white text-surface-700 hover:border-surface-400'"
            @click="selectedTool = 'image'"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.2" /><path d="M21 16l-5-5-4 4-2-2-4 3" /></svg>
            <span v-show="!isRibbonCompact">Imagen</span>
          </button>
        </div>

        <div
          v-show="!isRibbonCompact"
          class="grid gap-3 border-b border-surface-200 bg-white p-3 lg:grid-cols-[minmax(230px,1.1fr)_minmax(280px,1fr)_minmax(220px,0.9fr)_minmax(260px,1.1fr)]"
        >
          <div class="space-y-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-500">Cargar / crear</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-md border border-surface-300 bg-white px-2 py-1.5 text-xs font-medium text-surface-700 hover:border-blue-400 hover:text-blue-700"
                @click="openPdfPicker"
              >
                <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /></svg>
                PDF
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-md border border-surface-300 bg-white px-2 py-1.5 text-xs font-medium text-surface-700 hover:border-emerald-400 hover:text-emerald-700"
                @click="openImagesPicker"
              >
                <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.4" /><path d="M21 16l-5-5-4 4-2-2-4 3" /></svg>
                Imagenes
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-md border border-surface-300 bg-white px-2 py-1.5 text-xs font-medium text-surface-700 hover:border-indigo-400 hover:text-indigo-700"
                @click="openDocxPicker"
              >
                <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></svg>
                DOCX
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-md border border-surface-300 bg-white px-2 py-1.5 text-xs font-medium text-surface-700 hover:border-rose-400 hover:text-rose-700"
                @click="openTextComposer"
              >
                <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                Texto
              </button>
            </div>
            <p class="truncate text-xs text-surface-600" :title="fileName">{{ fileName || 'Arrastra un archivo o usa los botones' }}</p>
          </div>

          <div class="space-y-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <UiInput v-model="textDraft" label="Texto" placeholder="Escribe un texto" />
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-medium text-surface-700">Fuente</label>
                <select v-model="fontFamilyDraft" class="mt-1 w-full rounded border border-surface-300 bg-white px-2 py-1 text-xs text-surface-700">
                  <option value="sans">Sans (Helvetica)</option>
                  <option value="serif">Serif (Times)</option>
                  <option value="mono">Mono (Courier)</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-surface-700">Preset</label>
                <select v-model="textPreset" class="mt-1 w-full rounded border border-surface-300 bg-white px-2 py-1 text-xs text-surface-700">
                  <option value="normal">Normal</option>
                  <option value="titulo">Titulo</option>
                  <option value="caption">Caption</option>
                </select>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs font-bold"
                :class="fontBoldDraft ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-surface-300 bg-white text-surface-700'"
                @click="fontBoldDraft = !fontBoldDraft"
              >B</button>
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs italic"
                :class="fontItalicDraft ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-surface-300 bg-white text-surface-700'"
                @click="fontItalicDraft = !fontItalicDraft"
              >I</button>
              <span class="ml-auto text-xs text-surface-500">{{ Math.round(textSizeDraft * 1000) / 10 }}%</span>
              <input v-model="textColorDraft" type="color" class="h-8 w-10 rounded border border-surface-300" />
            </div>
            <input v-model.number="textSizeDraft" type="range" min="0.015" max="0.08" step="0.001" class="w-full" />
          </div>

          <div class="space-y-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <div class="grid grid-cols-[1fr_auto] items-center gap-2">
              <label class="text-xs font-medium text-surface-700">Formato firma</label>
              <select v-model="signaturePreset" class="rounded border border-surface-300 bg-white px-2 py-1 text-xs text-surface-700">
                <option value="compacta">Compacta</option>
                <option value="ancha">Ancha</option>
              </select>
            </div>
            <p class="text-xs text-surface-600">Se aplica cuando agregas una nueva firma.</p>
          </div>

          <div class="grid gap-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <div class="flex flex-wrap gap-2">
              <UiButton size="sm" variant="ghost" :disabled="undoStack.length === 0" @click="undo">Deshacer</UiButton>
              <UiButton size="sm" variant="ghost" :disabled="redoStack.length === 0" @click="redo">Rehacer</UiButton>
              <UiButton size="sm" variant="secondary" :disabled="!canSaveOrExport" @click="saveDraft">Guardar borrador</UiButton>
              <UiButton size="sm" variant="secondary" :disabled="!draftAvailable" @click="loadDraft">Cargar borrador</UiButton>
              <UiButton size="sm" variant="ghost" :disabled="!draftAvailable" @click="clearDraft">Limpiar borrador</UiButton>
              <UiButton size="sm" variant="primary" :disabled="!canSaveOrExport" :loading="exporting" @click="exportPdf">Exportar PDF</UiButton>
            </div>
            <div class="rounded-md border border-surface-200 bg-white px-2 py-1.5 text-xs text-surface-600">
              Estado: {{ draftStatusLabel }} · Herramienta: {{ selectedToolLabel }}
            </div>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center gap-3 border-b border-surface-200 bg-surface-50 px-3 py-2 text-xs text-surface-700"
          :class="isRibbonCompact ? 'hidden' : ''"
        >
          <span class="font-semibold">Opciones de herramienta:</span>
          <template v-if="selectedTool === 'text'">
            <span>Modo texto activo: haz clic sobre el PDF para insertar.</span>
            <select v-model="textPreset" class="rounded border border-surface-300 bg-white px-2 py-1 text-xs text-surface-700">
              <option value="normal">Normal</option>
              <option value="titulo">Titulo</option>
              <option value="caption">Caption</option>
            </select>
          </template>
          <template v-else-if="selectedTool === 'signature'">
            <span>Modo firma activo: haz clic en el PDF para elegir posicion.</span>
            <select v-model="signaturePreset" class="rounded border border-surface-300 bg-white px-2 py-1 text-xs text-surface-700">
              <option value="compacta">Compacta</option>
              <option value="ancha">Ancha</option>
            </select>
          </template>
          <template v-else-if="selectedTool === 'highlight'">
            <span>Modo resaltar activo: haz clic para crear un bloque resaltado.</span>
            <input v-model="highlightColorDraft" type="color" class="h-8 w-12 rounded border border-surface-300" />
          </template>
          <template v-else-if="selectedTool === 'stamp'">
            <span>Modo sello activo: haz clic para insertar sello.</span>
            <input v-model="stampTextDraft" type="text" class="rounded border border-surface-300 bg-white px-2 py-1 text-xs" placeholder="Texto sello" />
            <input v-model="stampColorDraft" type="color" class="h-8 w-12 rounded border border-surface-300" />
          </template>
          <template v-else-if="selectedTool === 'pencil'">
            <span>Modo lapiz activo: manten clic y dibuja sobre el PDF.</span>
            <input v-model="pencilColorDraft" type="color" class="h-8 w-12 rounded border border-surface-300" />
            <label class="flex items-center gap-2">Grosor
              <input v-model.number="pencilWidthDraft" type="range" min="0.001" max="0.02" step="0.001" class="w-24" />
            </label>
          </template>
          <template v-else-if="selectedTool === 'image'">
            <span>Modo imagen activo: haz clic en el PDF para elegir una imagen y posicionarla.</span>
          </template>
          <template v-else>
            <span>Modo seleccion activo: arrastra para mover y usa el inspector para ajustar.</span>
          </template>
        </div>

        <div v-show="isRibbonCompact" class="flex flex-wrap items-center justify-between gap-2 bg-white p-2 text-xs text-surface-600">
          <span>{{ fileName || 'Sin PDF' }}</span>
          <div class="flex flex-wrap items-center gap-2">
            <UiButton size="sm" variant="ghost" :disabled="undoStack.length === 0" @click="undo">Deshacer</UiButton>
            <UiButton size="sm" variant="ghost" :disabled="redoStack.length === 0" @click="redo">Rehacer</UiButton>
            <UiButton size="sm" variant="primary" :disabled="!canSaveOrExport" :loading="exporting" @click="exportPdf">Exportar PDF</UiButton>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard title="Lienzo de edicion" :padding="false">
      <div class="p-4 border-b border-surface-200 flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="secondary" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">Anterior</UiButton>
          <UiButton size="sm" variant="secondary" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">Siguiente</UiButton>
          <span class="text-sm text-surface-700">Pagina {{ currentPage }} de {{ totalPages || 0 }}</span>
          <label class="text-xs text-surface-600">Ir a</label>
          <input
            :value="currentPage"
            type="number"
            min="1"
            :max="Math.max(1, totalPages)"
            class="w-20 rounded-md border border-surface-300 px-2 py-1 text-sm"
            :disabled="!hasDocument"
            @change="jumpToPage"
          />
        </div>

        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="ghost" :disabled="!hasDocument" @click="updateZoom(renderScale - 0.1)">-</UiButton>
          <span class="text-sm text-surface-700">Zoom {{ zoomPercent }}%</span>
          <UiButton size="sm" variant="ghost" :disabled="!hasDocument" @click="updateZoom(renderScale + 0.1)">+</UiButton>
          <UiButton size="sm" variant="ghost" :disabled="!hasDocument" @click="updateZoom(1.3)">100%</UiButton>
          <span class="ml-2 rounded-md border border-surface-200 bg-surface-50 px-2 py-1 text-xs text-surface-600">
            Herramienta: <strong class="text-surface-800">{{ selectedToolLabel }}</strong>
          </span>
        </div>
      </div>

      <div v-if="!fileBytes" class="p-6 lg:p-10">
        <div
          class="mx-auto max-w-3xl rounded-2xl border-2 border-dashed bg-linear-to-br from-blue-50/60 via-white to-emerald-50/40 p-8 text-center transition-colors"
          :class="isDraggingFile ? 'border-blue-500 bg-blue-50/80' : 'border-surface-300'"
        >
          <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
            </svg>
          </div>
          <h2 class="mt-4 text-heading-3">Arrastra y suelta tu archivo</h2>
          <p class="mt-1 text-sm text-surface-600">
            Acepta <strong>PDF</strong>, <strong>imagenes</strong> (PNG, JPG, WebP, GIF), <strong>DOCX</strong> y <strong>TXT</strong>. Maximo 25 MB por archivo.
          </p>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              class="group flex flex-col items-center gap-2 rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow"
              @click="openPdfPicker"
            >
              <span class="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200">
                <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /></svg>
              </span>
              <span class="text-sm font-semibold text-surface-800">Subir PDF</span>
              <span class="text-xs text-surface-500">Edita un documento existente.</span>
            </button>
            <button
              type="button"
              class="group flex flex-col items-center gap-2 rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow"
              @click="openImagesPicker"
            >
              <span class="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200">
                <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.4" /><path d="M21 16l-5-5-4 4-2-2-4 3" /></svg>
              </span>
              <span class="text-sm font-semibold text-surface-800">Imagenes &rarr; PDF</span>
              <span class="text-xs text-surface-500">Una pagina por imagen, ordenable.</span>
            </button>
            <button
              type="button"
              class="group flex flex-col items-center gap-2 rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow"
              @click="openDocxPicker"
            >
              <span class="flex size-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200">
                <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></svg>
              </span>
              <span class="text-sm font-semibold text-surface-800">DOCX &rarr; PDF</span>
              <span class="text-xs text-surface-500">Texto plano del Word.</span>
            </button>
            <button
              type="button"
              class="group flex flex-col items-center gap-2 rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-400 hover:shadow"
              @click="openTextComposer"
            >
              <span class="flex size-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 group-hover:bg-rose-200">
                <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
              </span>
              <span class="text-sm font-semibold text-surface-800">Escribir texto</span>
              <span class="text-xs text-surface-500">Crea un PDF desde cero.</span>
            </button>
          </div>

          <p class="mt-5 text-xs text-surface-500">
            Tambien puedes pegar un archivo desde tu explorador o usar los botones de la barra superior.
          </p>
        </div>

        <div class="mx-auto mt-6 grid max-w-3xl gap-3 lg:grid-cols-3">
          <div class="rounded-xl border border-surface-200 bg-white p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-500">1. Carga</p>
            <p class="mt-1 text-sm text-surface-700">Sube PDF, imagenes, DOCX o escribe texto. Detectamos el tipo automaticamente.</p>
          </div>
          <div class="rounded-xl border border-surface-200 bg-white p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-500">2. Edita</p>
            <p class="mt-1 text-sm text-surface-700">Agrega texto, firma, sello, resaltado o dibuja a mano alzada. Arrastra y redimensiona.</p>
          </div>
          <div class="rounded-xl border border-surface-200 bg-white p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-500">3. Guarda</p>
            <p class="mt-1 text-sm text-surface-700">Guarda borrador en servidor o descarga el PDF final con tus cambios aplicados.</p>
          </div>
        </div>
      </div>

      <div v-else class="grid gap-4 bg-surface-100 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="overflow-auto">
          <div class="mx-auto relative w-fit bg-white shadow-lg" :style="{ width: `${pageWidth || 760}px` }">
            <canvas ref="pageCanvas" class="block max-w-full" />

            <div
              ref="overlayRef"
              class="absolute inset-0"
              @pointerdown="onOverlayPointerDown"
              @click="onOverlayClick"
              @pointermove="onDrag"
              @pointerup="endDrag"
              @pointercancel="endDrag"
            >
              <svg class="pointer-events-none absolute inset-0 h-full w-full">
                <polyline
                  v-for="shape in pageShapeAnnotations"
                  :key="shape.id"
                  :points="(shape.points ?? []).map((p) => `${p.x * pageWidth},${p.y * pageHeight}`).join(' ')"
                  fill="none"
                  :stroke="shape.color ?? '#111827'"
                  :stroke-width="Math.max(1, (shape.strokeWidth ?? 0.005) * pageHeight)"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <polyline
                  v-if="activeDraw && activeDraw.points.length > 1"
                  :points="activeDraw.points.map((p) => `${p.x * pageWidth},${p.y * pageHeight}`).join(' ')"
                  fill="none"
                  :stroke="pencilColorDraft"
                  :stroke-width="Math.max(1, pencilWidthDraft * pageHeight)"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>

              <div
                v-for="annotation in pageAnnotations"
                :key="annotation.id"
                v-show="annotation.type !== 'drawing'"
                class="absolute cursor-move overflow-hidden rounded-sm bg-white/40"
                :style="annotationStyle(annotation)"
                @click.stop="selectAnnotation(annotation.id)"
                @dblclick.stop="annotation.type === 'text' ? startInlineTextEdit(annotation.id) : (annotation.type === 'signature' ? startReplaceSignature(annotation.id) : null)"
                @pointerdown.stop="startDrag(annotation, $event)"
              >
                <div
                  v-if="annotation.type === 'text'"
                  class="h-full w-full px-1 py-0.5"
                  :style="annotationTextStyle(annotation)"
                >
                  <template v-if="editingTextId === annotation.id">
                    <textarea
                      v-model="editingTextValue"
                      class="h-full w-full resize-none rounded border border-blue-300 bg-white/95 p-1 text-inherit leading-[1.2] outline-none"
                      @keydown.enter.meta.prevent="saveInlineTextEdit"
                      @keydown.enter.ctrl.prevent="saveInlineTextEdit"
                      @keydown.esc.prevent="cancelInlineTextEdit"
                      @blur="saveInlineTextEdit"
                    />
                    <div class="mt-1 flex gap-1">
                      <button
                        type="button"
                        class="rounded border border-surface-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-surface-700"
                        @mousedown.prevent
                        @click.stop="saveInlineTextEdit"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        class="rounded border border-surface-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-surface-700"
                        @mousedown.prevent
                        @click.stop="cancelInlineTextEdit"
                      >
                        Cancelar
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <span class="whitespace-pre-wrap">{{ annotation.text }}</span>
                  </template>
                </div>
                <img
                  v-else-if="annotation.type === 'signature'"
                  :src="annotation.imageDataUrl"
                  alt="Firma"
                  class="pointer-events-none h-full w-full object-contain select-none"
                  draggable="false"
                />
                <img
                  v-else-if="annotation.type === 'image'"
                  :src="annotation.imageDataUrl"
                  alt="Imagen"
                  class="pointer-events-none h-full w-full object-contain select-none"
                  draggable="false"
                />
                <div
                  v-else-if="annotation.type === 'highlight'"
                  class="h-full w-full"
                  :style="{ backgroundColor: annotation.color ?? '#facc15', opacity: '0.4' }"
                />
                <div
                  v-else-if="annotation.type === 'stamp'"
                  class="grid h-full w-full place-content-center rounded border-2 border-current bg-white/70 px-1 text-center text-xs font-semibold uppercase tracking-wide"
                  :style="{ color: annotation.color ?? '#b91c1c' }"
                >
                  {{ annotation.text }}
                </div>

                <template
                  v-if="selectedAnnotationId === annotation.id && annotation.type !== 'drawing'"
                >
                  <button
                    type="button"
                    class="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-blue-600 bg-white"
                    @pointerdown.stop.prevent="startResize(annotation, 'nw', $event)"
                  />
                  <button
                    type="button"
                    class="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-blue-600 bg-white"
                    @pointerdown.stop.prevent="startResize(annotation, 'ne', $event)"
                  />
                  <button
                    type="button"
                    class="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border border-blue-600 bg-white"
                    @pointerdown.stop.prevent="startResize(annotation, 'sw', $event)"
                  />
                  <button
                    type="button"
                    class="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border border-blue-600 bg-white"
                    @pointerdown.stop.prevent="startResize(annotation, 'se', $event)"
                  />
                </template>
              </div>

              <div
                v-if="snapGuideX !== null"
                class="pointer-events-none absolute inset-y-0 border-l border-dashed border-blue-500/70"
                :style="{ left: `${snapGuideX * 100}%` }"
              />
              <div
                v-if="snapGuideY !== null"
                class="pointer-events-none absolute inset-x-0 border-t border-dashed border-blue-500/70"
                :style="{ top: `${snapGuideY * 100}%` }"
              />
            </div>

            <div
              v-if="selectedAnnotation"
              class="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-surface-200 bg-white/95 p-2 shadow"
            >
              <UiButton size="sm" variant="ghost" @click="nudgeSelectedAnnotation(-0.01, 0)">Izq</UiButton>
              <UiButton size="sm" variant="ghost" @click="nudgeSelectedAnnotation(0.01, 0)">Der</UiButton>
              <UiButton size="sm" variant="ghost" @click="nudgeSelectedAnnotation(0, -0.01)">Subir</UiButton>
              <UiButton size="sm" variant="ghost" @click="nudgeSelectedAnnotation(0, 0.01)">Bajar</UiButton>
              <UiButton size="sm" variant="secondary" @click="duplicateSelectedAnnotation">Duplicar</UiButton>
              <UiButton size="sm" variant="ghost" @click="removeSelectedAnnotation">Eliminar</UiButton>
            </div>

            <div v-if="loadingPage" class="absolute inset-0 grid place-content-center bg-white/60 text-sm font-medium text-surface-700">
              Cargando pagina...
            </div>
          </div>
        </div>

        <aside class="self-start rounded-xl border border-surface-200 bg-white p-4 lg:sticky lg:top-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-surface-500">Inspector</p>
          <p class="mt-1 text-sm text-surface-700">{{ pageAnnotationCount }} elementos en esta pagina · {{ totalAnnotationCount }} en total</p>

          <div class="mt-4 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-500">Mini mapa de paginas</p>
            <div class="mt-2 grid max-h-52 grid-cols-4 gap-2 overflow-auto pr-1">
              <button
                v-for="page in pageNumberList"
                :key="page"
                type="button"
                class="rounded-md border px-2 py-1 text-xs font-medium"
                :class="page === currentPage
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-surface-300 bg-white text-surface-700 hover:border-blue-400 hover:text-blue-700'"
                @click="changePage(page)"
              >
                <span>P{{ page }}</span>
                <span class="ml-1 text-[11px] opacity-80">({{ annotationCountForPage(page) }})</span>
              </button>
            </div>
          </div>

          <div v-if="selectedAnnotation" class="mt-4 space-y-3">
            <div class="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm text-surface-700">
              <p><span class="font-medium">Tipo:</span> {{ annotationTypeLabel(selectedAnnotation) }}</p>
              <p><span class="font-medium">Pagina:</span> {{ selectedAnnotation.page }}</p>
            </div>

            <div>
              <label class="text-xs font-medium text-surface-700">Ancho</label>
              <input
                :value="selectedAnnotation.width"
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                class="w-full"
                @input="updateSelectedSize('width', Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <div>
              <label class="text-xs font-medium text-surface-700">Alto</label>
              <input
                :value="selectedAnnotation.height"
                type="range"
                min="0.03"
                max="0.95"
                step="0.01"
                class="w-full"
                @input="updateSelectedSize('height', Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <div v-if="selectedAnnotation.type === 'text' || selectedAnnotation.type === 'stamp'">
              <label class="text-xs font-medium text-surface-700">Tamano texto</label>
              <input
                :value="selectedAnnotation.fontSize ?? 0.03"
                type="range"
                min="0.015"
                max="0.08"
                step="0.001"
                class="w-full"
                @input="updateSelectedTextSize(Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <div v-if="selectedAnnotation.type === 'text'" class="space-y-2">
              <label class="text-xs font-medium text-surface-700">Fuente</label>
              <select
                :value="selectedAnnotation.fontFamily ?? 'sans'"
                class="w-full rounded border border-surface-300 bg-white px-2 py-1 text-xs text-surface-700"
                @change="updateSelectedFontFamily(($event.target as HTMLSelectElement).value as FontFamily)"
              >
                <option value="sans">Sans (Helvetica)</option>
                <option value="serif">Serif (Times)</option>
                <option value="mono">Mono (Courier)</option>
              </select>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded border px-2 py-1 text-xs font-bold"
                  :class="selectedAnnotation.bold ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-surface-300 bg-white text-surface-700'"
                  @click="toggleSelectedBold"
                >Negrita</button>
                <button
                  type="button"
                  class="flex-1 rounded border px-2 py-1 text-xs italic"
                  :class="selectedAnnotation.italic ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-surface-300 bg-white text-surface-700'"
                  @click="toggleSelectedItalic"
                >Cursiva</button>
              </div>
            </div>

            <div v-if="selectedAnnotation.type === 'text' || selectedAnnotation.type === 'highlight' || selectedAnnotation.type === 'stamp' || selectedAnnotation.type === 'drawing'">
              <label class="text-xs font-medium text-surface-700">Color texto</label>
              <input
                :value="selectedAnnotation.color ?? '#111827'"
                type="color"
                class="h-10 w-full rounded-lg border border-surface-300"
                @input="updateSelectedTextColor(($event.target as HTMLInputElement).value)"
              />
            </div>

            <div v-if="selectedAnnotation.type === 'drawing'">
              <label class="text-xs font-medium text-surface-700">Grosor trazo</label>
              <input
                :value="selectedAnnotation.strokeWidth ?? 0.005"
                type="range"
                min="0.001"
                max="0.02"
                step="0.001"
                class="w-full"
                @input="updateSelectedStrokeWidth(Number(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <div v-else class="mt-4 rounded-lg border border-dashed border-surface-300 bg-surface-50 p-3 text-sm text-surface-600">
            Selecciona un elemento en el lienzo para editar tamano, color y posicion desde este panel.
          </div>

          <div class="mt-4 rounded-lg border border-surface-200 bg-white p-3 text-xs text-surface-600">
            Flechas: mueve seleccion · Shift + flechas: movimiento rapido · Ctrl/Cmd+Z: deshacer.
          </div>
        </aside>
      </div>
    </UiCard>

    <Transition name="fade">
      <div
        v-if="isDraggingFile"
        class="pointer-events-none fixed inset-0 z-(--z-modal) flex items-center justify-center bg-blue-900/30 backdrop-blur-sm"
      >
        <div class="rounded-2xl border-2 border-dashed border-white/80 bg-blue-600/95 px-10 py-8 text-center text-white shadow-2xl">
          <svg class="mx-auto size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          <p class="mt-3 text-lg font-semibold">Suelta tu archivo aqui</p>
          <p class="mt-1 text-sm opacity-90">PDF, imagenes, DOCX o TXT</p>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div
        v-if="isConverting"
        class="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-black/40 backdrop-blur-sm"
      >
        <div class="flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-xl">
          <svg class="size-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span class="text-sm font-medium text-surface-700">{{ conversionLabel || 'Procesando...' }}</span>
        </div>
      </div>
    </Transition>

    <UiModal :show="showImagesModal" title="Crear PDF desde imagenes" size="xl" @close="closeImagesModal">
      <div class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-surface-700">Tamano de pagina</label>
            <select v-model="imagePageSize" class="w-full rounded-md border border-surface-300 bg-white px-2 py-1.5 text-sm">
              <option value="a4">A4 (recomendado)</option>
              <option value="letter">Carta (US Letter)</option>
              <option value="fit">Ajustar al tamano de la imagen</option>
            </select>
          </div>
          <div class="space-y-1" :class="imagePageSize === 'fit' ? 'opacity-50' : ''">
            <label class="text-xs font-medium text-surface-700">Margen ({{ imageMargin }} pt)</label>
            <input v-model.number="imageMargin" type="range" min="0" max="80" step="2" class="w-full" :disabled="imagePageSize === 'fit'" />
          </div>
          <div class="flex items-end">
            <UiButton size="sm" variant="ghost" class="w-full" @click="openImagesPicker">+ Agregar imagenes</UiButton>
          </div>
        </div>

        <div v-if="imageQueue.length === 0" class="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-8 text-center text-sm text-surface-600">
          Aun no hay imagenes. Agrega o arrastra archivos PNG, JPG, WebP o GIF.
        </div>

        <ul v-else class="grid max-h-[55vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
          <li
            v-for="(item, index) in imageQueue"
            :key="item.id"
            class="flex items-center gap-3 rounded-lg border border-surface-200 bg-white p-2"
          >
            <span class="grid size-8 shrink-0 place-content-center rounded-md bg-surface-100 text-xs font-semibold text-surface-700">{{ index + 1 }}</span>
            <img :src="item.previewUrl" :alt="item.file.name" class="size-16 shrink-0 rounded-md border border-surface-200 bg-surface-50 object-cover" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-surface-800">{{ item.file.name }}</p>
              <p class="text-xs text-surface-500">{{ Math.round(item.file.size / 1024) }} KB</p>
            </div>
            <div class="flex flex-col gap-1">
              <button
                type="button"
                class="rounded border border-surface-300 bg-white px-1.5 py-0.5 text-xs text-surface-700 disabled:opacity-40"
                :disabled="index === 0"
                @click="moveImageInQueue(item.id, -1)"
              >&uarr;</button>
              <button
                type="button"
                class="rounded border border-surface-300 bg-white px-1.5 py-0.5 text-xs text-surface-700 disabled:opacity-40"
                :disabled="index === imageQueue.length - 1"
                @click="moveImageInQueue(item.id, 1)"
              >&darr;</button>
            </div>
            <button
              type="button"
              class="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              @click="removeImageFromQueue(item.id)"
            >Quitar</button>
          </li>
        </ul>

        <p class="text-xs text-surface-500">
          {{ imageQueue.length }} imagen(es) generaran {{ imageQueue.length }} pagina(s).
        </p>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="closeImagesModal">Cancelar</UiButton>
        <UiButton variant="primary" :disabled="imageQueue.length === 0" :loading="isConverting" @click="generatePdfFromImages">
          Generar PDF
        </UiButton>
      </template>
    </UiModal>

    <UiModal :show="showTextModal" title="Crear PDF desde texto" size="lg" @close="showTextModal = false">
      <div class="space-y-4">
        <UiInput v-model="textComposerName" label="Nombre del archivo" placeholder="documento.pdf" />
        <UiTextarea
          v-model="textComposerValue"
          label="Contenido"
          :rows="14"
          placeholder="Escribe o pega el contenido del documento. Se paginara automaticamente en formato A4."
        />
        <p class="text-xs text-surface-500">
          El texto usara fuente Helvetica 11pt sobre A4. Despues de generarlo podras agregar firmas, sellos y mas anotaciones.
        </p>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="showTextModal = false">Cancelar</UiButton>
        <UiButton variant="primary" :disabled="!textComposerValue.trim()" :loading="isConverting" @click="generatePdfFromTextComposer">
          Generar PDF
        </UiButton>
      </template>
    </UiModal>

    <div
      v-if="showSignaturePad"
      class="fixed inset-0 z-(--z-modal) bg-black/50 grid place-content-center p-4"
      @click.self="closeSignaturePad"
    >
      <UiCard :title="replacingSignatureId ? 'Reemplazar firma' : 'Capturar firma'">
        <div class="space-y-4 w-[min(90vw,700px)]">
          <p class="text-xs text-surface-600">
            {{ replacingSignatureId ? 'Dibuja la nueva firma para reemplazar la seleccionada.' : 'Dibuja la firma para insertarla en el documento.' }}
          </p>
          <canvas
            ref="signatureCanvas"
            width="640"
            height="240"
            class="w-full rounded-lg border border-surface-300 bg-white"
          />
          <div class="flex gap-2 justify-end">
            <UiButton variant="ghost" @click="clearSignaturePad">Limpiar</UiButton>
            <UiButton variant="secondary" @click="closeSignaturePad">Cancelar</UiButton>
            <UiButton variant="primary" @click="saveSignature">{{ replacingSignatureId ? 'Reemplazar firma' : 'Guardar firma' }}</UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </section>
</template>
