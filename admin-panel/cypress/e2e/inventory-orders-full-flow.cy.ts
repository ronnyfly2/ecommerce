/// <reference types="cypress" />

type ApiEnvelope<T> = {
  statusCode: number
  message: string
  data: T
  timestamp: string
  path: string
}

function apiOk<T>(path: string, data: T): ApiEnvelope<T> {
  return {
    statusCode: 200,
    message: 'Success',
    data,
    timestamp: new Date().toISOString(),
    path,
  }
}

describe('UI Full Flow - Inventory, Stores, Orders', () => {
  const baseStores = [
    {
      id: 'store-ate',
      code: 'ATE',
      name: 'Ate',
      city: 'Lima',
      country: 'Peru',
      address: 'Ate, Lima',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'store-lince',
      code: 'LINCE',
      name: 'Lince',
      city: 'Lima',
      country: 'Peru',
      address: 'Lince, Lima',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const baseStock = {
    'prod-1': { delivery: 10, pickup: { 'store-ate': 3, 'store-lince': 4 } },
    'prod-2': { delivery: 8, pickup: { 'store-ate': 2, 'store-lince': 5 } },
    'prod-3': { delivery: 6, pickup: { 'store-ate': 1, 'store-lince': 2 } },
  } as Record<string, { delivery: number; pickup: Record<string, number> }>

  const productCatalog = [
    { id: 'prod-1', name: 'Mochila Trail', sku: 'SKU-001' },
    { id: 'prod-2', name: 'Botella Termica', sku: 'SKU-002' },
    { id: 'prod-3', name: 'Casaca Urban', sku: 'SKU-003' },
  ]

  let storesDb = structuredClone(baseStores)
  let stockDb = structuredClone(baseStock)
  let ordersDb: Record<string, any> = {}

  function stockItems() {
    return productCatalog.map((product) => {
      const row = stockDb[product.id]
      const pickupStocks = storesDb
        .filter((s) => s.isActive)
        .map((store) => ({
          storeId: store.id,
          storeCode: store.code,
          storeName: store.name,
          stock: row.pickup[store.id] ?? 0,
        }))

      const totalStock = row.delivery + pickupStocks.reduce((acc, s) => acc + s.stock, 0)

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        deliveryStock: row.delivery,
        pickupStocks,
        totalStock,
        alerts: {
          lowDelivery: row.delivery <= 5,
          lowPickupStoreIds: pickupStocks.filter((p) => p.stock <= 5).map((p) => p.storeId),
        },
      }
    })
  }

  beforeEach(() => {
    storesDb = structuredClone(baseStores)
    stockDb = structuredClone(baseStock)
    ordersDb = {}

    cy.clearCookies()
    cy.clearLocalStorage()

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 201,
      body: {
        statusCode: 201,
        message: 'Success',
        data: {
          accessToken: '',
          user: {
            id: 'admin-1',
            email: 'admin@local.dev',
            firstName: 'Admin',
            lastName: 'UI',
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

    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: apiOk('/api/auth/me', {
        id: 'admin-1',
        email: 'admin@local.dev',
        firstName: 'Admin',
        lastName: 'UI',
        role: 'ADMIN',
        isActive: true,
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    })

    cy.intercept('POST', '**/auth/refresh', {
      statusCode: 200,
      body: apiOk('/api/auth/refresh', { accessToken: 'token-admin' }),
    })

    cy.intercept('GET', '**/api/dashboard/summary*', {
      statusCode: 200,
      body: apiOk('/api/dashboard/summary', {
        orderStats: {
          totalOrders: 10,
          totalRevenue: 1000,
          pendingOrders: 2,
          confirmedOrders: 3,
          shippedOrders: 2,
          deliveredOrders: 2,
          cancelledOrders: 1,
        },
        sales: {
          period: { preset: '7d', label: 'Ultimos 7 dias', from: '2026-03-22', to: '2026-03-29', days: 7 },
          trend: { totalOrders: 5, totalRevenue: 300, points: [] },
          comparison: { currentRevenue: 300, previousRevenue: 250, deltaPercent: 20 },
        },
        inventoryAlerts: { threshold: 5, lowStockCount: 2, outOfStockCount: 0, lowStockVariants: [] },
      }),
    })

    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: apiOk('/api/orders', { items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 1 } }),
    })

    cy.intercept('GET', /\/notifications(\?.*)?$/, {
      statusCode: 200,
      body: apiOk('/api/notifications', {
        items: [],
        unreadCount: 0,
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      }),
    })

    cy.intercept('GET', '**/api/products*', {
      statusCode: 200,
      body: apiOk('/api/products', {
        items: productCatalog.map((p) => ({
          ...p,
          slug: p.sku.toLowerCase(),
          description: null,
          basePrice: '100.00',
          currencyCode: 'USD',
          stock: stockDb[p.id].delivery + Object.values(stockDb[p.id].pickup).reduce((a, b) => a + b, 0),
          isActive: true,
          isFeatured: false,
          hasOffer: false,
          offerPrice: null,
          offerPercentage: null,
          category: null,
          coupon: null,
          variants: [],
          images: [],
          tags: [],
          recommendations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        meta: { total: 3, page: 1, limit: 100, totalPages: 1 },
      }),
    })

    cy.intercept('GET', '**/api/inventory/stores', (req) => {
      req.reply({
        statusCode: 200,
        body: apiOk('/api/inventory/stores', storesDb.filter((s) => s.isActive)),
      })
    }).as('storesActive')

    cy.intercept('GET', '**/api/inventory/stores/all', (req) => {
      req.reply({
        statusCode: 200,
        body: apiOk('/api/inventory/stores/all', storesDb),
      })
    }).as('storesAll')

    cy.intercept('GET', '**/api/inventory/stocks*', (req) => {
      const storeId = typeof req.query.storeId === 'string' ? req.query.storeId : undefined
      const items = stockItems().filter((item) => {
        if (!storeId) return true
        return item.pickupStocks.some((p) => p.storeId === storeId)
      })

      req.reply({
        statusCode: 200,
        body: apiOk('/api/inventory/stocks', {
          items,
          meta: { total: items.length, page: 1, limit: 20, totalPages: 1 },
        }),
      })
    }).as('stocksList')

    cy.intercept('PUT', '**/api/inventory/products/*/stock', (req) => {
      const productId = String(req.url.split('/inventory/products/')[1]?.split('/stock')[0])
      const body = req.body as { deliveryStock?: number; pickupStocks?: Array<{ storeId: string; stock: number }> }
      if (body.deliveryStock !== undefined) {
        stockDb[productId].delivery = Number(body.deliveryStock)
      }
      for (const pickup of body.pickupStocks ?? []) {
        stockDb[productId].pickup[pickup.storeId] = Number(pickup.stock)
      }

      req.reply({
        statusCode: 200,
        body: apiOk(`/api/inventory/products/${productId}/stock`, {
          productId,
          sku: productCatalog.find((p) => p.id === productId)?.sku ?? 'SKU',
          deliveryStock: stockDb[productId].delivery,
          pickupStocks: storesDb.filter((s) => s.isActive).map((s) => ({
            storeId: s.id,
            storeCode: s.code,
            storeName: s.name,
            stock: stockDb[productId].pickup[s.id] ?? 0,
          })),
          totalStock: stockDb[productId].delivery + Object.values(stockDb[productId].pickup).reduce((a, b) => a + b, 0),
        }),
      })
    }).as('saveRowStock')

    cy.intercept('PUT', '**/api/inventory/stocks/bulk', (req) => {
      const body = req.body as { items: Array<{ productId: string; deliveryStock?: number; pickupStocks?: Array<{ storeId: string; stock: number }> }> }
      for (const item of body.items) {
        if (item.deliveryStock !== undefined) {
          stockDb[item.productId].delivery = Number(item.deliveryStock)
        }
        for (const pickup of item.pickupStocks ?? []) {
          stockDb[item.productId].pickup[pickup.storeId] = Number(pickup.stock)
        }
      }
      req.reply({
        statusCode: 200,
        body: apiOk('/api/inventory/stocks/bulk', {
          totalUpdated: body.items.length,
          items: body.items,
        }),
      })
    }).as('saveBulkStock')

    cy.intercept('POST', '**/api/inventory/stores', (req) => {
      const body = req.body as { code: string; name: string; city: string; country: string; address?: string; isActive?: boolean }
      const created = {
        id: `store-${Date.now()}`,
        code: body.code,
        name: body.name,
        city: body.city,
        country: body.country,
        address: body.address ?? '',
        isActive: body.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      storesDb.push(created)
      req.reply({ statusCode: 201, body: apiOk('/api/inventory/stores', created) })
    }).as('createStore')

    cy.intercept('PATCH', '**/api/inventory/stores/*', (req) => {
      const storeId = String(req.url.split('/inventory/stores/')[1])
      const body = req.body as Record<string, unknown>
      const idx = storesDb.findIndex((s) => s.id === storeId)
      storesDb[idx] = { ...storesDb[idx], ...body, updatedAt: new Date().toISOString() }
      req.reply({ statusCode: 200, body: apiOk(`/api/inventory/stores/${storeId}`, storesDb[idx]) })
    }).as('updateStore')

    cy.intercept('DELETE', '**/api/inventory/stores/*', (req) => {
      const storeId = String(req.url.split('/inventory/stores/')[1])
      const idx = storesDb.findIndex((s) => s.id === storeId)
      if (idx >= 0) storesDb.splice(idx, 1)
      req.reply({ statusCode: 204, body: '' })
    }).as('deleteStore')

    cy.intercept('POST', '**/api/orders', (req) => {
      const body = req.body as {
        fulfillmentType?: 'delivery' | 'pickup'
        pickupStoreId?: string
        items: Array<{ productId: string; quantity: number }>
      }
      const id = `order-${Date.now()}`
      ordersDb[id] = {
        id,
        status: 'PENDING',
        fulfillmentType: body.fulfillmentType ?? 'delivery',
        pickupStoreId: body.pickupStoreId ?? null,
        items: body.items,
      }

      req.reply({
        statusCode: 201,
        body: apiOk('/api/orders', {
          id,
          user: { id: 'admin-1', email: 'admin@local.dev', firstName: 'Admin', lastName: 'UI', role: 'ADMIN', isActive: true, avatar: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          status: 'PENDING',
          fulfillmentType: ordersDb[id].fulfillmentType,
          pickupStore: ordersDb[id].pickupStoreId ? storesDb.find((s) => s.id === ordersDb[id].pickupStoreId) : null,
          subtotal: '100.00',
          discount: '0.00',
          total: '100.00',
          currencyCode: 'USD',
          exchangeRateToUsd: '1.000000',
          notes: null,
          coupon: null,
          items: body.items.map((it, idx) => ({
            id: `${id}-item-${idx}`,
            product: productCatalog.find((p) => p.id === it.productId),
            variant: null,
            snapshotProductName: null,
            snapshotSku: null,
            snapshotDescriptor: null,
            quantity: it.quantity,
            unitPrice: '100.00',
            subtotal: String(it.quantity * 100),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          shippingAddresses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
    }).as('createOrder')

    cy.intercept('GET', '**/api/orders/*', (req) => {
      const id = String(req.url.split('/api/orders/')[1]).split('?')[0]
      const order = ordersDb[id]
      req.reply({
        statusCode: 200,
        body: apiOk(`/api/orders/${id}`, {
          id,
          user: { id: 'admin-1', email: 'admin@local.dev', firstName: 'Admin', lastName: 'UI', role: 'ADMIN', isActive: true, avatar: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          status: order.status,
          fulfillmentType: order.fulfillmentType,
          pickupStore: order.pickupStoreId ? storesDb.find((s) => s.id === order.pickupStoreId) : null,
          subtotal: '100.00',
          discount: '0.00',
          total: '100.00',
          currencyCode: 'USD',
          exchangeRateToUsd: '1.000000',
          notes: null,
          coupon: null,
          items: order.items.map((it: any, idx: number) => ({
            id: `${id}-item-${idx}`,
            product: productCatalog.find((p) => p.id === it.productId),
            variant: null,
            snapshotProductName: null,
            snapshotSku: null,
            snapshotDescriptor: null,
            quantity: it.quantity,
            unitPrice: '100.00',
            subtotal: String(it.quantity * 100),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          shippingAddresses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
    }).as('getOrder')

    cy.intercept('PATCH', '**/api/orders/*/status', (req) => {
      const id = String(req.url.split('/api/orders/')[1]).split('/status')[0]
      const order = ordersDb[id]
      order.status = 'CONFIRMED'

      // emulate backend decrement by fulfillment channel
      for (const item of order.items) {
        const productId = item.productId
        const qty = Number(item.quantity)
        if (order.fulfillmentType === 'pickup' && order.pickupStoreId) {
          stockDb[productId].pickup[order.pickupStoreId] -= qty
        } else {
          stockDb[productId].delivery -= qty
        }
      }

      req.reply({
        statusCode: 200,
        body: apiOk(`/api/orders/${id}/status`, {
          id,
          user: { id: 'admin-1', email: 'admin@local.dev', firstName: 'Admin', lastName: 'UI', role: 'ADMIN', isActive: true, avatar: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          status: 'CONFIRMED',
          fulfillmentType: order.fulfillmentType,
          pickupStore: order.pickupStoreId ? storesDb.find((s) => s.id === order.pickupStoreId) : null,
          subtotal: '100.00',
          discount: '0.00',
          total: '100.00',
          currencyCode: 'USD',
          exchangeRateToUsd: '1.000000',
          notes: null,
          coupon: null,
          items: order.items.map((it: any, idx: number) => ({
            id: `${id}-item-${idx}`,
            product: productCatalog.find((p) => p.id === it.productId),
            variant: null,
            snapshotProductName: null,
            snapshotSku: null,
            snapshotDescriptor: null,
            quantity: it.quantity,
            unitPrice: '100.00',
            subtotal: String(it.quantity * 100),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          shippingAddresses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
    }).as('confirmOrder')

    cy.visit('/login')
    cy.get('#login-email').type('admin@local.dev')
    cy.get('#login-password').type('Admin2026!')
    cy.contains('button', 'Ingresar').click()
    cy.wait('@login')
  })

  it('stock por producto: guarda por fila y masivo + filtra por tienda + exporta CSV', () => {
    cy.visit('/inventory/stock')
    cy.wait('@stocksList')

    // Row save (first row)
    cy.get('tbody tr').eq(0).within(() => {
      cy.get('input[type="number"]').first().clear().type('12')
      cy.contains('button', 'Guardar').click()
    })

    cy.wait('@saveRowStock').its('request.body').then((body: any) => {
      expect(body.deliveryStock).to.eq(12)
    })

    // Bulk save (rows 2 and 3)
    cy.get('tbody tr').eq(1).within(() => {
      cy.get('input[type="number"]').first().clear().type('9')
    })
    cy.get('tbody tr').eq(2).within(() => {
      cy.get('input[type="number"]').first().clear().type('7')
    })

    cy.contains('button', 'Guardar cambios').click()
    cy.wait('@saveBulkStock').its('request.body.items').should('have.length', 2)

    // Filter by store
    cy.intercept('GET', '**/api/inventory/stocks*storeId=store-ate*').as('stocksFiltered')
    cy.contains('label', 'Filtrar por tienda').parent().find('select').select('store-ate')
    cy.contains('button', 'Aplicar filtros').click()
    cy.wait('@stocksFiltered')

    // CSV export
    cy.window().then((win) => {
      const createBlobUrlStub = cy.stub(win.URL, 'createObjectURL').returns('blob:mock')
      cy.wrap(createBlobUrlStub).as('createBlobUrl')
    })
    cy.contains('button', 'Exportar CSV').click()
    cy.get('@createBlobUrl').should('have.been.called')
  })

  it('tiendas: crear, editar y eliminar', () => {
    cy.visit('/inventory/stores')
    cy.wait('@storesAll')

    cy.contains('button', 'Nueva tienda').click()
    cy.contains('label', 'Código').parent().find('input').type('MIRAFLORES')
    cy.contains('label', 'Nombre').parent().find('input').type('Miraflores')
    cy.contains('label', 'Ciudad').parent().find('input').type('Lima')
    cy.contains('label', 'País').parent().find('input').type('Peru')
    cy.contains('button', 'Guardar').click()

    cy.wait('@createStore').its('request.body').should((body) => {
      expect(body.code).to.eq('MIRAFLORES')
      expect(body.name).to.eq('Miraflores')
    })

    cy.contains('td', 'MIRAFLORES').parents('tr').within(() => {
      cy.contains('button', 'Editar').click()
    })

    cy.contains('label', 'Nombre').parent().find('input').clear().type('Miraflores Centro')
    cy.contains('button', 'Guardar').click()
    cy.wait('@updateStore').its('request.body').should((body) => {
      expect(body.name).to.eq('Miraflores Centro')
    })

    cy.contains('td', 'MIRAFLORES').parents('tr').within(() => {
      cy.contains('button', 'Eliminar').click()
    })
    cy.get('[role="alertdialog"]').contains('button', 'Eliminar').click({ force: true })
    cy.wait('@deleteStore')
    cy.contains('td', 'MIRAFLORES').should('not.exist')
  })

  it('orden delivery y pickup + confirmar y verificar descuento de stock por canal', () => {
    // Delivery order
    cy.visit('/orders/new')

    cy.contains('label', 'Producto').parent().find('button[aria-haspopup="listbox"]').click()
    cy.get('[role="option"]').contains('Mochila Trail').click()
    cy.contains('label', 'Cantidad').parent().find('input[type="number"]').clear().type('2')
    cy.contains('button', 'Crear orden').click()

    cy.wait('@createOrder').its('request.body').should((body) => {
      expect(body.fulfillmentType).to.eq('delivery')
      expect(body.items[0].productId).to.eq('prod-1')
      expect(body.items[0].quantity).to.eq(2)
    })

    cy.contains('label', 'Cambiar estado').parent().find('select').select('Confirmada')
    cy.contains('button', 'Actualizar estado').should('be.visible')
    cy.contains('button', 'Actualizar estado').click()
    cy.wait('@confirmOrder')

    // Pickup order
    cy.visit('/orders/new')
    cy.contains('label', 'Fulfillment').parent().find('select').select('Retiro en tienda')

    cy.contains('label', 'Tienda de retiro').parent().find('select').select('store-ate')
    cy.contains('label', 'Producto').parent().find('button[aria-haspopup="listbox"]').click()
    cy.get('[role="option"]').contains('Botella Termica').click()
    cy.contains('label', 'Cantidad').parent().find('input[type="number"]').clear().type('1')
    cy.contains('button', 'Crear orden').click()

    cy.wait('@createOrder').its('request.body').should((body) => {
      expect(body.fulfillmentType).to.eq('pickup')
      expect(body.pickupStoreId).to.eq('store-ate')
      expect(body.items[0].productId).to.eq('prod-2')
      expect(body.items[0].quantity).to.eq(1)
    })

    cy.contains('label', 'Cambiar estado').parent().find('select').select('Confirmada')
    cy.contains('button', 'Actualizar estado').click()
    cy.wait('@confirmOrder')

    // Verify stock reflects decrements by channel
    cy.visit('/inventory/stock')
    cy.wait('@stocksList')

    // prod-1 delivery: 10 -> 8 after confirmed delivery x2
    cy.contains('td', 'SKU-001').parents('tr').within(() => {
      cy.get('input[type="number"]').first().should('have.value', '8')
    })

    // prod-2 pickup ATE: 2 -> 1 after confirmed pickup x1
    cy.contains('td', 'SKU-002').parents('tr').within(() => {
      cy.get('input[type="number"]').eq(1).should('have.value', '1')
    })
  })
})
