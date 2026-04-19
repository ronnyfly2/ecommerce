import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import { productsService } from '@/services/products.service'
import { useToast } from '@/composables/useToast'
import { normalizeSku } from '@/utils/product-form'
import type { Color, Product, Size } from '@/types/api'

type InitialVariantDraft = {
  sku: string
  sizeId: string
  colorId: string
  additionalPrice: number
  isActive: boolean
}

type ProductFormVariantSource = {
  name: string
  description: string
  graphicDescription: string
  usageMode: string
  basePrice: number
  currencyCode: string
  categoryId: string
  couponId: string
  couponLink: string
  tagIds: string[]
  variantProductIds: string[]
}

export function useProductInitialVariants(options: {
  form: ProductFormVariantSource
  sizes: Ref<Size[]>
  colors: Ref<Color[]>
  availableRelatedProducts: Ref<Product[]>
  productSkuPreview: ComputedRef<string>
  categorySupportsSizeColorVariants: ComputedRef<boolean>
  buildFeaturesPayload: () => Array<{ icon: string; name: string }>
}) {
  const { form, sizes, colors, availableRelatedProducts, productSkuPreview, categorySupportsSizeColorVariants, buildFeaturesPayload } = options
  const toast = useToast()

  const initialVariantSkuTouched = ref(false)

  const initialVariantDraft = reactive({
    sku: '',
    sizeId: '',
    colorId: '',
    additionalPrice: 0,
    isActive: true,
  })

  const initialVariantErrors = reactive({
    sku: '',
    sizeId: '',
    colorId: '',
    additionalPrice: '',
  })

  const initialVariants = ref<InitialVariantDraft[]>([])

  const initialVariantSkuPreview = computed(() =>
    buildVariantSkuSuggestion(productSkuPreview.value, initialVariantDraft.sizeId, initialVariantDraft.colorId),
  )

  watch(
    () => [productSkuPreview.value, initialVariantDraft.sizeId, initialVariantDraft.colorId],
    () => {
      if (initialVariantSkuTouched.value) return
      initialVariantDraft.sku = initialVariantSkuPreview.value
    },
  )

  watch(categorySupportsSizeColorVariants, (enabled) => {
    if (enabled) {
      return
    }

    initialVariantDraft.sku = ''
    initialVariantDraft.sizeId = ''
    initialVariantDraft.colorId = ''
    initialVariantDraft.additionalPrice = 0
    initialVariantDraft.isActive = true
    initialVariants.value = []
  })

  function validateInitialVariantDraft() {
    initialVariantErrors.sku = ''
    initialVariantErrors.sizeId = ''
    initialVariantErrors.colorId = ''
    initialVariantErrors.additionalPrice = ''

    if (!initialVariantDraft.sku.trim()) {
      initialVariantErrors.sku = 'El SKU es requerido'
    }

    if (!initialVariantDraft.sizeId) {
      initialVariantErrors.sizeId = 'Selecciona una talla'
    }

    if (!initialVariantDraft.colorId) {
      initialVariantErrors.colorId = 'Selecciona un color'
    }

    if (!Number.isFinite(Number(initialVariantDraft.additionalPrice)) || Number(initialVariantDraft.additionalPrice) < 0) {
      initialVariantErrors.additionalPrice = 'El precio adicional debe ser mayor o igual a 0'
    }

    return (
      !initialVariantErrors.sku &&
      !initialVariantErrors.sizeId &&
      !initialVariantErrors.colorId &&
      !initialVariantErrors.additionalPrice
    )
  }

  function onInitialVariantSkuInput(value: string | number | undefined) {
    initialVariantSkuTouched.value = true
    initialVariantDraft.sku = normalizeSku(String(value ?? ''))
    initialVariantErrors.sku = initialVariantDraft.sku.length < 3 ? 'El SKU es requerido' : ''
  }

  function resetInitialVariantSku() {
    initialVariantSkuTouched.value = false
    initialVariantDraft.sku = initialVariantSkuPreview.value
    initialVariantErrors.sku = initialVariantDraft.sku.length < 3 ? 'El SKU es requerido' : ''
  }

  function addInitialVariant() {
    if (!validateInitialVariantDraft()) return

    const normalizedSku = initialVariantDraft.sku.trim().toUpperCase()
    const duplicated = initialVariants.value.some((item) => item.sku.toUpperCase() === normalizedSku)
    if (duplicated) {
      initialVariantErrors.sku = 'Ese SKU ya esta en la lista inicial'
      return
    }

    initialVariants.value.push({
      sku: normalizedSku,
      sizeId: initialVariantDraft.sizeId,
      colorId: initialVariantDraft.colorId,
      additionalPrice: Number(initialVariantDraft.additionalPrice),
      isActive: initialVariantDraft.isActive,
    })

    initialVariantDraft.sku = ''
    initialVariantDraft.sizeId = ''
    initialVariantDraft.colorId = ''
    initialVariantDraft.additionalPrice = 0
    initialVariantDraft.isActive = true
    initialVariantSkuTouched.value = false
  }

  function removeInitialVariant(index: number) {
    initialVariants.value.splice(index, 1)
  }

  function sizeNameById(sizeId: string) {
    return sizes.value.find((size) => size.id === sizeId)?.name ?? 'Sin talla'
  }

  function colorNameById(colorId: string) {
    return colors.value.find((color) => color.id === colorId)?.name ?? 'Sin color'
  }

  function buildVariantSkuSuggestion(baseSku: string, sizeId: string, colorId: string) {
    const parts = [normalizeSku(baseSku)]
    const colorName = colors.value.find((color) => color.id === colorId)?.name ?? ''
    const sizeName = sizes.value.find((size) => size.id === sizeId)?.name ?? ''

    if (colorName) {
      parts.push(normalizeSku(colorName))
    }

    if (sizeName) {
      parts.push(normalizeSku(sizeName))
    }

    return parts.filter(Boolean).join('-')
  }

  function buildVariantProductName(baseName: string, colorId: string, sizeId: string) {
    const colorName = colorNameById(colorId)
    const sizeName = sizeNameById(sizeId)
    return `${baseName} ${colorName} ${sizeName}`.trim()
  }

  async function createIndependentVariantProducts(parentProductId: string) {
    if (!initialVariants.value.length) {
      return
    }

    const createdVariantIds: string[] = []
    const failedSkus: string[] = []

    for (const variant of initialVariants.value) {
      const variantName = buildVariantProductName(form.name, variant.colorId, variant.sizeId)
      const variantBasePrice = Number((Number(form.basePrice) + Number(variant.additionalPrice)).toFixed(2))

      try {
        const createdVariant = await productsService.create({
          name: variantName,
          sku: normalizeSku(variant.sku),
          description: form.description || undefined,
          graphicDescription: form.graphicDescription.trim() || undefined,
          usageMode: form.usageMode.trim() || undefined,
          basePrice: variantBasePrice,
          currencyCode: form.currencyCode,
          categoryId: form.categoryId,
          couponId: form.couponId || undefined,
          couponLink: form.couponLink.trim() || undefined,
          tagIds: [...form.tagIds],
          relatedProductIds: [],
          suggestedProductIds: [],
          variantProductIds: [],
          features: buildFeaturesPayload(),
          isActive: variant.isActive,
          isFeatured: false,
          hasOffer: false,
        })

        createdVariantIds.push(createdVariant.id)
        availableRelatedProducts.value = [...availableRelatedProducts.value, createdVariant]
      } catch {
        failedSkus.push(variant.sku)
      }
    }

    if (createdVariantIds.length) {
      const nextVariantIds = [...new Set([...form.variantProductIds, ...createdVariantIds])]
      form.variantProductIds = nextVariantIds
      await productsService.update(parentProductId, { variantProductIds: nextVariantIds })
    }

    if (failedSkus.length) {
      toast.warning('Variantes parciales', `No se pudieron crear estas variantes: ${failedSkus.join(', ')}`)
    }

    if (createdVariantIds.length) {
      toast.success('Variantes creadas', `${createdVariantIds.length} variantes se crearon como productos independientes`)
      initialVariants.value = []
    }
  }

  return {
    initialVariantDraft,
    initialVariantErrors,
    initialVariants,
    initialVariantSkuPreview,
    onInitialVariantSkuInput,
    resetInitialVariantSku,
    addInitialVariant,
    removeInitialVariant,
    sizeNameById,
    colorNameById,
    createIndependentVariantProducts,
  }
}
