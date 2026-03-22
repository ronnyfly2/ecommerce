<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { couponsService } from '@/services/coupons.service'
import { currenciesService } from '@/services/currencies.service'
import { extractErrorMessage } from '@/utils/error'
import { CouponType } from '@/types/api'
import type { Coupon, Currency } from '@/types/api'
import { normalizeApiList } from '@/utils/api-list'
import { formatMoney } from '@/utils/currency'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import UiTable from '@/components/ui/UiTable.vue'
import FormModalActions from '@/components/forms/FormModalActions.vue'
import FormToggleField from '@/components/forms/FormToggleField.vue'
import { useToast } from '@/composables/useToast'
import { getSystemCurrencyCode } from '@/utils/system-currency'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()
const auth = useAuthStore()
const coupons = ref<Coupon[] | null>(null)
const currencies = ref<Currency[]>([])
const selectedCurrencyCode = ref('')
const tableLoading = computed(() => coupons.value === null)
const tableEmpty = computed(() => !tableLoading.value && displayedCoupons.value.length === 0)
const canManageCoupons = computed(() => auth.can('coupons.manage'))

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  code: '',
  type: CouponType.PERCENTAGE as CouponType,
  value: '0',
  currencyCode: getSystemCurrencyCode(),
  minOrderAmount: '0',
  maxUsage: '' as string | number,
  startDate: '',
  endDate: '',
  isActive: true,
})
const previousCouponCurrencyCode = ref(formModal.currencyCode)
const syncingCouponCurrencyChange = ref(false)

const confirm = reactive({ show: false, id: '', code: '', loading: false })

const couponTypeOptions = [
  { value: CouponType.PERCENTAGE, label: 'Porcentaje (%)' },
  { value: CouponType.FIXED_AMOUNT, label: 'Monto fijo' },
]

const displayedCoupons = computed(() => {
  if (!selectedCurrencyCode.value) {
    return coupons.value ?? []
  }

  return (coupons.value ?? []).filter((coupon) => coupon.currencyCode === selectedCurrencyCode.value)
})

function currencyLabel(code: string) {
  const item = currencies.value.find((currency) => currency.code === code)
  return item ? `${item.code} (${item.symbol})` : code
}

function fmtBy(code: string, n: string | number) {
  return formatMoney(n, code)
}

async function load() {
  coupons.value = null
  try {
    const [couponData, currencyData] = await Promise.all([
      couponsService.list(),
      currenciesService.list(),
    ])
    coupons.value = normalizeApiList(couponData).items
    currencies.value = currencyData.filter((item) => item.isActive)
  } catch {
    coupons.value = []
    toast.error('Error', 'No se pudieron cargar los cupones')
  }
}

function resetForm() {
  syncingCouponCurrencyChange.value = true
  formModal.isEdit = false
  formModal.id = ''
  formModal.code = ''
  formModal.type = CouponType.PERCENTAGE
  formModal.value = '0'
  formModal.currencyCode = getSystemCurrencyCode()
  formModal.minOrderAmount = '0'
  formModal.maxUsage = ''
  formModal.startDate = ''
  formModal.endDate = ''
  formModal.isActive = true
  previousCouponCurrencyCode.value = formModal.currencyCode
  syncingCouponCurrencyChange.value = false
}

function openCreate() {
  resetForm()
  formModal.show = true
}

