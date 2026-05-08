type StoredDraft = {
  id: string
  documentKey: string
  fileName: string
  totalPages: number
  draft: {
    version: number
    annotations: Array<Record<string, unknown>>
  }
  createdAt: string
  updatedAt: string
}

type PdfEditorTestApi = {
  bootstrapMockDocument: (payload?: {
    fileName?: string
    documentKey?: string
    totalPages?: number
  }) => void
}

function apiOk(path: string, data: unknown) {
  return {
    statusCode: 200,
    message: 'Success',
    data,
    timestamp: new Date().toISOString(),
    path,
  }
}

describe('PDF Editor - Draft persistence', () => {
  const user = {
    id: 'admin-1',
    email: 'admin@local.dev',
    firstName: 'Admin',
    lastName: 'Pdf',
    role: 'ADMIN',
    grantedRoles: ['ADMIN'],
    grantedPermissions: ['dashboard.read', 'admin-tools.read', 'notifications.read'],
    effectivePermissions: ['dashboard.read', 'admin-tools.read', 'notifications.read'],
    isActive: true,
    avatar: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  let serverDraft: StoredDraft | null = null

  function bootstrapEditorState() {
    cy.window().then((win) => {
      const testApi = (win as Window & { __pdfEditorTestApi?: PdfEditorTestApi }).__pdfEditorTestApi
      expect(testApi, 'pdf editor test api').to.exist
      testApi?.bootstrapMockDocument({
        fileName: 'editor-e2e.pdf',
        documentKey: 'pdf-editor-e2e-key',
        totalPages: 1,
      })
    })
  }

  beforeEach(() => {
    serverDraft = null
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: apiOk('/api/auth/me', user),
    }).as('me')

    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: apiOk('/api/auth/refresh', { accessToken: 'token-admin' }),
    })

    cy.intercept('GET', '**/api/notifications*', {
      statusCode: 200,
      body: apiOk('/api/notifications', {
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
        unreadCount: 0,
      }),
    })

    cy.intercept('PUT', '**/api/admin-tools/pdf-drafts', (req) => {
      const now = new Date().toISOString()
      serverDraft = {
        id: 'draft-1',
        documentKey: String(req.body.documentKey),
        fileName: String(req.body.fileName),
        totalPages: Number(req.body.totalPages),
        draft: req.body.draft,
        createdAt: now,
        updatedAt: now,
      }

      req.reply({
        statusCode: 200,
        body: apiOk('/api/admin-tools/pdf-drafts', serverDraft),
      })
    }).as('savePdfDraft')

    cy.intercept('GET', '**/api/admin-tools/pdf-drafts?*', (req) => {
      if (!serverDraft) {
        req.reply({
          statusCode: 404,
          body: {
            statusCode: 404,
            message: 'Draft not found',
            timestamp: new Date().toISOString(),
            path: '/api/admin-tools/pdf-drafts',
          },
        })
        return
      }

      req.reply({
        statusCode: 200,
        body: apiOk('/api/admin-tools/pdf-drafts', serverDraft),
      })
    }).as('getPdfDraft')

    cy.intercept('DELETE', '**/api/admin-tools/pdf-drafts?*', () => {
      serverDraft = null
      return {
        statusCode: 200,
        body: apiOk('/api/admin-tools/pdf-drafts', { deleted: true }),
      }
    }).as('deletePdfDraft')

    cy.window().then((win) => {
      win.localStorage.setItem('access_token', 'token-admin')
    })
  })

  it('persists draft lifecycle through API', () => {
    cy.visit('/admin-tools/pdf-editor')
    cy.wait('@me')
    cy.contains('h1', 'Editor PDF').should('be.visible')
    bootstrapEditorState()

    cy.contains('button', 'Agregar texto').click()
    cy.contains('Texto editable').should('be.visible')

    cy.contains('button', 'Guardar borrador').click()
    cy.wait('@savePdfDraft').its('request.body').then((body) => {
      expect(body).to.have.property('documentKey').and.to.be.a('string').and.not.be.empty
      expect(body).to.have.property('totalPages', 1)
      expect(body.draft).to.have.property('annotations')
      expect(body.draft.annotations).to.have.length.greaterThan(0)
    })
    cy.wait('@getPdfDraft')
    cy.contains('Borrador guardado').should('be.visible')

    cy.contains('button', 'Eliminar seleccionado').click()
    cy.contains('Texto editable').should('not.exist')

    cy.contains('button', 'Cargar borrador').click({ force: true })
    cy.wait('@getPdfDraft')
    cy.contains('Borrador cargado').should('be.visible')
    cy.contains('Texto editable').should('be.visible')

    cy.contains('button', 'Limpiar borrador').click()
    cy.wait('@deletePdfDraft')
    cy.contains('Borrador eliminado').should('be.visible')

    cy.contains('button', 'Cargar borrador').click({ force: true })
    cy.wait('@getPdfDraft')
    cy.contains('Sin borrador').should('be.visible')
  })
})
