import { http } from './http'
import type { ApiResponse, ApiPaginatedData, Order, OrderItem, User } from '@/types/api'

export type ShipmentStatus =
  | 'PENDING'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED'

export type ShipmentEventType =
  | 'STATUS_CHANGE'
  | 'LOCATION_UPDATE'
  | 'NOTE'
  | 'EXCEPTION'

export interface Carrier {
  id: string
  code: string
  label: string
  description: string | null
  trackingUrlTemplate: string | null
  isEnabled: boolean
  displayOrder: number
  logoUrl: string | null
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ShipmentItem {
  id: string
  orderItem: OrderItem
  quantity: number
}

export interface ShipmentEvent {
  id: string
  type: ShipmentEventType
  status: ShipmentStatus | null
  location: string | null
  lat: string | null
  lng: string | null
  description: string | null
  occurredAt: string
  createdBy: User | null
  createdAt: string
}

export interface Shipment {
  id: string
  order: Order
  carrier: Carrier | null
  status: ShipmentStatus
  trackingNumber: string | null
  trackingUrl: string | null
  shippingCost: string
  currencyCode: string
  shipToName: string | null
  shipToStreet: string | null
  shipToCity: string | null
  shipToState: string | null
  shipToPostalCode: string | null
  shipToCountry: string | null
  shipToPhone: string | null
  shipToLat: string | null
  shipToLng: string | null
  estimatedDeliveryAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  notes: string | null
  metadata: Record<string, unknown>
  items: ShipmentItem[]
  events?: ShipmentEvent[]
  createdAt: string
  updatedAt: string
}

export interface QueryShipmentsDto {
  page?: number
  limit?: number
  status?: ShipmentStatus
  orderId?: string
  carrierId?: string
  trackingNumber?: string
}

export interface CreateShipmentItemDto {
  orderItemId: string
  quantity: number
}

export interface CreateShipmentDto {
  orderId: string
  carrierId?: string
  trackingNumber?: string
  trackingUrl?: string
  shippingCost?: string
  currencyCode?: string
  shipToName?: string
  shipToStreet?: string
  shipToCity?: string
  shipToState?: string
  shipToPostalCode?: string
  shipToCountry?: string
  shipToPhone?: string
  shipToLat?: number
  shipToLng?: number
  estimatedDeliveryAt?: string
  notes?: string
  items: CreateShipmentItemDto[]
}

export interface UpdateShipmentDto {
  carrierId?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  shippingCost?: string
  currencyCode?: string
  shipToName?: string | null
  shipToStreet?: string | null
  shipToCity?: string | null
  shipToState?: string | null
  shipToPostalCode?: string | null
  shipToCountry?: string | null
  shipToPhone?: string | null
  shipToLat?: number | null
  shipToLng?: number | null
  estimatedDeliveryAt?: string | null
  notes?: string | null
}

export interface UpdateShipmentStatusDto {
  status: ShipmentStatus
  note?: string
  location?: string
  occurredAt?: string
}

export interface AddShipmentEventDto {
  type?: ShipmentEventType
  status?: ShipmentStatus
  location?: string
  lat?: number
  lng?: number
  description?: string
  occurredAt?: string
}

export interface UpsertCarrierDto {
  code: string
  label: string
  description?: string
  trackingUrlTemplate?: string
  logoUrl?: string
  isEnabled?: boolean
  displayOrder?: number
  config?: Record<string, unknown>
}

type ShipmentListPayload =
  | ApiPaginatedData<Shipment>
  | Shipment[]
  | {
      items?: Shipment[]
      total?: number
      page?: number
      limit?: number
      totalPages?: number
    }

type LegacyShipmentListPayload = {
  items?: Shipment[]
  total?: number
  page?: number
  limit?: number
  totalPages?: number
}

function normalizeShipmentListPayload(payload: ShipmentListPayload): ApiPaginatedData<Shipment> {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: {
        total: payload.length,
        page: 1,
        limit: payload.length || 20,
        totalPages: payload.length > 0 ? 1 : 0,
      },
    }
  }

  // Standard shape: { items, meta }
  if ('meta' in payload && payload.meta && Array.isArray(payload.items)) {
    const normalizedLimit = payload.meta.limit ?? (payload.items.length || 20)
    return {
      items: payload.items,
      meta: {
        total: payload.meta.total ?? payload.items.length,
        page: payload.meta.page ?? 1,
        limit: normalizedLimit,
        totalPages: payload.meta.totalPages ?? 1,
      },
    }
  }

  // Legacy shape: { items, total, page, limit, totalPages }
  const legacy = payload as LegacyShipmentListPayload
  const items = Array.isArray(legacy.items) ? legacy.items : []
  const total = legacy.total ?? items.length
  const limit = legacy.limit ?? (items.length || 20)
  const page = legacy.page ?? 1
  const totalPages = legacy.totalPages ?? Math.ceil(total / Math.max(limit, 1))

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

export const shipmentsService = {
  async list(query: QueryShipmentsDto = {}): Promise<ApiPaginatedData<Shipment>> {
    const res = await http.get<ApiResponse<ShipmentListPayload>>('/shipments', {
      params: query,
    })
    return normalizeShipmentListPayload(res.data.data)
  },

  async get(id: string): Promise<Shipment> {
    const res = await http.get<ApiResponse<Shipment>>(`/shipments/${id}`)
    return res.data.data
  },

  async byOrder(orderId: string): Promise<Shipment[]> {
    const res = await http.get<ApiResponse<Shipment[]>>(`/shipments/by-order/${orderId}`)
    return res.data.data
  },

  async events(id: string): Promise<ShipmentEvent[]> {
    const res = await http.get<ApiResponse<ShipmentEvent[]>>(`/shipments/${id}/events`)
    return res.data.data
  },

  async create(input: CreateShipmentDto): Promise<Shipment> {
    const res = await http.post<ApiResponse<Shipment>>('/shipments', input)
    return res.data.data
  },

  async update(id: string, input: UpdateShipmentDto): Promise<Shipment> {
    const res = await http.put<ApiResponse<Shipment>>(`/shipments/${id}`, input)
    return res.data.data
  },

  async updateStatus(id: string, input: UpdateShipmentStatusDto): Promise<Shipment> {
    const res = await http.patch<ApiResponse<Shipment>>(`/shipments/${id}/status`, input)
    return res.data.data
  },

  async addEvent(id: string, input: AddShipmentEventDto): Promise<ShipmentEvent> {
    const res = await http.post<ApiResponse<ShipmentEvent>>(`/shipments/${id}/events`, input)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/shipments/${id}`)
  },
}

export const carriersService = {
  async list(): Promise<Carrier[]> {
    const res = await http.get<ApiResponse<Carrier[]>>('/carriers')
    return res.data.data
  },

  async listEnabled(): Promise<Carrier[]> {
    const res = await http.get<ApiResponse<Carrier[]>>('/carriers/enabled')
    return res.data.data
  },

  async get(id: string): Promise<Carrier> {
    const res = await http.get<ApiResponse<Carrier>>(`/carriers/${id}`)
    return res.data.data
  },

  async create(input: UpsertCarrierDto): Promise<Carrier> {
    const res = await http.post<ApiResponse<Carrier>>('/carriers', input)
    return res.data.data
  },

  async update(id: string, input: UpsertCarrierDto): Promise<Carrier> {
    const res = await http.put<ApiResponse<Carrier>>(`/carriers/${id}`, input)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/carriers/${id}`)
  },
}
