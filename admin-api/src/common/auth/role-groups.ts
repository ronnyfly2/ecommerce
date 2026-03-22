import { Role } from '../enums/role.enum';

export const BACKOFFICE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
] as const satisfies readonly Role[];

export const PRODUCT_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
] as const satisfies readonly Role[];

export const PRODUCT_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.MARKETING,
] as const satisfies readonly Role[];

export const ORDER_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.SALES,
] as const satisfies readonly Role[];

export const ORDER_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SALES,
] as const satisfies readonly Role[];

export const COUPON_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
] as const satisfies readonly Role[];

export const COUPON_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.MARKETING,
] as const satisfies readonly Role[];

export const USER_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
] as const satisfies readonly Role[];

export const USER_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
] as const satisfies readonly Role[];

export const INVENTORY_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.SALES,
] as const satisfies readonly Role[];

export const INVENTORY_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
] as const satisfies readonly Role[];

export const CATALOG_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
] as const satisfies readonly Role[];

export const CATALOG_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.MARKETING,
] as const satisfies readonly Role[];

export const CURRENCY_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
] as const satisfies readonly Role[];

export const CURRENCY_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
] as const satisfies readonly Role[];