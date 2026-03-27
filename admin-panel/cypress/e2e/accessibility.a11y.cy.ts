describe('Accessibility Audit', () => {
  function stubBootstrapRequests() {
    cy.intercept('GET', '**/api/currencies*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: [
          {
            id: 'currency-usd',
            code: 'USD',
            symbol: '$',
            name: 'US Dollar',
            exchangeRate: '1',
            isDefault: true,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
        path: '/api/currencies',
      },
    }).as('currenciesBootstrap')
  }

  function stubLoginRequest(email = 'admin@example.com') {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 201,
      body: {
        statusCode: 201,
        message: 'Success',
        data: {
          accessToken: 'fake-access-token',
          user: {
            id: 'admin-1',
            email,
            firstName: 'Admin',
            lastName: 'A11y',
            role: 'ADMIN',
            isActive: true,
            avatar: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/auth/login',
      },
    }).as('login')
  }

  function stubDashboardRequests() {
    cy.intercept('GET', '**/api/dashboard/summary*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          orderStats: {
            totalOrders: 42,
            totalRevenue: 125000,
            pendingOrders: 5,
            confirmedOrders: 11,
            shippedOrders: 9,
            deliveredOrders: 15,
            cancelledOrders: 2,
          },
          sales: {
            period: {
              preset: '7d',
              label: 'Ultimos 7 dias',
              from: '2026-03-13',
              to: '2026-03-19',
              days: 7,
            },
            trend: {
              totalOrders: 18,
              totalRevenue: 54000,
              points: [
                { date: '2026-03-13', label: 'vie', orders: 2, revenue: 4500 },
                { date: '2026-03-14', label: 'sab', orders: 1, revenue: 1800 },
                { date: '2026-03-15', label: 'dom', orders: 3, revenue: 7200 },
                { date: '2026-03-16', label: 'lun', orders: 4, revenue: 10500 },
                { date: '2026-03-17', label: 'mar', orders: 2, revenue: 6400 },
                { date: '2026-03-18', label: 'mie', orders: 3, revenue: 9800 },
                { date: '2026-03-19', label: 'jue', orders: 3, revenue: 13800 },
              ],
            },
            comparison: {
              currentRevenue: 54000,
              previousRevenue: 42000,
              deltaPercent: 28.57,
            },
          },
          inventoryAlerts: {
            threshold: 5,
            lowStockCount: 4,
            outOfStockCount: 2,
            lowStockVariants: [
              {
                id: 'variant-1',
                sku: 'TSHIRT-BLK-M',
                stock: 2,
                productName: 'Remera Basica',
                sizeName: 'Medium',
                colorName: 'Black',
              },
            ],
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/dashboard/summary',
      },
    }).as('dashboardSummary')

    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          items: [
            {
              id: 'order-1',
              user: { email: 'customer1@example.com' },
              status: 'PENDING',
              total: '14999',
              createdAt: '2026-03-19T12:00:00.000Z',
            },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 5,
            totalPages: 1,
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/orders',
      },
    }).as('ordersList')

    cy.intercept('GET', '**/api/notifications*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          items: [],
          meta: {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
          unreadCount: 0,
        },
        timestamp: new Date().toISOString(),
        path: '/api/notifications',
      },
    }).as('notificationsList')
  }

  function stubShellNotificationsRequests() {
    cy.intercept('GET', '**/api/notifications*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          items: [],
          meta: {
            total: 0,
            page: 1,
            limit: 8,
            totalPages: 1,
          },
          unreadCount: 0,
        },
        timestamp: new Date().toISOString(),
        path: '/api/notifications',
      },
    }).as('shellNotificationsList')
  }

  function stubProductsRequests() {
    cy.intercept('GET', '**/api/categories*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: [
          {
            id: 'category-1',
            name: 'Remeras',
            slug: 'remeras',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
        path: '/api/categories',
      },
    }).as('categoriesList')

    cy.intercept('GET', '**/api/tags*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: [
          {
            id: 'tag-1',
            name: 'Nuevo',
            slug: 'nuevo',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
        path: '/api/tags',
      },
    }).as('tagsList')

    cy.intercept('GET', '**/api/products*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          items: [
            {
              id: 'product-1',
              name: 'Remera Básica',
              slug: 'remera-basica',
              sku: 'REM-BAS-001',
              category: { id: 'category-1', name: 'Remeras' },
              images: [],
              hasOffer: true,
              offerPrice: '18999',
              basePrice: '24999',
              currencyCode: 'USD',
              variants: [{ id: 'variant-1' }],
              isActive: true,
            },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 15,
            totalPages: 1,
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/products',
      },
    }).as('productsList')
  }

  function stubUsersRequests() {
    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          items: [
            {
              id: 'user-1',
              email: 'admin@example.com',
              firstName: 'Admin',
              lastName: 'Principal',
              role: 'ADMIN',
              isActive: true,
              avatar: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 15,
            totalPages: 1,
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/users',
      },
    }).as('usersList')
  }

  function stubNotificationsHistoryRequests() {
    cy.intercept('GET', '**/api/notifications*', (req) => {
      const limit = Number(req.query.limit ?? 20)

      if (limit === 8) {
        req.reply({
          statusCode: 200,
          body: {
            statusCode: 200,
            message: 'Success',
            data: {
              items: [],
              meta: {
                total: 0,
                page: 1,
                limit: 8,
                totalPages: 1,
              },
              unreadCount: 1,
            },
            timestamp: new Date().toISOString(),
            path: '/api/notifications',
          },
        })
        return
      }

      req.reply({
        statusCode: 200,
        body: {
          statusCode: 200,
          message: 'Success',
          data: {
            items: [
              {
                id: 'notification-1',
                type: 'ORDER_CREATED',
                title: 'Nueva compra',
                message: 'Se creó la orden #1001',
                isRead: false,
                readAt: null,
                createdAt: new Date().toISOString(),
                link: '/orders/order-1',
              },
            ],
            meta: {
              total: 1,
              page: 1,
              limit: 20,
              totalPages: 1,
            },
            unreadCount: 1,
          },
          timestamp: new Date().toISOString(),
          path: '/api/notifications',
        },
      })
    }).as('notificationsHistoryList')
  }

  function loginAndVisit(path: string) {
    cy.visit(`/login?redirect=${encodeURIComponent(path)}`)
    cy.get('#login-email').type('admin@example.com')
    cy.get('#login-password').type('Admin123!')
    cy.contains('button', 'Ingresar').click()
    cy.wait('@login')
    cy.url().should('include', path)
  }

  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    stubBootstrapRequests()
  })

  it('passes axe on login page', () => {
    cy.visit('/login')
    cy.contains('button', 'Ingresar').should('be.visible')
    cy.runA11yAudit()
  })

  it('passes axe on forgot-password page', () => {
    cy.visit('/forgot-password')
    cy.contains('Enviar enlace').should('be.visible')
    cy.runA11yAudit()
  })

  it('passes axe on reset-password with invalid token state', () => {
    cy.visit('/reset-password')
    cy.contains('El token es inválido o no fue enviado', { matchCase: false }).should('be.visible')
    cy.runA11yAudit()
  })

  it('passes axe on dashboard for an authenticated admin', () => {
    stubLoginRequest()
    stubDashboardRequests()

    cy.visit('/login')
    cy.get('#login-email').type('admin@example.com')
    cy.get('#login-password').type('Admin123!')
    cy.contains('button', 'Ingresar').click()

    cy.wait('@login')
    cy.wait('@dashboardSummary')
    cy.wait('@ordersList')
    cy.wait('@notificationsList')
    cy.url().should('include', '/dashboard')
    cy.contains('Revenue total').should('be.visible')

    cy.runA11yAudit()
  })

  it('passes axe on products page for an authenticated admin', () => {
    stubLoginRequest()
    stubShellNotificationsRequests()
    stubProductsRequests()

    loginAndVisit('/products')
    cy.wait('@categoriesList')
    cy.wait('@tagsList')
    cy.wait('@productsList')
    cy.contains('Remera Básica').should('be.visible')

    cy.runA11yAudit()
  })

  it('passes axe on orders page for an authenticated admin', () => {
    stubLoginRequest()
    stubShellNotificationsRequests()
    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: {
        statusCode: 200,
        message: 'Success',
        data: {
          items: [
            {
              id: 'order-1',
              user: { email: 'customer@example.com' },
              status: 'PENDING',
              total: '14999',
              currencyCode: 'USD',
              exchangeRateToUsd: '1',
              createdAt: '2026-03-19T12:00:00.000Z',
            },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 15,
            totalPages: 1,
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/orders',
      },
    }).as('ordersPageList')

    loginAndVisit('/orders')
    cy.wait('@ordersPageList')
    cy.contains('customer@example.com').should('be.visible')

    cy.runA11yAudit()
  })

  it('passes axe on users page for an authenticated admin', () => {
    stubLoginRequest()
    stubShellNotificationsRequests()
    stubUsersRequests()

    loginAndVisit('/users')
    cy.wait('@usersList')
    cy.contains('Nuevo usuario').should('be.visible')

    cy.runA11yAudit()
  })

  it('passes axe on notifications history page for an authenticated admin', () => {
    stubLoginRequest()
    stubNotificationsHistoryRequests()

    loginAndVisit('/notifications')
    cy.wait('@notificationsHistoryList')
    cy.contains('Historial de notificaciones').should('be.visible')

    cy.runA11yAudit()
  })
})