<script setup lang="ts">
import { reactive, ref, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsService } from '@/services/products.service'
import { tagsService } from '@/services/catalog.service'
import { useImageManager } from '@/composables/useImageManager'
import { useProductRecommendations } from '@/composables/useProductRecommendations'
import { useProductStock } from '@/composables/useProductStock'
import { useProductValidation } from '@/composables/useProductValidation'
import { useProductOfferSync } from '@/composables/useProductOfferSync'
import { useVariantImageManager } from '@/composables/useVariantImageManager'
import { useProductFormData } from '@/composables/useProductFormData'
import { useProductInitialVariants } from '@/composables/useProductInitialVariants'
import { extractErrorMessage } from '@/utils/error'
import type {
  Product,
  ProductFeature,
  CategoryAttributeDefinition,
} from '@/types/api'
import { formatMoney } from '@/utils/currency'
import {
  includeCurrentUnit,
  mapAttributeValuesToForm,
  mapFeaturesToForm,
  normalizeOptionalNumber,
  normalizeSku,
  slugify,
  toUnitOptions,
} from '@/utils/product-form'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import ProductAttributesLogisticsSection from '@/components/products/ProductAttributesLogisticsSection.vue'
import ProductBasicInfoSection from '@/components/products/ProductBasicInfoSection.vue'
import ProductEditorialSection from '@/components/products/ProductEditorialSection.vue'
import ProductFeaturesSection from '@/components/products/ProductFeaturesSection.vue'
import ProductFormStatusCard from '@/components/products/ProductFormStatusCard.vue'
import ProductImagesSection from '@/components/products/ProductImagesSection.vue'
import ProductInitialVariantsSection from '@/components/products/ProductInitialVariantsSection.vue'
import ProductLinkedVariantsCard from '@/components/products/ProductLinkedVariantsCard.vue'
import ProductPricingSection from '@/components/products/ProductPricingSection.vue'
import ProductQuickSummaryPanel from '@/components/products/ProductQuickSummaryPanel.vue'
import ProductRecommendationsSection from '@/components/products/ProductRecommendationsSection.vue'
import ProductTagsSection from '@/components/products/ProductTagsSection.vue'
import { useToast } from '@/composables/useToast'
import { inferMeasurementUnitFamily, suggestMeasurementUnits } from '@/utils/measurement-units'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))
const isEdit = computed(() => !!id.value)

const initialVariantsColumns = [
  { key: 'sku', label: 'SKU' },
  { key: 'size', label: 'Talla' },
  { key: 'color', label: 'Color' },
  { key: 'priceAdj', label: 'Ajuste de precio', align: 'right' as const },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'actions', actions: true },
]

const variantProductsColumns = [
  { key: 'product', label: 'Producto' },
  { key: 'price', label: 'Precio', align: 'right' as const },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'actions', actions: true },
]

const loading = ref(false)
const saving = ref(false)

const { savingStock, productStock, stockDraft, stockOriginal, stockDirty, stockTotal, loadProductStock, saveProductStock } =
  useProductStock(id)

const creatingTag = ref(false)
const newTagName = ref('')
const skuTouched = ref(false)

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
  features: [{ icon: '', name: '' }] as ProductFeature[],
  isActive: true,
  isFeatured: false,
})

const formErrors = reactive({
  name: '',
  sku: '',
  categoryId: '',
  basePrice: '',
  stock: '',
  offer: '',
  couponLink: '',
  features: '',
})

const { validateForm, syncOfferAndCouponErrors } = useProductValidation({
  form,
  formErrors,
  normalizeSku,
})

const { syncOfferFromPrice, syncOfferFromPercentage } = useProductOfferSync(form)

const {
  availableRelatedProducts,
  relatedProductSearch,
  suggestedProductSearch,
  variantProductSearch,
  selectedRelatedProducts,
  selectedVariantProducts,
  selectedSuggestedProducts,
  filteredRelatedProducts,
  filteredSuggestedProducts,
  filteredVariantProducts,
  onRecommendationDragStart,
  onRecommendationDragOver,
  onRecommendationDrop,
  onRecommendationDragEnd,
  toggleRecommendationProduct,
  removeRecommendationProduct,
  recommendationImage,
} = useProductRecommendations(id, form)

const previousProductCurrencyCode = ref(form.currencyCode)
const syncingProductCurrencyChange = ref(false)

