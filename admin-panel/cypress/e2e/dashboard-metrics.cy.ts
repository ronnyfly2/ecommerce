describe('Dashboard Metrics', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 201,
      body: {
        statusCode: 201,
        message: 'Success',
        data: {
          accessToken: 'fake-access-token',
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'Metrics',
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

    cy.intercept('GET', '**/api/dashboard/summary', {
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
            trendLast7Days: {
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
            weekComparison: {
              currentWeekRevenue: 54000,
              previousWeekRevenue: 42000,
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
              {
                id: 'variant-2',
                sku: 'HOODIE-NVY-L',
                stock: 1,
                productName: 'Hoodie Premium',
                sizeName: 'Large',
                colorName: 'Navy',
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
            {
              id: 'order-2',
              user: { email: 'customer2@example.com' },
              status: 'DELIVERED',
              total: '19999',
              createdAt: '2026-03-18T12:00:00.000Z',
            },
          ],
          meta: {
            total: 2,
            page: 1,
            limit: 5,
            totalPages: 1,
          },
        },
        timestamp: new Date().toISOString(),
        path: '/api/orders',
      },
    }).as('ordersList')

    cy.visit('/login')
    cy.get('#login-email').type('admin@example.com')
    cy.get('#login-password').type('Admin123!')
    cy.contains('button', 'Ingresar').click()
    cy.url().should('include', '/dashboard')

    cy.wait('@login')
    cy.wait('@dashboardSummary')
    cy.wait('@ordersList')
  })

  it('renders sales summary and inventory alerts', () => {
    cy.contains('Revenue total').should('be.visible')
    cy.contains('Ventas (ultimos 7 dias)').should('be.visible')
    cy.contains('Stock bajo').should('be.visible')
    cy.contains('Sin stock').should('be.visible')
    cy.contains('Variantes críticas').should('be.visible')

    cy.contains('Esta semana').should('be.visible')
    cy.contains('Semana anterior').should('be.visible')
    cy.contains('Ordenes 7 dias').should('be.visible')
    cy.contains('+28.57% vs semana anterior').should('be.visible')

    cy.contains('Remera Basica').should('be.visible')
    cy.contains('TSHIRT-BLK-M').should('be.visible')
    cy.contains('Hoodie Premium').should('be.visible')
  })
})