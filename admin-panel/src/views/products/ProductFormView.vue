<script setup lang="ts">
import { reactive, ref, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { couponsService } from '@/services/coupons.service'
import { currenciesService } from '@/services/currencies.service'
import { categoriesService, sizesService, colorsService, tagsService, measurementUnitsService } from '@/services/catalog.service'
import { extractErrorMessage } from '@/utils/error'
import { CouponType } from '@/types/api'
import type {
  Product,
  Category,
  Size,
  Color,
  MeasurementUnit,
  ProductImage,
  Tag,
  Coupon,
  Currency,
  CategoryAttributeDefinition,
} from '@/types/api'
import { normalizeApiList } from '@/utils/api-list'
import { formatMoney } from '@/utils/currency'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import UiCard from '@/components/ui/UiCard.vue'
import UiFileInput from '@/components/ui/UiFileInput.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiTable from '@/components/ui/UiTable.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import { useToast } from '@/composables/useToast'
import { inferMeasurementUnitFamily, suggestMeasurementUnits } from '@/utils/measurement-units'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const saving = ref(false)
const uploadingImage = ref(false)
const imageActionLoading = ref<string | null>(null)

const categories = ref<Category[]>([])
const sizes = ref<Size[]>([])
const colors = ref<Color[]>([])
const currencies = ref<Currency[]>([])
const tags = ref<Tag[]>([])
const measurementUnits = ref<MeasurementUnit[]>([])
const coupons = ref<Coupon[]>([])
const availableRelatedProducts = ref<Product[]>([])
const creatingTag = ref(false)
const newTagName = ref('')
const skuTouched = ref(false)
const initialVariantSkuTouched = ref(false)

const form = reactive({
  name: '',
  sku: '',
  description: '',
  graphicDescription: '',
  usageMode: '',
  basePrice: 0,
  currencyCode: getSystemCurrencyCode(),
  stock: 0,
  weightValue: '' as number | string,
  weightUnit: 'kg',
  lengthValue: '' as number | string,
  widthValue: '' as number | string,
  heightValue: '' as number | string,
  dimensionUnit: 'cm',
  couponId: '',
  couponLink: '',
  hasOffer: false,
  offerPrice: 0,
  offerPercentage: 0,
  categoryId: '',
  tagIds: [] as string[],
  variantProductIds: [] as string[],
  relatedProductIds: [] as string[],
  suggestedProductIds: [] as string[],
  attributeValues: {} as Record<string, string | number | boolean>,
  isActive: true,
  isFeatured: false,
})

const relatedProductSearch = ref('')
const suggestedProductSearch = ref('')
const variantProductSearch = ref('')
const recommendationDrag = reactive({
  group: '' as '' | 'related' | 'suggested',
  productId: '',
})

const variantImageModal = reactive({
  show: false,
  productId: '',
  file: null as File | null,
  altText: '',
  isMain: false,
  loading: false,
  actionLoading: null as string | null,
})

const formErrors = reactive({
  name: '',
  sku: '',
  categoryId: '',
  basePrice: '',
  stock: '',
  offer: '',
  couponLink: '',
})

const product = ref<Product | null>(null)

type InitialVariantDraft = {
  sku: string
  sizeId: string
  colorId: string
  additionalPrice: number
  isActive: boolean
}

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

const imageUpload = reactive({
  files: [] as Array<{ id: string; file: File; displayOrder: number; altText: string }>,
  markFirstAsMain: false,
})
const savingImageOrder = ref(false)
const pendingImageDragId = ref('')
const existingImageDragId = ref('')
const existingImageOrder = ref<string[]>([])

const fallbackWeightUnitOptions = [
  { value: 'mcg', label: 'Microgramos (mcg)' },
  { value: 'mg', label: 'Miligramos (mg)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'oz', label: 'Onzas (oz)' },
  { value: 'st', label: 'Stone (st)' },
  { value: 't', label: 'Toneladas (t)' },
]

const fallbackDimensionUnitOptions = [
  { value: 'mm', label: 'Milímetros (mm)' },
  { value: 'cm', label: 'Centímetros (cm)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'km', label: 'Kilómetros (km)' },
  { value: 'in', label: 'Pulgadas (in)' },
  { value: 'ft', label: 'Pies (ft)' },
  { value: 'yd', label: 'Yardas (yd)' },
  { value: 'mi', label: 'Millas (mi)' },
]

function toUnitOptions(units: MeasurementUnit[]) {
  return units.map((unit) => ({ value: unit.code, label: `${unit.label} (${unit.code})` }))
}

function includeCurrentUnit(
  options: Array<{ value: string; label: string }>,
  currentValue: string,
  fallbackLabel: string,
) {
  const normalized = currentValue.trim().toLowerCase()
  if (!normalized) {
    return options
  }
  if (options.some((option) => option.value === normalized)) {
    return options
  }
  return [{ value: normalized, label: `${fallbackLabel} (${normalized})` }, ...options]
}

const activeMeasurementUnits = computed(() => measurementUnits.value.filter((unit) => unit.isActive))

const weightUnitOptions = computed(() => {
  const units = activeMeasurementUnits.value.filter((unit) => unit.family === 'weight')
  const baseOptions = units.length ? toUnitOptions(units) : fallbackWeightUnitOptions
  return includeCurrentUnit(baseOptions, String(form.weightUnit ?? ''), 'Unidad actual')
})

const dimensionUnitOptions = computed(() => {
  const units = activeMeasurementUnits.value.filter((unit) => unit.family === 'length')
  const baseOptions = units.length ? toUnitOptions(units) : fallbackDimensionUnitOptions
  return includeCurrentUnit(baseOptions, String(form.dimensionUnit ?? ''), 'Unidad actual')
})

const selectedCategory = computed(() => categories.value.find((c) => c.id === form.categoryId) ?? null)
const categorySupportsSizeColorVariants = computed(() => selectedCategory.value?.supportsSizeColorVariants ?? true)
const categorySupportsDimensions = computed(() => selectedCategory.value?.supportsDimensions ?? false)
const categorySupportsWeight = computed(() => selectedCategory.value?.supportsWeight ?? false)
const selectedCategoryAttributeDefinitions = computed(() =>
  [...(selectedCategory.value?.attributeDefinitions ?? [])]
    .filter((definition) => definition.isActive !== false)
    .sort((left, right) => left.displayOrder - right.displayOrder),
)
const selectedCoupon = computed(() => coupons.value.find((coupon) => coupon.id === form.couponId) ?? null)
const selectedRelatedProducts = computed(() =>
  form.relatedProductIds
    .map((relatedId) => availableRelatedProducts.value.find((item) => item.id === relatedId) ?? null)
    .filter((item): item is Product => item !== null),
)
const selectedVariantProducts = computed(() =>
  form.variantProductIds
    .map((variantId) => availableRelatedProducts.value.find((item) => item.id === variantId) ?? null)
    .filter((item): item is Product => item !== null),
)
const selectedSuggestedProducts = computed(() =>
  form.suggestedProductIds
    .map((suggestedId) => availableRelatedProducts.value.find((item) => item.id === suggestedId) ?? null)
    .filter((item): item is Product => item !== null),
)
const filteredRelatedProducts = computed(() => filterRecommendationProducts(relatedProductSearch.value, 'related'))
const filteredSuggestedProducts = computed(() => filterRecommendationProducts(suggestedProductSearch.value, 'suggested'))
const filteredVariantProducts = computed(() => filterRecommendationProducts(variantProductSearch.value, 'variant'))
const descriptionLength = computed(() => form.description.trim().length)
const graphicDescriptionLength = computed(() => form.graphicDescription.trim().length)
const usageModeLength = computed(() => form.usageMode.trim().length)
const slugPreview = computed(() => slugify(form.name))
const productSkuPreview = computed(() => normalizeSku(form.sku || form.name))
const initialVariantSkuPreview = computed(() =>
  buildVariantSkuSuggestion(productSkuPreview.value, initialVariantDraft.sizeId, initialVariantDraft.colorId),
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
const hasShippingProfile = computed(() => {
  return (
    Number(form.weightValue || 0) > 0 ||
    Number(form.lengthValue || 0) > 0 ||
    Number(form.widthValue || 0) > 0 ||
    Number(form.heightValue || 0) > 0
  )
})
const activeAttributeCount = computed(() => selectedCategoryAttributeDefinitions.value.length)
const canSave = computed(() => {
  return (
    form.name.trim().length >= 3 &&
    form.sku.trim().length >= 3 &&
    !!form.categoryId &&
    Number.isFinite(Number(form.basePrice)) &&
    Number(form.basePrice) >= 0 &&
    Number.isFinite(Number(form.stock)) &&
    Number(form.stock) >= 0 &&
    (!form.hasOffer || (!formErrors.offer && Number(form.offerPrice) >= 0)) &&
    !formErrors.couponLink &&
    !formErrors.sku
  )
})

const sortedImages = computed(() => {
  const items = product.value?.images ?? []
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder)
})

const selectedVariantForImage = computed(() =>
  availableRelatedProducts.value.find((item) => item.id === variantImageModal.productId) ?? null,
)

const variantSortedImages = computed(() => {
  const items = selectedVariantForImage.value?.images ?? []
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
  const [cats, sz, cl, cc, tg, mu, cp, productsData] = await Promise.all([
    categoriesService.list(),
    sizesService.list(),
    colorsService.list(),
    currenciesService.list(),
    tagsService.list(),
    measurementUnitsService.list(),
    couponsService.list(),
    productsService.list({ page: 1, limit: 100 }),
  ])
  categories.value = cats
  sizes.value = sz
  colors.value = cl
  currencies.value = cc.filter((item) => item.isActive)
  tags.value = tg.filter((item) => item.isActive)
  measurementUnits.value = [...mu].sort((a, b) => {
    if (a.family !== b.family) {
      return a.family.localeCompare(b.family, 'es')
    }
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder
    }
    return a.label.localeCompare(b.label, 'es')
  })
  coupons.value = cp.sort((a, b) => a.code.localeCompare(b.code, 'es'))
  availableRelatedProducts.value = normalizeApiList(productsData).items.sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const firstWeightOption = weightUnitOptions.value[0]?.value
  if (firstWeightOption && !weightUnitOptions.value.some((option) => option.value === form.weightUnit)) {
    form.weightUnit = firstWeightOption
  }

  const firstDimensionOption = dimensionUnitOptions.value[0]?.value
  if (firstDimensionOption && !dimensionUnitOptions.value.some((option) => option.value === form.dimensionUnit)) {
    form.dimensionUnit = firstDimensionOption
  }

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
    form.graphicDescription = p.graphicDescription ?? ''
    form.usageMode = p.usageMode ?? ''
    form.basePrice = Number(p.basePrice)
    form.currencyCode = p.currencyCode || getSystemCurrencyCode()
    form.stock = Number(p.stock ?? 0)
    form.weightValue = p.weightValue ? Number(p.weightValue) : ''
    form.weightUnit = p.weightUnit ?? 'kg'
    form.lengthValue = p.lengthValue ? Number(p.lengthValue) : ''
    form.widthValue = p.widthValue ? Number(p.widthValue) : ''
    form.heightValue = p.heightValue ? Number(p.heightValue) : ''
    form.dimensionUnit = p.dimensionUnit ?? 'cm'
    form.couponId = p.coupon?.id ?? ''
    form.couponLink = p.couponLink ?? ''
    form.hasOffer = p.hasOffer
    form.offerPrice = Number(p.offerPrice ?? 0)
    form.offerPercentage = Number(p.offerPercentage ?? 0)
    form.categoryId = p.category?.id ?? ''
    form.tagIds = p.tags?.map((t) => t.id) ?? []
    form.variantProductIds = p.variantProducts?.map((item) => item.id) ?? []
    form.relatedProductIds = p.relatedProducts?.map((item) => item.id) ?? []
    form.suggestedProductIds = p.suggestedProducts?.map((item) => item.id) ?? []
    form.attributeValues = mapAttributeValuesToForm(p.attributeValues ?? [])
    form.isActive = p.isActive
    form.isFeatured = p.isFeatured
    previousProductCurrencyCode.value = form.currencyCode
    syncingProductCurrencyChange.value = false

    availableRelatedProducts.value = [
      ...availableRelatedProducts.value,
      ...(p.relatedProducts ?? []),
      ...(p.suggestedProducts ?? []),
      ...(p.variantProducts ?? []),
    ]
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
  formErrors.stock = ''
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

  if (!Number.isFinite(Number(form.stock)) || Number(form.stock) < 0) {
    formErrors.stock = 'Ingresa un stock valido mayor o igual a 0'
  }

  if (form.couponLink && !isValidCouponLink(form.couponLink)) {
    formErrors.couponLink = 'Ingresa un enlace valido (incluye http:// o https://)'
  }

  formErrors.offer = getOfferError()

  return !formErrors.name && !formErrors.categoryId && !formErrors.basePrice && !formErrors.stock && !formErrors.offer && !formErrors.couponLink
}

async function save() {
  if (!validateForm()) return

  saving.value = true
  try {
    const normalizedWeightValue = normalizeOptionalNumber(form.weightValue)
    const normalizedLengthValue = normalizeOptionalNumber(form.lengthValue)
    const normalizedWidthValue = normalizeOptionalNumber(form.widthValue)
    const normalizedHeightValue = normalizeOptionalNumber(form.heightValue)

    const payload = {
      name: form.name,
      sku: normalizeSku(form.sku),
      description: form.description || undefined,
      graphicDescription: form.graphicDescription.trim() || undefined,
      usageMode: form.usageMode.trim() || undefined,
      basePrice: Number(form.basePrice),
      currencyCode: form.currencyCode,
      stock: Number(form.stock),
      weightValue: normalizedWeightValue,
      weightUnit: normalizedWeightValue !== null ? form.weightUnit : null,
      lengthValue: normalizedLengthValue,
      widthValue: normalizedWidthValue,
      heightValue: normalizedHeightValue,
      dimensionUnit:
        normalizedLengthValue !== null || normalizedWidthValue !== null || normalizedHeightValue !== null
          ? form.dimensionUnit
          : null,
      categoryId: form.categoryId,
      couponId: form.couponId || undefined,
      couponLink: form.couponLink.trim() || undefined,
      tagIds: form.tagIds,
      variantProductIds: form.variantProductIds,
      relatedProductIds: form.relatedProductIds,
      suggestedProductIds: form.suggestedProductIds,
      attributeValues: buildAttributeValuesPayload(),
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      hasOffer: form.hasOffer,
      offerPrice: form.hasOffer ? Number(form.offerPrice) : undefined,
      offerPercentage: form.hasOffer ? Number(form.offerPercentage) : undefined,
    }

    if (isEdit.value) {
      await productsService.update(id.value, payload)

      if (initialVariants.value.length) {
        await createIndependentVariantProducts(id.value)
      }

      toast.success('Guardado', 'Producto actualizado')
      await loadProduct()
    } else {
      const created = await productsService.create(payload)

      if (initialVariants.value.length) {
        await createIndependentVariantProducts(created.id)
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
    !initialVariantErrors.additionalPrice
  )
}

function normalizeOptionalNumber(value: number | string) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return numeric
}

function mapAttributeValuesToForm(values: Product['attributeValues']) {
  return Object.fromEntries((values ?? []).map((attribute) => [attribute.key, attribute.value])) as Record<
    string,
    string | number | boolean
  >
}

function syncAttributeValuesWithCategory() {
  const nextValues: Record<string, string | number | boolean> = {}

  for (const definition of selectedCategoryAttributeDefinitions.value) {
    const currentValue = form.attributeValues[definition.key]
    nextValues[definition.key] = currentValue !== undefined ? currentValue : definition.type === 'boolean' ? false : ''
  }

  form.attributeValues = nextValues
}

function buildAttributeValuesPayload() {
  return selectedCategoryAttributeDefinitions.value
    .map((definition) => {
      const rawValue = form.attributeValues[definition.key]

      if (definition.type === 'boolean') {
        return { key: definition.key, value: Boolean(rawValue) }
      }

      if (definition.type === 'number') {
        return { key: definition.key, value: normalizeOptionalNumber(String(rawValue ?? '')) }
      }

      const textValue = String(rawValue ?? '').trim()
      return { key: definition.key, value: textValue || null }
    })
    .filter((attribute) => attribute.value !== null && attribute.value !== '')
}

function attributeFieldHint(definition: CategoryAttributeDefinition) {
  return [definition.helpText, definition.unit ? `Unidad: ${definition.unit}` : ''].filter(Boolean).join(' · ')
}

function attributeUnitSuggestions(definition: CategoryAttributeDefinition) {
  const inferredFamily = inferMeasurementUnitFamily(definition)

  if (inferredFamily) {
    const familyUnits = activeMeasurementUnits.value
      .filter((unit) => unit.family === inferredFamily)
      .map((unit) => ({ value: unit.code, label: unit.label }))

    if (familyUnits.length) {
      return familyUnits.slice(0, 16)
    }
  }

  const catalogUnits = activeMeasurementUnits.value.map((unit) => ({
    value: unit.code,
    label: unit.label,
  }))

  if (catalogUnits.length) {
    return catalogUnits.slice(0, 16)
  }

  return suggestMeasurementUnits(definition).slice(0, 16)
}

function booleanAttributeValue(key: string) {
  return Boolean(form.attributeValues[key])
}

function updateBooleanAttributeValue(key: string, value: boolean) {
  form.attributeValues[key] = value
}

function textAttributeValue(key: string) {
  const value = form.attributeValues[key]
  if (typeof value === 'boolean') {
    return ''
  }
  return value ?? ''
}

function updateTextAttributeValue(key: string, value: string | number | null | undefined) {
  form.attributeValues[key] = value ?? ''
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

function onPendingImageDragStart(imageId: string) {
  pendingImageDragId.value = imageId
}

function onPendingImageDragOver(event: DragEvent) {
  event.preventDefault()
}

function onPendingImageDrop(targetImageId: string) {
  if (!pendingImageDragId.value || pendingImageDragId.value === targetImageId) {
    pendingImageDragId.value = ''
    return
  }

  const list = [...imageUpload.files]
  const fromIndex = list.findIndex((item) => item.id === pendingImageDragId.value)
  const toIndex = list.findIndex((item) => item.id === targetImageId)

  if (fromIndex < 0 || toIndex < 0) {
    pendingImageDragId.value = ''
    return
  }

  const [moved] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, moved)
  imageUpload.files = list
  normalizePendingImageOrder()
  pendingImageDragId.value = ''
}

function onPendingImageDragEnd() {
  pendingImageDragId.value = ''
}

const hasImageOrderChanges = computed(() => {
  const currentOrder = sortedImages.value.map((image) => image.id)
  if (currentOrder.length !== existingImageOrder.value.length) {
    return false
  }

  return currentOrder.some((id, index) => existingImageOrder.value[index] !== id)
})

watch(
  sortedImages,
  (images) => {
    existingImageOrder.value = images.map((image) => image.id)
  },
  { immediate: true },
)

function onExistingImageDragStart(imageId: string) {
  existingImageDragId.value = imageId
}

function onExistingImageDragOver(event: DragEvent) {
  event.preventDefault()
}

function onExistingImageDrop(targetImageId: string) {
  if (!existingImageDragId.value || existingImageDragId.value === targetImageId) {
    existingImageDragId.value = ''
    return
  }

  const list = [...existingImageOrder.value]
  const fromIndex = list.indexOf(existingImageDragId.value)
  const toIndex = list.indexOf(targetImageId)

  if (fromIndex < 0 || toIndex < 0) {
    existingImageDragId.value = ''
    return
  }

  const [moved] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, moved)
  existingImageOrder.value = list
  existingImageDragId.value = ''
}

function onExistingImageDragEnd() {
  existingImageDragId.value = ''
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
      const url = await productsService.uploadImageAsset(item.file)

      await productsService.createImage(product.value.id, {
        url,
        altText: item.altText.trim() || undefined,
        isMain: imageUpload.markFirstAsMain && !markedAsMain,
        displayOrder: Number(item.displayOrder) || 0,
      })

      if (imageUpload.markFirstAsMain) {
        markedAsMain = true
      }
    }

    toast.success('Imágenes agregadas', `Se asociaron ${pending.length} imagen(es) al producto`)
    imageUpload.files = []
    imageUpload.markFirstAsMain = false
    await loadProduct()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo subir la imagen'))
  } finally {
    uploadingImage.value = false
  }
}

async function saveImageOrder() {
  if (!product.value) return
  if (!hasImageOrderChanges.value) return

  savingImageOrder.value = true
  try {
    const imagesById = new Map(sortedImages.value.map((image) => [image.id, image]))

    const changed = existingImageOrder.value
      .map((imageId, index) => ({
        image: imagesById.get(imageId),
        nextOrder: index + 1,
      }))
      .filter((entry): entry is { image: ProductImage; nextOrder: number } => Boolean(entry.image))
      .filter((entry) => Number(entry.image.displayOrder) !== entry.nextOrder)

    for (const entry of changed) {
      await productsService.updateImage(product.value.id, entry.image.id, {
        displayOrder: entry.nextOrder,
      })
    }

    toast.success('Orden actualizado', 'El orden de imágenes fue guardado')
    await loadProduct()
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

watch(selectedCategoryAttributeDefinitions, () => {
  syncAttributeValuesWithCategory()
}, { immediate: true })

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

function recommendationListByGroup(group: 'related' | 'suggested' | 'variant') {
  if (group === 'related') return form.relatedProductIds
  if (group === 'suggested') return form.suggestedProductIds
  return form.variantProductIds
}

function toggleRecommendationProduct(group: 'related' | 'suggested' | 'variant', productId: string) {
  if (productId === id.value) {
    return
  }

  const activeList = recommendationListByGroup(group)

  if (activeList.includes(productId)) {
    if (group === 'related') {
      form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
    } else if (group === 'suggested') {
      form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
    } else {
      form.variantProductIds = form.variantProductIds.filter((id) => id !== productId)
    }
    return
  }

  form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
  form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
  form.variantProductIds = form.variantProductIds.filter((id) => id !== productId)

  if (group === 'related') {
    form.relatedProductIds = [...form.relatedProductIds, productId]
  } else if (group === 'suggested') {
    form.suggestedProductIds = [...form.suggestedProductIds, productId]
  } else {
    form.variantProductIds = [...form.variantProductIds, productId]
  }
}

function removeRecommendationProduct(group: 'related' | 'suggested' | 'variant', productId: string) {
  if (group === 'related') {
    form.relatedProductIds = form.relatedProductIds.filter((id) => id !== productId)
    return
  }

  if (group === 'suggested') {
    form.suggestedProductIds = form.suggestedProductIds.filter((id) => id !== productId)
    return
  }

  form.variantProductIds = form.variantProductIds.filter((id) => id !== productId)
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

function filterRecommendationProducts(searchValue: string, group: 'related' | 'suggested' | 'variant') {
  const search = searchValue.trim().toLowerCase()
  const currentList = recommendationListByGroup(group)
  const excludedIds = new Set([
    id.value,
    ...form.relatedProductIds,
    ...form.suggestedProductIds,
    ...form.variantProductIds,
  ])
  for (const itemId of currentList) {
    excludedIds.delete(itemId)
  }
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

function imageById(imageId: string) {
  return sortedImages.value.find((image) => image.id === imageId) ?? null
}

async function refreshLinkedProduct(productId: string) {
  const refreshed = await productsService.get(productId)
  availableRelatedProducts.value = [
    ...availableRelatedProducts.value.filter((item) => item.id !== refreshed.id),
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
    const url = await productsService.uploadImageAsset(variantImageModal.file)
    const nextOrder = Math.max(0, ...((selectedVariantForImage.value?.images ?? []).map((img) => img.displayOrder))) + 1

    await productsService.createImage(variantImageModal.productId, {
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
    const nextOrder = Math.max(0, ...((selectedVariantForImage.value?.images ?? []).map((img) => img.displayOrder))) + 1

    await productsService.createImage(variantImageModal.productId, {
      url: image.url,
      altText: image.altText ?? form.name,
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
    await productsService.updateImage(variantImageModal.productId, image.id, { isMain: true })
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
    await productsService.removeImage(variantImageModal.productId, image.id)
    toast.success('Imagen eliminada')
    await refreshLinkedProduct(variantImageModal.productId)
  } catch {
    toast.error('Error', 'No se pudo eliminar la imagen de la variante')
  } finally {
    variantImageModal.actionLoading = null
  }
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
                size="lg"
                required
                placeholder="Remera Oversize"
                :error="formErrors.name"
                hint="Usa un nombre claro para busqueda y catalogo"
              />

              <div class="space-y-2">
                <UiInput
                  :model-value="form.sku"
                  label="SKU del producto"
                  size="lg"
                  required
                  placeholder="REMERA-OVERSIZE-NEGRA"
                  :error="formErrors.sku"
                  hint="Identificador unico del producto"
                  @update:model-value="onSkuInput"
                />
                <div class="flex items-center justify-between gap-3 text-xs text-surface-500">
                  <span>Vista previa: {{ productSkuPreview || 'SIN-SKU' }}</span>
                  <button type="button" class="font-medium text-primary-700 hover:text-primary-800" @click="resetSkuFromName">
                    Regenerar desde el nombre
                  </button>
                </div>
              </div>

              <UiSelect
                v-model="form.categoryId"
                label="Categoria"
                required
                searchable
                size="lg"
                :options="categories.map(c => ({ value: c.id, label: c.name }))"
                placeholder="Seleccionar categoria"
                search-placeholder="Buscar categoria..."
                :error="formErrors.categoryId"
              />

              <UiInput
                v-model="form.basePrice"
                type="number"
                min="0"
                step="0.01"
                label="Precio base"
                size="lg"
                required
                :error="formErrors.basePrice"
                :hint="`Vista previa: ${basePricePreview}`"
              />

              <UiInput
                v-model="form.stock"
                type="number"
                min="0"
                step="1"
                label="Stock base"
                size="lg"
                :error="formErrors.stock"
                hint="Disponible para rubros sin variantes por talla/color"
              />

              <UiSelect
                v-model="form.currencyCode"
                label="Moneda"
                size="lg"
                :options="currencies.map(c => ({ value: c.code, label: `${c.code} (${c.symbol})` }))"
                placeholder="Seleccionar moneda"
              />

              <div v-if="activeAttributeCount" class="lg:col-span-2 form-panel space-y-3">
                <div>
                  <p class="text-sm font-medium text-surface-700">Atributos dinámicos del rubro</p>
                  <p class="text-xs text-surface-500">
                    Estos campos cambian según la categoría elegida y permiten usar el ecommerce en distintos rubros.
                  </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <template v-for="definition in selectedCategoryAttributeDefinitions" :key="definition.key">
                    <FormToggleField
                      v-if="definition.type === 'boolean'"
                      :model-value="booleanAttributeValue(definition.key)"
                      :label="definition.label"
                      variant="card"
                      size="lg"
                      @update:model-value="updateBooleanAttributeValue(definition.key, $event)"
                    />
                    <UiSelect
                      v-else-if="definition.type === 'select'"
                      :model-value="textAttributeValue(definition.key)"
                      :label="definition.label"
                      size="lg"
                      :hint="attributeFieldHint(definition)"
                      :options="definition.options.map(option => ({ value: option, label: option }))"
                      @update:model-value="updateTextAttributeValue(definition.key, $event)"
                    />
                    <UiInput
                      v-else
                      :model-value="textAttributeValue(definition.key)"
                      :type="definition.type === 'number' ? 'number' : 'text'"
                      :step="definition.type === 'number' ? '0.01' : undefined"
                      :label="definition.label"
                      size="lg"
                      :hint="attributeFieldHint(definition)"
                      @update:model-value="updateTextAttributeValue(definition.key, $event)"
                    />
                    <div
                      v-if="definition.type === 'number' && attributeUnitSuggestions(definition).length"
                      class="-mt-1 flex flex-wrap gap-2 md:col-span-1"
                    >
                      <span class="text-[11px] font-medium text-surface-500">Tipos de medida opcionales:</span>
                      <span
                        v-for="unit in attributeUnitSuggestions(definition)"
                        :key="`${definition.key}-${unit.value}`"
                        class="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] text-surface-600"
                      >
                        {{ unit.label }} ({{ unit.value }})
                      </span>
                    </div>
                  </template>
                </div>
              </div>

              <div v-if="categorySupportsWeight || categorySupportsDimensions" class="lg:col-span-2 form-panel space-y-3">
                <div>
                  <p class="text-sm font-medium text-surface-700">Ficha logística y técnica</p>
                  <p class="text-xs text-surface-500">
                    Define peso y medidas cuando el rubro lo requiera para envíos, almacenaje o fichas técnicas.
                  </p>
                </div>

                <div v-if="categorySupportsWeight" class="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
                  <UiInput
                    v-model="form.weightValue"
                    type="number"
                    min="0"
                    step="0.001"
                    label="Peso"
                    size="lg"
                    hint="Opcional. Útil para logística y cálculo de envío."
                  />
                  <UiSelect v-model="form.weightUnit" label="Unidad de peso" size="lg" :options="weightUnitOptions" />
                  <div class="md:col-span-2 flex flex-wrap gap-2">
                    <button
                      v-for="option in weightUnitOptions"
                      :key="`weight-${option.value}`"
                      type="button"
                      class="rounded-full border px-2.5 py-1 text-xs transition"
                      :class="form.weightUnit === option.value
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-surface-300 text-surface-700 hover:border-primary-400 hover:text-primary-700'"
                      @click="form.weightUnit = String(option.value)"
                    >
                      {{ option.value }}
                    </button>
                  </div>
                </div>

                <div v-if="categorySupportsDimensions" class="space-y-3">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <UiInput v-model="form.lengthValue" type="number" min="0" step="0.01" label="Largo" size="lg" />
                    <UiInput v-model="form.widthValue" type="number" min="0" step="0.01" label="Ancho" size="lg" />
                    <UiInput v-model="form.heightValue" type="number" min="0" step="0.01" label="Alto" size="lg" />
                  </div>
                  <UiSelect v-model="form.dimensionUnit" label="Unidad de medida" size="lg" :options="dimensionUnitOptions" class="max-w-xs" />
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="option in dimensionUnitOptions"
                      :key="`dimension-${option.value}`"
                      type="button"
                      class="rounded-full border px-2.5 py-1 text-xs transition"
                      :class="form.dimensionUnit === option.value
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-surface-300 text-surface-700 hover:border-primary-400 hover:text-primary-700'"
                      @click="form.dimensionUnit = String(option.value)"
                    >
                      {{ option.value }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-panel space-y-2">
                <p class="text-caption">Conversion sugerida</p>
                <p class="text-sm text-surface-700">
                  Precio en moneda del producto: <strong>{{ fmt(form.basePrice, form.currencyCode) }}</strong>
                </p>
                <p class="text-sm text-surface-700">
                  Equivalente en moneda default ({{ defaultCurrencyName }}):
                  <strong>{{ fmt(basePriceInDefaultCurrency, defaultCurrencyCode) }}</strong>
                </p>
                <p v-if="form.hasOffer" class="text-sm text-surface-700">
                  Oferta equivalente en moneda default:
                  <strong>{{ fmt(offerPriceInDefaultCurrency, defaultCurrencyCode) }}</strong>
                </p>
              </div>

              <div class="form-panel space-y-3">
                <FormToggleField v-model="form.hasOffer" label="Producto con oferta" variant="card" size="sm" />

                <div v-if="form.hasOffer" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UiInput
                    v-model="form.offerPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    label="Precio oferta"
                    size="lg"
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
                    size="lg"
                    hint="Se calcula en base al precio normal"
                    :error="formErrors.offer"
                    @input="syncOfferFromPercentage"
                  />
                </div>

                <p v-if="form.hasOffer" class="text-xs text-surface-600">
                  Ahorro estimado por unidad: {{ fmt(offerDelta) }}
                </p>
              </div>

              <div class="form-panel space-y-2">
                <p class="text-caption">Resumen rapido</p>
                <p class="text-sm text-surface-700">
                  Slug estimado: <span class="font-mono text-xs">{{ slugPreview || 'sin-slug' }}</span>
                </p>
                <p class="text-sm text-surface-700">
                  SKU: <span class="font-mono text-xs">{{ productSkuPreview || 'sin-sku' }}</span>
                </p>
                <p class="text-sm text-surface-700">
                  Categoria: <strong>{{ selectedCategory?.name ?? 'Sin seleccionar' }}</strong>
                </p>
                <p class="text-sm text-surface-700">
                  Rubro configurado: <strong>{{ categorySupportsSizeColorVariants ? 'Con talla/color' : 'Sin talla/color' }}</strong>
                </p>
                <p class="text-sm text-surface-700">
                  Stock base: <strong>{{ form.stock }} unidad(es)</strong>
                </p>
                <p class="text-sm text-surface-700">
                  Atributos activos: <strong>{{ activeAttributeCount }}</strong>
                </p>
                <p v-if="hasShippingProfile" class="text-sm text-surface-700">
                  Perfil logístico:
                  <strong>{{ categorySupportsWeight && normalizeOptionalNumber(form.weightValue) !== null ? `${form.weightValue} ${form.weightUnit}` : 'sin peso' }}</strong>
                  <span v-if="categorySupportsDimensions && (normalizeOptionalNumber(form.lengthValue) !== null || normalizeOptionalNumber(form.widthValue) !== null || normalizeOptionalNumber(form.heightValue) !== null)">
                    · {{ form.lengthValue || 0 }} x {{ form.widthValue || 0 }} x {{ form.heightValue || 0 }} {{ form.dimensionUnit }}
                  </span>
                </p>
                <p class="text-sm text-surface-700">
                  Cupon: <strong>{{ selectedCoupon?.code ?? 'Sin cupon seleccionado' }}</strong>
                </p>
              </div>

              <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormToggleField v-model="form.isActive" label="Publicar producto (Activo/Desactivo)" variant="card" size="lg" />

                <FormToggleField v-model="form.isFeatured" label="Marcar como destacado" variant="card" size="lg" />
              </div>

              <div class="lg:col-span-2">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-surface-700">Descripcion</label>
                  <div class="rounded-xl border border-surface-200 bg-surface-0 overflow-hidden">
                    <RichTextEditor
                      v-model:content="form.description"
                      contentType="html"
                      theme="snow"
                      :toolbar="editorToolbar"
                      placeholder="Detalles del producto, composicion, fit, recomendaciones de uso..."
                    />
                  </div>
                  <p class="text-xs text-surface-500">{{ descriptionLength }} caracteres</p>
                </div>
              </div>

              <div class="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <UiTextarea
                  v-model="form.graphicDescription"
                  size="lg"
                  :rows="4"
                  label="Graphic Description"
                  placeholder="Describe visual style, silhouette, textures, and key visual cues."
                />
                <UiTextarea
                  v-model="form.usageMode"
                  size="lg"
                  :rows="4"
                  label="Usage Mode"
                  placeholder="Explain how to use or wear the product in practical scenarios."
                />
                <p class="text-xs text-surface-500">
                  Graphic Description: {{ graphicDescriptionLength }} chars
                </p>
                <p class="text-xs text-surface-500">
                  Usage Mode: {{ usageModeLength }} chars
                </p>
              </div>

              <div class="lg:col-span-2 space-y-2">
                <p class="text-sm font-medium text-surface-700">Cupon para este producto</p>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <UiSelect
                    v-model="form.couponId"
                    label="Seleccionar cupon"
                    size="lg"
                    :options="[{ value: '', label: 'Sin cupon' }, ...coupons.map(c => ({ value: c.id, label: `${c.code} (${c.type === CouponType.PERCENTAGE ? `${c.value}%` : fmt(c.value, c.currencyCode)})` }))]"
                    placeholder="Elegir cupon"
                    hint="Puedes aplicar un cupon especifico al producto"
                  />
                  <UiInput
                    v-model="form.couponLink"
                    label="Enlace a cupon"
                    size="lg"
                    placeholder="https://tu-tienda.com/cupones/SUMMER20"
                    :error="formErrors.couponLink"
                    hint="Opcional: URL para compartir el cupon con el cliente"
                  />
                </div>

                <div v-if="selectedCoupon" class="form-panel-primary space-y-2">
                  <p class="text-sm font-semibold text-primary-800">Detalle del cupon seleccionado</p>
                  <p class="text-sm text-surface-800">
                    <strong>{{ selectedCoupon.code }}</strong> - {{ couponTypeLabel(selectedCoupon) }}
                  </p>
                  <p class="text-sm text-surface-700">
                    Descuento: <strong>{{ couponValueLabel(selectedCoupon) }}</strong>
                  </p>
                  <p class="text-sm text-surface-700">
                    Compra minima: <strong>{{ fmt(selectedCoupon.minOrderAmount, selectedCoupon.currencyCode) }}</strong>
                  </p>
                  <p class="text-sm text-surface-700">
                    Vigencia: <strong>{{ selectedCoupon.startDate ? selectedCoupon.startDate.slice(0, 10) : 'Sin inicio' }}</strong>
                    a
                    <strong>{{ selectedCoupon.endDate ? selectedCoupon.endDate.slice(0, 10) : 'Sin fin' }}</strong>
                  </p>
                  <p class="text-sm text-surface-700">
                    Estado: <strong>{{ selectedCoupon.isActive ? 'Activo' : 'Inactivo' }}</strong>
                  </p>
                </div>
              </div>

              <div v-if="categorySupportsSizeColorVariants" class="lg:col-span-2 space-y-3">
                <p class="text-sm font-medium text-surface-700">Crear variantes iniciales por talla/color</p>
                <p class="text-xs text-surface-500">
                  Usa este bloque sólo cuando la categoría trabaje con talla y color. Cada combinación se crea como producto independiente.
                </p>

                <div class="form-panel space-y-4">
                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <UiInput
                      :model-value="initialVariantDraft.sku"
                      label="SKU"
                      size="lg"
                      placeholder="SKU-REM-BLK-M"
                      :error="initialVariantErrors.sku"
                      @update:model-value="onInitialVariantSkuInput"
                    />
                    <UiSelect
                      v-model="initialVariantDraft.sizeId"
                      label="Talla"
                      searchable
                      size="lg"
                      :options="sizes.map(s => ({ value: s.id, label: s.name }))"
                      placeholder="Seleccionar talla"
                      search-placeholder="Buscar talla..."
                      :error="initialVariantErrors.sizeId"
                    />
                    <UiSelect
                      v-model="initialVariantDraft.colorId"
                      label="Color"
                      searchable
                      size="lg"
                      :options="colors.map(c => ({ value: c.id, label: c.name }))"
                      placeholder="Seleccionar color"
                      search-placeholder="Buscar color..."
                      :error="initialVariantErrors.colorId"
                    />
                  </div>

                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <UiInput
                      v-model="initialVariantDraft.additionalPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      label="Ajuste de precio"
                      size="lg"
                      :error="initialVariantErrors.additionalPrice"
                    />
                    <div class="flex items-end">
                      <FormToggleField v-model="initialVariantDraft.isActive" label="Variante activa" variant="card" size="lg" class="w-full" />
                    </div>
                  </div>

                  <div class="flex items-center justify-between gap-3 text-xs text-surface-500">
                    <span>Sugerido: {{ initialVariantSkuPreview || 'SIN-SKU' }}</span>
                    <button type="button" class="font-medium text-primary-700 hover:text-primary-800" @click="resetInitialVariantSku">
                      Usar sugerencia
                    </button>
                  </div>

                  <div class="flex justify-end">
                    <UiButton type="button" size="sm" @click="addInitialVariant">Agregar combinación</UiButton>
                  </div>

                  <div>
                    <UiTable :data="initialVariants" compact empty-message="Aun no agregaste variantes iniciales">
                      <template #head>
                        <tr>
                          <th class="table-th">SKU</th>
                          <th class="table-th">Talla</th>
                          <th class="table-th">Color</th>
                          <th class="table-th text-right">Ajuste de precio</th>
                          <th class="table-th text-center">Estado</th>
                          <th class="table-th table-actions-th" />
                        </tr>
                      </template>

                      <tr v-for="(item, index) in initialVariants" :key="item.sku" class="table-tr-hover">
                        <td class="table-td font-mono text-xs">{{ item.sku }}</td>
                        <td class="table-td">{{ sizeNameById(item.sizeId) }}</td>
                        <td class="table-td">{{ colorNameById(item.colorId) }}</td>
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
                <p class="text-sm font-medium text-surface-700">Etiquetas (tags)</p>

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
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-surface-0 text-surface-700 border-surface-300 hover:border-primary-400'"
                    @click="toggleTag(tag.id)"
                  >
                    {{ tag.name }}
                  </button>
                  <span v-if="!tags.length" class="text-xs text-surface-500">No hay tags activos disponibles</span>
                </div>
              </div>

              <div class="lg:col-span-2 form-panel space-y-3">
                <div>
                  <p class="text-sm font-medium text-surface-700">Versiones o variantes vinculadas</p>
                  <p class="text-xs text-surface-500">
                    Vincula aquí otras versiones del producto. Esto sirve tanto para moda como para electrónica, hogar o cualquier otro rubro.
                  </p>
                </div>

                <UiInput
                  v-model="variantProductSearch"
                  placeholder="Buscar variantes por nombre, SKU o slug..."
                />

                <div v-if="selectedVariantProducts.length" class="space-y-2">
                  <div
                    v-for="(variantProduct, index) in selectedVariantProducts"
                    :key="variantProduct.id"
                    class="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-surface-0 px-3 py-2"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                        <img v-if="recommendationImage(variantProduct)" :src="recommendationImage(variantProduct)" :alt="variantProduct.name" class="w-full h-full object-cover" />
                      </div>
                      <div class="min-w-0">
                        <p class="font-medium text-surface-900 truncate">{{ index + 1 }}. {{ variantProduct.name }}</p>
                        <p class="text-xs font-mono text-surface-500 truncate">{{ variantProduct.sku }}</p>
                        <p class="text-xs text-surface-700">{{ recommendationPrice(variantProduct) }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <UiButton type="button" size="sm" variant="secondary" @click="openVariantImageManager(variantProduct.id)">
                        Imágenes
                      </UiButton>
                      <UiButton type="button" size="sm" variant="ghost" @click="router.push({ name: 'products-edit', params: { id: variantProduct.id } })">
                        Editar
                      </UiButton>
                      <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('variant', variantProduct.id)">
                        Quitar
                      </UiButton>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-2">
                  <button
                    v-for="variantProduct in filteredVariantProducts"
                    :key="variantProduct.id"
                    type="button"
                    class="rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-left hover:border-primary-300"
                    @click="toggleRecommendationProduct('variant', variantProduct.id)"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                        <img v-if="recommendationImage(variantProduct)" :src="recommendationImage(variantProduct)" :alt="variantProduct.name" class="w-full h-full object-cover" />
                      </div>
                      <div class="min-w-0">
                        <p class="font-medium text-surface-900 truncate">{{ variantProduct.name }}</p>
                        <p class="text-xs font-mono text-surface-500 truncate">{{ variantProduct.sku }}</p>
                        <p class="text-xs text-surface-700">{{ recommendationPrice(variantProduct) }}</p>
                      </div>
                    </div>
                  </button>
                </div>

                <p v-if="!filteredVariantProducts.length" class="text-xs text-surface-500">
                  No hay más productos disponibles para variantes.
                </p>
              </div>

              <div class="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div class="form-panel space-y-3">
                  <div>
                    <p class="text-sm font-medium text-surface-700">Productos relacionados</p>
                    <p class="text-xs text-surface-500">Se muestran como productos similares o complementarios.</p>
                  </div>

                  <UiInput
                    v-model="relatedProductSearch"
                    placeholder="Buscar relacionados por nombre, SKU o slug..."
                  />

                  <div v-if="selectedRelatedProducts.length" class="space-y-2">
                    <div
                      v-for="(related, index) in selectedRelatedProducts"
                      :key="related.id"
                      class="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-surface-0 px-3 py-2 cursor-move"
                      draggable="true"
                      @dragstart="onRecommendationDragStart('related', related.id)"
                      @dragover="onRecommendationDragOver"
                      @drop="onRecommendationDrop('related', related.id)"
                      @dragend="onRecommendationDragEnd"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                          <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-surface-900 truncate">{{ index + 1 }}. {{ related.name }}</p>
                          <p class="text-xs font-mono text-surface-500 truncate">{{ related.sku }}</p>
                          <p class="text-xs text-surface-700">{{ recommendationPrice(related) }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <span class="text-xs text-surface-500">Arrastra</span>
                        <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('related', related.id)">Quitar</UiButton>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="related in filteredRelatedProducts"
                      :key="related.id"
                      type="button"
                      class="rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-left hover:border-primary-300"
                      @click="toggleRecommendationProduct('related', related.id)"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                          <img v-if="recommendationImage(related)" :src="recommendationImage(related)" :alt="related.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-surface-900 truncate">{{ related.name }}</p>
                          <p class="text-xs font-mono text-surface-500 truncate">{{ related.sku }}</p>
                          <p class="text-xs text-surface-700">{{ recommendationPrice(related) }}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p v-if="!filteredRelatedProducts.length" class="text-xs text-surface-500">
                    No hay más productos disponibles para relacionados.
                  </p>
                </div>

                <div class="form-panel space-y-3">
                  <div>
                    <p class="text-sm font-medium text-surface-700">Productos sugeridos</p>
                    <p class="text-xs text-surface-500">Se pueden priorizar para recomendaciones destacadas.</p>
                  </div>

                  <UiInput
                    v-model="suggestedProductSearch"
                    placeholder="Buscar sugeridos por nombre, SKU o slug..."
                  />

                  <div v-if="selectedSuggestedProducts.length" class="space-y-2">
                    <div
                      v-for="(suggested, index) in selectedSuggestedProducts"
                      :key="suggested.id"
                      class="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-surface-0 px-3 py-2 cursor-move"
                      draggable="true"
                      @dragstart="onRecommendationDragStart('suggested', suggested.id)"
                      @dragover="onRecommendationDragOver"
                      @drop="onRecommendationDrop('suggested', suggested.id)"
                      @dragend="onRecommendationDragEnd"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                          <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-surface-900 truncate">{{ index + 1 }}. {{ suggested.name }}</p>
                          <p class="text-xs font-mono text-surface-500 truncate">{{ suggested.sku }}</p>
                          <p class="text-xs text-surface-700">{{ recommendationPrice(suggested) }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <span class="text-xs text-surface-500">Arrastra</span>
                        <UiButton type="button" size="sm" variant="danger" @click="removeRecommendationProduct('suggested', suggested.id)">Quitar</UiButton>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="suggested in filteredSuggestedProducts"
                      :key="suggested.id"
                      type="button"
                      class="rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 text-left hover:border-primary-300"
                      @click="toggleRecommendationProduct('suggested', suggested.id)"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                          <img v-if="recommendationImage(suggested)" :src="recommendationImage(suggested)" :alt="suggested.name" class="w-full h-full object-cover" />
                        </div>
                        <div class="min-w-0">
                          <p class="font-medium text-surface-900 truncate">{{ suggested.name }}</p>
                          <p class="text-xs font-mono text-surface-500 truncate">{{ suggested.sku }}</p>
                          <p class="text-xs text-surface-700">{{ recommendationPrice(suggested) }}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p v-if="!filteredSuggestedProducts.length" class="text-xs text-surface-500">
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

        <UiCard v-if="isEdit && product" title="Versiones vinculadas">
          <template #default>
            <div class="-mx-6 -mb-6">
              <UiTable :data="selectedVariantProducts" compact :empty="!selectedVariantProducts.length" empty-message="No hay variantes vinculadas">
                <template #head>
                  <tr>
                    <th class="table-th">Producto</th>
                    <th class="table-th text-right">Precio</th>
                    <th class="table-th text-center">Estado</th>
                    <th class="table-th table-actions-th" />
                  </tr>
                </template>

                <tr v-for="variantProduct in selectedVariantProducts" :key="variantProduct.id" class="table-tr-hover">
                  <td class="table-td">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                        <img
                          v-if="recommendationImage(variantProduct)"
                          :src="recommendationImage(variantProduct)"
                          :alt="variantProduct.name"
                          class="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p class="font-medium text-surface-900">{{ variantProduct.name }}</p>
                        <p class="text-caption font-mono">{{ variantProduct.sku }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="table-td text-right">{{ recommendationPrice(variantProduct) }}</td>
                  <td class="table-td text-center">
                    <UiBadge :color="variantProduct.isActive ? 'success' : 'neutral'" dot>
                      {{ variantProduct.isActive ? 'Activo' : 'Desactivo' }}
                    </UiBadge>
                  </td>
                  <td class="table-td table-actions-td text-right">
                    <div class="flex items-center justify-end gap-1">
                      <UiButton size="sm" variant="secondary" @click="openVariantImageManager(variantProduct.id)">
                        Imágenes
                      </UiButton>
                      <UiButton size="sm" variant="ghost" @click="router.push({ name: 'products-edit', params: { id: variantProduct.id } })">
                        Editar
                      </UiButton>
                      <UiButton size="sm" variant="danger" @click="removeRecommendationProduct('variant', variantProduct.id)">
                        Quitar
                      </UiButton>
                    </div>
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
              <span class="text-surface-600">Nombre</span>
              <UiBadge :color="form.name.trim().length >= 3 ? 'success' : 'warning'" dot>
                {{ form.name.trim().length >= 3 ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-surface-600">Categoria</span>
              <UiBadge :color="form.categoryId ? 'success' : 'warning'" dot>
                {{ form.categoryId ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-surface-600">SKU</span>
              <UiBadge :color="form.sku.trim().length >= 3 ? 'success' : 'warning'" dot>
                {{ form.sku.trim().length >= 3 ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-surface-600">Precio</span>
              <UiBadge :color="Number(form.basePrice) >= 0 ? 'success' : 'warning'" dot>
                {{ Number(form.basePrice) >= 0 ? 'OK' : 'Pendiente' }}
              </UiBadge>
            </div>
            <div class="divider" />
            <p class="text-xs text-surface-500">
              Tip: este formulario ya soporta productos genéricos; talla/color sólo aparece si la categoría lo necesita.
            </p>
          </div>
        </UiCard>

        <UiCard title="Imagenes del producto">
          <div v-if="!isEdit || !product" class="text-sm text-surface-600">
            Este bloque se habilita cuando el producto ya fue creado.
          </div>

          <div v-else class="space-y-4">
            <UiFileInput multiple accept="image/*" size="lg" label="Imágenes" @change="onImageFileSelected" />
            <FormToggleField v-model="imageUpload.markFirstAsMain" label="Marcar la primera como principal" size="lg" />

            <div v-if="imageUpload.files.length" class="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <p class="text-xs font-medium text-surface-600">Imágenes a subir (arrastra para ordenar)</p>
              <div
                v-for="item in imageUpload.files"
                :key="item.id"
                class="rounded-lg border border-surface-200 bg-surface-0 p-2"
                draggable="true"
                @dragstart="onPendingImageDragStart(item.id)"
                @dragover="onPendingImageDragOver"
                @drop="onPendingImageDrop(item.id)"
                @dragend="onPendingImageDragEnd"
              >
                <div class="grid grid-cols-[24px_1fr_auto] items-start gap-2">
                  <span class="mt-2 text-surface-400">::</span>
                  <div class="space-y-2 min-w-0">
                    <p class="truncate text-xs text-surface-700">
                      {{ item.displayOrder }}. {{ item.file.name }}
                    </p>
                    <UiInput v-model="item.altText" size="sm" placeholder="Texto alternativo de esta imagen (opcional)" />
                  </div>
                  <UiButton size="sm" variant="danger" @click="removePendingImage(item.id)">Quitar</UiButton>
                </div>
              </div>
            </div>

            <UiButton :loading="uploadingImage" :disabled="!imageUpload.files.length" @click="uploadAndAttachImage">
              Subir y asociar {{ imageUpload.files.length }} imagen(es)
            </UiButton>

            <div class="divider" />

            <UiEmptyState v-if="!sortedImages.length" title="Sin imágenes cargadas" compact />

            <template v-else>
              <div class="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-medium text-surface-600">Orden de imágenes actuales (arrastra para ordenar)</p>
                  <UiButton size="sm" :loading="savingImageOrder" :disabled="!hasImageOrderChanges" @click="saveImageOrder">
                    Guardar orden
                  </UiButton>
                </div>
                <div
                  v-for="imageId in existingImageOrder"
                  :key="`order-${imageId}`"
                  class="grid grid-cols-[20px_56px_1fr] items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 p-2"
                  draggable="true"
                  @dragstart="onExistingImageDragStart(imageId)"
                  @dragover="onExistingImageDragOver"
                  @drop="onExistingImageDrop(imageId)"
                  @dragend="onExistingImageDragEnd"
                >
                  <span class="text-surface-400">::</span>
                  <img
                    :src="imageById(imageId)?.url"
                    :alt="imageById(imageId)?.altText ?? form.name"
                    class="h-12 w-14 rounded object-cover"
                  />
                  <p class="truncate text-xs text-surface-700">
                    {{ imageById(imageId)?.altText || imageById(imageId)?.url }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
              <div
                v-for="img in sortedImages"
                :key="img.id"
                class="aspect-square rounded-lg overflow-hidden bg-surface-100 relative group"
              >
                <img :src="img.url" :alt="img.altText ?? form.name" class="w-full h-full object-cover" />

                <span v-if="img.isMain" class="absolute top-1 left-1 badge-base bg-primary-600 text-white text-xs">
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
            </template>
          </div>
        </UiCard>
      </div>
    </div>

    <UiModal
      :show="variantImageModal.show"
      :title="`Imágenes de variante: ${selectedVariantForImage?.name ?? ''}`"
      @close="variantImageModal.show = false"
    >
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UiFileInput accept="image/*" size="lg" label="Subir imagen" @change="onVariantImageFileSelected" />
          <UiInput v-model="variantImageModal.altText" label="Texto alternativo" size="lg" placeholder="Opcional" />
        </div>
        <FormToggleField v-model="variantImageModal.isMain" label="Marcar como principal" size="lg" />
        <UiButton class="w-full" :loading="variantImageModal.loading" :disabled="!variantImageModal.file" @click="uploadAndAttachVariantImage">
          Subir y asociar a la variante
        </UiButton>

        <div class="divider" />

        <div>
          <p class="text-sm font-medium text-surface-700 mb-2">Usar imágenes del producto actual</p>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="img in sortedImages"
              :key="`source-${img.id}`"
              type="button"
              class="aspect-square rounded-lg overflow-hidden border border-surface-200 hover:border-primary-300"
              :disabled="variantImageModal.loading"
              @click="attachExistingProductImageToVariant(img)"
            >
              <img :src="img.url" :alt="img.altText ?? form.name" class="h-full w-full object-cover" />
            </button>
          </div>
          <p v-if="!sortedImages.length" class="text-xs text-surface-500 mt-2">
            Primero agrega imágenes al producto base para poder reutilizarlas.
          </p>
        </div>

        <div class="divider" />

        <div>
          <p class="text-sm font-medium text-surface-700 mb-2">Imágenes actuales de la variante</p>
          <UiEmptyState v-if="!variantSortedImages.length" title="Sin imágenes" compact />
          <div v-else class="grid grid-cols-2 gap-2">
            <div
              v-for="img in variantSortedImages"
              :key="`variant-${img.id}`"
              class="aspect-square rounded-lg overflow-hidden bg-surface-100 relative group"
            >
              <img :src="img.url" :alt="img.altText ?? selectedVariantForImage?.name" class="w-full h-full object-cover" />
              <span v-if="img.isMain" class="absolute top-1 left-1 badge-base bg-primary-600 text-white text-xs">
                Principal
              </span>
              <div class="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <UiButton
                  size="sm"
                  variant="secondary"
                  class="flex-1"
                  :disabled="img.isMain || variantImageModal.actionLoading === img.id"
                  @click="setVariantImageAsMain(img)"
                >
                  Principal
                </UiButton>
                <UiButton
                  size="sm"
                  variant="danger"
                  class="flex-1"
                  :loading="variantImageModal.actionLoading === img.id"
                  @click="removeVariantImage(img)"
                >
                  Borrar
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UiModal>
  </div>
</template>
