import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { hasAccessToken } from '@/services/http'

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
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { title: 'Dashboard' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/auth/ProfileView.vue'),
          meta: { title: 'Perfil y Sesiones' },
        },

        // Productos
        {
          path: 'products',
          name: 'products',
          component: () => import('@/views/products/ProductsView.vue'),
          meta: { title: 'Productos' },
        },
        {
          path: 'products/new',
          name: 'products-new',
          component: () => import('@/views/products/ProductFormView.vue'),
          meta: { title: 'Nuevo Producto' },
        },
        {
          path: 'products/:id',
          name: 'products-detail',
          component: () => import('@/views/products/ProductDetailView.vue'),
          meta: { title: 'Detalle de Producto' },
        },
        {
          path: 'products/:id/edit',
          name: 'products-edit',
          component: () => import('@/views/products/ProductFormView.vue'),
          meta: { title: 'Editar Producto' },
        },

        // Órdenes
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/orders/OrdersView.vue'),
          meta: { title: 'Órdenes' },
        },
        {
          path: 'orders/:id',
          name: 'orders-detail',
          component: () => import('@/views/orders/OrderDetailView.vue'),
          meta: { title: 'Detalle de Orden' },
        },

        // Cupones
        {
          path: 'coupons',
          name: 'coupons',
          component: () => import('@/views/coupons/CouponsView.vue'),
          meta: { title: 'Cupones' },
        },

        // Usuarios
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/users/UsersView.vue'),
          meta: { title: 'Usuarios', roles: ['ADMIN', 'SUPER_ADMIN'] },
        },

        // Inventario
        {
          path: 'inventory',
          name: 'inventory',
          component: () => import('@/views/inventory/InventoryView.vue'),
          meta: { title: 'Inventario' },
        },

        // Catálogo auxiliar
        {
          path: 'categories',
          name: 'categories',
          component: () => import('@/views/categories/CategoriesView.vue'),
          meta: { title: 'Categorías' },
        },
        {
          path: 'sizes',
          name: 'sizes',
          component: () => import('@/views/sizes/SizesView.vue'),
          meta: { title: 'Tallas' },
        },
        {
          path: 'colors',
          name: 'colors',
          component: () => import('@/views/colors/ColorsView.vue'),
          meta: { title: 'Colores' },
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

  const authPublicPages = new Set(['login', 'forgot-password', 'reset-password'])
  if (to.name && authPublicPages.has(String(to.name)) && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
