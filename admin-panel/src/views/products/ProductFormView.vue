<script setup lang="ts">
import { reactive, ref, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { couponsService } from '@/services/coupons.service'
import { currenciesService } from '@/services/currencies.service'
import { categoriesService, sizesService, colorsService, tagsService } from '@/services/catalog.service'
import { extractErrorMessage } from '@/utils/error'
import { CouponType } from '@/types/api'
import type { Product, Category, Size, Color, ProductImage, Tag, Coupon, Currency } from '@/types/api'
import { normalizeApiList } from '@/utils/api-list'
import { formatMoney } from '@/utils/currency'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const saving = ref(false)
const addingVariant = ref(false)
const uploadingImage = ref(false)
const imageActionLoading = ref<string | null>(null)

const categories = ref<Category[]>([])
const sizes = ref<Size[]>([])
const colors = ref<Color[]>([])
const currencies = ref<Currency[]>([])
const tags = ref<Tag[]>([])
const coupons = ref<Coupon[]>([])
const availableRelatedProducts = ref<Product[]>([])
const creatingTag = ref(false)
const newTagName = ref('')
const skuTouched = ref(false)
const variantSkuTouched = ref(false)
const initialVariantSkuTouched = ref(false)

const form = reactive({
  name: '',
  sku: '',
  description: '',
  basePrice: 0,
  currencyCode: getSystemCurrencyCode(),
  couponId: '',
  couponLink: '',
  hasOffer: false,
  offerPrice: 0,
  offerPercentage: 0,
  categoryId: '',
  tagIds: [] as string[],
  relatedProductIds: [] as string[],
  suggestedProductIds: [] as string[],
  isActive: true,
  isFeatured: false,
})

const relatedProductSearch = ref('')
const suggestedProductSearch = ref('')
const recommendationDrag = reactive({
  group: '' as '' | 'related' | 'suggested',
  productId: '',
})

const formErrors = reactive({
  name: '',
  sku: '',
  categoryId: '',
  basePrice: '',
  offer: '',
  couponLink: '',
})

const product = ref<Product | null>(null)

const variantModal = reactive({
  show: false,
  sku: '',
  sizeId: '',
  colorId: '',
  stock: 0,
  additionalPrice: 0,
  isActive: true,
})

const variantErrors = reactive({
  sku: '',
  sizeId: '',
  colorId: '',
  stock: '',
  additionalPrice: '',
})

type InitialVariantDraft = {
  sku: string
  sizeId: string
  colorId: string
  stock: number
  additionalPrice: number
  isActive: boolean
}

const initialVariantDraft = reactive({
  sku: '',
  sizeId: '',
  colorId: '',
  stock: 0,
  additionalPrice: 0,
  isActive: true,
})

const initialVariantErrors = reactive({
  sku: '',
  sizeId: '',
  colorId: '',
  stock: '',
  additionalPrice: '',
})

const initialVariants = ref<InitialVariantDraft[]>([])

const imageUpload = reactive({
  file: null as File | null,
  altText: '',
  isMain: false,
})

const selectedCategory = computed(() => categories.value.find((c) => c.id === form.categoryId) ?? null)
const selectedCoupon = computed(() => coupons.value.find((coupon) => coupon.id === form.couponId) ?? null)
const selectedRelatedProducts = computed(() =>
  form.relatedProductIds
    .map((relatedId) => availableRelatedProducts.value.find((item) => item.id === relatedId) ?? null)
    .filter((item): item is Product => item !== null),
)
const selectedSuggestedProducts = computed(() =>
  form.suggestedProductIds
    .map((suggestedId) => availableRelatedProducts.value.find((item) => item.id === suggestedId) ?? null)
    .filter((item): item is Product => item !== null),
)
const filteredRelatedProducts = computed(() => filterRecommendationProducts(relatedProductSearch.value, 'related'))
const filteredSuggestedProducts = computed(() => filterRecommendationProducts(suggestedProductSearch.value, 'suggested'))
const descriptionLength = computed(() => form.description.trim().length)
const slugPreview = computed(() => slugify(form.name))
const productSkuPreview = computed(() => normalizeSku(form.sku || form.name))
const initialVariantSkuPreview = computed(() =>
  buildVariantSkuSuggestion(productSkuPreview.value, initialVariantDraft.sizeId, initialVariantDraft.colorId),
)
const variantSkuPreview = computed(() =>
  buildVariantSkuSuggestion(productSkuPreview.value, variantModal.sizeId, variantModal.colorId),
)
const basePricePreview = computed(() => fmt(form.basePrice))
const offerPricePreview = computed(() => fmt(form.offerPrice))
const defaultCurrencyCode = computed(() => {
  const active = currencies.value.filter((item) => item.isActive)
  return active.find((item) => item.isDefault)?.code ?? getSystemCurrencyCode()
})
const defaultCurrencyName = computed(() => {
  const item = currencies.value.find((currency) => currency.code === defaultCurrencyCode.value)
  return item ? `${item.code} (${item.symbol})` : defaultCurrencyCode.value
})
const basePriceInDefaultCurrency = computed(() =>
  convertBetweenCurrencies(Number(form.basePrice), form.currencyCode, defaultCurrencyCode.value),
)
const offerPriceInDefaultCurrency = computed(() =>
  convertBetweenCurrencies(Number(form.offerPrice), form.currencyCode, defaultCurrencyCode.value),
)
const normalPrice = computed(() => Number(form.basePrice))
const offerDelta = computed(() => Math.max(0, normalPrice.value - Number(form.offerPrice || 0)))
const canSave = computed(() => {
  return (
    form.name.trim().length >= 3 &&
    form.sku.trim().length >= 3 &&
    !!form.categoryId &&
    Number.isFinite(Number(form.basePrice)) &&
    Number(form.basePrice) >= 0 &&
    (!form.hasOffer || (!formErrors.offer && Number(form.offerPrice) >= 0)) &&
    !formErrors.couponLink &&
    !formErrors.sku
  )
})

const sortedImages = computed(() => {
  const items = product.value?.images ?? []
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder)
})

const RichTextEditor = defineAsyncComponent(async () => {
  await import('@vueup/vue-quill/dist/vue-quill.snow.css')
  const mod = await import('@vueup/vue-quill')
  return mod.QuillEditor
})

const editorToolbar = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'link'],
  ['clean'],
]

const previousProductCurrencyCode = ref(form.currencyCode)
const syncingProductCurrencyChange = ref(false)

