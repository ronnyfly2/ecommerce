// ============================================================
// API TYPES — derivados del NestJS admin-api
// ============================================================

// ----------------------------------------------------------
// Envelope de respuesta
// ----------------------------------------------------------
export interface ApiResponse<T> {
  statusCode: number
  message: string
  data: T
  timestamp: string
  path: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiPaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiPaginatedData<T> {
  items: T[]
  meta: ApiPaginationMeta
}

export type ApiListData<T> = T[] | ApiPaginatedData<T>

// ----------------------------------------------------------
// Enums
// ----------------------------------------------------------
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  BOSS: 'BOSS',
  MARKETING: 'MARKETING',
  SALES: 'SALES',
  CUSTOMER: 'CUSTOMER',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const CouponType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const
export type CouponType = (typeof CouponType)[keyof typeof CouponType]

export const InventoryMovementType = {
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
} as const
export type InventoryMovementType = (typeof InventoryMovementType)[keyof typeof InventoryMovementType]

export const NotificationType = {
  USER_REGISTERED: 'USER_REGISTERED',
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
} as const
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

// ----------------------------------------------------------
// Auth
// ----------------------------------------------------------
export interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: Role
  isActive: boolean
  avatar: string | null
  createdAt: string
  updatedAt: string
}

export interface LoginResponse {
  accessToken: string
  user: User
}

export interface RefreshTokenRecord {
  tokenId: string
  deviceName: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}

export interface LoginDto {
  email: string
  password: string
}

export interface RegisterDto {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface ForgotPasswordDto {
  email: string
}

export interface ResetPasswordDto {
  token: string
  password: string
}

export type SeedCleanMode = 'seed' | 'users-all' | 'all'

// ----------------------------------------------------------
// Users
// ----------------------------------------------------------
export interface CreateUserDto {
  email: string
  password: string
  firstName?: string
  lastName?: string
  role?: Role
}

export interface UpdateUserDto {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  role?: Role
  isActive?: boolean
}

export interface QueryUsersDto {
  page?: number
  limit?: number
  search?: string
  role?: Role
  isActive?: boolean
}

export interface NotificationActor {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: Role
  avatar: string | null
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  metadata: Record<string, unknown> | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  actorUser: NotificationActor | null
}

export interface QueryNotificationsDto {
  page?: number
  limit?: number
  unreadOnly?: boolean
  type?: NotificationType
}

export interface NotificationListData {
  items: Notification[]
  meta: ApiPaginationMeta
  unreadCount: number
}

// ----------------------------------------------------------
// Categories
// ----------------------------------------------------------
export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  isActive: boolean
  displayOrder: number
  parent: Category | null
  children: Category[]
  createdAt: string
  updatedAt: string
}

export interface CreateCategoryDto {
  name: string
  description?: string
  image?: string
  isActive?: boolean
  displayOrder?: number
  parentId?: string
}

// ----------------------------------------------------------
// Currencies
// ----------------------------------------------------------
export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  exchangeRateToUsd: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCurrencyDto {
  code: string
  name: string
  symbol: string
  exchangeRateToUsd: number
  isActive?: boolean
  isDefault?: boolean
}