function openEdit(coupon: Coupon) {
  syncingCouponCurrencyChange.value = true
  formModal.isEdit = true
  formModal.id = coupon.id
  formModal.code = coupon.code
  formModal.type = coupon.type
  formModal.value = coupon.value
  formModal.currencyCode = coupon.currencyCode || getSystemCurrencyCode()
  formModal.minOrderAmount = coupon.minOrderAmount
  formModal.maxUsage = coupon.maxUsage ?? ''
  formModal.startDate = coupon.startDate ? coupon.startDate.slice(0, 10) : ''
  formModal.endDate = coupon.endDate ? coupon.endDate.slice(0, 10) : ''
  formModal.isActive = coupon.isActive
  previousCouponCurrencyCode.value = formModal.currencyCode
  syncingCouponCurrencyChange.value = false
  formModal.show = true
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

async function saveCoupon() {
  formModal.loading = true
  try {
    const payload = {
      code: formModal.code.trim().toUpperCase(),
      type: formModal.type,
      value: String(formModal.value),
      currencyCode: formModal.currencyCode,
      minOrderAmount: String(formModal.minOrderAmount || '0'),
      maxUsage: formModal.maxUsage === '' ? undefined : Number(formModal.maxUsage),
      startDate: formModal.startDate || undefined,
      endDate: formModal.endDate || undefined,
      isActive: formModal.isActive,
    }

    if (formModal.isEdit) {
      await couponsService.update(formModal.id, payload)
      toast.success('Cupón actualizado')
    } else {
      await couponsService.create(payload)
      toast.success('Cupón creado')
    }

    formModal.show = false
    await load()
  } catch (e) {
    toast.error('Error', extractErrorMessage(e, 'No se pudo guardar'))
  } finally {
    formModal.loading = false
  }
}

function askDelete(coupon: Coupon) {
  confirm.id = coupon.id
  confirm.code = coupon.code
  confirm.show = true
}

async function removeCoupon() {
  confirm.loading = true
  try {
    await couponsService.remove(confirm.id)
    toast.success('Eliminado', `Cupón ${confirm.code} eliminado`)
    confirm.show = false
    await load()
  } catch {
    toast.error('Error', 'No se pudo eliminar el cupón')
  } finally {
    confirm.loading = false
  }
}

onMounted(load)

watch(
  () => formModal.currencyCode,
  (nextCurrencyCode) => {
    const previousCurrencyCode = previousCouponCurrencyCode.value
    if (syncingCouponCurrencyChange.value) {
      previousCouponCurrencyCode.value = nextCurrencyCode
      return
    }

    if (!nextCurrencyCode || !previousCurrencyCode || nextCurrencyCode === previousCurrencyCode) {
      previousCouponCurrencyCode.value = nextCurrencyCode
      return
    }

    if (formModal.type === CouponType.FIXED_AMOUNT) {
      const convertedValue = convertBetweenCurrencies(
        Number(formModal.value || 0),
        previousCurrencyCode,
        nextCurrencyCode,
      )
      formModal.value = String(convertedValue)
    }

    const convertedMinOrderAmount = convertBetweenCurrencies(
      Number(formModal.minOrderAmount || 0),
      previousCurrencyCode,
      nextCurrencyCode,
    )
    formModal.minOrderAmount = String(convertedMinOrderAmount)

    previousCouponCurrencyCode.value = nextCurrencyCode
  },
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <UiSelect
          v-model="selectedCurrencyCode"
          :options="[
            { value: '', label: 'Todas las monedas' },
            ...currencies.map(c => ({ value: c.code, label: `${c.code} (${c.symbol})` })),
          ]"
          class="w-full sm:min-w-55 sm:max-w-xs"
        />
        <UiButton v-if="canManageCoupons" @click="openCreate">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo cupón
        </UiButton>
      </div>
    </div>

    <UiCard :padding="false">
      <UiTable :data="displayedCoupons" :loading="tableLoading" :empty="tableEmpty" loading-color="primary" loading-text="Cargando cupones..." empty-message="No hay cupones">
        <template #head>
          <tr>
            <th class="table-th">Código</th>
            <th class="table-th">Tipo</th>
            <th class="table-th">Moneda</th>
            <th class="table-th text-right">Valor</th>
            <th class="table-th text-right">Mínimo</th>
            <th class="table-th text-center">Uso</th>
            <th class="table-th text-center">Estado</th>
            <th class="table-th table-actions-th" />
          </tr>
        </template>

        <tr v-for="c in displayedCoupons" :key="c.id" class="table-tr-hover">
          <td class="table-td">
            <span class="font-mono text-sm font-medium">{{ c.code }}</span>
          </td>
          <td class="table-td">
            {{ c.type === CouponType.PERCENTAGE ? 'Porcentaje' : 'Monto fijo' }}
          </td>
          <td class="table-td text-muted text-xs">{{ currencyLabel(c.currencyCode) }}</td>
          <td class="table-td text-right font-medium">
            {{ c.type === CouponType.PERCENTAGE ? `${c.value}%` : fmtBy(c.currencyCode, c.value) }}
          </td>
          <td class="table-td text-right">{{ fmtBy(c.currencyCode, c.minOrderAmount) }}</td>
          <td class="table-td text-center">
            {{ c.usageCount }}{{ c.maxUsage ? ` / ${c.maxUsage}` : '' }}
          </td>
          <td class="table-td text-center">
            <UiBadge :color="c.isActive ? 'success' : 'neutral'" dot>
              {{ c.isActive ? 'Activo' : 'Inactivo' }}
            </UiBadge>
          </td>
          <td class="table-td table-actions-td text-right">
            <div class="flex items-center gap-2 justify-end">
              <UiButton v-if="canManageCoupons" size="sm" variant="ghost" @click="openEdit(c)">Editar</UiButton>
              <UiButton v-if="canManageCoupons" size="sm" variant="danger" @click="askDelete(c)">Eliminar</UiButton>
            </div>
          </td>
        </tr>

        <template #empty-actions>
          <UiButton v-if="canManageCoupons" size="sm" @click="openCreate">Crear cupón</UiButton>
        </template>
      </UiTable>
    </UiCard>

    <UiModal
      v-if="canManageCoupons"
      :show="formModal.show"
      :title="formModal.isEdit ? 'Editar cupón' : 'Nuevo cupón'"
      size="md"
      @close="formModal.show = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput v-model="formModal.code" label="Código" required placeholder="SUMMER20" />
        <UiSelect v-model="formModal.type" label="Tipo" :options="couponTypeOptions" />
        <UiSelect
          v-model="formModal.currencyCode"
          label="Moneda"
          :options="currencies.map(c => ({ value: c.code, label: `${c.code} (${c.symbol})` }))"
        />

        <UiInput v-model="formModal.value" label="Valor" type="number" min="0" step="0.01" required />
        <UiInput v-model="formModal.minOrderAmount" label="Monto mínimo" type="number" min="0" step="0.01" />

        <UiInput v-model="formModal.maxUsage" label="Uso máximo" type="number" min="1" placeholder="Sin límite" />

        <div class="flex items-center pt-7">
          <FormToggleField v-model="formModal.isActive" label="Activo" />
        </div>

        <UiInput v-model="formModal.startDate" label="Fecha inicio" type="date" />
        <UiInput v-model="formModal.endDate" label="Fecha fin" type="date" />
      </div>

      <template #footer>
        <FormModalActions :loading="formModal.loading" @cancel="formModal.show = false" @save="saveCoupon" />
      </template>
    </UiModal>

    <UiConfirm
      v-if="canManageCoupons"
      :show="confirm.show"
      title="Eliminar cupón"
      :message="`¿Eliminar el cupón ${confirm.code}?`"
      :loading="confirm.loading"
      @confirm="removeCoupon"
      @cancel="confirm.show = false"
    />
  </div>
</template>