async function loadCatalogData() {
  const [cats, sz, cl, cc, tg, cp, productsData] = await Promise.all([
    categoriesService.list(),
    sizesService.list(),
    colorsService.list(),
    currenciesService.list(),
    tagsService.list(),
    couponsService.list(),
    productsService.list({ page: 1, limit: 100 }),
  ])
  categories.value = cats
  sizes.value = sz
  colors.value = cl
  currencies.value = cc.filter((item) => item.isActive)
  tags.value = tg.filter((item) => item.isActive)
  coupons.value = cp.sort((a, b) => a.code.localeCompare(b.code, 'es'))
  availableRelatedProducts.value = normalizeApiList(productsData).items.sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (!isEdit.value) {
    const active = cc.filter((item) => item.isActive)
    const defaultCode = active.find((item) => item.isDefault)?.code
    if (defaultCode) {
      form.currencyCode = defaultCode
      previousProductCurrencyCode.value = defaultCode
    }
  }
}

async function loadProduct() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const p = await productsService.get(id.value)
    product.value = p

    syncingProductCurrencyChange.value = true

    form.name = p.name
    form.sku = p.sku
    form.description = p.description ?? ''
    form.basePrice = Number(p.basePrice)
    form.currencyCode = p.currencyCode || getSystemCurrencyCode()
    form.couponId = p.coupon?.id ?? ''
    form.couponLink = p.couponLink ?? ''
    form.hasOffer = p.hasOffer
    form.offerPrice = Number(p.offerPrice ?? 0)
    form.offerPercentage = Number(p.offerPercentage ?? 0)
    form.categoryId = p.category?.id ?? ''
    form.tagIds = p.tags?.map((t) => t.id) ?? []
    form.relatedProductIds = p.relatedProducts?.map((item) => item.id) ?? []
    form.suggestedProductIds = p.suggestedProducts?.map((item) => item.id) ?? []
    form.isActive = p.isActive
    form.isFeatured = p.isFeatured
    previousProductCurrencyCode.value = form.currencyCode
    syncingProductCurrencyChange.value = false

    availableRelatedProducts.value = [...availableRelatedProducts.value, ...(p.relatedProducts ?? [])]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  } finally {
    loading.value = false
  }
}

function convertBetweenCurrencies(amount: number, fromCode: string, toCode: string) {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  const from = currencies.value.find((currency) => currency.code === fromCode)
  const to = currencies.value.find((currency) => currency.code === toCode)
  const fromRate = Number(from?.exchangeRateToUsd || 1)
  const toRate = Number(to?.exchangeRateToUsd || 1)

  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
    return Number(numeric.toFixed(2))
  }

  const amountInUsd = numeric / fromRate
  return Number((amountInUsd * toRate).toFixed(2))
}

function validateForm() {
  formErrors.name = ''
  formErrors.sku = ''
  formErrors.categoryId = ''
  formErrors.basePrice = ''
  formErrors.offer = ''
  formErrors.couponLink = ''

  if (form.name.trim().length < 3) {
    formErrors.name = 'Ingresa al menos 3 caracteres'
  }

  if (normalizeSku(form.sku).length < 3) {
    formErrors.sku = 'Ingresa un SKU valido de al menos 3 caracteres'
  }

  if (!form.categoryId) {
    formErrors.categoryId = 'Selecciona una categoria'
  }

  if (!Number.isFinite(Number(form.basePrice)) || Number(form.basePrice) < 0) {
    formErrors.basePrice = 'Ingresa un precio valido mayor o igual a 0'
  }

  if (form.couponLink && !isValidCouponLink(form.couponLink)) {
    formErrors.couponLink = 'Ingresa un enlace valido (incluye http:// o https://)'
  }

  formErrors.offer = getOfferError()

  return !formErrors.name && !formErrors.categoryId && !formErrors.basePrice && !formErrors.offer && !formErrors.couponLink
}

async function save() {
  if (!validateForm()) return

  saving.value = true
  try {
    const payload = {
      name: form.name,
      sku: normalizeSku(form.sku),
      description: form.description || undefined,
      basePrice: Number(form.basePrice),
      currencyCode: form.currencyCode,
      categoryId: form.categoryId,
      couponId: form.couponId || undefined,
      couponLink: form.couponLink.trim() || undefined,
      tagIds: form.tagIds,
      relatedProductIds: form.relatedProductIds,
      suggestedProductIds: form.suggestedProductIds,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      hasOffer: form.hasOffer,
      offerPrice: form.hasOffer ? Number(form.offerPrice) : undefined,
      offerPercentage: form.hasOffer ? Number(form.offerPercentage) : undefined,
    }

    if (isEdit.value) {
      await productsService.update(id.value, payload)
      toast.success('Guardado', 'Producto actualizado')
      await loadProduct()
    } else {
      const created = await productsService.create(payload)

      if (initialVariants.value.length) {
        const failedSkus: string[] = []
        for (const variant of initialVariants.value) {
          try {
            await productsService.createVariant(created.id, {
              sku: variant.sku,
              sizeId: variant.sizeId,
              colorId: variant.colorId,
              stock: Number(variant.stock),
              additionalPrice: Number(variant.additionalPrice),
              isActive: variant.isActive,
            })
          } catch {
            failedSkus.push(variant.sku)
          }
        }

        if (failedSkus.length) {
          toast.warning('Variantes parciales', `No se pudieron crear estas variantes: ${failedSkus.join(', ')}`)
        }
      }

      toast.success('Creado', 'Producto creado correctamente')
      router.push({ name: 'products-edit', params: { id: created.id } })
    }
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo guardar'))
  } finally {
    saving.value = false
  }
}

function validateVariant() {
  variantErrors.sku = ''
  variantErrors.sizeId = ''
  variantErrors.colorId = ''
  variantErrors.stock = ''
  variantErrors.additionalPrice = ''

  if (!variantModal.sku.trim()) {
    variantErrors.sku = 'El SKU es requerido'
  }

  if (!variantModal.sizeId) {
    variantErrors.sizeId = 'Selecciona una talla'
  }

  if (!variantModal.colorId) {
    variantErrors.colorId = 'Selecciona un color'
  }

  if (!Number.isFinite(Number(variantModal.stock)) || Number(variantModal.stock) < 0) {
    variantErrors.stock = 'El stock debe ser mayor o igual a 0'
  }

  if (!Number.isFinite(Number(variantModal.additionalPrice)) || Number(variantModal.additionalPrice) < 0) {
    variantErrors.additionalPrice = 'El precio adicional debe ser mayor o igual a 0'
  }

  return (
    !variantErrors.sku &&
    !variantErrors.sizeId &&
    !variantErrors.colorId &&
    !variantErrors.stock &&
    !variantErrors.additionalPrice
  )
}

