export const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

export type CrudAction = (typeof CRUD_ACTIONS)[number];

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
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];
export type PermissionKey = `${PermissionResource}.${CrudAction}`;

const METHOD_ACTION_MAP: Record<string, CrudAction | null> = {
  GET: 'read',
  HEAD: 'read',
  OPTIONS: null,
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

const BYPASS_RESOURCES = new Set<string>(['auth', 'health']);

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_RESOURCES.flatMap((resource) =>
  CRUD_ACTIONS.map((action) => `${resource}.${action}` as PermissionKey),
);

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
};

export function normalizePermissionKeys(keys?: string[] | null): PermissionKey[] {
  if (!Array.isArray(keys)) {
    return [];
  }

  const allowed = new Set<string>(ALL_PERMISSION_KEYS);
  const normalized = Array.from(new Set(keys.filter((key) => allowed.has(key))));
  return normalized as PermissionKey[];
}

export function expandPermissionKeys(keys?: string[] | null): PermissionKey[] {
  const seeds = normalizePermissionKeys(keys);
  const visited = new Set<PermissionKey>(seeds);
  const stack = [...seeds];

  while (stack.length > 0) {
    const current = stack.pop() as PermissionKey;
    const implied = IMPLIED_PERMISSIONS[current] ?? [];

    for (const permission of implied) {
      if (!visited.has(permission)) {
        visited.add(permission);
        stack.push(permission);
      }
    }

    const [resource] = current.split('.') as [PermissionResource, CrudAction];
    if (!current.endsWith('.read')) {
      const readPermission = `${resource}.read` as PermissionKey;
      if (!visited.has(readPermission)) {
        visited.add(readPermission);
        stack.push(readPermission);
      }
    }
  }

  return Array.from(visited);
}

export function hasEffectivePermission(
  grantedPermissions: string[] | null | undefined,
  requiredPermission: PermissionKey,
): boolean {
  const effective = new Set(expandPermissionKeys(grantedPermissions));
  return effective.has(requiredPermission);
}

export function resolvePermissionFromRequest(
  method: string,
  originalUrl: string | undefined,
): PermissionKey | null {
  const action = METHOD_ACTION_MAP[method.toUpperCase()] ?? null;
  if (!action) {
    return null;
  }

  const path = (originalUrl ?? '').split('?')[0];
  const segments = path.split('/').filter(Boolean);

  const apiIndex = segments[0] === 'api' ? 1 : 0;
  const resource = segments[apiIndex];

  if (!resource || BYPASS_RESOURCES.has(resource)) {
    return null;
  }

  if (!PERMISSION_RESOURCES.includes(resource as PermissionResource)) {
    return null;
  }

  return `${resource}.${action}` as PermissionKey;
}
