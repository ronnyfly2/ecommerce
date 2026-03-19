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
// Sizes
// ----------------------------------------------------------
export interface Size {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface CreateSizeDto {
  name: string
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
  slug: string
  description: string | null
  basePrice: string
  category: Category
  isActive: boolean
  isFeatured: boolean
  variants: ProductVariant[]
  images: ProductImage[]
  createdAt: string
  updatedAt: string
}

export interface CreateProductDto {
  name: string
  description?: string
  basePrice: number
  categoryId: string
  isActive?: boolean
  isFeatured?: boolean
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
  isActive?: boolean
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

// ----------------------------------------------------------
// Coupons
// ----------------------------------------------------------
export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: string
  minOrderAmount: string
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
