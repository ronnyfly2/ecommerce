import { http } from './http'
import type { ApiResponse, ApiPaginatedData, Order, User } from '@/types/api'

export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUNDED'
  | 'FAILED'
  | 'CANCELLED'

export type PaymentProviderType = 'MANUAL_TRANSFER' | 'STRIPE' | 'CASH_ON_DELIVERY'

export type PaymentMethodType =
  | 'BANK_TRANSFER'
  | 'CREDIT_CARD'
  | 'CASH'
  | 'DIGITAL_WALLET'

export interface PaymentMethod {
  id: string
  code: string
  label: string
  description: string | null
  provider: PaymentProviderType
  type: PaymentMethodType
  isEnabled: boolean
  displayOrder: number
  instructions: string | null
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  order: Order
  method: PaymentMethod | null
  provider: PaymentProviderType
  status: PaymentStatus
  amount: string
  currencyCode: string
  externalId: string | null
  checkoutUrl: string | null
  receiptUrl: string | null
  receiptFilename: string | null
  receiptMime: string | null
  receiptSize: number | null
  receiptUploadedAt: string | null
  reviewedBy: User | null
  reviewedAt: string | null
  rejectionReason: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface QueryPaymentsDto {
  page?: number
  limit?: number
  status?: PaymentStatus
  provider?: PaymentProviderType
  orderId?: string
}

export interface CreatePaymentDto {
  orderId: string
  paymentMethodId: string
  returnUrl?: string
  cancelUrl?: string
}

export interface ReviewPaymentDto {
  decision: 'approve' | 'reject'
  reason?: string
}

export interface UpsertPaymentMethodDto {
  code: string
  label: string
  description?: string
  provider: PaymentProviderType
  type: PaymentMethodType
  isEnabled?: boolean
  displayOrder?: number
  instructions?: string
  config?: Record<string, unknown>
}

export const paymentsService = {
  async list(query: QueryPaymentsDto = {}): Promise<ApiPaginatedData<Payment>> {
    const res = await http.get<ApiResponse<ApiPaginatedData<Payment>>>('/payments', {
      params: query,
    })
    return res.data.data
  },

  async get(id: string): Promise<Payment> {
    const res = await http.get<ApiResponse<Payment>>(`/payments/${id}`)
    return res.data.data
  },

  async create(input: CreatePaymentDto): Promise<Payment> {
    const res = await http.post<ApiResponse<Payment>>('/payments', input)
    return res.data.data
  },

  async uploadReceipt(id: string, file: File): Promise<Payment> {
    const form = new FormData()
    form.append('receipt', file)
    const res = await http.post<ApiResponse<Payment>>(
      `/payments/${id}/receipt`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },

  async cancel(id: string): Promise<Payment> {
    const res = await http.delete<ApiResponse<Payment>>(`/payments/${id}`)
    return res.data.data
  },

  async review(id: string, input: ReviewPaymentDto): Promise<Payment> {
    const res = await http.patch<ApiResponse<Payment>>(`/payments/${id}/review`, input)
    return res.data.data
  },

  async refund(id: string, reason?: string): Promise<Payment> {
    const res = await http.post<ApiResponse<Payment>>(`/payments/${id}/refund`, { reason })
    return res.data.data
  },

  async listPublicMethods(): Promise<PaymentMethod[]> {
    const res = await http.get<ApiResponse<PaymentMethod[]>>('/payments/methods')
    return res.data.data
  },
}

export const paymentMethodsService = {
  async list(): Promise<PaymentMethod[]> {
    const res = await http.get<ApiResponse<PaymentMethod[]>>('/payment-methods')
    return res.data.data
  },

  async get(id: string): Promise<PaymentMethod> {
    const res = await http.get<ApiResponse<PaymentMethod>>(`/payment-methods/${id}`)
    return res.data.data
  },

  async create(input: UpsertPaymentMethodDto): Promise<PaymentMethod> {
    const res = await http.post<ApiResponse<PaymentMethod>>('/payment-methods', input)
    return res.data.data
  },

  async update(id: string, input: UpsertPaymentMethodDto): Promise<PaymentMethod> {
    const res = await http.put<ApiResponse<PaymentMethod>>(`/payment-methods/${id}`, input)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/payment-methods/${id}`)
  },
}