// ----------------------------------------------------------
// Sizes
// ----------------------------------------------------------
export interface Size {
  id: string
  name: string
  abbreviation: string
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateSizeDto {
  name: string
  abbreviation: string
  displayOrder?: number
}

// ----------------------------------------------------------
// Tags
// ----------------------------------------------------------
export interface Tag {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTagDto {
  name: string
  isActive?: boolean
}

// ----------------------------------------------------------
// Colors
// ----------------------------------------------------------
export interface Color {
  id: string
  name: string
  hexCode: string
  createdAt: string
  updatedAt: string
}

export interface CreateColorDto {
  name: string
  hexCode: string
}

// ----------------------------------------------------------
// Products
// ----------------------------------------------------------
export interface ProductImage {
  id: string
  url: string
  altText: string | null
  isMain: boolean
  displayOrder: number
  createdAt: string
}

export interface CreateProductImageDto {
  url: string
  altText?: string
  displayOrder?: number
  isMain?: boolean
}

export interface UpdateProductImageDto extends Partial<CreateProductImageDto> {}

export interface ProductVariant {
  id: string
  product?: {
    id: string
    name: string
  }
  sku: string
  size: Size
  color: Color
  stock: number
  additionalPrice: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  name: string
  sku: string
  slug: string
  description: string | null
  basePrice: string
  currencyCode: string
  hasOffer: boolean
  offerPrice: string | null
  offerPercentage: string | null
  category: Category
  coupon: Coupon | null
  couponLink: string | null
  tags: Tag[]
  relatedProducts: Product[]
  suggestedProducts: Product[]
  isActive: boolean
  isFeatured: boolean
  variants: ProductVariant[]
  images: ProductImage[]
  createdAt: string
  updatedAt: string
}

export interface CreateProductDto {
  name: string
  sku: string
  description?: string
  basePrice: number
  currencyCode?: string
  categoryId: string
  couponId?: string
  couponLink?: string
  tagIds?: string[]
  relatedProductIds?: string[]
  suggestedProductIds?: string[]
  isActive?: boolean
  isFeatured?: boolean
  hasOffer?: boolean
  offerPrice?: number
  offerPercentage?: number
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface CreateProductVariantDto {
  sku: string
  sizeId: string
  colorId: string
  stock: number
  additionalPrice?: number
  isActive?: boolean
}

export interface QueryProductsDto {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  tagId?: string
  couponId?: string
  currencyCode?: string
  isActive?: boolean
  hasOffer?: boolean
}

// ----------------------------------------------------------
// Orders
// ----------------------------------------------------------
export interface ShippingAddress {
  id: string
  firstName: string
  lastName: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  phoneNumber: string | null
  isDefault: boolean
}

export interface OrderItem {
  id: string
  variant: ProductVariant
  quantity: number
  unitPrice: string
  subtotal: string
  createdAt: string
}

export interface Order {
  id: string
  user: User
  status: OrderStatus
  subtotal: string
  discount: string
  total: string
  currencyCode: string
  exchangeRateToUsd: string
  coupon: Coupon | null
  items: OrderItem[]
  shippingAddresses: ShippingAddress[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateOrderStatusDto {
  status: OrderStatus
}

export interface QueryOrdersDto {
  page?: number
  limit?: number
  status?: OrderStatus
  currencyCode?: string
}

export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  confirmedOrders: number
  shippedOrders: number
  deliveredOrders: number
  cancelledOrders: number
}

export interface DashboardLowStockVariant {
  id: string
  sku: string
  stock: number
  productName: string
  sizeName: string
  colorName: string
}

export interface DashboardInventoryAlerts {
  threshold: number
  lowStockCount: number
  outOfStockCount: number
  lowStockVariants: DashboardLowStockVariant[]
}

export interface DashboardSalesTrendPoint {
  date: string
  label: string
  orders: number
  revenue: number
}

export interface DashboardSalesInsights {
  period: {
    preset: '7d' | '30d' | 'month' | 'custom'
    label: string
    from: string
    to: string
    days: number
  }
  trend: {
    totalOrders: number
    totalRevenue: number
    points: DashboardSalesTrendPoint[]
  }
  comparison: {
    currentRevenue: number
    previousRevenue: number
    deltaPercent: number | null
  }
}

export interface DashboardSummaryQuery {
  salesPreset?: '7d' | '30d' | 'month' | 'custom'
  month?: string
  from?: string
  to?: string
}

export interface DashboardSummary {
  orderStats: OrderStats
  sales: DashboardSalesInsights
  inventoryAlerts: DashboardInventoryAlerts | null
}

// ----------------------------------------------------------
// Coupons
// ----------------------------------------------------------
export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: string
  minOrderAmount: string
  currencyCode: string
  maxUsage: number | null
  usageCount: number
  startDate: string | null
  endDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCouponDto {
  code: string
  type: CouponType
  value: string
  minOrderAmount?: string
  currencyCode?: string
  maxUsage?: number
  startDate?: string
  endDate?: string
  isActive?: boolean
}

export interface UpdateCouponDto extends Partial<CreateCouponDto> {}

// ----------------------------------------------------------
// Inventory
// ----------------------------------------------------------
export interface InventoryMovement {
  id: string
  variant: ProductVariant
  movementType: InventoryMovementType
  quantityChange: number
  reason: string | null
  createdBy: User
  createdAt: string
}

export interface CreateInventoryAdjustmentDto {
  variantId: string
  quantityChange: number
  type: InventoryMovementType
  reason?: string
}

export interface QueryInventoryMovementsDto {
  page?: number
  limit?: number
  variantId?: string
}
