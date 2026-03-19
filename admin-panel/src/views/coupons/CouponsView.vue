<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { couponsService } from '@/services/coupons.service'
import { extractErrorMessage } from '@/utils/error'
import { CouponType } from '@/types/api'
import type { Coupon } from '@/types/api'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiConfirm from '@/components/ui/UiConfirm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const coupons = ref<Coupon[]>([])
const loading = ref(false)

const formModal = reactive({
  show: false,
  loading: false,
  isEdit: false,
  id: '',
  code: '',
  type: CouponType.PERCENTAGE as CouponType,
  value: '0',
  minOrderAmount: '0',
  maxUsage: '' as string | number,
  startDate: '',
  endDate: '',
  isActive: true,
})

const confirm = reactive({ show: false, id: '', code: '', loading: false })

const couponTypeOptions = [
  { value: CouponType.PERCENTAGE, label: 'Porcentaje (%)' },
  { value: CouponType.FIXED_AMOUNT, label: 'Monto fijo' },
]

function fmt(n: string | number) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
}

async function load() {
  loading.value = true
  try {
    coupons.value = await couponsService.list()
  } catch {
    toast.error('Error', 'No se pudieron cargar los cupones')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formModal.isEdit = false
  formModal.id = ''
  formModal.code = ''
  formModal.type = CouponType.PERCENTAGE
  formModal.value = '0'
  formModal.minOrderAmount = '0'
  formModal.maxUsage = ''
  formModal.startDate = ''
  formModal.endDate = ''
  formModal.isActive = true
}

function openCreate() {
  resetForm()
  formModal.show = true
}

function openEdit(coupon: Coupon) {
  formModal.isEdit = true
  formModal.id = coupon.id
  formModal.code = coupon.code
  formModal.type = coupon.type
  formModal.value = coupon.value
  formModal.minOrderAmount = coupon.minOrderAmount
  formModal.maxUsage = coupon.maxUsage ?? ''
  formModal.startDate = coupon.startDate ? coupon.startDate.slice(0, 10) : ''
  formModal.endDate = coupon.endDate ? coupon.endDate.slice(0, 10) : ''
  formModal.isActive = coupon.isActive
  formModal.show = true
}

async function saveCoupon() {
  formModal.loading = true
  try {
    const payload = {
      code: formModal.code.trim().toUpperCase(),
      type: formModal.type,
      value: String(formModal.value),
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <UiButton @click="openCreate">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Nuevo cupón
      </UiButton>
    </div>

    <UiCard :padding="false">
      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 6" :key="i" class="h-11 rounded-lg bg-[--color-surface-100] animate-pulse" />
      </div>

      <div v-else-if="!coupons.length" class="text-muted text-center py-16">
        No hay cupones
      </div>

      <div v-else class="overflow-x-auto -mb-6">
        <table class="table-base">
          <thead>
            <tr>
              <th class="table-th">Código</th>
              <th class="table-th">Tipo</th>
              <th class="table-th text-right">Valor</th>
              <th class="table-th text-right">Mínimo</th>
              <th class="table-th text-center">Uso</th>
              <th class="table-th text-center">Estado</th>
              <th class="table-th" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in coupons" :key="c.id" class="table-tr-hover">
              <td class="table-td">
                <span class="font-mono text-sm font-medium">{{ c.code }}</span>
              </td>
              <td class="table-td">
                {{ c.type === CouponType.PERCENTAGE ? 'Porcentaje' : 'Monto fijo' }}
              </td>
              <td class="table-td text-right font-medium">
                {{ c.type === CouponType.PERCENTAGE ? `${c.value}%` : fmt(c.value) }}
              </td>
              <td class="table-td text-right">{{ fmt(c.minOrderAmount) }}</td>
              <td class="table-td text-center">
                {{ c.usageCount }}{{ c.maxUsage ? ` / ${c.maxUsage}` : '' }}
              </td>
              <td class="table-td text-center">
                <UiBadge :color="c.isActive ? 'success' : 'neutral'" dot>
                  {{ c.isActive ? 'Activo' : 'Inactivo' }}
                </UiBadge>
              </td>
              <td class="table-td text-right">
                <div class="flex items-center gap-2 justify-end">
                  <UiButton size="sm" variant="ghost" @click="openEdit(c)">Editar</UiButton>
                  <UiButton size="sm" variant="danger" @click="askDelete(c)">Eliminar</UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <UiModal
      :show="formModal.show"
      :title="formModal.isEdit ? 'Editar cupón' : 'Nuevo cupón'"
      size="md"
      @close="formModal.show = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiInput v-model="formModal.code" label="Código" required placeholder="SUMMER20" />
        <UiSelect v-model="formModal.type" label="Tipo" :options="couponTypeOptions" />

        <UiInput v-model="formModal.value" label="Valor" type="number" min="0" step="0.01" required />
        <UiInput v-model="formModal.minOrderAmount" label="Monto mínimo" type="number" min="0" step="0.01" />

        <UiInput v-model="formModal.maxUsage" label="Uso máximo" type="number" min="1" placeholder="Sin límite" />

        <div class="flex items-center pt-7">
          <label class="flex items-center gap-2 text-sm text-[--color-surface-700]">
            <input v-model="formModal.isActive" type="checkbox" class="accent-[--color-primary-600]" />
            Activo
          </label>
        </div>

        <UiInput v-model="formModal.startDate" label="Fecha inicio" type="date" />
        <UiInput v-model="formModal.endDate" label="Fecha fin" type="date" />
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="formModal.show = false">Cancelar</UiButton>
        <UiButton :loading="formModal.loading" @click="saveCoupon">Guardar</UiButton>
      </template>
    </UiModal>

    <UiConfirm
      :show="confirm.show"
      title="Eliminar cupón"
      :message="`¿Eliminar el cupón ${confirm.code}?`"
      :loading="confirm.loading"
      @confirm="removeCoupon"
      @cancel="confirm.show = false"
    />
  </div>
</template>
