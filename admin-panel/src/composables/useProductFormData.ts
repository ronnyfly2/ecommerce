import { ref, type ComputedRef, type Ref } from 'vue'
import { productsService } from '@/services/products.service'
import { couponsService } from '@/services/coupons.service'
import { currenciesService } from '@/services/currencies.service'
import { categoriesService, sizesService, colorsService, tagsService, measurementUnitsService } from '@/services/catalog.service'
import type { Category, Color, Coupon, Currency, MeasurementUnit, Product, ProductFeature, Size, Tag } from '@/types/api'
import { normalizeApiList } from '@/utils/api-list'
import { getSystemCurrencyCode } from '@/utils/system-currency'

type ProductFormModel = {
  name: string
  sku: string
  description: string
  graphicDescription: string
  usageMode: string
  basePrice: number
  currencyCode: string
  stock: number
  weightValue: number | string
  weightUnit: string
  lengthValue: number | string
  widthValue: number | string
  heightValue: number | string
  dimensionUnit: string
  couponId: string
  couponLink: string
  hasOffer: boolean
  offerPrice: number
  offerPercentage: number
  categoryId: string
  tagIds: string[]
  variantProductIds: string[]
  relatedProductIds: string[]
  suggestedProductIds: string[]
  attributeValues: Record<string, string | number | boolean>
  features: ProductFeature[]
  isActive: boolean
  isFeatured: boolean
}

export function useProductFormData(options: {
  isEdit: ComputedRef<boolean>
  id: ComputedRef<string>
  form: ProductFormModel
  availableRelatedProducts: Ref<Product[]>
  loadProductStock: () => Promise<void>
  previousProductCurrencyCode: Ref<string>
  syncingProductCurrencyChange: Ref<boolean>
  mapAttributeValuesToForm: (values: Product['attributeValues']) => Record<string, string | number | boolean>
  mapFeaturesToForm: (values: Product['features']) => ProductFeature[]
}) {
  const {
    isEdit,
    id,
    form,
    availableRelatedProducts,
    loadProductStock,
    previousProductCurrencyCode,
    syncingProductCurrencyChange,
    mapAttributeValuesToForm,
    mapFeaturesToForm,
  } = options

  const product = ref<Product | null>(null)
  const categories = ref<Category[]>([])
  const sizes = ref<Size[]>([])
  const colors = ref<Color[]>([])
  const currencies = ref<Currency[]>([])
  const tags = ref<Tag[]>([])
  const measurementUnits = ref<MeasurementUnit[]>([])
  const coupons = ref<Coupon[]>([])

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

    const activeWeightUnits = measurementUnits.value.filter((unit) => unit.isActive && unit.family === 'weight')
    if (activeWeightUnits.length && !activeWeightUnits.some((unit) => unit.code === form.weightUnit)) {
      form.weightUnit = activeWeightUnits[0].code
    }

    const activeDimensionUnits = measurementUnits.value.filter((unit) => unit.isActive && unit.family === 'length')
    if (activeDimensionUnits.length && !activeDimensionUnits.some((unit) => unit.code === form.dimensionUnit)) {
      form.dimensionUnit = activeDimensionUnits[0].code
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

    const [p] = await Promise.all([productsService.get(id.value), loadProductStock()])
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
    form.features = mapFeaturesToForm(p.features ?? [])
    form.isActive = p.isActive
    form.isFeatured = p.isFeatured
    previousProductCurrencyCode.value = form.currencyCode
    syncingProductCurrencyChange.value = false

    const seenIds = new Set<string>(availableRelatedProducts.value.map((item) => item.id))
    const allProducts: Product[] = [...availableRelatedProducts.value]
    for (const candidate of [
      ...(p.relatedProducts ?? []),
      ...(p.suggestedProducts ?? []),
      ...(p.variantProducts ?? []),
    ]) {
      if (!seenIds.has(candidate.id)) {
        seenIds.add(candidate.id)
        allProducts.push(candidate)
      }
    }
    availableRelatedProducts.value = allProducts.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  return {
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
  }
}
