import { OrderStatus } from '@/types/api'
import type { OrderStats } from '@/types/api'

export type DashboardKpiTone = 'primary' | 'success' | 'warning' | 'info'
export type DashboardKpiIcon = 'orders' | 'revenue' | 'pending' | 'delivered'

type StatField =
  | 'totalOrders'
  | 'totalRevenue'
  | 'pendingOrders'
  | 'deliveredOrders'

export type DashboardKpiSpec = {
  id: string
  title: string
  field: StatField
  tone: DashboardKpiTone
  icon: DashboardKpiIcon
  currency?: boolean
}

export type DashboardStatusBadgeColor =
  | 'neutral'
  | 'info'
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'

export type DashboardStatusMeta = {
  label: string
  badgeColor: DashboardStatusBadgeColor
}

type DashboardStatusCountField =
  | 'pendingOrders'
  | 'confirmedOrders'
  | 'shippedOrders'
  | 'deliveredOrders'
  | 'cancelledOrders'

export const DASHBOARD_KPI_SPECS: DashboardKpiSpec[] = [
  {
    id: 'totalOrders',
    title: 'Total ordenes',
    field: 'totalOrders',
    tone: 'primary',
    icon: 'orders',
  },
  {
    id: 'totalRevenue',
    title: 'Revenue total',
    field: 'totalRevenue',
    tone: 'success',
    icon: 'revenue',
    currency: true,
  },
  {
    id: 'pendingOrders',
    title: 'Pendientes',
    field: 'pendingOrders',
    tone: 'warning',
    icon: 'pending',
  },
  {
    id: 'deliveredOrders',
    title: 'Entregadas',
    field: 'deliveredOrders',
    tone: 'info',
    icon: 'delivered',
  },
]

export const DASHBOARD_PIPELINE_ORDER: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
]

export const DASHBOARD_STATUS_META: Record<OrderStatus, DashboardStatusMeta> = {
  [OrderStatus.PENDING]: { label: 'Pendiente', badgeColor: 'warning' },
  [OrderStatus.CONFIRMED]: { label: 'Confirmada', badgeColor: 'info' },
  [OrderStatus.SHIPPED]: { label: 'Enviada', badgeColor: 'primary' },
  [OrderStatus.DELIVERED]: { label: 'Entregada', badgeColor: 'success' },
  [OrderStatus.CANCELLED]: { label: 'Cancelada', badgeColor: 'danger' },
}

export const DASHBOARD_STATUS_COUNT_FIELD: Record<OrderStatus, DashboardStatusCountField> = {
  [OrderStatus.PENDING]: 'pendingOrders',
  [OrderStatus.CONFIRMED]: 'confirmedOrders',
  [OrderStatus.SHIPPED]: 'shippedOrders',
  [OrderStatus.DELIVERED]: 'deliveredOrders',
  [OrderStatus.CANCELLED]: 'cancelledOrders',
}

export function getDashboardStatusCount(stats: OrderStats, status: OrderStatus): number {
  return stats[DASHBOARD_STATUS_COUNT_FIELD[status]]
}
