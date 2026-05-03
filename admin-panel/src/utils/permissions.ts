import { Role, type Role as UserRole } from '@/types/api'

export const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'] as const
export type CrudAction = (typeof CRUD_ACTIONS)[number]

export const PERMISSION_RESOURCES = [
  'dashboard',
  'profile',
  'users',
  'products',
  'orders',
  'notifications',
  'chat',
  'coupons',
  'payments',
  'payment-methods',
  'shipments',
  'carriers',
  'inventory',
  'categories',
  'sizes',
  'measurement-units',
  'colors',
  'currencies',
  'tags',
  'email-templates',
  'reviews',
  'admin-tools',
  'images',
] as const

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number]
export type PermissionKey = `${PermissionResource}.${CrudAction}`

export type LegacyPermissionKey =
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
  | 'payments.view'
  | 'payments.review'
  | 'payments.manage'
  | 'shipments.view'
  | 'shipments.manage'
  | 'carriers.manage'

export type AppPermission = PermissionKey | LegacyPermissionKey

const LEGACY_PERMISSION_ALIASES: Record<LegacyPermissionKey, PermissionKey[]> = {
  'dashboard.view': ['dashboard.read'],
  'notifications.view': ['notifications.read'],
  'products.view': ['products.read'],
  'products.manage': ['products.create', 'products.update', 'products.delete'],
  'orders.view': ['orders.read'],
  'orders.manage': ['orders.create', 'orders.update', 'orders.delete'],
  'coupons.view': ['coupons.read'],
  'coupons.manage': ['coupons.create', 'coupons.update', 'coupons.delete'],
  'users.view': ['users.read'],
  'users.manage': ['users.create', 'users.update'],
  'users.delete': ['users.delete'],
  'inventory.view': ['inventory.read'],
  'inventory.manage': ['inventory.create', 'inventory.update', 'inventory.delete'],
  'catalog.manage': [
    'categories.create',
    'categories.update',
    'categories.delete',
    'sizes.create',
    'sizes.update',
    'sizes.delete',
    'measurement-units.create',
    'measurement-units.update',
    'measurement-units.delete',
    'colors.create',
    'colors.update',
    'colors.delete',
    'tags.create',
    'tags.update',
    'tags.delete',
    'email-templates.create',
    'email-templates.update',
    'email-templates.delete',
  ],
  'currencies.manage': ['currencies.create', 'currencies.update', 'currencies.delete'],
  'payments.view': ['payments.read'],
  'payments.review': ['payments.update'],
  'payments.manage': ['payments.create', 'payments.update', 'payments.delete'],
  'shipments.view': ['shipments.read'],
  'shipments.manage': ['shipments.create', 'shipments.update', 'shipments.delete'],
  'carriers.manage': ['carriers.create', 'carriers.update', 'carriers.delete'],
}

const IMPLIED_PERMISSIONS: Partial<Record<PermissionKey, PermissionKey[]>> = {
  'products.read': ['categories.read', 'tags.read', 'currencies.read', 'inventory.read'],
  'products.create': ['products.read', 'categories.read', 'tags.read', 'currencies.read'],
  'products.update': ['products.read', 'categories.read', 'tags.read', 'currencies.read'],
  'orders.read': ['products.read', 'currencies.read'],
  'orders.create': ['orders.read', 'products.read', 'inventory.read'],
  'orders.update': ['orders.read', 'products.read', 'inventory.read'],
  'inventory.read': ['products.read'],
  'inventory.update': ['inventory.read', 'products.read'],
  'shipments.read': ['orders.read', 'carriers.read'],
  'shipments.create': ['shipments.read', 'orders.read', 'carriers.read'],
  'shipments.update': ['shipments.read', 'orders.read', 'carriers.read'],
  'payments.read': ['orders.read', 'payment-methods.read'],
  'payments.update': ['payments.read', 'orders.read'],
  'coupons.read': ['products.read', 'currencies.read'],
  'email-templates.read': ['notifications.read'],
  'chat.read': ['users.read'],
}


export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_RESOURCES.flatMap((resource) =>
  CRUD_ACTIONS.map((action) => `${resource}.${action}` as PermissionKey),
)

export const PERMISSION_LABELS: Record<PermissionResource, string> = {
  dashboard: 'Dashboard',
  profile: 'Perfil',
  users: 'Usuarios',
  products: 'Productos',
  orders: 'Ordenes',
  notifications: 'Notificaciones',
  chat: 'Chat',
  coupons: 'Cupones',
  payments: 'Pagos',
  'payment-methods': 'Metodos de pago',
  shipments: 'Envios',
  carriers: 'Transportadoras',
  inventory: 'Inventario',
  categories: 'Categorias',
  sizes: 'Tallas',
  'measurement-units': 'Tipos de medida',
  colors: 'Colores',
  currencies: 'Monedas',
  tags: 'Tags',
  'email-templates': 'Plantillas email',
  reviews: 'Resenas',
  'admin-tools': 'Admin Tools',
  images: 'Imagenes',
}

export const PERMISSION_ACTION_LABELS: Record<CrudAction, string> = {
  read: 'Leer',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
}

function expandPermission(permission: AppPermission): PermissionKey[] {
  if (permission in LEGACY_PERMISSION_ALIASES) {
    return LEGACY_PERMISSION_ALIASES[permission as LegacyPermissionKey]
  }

  return [permission as PermissionKey]
}

export function normalizePermissionKeys(keys?: readonly string[] | null): PermissionKey[] {
  if (!Array.isArray(keys)) {
    return []
  }

  const allowed = new Set<string>(ALL_PERMISSION_KEYS)
  const normalized = Array.from(new Set(keys.filter((key) => allowed.has(key))))
  return normalized as PermissionKey[]
}

export function expandPermissionKeys(keys?: readonly string[] | null): PermissionKey[] {
  const seeds = normalizePermissionKeys(keys)
  const visited = new Set<PermissionKey>(seeds)
  const stack = [...seeds]

  while (stack.length > 0) {
    const current = stack.pop() as PermissionKey
    const implied = IMPLIED_PERMISSIONS[current] ?? []

    for (const permission of implied) {
      if (!visited.has(permission)) {
        visited.add(permission)
        stack.push(permission)
      }
    }

    const [resource] = current.split('.') as [PermissionResource, CrudAction]
    if (!current.endsWith('.read')) {
      const readPermission = `${resource}.read` as PermissionKey
      if (!visited.has(readPermission)) {
        visited.add(readPermission)
        stack.push(readPermission)
      }
    }
  }

  return Array.from(visited)
}

export function hasPermission(
  role: UserRole | null | undefined,
  grantedPermissions: readonly string[] | null | undefined,
  permission: AppPermission,
) {
  if (!role) return false
  if (role === Role.SUPER_ADMIN) return true

  const effective = new Set((Array.isArray(grantedPermissions) ? grantedPermissions : []) as PermissionKey[])
  const required = expandPermission(permission)

  return required.some((key) => effective.has(key))
}

export function hasRouteAccess(
  role: UserRole | null | undefined,
  roles?: readonly UserRole[],
  grantedRoles?: readonly UserRole[] | null,
) {
  if (!roles || roles.length === 0) return true
  if (!role) return false

  if (role === Role.SUPER_ADMIN) return true
  if (roles.includes(role)) return true

  const delegated = Array.isArray(grantedRoles) ? grantedRoles : []
  return delegated.some((delegatedRole) => roles.includes(delegatedRole))
}
