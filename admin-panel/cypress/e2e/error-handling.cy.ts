// E2E test: Error handling and error messages
// Verify that error messages are properly extracted and displayed

describe('Error Handling & Messages', () => {
  const superAdminEmail = 'superadmin@local.dev'
  const superAdminPassword = 'Admin2026!'
  const usersListPayload = {
    data: {
      items: [
        {
          id: 'user-1',
          email: 'existing@local.dev',
          firstName: 'Existing',
          lastName: 'User',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 15,
        pages: 1,
      },
    },
  }

  function mockSuccessfulLogin() {
    cy.intercept('GET', '**/notifications**', {
      statusCode: 200,
      body: {
        data: {
          items: [],
          meta: { total: 0, page: 1, limit: 10, pages: 0 },
          unreadCount: 0,
        },
      },
    }).as('notificationsRequest')

    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: {
        data: {
          accessToken: 'mock-token',
          user: {
            id: '1',
            email: superAdminEmail,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        },
      },
    }).as('loginRequest')

    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: {
        data: {
          id: '1',
          email: superAdminEmail,
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      },
    }).as('meRequest')
  }

  function loginAsMockedSuperAdmin() {
    mockSuccessfulLogin()
    cy.get('input[type="email"]').clear().type(superAdminEmail)
    cy.get('input[type="password"]').clear().type(superAdminPassword)
    cy.get('button[type="submit"]').click()
    cy.wait('@loginRequest')
    cy.url().should('include', '/dashboard')
  }

  function mockUsersListSuccess() {
    cy.intercept('GET', '**/users**', {
      statusCode: 200,
      body: usersListPayload,
    }).as('getUsers')
  }

  function openUsersPage() {
    cy.get('#app').then(($app) => {
      const vueApp = ($app.get(0) as { __vue_app__?: { config?: { globalProperties?: { $router?: { push: (location: { name: string }) => Promise<unknown> } } } } }).__vue_app__
      const router = vueApp?.config?.globalProperties?.$router

      expect(router, 'Vue router instance').to.exist

      return router?.push({ name: 'users' })
    })
    cy.wait('@getUsers')
    cy.url().should('include', '/users')
    cy.contains('Nuevo usuario').should('be.visible')
  }

  beforeEach(() => {
    cy.visit('/login')
  })

  describe('Login form', () => {
    it('should display error message on invalid credentials', () => {
      cy.get('input[type="email"]').type('invalid@email.com')
      cy.get('input[type="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()
      
      // Error message should be visible
      cy.get('[role="alert"], .error, [data-test="error"]')
        .should('be.visible')
        .and(($el) => {
          expect($el.text().trim().length).to.be.greaterThan(0)
        })
    })

    it('should clear error message on retry', () => {
      cy.get('input[type="email"]').type('invalid@email.com')
      cy.get('input[type="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()
      
      // Wait for error
      cy.get('[role="alert"], .error, [data-test="error"]').should('be.visible')
      
      // Clear and try again
      mockSuccessfulLogin()
      cy.get('input[type="email"]').clear().type(superAdminEmail)
      cy.get('input[type="password"]').clear().type(superAdminPassword)
      cy.get('button[type="submit"]').click()
      cy.wait('@loginRequest')

      // Should navigate to dashboard (success)
      cy.url().should('include', '/dashboard')
    })

    it('should handle network errors gracefully', () => {
      // Intercept and error out the login request
      cy.intercept('POST', '**/auth/login', { forceNetworkError: true })
      
      cy.get('input[type="email"]').type(superAdminEmail)
      cy.get('input[type="password"]').type(superAdminPassword)
      cy.get('button[type="submit"]').click()
      
      // Should show generic error message, not crash
      cy.get('[role="alert"], .error, [data-test="error"]')
        .should('be.visible')
    })
  })

  describe('Create/Update entity with validation errors', () => {
    beforeEach(() => {
      // Login as super admin (mocked)
      cy.visit('/login')
      loginAsMockedSuperAdmin()
      mockUsersListSuccess()
      openUsersPage()
    })

    it('should display validation error from API as human-readable message', () => {
      cy.intercept('POST', '**/users', {
        statusCode: 400,
        body: { message: 'Email ya existe' },
      }).as('createUserError')

      cy.contains('button', 'Nuevo usuario').click()
      cy.get('input[type="email"]').last().type('existing@local.dev')
      cy.get('input[type="password"]').type('Password2026!')
      cy.contains('button', /guardar/i).click()
      cy.wait('@createUserError')

      cy.get('[role="alert"]')
        .should('be.visible')
        .and('contain', 'Email ya existe')
    })

    it('should handle array error messages', () => {
      cy.intercept('POST', '**/users', {
        statusCode: 400,
        body: { message: ['Email already exists', 'Password too weak'] },
      }).as('createUserArrayError')

      cy.contains('button', 'Nuevo usuario').click()
      cy.get('input[type="email"]').last().type('existing@local.dev')
      cy.get('input[type="password"]').type('Password2026!')
      cy.contains('button', /guardar/i).click()
      cy.wait('@createUserArrayError')

      cy.get('[role="alert"]')
        .should('be.visible')
        .and(($el) => {
          const text = $el.text()
          expect(text).to.include('Email already exists')
          expect(text).to.not.include('[')
          expect(text).to.not.include(']')
        })
    })
  })

  describe('Automatic error toast notifications', () => {
    beforeEach(() => {
      cy.visit('/login')
      loginAsMockedSuperAdmin()
    })

    it('should keep UI stable on successful load', () => {
      mockUsersListSuccess()
      openUsersPage()
      cy.contains('existing@local.dev').should('be.visible')
    })

    it('should show toast on error action', () => {
      // Primera carga correcta para entrar en la vista
      mockUsersListSuccess()
      openUsersPage()

      // Siguiente carga falla y debe mostrar toast
      cy.intercept('GET', '**/users**', {
        statusCode: 500,
        body: { message: 'Database connection failed' },
      }).as('getUsersError')

      cy.get('input[placeholder*="Buscar por email o nombre"]').clear().type('broken search')
      cy.wait('@getUsersError')

      cy.get('[role="alert"]')
        .should('be.visible')
        .and('contain', 'No se pudieron cargar los usuarios')
    })
  })
})
