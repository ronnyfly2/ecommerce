import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { hasAccessToken } from '@/services/http'
import DashboardView from '@/views/dashboard/DashboardView.vue'
import UsersView from '@/views/users/UsersView.vue'
import { preloadRichEditor } from '@/utils/preload-rich-editor'
import type { PermissionKey } from '@/utils/permissions'

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
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
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
          meta: { title: 'Dashboard', permission: 'dashboard.read' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/auth/ProfileView.vue'),
          meta: { title: 'Perfil y Sesiones', permission: 'profile.read' },
        },

        // Productos
        {
          path: 'products',
          name: 'products',
          component: () => import('@/views/products/ProductsView.vue'),
          meta: { title: 'Productos', permission: 'products.read' },
        },
        {
          path: 'products/new',
          name: 'products-new',
          component: () => import('@/views/products/ProductFormView.vue'),
          meta: { title: 'Nuevo Producto', permission: 'products.create' },
        },
        {
          path: 'products/:id',
          name: 'products-detail',
          component: () => import('@/views/products/ProductDetailView.vue'),
          meta: { title: 'Detalle de Producto', permission: 'products.read' },
        },
        {
          path: 'products/:id/edit',
          name: 'products-edit',
          component: () => import('@/views/products/ProductFormView.vue'),
          meta: { title: 'Editar Producto', permission: 'products.update' },
        },

        // Órdenes
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/orders/OrdersView.vue'),
          meta: { title: 'Órdenes', permission: 'orders.read' },
        },
        {
          path: 'orders/new',
          name: 'orders-new',
          component: () => import('@/views/orders/OrderCreateView.vue'),
          meta: { title: 'Nueva Orden', permission: 'orders.create' },
        },
        {
          path: 'orders/:id',
          name: 'orders-detail',
          component: () => import('@/views/orders/OrderDetailView.vue'),
          meta: { title: 'Detalle de Orden', permission: 'orders.read' },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/notifications/NotificationsView.vue'),
          meta: { title: 'Notificaciones', permission: 'notifications.read' },
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/chat/ChatView.vue'),
          meta: { title: 'Chat', permission: 'chat.read' },
        },

        // Cupones
        {
          path: 'coupons',
          name: 'coupons',
          component: () => import('@/views/coupons/CouponsView.vue'),
          meta: { title: 'Cupones', permission: 'coupons.read' },
        },

        // Pagos
        {
          path: 'payments',
          name: 'payments',
          component: () => import('@/views/payments/PaymentsView.vue'),
          meta: { title: 'Pagos', permission: 'payments.read' },
        },
        {
          path: 'payment-methods',
          name: 'payment-methods',
          component: () => import('@/views/payments/PaymentMethodsView.vue'),
          meta: { title: 'Metodos de pago', permission: 'payment-methods.read' },
        },

        // Envios
        {
          path: 'shipments',
          name: 'shipments',
          component: () => import('@/views/shipments/ShipmentsView.vue'),
          meta: { title: 'Envios', permission: 'shipments.read' },
        },
        {
          path: 'shipments/:id',
          name: 'shipments-detail',
          component: () => import('@/views/shipments/ShipmentsView.vue'),
          meta: { title: 'Detalle de envio', permission: 'shipments.read' },
        },
        {
          path: 'carriers',
          name: 'carriers',
          component: () => import('@/views/shipments/CarriersView.vue'),
          meta: { title: 'Transportadoras', permission: 'carriers.read' },
        },

        // Usuarios
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { title: 'Usuarios', permission: 'users.read' },
        },
        {
          path: 'admin-tools/seeds',
          name: 'admin-tools-seeds',
          component: () => import('@/views/admin-tools/SeedManagerView.vue'),
          meta: { title: 'Seeds por modulos', permission: 'admin-tools.read' },
        },
        {
          path: 'admin-tools/pdf-editor',
          name: 'admin-tools-pdf-editor',
          component: () => import('@/views/admin-tools/PdfEditorView.vue'),
          meta: { title: 'Editor PDF', permission: 'admin-tools.read' },
        },

        // Inventario
        {
          path: 'inventory',
          name: 'inventory',
          component: () => import('@/views/inventory/InventoryView.vue'),
          meta: { title: 'Inventario', permission: 'inventory.read' },
        },
        {
          path: 'inventory/stock',
          name: 'inventory-stock',
          component: () => import('@/views/inventory/InventoryStockView.vue'),
          meta: { title: 'Stock por producto', permission: 'inventory.read' },
        },
        {
          path: 'inventory/stores',
          name: 'inventory-stores',
          component: () => import('@/views/inventory/InventoryStoresView.vue'),
          meta: { title: 'Tiendas', permission: 'inventory.read' },
        },
        {
          path: 'inventory/kardex',
          name: 'inventory-kardex',
          component: () => import('@/views/inventory/KardexView.vue'),
          meta: { title: 'Kardex', permission: 'inventory.read' },
        },

        // Catálogo auxiliar
        {
          path: 'categories',
          name: 'categories',
          component: () => import('@/views/categories/CategoriesView.vue'),
          meta: { title: 'Categorías', permission: 'categories.read' },
        },
        {
          path: 'sizes',
          name: 'sizes',
          component: () => import('@/views/sizes/SizesView.vue'),
          meta: { title: 'Tallas', permission: 'sizes.read' },
        },
        {
          path: 'measurement-units',
          name: 'measurement-units',
          component: () => import('@/views/measurement-units/MeasurementUnitsView.vue'),
          meta: { title: 'Tipos de medida', permission: 'measurement-units.read' },
        },
        {
          path: 'colors',
          name: 'colors',
          component: () => import('@/views/colors/ColorsView.vue'),
          meta: { title: 'Colores', permission: 'colors.read' },
        },
        {
          path: 'currencies',
          name: 'currencies',
          component: () => import('@/views/currencies/CurrenciesView.vue'),
          meta: { title: 'Tipo de moneda', permission: 'currencies.read' },
        },
          {
            path: 'tags',
            name: 'tags',
            component: () => import('@/views/tags/TagsView.vue'),
            meta: { title: 'Tags', permission: 'tags.read' },
          },
        {
          path: 'email-templates',
          name: 'email-templates',
          component: () => import('@/views/email-templates/EmailTemplatesView.vue'),
          meta: { title: 'Plantillas de email', permission: 'email-templates.read' },
        },
        {
          path: 'templates',
          name: 'templates',
          component: () => import('@/views/templates/TemplatesManagerViewNew.vue'),
          meta: { title: 'Gestor de Templates', permission: 'admin-tools.read' },
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

  const requiredPermission = to.meta.permission as PermissionKey | undefined
  if (!isPublicRoute && requiredPermission && !auth.can(requiredPermission)) {
    return { name: 'dashboard' }
  }

  const authPublicPages = new Set(['login', 'register', 'forgot-password', 'reset-password'])
  if (to.name && authPublicPages.has(String(to.name)) && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  if (to.name === 'products-new' || to.name === 'products-edit') {
    await preloadRichEditor()
  }
})

export default router
