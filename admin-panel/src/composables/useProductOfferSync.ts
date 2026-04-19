type OfferSyncForm = {
  basePrice: number | string
  offerPrice: number | string
  offerPercentage: number | string
}

export function useProductOfferSync(form: OfferSyncForm) {
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

  return {
    syncOfferFromPrice,
    syncOfferFromPercentage,
  }
}
