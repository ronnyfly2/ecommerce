import { Role, type Role as UserRole } from '@/types/api'

export type PermissionKey =
  | 'dashboard.view'
  | 'notifications.view'
  | 'products.view'
  | 'products.manage'
  | 'orders.view'
  | 'orders.manage'
  | 'coupons.view'
  | 'coupons.manage'
  | 'users.view'
  | 'users.manage'
  | 'users.delete'
  | 'inventory.view'
  | 'inventory.manage'
  | 'catalog.manage'
  | 'currencies.manage'

export const BACKOFFICE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
] as const satisfies readonly UserRole[]

export const PRODUCT_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
] as const satisfies readonly UserRole[]

export const PRODUCT_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.MARKETING,
] as const satisfies readonly UserRole[]

export const ORDER_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.SALES,
] as const satisfies readonly UserRole[]

export const ORDER_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SALES,
] as const satisfies readonly UserRole[]

export const COUPON_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
] as const satisfies readonly UserRole[]

export const COUPON_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.MARKETING,
] as const satisfies readonly UserRole[]

export const USER_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
] as const satisfies readonly UserRole[]

export const USER_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
] as const satisfies readonly UserRole[]

export const INVENTORY_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.SALES,
] as const satisfies readonly UserRole[]

export const INVENTORY_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
] as const satisfies readonly UserRole[]

export const CATALOG_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.MARKETING,
] as const satisfies readonly UserRole[]

export const CURRENCY_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
] as const satisfies readonly UserRole[]

const permissionMap: Record<PermissionKey, readonly UserRole[]> = {
  'dashboard.view': BACKOFFICE_ROLES,
  'notifications.view': BACKOFFICE_ROLES,
  'products.view': PRODUCT_READ_ROLES,
  'products.manage': PRODUCT_MANAGE_ROLES,
  'orders.view': ORDER_READ_ROLES,
  'orders.manage': ORDER_MANAGE_ROLES,
  'coupons.view': COUPON_READ_ROLES,
  'coupons.manage': COUPON_MANAGE_ROLES,
  'users.view': USER_READ_ROLES,
  'users.manage': USER_MANAGE_ROLES,
  'users.delete': [Role.SUPER_ADMIN],
  'inventory.view': INVENTORY_READ_ROLES,
  'inventory.manage': INVENTORY_MANAGE_ROLES,
  'catalog.manage': CATALOG_MANAGE_ROLES,
  'currencies.manage': CURRENCY_MANAGE_ROLES,
}

export function hasRolePermission(role: UserRole | null | undefined, permission: PermissionKey) {
  if (!role) return false
  return permissionMap[permission].includes(role)
}

export function hasRouteAccess(role: UserRole | null | undefined, roles?: readonly UserRole[]) {
  if (!roles || roles.length === 0) return true
  if (!role) return false
  return roles.includes(role)
}