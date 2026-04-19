import { reactive, ref, computed, watch, type Ref } from 'vue'
import { extractErrorMessage } from '@/utils/error'
import { useToast } from '@/composables/useToast'
import { useDraggableList } from '@/composables/useDraggableList'
import type { Product, ProductImage } from '@/types/api'

interface ImageService {
  uploadImageAsset: (file: File) => Promise<string>
  createImage: (
    productId: string,
    dto: { url: string; altText?: string; isMain: boolean; displayOrder: number },
  ) => Promise<ProductImage>
  updateImage: (
    productId: string,
    imageId: string,
    dto: { isMain?: boolean; displayOrder?: number },
  ) => Promise<ProductImage>
  removeImage: (productId: string, imageId: string) => Promise<void>
}

/**
 * Composable para gestión de imágenes de un producto (subida, orden, borrado).
 *
 * @param product    Ref al producto actual (null si es creación)
 * @param service    Subset del servicio con métodos de imagen
 * @param onRefresh  Callback para recargar el producto tras cada acción
 */
export function useImageManager(
  product: Ref<Product | null>,
  service: ImageService,
  onRefresh: () => Promise<void>,
) {
  const toast = useToast()

  const imageUpload = reactive({
    files: [] as Array<{ id: string; file: File; displayOrder: number; altText: string }>,
    markFirstAsMain: false,
  })

  const uploadingImage = ref(false)
  const imageActionLoading = ref<string | null>(null)
  const savingImageOrder = ref(false)
  const existingImageOrder = ref<string[]>([])

  const sortedImages = computed(() => {
    const items = product.value?.images ?? []
    return [...items].sort((a, b) => a.displayOrder - b.displayOrder)
  })

  const hasImageOrderChanges = computed(() => {
    const currentOrder = sortedImages.value.map((img) => img.id)
    if (currentOrder.length !== existingImageOrder.value.length) return false
    return currentOrder.some((id, index) => existingImageOrder.value[index] !== id)
  })

  watch(sortedImages, (images) => {
    existingImageOrder.value = images.map((img) => img.id)
  }, { immediate: true })

  // ── Drag & drop imágenes pendientes ──────────────────────────────────────
  const {
    onDragStart: onPendingImageDragStart,
    onDragOver: onPendingImageDragOver,
    onDrop: onPendingImageDropRaw,
    onDragEnd: onPendingImageDragEnd,
  } = useDraggableList(
    () => imageUpload.files,
    (list) => { imageUpload.files = list; normalizePendingImageOrder() },
    (item) => item.id,
  )

  function onPendingImageDrop(targetId: string) {
    onPendingImageDropRaw(targetId)
  }

  // ── Drag & drop imágenes existentes ──────────────────────────────────────
  const {
    onDragStart: onExistingImageDragStart,
    onDragOver: onExistingImageDragOver,
    onDrop: onExistingImageDrop,
    onDragEnd: onExistingImageDragEnd,
  } = useDraggableList(
    () => existingImageOrder.value,
    (list) => { existingImageOrder.value = list },
    (id) => id,
  )

  // ── Funciones ─────────────────────────────────────────────────────────────

  function onImageFileSelected(event: Event) {
    const target = event.target as HTMLInputElement
    const selectedFiles = Array.from(target.files ?? [])

    if (!selectedFiles.length) {
      imageUpload.files = []
      return
    }

    const maxOrder = Math.max(0, ...((product.value?.images ?? []).map((img) => Number(img.displayOrder ?? 0))))

    imageUpload.files = selectedFiles.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      displayOrder: maxOrder + index + 1,
      altText: '',
    }))
  }

  function normalizePendingImageOrder() {
    const maxOrder = Math.max(0, ...((product.value?.images ?? []).map((img) => Number(img.displayOrder ?? 0))))
    imageUpload.files = imageUpload.files.map((item, index) => ({
      ...item,
      displayOrder: maxOrder + index + 1,
    }))
  }

  function removePendingImage(pendingId: string) {
    imageUpload.files = imageUpload.files.filter((item) => item.id !== pendingId)
    normalizePendingImageOrder()
  }

  function imageById(imageId: string) {
    return sortedImages.value.find((img) => img.id === imageId) ?? null
  }

  async function uploadAndAttachImage() {
    if (!product.value) return
    if (!imageUpload.files.length) {
      toast.warning('Falta archivo', 'Selecciona una imagen para subir')
      return
    }

    uploadingImage.value = true
    try {
      let markedAsMain = false
      const pending = [...imageUpload.files]

      for (const item of pending) {
        const url = await service.uploadImageAsset(item.file)
        await service.createImage(product.value.id, {
          url,
          altText: item.altText.trim() || undefined,
          isMain: imageUpload.markFirstAsMain && !markedAsMain,
          displayOrder: Number(item.displayOrder) || 0,
        })
        if (imageUpload.markFirstAsMain) markedAsMain = true
      }

      toast.success('Imágenes agregadas', `Se asociaron ${pending.length} imagen(es) al producto`)
      imageUpload.files = []
      imageUpload.markFirstAsMain = false
      await onRefresh()
    } catch (e) {
      toast.error('Error', extractErrorMessage(e, 'No se pudo subir la imagen'))
    } finally {
      uploadingImage.value = false
    }
  }

  async function saveImageOrder() {
    if (!product.value || !hasImageOrderChanges.value) return

    savingImageOrder.value = true
    try {
      const imagesById = new Map(sortedImages.value.map((img) => [img.id, img]))

      const changed = existingImageOrder.value
        .map((imageId, index) => ({ image: imagesById.get(imageId), nextOrder: index + 1 }))
        .filter((entry): entry is { image: ProductImage; nextOrder: number } => Boolean(entry.image))
        .filter((entry) => Number(entry.image.displayOrder) !== entry.nextOrder)

      for (const entry of changed) {
        await service.updateImage(product.value.id, entry.image.id, { displayOrder: entry.nextOrder })
      }

      toast.success('Orden actualizado', 'El orden de imágenes fue guardado')
      await onRefresh()
    } catch (e) {
      toast.error('Error', extractErrorMessage(e, 'No se pudo guardar el orden de imágenes'))
    } finally {
      savingImageOrder.value = false
    }
  }

  async function setAsMain(image: ProductImage) {
    if (!product.value || image.isMain) return

    imageActionLoading.value = image.id
    try {
      await service.updateImage(product.value.id, image.id, { isMain: true })
      toast.success('Imagen principal actualizada')
      await onRefresh()
    } catch {
      toast.error('Error', 'No se pudo actualizar la imagen principal')
    } finally {
      imageActionLoading.value = null
    }
  }

  async function removeImage(image: ProductImage) {
    if (!product.value) return
    if (!window.confirm('Eliminar esta imagen?')) return

    imageActionLoading.value = image.id
    try {
      await service.removeImage(product.value.id, image.id)
      toast.success('Imagen eliminada')
      await onRefresh()
    } catch {
      toast.error('Error', 'No se pudo eliminar la imagen')
    } finally {
      imageActionLoading.value = null
    }
  }

  return {
    imageUpload,
    uploadingImage,
    imageActionLoading,
    savingImageOrder,
    existingImageOrder,
    sortedImages,
    hasImageOrderChanges,
    onImageFileSelected,
    normalizePendingImageOrder,
    removePendingImage,
    imageById,
    uploadAndAttachImage,
    saveImageOrder,
    setAsMain,
    removeImage,
    onPendingImageDragStart,
    onPendingImageDragOver,
    onPendingImageDrop,
    onPendingImageDragEnd,
    onExistingImageDragStart,
    onExistingImageDragOver,
    onExistingImageDrop,
    onExistingImageDragEnd,
  }
}
