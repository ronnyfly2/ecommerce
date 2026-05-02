<script setup lang="ts">
import { computed, ref } from 'vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import { useToast } from '@/composables/useToast'
import { paymentsService, type Payment, type PaymentStatus } from '@/services/payments.service'
import { formatMoney } from '@/utils/currency'
import { extractErrorMessage } from '@/utils/error'

const props = defineProps<{ payment: Payment; canReview: boolean }>()
const emit = defineEmits<{ close: []; updated: [payment: Payment] }>()

const toast = useToast()
const rejecting = ref(false)
const approving = ref(false)
const refunding = ref(false)
const rejectionReason = ref('')
const showReject = ref(false)
const showRefund = ref(false)

const statusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  AWAITING_REVIEW: 'Para revisar',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}

const statusColors: Record<PaymentStatus, 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'warning',
  AWAITING_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  REFUNDED: 'neutral',
  FAILED: 'danger',
  CANCELLED: 'neutral',
}

const canApprove = computed(
  () => props.canReview && props.payment.status === 'AWAITING_REVIEW',
)
const canRefund = computed(
  () => props.canReview && props.payment.status === 'APPROVED',
)

const receiptIsImage = computed(
  () => !!props.payment.receiptMime?.startsWith('image/'),
)
const receiptIsPdf = computed(() => props.payment.receiptMime === 'application/pdf')

async function approve() {
  approving.value = true
  try {
    const updated = await paymentsService.review(props.payment.id, { decision: 'approve' })
    toast.success('Aprobado', 'El pago fue aprobado y se notifico al cliente')
    emit('updated', updated)
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    approving.value = false
  }
}

async function reject() {
  if (!rejectionReason.value.trim()) {
    toast.error('Motivo requerido', 'Indica una razon para el rechazo')
    return
  }
  rejecting.value = true
  try {
    const updated = await paymentsService.review(props.payment.id, {
      decision: 'reject',
      reason: rejectionReason.value.trim(),
    })
    toast.success('Rechazado', 'Se notifico al cliente con el motivo indicado')
    emit('updated', updated)
    showReject.value = false
    rejectionReason.value = ''
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    rejecting.value = false
  }
}

async function refund() {
  refunding.value = true
  try {
    const updated = await paymentsService.refund(props.payment.id, rejectionReason.value || undefined)
    toast.success('Reembolso emitido', 'El pago fue marcado como reembolsado')
    emit('updated', updated)
    showRefund.value = false
    rejectionReason.value = ''
  } catch (error) {
    toast.error('Error', extractErrorMessage(error))
  } finally {
    refunding.value = false
  }
}
</script>

<template>
  <UiModal :show="true" size="xl" title="Detalle del pago" @close="emit('close')">
    <div class="space-y-4">
      <!-- Summary -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-muted">Pago</p>
          <p class="font-mono">#{{ payment.id.slice(0, 8) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Orden</p>
          <p class="font-mono">#{{ payment.order.id.slice(0, 8) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Cliente</p>
          <p>{{ payment.order?.user?.email ?? '—' }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Monto</p>
          <p class="font-medium">{{ formatMoney(payment.amount, payment.currencyCode) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Metodo</p>
          <p>{{ payment.method?.label ?? payment.provider }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Estado</p>
          <UiBadge :color="statusColors[payment.status]" dot>
            {{ statusLabels[payment.status] }}
          </UiBadge>
        </div>
        <div v-if="payment.externalId">
          <p class="text-xs text-muted">ID externo</p>
          <p class="font-mono text-xs">{{ payment.externalId }}</p>
        </div>
        <div v-if="payment.reviewedAt">
          <p class="text-xs text-muted">Revisado</p>
          <p class="text-xs">{{ new Date(payment.reviewedAt).toLocaleString('es-AR') }}</p>
        </div>
      </div>

      <!-- Rejection reason if any -->
      <div v-if="payment.rejectionReason" class="rounded-md bg-danger-50 border border-danger-200 p-3">
        <p class="text-xs text-danger-700 font-medium">Motivo registrado</p>
        <p class="text-sm text-danger-800 mt-1 whitespace-pre-wrap">{{ payment.rejectionReason }}</p>
      </div>

      <!-- Receipt -->
      <div v-if="payment.receiptUrl">
        <p class="text-sm font-medium text-surface-800 mb-2">Comprobante</p>
        <div class="border border-surface-200 rounded-md overflow-hidden bg-surface-50">
          <img
            v-if="receiptIsImage"
            :src="payment.receiptUrl"
            alt="Comprobante"
            class="max-h-140 w-full object-contain bg-white"
          />
          <iframe
            v-else-if="receiptIsPdf"
            :src="payment.receiptUrl"
            class="w-full h-140"
            title="Comprobante"
          />
          <div v-else class="p-4 text-sm text-muted">
            {{ payment.receiptFilename }} ({{ payment.receiptMime }})
          </div>
          <div class="flex items-center justify-between text-xs text-muted px-3 py-2 bg-white border-t border-surface-200">
            <span>{{ payment.receiptFilename }}</span>
            <a
              :href="payment.receiptUrl"
              target="_blank"
              rel="noopener"
              class="text-primary-700 hover:underline"
            >
              Abrir en pestana nueva
            </a>
          </div>
        </div>
      </div>
      <div v-else class="text-sm text-muted italic">
        Sin comprobante adjunto.
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cerrar</UiButton>
      <UiButton
        v-if="canRefund"
        variant="ghost"
        :loading="refunding"
        @click="showRefund = true"
      >
        Reembolsar
      </UiButton>
      <UiButton
        v-if="canApprove"
        variant="ghost"
        :loading="rejecting"
        @click="showReject = true"
      >
        Rechazar
      </UiButton>
      <UiButton
        v-if="canApprove"
        :loading="approving"
        @click="approve"
      >
        Aprobar
      </UiButton>
    </template>

    <UiModal :show="showReject" title="Rechazar pago" size="md" @close="showReject = false">
      <div class="space-y-3">
        <p class="text-sm text-surface-700">
          Se notificara al cliente con el motivo indicado.
        </p>
        <UiTextarea
          v-model="rejectionReason"
          label="Motivo del rechazo"
          placeholder="Ej: El monto del comprobante no coincide con el total"
          :rows="3"
        />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="showReject = false">Cancelar</UiButton>
        <UiButton :loading="rejecting" :disabled="!rejectionReason.trim()" @click="reject">
          Rechazar
        </UiButton>
      </template>
    </UiModal>

    <UiModal :show="showRefund" title="Emitir reembolso" size="md" @close="showRefund = false">
      <div class="space-y-3">
        <p class="text-sm text-surface-700">
          El pago sera marcado como reembolsado. Si el proveedor soporta reembolsos automaticos, se ejecutara.
        </p>
        <UiTextarea
          v-model="rejectionReason"
          label="Motivo del reembolso"
          placeholder="Opcional"
          :rows="3"
        />
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="showRefund = false">Cancelar</UiButton>
        <UiButton :loading="refunding" @click="refund">Reembolsar</UiButton>
      </template>
    </UiModal>
  </UiModal>
</template>
