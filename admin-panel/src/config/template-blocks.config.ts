/**
 * Configuración de bloques disponibles para clientes no-técnicos
 * Describe cada tipo de bloque, sus propósitos y propiedades editables
 */

export interface BlockFieldConfig {
  key: string
  label: string
  description?: string
  type: 'text' | 'number' | 'textarea' | 'select' | 'array' | 'object' | 'color'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  helpText?: string
}

export interface BlockTypeConfig {
  id: string
  label: string
  category: 'showcase' | 'promotion' | 'navigation' | 'engagement' | 'trust'
  icon: string
  description: string
  defaultOrder?: number
  fields: BlockFieldConfig[]
}

export const BLOCK_TYPES_CONFIG: Record<string, BlockTypeConfig> = {
  hero: {
    id: 'hero',
    label: 'Banner principal',
    category: 'showcase',
    icon: '🎯',
    description: 'Slider principal con uno o más banners. Soporta imagen de fondo o imagen lateral 1/4 y 1/2.',
    defaultOrder: 1,
    fields: [
      {
        key: 'slides',
        label: 'Slides del banner',
        description: 'Lista de banners del slider',
        type: 'array',
        required: true,
        helpText: 'Agrega 2 o más slides para rotación automática. Cada slide incluye texto, botón e imagen.',
      },
      {
        key: 'autoPlayIntervalMs',
        label: 'Tiempo por slide (ms)',
        description: 'Duración antes de pasar al siguiente slide',
        type: 'number',
        placeholder: '5000',
        helpText: 'Recomendado entre 4000 y 7000 ms.',
      },
      {
        key: 'showArrows',
        label: 'Mostrar flechas',
        description: 'Controles laterales de navegación',
        type: 'select',
        options: [
          { value: 'true', label: 'Sí' },
          { value: 'false', label: 'No' },
        ],
        helpText: 'Puedes ocultarlas en mobile si prefieres una vista limpia.',
      },
      {
        key: 'showDots',
        label: 'Mostrar indicadores',
        description: 'Puntos para indicar posición del slide',
        type: 'select',
        options: [
          { value: 'true', label: 'Sí' },
          { value: 'false', label: 'No' },
        ],
        helpText: 'Ayuda a que el cliente sepa cuántos banners hay.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#f8fafc',
      },
      {
        key: 'titleColor',
        label: 'Color del título',
        type: 'color',
        placeholder: '#0f172a',
      },
      {
        key: 'subtitleColor',
        label: 'Color del subtítulo',
        type: 'color',
        placeholder: '#475569',
      },
      {
        key: 'buttonBackgroundColor',
        label: 'Color del botón',
        type: 'color',
        placeholder: '#0f172a',
      },
      {
        key: 'buttonTextColor',
        label: 'Color del texto del botón',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'cardBorderRadius',
        label: 'Radio del borde de la tarjeta',
        type: 'select',
        options: [
          { value: 'none', label: 'Sin borde redondeado' },
          { value: 'sm', label: 'Pequeño' },
          { value: 'md', label: 'Mediano' },
          { value: 'lg', label: 'Grande' },
          { value: 'xl', label: 'Extra grande' },
          { value: '2xl', label: 'XX grande (por defecto)' },
          { value: '3xl', label: 'XXX grande' },
          { value: 'full', label: 'Pill completo' },
        ],
        helpText: 'Controla el redondeo de las esquinas de la tarjeta hero.',
      },
      {
        key: 'cardBorderVisible',
        label: 'Mostrar borde de la tarjeta',
        type: 'select',
        options: [
          { value: 'true', label: 'Sí' },
          { value: 'false', label: 'No' },
        ],
        helpText: 'Muestra u oculta el borde alrededor de la tarjeta.',
      },
      {
        key: 'cardBorderColor',
        label: 'Color del borde de la tarjeta',
        type: 'color',
        placeholder: '#f1f5f9',
        helpText: 'Solo se aplica si el borde está visible.',
      },
      {
        key: 'cardBackgroundColor',
        label: 'Color de fondo de la tarjeta',
        type: 'color',
        placeholder: '#ffffff',
        helpText: 'Color de fondo de la tarjeta hero.',
      },
    ],
  },

  'category-strip': {
    id: 'category-strip',
    label: 'Categorías destacadas',
    category: 'navigation',
    icon: '📂',
    description: 'Muestra 5-6 categorías con ícono. Perfecto para que los clientes naveguen fácil.',
    defaultOrder: 2,
    fields: [
      {
        key: 'title',
        label: 'Título del bloque',
        description: 'Título visible sobre las categorías',
        type: 'text',
        placeholder: 'Ej: Compra por categoría',
        helpText: 'Deja vacío si prefieres no mostrar un título.',
      },
      {
        key: 'categories',
        label: 'Categorías',
        description: 'Lista de categorías con ícono y slug',
        type: 'array',
        helpText: 'Agrega hasta 6 categorías. Cada una tiene ícono, nombre y enlace.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'titleColor',
        label: 'Color del título',
        type: 'color',
        placeholder: '#111827',
      },
      {
        key: 'itemBackgroundColor',
        label: 'Color de fondo del item',
        type: 'color',
        placeholder: '#f3f4f6',
      },
      {
        key: 'itemTextColor',
        label: 'Color del texto del item',
        type: 'color',
        placeholder: '#374151',
      },
      {
        key: 'itemBorderColor',
        label: 'Color del borde del item',
        type: 'color',
        placeholder: '#e5e7eb',
      },
    ],
  },

  'product-grid': {
    id: 'product-grid',
    label: 'Grilla de productos',
    category: 'showcase',
    icon: '📦',
    description: 'Muestra productos en grilla (4-8 columnas). Ideal para destacar lo más vendido.',
    defaultOrder: 3,
    fields: [
      {
        key: 'title',
        label: 'Título del bloque',
        description: 'Qué tipo de productos se muestran aquí',
        type: 'text',
        placeholder: 'Ej: Productos destacados, Novedades',
        required: true,
      },
      {
        key: 'source',
        label: 'Tipo de productos',
        description: 'De dónde obtener los productos',
        type: 'select',
        required: true,
        options: [
          { value: 'featured', label: 'Destacados (manuales)' },
          { value: 'new_arrivals', label: 'Recién llegados' },
          { value: 'by_category', label: 'Por categoría específica' },
        ],
        helpText: 'Destac. = tú eliges; Recién llega = automático últimos; Por cat = de una sola categoría.',
      },
      {
        key: 'categorySlug',
        label: 'Categoría (si aplica)',
        description: 'Código de la categoría',
        type: 'text',
        placeholder: 'Ej: women, accessories',
        helpText: 'Solo si seleccionaste "Por categoría específica".',
      },
      {
        key: 'limit',
        label: 'Cantidad de productos',
        description: 'Cuántos productos mostrar',
        type: 'number',
        placeholder: '8',
        helpText: 'Recomendado: 8-12 productos.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'titleColor',
        label: 'Color del título',
        type: 'color',
        placeholder: '#111827',
      },
      {
        key: 'cardBackgroundColor',
        label: 'Color de fondo de la tarjeta',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'cardBorderColor',
        label: 'Color del borde de la tarjeta',
        type: 'color',
        placeholder: '#e5e7eb',
      },
      {
        key: 'priceColor',
        label: 'Color del precio',
        type: 'color',
        placeholder: '#dc2626',
      },
      {
        key: 'placeholderImageBaseUrl',
        label: 'URL base de imagen placeholder',
        type: 'text',
        placeholder: 'https://picsum.photos/seed',
      },
    ],
  },

  'flash-sale': {
    id: 'flash-sale',
    label: 'Venta rápida',
    category: 'promotion',
    icon: '⚡',
    description: 'Destaca una oferta con temporizador. Crea urgencia y aumenta conversiones.',
    defaultOrder: 4,
    fields: [
      {
        key: 'title',
        label: 'Nombre de la promoción',
        description: 'Cómo se llama esta venta',
        type: 'text',
        placeholder: 'Ej: Flash Sale, Cyber Monday',
        required: true,
      },
      {
        key: 'source',
        label: 'Productos de',
        description: 'Qué productos incluye esta venta',
        type: 'select',
        required: true,
        options: [
          { value: 'featured', label: 'Seleccionados manualmente' },
          { value: 'new_arrivals', label: 'Recién llegados' },
          { value: 'by_category', label: 'De una categoría' },
        ],
      },
      {
        key: 'limit',
        label: 'Productos a mostrar',
        description: 'Cuántos productos en la venta',
        type: 'number',
        placeholder: '6',
        helpText: 'Mostrar menos productos crea más urgencia.',
      },
      {
        key: 'endTime',
        label: 'Fecha/hora de fin',
        description: 'Cuándo termina la promoción',
        type: 'text',
        placeholder: '2026-12-31T23:59:59Z',
        helpText: 'Formato: YYYY-MM-DDTHH:MM:SSZ. El temporizador cuenta hacia atrás.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'titleColor',
        label: 'Color del título',
        type: 'color',
        placeholder: '#111827',
      },
      {
        key: 'timerBackgroundColor',
        label: 'Color del fondo del timer',
        type: 'color',
        placeholder: '#111827',
      },
      {
        key: 'timerTextColor',
        label: 'Color del texto del timer',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'cardBackgroundColor',
        label: 'Color de fondo de la tarjeta',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'cardBorderColor',
        label: 'Color del borde de la tarjeta',
        type: 'color',
        placeholder: '#e5e7eb',
      },
      {
        key: 'priceColor',
        label: 'Color del precio',
        type: 'color',
        placeholder: '#ef4444',
      },
      {
        key: 'progressColor',
        label: 'Color de la barra de progreso',
        type: 'color',
        placeholder: '#f87171',
      },
      {
        key: 'placeholderImageBaseUrl',
        label: 'URL base de imagen placeholder',
        type: 'text',
        placeholder: 'https://picsum.photos/seed',
      },
    ],
  },

  'brand-carousel': {
    id: 'brand-carousel',
    label: 'Marcas destacadas',
    category: 'trust',
    icon: '🏷️',
    description: 'Logos de marcas conocidas. Genera confianza mostrando tus proveedores o asociados.',
    defaultOrder: 5,
    fields: [
      {
        key: 'title',
        label: 'Título del bloque',
        description: 'Texto arriba de los logos',
        type: 'text',
        placeholder: 'Ej: Marcas que confían en nosotros',
        helpText: 'Deja vacío si no quieres título.',
      },
      {
        key: 'brands',
        label: 'Marcas',
        description: 'Lista de marcas con logo y enlace',
        type: 'array',
        helpText: 'Agrega 4-8 marcas. Los logos aparecen en escala de grises hasta hover.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#f9fafb',
      },
      {
        key: 'titleColor',
        label: 'Color del título',
        type: 'color',
        placeholder: '#111827',
      },
      {
        key: 'cardBackgroundColor',
        label: 'Color de fondo de la tarjeta',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'cardBorderColor',
        label: 'Color del borde de la tarjeta',
        type: 'color',
        placeholder: '#e5e7eb',
      },
    ],
  },

  'trust-badges': {
    id: 'trust-badges',
    label: 'Garantías y promesas',
    category: 'trust',
    icon: '✅',
    description: 'Muestra lo que garantizas (envío, devoluciones, etc). Reduce desconfianza en compra.',
    defaultOrder: 6,
    fields: [
      {
        key: 'badges',
        label: 'Promesas / Garantías',
        description: 'Lista de garantías que ofreces',
        type: 'array',
        helpText: 'Máximo 4 garantías. Cada una con ícono, título y explicación corta.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'titleColor',
        label: 'Color del título',
        type: 'color',
        placeholder: '#111827',
      },
      {
        key: 'textColor',
        label: 'Color del texto',
        type: 'color',
        placeholder: '#6b7280',
      },
    ],
  },

  'promo-banners': {
    id: 'promo-banners',
    label: 'Banners promocionales',
    category: 'promotion',
    icon: '🎨',
    description: '2-3 banners grandes con imagen y texto. Ideal para colecciones o campañas.',
    defaultOrder: 7,
    fields: [
      {
        key: 'banners',
        label: 'Banners',
        description: 'Lista de banners con imagen y enlace',
        type: 'array',
        helpText: 'Crea 2-3 banners grandes. Cada uno con imagen, título y destino.',
      },
      {
        key: 'columns',
        label: 'Columnas',
        description: 'Cuántos banners por fila',
        type: 'select',
        options: [
          { value: '2', label: '2 banners por fila' },
          { value: '3', label: '3 banners por fila' },
        ],
        helpText: '2 = banners grandes; 3 = más banners en pantalla.',
      },
      {
        key: 'backgroundColor',
        label: 'Color de fondo',
        type: 'color',
        placeholder: '#ffffff',
      },
      {
        key: 'overlayColor',
        label: 'Color de capa sobre imagen',
        type: 'color',
        placeholder: '#000000',
      },
    ],
  },

  'rich-text': {
    id: 'rich-text',
    label: 'Texto/HTML',
    category: 'engagement',
    icon: '📝',
    description: 'Bloque flexible para texto, HTML personalizado, políticas, etc.',
    fields: [
      {
        key: 'title',
        label: 'Título (opcional)',
        type: 'text',
        placeholder: 'Ej: Acerca de nosotros',
      },
      {
        key: 'body',
        label: 'Contenido',
        description: 'Texto o HTML',
        type: 'textarea',
        placeholder: 'Escribe aquí o pega HTML personalizado...',
        required: true,
      },
    ],
  },

  cta: {
    id: 'cta',
    label: 'Llamado a la acción',
    category: 'engagement',
    icon: '📢',
    description: 'Bloque con mensaje grande y botón. Perfecto al final para conversión.',
    fields: [
      {
        key: 'title',
        label: 'Título',
        type: 'text',
        placeholder: 'Ej: ¿Listo para comprar?',
        required: true,
      },
      {
        key: 'description',
        label: 'Descripción',
        type: 'text',
        placeholder: 'Texto motivador pequeño...',
      },
      {
        key: 'buttonLabel',
        label: 'Texto del botón',
        type: 'text',
        placeholder: 'Ej: Ir a productos',
        required: true,
      },
      {
        key: 'buttonHref',
        label: 'Destino',
        type: 'text',
        placeholder: 'Ej: /search',
        required: true,
      },
    ],
  },
}

export const BLOCK_CATEGORIES = [
  { id: 'showcase', label: 'Vitrina', icon: '🏪' },
  { id: 'promotion', label: 'Promociones', icon: '🎁' },
  { id: 'navigation', label: 'Navegación', icon: '🧭' },
  { id: 'engagement', label: 'Engagement', icon: '💬' },
  { id: 'trust', label: 'Confianza', icon: '🤝' },
]

export function getBlockConfig(componentKey: string): BlockTypeConfig | undefined {
  return BLOCK_TYPES_CONFIG[componentKey as keyof typeof BLOCK_TYPES_CONFIG]
}

export function getBlockLabel(componentKey: string): string {
  return getBlockConfig(componentKey)?.label ?? componentKey
}
