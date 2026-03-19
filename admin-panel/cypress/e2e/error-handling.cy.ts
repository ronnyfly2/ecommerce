// E2E test: Error handling and error messages
// Verify that error messages are properly extracted and displayed

describe('Error Handling & Messages', () => {
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
        .and('contain', 'Credenciales')
    })

    it('should clear error message on retry', () => {
      cy.get('input[type="email"]').type('invalid@email.com')
      cy.get('input[type="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()
      
      // Wait for error
      cy.get('[role="alert"], .error, [data-test="error"]').should('be.visible')
      
      // Clear and try again
      cy.get('input[type="email"]').clear().type('admin@local.dev')
      cy.get('input[type="password"]').clear().type('Admin2026!')
      cy.get('button[type="submit"]').click()
      
      // Should navigate to dashboard (success)
      cy.url().should('include', '/dashboard')
    })

    it('should handle network errors gracefully', () => {
      // Intercept and error out the login request
      cy.intercept('POST', '**/auth/login', { forceNetworkError: true })
      
      cy.get('input[type="email"]').type('admin@local.dev')
      cy.get('input[type="password"]').type('Admin2026!')
      cy.get('button[type="submit"]').click()
      
      // Should show generic error message, not crash
      cy.get('[role="alert"], .error, [data-test="error"]')
        .should('be.visible')
    })
  })

  describe('Create/Update entity with validation errors', () => {
    beforeEach(() => {
      // Login as admin
      cy.visit('/login')
      cy.get('input[type="email"]').type('admin@local.dev')
      cy.get('input[type="password"]').type('Admin2026!')
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/dashboard')
    })

    it('should display validation error from API as human-readable message', () => {
      cy.visit('/users')
      
      // Click create user
      cy.get('button').contains(/new|crear|add/i).first().click()
      
      // Submit empty form to trigger validation error
      cy.get('button').contains(/save|guardar|crear/i).click()
      
      // Error should be displayed (will vary based on backend validation)
      cy.get('[role="alert"], .error, [data-test="error"]')
        .should('be.visible')
    })

    it('should handle array error messages', () => {
      // Some backends return validation errors as arrays
      // e.g. { message: ["Email already exists", "Password too weak"]}
      cy.visit('/categories')
      
      cy.get('button').contains(/new|crear|add/i).first().click()
      
      // Try to create with invalid data (depends on validation rules)
      cy.get('input').first().clear()
      cy.get('button').contains(/save|guardar/i).click()
      
      // Should extract first message from array and display it
      cy.get('[role="alert"], .error, [data-test="error"]')
        .should('be.visible')
        .and(($el) => {
          const text = $el.text()
          // Should be a readable message, not JSON array
          expect(text).to.not.include('[')
          expect(text).to.not.include(']')
        })
    })
  })

  describe('Automatic error toast notifications', () => {
    beforeEach(() => {
      cy.visit('/login')
      cy.get('input[type="email"]').type('admin@local.dev')
      cy.get('input[type="password"]').type('Admin2026!')
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/dashboard')
    })

    it('should show toast on successful action', () => {
      cy.visit('/users')
      
      // Intercept and mock a successful response
      cy.intercept('GET', '**/users**', { fixture: 'users.json' }).as('getUsers')
      
      // Toast should appear with success message
      cy.get('[role="status"], [data-test="toast-success"]')
        .should('have.length.greaterThan', 0)
    })

    it('should show toast on error action', () => {
      cy.visit('/users')
      
      // Intercept and return an error
      cy.intercept('GET', '**/users**', {
        statusCode: 500,
        body: { message: 'Database connection failed' },
      })
      
      // Refresh or navigate to trigger load
      cy.reload()
      
      // Error toast should appear
      cy.get('[role="alert"], [data-test="toast-error"]')
        .should('exist')
    })
  })
})
