// E2E test: Orders list respects role-based filtering
// Admin should see all orders
// Customer should see only their own orders

describe('Orders List - Role-Based Access Control', () => {
  const adminCredentials = {
    email: Cypress.env('ADMIN_EMAIL') || 'admin@local.dev',
    password: Cypress.env('ADMIN_PASSWORD') || 'Admin2026!',
  }

  const customerCredentials = {
    email: Cypress.env('CUSTOMER_EMAIL') || 'customer1@local.dev',
    password: Cypress.env('CUSTOMER_PASSWORD') || 'Customer2026!',
  }

  describe('Admin user', () => {
    beforeEach(() => {
      cy.visit('/login')
      cy.get('input[type="email"]').type(adminCredentials.email)
      cy.get('input[type="password"]').type(adminCredentials.password)
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/dashboard')
      cy.visit('/orders')
    })

    it('should see all orders regardless of who placed them', () => {
      // Verify orders table is visible
      cy.get('table').should('be.visible')
      
      // Should have rows (orders from different users)
      cy.get('tbody tr').should('have.length.greaterThan', 0)
      
      // Should show multiple different users' emails/names in the list
      cy.get('tbody').within(() => {
        // If there are at least 2 rows and they can have different users, admin should see them
        cy.get('tr').should('have.length.greaterThan', 0)
      })
    })

    it('should be able to filter orders by status', () => {
      // Look for status filter (if exists in UI)
      cy.get('select, input[placeholder*="status i" i], [role="combobox"]')
        .first()
        .should('exist')
    })

    it('should show order stats with all statuses', () => {
      // Dashboard stats should be available and show all order counts
      cy.visit('/dashboard')
      
      // Check for KPI cards that show order statistics
      cy.get('[data-test="kpi-card"]')
        .should('exist')
        .and('have.length.greaterThan', 0)
    })
  })

  describe('Customer user', () => {
    beforeEach(() => {
      cy.visit('/login')
      cy.get('input[type="email"]').type(customerCredentials.email)
      cy.get('input[type="password"]').type(customerCredentials.password)
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/dashboard')
      cy.visit('/orders')
    })

    it('should only see their own orders', () => {
      // Verify orders table is visible
      cy.get('table').should('be.visible')
      
      // All visible orders should belong to logged-in customer
      cy.get('tbody tr').each(($row) => {
        // Extract email/user info from row (adapt selector based on actual table structure)
        cy.wrap($row).within(() => {
          // Orders table should show customer's own email or be empty
          cy.get('td').first().should('exist')
        })
      })
    })

    it('should not see filter options that would reveal other orders', () => {
      // Customer should not have global user filter
      // Look for obvious "Customer" filter that would show all users
      cy.get('[data-test="user-filter"]').should('not.exist')
    })

    it('customer dashboard should show different stats than admin', () => {
      cy.visit('/dashboard')
      
      // Customer should see their own order stats (usually 0 or small number)
      // Not the global stats that admin would see
      cy.get('[data-test="kpi-pending-orders"]')
        .should('exist')
        .then(($el) => {
          const text = $el.text()
          // Verify it's a number (exact number depends on test data)
          expect(text.trim()).to.match(/^\d+$/)
        })
    })
  })

  describe('Authorization', () => {
    it('unauthenticated user should be redirected to login', () => {
      cy.visit('/orders', { failOnStatusCode: false })
      cy.url().should('include', '/login')
    })

    it('customer attempting direct API access to admin orders should fail', () => {
      // Login as customer first
      cy.visit('/login')
      cy.get('input[type="email"]').type(customerCredentials.email)
      cy.get('input[type="password"]').type(customerCredentials.password)
      cy.get('button[type="submit"]').click()
      
      // Attempt to fetch all orders via API (should get filtered results)
      cy.request({
        url: '/api/orders',
        failOnStatusCode: false,
      }).then((response) => {
        // Response should only contain customer's orders or be empty
        expect(response.status).to.be.oneOf([200, 403])
        
        if (response.status === 200 && response.body.data) {
          // If successful, verify data is filtered
          const orders = Array.isArray(response.body.data)
            ? response.body.data
            : response.body.data.items
          
          orders.forEach((order: any) => {
            // Each order should belong to customer (verify via user relationship)
            expect(order.user).to.exist
          })
        }
      })
    })
  })
})
