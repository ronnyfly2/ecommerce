import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { hasAccessToken } from '@/services/http'
import type { Role } from '@/types/api'
import DashboardView from '@/views/dashboard/DashboardView.vue'
import { preloadRichEditor } from '@/utils/preload-rich-editor'
import {
  BACKOFFICE_ROLES,
  CATALOG_MANAGE_ROLES,
  COUPON_READ_ROLES,
  CURRENCY_MANAGE_ROLES,
  INVENTORY_MANAGE_ROLES,
  INVENTORY_READ_ROLES,
  ORDER_READ_ROLES,
  ORDER_MANAGE_ROLES,
  PRODUCT_MANAGE_ROLES,
  PRODUCT_READ_ROLES,
  USER_READ_ROLES,
} from '@/utils/permissions'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Auth
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { public: true, layout: 'auth' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { public: true, layout: 'auth' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { public: true, layout: 'auth' },
    },

    // Dashboard shell
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: 'Dashboard', roles: BACKOFFICE_ROLES },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/auth/ProfileView.vue'),
          meta: { title: 'Perfil y Sesiones', roles: BACKOFFICE_ROLES },
        },

        // Productos
        {
          path: 'products',
          name: 'products',
          component: () => import('@/views/products/ProductsView.vue'),
          meta: { title: 'Productos', roles: PRODUCT_READ_ROLES },
        },
        {
          path: 'products/new',
          name: 'products-new',
          component: () => import('@/views/products/ProductFormView.vue'),
          meta: { title: 'Nuevo Producto', roles: PRODUCT_MANAGE_ROLES },
        },
        {
          path: 'products/:id',
          name: 'products-detail',
          component: () => import('@/views/products/ProductDetailView.vue'),
          meta: { title: 'Detalle de Producto', roles: PRODUCT_READ_ROLES },
        },
        {
          path: 'products/:id/edit',
          name: 'products-edit',
          component: () => import('@/views/products/ProductFormView.vue'),
          meta: { title: 'Editar Producto', roles: PRODUCT_MANAGE_ROLES },
        },

        // Órdenes
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/orders/OrdersView.vue'),
          meta: { title: 'Órdenes', roles: ORDER_READ_ROLES },
        },
        {
          path: 'orders/new',
          name: 'orders-new',
          component: () => import('@/views/orders/OrderCreateView.vue'),
          meta: { title: 'Nueva Orden', roles: ORDER_MANAGE_ROLES },
        },
        {
          path: 'orders/:id',
          name: 'orders-detail',
          component: () => import('@/views/orders/OrderDetailView.vue'),
          meta: { title: 'Detalle de Orden', roles: ORDER_READ_ROLES },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/notifications/NotificationsView.vue'),
          meta: { title: 'Notificaciones', roles: BACKOFFICE_ROLES },
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/chat/ChatView.vue'),
          meta: { title: 'Chat', roles: BACKOFFICE_ROLES },
        },

        // Cupones
        {
          path: 'coupons',
          name: 'coupons',
          component: () => import('@/views/coupons/CouponsView.vue'),
          meta: { title: 'Cupones', roles: COUPON_READ_ROLES },
        },

        // Usuarios
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/users/UsersView.vue'),
          meta: { title: 'Usuarios', roles: USER_READ_ROLES },
        },

        // Inventario
        {
          path: 'inventory',
          name: 'inventory',
          component: () => import('@/views/inventory/InventoryView.vue'),
          meta: { title: 'Inventario', roles: INVENTORY_READ_ROLES },
        },
        {
          path: 'inventory/stock',
          name: 'inventory-stock',
          component: () => import('@/views/inventory/InventoryStockView.vue'),
          meta: { title: 'Stock por producto', roles: INVENTORY_READ_ROLES },
        },
        {
          path: 'inventory/stores',
          name: 'inventory-stores',
          component: () => import('@/views/inventory/InventoryStoresView.vue'),
          meta: { title: 'Tiendas', roles: INVENTORY_MANAGE_ROLES },
        },

        // Catálogo auxiliar
        {
          path: 'categories',
          name: 'categories',
          component: () => import('@/views/categories/CategoriesView.vue'),
          meta: { title: 'Categorías', roles: CATALOG_MANAGE_ROLES },
        },
        {
          path: 'sizes',
          name: 'sizes',
          component: () => import('@/views/sizes/SizesView.vue'),
          meta: { title: 'Tallas', roles: CATALOG_MANAGE_ROLES },
        },
        {
          path: 'measurement-units',
          name: 'measurement-units',
          component: () => import('@/views/measurement-units/MeasurementUnitsView.vue'),
          meta: { title: 'Tipos de medida', roles: CATALOG_MANAGE_ROLES },
        },
        {
          path: 'colors',
          name: 'colors',
          component: () => import('@/views/colors/ColorsView.vue'),
          meta: { title: 'Colores', roles: CATALOG_MANAGE_ROLES },
        },
        {
          path: 'currencies',
          name: 'currencies',
          component: () => import('@/views/currencies/CurrenciesView.vue'),
          meta: { title: 'Tipo de moneda', roles: CURRENCY_MANAGE_ROLES },
        },
          {
            path: 'tags',
            name: 'tags',
            component: () => import('@/views/tags/TagsView.vue'),
            meta: { title: 'Tags', roles: CATALOG_MANAGE_ROLES },
          },
      ],
    },

    // 404 catch-all
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// Guard global
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const isPublicRoute = !!to.meta.public
  const tokenPresent = hasAccessToken()

  // Inicializar sesión en primera navegación
  if (!auth.initialized) {
    if (tokenPresent || !isPublicRoute) {
      await auth.fetchMe()
    } else {
      auth.initialized = true
    }
  }

  if (!isPublicRoute && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const requiredRoles = to.meta.roles as readonly Role[] | undefined
  if (!isPublicRoute && requiredRoles && !auth.canAccessRoles(requiredRoles)) {
    return { name: 'dashboard' }
  }

  const authPublicPages = new Set(['login', 'forgot-password', 'reset-password'])
  if (to.name && authPublicPages.has(String(to.name)) && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  if (to.name === 'products-new' || to.name === 'products-edit') {
    await preloadRichEditor()
  }
})

export default router