function validateInitialVariantDraft() {
  initialVariantErrors.sku = ''
  initialVariantErrors.sizeId = ''
  initialVariantErrors.colorId = ''
  initialVariantErrors.stock = ''
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

  if (!Number.isFinite(Number(initialVariantDraft.stock)) || Number(initialVariantDraft.stock) < 0) {
    initialVariantErrors.stock = 'El stock debe ser mayor o igual a 0'
  }

  if (
    !Number.isFinite(Number(initialVariantDraft.additionalPrice)) ||
    Number(initialVariantDraft.additionalPrice) < 0
  ) {
    initialVariantErrors.additionalPrice = 'El precio adicional debe ser mayor o igual a 0'
  }

  return (
    !initialVariantErrors.sku &&
    !initialVariantErrors.sizeId &&
    !initialVariantErrors.colorId &&
    !initialVariantErrors.stock &&
    !initialVariantErrors.additionalPrice
  )
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
    stock: Number(initialVariantDraft.stock),
    additionalPrice: Number(initialVariantDraft.additionalPrice),
    isActive: initialVariantDraft.isActive,
  })

  initialVariantDraft.sku = ''
  initialVariantDraft.sizeId = ''
  initialVariantDraft.colorId = ''
  initialVariantDraft.stock = 0
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

async function addVariant() {
  if (!product.value) return
  if (!validateVariant()) return

  addingVariant.value = true
  try {
    await productsService.createVariant(product.value.id, {
      sku: variantModal.sku,
      sizeId: variantModal.sizeId,
      colorId: variantModal.colorId,
      stock: Number(variantModal.stock),
      additionalPrice: Number(variantModal.additionalPrice),
      isActive: variantModal.isActive,
    })

    toast.success('Variante agregada', 'La variante se creo correctamente')
    variantModal.show = false
    variantModal.sku = ''
    variantModal.sizeId = ''
    variantModal.colorId = ''
    variantModal.stock = 0
    variantModal.additionalPrice = 0
    variantModal.isActive = true
    variantSkuTouched.value = false
    await loadProduct()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo crear la variante'))
  } finally {
    addingVariant.value = false
  }
}

async function removeVariant(variantId: string) {
  if (!product.value) return
  if (!window.confirm('Eliminar esta variante?')) return
  try {
    await productsService.removeVariant(product.value.id, variantId)
    toast.success('Eliminada', 'Variante eliminada')
    await loadProduct()
  } catch {
    toast.error('Error', 'No se pudo eliminar la variante')
  }
}

function onImageFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  imageUpload.file = target.files?.[0] ?? null
}

async function uploadAndAttachImage() {
  if (!product.value) return
  if (!imageUpload.file) {
    toast.warning('Falta archivo', 'Selecciona una imagen para subir')
    return
  }

  uploadingImage.value = true
  try {
    const url = await productsService.uploadImageAsset(imageUpload.file)
    const nextOrder = Math.max(0, ...((product.value.images ?? []).map((img) => img.displayOrder))) + 1

    await productsService.createImage(product.value.id, {
      url,
      altText: imageUpload.altText || undefined,
      isMain: imageUpload.isMain,
      displayOrder: nextOrder,
    })

    toast.success('Imagen agregada', 'La imagen fue asociada al producto')
    imageUpload.file = null
    imageUpload.altText = ''
    imageUpload.isMain = false
    await loadProduct()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo subir la imagen'))
  } finally {
    uploadingImage.value = false
  }
}

async function setAsMain(image: ProductImage) {
  if (!product.value || image.isMain) return

  imageActionLoading.value = image.id
  try {
    await productsService.updateImage(product.value.id, image.id, { isMain: true })
    toast.success('Imagen principal actualizada')
    await loadProduct()
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
    await productsService.removeImage(product.value.id, image.id)
    toast.success('Imagen eliminada')
    await loadProduct()
  } catch {
    toast.error('Error', 'No se pudo eliminar la imagen')
  } finally {
    imageActionLoading.value = null
  }
}

onMounted(async () => {
  try {
    await loadCatalogData()
    await loadProduct()
  } catch {
    toast.error('Error', 'No se pudieron cargar datos iniciales')
  }
})

watch(
  () => [form.basePrice, form.offerPrice, form.offerPercentage, form.hasOffer, form.couponLink],
  () => {
    formErrors.offer = getOfferError()
    formErrors.couponLink = form.couponLink && !isValidCouponLink(form.couponLink)
      ? 'Ingresa un enlace valido (incluye http:// o https://)'
      : ''
  },
  { deep: false },
)

watch(
  () => form.currencyCode,
  (nextCurrencyCode) => {
    const previousCurrencyCode = previousProductCurrencyCode.value
    if (syncingProductCurrencyChange.value) {
      previousProductCurrencyCode.value = nextCurrencyCode
      return
    }

    if (!nextCurrencyCode || !previousCurrencyCode || nextCurrencyCode === previousCurrencyCode) {
      previousProductCurrencyCode.value = nextCurrencyCode
      return
    }

    form.basePrice = convertBetweenCurrencies(Number(form.basePrice), previousCurrencyCode, nextCurrencyCode)
    if (form.hasOffer) {
      form.offerPrice = convertBetweenCurrencies(Number(form.offerPrice), previousCurrencyCode, nextCurrencyCode)
    }

    previousProductCurrencyCode.value = nextCurrencyCode
  },
)

watch(
  () => form.name,
  (value) => {
    if (skuTouched.value) return
    form.sku = normalizeSku(value)
  },
)

watch(
  () => [productSkuPreview.value, initialVariantDraft.sizeId, initialVariantDraft.colorId],
  () => {
    if (initialVariantSkuTouched.value) return
    initialVariantDraft.sku = initialVariantSkuPreview.value
  },
)

watch(
  () => [productSkuPreview.value, variantModal.sizeId, variantModal.colorId],
  () => {
    if (variantSkuTouched.value) return
    variantModal.sku = variantSkuPreview.value
  },
)

function onSkuInput(value: string | number | undefined) {
  skuTouched.value = true
  form.sku = normalizeSku(String(value ?? ''))
  formErrors.sku = form.sku.length < 3 ? 'Ingresa un SKU valido de al menos 3 caracteres' : ''
}

