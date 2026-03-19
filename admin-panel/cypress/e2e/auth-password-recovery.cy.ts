describe('Auth Password Recovery', () => {
  const testEmail = 'recover.user@example.com'
  const oldPassword = 'OldPass123!'
  const newPassword = 'NewPass123!'

  it('requests forgot-password successfully', () => {
    cy.intercept('POST', '**/auth/forgot-password', (req) => {
      expect(req.body.email).to.equal(testEmail)
      req.reply({
        statusCode: 201,
        body: {
          statusCode: 201,
          message: 'Success',
          data: { message: 'If that email exists, you will receive a password reset link' },
          timestamp: new Date().toISOString(),
          path: '/api/auth/forgot-password',
        },
      })
    }).as('forgotPassword')

    cy.visit('/login')
    cy.contains('button', '¿Olvidaste tu contraseña?').click()

    cy.url().should('include', '/forgot-password')
    cy.get('#forgot-email').type(testEmail)
    cy.contains('button', 'Enviar enlace').click()

    cy.wait('@forgotPassword')
    cy.contains('If that email exists, you will receive a password reset link').should('be.visible')
  })

  it('shows expired-token error on reset-password', () => {
    cy.intercept('POST', '**/auth/reset-password', {
      statusCode: 400,
      body: {
        statusCode: 400,
        message: 'Password reset token has expired',
        timestamp: new Date().toISOString(),
        path: '/api/auth/reset-password',
      },
    }).as('resetPassword')

    cy.visit('/reset-password?token=expired-token')

    cy.get('#reset-password input').type(newPassword)
    cy.get('#reset-password-confirm input').type(newPassword)
    cy.contains('button', 'Actualizar contraseña').click()

    cy.wait('@resetPassword')
    cy.contains('Password reset token has expired').should('be.visible')
  })

  it('resets password and allows login with new password while rejecting old password', () => {
    cy.intercept('POST', '**/auth/reset-password', {
      statusCode: 201,
      body: {
        statusCode: 201,
        message: 'Success',
        data: { message: 'Password reset successfully' },
        timestamp: new Date().toISOString(),
        path: '/api/auth/reset-password',
      },
    }).as('resetPasswordSuccess')

    cy.visit('/reset-password?token=valid-token')
    cy.get('#reset-password input').type(newPassword)
    cy.get('#reset-password-confirm input').type(newPassword)
    cy.contains('button', 'Actualizar contraseña').click()

    cy.wait('@resetPasswordSuccess')
    cy.contains('Password reset successfully').should('be.visible')

    cy.intercept('POST', '**/auth/login', (req) => {
      const password = String(req.body?.password ?? '')
      if (password === oldPassword) {
        req.reply({
          statusCode: 401,
          body: {
            statusCode: 401,
            message: 'Unauthorized',
            data: {
              statusCode: 401,
              message: 'Invalid credentials',
            },
            timestamp: new Date().toISOString(),
            path: '/api/auth/login',
          },
        })
        return
      }

      req.reply({
        statusCode: 201,
        body: {
          statusCode: 201,
          message: 'Success',
          data: {
            accessToken: 'fake.jwt.token',
            user: {
              id: 'user-1',
              email: testEmail,
              firstName: 'Recover',
              lastName: 'User',
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
      })
    }).as('login')

    cy.visit('/login')

    cy.get('#login-email input').clear().type(testEmail)
    cy.get('#login-password input').clear().type(oldPassword)
    cy.contains('button', 'Ingresar').click()

    cy.wait('@login').its('response.statusCode').should('eq', 401)
    cy.url().should('include', '/login')

    cy.get('#login-password input').clear().type(newPassword)
    cy.contains('button', 'Ingresar').click()

    cy.wait('@login').its('response.statusCode').should('eq', 201)
    cy.url().should('include', '/dashboard')
  })
})