const {
  product,
  categories,
  sizes,
  colors,
  currencies,
  tags,
  measurementUnits,
  coupons,
  loadCatalogData,
  loadProduct,
} = useProductFormData({
  isEdit,
  id,
  form,
  availableRelatedProducts,
  loadProductStock,
  previousProductCurrencyCode,
  syncingProductCurrencyChange,
  mapAttributeValuesToForm,
  mapFeaturesToForm,
})

const {
  variantImageModal,
  selectedVariantForImage,
  variantSortedImages,
  openVariantImageManager,
  onVariantImageFileSelected,
  uploadAndAttachVariantImage,
  attachExistingProductImageToVariant,
  setVariantImageAsMain,
  removeVariantImage,
} = useVariantImageManager(availableRelatedProducts, () => form.name, productsService)

const {
  imageUpload,
  uploadingImage,
  imageActionLoading,
  savingImageOrder,
  existingImageOrder,
  sortedImages,
  hasImageOrderChanges,
  onImageFileSelected,
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
} = useImageManager(product, productsService, loadProduct)

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
const descriptionLength = computed(() => form.description.trim().length)
const graphicDescriptionLength = computed(() => form.graphicDescription.trim().length)
const usageModeLength = computed(() => form.usageMode.trim().length)
const slugPreview = computed(() => slugify(form.name))
const productSkuPreview = computed(() => normalizeSku(form.sku || form.name))
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
const shippingProfileSummary = computed(() => {
  if (!hasShippingProfile.value) {
    return null
  }

  const parts: string[] = []

  if (categorySupportsWeight.value && normalizeOptionalNumber(form.weightValue) !== null) {
    parts.push(`${form.weightValue} ${form.weightUnit}`)
  } else {
    parts.push('sin peso')
  }

  if (
    categorySupportsDimensions.value &&
    (normalizeOptionalNumber(form.lengthValue) !== null || normalizeOptionalNumber(form.widthValue) !== null || normalizeOptionalNumber(form.heightValue) !== null)
  ) {
    parts.push(`${form.lengthValue || 0} x ${form.widthValue || 0} x ${form.heightValue || 0} ${form.dimensionUnit}`)
  }

  return parts.join(' · ')
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

const {
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
} = useProductInitialVariants({
  form,
  sizes,
  colors,
  availableRelatedProducts,
  productSkuPreview,
  categorySupportsSizeColorVariants,
  buildFeaturesPayload,
})

function editVariantProduct(variantProductId: string) {
  router.push({ name: 'products-edit', params: { id: variantProductId } })
}

function closeVariantImageManager() {
  variantImageModal.show = false
}

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

async function loadProductWithState() {
  if (!isEdit.value) return
  loading.value = true
  try {
    await loadProduct()
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
      features: buildFeaturesPayload(),
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
      await loadProductWithState()
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

function buildFeaturesPayload() {
  return form.features
    .map((feature) => ({
      icon: String(feature.icon ?? '').trim(),
      name: String(feature.name ?? '').trim(),
    }))
    .filter((feature) => feature.icon && feature.name)
}

function addFeature() {
  form.features.push({ icon: '', name: '' })
}

function removeFeature(index: number) {
  form.features.splice(index, 1)
  if (!form.features.length) {
    form.features.push({ icon: '', name: '' })
  }
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
onMounted(async () => {
  try {
    await loadCatalogData()
    await loadProductWithState()
  } catch {
    toast.error('Error', 'No se pudieron cargar datos iniciales')
  }
})

watch(
  () => [form.basePrice, form.offerPrice, form.offerPercentage, form.hasOffer, form.couponLink],
  () => {
    syncOfferAndCouponErrors()
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

watch(selectedCategoryAttributeDefinitions, () => {
  syncAttributeValuesWithCategory()
}, { immediate: true })

function onSkuInput(value: string | number | undefined) {
  skuTouched.value = true
  form.sku = normalizeSku(String(value ?? ''))
  formErrors.sku = form.sku.length < 3 ? 'Ingresa un SKU valido de al menos 3 caracteres' : ''
}

function resetSkuFromName() {
  skuTouched.value = false
  form.sku = normalizeSku(form.name)
  formErrors.sku = form.sku.length < 3 ? 'Ingresa un SKU valido de al menos 3 caracteres' : ''
}

function toggleTag(tagId: string) {
  if (form.tagIds.includes(tagId)) {
    form.tagIds = form.tagIds.filter((id) => id !== tagId)
    return
  }
  form.tagIds.push(tagId)
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

function fmt(n: number | string, currencyCode = form.currencyCode || getSystemCurrencyCode()) {
  return formatMoney(n, currencyCode)
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div class="xl:col-span-2 space-y-6">
        <UiCard :title="isEdit ? 'Editar producto' : 'Nuevo producto'">
          <form class="space-y-6 p-4" @submit.prevent="save">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ProductBasicInfoSection
                :form="form"
                :form-errors="formErrors"
                :categories="categories"
                :currencies="currencies"
                :product-sku-preview="productSkuPreview"
                :base-price-preview="basePricePreview"
                :is-edit="isEdit"
                :product-stock="productStock"
                :stock-total="stockTotal"
                :stock-dirty="stockDirty"
                :saving-stock="savingStock"
                :stock-draft="stockDraft"
                :stock-original="stockOriginal"
                :on-sku-input="onSkuInput"
                :reset-sku-from-name="resetSkuFromName"
                :save-product-stock="saveProductStock"
              />

              <ProductAttributesLogisticsSection
                :form="form"
                :active-attribute-count="activeAttributeCount"
                :selected-category-attribute-definitions="selectedCategoryAttributeDefinitions"
                :category-supports-weight="categorySupportsWeight"
                :category-supports-dimensions="categorySupportsDimensions"
                :weight-unit-options="weightUnitOptions"
                :dimension-unit-options="dimensionUnitOptions"
                :attribute-field-hint="attributeFieldHint"
                :attribute-unit-suggestions="attributeUnitSuggestions"
                :boolean-attribute-value="booleanAttributeValue"
                :update-boolean-attribute-value="updateBooleanAttributeValue"
                :text-attribute-value="textAttributeValue"
                :update-text-attribute-value="updateTextAttributeValue"
              />

              <ProductPricingSection
                :form="form"
                :form-errors="formErrors"
                :default-currency-name="defaultCurrencyName"
                :default-currency-code="defaultCurrencyCode"
                :base-price-in-default-currency="basePriceInDefaultCurrency"
                :offer-price-in-default-currency="offerPriceInDefaultCurrency"
                :offer-price-preview="offerPricePreview"
                :offer-delta="offerDelta"
                :coupons="coupons"
                :selected-coupon="selectedCoupon"
                :fmt="fmt"
                :sync-offer-from-price="syncOfferFromPrice"
                :sync-offer-from-percentage="syncOfferFromPercentage"
              />

              <ProductQuickSummaryPanel
                :slug-preview="slugPreview"
                :product-sku-preview="productSkuPreview"
                :category-name="selectedCategory?.name ?? 'Sin seleccionar'"
                :category-supports-size-color-variants="categorySupportsSizeColorVariants"
                :stock="form.stock"
                :active-attribute-count="activeAttributeCount"
                :shipping-profile-summary="shippingProfileSummary"
                :coupon-code="selectedCoupon?.code ?? 'Sin cupon seleccionado'"
              />

              <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormToggleField v-model="form.isActive" label="Publicar producto (Activo/Desactivo)" variant="card" size="lg" />

                <FormToggleField v-model="form.isFeatured" label="Marcar como destacado" variant="card" size="lg" />
              </div>

              <ProductEditorialSection
                :form="form"
                :rich-text-editor="RichTextEditor"
                :editor-toolbar="editorToolbar"
                :description-length="descriptionLength"
                :graphic-description-length="graphicDescriptionLength"
                :usage-mode-length="usageModeLength"
              />

              <ProductFeaturesSection
                :features="form.features"
                :feature-error="formErrors.features"
                :add-feature="addFeature"
                :remove-feature="removeFeature"
              />

              <ProductInitialVariantsSection
                :visible="categorySupportsSizeColorVariants"
                :initial-variant-draft="initialVariantDraft"
                :initial-variant-errors="initialVariantErrors"
                :initial-variant-sku-preview="initialVariantSkuPreview"
                :initial-variants="initialVariants"
                :initial-variants-columns="initialVariantsColumns"
                :size-options="sizes.map(s => ({ value: s.id, label: s.name }))"
                :color-options="colors.map(c => ({ value: c.id, label: c.name }))"
                :on-initial-variant-sku-input="onInitialVariantSkuInput"
                :reset-initial-variant-sku="resetInitialVariantSku"
                :add-initial-variant="addInitialVariant"
                :remove-initial-variant="removeInitialVariant"
                :size-name-by-id="sizeNameById"
                :color-name-by-id="colorNameById"
                :fmt="fmt"
              />

              <ProductTagsSection
                :tags="tags"
                :selected-tag-ids="form.tagIds"
                :new-tag-name="newTagName"
                :creating-tag="creatingTag"
                :toggle-tag="toggleTag"
                :create-tag-inline="createTagInline"
                @update:new-tag-name="newTagName = $event"
              />

              <ProductRecommendationsSection
                :variant-product-search="variantProductSearch"
                :related-product-search="relatedProductSearch"
                :suggested-product-search="suggestedProductSearch"
                :selected-variant-products="selectedVariantProducts"
                :filtered-variant-products="filteredVariantProducts"
                :selected-related-products="selectedRelatedProducts"
                :filtered-related-products="filteredRelatedProducts"
                :selected-suggested-products="selectedSuggestedProducts"
                :filtered-suggested-products="filteredSuggestedProducts"
                :recommendation-image="recommendationImage"
                :recommendation-price="recommendationPrice"
                :open-variant-image-manager="openVariantImageManager"
                :edit-variant-product="editVariantProduct"
                :toggle-recommendation-product="toggleRecommendationProduct"
                :remove-recommendation-product="removeRecommendationProduct"
                :on-recommendation-drag-start="onRecommendationDragStart"
                :on-recommendation-drag-over="onRecommendationDragOver"
                :on-recommendation-drop="onRecommendationDrop"
                :on-recommendation-drag-end="onRecommendationDragEnd"
                @update:variant-product-search="variantProductSearch = $event"
                @update:related-product-search="relatedProductSearch = $event"
                @update:suggested-product-search="suggestedProductSearch = $event"
              />
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

        <ProductLinkedVariantsCard
          v-if="isEdit && product"
          :selected-variant-products="selectedVariantProducts"
          :variant-products-columns="variantProductsColumns"
          :recommendation-image="recommendationImage"
          :recommendation-price="recommendationPrice"
          :open-variant-image-manager="openVariantImageManager"
          :edit-variant-product="editVariantProduct"
          :remove-recommendation-product="removeRecommendationProduct"
        />
      </div>

      <div class="space-y-6">
        <ProductFormStatusCard
          :name-ready="form.name.trim().length >= 3"
          :category-ready="!!form.categoryId"
          :sku-ready="form.sku.trim().length >= 3"
          :price-ready="Number(form.basePrice) >= 0"
        />

        <ProductImagesSection
          :is-edit="isEdit"
          :product="product"
          :form-name="form.name"
          :image-upload="imageUpload"
          :uploading-image="uploadingImage"
          :sorted-images="sortedImages"
          :saving-image-order="savingImageOrder"
          :has-image-order-changes="hasImageOrderChanges"
          :existing-image-order="existingImageOrder"
          :image-action-loading="imageActionLoading"
          :image-by-id="imageById"
          :on-image-file-selected="onImageFileSelected"
          :remove-pending-image="removePendingImage"
          :on-pending-image-drag-start="onPendingImageDragStart"
          :on-pending-image-drag-over="onPendingImageDragOver"
          :on-pending-image-drop="onPendingImageDrop"
          :on-pending-image-drag-end="onPendingImageDragEnd"
          :upload-and-attach-image="uploadAndAttachImage"
          :save-image-order="saveImageOrder"
          :on-existing-image-drag-start="onExistingImageDragStart"
          :on-existing-image-drag-over="onExistingImageDragOver"
          :on-existing-image-drop="onExistingImageDrop"
          :on-existing-image-drag-end="onExistingImageDragEnd"
          :set-as-main="setAsMain"
          :remove-image="removeImage"
          :variant-image-modal="variantImageModal"
          :selected-variant-for-image="selectedVariantForImage"
          :variant-sorted-images="variantSortedImages"
          :close-variant-image-manager="closeVariantImageManager"
          :on-variant-image-file-selected="onVariantImageFileSelected"
          :upload-and-attach-variant-image="uploadAndAttachVariantImage"
          :attach-existing-product-image-to-variant="attachExistingProductImageToVariant"
          :set-variant-image-as-main="setVariantImageAsMain"
          :remove-variant-image="removeVariantImage"
        />
      </div>
    </div>
  </div>
</template>