function onInitialVariantSkuInput(value: string | number | undefined) {
  initialVariantSkuTouched.value = true
  initialVariantDraft.sku = normalizeSku(String(value ?? ''))
  initialVariantErrors.sku = initialVariantDraft.sku.length < 3 ? 'El SKU es requerido' : ''
}

function onVariantSkuInput(value: string | number | undefined) {
  variantSkuTouched.value = true
  variantModal.sku = normalizeSku(String(value ?? ''))
  variantErrors.sku = variantModal.sku.length < 3 ? 'El SKU es requerido' : ''
}

function resetSkuFromName() {
  skuTouched.value = false
  form.sku = normalizeSku(form.name)
  formErrors.sku = form.sku.length < 3 ? 'Ingresa un SKU valido de al menos 3 caracteres' : ''
}

function resetInitialVariantSku() {
  initialVariantSkuTouched.value = false
  initialVariantDraft.sku = initialVariantSkuPreview.value
  initialVariantErrors.sku = initialVariantDraft.sku.length < 3 ? 'El SKU es requerido' : ''
}

function resetVariantSku() {
  variantSkuTouched.value = false
  variantModal.sku = variantSkuPreview.value
  variantErrors.sku = variantModal.sku.length < 3 ? 'El SKU es requerido' : ''
}

function normalizeSku(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
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

function isValidCouponLink(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function syncOfferFromPrice() {
  const base = Number(form.basePrice)
  const offer = Number(form.offerPrice)
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(offer)) {
    form.offerPercentage = 0
    return
  }
  const percentage = ((base - offer) / base) * 100
  form.offerPercentage = Number(Math.max(0, Math.min(100, percentage)).toFixed(2))
}

function syncOfferFromPercentage() {
  const base = Number(form.basePrice)
  const percentage = Number(form.offerPercentage)
  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(percentage)) {
    form.offerPrice = 0
    return
  }
  const price = base * (1 - percentage / 100)
  form.offerPrice = Number(Math.max(0, price).toFixed(2))
}

function toggleTag(tagId: string) {
  if (form.tagIds.includes(tagId)) {
    form.tagIds = form.tagIds.filter((id) => id !== tagId)
    return
  }
  form.tagIds.push(tagId)
}

function toggleRecommendationProduct(group: 'related' | 'suggested', productId: string) {
  if (productId === id.value) {
    return
  }

  const activeList = group === 'related' ? form.relatedProductIds : form.suggestedProductIds
  const oppositeList = group === 'related' ? form.suggestedProductIds : form.relatedProductIds

  if (activeList.includes(productId)) {
    if (group === 'related') {
      form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
    } else {
      form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
    }
    return
  }

  if (oppositeList.includes(productId)) {
    if (group === 'related') {
      form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
    } else {
      form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
    }
  }

  if (group === 'related') {
    form.relatedProductIds.push(productId)
  } else {
    form.suggestedProductIds.push(productId)
  }
}

function removeRecommendationProduct(group: 'related' | 'suggested', productId: string) {
  if (group === 'related') {
    form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
    return
  }

  form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
}

function onRecommendationDragStart(group: 'related' | 'suggested', productId: string) {
  recommendationDrag.group = group
  recommendationDrag.productId = productId
}

function onRecommendationDragOver(event: DragEvent) {
  event.preventDefault()
}

function onRecommendationDrop(group: 'related' | 'suggested', targetProductId: string) {
  if (!recommendationDrag.productId || recommendationDrag.group !== group) {
    return
  }

  const list = [...(group === 'related' ? form.relatedProductIds : form.suggestedProductIds)]
  const fromIndex = list.indexOf(recommendationDrag.productId)
  const toIndex = list.indexOf(targetProductId)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    recommendationDrag.group = ''
    recommendationDrag.productId = ''
    return
  }

  const [movedId] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, movedId)

  if (group === 'related') {
    form.relatedProductIds = list
  } else {
    form.suggestedProductIds = list
  }

  recommendationDrag.group = ''
  recommendationDrag.productId = ''
}

function onRecommendationDragEnd() {
  recommendationDrag.group = ''
  recommendationDrag.productId = ''
}

function filterRecommendationProducts(searchValue: string, group: 'related' | 'suggested') {
  const search = searchValue.trim().toLowerCase()
  const excludedIds = new Set([
    id.value,
    ...(group === 'related' ? form.suggestedProductIds : form.relatedProductIds),
  ])
  const baseItems = availableRelatedProducts.value.filter((item) => !excludedIds.has(item.id))

  if (!search) {
    return baseItems.slice(0, 12)
  }

  return baseItems.filter((item) => {
    return [item.name, item.sku, item.slug]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search))
  }).slice(0, 12)
}

function recommendationImage(product: Product) {
  const main = product.images?.find((img) => img.isMain)
  return main?.url || product.images?.[0]?.url || ''
}

function recommendationPrice(product: Product) {
  if (product.hasOffer && product.offerPrice) {
    return fmt(product.offerPrice)
  }

  return fmt(product.basePrice)
}

async function createTagInline() {
  const name = newTagName.value.trim()
  if (!name) {
    toast.warning('Etiqueta vacia', 'Ingresa un nombre para la etiqueta')
    return
  }

  const existing = tags.value.find((tag) => tag.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    if (!form.tagIds.includes(existing.id)) {
      form.tagIds.push(existing.id)
    }
    newTagName.value = ''
    toast.info('Etiqueta existente', 'Se selecciono la etiqueta ya creada')
    return
  }

  creatingTag.value = true
  try {
    const created = await tagsService.create({ name, isActive: true })
    tags.value = [...tags.value, created].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    if (!form.tagIds.includes(created.id)) {
      form.tagIds.push(created.id)
    }
    newTagName.value = ''
    toast.success('Etiqueta creada', `"${created.name}" creada y seleccionada`)
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo crear la etiqueta'))
  } finally {
    creatingTag.value = false
  }
}

