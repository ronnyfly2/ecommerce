<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/error'
import { formatMoney } from '@/utils/currency'
import {
  paymentsService,
  type Payment,
  type PaymentMethod,
  type PaymentProviderType,
} from '@/services/payments.service'
import type { Order } from '@/types/api'

const props = defineProps<{
  order: Order
  existingPayments: Payment[]
}>()
const emit = defineEmits<{ close: []; created: [payment: Payment] }>()

const toast = useToast()
const methods = ref<PaymentMethod[]>([])
const loadingMethods = ref(true)
const submitting = ref(false)
const selectedMethodId = ref('')

const providerLabels: Record<PaymentProviderType, string> = {
  MANUAL_TRANSFER: 'Transferencia',
  STRIPE: 'Stripe',
  CASH_ON_DELIVERY: 'Contra entrega',
}

const methodOptions = computed(() => [
  { value: '', label: 'Selecciona un metodo' },
  ...methods.value.map((m) => ({
    value: m.id,
    label: `${m.label} · ${providerLabels[m.provider]}`,
  })),
])

const selectedMethod = computed(
  () => methods.value.find((m) => m.id === selectedMethodId.value) ?? null,
)

const hasApprovedPayment = computed(() =>
  props.existingPayments.some((p) => p.status === 'APPROVED'),
)

const hasOpenPayment = computed(() =>
  props.existingPayments.some((p) =>
    ['PENDING', 'AWAITING_REVIEW'].includes(p.status),
  ),
)

const canSubmit = computed(
  () => !submitting.value && !!selectedMethodId.value && !hasApprovedPayment.value,
)

async function load() {
  loadingMethods.value = true
  try {
    methods.value = await paymentsService.listPublicMethods()
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudieron cargar los metodos de pago'))
    methods.value = []
  } finally {
    loadingMethods.value = false
  }
}

async function submit() {
  if (!canSubmit.value || !selectedMethod.value) return
  submitting.value = true
  try {
    const payment = await paymentsService.create({
      orderId: props.order.id,
      paymentMethodId: selectedMethod.value.id,
    })

    if (payment.checkoutUrl) {
      window.open(payment.checkoutUrl, '_blank', 'noopener,noreferrer')
      toast.success('Pago iniciado', 'Se abrió el checkout en una nueva pestaña')
    } else if (payment.provider === 'CASH_ON_DELIVERY') {
      toast.success('Pago registrado', 'Se cobrará en efectivo al entregar')
    } else if (payment.provider === 'MANUAL_TRANSFER') {
      toast.success('Pago registrado', 'El cliente debe subir el comprobante')
    } else {
      toast.success('Pago creado', `Estado: ${payment.status}`)
    }

    emit('created', payment)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error, 'No se pudo registrar el pago'))
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <UiModal :show="true" size="lg" title="Registrar pago" @close="emit('close')">
    <div class="space-y-5">
      <!-- Order summary -->
      <section class="rounded-md bg-surface-50 border border-surface-200 px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-muted">Orden</p>
            <p class="font-mono text-sm">#{{ order.id.slice(0, 8) }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-muted">Total a cobrar</p>
            <p class="text-lg font-semibold">{{ formatMoney(order.total, order.currencyCode) }}</p>
          </div>
        </div>
      </section>

      <!-- Existing payment warnings -->
      <div
        v-if="hasApprovedPayment"
        class="rounded-md bg-success-50 border border-success-200 px-4 py-3 text-sm text-success-700"
      >
        Esta orden ya tiene un pago aprobado. No es posible registrar otro pago.
      </div>
      <div
        v-else-if="hasOpenPayment"
        class="rounded-md bg-warning-50 border border-warning-200 px-4 py-3 text-sm text-warning-700"
      >
        Esta orden ya tiene un pago en curso. Si registras otro, conviven hasta que uno se apruebe o cancele.
      </div>

      <!-- Method picker -->
      <section v-if="!hasApprovedPayment">
        <UiSelect
          v-model="selectedMethodId"
          label="Metodo de pago"
          size="lg"
          :options="methodOptions"
          :disabled="loadingMethods"
        />
        <p v-if="!loadingMethods && methods.length === 0" class="mt-2 text-xs text-warning-700">
          No hay metodos de pago habilitados. Configura uno en Pagos → Metodos.
        </p>
      </section>

      <!-- Method preview -->
      <section
        v-if="selectedMethod"
        class="rounded-md border border-surface-200 px-4 py-3 space-y-2"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-medium text-surface-900">{{ selectedMethod.label }}</p>
          <UiBadge color="info">{{ providerLabels[selectedMethod.provider] }}</UiBadge>
        </div>
        <p v-if="selectedMethod.description" class="text-sm text-muted">
          {{ selectedMethod.description }}
        </p>
        <div
          v-if="selectedMethod.instructions"
          class="rounded-md bg-surface-50 border border-surface-200 px-3 py-2 text-sm text-surface-700 whitespace-pre-wrap"
        >
          {{ selectedMethod.instructions }}
        </div>
      </section>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cancelar</UiButton>
      <UiButton :loading="submitting" :disabled="!canSubmit" @click="submit">
        Registrar pago
      </UiButton>
    </template>
  </UiModal>
</template>
