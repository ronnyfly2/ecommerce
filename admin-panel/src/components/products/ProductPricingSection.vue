<script setup lang="ts">
import { CouponType } from '@/types/api'
import type { Coupon } from '@/types/api'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'

type PricingFormModel = {
  basePrice: number | string
  currencyCode: string
  hasOffer: boolean
  offerPrice: number | string
  offerPercentage: number | string
  couponId: string
  couponLink: string
}

defineProps<{
  form: PricingFormModel
  formErrors: {
    offer: string
    couponLink: string
  }
  defaultCurrencyName: string
  defaultCurrencyCode: string
  basePriceInDefaultCurrency: number
  offerPriceInDefaultCurrency: number
  offerPricePreview: string
  offerDelta: number
  coupons: Coupon[]
  selectedCoupon: Coupon | null
  fmt: (n: number | string, currencyCode?: string) => string
  syncOfferFromPrice: () => void
  syncOfferFromPercentage: () => void
}>()

function couponValueLabel(coupon: Coupon, fmt: (n: number | string, currencyCode?: string) => string) {
  if (coupon.type === CouponType.PERCENTAGE) {
    return `${coupon.value}%`
  }
  return fmt(coupon.value, coupon.currencyCode)
}

function couponTypeLabel(coupon: Coupon) {
  return coupon.type === CouponType.PERCENTAGE ? 'Porcentaje' : 'Monto fijo'
}
</script>

<template>
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
        Descuento: <strong>{{ couponValueLabel(selectedCoupon, fmt) }}</strong>
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
</template>