function getOfferError() {
  if (!form.hasOffer) return ''

  const base = Number(form.basePrice)
  const price = Number(form.offerPrice)
  const percentage = Number(form.offerPercentage)

  if (!Number.isFinite(base) || base < 0) {
    return 'El precio base debe ser valido para calcular la oferta'
  }

  if (!Number.isFinite(price) || price < 0 || price > base) {
    return 'El precio oferta debe ser mayor o igual a 0 y menor o igual al precio base'
  }

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return 'El porcentaje de oferta debe estar entre 0 y 100'
  }

  const expectedOfferPrice = Number((base * (1 - percentage / 100)).toFixed(2))
  if (Math.abs(expectedOfferPrice - price) > 0.01) {
    return 'El precio oferta no coincide con el porcentaje respecto al precio base'
  }

  return ''
}

function couponValueLabel(coupon: Coupon) {
  if (coupon.type === CouponType.PERCENTAGE) {
    return `${coupon.value}%`
  }
  return fmt(coupon.value, coupon.currencyCode)
}

function couponTypeLabel(coupon: Coupon) {
  return coupon.type === CouponType.PERCENTAGE ? 'Porcentaje' : 'Monto fijo'
}


function fmt(n: number | string, currencyCode = form.currencyCode || getSystemCurrencyCode()) {
  return formatMoney(n, currencyCode)
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div class="xl:col-span-2 space-y-6">
        <UiCard :title="isEdit ? 'Editar producto' : 'Nuevo producto'">
          <form class="space-y-6" @submit.prevent="save">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UiInput
                v-model="form.name"
                label="Nombre"
                required
                placeholder="Remera Oversize"
                :error="formErrors.name"
                hint="Usa un nombre claro para busqueda y catalogo"
              />

              <div class="space-y-2">
                <UiInput
                  :model-value="form.sku"
                  label="SKU del producto"
                  required
                  placeholder="REMERA-OVERSIZE-NEGRA"
                  :error="formErrors.sku"
                  hint="Identificador unico del producto"
                  @update:model-value="onSkuInput"
                />
                <div class="flex items-center justify-between gap-3 text-xs text-[--color-surface-500]">
                  <span>Vista previa: {{ productSkuPreview || 'SIN-SKU' }}</span>
                  <button type="button" class="font-medium text-[--color-primary-700] hover:text-[--color-primary-800]" @click="resetSkuFromName">
                    Regenerar desde el nombre
                  </button>
                </div>
              </div>

              <UiSelect
                v-model="form.categoryId"
                label="Categoria"
                required
                :options="categories.map(c => ({ value: c.id, label: c.name }))"
                placeholder="Seleccionar categoria"
                :error="formErrors.categoryId"
              />

              <UiInput
                v-model="form.basePrice"
                type="number"
                min="0"
                step="0.01"
                label="Precio base"
                required
                :error="formErrors.basePrice"
                :hint="`Vista previa: ${basePricePreview}`"
              />

              <UiSelect
                v-model="form.currencyCode"
                label="Moneda"
                :options="currencies.map(c => ({ value: c.code, label: `${c.code} (${c.symbol})` }))"
                placeholder="Seleccionar moneda"
              />

              <div class="rounded-xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 space-y-2">
                <p class="text-caption">Conversion sugerida</p>
                <p class="text-sm text-[--color-surface-700]">
                  Precio en moneda del producto: <strong>{{ fmt(form.basePrice, form.currencyCode) }}</strong>
                </p>
                <p class="text-sm text-[--color-surface-700]">
                  Equivalente en moneda default ({{ defaultCurrencyName }}):
                  <strong>{{ fmt(basePriceInDefaultCurrency, defaultCurrencyCode) }}</strong>
                </p>
                <p v-if="form.hasOffer" class="text-sm text-[--color-surface-700]">
                  Oferta equivalente en moneda default:
                  <strong>{{ fmt(offerPriceInDefaultCurrency, defaultCurrencyCode) }}</strong>
                </p>
              </div>

              <div class="rounded-xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 space-y-3">
                <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
                  <input v-model="form.hasOffer" type="checkbox" class="accent-[--color-primary-600]" />
                  Producto con oferta
                </label>

                <div v-if="form.hasOffer" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UiInput
                    v-model="form.offerPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    label="Precio oferta"
                    :hint="`Vista previa: ${offerPricePreview}`"
                    :error="formErrors.offer"
                    @input="syncOfferFromPrice"
                  />
                  <UiInput
                    v-model="form.offerPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    label="Porcentaje oferta"
                    hint="Se calcula en base al precio normal"
                    :error="formErrors.offer"
                    @input="syncOfferFromPercentage"
                  />
                </div>

                <p v-if="form.hasOffer" class="text-xs text-[--color-surface-600]">
                  Ahorro estimado por unidad: {{ fmt(offerDelta) }}
                </p>
              </div>

              <div class="rounded-xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 space-y-2">
                <p class="text-caption">Resumen rapido</p>
                <p class="text-sm text-[--color-surface-700]">
                  Slug estimado: <span class="font-mono text-xs">{{ slugPreview || 'sin-slug' }}</span>
                </p>
                <p class="text-sm text-[--color-surface-700]">
                  SKU: <span class="font-mono text-xs">{{ productSkuPreview || 'sin-sku' }}</span>
                </p>
                <p class="text-sm text-[--color-surface-700]">
                  Categoria: <strong>{{ selectedCategory?.name ?? 'Sin seleccionar' }}</strong>
                </p>
                <p class="text-sm text-[--color-surface-700]">
                  Cupon: <strong>{{ selectedCoupon?.code ?? 'Sin cupon seleccionado' }}</strong>
                </p>
              </div>

              <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="flex items-center gap-2 text-sm text-[--color-surface-700] rounded-xl border border-[--color-surface-200] px-4 py-3">
                  <input v-model="form.isActive" type="checkbox" class="accent-[--color-primary-600]" />
                  Publicar producto (Activo/Desactivo)
                </label>

                <label class="flex items-center gap-2 text-sm text-[--color-surface-700] rounded-xl border border-[--color-surface-200] px-4 py-3">
                  <input v-model="form.isFeatured" type="checkbox" class="accent-[--color-primary-600]" />
                  Marcar como destacado
                </label>
              </div>

              <div class="lg:col-span-2">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-[--color-surface-700]">Descripcion</label>
                  <div class="rounded-xl border border-[--color-surface-200] bg-white overflow-hidden">
                    <RichTextEditor
                      v-model:content="form.description"
                      contentType="html"
                      theme="snow"
                      :toolbar="editorToolbar"
                      placeholder="Detalles del producto, composicion, fit, recomendaciones de uso..."
                    />
                  </div>
                  <p class="text-xs text-[--color-surface-500]">{{ descriptionLength }} caracteres</p>
                </div>
              </div>

              <div class="lg:col-span-2 space-y-2">
                <p class="text-sm font-medium text-[--color-surface-700]">Cupon para este producto</p>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <UiSelect
                    v-model="form.couponId"
                    label="Seleccionar cupon"
                    :options="[{ value: '', label: 'Sin cupon' }, ...coupons.map(c => ({ value: c.id, label: `${c.code} (${c.type === CouponType.PERCENTAGE ? `${c.value}%` : fmt(c.value, c.currencyCode)})` }))]"
                    placeholder="Elegir cupon"
                    hint="Puedes aplicar un cupon especifico al producto"
                  />
                  <UiInput
                    v-model="form.couponLink"
                    label="Enlace a cupon"
                    placeholder="https://tu-tienda.com/cupones/SUMMER20"
                    :error="formErrors.couponLink"
                    hint="Opcional: URL para compartir el cupon con el cliente"
                  />
                </div>

                <div v-if="selectedCoupon" class="rounded-xl border border-[--color-primary-200] bg-[--color-primary-50] p-4 space-y-2">
                  <p class="text-sm font-semibold text-[--color-primary-800]">Detalle del cupon seleccionado</p>
                  <p class="text-sm text-[--color-surface-800]">
                    <strong>{{ selectedCoupon.code }}</strong> - {{ couponTypeLabel(selectedCoupon) }}
                  </p>
                  <p class="text-sm text-[--color-surface-700]">
                    Descuento: <strong>{{ couponValueLabel(selectedCoupon) }}</strong>
                  </p>
                  <p class="text-sm text-[--color-surface-700]">
                    Compra minima: <strong>{{ fmt(selectedCoupon.minOrderAmount, selectedCoupon.currencyCode) }}</strong>
                  </p>
                  <p class="text-sm text-[--color-surface-700]">
                    Vigencia: <strong>{{ selectedCoupon.startDate ? selectedCoupon.startDate.slice(0, 10) : 'Sin inicio' }}</strong>
                    a
                    <strong>{{ selectedCoupon.endDate ? selectedCoupon.endDate.slice(0, 10) : 'Sin fin' }}</strong>
                  </p>
                  <p class="text-sm text-[--color-surface-700]">
                    Estado: <strong>{{ selectedCoupon.isActive ? 'Activo' : 'Inactivo' }}</strong>
                  </p>
                </div>
              </div>

              <div v-if="!isEdit" class="lg:col-span-2 space-y-3">
                <p class="text-sm font-medium text-[--color-surface-700]">Tallas y colores iniciales</p>
                <p class="text-xs text-[--color-surface-500]">
                  Agrega variantes (talla + color) para que se creen automaticamente al guardar el producto.
                </p>

                <div class="rounded-xl border border-[--color-surface-200] p-4 space-y-4 bg-[--color-surface-50]">
                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <UiInput
                      :model-value="initialVariantDraft.sku"
                      label="SKU"
                      placeholder="SKU-REM-BLK-M"
                      :error="initialVariantErrors.sku"
                      @update:model-value="onInitialVariantSkuInput"
                    />
                    <UiSelect
                      v-model="initialVariantDraft.sizeId"
                      label="Talla"
                      :options="sizes.map(s => ({ value: s.id, label: s.name }))"
                      placeholder="Seleccionar talla"
                      :error="initialVariantErrors.sizeId"
                    />
                    <UiSelect
                      v-model="initialVariantDraft.colorId"
                      label="Color"
                      :options="colors.map(c => ({ value: c.id, label: c.name }))"
                      placeholder="Seleccionar color"
                      :error="initialVariantErrors.colorId"
                    />
                  </div>

                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <UiInput
                      v-model="initialVariantDraft.stock"
                      type="number"
                      min="0"
                      label="Stock inicial"
                      :error="initialVariantErrors.stock"
                    />
                    <UiInput
                      v-model="initialVariantDraft.additionalPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      label="Precio adicional"
                      :error="initialVariantErrors.additionalPrice"
                    />
                    <div class="flex items-end">
                      <label class="flex items-center gap-2 text-sm text-[--color-surface-700] rounded-xl border border-[--color-surface-200] px-3 py-2 w-full">
                        <input v-model="initialVariantDraft.isActive" type="checkbox" class="accent-[--color-primary-600]" />
                        Variante activa
                      </label>
                    </div>
                  </div>

                  <div class="flex items-center justify-between gap-3 text-xs text-[--color-surface-500]">
                    <span>Sugerido: {{ initialVariantSkuPreview || 'SIN-SKU' }}</span>
                    <button type="button" class="font-medium text-[--color-primary-700] hover:text-[--color-primary-800]" @click="resetInitialVariantSku">
                      Usar sugerencia
                    </button>
                  </div>

                  <div class="flex justify-end">
                    <UiButton type="button" size="sm" @click="addInitialVariant">Agregar talla/color</UiButton>
                  </div>

                  <div>
                    <UiTable :data="initialVariants" compact empty-message="Aun no agregaste variantes iniciales">
                      <template #head>
                        <tr>
                          <th class="table-th">SKU</th>
                          <th class="table-th">Talla</th>
                          <th class="table-th">Color</th>
                          <th class="table-th text-center">Stock</th>
                          <th class="table-th text-right">Precio adicional</th>
                          <th class="table-th text-center">Estado</th>
                          <th class="table-th table-actions-th" />
                        </tr>
                      </template>

                      <tr v-for="(item, index) in initialVariants" :key="item.sku" class="table-tr-hover">
                        <td class="table-td font-mono text-xs">{{ item.sku }}</td>
                        <td class="table-td">{{ sizeNameById(item.sizeId) }}</td>
                        <td class="table-td">{{ colorNameById(item.colorId) }}</td>
                        <td class="table-td text-center">{{ item.stock }}</td>
                        <td class="table-td text-right">{{ fmt(item.additionalPrice) }}</td>
                        <td class="table-td text-center">
                          <UiBadge :color="item.isActive ? 'success' : 'neutral'" dot>
                            {{ item.isActive ? 'Activo' : 'Desactivo' }}
                          </UiBadge>
                        </td>
                        <td class="table-td table-actions-td text-right">
                          <UiButton type="button" variant="danger" size="sm" @click="removeInitialVariant(index)">
                            Quitar
                          </UiButton>
                        </td>
                      </tr>
                    </UiTable>
                  </div>
                </div>
              </div>

              <div class="lg:col-span-2 space-y-2">
                <p class="text-sm font-medium text-[--color-surface-700]">Etiquetas (tags)</p>

                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <UiInput
                    v-model="newTagName"
                    placeholder="Crear nueva etiqueta..."
                    hint="Presiona Enter o haz click en Crear"
                    @keyup.enter="createTagInline"
                  />
                  <UiButton
                    size="sm"
                    :loading="creatingTag"
                    :disabled="!newTagName.trim()"
                    @click="createTagInline"
                  >
                    Crear tag
                  </UiButton>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tag in tags"
                    :key="tag.id"
                    type="button"
                    class="px-3 py-1.5 rounded-full border text-sm transition-colors"
                    :class="form.tagIds.includes(tag.id)
                      ? 'bg-[--color-primary-600] text-white border-[--color-primary-600]'
                      : 'bg-white text-[--color-surface-700] border-[--color-surface-300] hover:border-[--color-primary-400]'"
                    @click="toggleTag(tag.id)"
                  >
                    {{ tag.name }}
                  </button>
                  <span v-if="!tags.length" class="text-xs text-[--color-surface-500]">No hay tags activos disponibles</span>
                </div>
              </div>

              <div class="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div class="rounded-xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 space-y-3">
                  <div>
                    <p class="text-sm font-medium text-[--color-surface-700]">Productos relacionados</p>
                    <p class="text-xs text-[--color-surface-500]">Se muestran como productos similares o complementarios.</p>
                  </div>

                  <UiInput
                    v-model="relatedProductSearch"
                    placeholder="Buscar relacionados por nombre, SKU o slug..."
                  />

                  <div v-if="selectedRelatedProducts.length" class="space-y-2">
                    <div
                      v-for="(related, index) in selectedRelatedProducts"
                      :key="related.id"
                      class="flex items-center justify-between gap-3 rounded-xl border border-[--color-primary-200] bg-white px-3 py-2 cursor-move"
                      draggable="true"
                      @dragstart="onRecommendationDragStart('related', related.id)"
                      @dragover="onRecommendationDragOver"
                      @drop="onRecommendationDrop('related', related.id)"
                      @dragend="onRecommendationDragEnd"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-[--color-surface-100] shrink-0">
                          <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-[--color-surface-900] truncate">{{ index + 1 }}. {{ related.name }}</p>
                          <p class="text-xs font-mono text-[--color-surface-500] truncate">{{ related.sku }}</p>
                          <p class="text-xs text-[--color-surface-700]">{{ recommendationPrice(related) }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <span class="text-xs text-[--color-surface-500]">Arrastra</span>
                        <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('related', related.id)">Quitar</UiButton>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="related in filteredRelatedProducts"
                      :key="related.id"
                      type="button"
                      class="rounded-xl border border-[--color-surface-200] bg-white px-4 py-3 text-left hover:border-[--color-primary-300]"
                      @click="toggleRecommendationProduct('related', related.id)"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-[--color-surface-100] shrink-0">
                          <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-[--color-surface-900] truncate">{{ related.name }}</p>
                          <p class="text-xs font-mono text-[--color-surface-500] truncate">{{ related.sku }}</p>
                          <p class="text-xs text-[--color-surface-700]">{{ recommendationPrice(related) }}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p v-if="!filteredRelatedProducts.length" class="text-xs text-[--color-surface-500]">
                    No hay más productos disponibles para relacionados.
                  </p>
                </div>

                <div class="rounded-xl border border-[--color-surface-200] bg-[--color-surface-50] p-4 space-y-3">
                  <div>
                    <p class="text-sm font-medium text-[--color-surface-700]">Productos sugeridos</p>
                    <p class="text-xs text-[--color-surface-500]">Se pueden priorizar para recomendaciones destacadas.</p>
                  </div>

                  <UiInput
                    v-model="suggestedProductSearch"
                    placeholder="Buscar sugeridos por nombre, SKU o slug..."
                  />

                  <div v-if="selectedSuggestedProducts.length" class="space-y-2">
                    <div
                      v-for="(suggested, index) in selectedSuggestedProducts"
                      :key="suggested.id"
                      class="flex items-center justify-between gap-3 rounded-xl border border-[--color-primary-200] bg-white px-3 py-2 cursor-move"
                      draggable="true"
                      @dragstart="onRecommendationDragStart('suggested', suggested.id)"
                      @dragover="onRecommendationDragOver"
                      @drop="onRecommendationDrop('suggested', suggested.id)"
                      @dragend="onRecommendationDragEnd"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-[--color-surface-100] shrink-0">
                          <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-[--color-surface-900] truncate">{{ index + 1 }}. {{ suggested.name }}</p>
                          <p class="text-xs font-mono text-[--color-surface-500] truncate">{{ suggested.sku }}</p>
                          <p class="text-xs text-[--color-surface-700]">{{ recommendationPrice(suggested) }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <span class="text-xs text-[--color-surface-500]">Arrastra</span>
                        <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('suggested', suggested.id)">Quitar</UiButton>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="suggested in filteredSuggestedProducts"
                      :key="suggested.id"
                      type="button"
                      class="rounded-xl border border-[--color-surface-200] bg-white px-4 py-3 text-left hover:border-[--color-primary-300]"
                      @click="toggleRecommendationProduct('suggested', suggested.id)"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-[--color-surface-100] shrink-0">
                          <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-[--color-surface-900] truncate">{{ suggested.name }}</p>
                          <p class="text-xs font-mono text-[--color-surface-500] truncate">{{ suggested.sku }}</p>
                          <p class="text-xs text-[--color-surface-700]">{{ recommendationPrice(suggested) }}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p v-if="!filteredSuggestedProducts.length" class="text-xs text-[--color-surface-500]">
                    No hay más productos disponibles para sugeridos.
                  </p>
                </div>
              </div>
            </div>

            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <UiButton variant="secondary" @click="router.push({ name: 'products' })">
                Cancelar
              </UiButton>
              <UiButton type="submit" :loading="saving" :disabled="!canSave">
                {{ isEdit ? 'Guardar cambios' : 'Crear producto' }}
              </UiButton>
            </div>
          </form>
        </UiCard>

        <UiCard v-if="isEdit && product" title="Variantes">
          <template #default>
            <div class="flex justify-end mb-4">
              <UiButton @click="variantModal.show = true">Agregar variante</UiButton>
            </div>

            <div class="-mx-6 -mb-6">
              <UiTable :data="product.variants" compact :empty="!product.variants.length" empty-message="No hay variantes cargadas">
                <template #head>
                  <tr>
                    <th class="table-th">SKU</th>
                    <th class="table-th">Talla</th>
                    <th class="table-th">Color</th>
                    <th class="table-th text-right">Precio final</th>
                    <th class="table-th text-center">Stock</th>
                    <th class="table-th text-center">Estado</th>
                    <th class="table-th table-actions-th" />
                  </tr>
                </template>

                <tr v-for="v in product.variants" :key="v.id" class="table-tr-hover">
                  <td class="table-td font-mono text-xs">{{ v.sku }}</td>
                  <td class="table-td">{{ v.size.name }}</td>
                  <td class="table-td">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full border border-[--color-surface-300]" :style="{ backgroundColor: v.color.hexCode }" />
                      {{ v.color.name }}
                    </div>
                  </td>
                  <td class="table-td text-right">{{ fmt(Number(form.basePrice) + Number(v.additionalPrice)) }}</td>
                  <td class="table-td text-center">{{ v.stock }}</td>
                  <td class="table-td text-center">
                    <UiBadge :color="v.isActive ? 'success' : 'neutral'" dot>
                      {{ v.isActive ? 'Activo' : 'Desactivo' }}
                    </UiBadge>
                  </td>
                  <td class="table-td table-actions-td text-right">
                    <UiButton variant="danger" size="sm" @click="removeVariant(v.id)">Eliminar</UiButton>
                  </td>
                </tr>
              </UiTable>
            </div>
          </template>
        </UiCard>
      </div>

      <div class="space-y-6">
        <UiCard title="Estado del formulario">
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-[--color-surface-600]">Nombre</span>
              <UiBadge :color="form.name.trim().length >= 3 ? 'success' : 'warning'" dot>
                {{ form.name.trim().length >= 3 ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[--color-surface-600]">Categoria</span>
              <UiBadge :color="form.categoryId ? 'success' : 'warning'" dot>
                {{ form.categoryId ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[--color-surface-600]">SKU</span>
              <UiBadge :color="form.sku.trim().length >= 3 ? 'success' : 'warning'" dot>
                {{ form.sku.trim().length >= 3 ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[--color-surface-600]">Precio</span>
              <UiBadge :color="Number(form.basePrice) >= 0 ? 'success' : 'warning'" dot>
                {{ Number(form.basePrice) >= 0 ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="divider" />
            <p class="text-xs text-[--color-surface-500]">
              Tip: crea primero el producto y luego agrega variantes e imagenes.
            </p>
          </div>
        </UiCard>

        <UiCard title="Imagenes del producto">
          <div v-if="!isEdit || !product" class="text-sm text-[--color-surface-600]">
            Este bloque se habilita cuando el producto ya fue creado.
          </div>

          <div v-else class="space-y-4">
            <input type="file" accept="image/*" class="input-base" @change="onImageFileSelected" />
            <UiInput v-model="imageUpload.altText" label="Texto alternativo" placeholder="Opcional" />
            <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
              <input v-model="imageUpload.isMain" type="checkbox" class="accent-[--color-primary-600]" />
              Marcar como principal
            </label>
            <UiButton :loading="uploadingImage" :disabled="!imageUpload.file" @click="uploadAndAttachImage">
              Subir y asociar imagen
            </UiButton>

            <div class="divider" />

            <UiEmptyState v-if="!sortedImages.length" title="Sin imágenes cargadas" compact />

            <div v-else class="grid grid-cols-2 gap-2">
              <div
                v-for="img in sortedImages"
                :key="img.id"
                class="aspect-square rounded-lg overflow-hidden bg-[--color-surface-100] relative group"
              >
                <img :src="img.url" :alt="img.altText ?? form.name" class="w-full h-full object-cover" />

                <span v-if="img.isMain" class="absolute top-1 left-1 badge-base bg-[--color-primary-600] text-white text-xs">
                  Principal
                </span>

                <div class="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <UiButton
                    size="sm"
                    variant="secondary"
                    class="flex-1"
                    :disabled="img.isMain || imageActionLoading === img.id"
                    @click="setAsMain(img)"
                  >
                    Principal
                  </UiButton>
                  <UiButton
                    size="sm"
                    variant="danger"
                    class="flex-1"
                    :loading="imageActionLoading === img.id"
                    @click="removeImage(img)"
                  >
                    Borrar
                  </UiButton>
                </div>
              </div>
            </div>
          </div>
        </UiCard>
      </div>
    </div>

    <UiModal :show="variantModal.show" title="Nueva variante" @close="variantModal.show = false">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput
          :model-value="variantModal.sku"
          label="SKU"
          required
          placeholder="SKU-TSHIRT-BLK-M"
          :error="variantErrors.sku"
          @update:model-value="onVariantSkuInput"
        />
        <UiInput
          v-model="variantModal.stock"
          type="number"
          min="0"
          label="Stock"
          required
          :error="variantErrors.stock"
        />

        <UiSelect
          v-model="variantModal.sizeId"
          label="Talla"
          required
          :options="sizes.map(s => ({ value: s.id, label: s.name }))"
          placeholder="Seleccionar talla"
          :error="variantErrors.sizeId"
        />

        <UiSelect
          v-model="variantModal.colorId"
          label="Color"
          required
          :options="colors.map(c => ({ value: c.id, label: c.name }))"
          placeholder="Seleccionar color"
          :error="variantErrors.colorId"
        />

        <div class="md:col-span-2 flex items-center justify-between gap-3 text-xs text-[--color-surface-500]">
          <span>Sugerido: {{ variantSkuPreview || 'SIN-SKU' }}</span>
          <button type="button" class="font-medium text-[--color-primary-700] hover:text-[--color-primary-800]" @click="resetVariantSku">
            Usar sugerencia
          </button>
        </div>

        <UiInput
          v-model="variantModal.additionalPrice"
          type="number"
          min="0"
          step="0.01"
          label="Precio adicional"
          hint="Se suma al precio base del producto"
          :error="variantErrors.additionalPrice"
        />

        <div class="flex items-center pt-7">
          <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
            <input v-model="variantModal.isActive" type="checkbox" class="accent-[--color-primary-600]" />
            Activo
          </label>
        </div>
      </div>

      <template #footer>
        <FormModalActions
          :loading="addingVariant"
          save-label="Guardar variante"
          @cancel="variantModal.show = false"
          @save="addVariant"
        />
      </template>
    </UiModal>
  </div>
</template>
