import { reactive, computed, type Ref } from 'vue'
import { extractErrorMessage } from '@/utils/error'
import { useToast } from '@/composables/useToast'
import type { Product, ProductImage } from '@/types/api'

interface VariantImageService {
  uploadImageAsset: (file: File) => Promise<string>
  createImage: (
    productId: string,
    dto: { url: string; altText?: string; isMain: boolean; displayOrder: number },
  ) => Promise<ProductImage>
  updateImage: (
    productId: string,
    imageId: string,
    dto: { isMain?: boolean },
  ) => Promise<ProductImage>
  removeImage: (productId: string, imageId: string) => Promise<void>
  get: (productId: string) => Promise<Product>
}

/**
 * Composable para el modal de gestión de imágenes de un producto variante.
 *
 * @param availableProducts  Ref a la lista de productos disponibles (compartida con useProductRecommendations)
 * @param getFormName        Getter del nombre del producto base (para alt text por defecto)
 * @param service            Subset del servicio con métodos de imagen y get
 */
export function useVariantImageManager(
  availableProducts: Ref<Product[]>,
  getFormName: () => string,
  service: VariantImageService,
) {
  const toast = useToast()

  const variantImageModal = reactive({
    show: false,
    productId: '',
    file: null as File | null,
    altText: '',
    isMain: false,
    loading: false,
    actionLoading: null as string | null,
  })

  const selectedVariantForImage = computed(() =>
    availableProducts.value.find((item) => item.id === variantImageModal.productId) ?? null,
  )

  const variantSortedImages = computed(() => {
    const items = selectedVariantForImage.value?.images ?? []
    return [...items].sort((a, b) => a.displayOrder - b.displayOrder)
  })

  async function refreshLinkedProduct(productId: string) {
    const refreshed = await service.get(productId)
    availableProducts.value = [
      ...availableProducts.value.filter((item) => item.id !== refreshed.id),
      refreshed,
    ].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  function openVariantImageManager(variantProductId: string) {
    variantImageModal.show = true
    variantImageModal.productId = variantProductId
    variantImageModal.file = null
    variantImageModal.altText = ''
    variantImageModal.isMain = false
    variantImageModal.loading = false
    variantImageModal.actionLoading = null
  }

  function onVariantImageFileSelected(event: Event) {
    const target = event.target as HTMLInputElement
    variantImageModal.file = target.files?.[0] ?? null
  }

  async function uploadAndAttachVariantImage() {
    if (!variantImageModal.productId) return
    if (!variantImageModal.file) {
      toast.warning('Falta archivo', 'Selecciona una imagen para subir')
      return
    }

    variantImageModal.loading = true
    try {
      const url = await service.uploadImageAsset(variantImageModal.file)
      const nextOrder =
        Math.max(0, ...((selectedVariantForImage.value?.images ?? []).map((img) => img.displayOrder))) + 1

      await service.createImage(variantImageModal.productId, {
        url,
        altText: variantImageModal.altText || undefined,
        isMain: variantImageModal.isMain,
        displayOrder: nextOrder,
      })

      toast.success('Imagen agregada', 'Se asocio la imagen a la variante')
      variantImageModal.file = null
      variantImageModal.altText = ''
      variantImageModal.isMain = false
      await refreshLinkedProduct(variantImageModal.productId)
    } catch (e) {
      toast.error('Error', extractErrorMessage(e, 'No se pudo subir la imagen a la variante'))
    } finally {
      variantImageModal.loading = false
    }
  }

  async function attachExistingProductImageToVariant(image: ProductImage) {
    if (!variantImageModal.productId) return

    variantImageModal.loading = true
    try {
      const nextOrder =
        Math.max(0, ...((selectedVariantForImage.value?.images ?? []).map((img) => img.displayOrder))) + 1

      await service.createImage(variantImageModal.productId, {
        url: image.url,
        altText: image.altText ?? getFormName(),
        isMain: variantImageModal.isMain,
        displayOrder: nextOrder,
      })

      toast.success('Imagen asociada', 'Se reutilizo la imagen en la variante')
      await refreshLinkedProduct(variantImageModal.productId)
    } catch (e) {
      toast.error('Error', extractErrorMessage(e, 'No se pudo asociar la imagen'))
    } finally {
      variantImageModal.loading = false
    }
  }

  async function setVariantImageAsMain(image: ProductImage) {
    if (!variantImageModal.productId || image.isMain) return

    variantImageModal.actionLoading = image.id
    try {
      await service.updateImage(variantImageModal.productId, image.id, { isMain: true })
      toast.success('Imagen principal actualizada')
      await refreshLinkedProduct(variantImageModal.productId)
    } catch {
      toast.error('Error', 'No se pudo actualizar la imagen principal de la variante')
    } finally {
      variantImageModal.actionLoading = null
    }
  }

  async function removeVariantImage(image: ProductImage) {
    if (!variantImageModal.productId) return
    if (!window.confirm('Eliminar esta imagen de la variante?')) return

    variantImageModal.actionLoading = image.id
    try {
      await service.removeImage(variantImageModal.productId, image.id)
      toast.success('Imagen eliminada')
      await refreshLinkedProduct(variantImageModal.productId)
    } catch {
      toast.error('Error', 'No se pudo eliminar la imagen de la variante')
    } finally {
      variantImageModal.actionLoading = null
    }
  }

  return {
    variantImageModal,
    selectedVariantForImage,
    variantSortedImages,
    refreshLinkedProduct,
    openVariantImageManager,
    onVariantImageFileSelected,
    uploadAndAttachVariantImage,
    attachExistingProductImageToVariant,
    setVariantImageAsMain,
    removeVariantImage,
  }
}
