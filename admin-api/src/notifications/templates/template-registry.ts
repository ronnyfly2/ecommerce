import { EmailTemplateKey } from './enums/template-key.enum';

export type TemplateVariable = {
  name: string;
  description: string;
  example?: unknown;
};

export type TemplateDefinition = {
  key: EmailTemplateKey;
  label: string;
  description: string;
  category: 'order' | 'payment' | 'shipment' | 'return' | 'stock' | 'auth';
  defaultFile: string;
  defaultSubject: string;
  variables: TemplateVariable[];
  sampleContext: Record<string, unknown>;
};

const baseSampleOrderItems = [
  { name: 'Camiseta basica negra', quantity: 2, subtotal: 45.98 },
  { name: 'Pantalon jogger gris', quantity: 1, subtotal: 39.9 },
];

export const TEMPLATE_REGISTRY: Readonly<Record<EmailTemplateKey, TemplateDefinition>> = {
  [EmailTemplateKey.ORDER_CONFIRMATION]: {
    key: EmailTemplateKey.ORDER_CONFIRMATION,
    label: 'Confirmacion de orden',
    description: 'Se envia cuando una orden es creada.',
    category: 'order',
    defaultFile: 'order.confirmation.hbs',
    defaultSubject: 'Confirmacion de orden #{{orderCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'orderUrl', description: 'URL a la orden en el panel' },
      { name: 'items[]', description: 'Lista de items { name, quantity, subtotal }' },
      { name: 'total', description: 'Total de la orden' },
      { name: 'currency', description: 'Codigo ISO de moneda' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      orderUrl: '{{appUrl}}/orders/a1b2c3d4',
      items: baseSampleOrderItems,
      total: 85.88,
      currency: 'USD',
    },
  },
  [EmailTemplateKey.ORDER_STATUS_CHANGED]: {
    key: EmailTemplateKey.ORDER_STATUS_CHANGED,
    label: 'Cambio de estado de orden',
    description: 'Notifica al cliente cuando el estado de su orden cambia.',
    category: 'order',
    defaultFile: 'order.status-changed.hbs',
    defaultSubject: 'Tu orden #{{orderCode}} cambio a {{status}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'orderUrl', description: 'URL a la orden' },
      { name: 'previousStatus', description: 'Estado anterior' },
      { name: 'status', description: 'Nuevo estado' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      orderUrl: '{{appUrl}}/orders/a1b2c3d4',
      previousStatus: 'pending',
      status: 'processing',
    },
  },
  [EmailTemplateKey.ORDER_PAYMENT_RECEIPT_RECEIVED]: {
    key: EmailTemplateKey.ORDER_PAYMENT_RECEIPT_RECEIVED,
    label: 'Comprobante recibido',
    description: 'Se envia cuando el cliente sube un comprobante manual.',
    category: 'payment',
    defaultFile: 'order.payment-receipt-received.hbs',
    defaultSubject: 'Recibimos tu comprobante para la orden #{{orderCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'orderUrl', description: 'URL a la orden' },
      { name: 'total', description: 'Total de la orden' },
      { name: 'currency', description: 'Moneda' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      orderUrl: '{{appUrl}}/orders/a1b2c3d4',
      total: 85.88,
      currency: 'USD',
    },
  },
  [EmailTemplateKey.ORDER_PAYMENT_APPROVED]: {
    key: EmailTemplateKey.ORDER_PAYMENT_APPROVED,
    label: 'Pago aprobado',
    description: 'Confirmacion de pago validado por el equipo o el gateway.',
    category: 'payment',
    defaultFile: 'order.payment-approved.hbs',
    defaultSubject: 'Tu pago para la orden #{{orderCode}} fue aprobado',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'orderUrl', description: 'URL a la orden' },
      { name: 'total', description: 'Total de la orden' },
      { name: 'currency', description: 'Moneda' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      orderUrl: '{{appUrl}}/orders/a1b2c3d4',
      total: 85.88,
      currency: 'USD',
    },
  },
  [EmailTemplateKey.ORDER_PAYMENT_REJECTED]: {
    key: EmailTemplateKey.ORDER_PAYMENT_REJECTED,
    label: 'Pago rechazado',
    description: 'Notifica al cliente que el comprobante no pudo ser validado.',
    category: 'payment',
    defaultFile: 'order.payment-rejected.hbs',
    defaultSubject: 'No pudimos validar tu pago para la orden #{{orderCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'orderUrl', description: 'URL a la orden' },
      { name: 'reason', description: 'Motivo del rechazo (opcional)' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      orderUrl: '{{appUrl}}/orders/a1b2c3d4',
      reason: 'El monto del comprobante no coincide con el total de la orden.',
    },
  },
  [EmailTemplateKey.SHIPMENT_CREATED]: {
    key: EmailTemplateKey.SHIPMENT_CREATED,
    label: 'Envio registrado',
    description: 'Se envia cuando se genera un envio para la orden.',
    category: 'shipment',
    defaultFile: 'shipment.created.hbs',
    defaultSubject: 'Registramos un envio para tu orden #{{orderCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'orderUrl', description: 'URL a la orden' },
      { name: 'carrier', description: 'Nombre de la transportadora' },
      { name: 'trackingNumber', description: 'Codigo de rastreo' },
      { name: 'trackingUrl', description: 'URL publica de seguimiento' },
      { name: 'estimatedDelivery', description: 'Fecha estimada (opcional)' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      orderUrl: '{{appUrl}}/orders/a1b2c3d4',
      carrier: 'Shalom',
      trackingNumber: 'SHL-1029384',
      trackingUrl: 'https://tracking.example.com/SHL-1029384',
      estimatedDelivery: '2026-04-24',
    },
  },
  [EmailTemplateKey.SHIPMENT_IN_TRANSIT]: {
    key: EmailTemplateKey.SHIPMENT_IN_TRANSIT,
    label: 'Envio en transito',
    description: 'Actualizacion de estado del envio a en transito.',
    category: 'shipment',
    defaultFile: 'shipment.in-transit.hbs',
    defaultSubject: 'Tu pedido #{{orderCode}} esta en camino',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'trackingNumber', description: 'Codigo de rastreo' },
      { name: 'trackingUrl', description: 'URL de seguimiento' },
      { name: 'estimatedDelivery', description: 'Fecha estimada' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      trackingNumber: 'SHL-1029384',
      trackingUrl: 'https://tracking.example.com/SHL-1029384',
      estimatedDelivery: '2026-04-24',
    },
  },
  [EmailTemplateKey.SHIPMENT_DELIVERED]: {
    key: EmailTemplateKey.SHIPMENT_DELIVERED,
    label: 'Envio entregado',
    description: 'Confirmacion de entrega al cliente.',
    category: 'shipment',
    defaultFile: 'shipment.delivered.hbs',
    defaultSubject: 'Entregamos tu pedido #{{orderCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'deliveredAt', description: 'Fecha/hora de entrega' },
      { name: 'reviewUrl', description: 'URL para dejar resena' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      deliveredAt: '2026-04-22T14:30:00Z',
      reviewUrl: '{{appUrl}}/orders/a1b2c3d4/reviews',
    },
  },
  [EmailTemplateKey.RETURN_REQUESTED]: {
    key: EmailTemplateKey.RETURN_REQUESTED,
    label: 'Devolucion solicitada',
    description: 'Confirma al cliente que su solicitud fue recibida.',
    category: 'return',
    defaultFile: 'return.requested.hbs',
    defaultSubject: 'Recibimos tu solicitud de devolucion #{{returnCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'orderCode', description: 'Codigo corto de la orden' },
      { name: 'returnCode', description: 'Codigo corto del RMA' },
      { name: 'returnUrl', description: 'URL a la devolucion' },
      { name: 'reason', description: 'Motivo del cliente' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      orderCode: 'A1B2C3D4',
      returnCode: 'R7F8',
      returnUrl: '{{appUrl}}/returns/r7f8',
      reason: 'Talla incorrecta',
    },
  },
  [EmailTemplateKey.RETURN_APPROVED]: {
    key: EmailTemplateKey.RETURN_APPROVED,
    label: 'Devolucion aprobada',
    description: 'Incluye instrucciones de envio si se proveen.',
    category: 'return',
    defaultFile: 'return.approved.hbs',
    defaultSubject: 'Aprobamos tu devolucion #{{returnCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'returnCode', description: 'Codigo corto del RMA' },
      { name: 'returnUrl', description: 'URL a la devolucion' },
      { name: 'instructions', description: 'Instrucciones de devolucion (opcional)' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      returnCode: 'R7F8',
      returnUrl: '{{appUrl}}/returns/r7f8',
      instructions: 'Empaca el producto en su caja original y envialo a nuestro almacen central.',
    },
  },
  [EmailTemplateKey.RETURN_REJECTED]: {
    key: EmailTemplateKey.RETURN_REJECTED,
    label: 'Devolucion rechazada',
    description: 'Comunica el rechazo con un motivo opcional.',
    category: 'return',
    defaultFile: 'return.rejected.hbs',
    defaultSubject: 'Tu devolucion #{{returnCode}} no pudo ser aprobada',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'returnCode', description: 'Codigo corto del RMA' },
      { name: 'returnUrl', description: 'URL a la devolucion' },
      { name: 'reason', description: 'Motivo del rechazo' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      returnCode: 'R7F8',
      returnUrl: '{{appUrl}}/returns/r7f8',
      reason: 'El plazo de devolucion vencio.',
    },
  },
  [EmailTemplateKey.RETURN_REFUNDED]: {
    key: EmailTemplateKey.RETURN_REFUNDED,
    label: 'Reembolso emitido',
    description: 'Notifica el reembolso y el metodo usado.',
    category: 'return',
    defaultFile: 'return.refunded.hbs',
    defaultSubject: 'Emitimos el reembolso de tu devolucion #{{returnCode}}',
    variables: [
      { name: 'customerName', description: 'Nombre del cliente' },
      { name: 'returnCode', description: 'Codigo corto del RMA' },
      { name: 'returnUrl', description: 'URL a la devolucion' },
      { name: 'refundAmount', description: 'Monto reembolsado' },
      { name: 'currency', description: 'Moneda' },
      { name: 'refundMethod', description: 'Metodo (tarjeta, transferencia, etc.)' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      returnCode: 'R7F8',
      returnUrl: '{{appUrl}}/returns/r7f8',
      refundAmount: 85.88,
      currency: 'USD',
      refundMethod: 'Tarjeta original',
    },
  },
  [EmailTemplateKey.STOCK_LOW_ALERT]: {
    key: EmailTemplateKey.STOCK_LOW_ALERT,
    label: 'Alerta de stock bajo',
    description: 'Se envia al equipo cuando uno o mas productos caen por debajo del umbral.',
    category: 'stock',
    defaultFile: 'stock.low-alert.hbs',
    defaultSubject: 'Stock bajo: {{items.length}} productos requieren reposicion',
    variables: [
      { name: 'recipientName', description: 'Nombre del destinatario interno' },
      { name: 'items[]', description: '{ name, sku, stock, threshold, store? }' },
      { name: 'inventoryUrl', description: 'URL al modulo de inventario' },
    ],
    sampleContext: {
      recipientName: 'Equipo de inventario',
      items: [
        { name: 'Camiseta basica negra', sku: 'CAM-BAS-NEG-M', stock: 3, threshold: 5, store: 'Principal' },
        { name: 'Pantalon jogger gris', sku: 'PAN-JOG-GRI-L', stock: 1, threshold: 4 },
      ],
      inventoryUrl: '{{appUrl}}/inventory',
    },
  },
  [EmailTemplateKey.AUTH_PASSWORD_RESET]: {
    key: EmailTemplateKey.AUTH_PASSWORD_RESET,
    label: 'Recuperar contrasena',
    description: 'Enlace temporal para restablecer la contrasena.',
    category: 'auth',
    defaultFile: 'auth.password-reset.hbs',
    defaultSubject: 'Recupera tu contrasena',
    variables: [
      { name: 'customerName', description: 'Nombre del usuario' },
      { name: 'resetUrl', description: 'URL firmada de reset' },
      { name: 'expiresIn', description: 'Duracion legible (ej. 1 hora)' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
      resetUrl: '{{appUrl}}/reset-password?token=abc',
      expiresIn: '1 hora',
    },
  },
  [EmailTemplateKey.AUTH_WELCOME]: {
    key: EmailTemplateKey.AUTH_WELCOME,
    label: 'Bienvenida',
    description: 'Se envia tras el registro exitoso.',
    category: 'auth',
    defaultFile: 'auth.welcome.hbs',
    defaultSubject: 'Bienvenido a {{appName}}',
    variables: [
      { name: 'customerName', description: 'Nombre del usuario' },
    ],
    sampleContext: {
      customerName: 'Maria Perez',
    },
  },
};

export function getTemplateDefinition(key: EmailTemplateKey): TemplateDefinition {
  const def = TEMPLATE_REGISTRY[key];
  if (!def) {
    throw new Error(`Unknown email template key: ${key}`);
  }
  return def;
}

export function listTemplateDefinitions(): TemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY);
}
