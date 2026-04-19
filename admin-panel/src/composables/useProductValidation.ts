type ProductFeatureLike = {
  icon?: string | null
  name?: string | null
}

type ProductValidationForm = {
  name: string
  sku: string
  categoryId: string
  basePrice: number | string
  stock: number | string
  couponLink: string
  hasOffer: boolean
  offerPrice: number | string
  offerPercentage: number | string
  features: ProductFeatureLike[]
}

type ProductValidationErrors = {
  name: string
  sku: string
  categoryId: string
  basePrice: string
  stock: string
  offer: string
  couponLink: string
  features: string
}

type UseProductValidationOptions = {
  form: ProductValidationForm
  formErrors: ProductValidationErrors
  normalizeSku: (value: string) => string
}

export function useProductValidation(options: UseProductValidationOptions) {
  const { form, formErrors, normalizeSku } = options

  function isValidCouponLink(value: string) {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
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

  function syncOfferAndCouponErrors() {
    formErrors.offer = getOfferError()
    formErrors.couponLink = form.couponLink && !isValidCouponLink(form.couponLink)
      ? 'Ingresa un enlace valido (incluye http:// o https://)'
      : ''
  }

  function validateForm() {
    formErrors.name = ''
    formErrors.sku = ''
    formErrors.categoryId = ''
    formErrors.basePrice = ''
    formErrors.stock = ''
    formErrors.offer = ''
    formErrors.couponLink = ''
    formErrors.features = ''

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

    const hasIncompleteFeature = form.features.some((feature) => {
      const icon = feature.icon?.trim() || ''
      const name = feature.name?.trim() || ''
      return (icon || name) && (!icon || !name)
    })

    if (hasIncompleteFeature) {
      formErrors.features = 'Cada caracteristica debe incluir icono/imagen SVG y nombre'
    }

    formErrors.offer = getOfferError()

    return (
      !formErrors.name &&
      !formErrors.sku &&
      !formErrors.categoryId &&
      !formErrors.basePrice &&
      !formErrors.stock &&
      !formErrors.offer &&
      !formErrors.couponLink &&
      !formErrors.features
    )
  }

  return {
    validateForm,
    isValidCouponLink,
    getOfferError,
    syncOfferAndCouponErrors,
  }
}
