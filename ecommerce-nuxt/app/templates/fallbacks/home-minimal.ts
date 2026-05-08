import type { TemplateDocument } from '~/types/template'

export const homeMinimalFallbackTemplate: TemplateDocument = {
  meta: {
    templateKey: 'home.minimal',
    channel: 'web',
    pageType: 'home',
    schemaVersion: '1.0.0'
  },
  sections: [
    {
      id: 'minimal-hero',
      componentKey: 'hero',
      order: 1,
      props: {
        autoPlay: true,
        autoPlayIntervalMs: 5200,
        showArrows: true,
        showDots: true,
        slides: [
          {
            title: 'Minimal Storefront',
            subtitle: 'Colecciones curadas, ofertas y novedades en un solo lugar.',
            ctaLabel: 'Comprar ahora',
            ctaHref: '/search',
            imageUrl: 'https://picsum.photos/seed/minimal-hero-1/1200/700',
            imageLayout: 'background',
            imageWidth: 'half',
            overlayColor: 'rgba(15,23,42,0.35)',
            titleColor: '#ffffff',
            titleBackgroundColor: 'rgba(15,23,42,0.55)',
            titleBackgroundSize: 'wide',
            subtitleColor: '#e2e8f0',
            subtitleBackgroundColor: 'rgba(15,23,42,0.4)',
            subtitleBackgroundSize: 'fit',
            buttonBackgroundColor: '#ffffff',
            buttonTextColor: '#0f172a',
            buttonSize: 'lg'
          },
          {
            title: 'Lanzamientos De Temporada',
            subtitle: 'Productos nuevos con despacho rapido y promos activas.',
            ctaLabel: 'Ver novedades',
            ctaHref: '/search?q=nuevo',
            imageUrl: 'https://picsum.photos/seed/minimal-hero-2/1000/700',
            imageLayout: 'side-right',
            imageWidth: 'half',
            titleBackgroundColor: 'rgba(255,255,255,0.92)',
            titleBackgroundSize: 'fit',
            subtitleBackgroundColor: 'rgba(255,255,255,0.78)',
            subtitleBackgroundSize: 'wide',
            buttonSize: 'md'
          },
          {
            title: 'Selecciones Premium',
            subtitle: 'Looks listos para elevar tu catalogo esta semana.',
            ctaLabel: 'Explorar premium',
            ctaHref: '/search?q=premium',
            imageUrl: 'https://picsum.photos/seed/minimal-hero-3/900/700',
            imageLayout: 'side-left',
            imageWidth: 'quarter',
            titleBackgroundColor: 'rgba(255,255,255,0.94)',
            titleBackgroundSize: 'full',
            subtitleBackgroundColor: 'rgba(255,255,255,0.82)',
            subtitleBackgroundSize: 'fit',
            buttonSize: 'sm'
          }
        ],
        backgroundColor: '#f8fafc',
        titleColor: '#0f172a',
        subtitleColor: '#475569',
        buttonBackgroundColor: '#0f172a',
        buttonTextColor: '#ffffff'
      }
    },
    {
      id: 'minimal-categories',
      componentKey: 'category-strip',
      order: 2,
      props: {
        title: 'Categorias destacadas',
        categories: [
          { label: 'Woman', slug: 'woman', imageUrl: 'https://picsum.photos/seed/woman-cat/200/200' },
          { label: 'Man', slug: 'man', imageUrl: 'https://picsum.photos/seed/man-cat/200/200' },
          { label: 'Kids', slug: 'kids', imageUrl: 'https://picsum.photos/seed/kids-cat/200/200' },
          { label: 'Sneakers', slug: 'sneakers', imageUrl: 'https://picsum.photos/seed/sneakers-cat/200/200' },
          { label: 'Bags', slug: 'bags', imageUrl: 'https://picsum.photos/seed/bags-cat/200/200' }
        ],
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        itemBackgroundColor: '#f3f4f6',
        itemTextColor: '#374151',
        itemBorderColor: '#e5e7eb'
      }
    },
    {
      id: 'minimal-top-products',
      componentKey: 'product-grid',
      order: 3,
      props: {
        title: 'Top Products',
        source: 'featured',
        limit: 8,
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        priceColor: '#dc2626',
        placeholderImageBaseUrl: 'https://picsum.photos/seed'
      }
    },
    {
      id: 'minimal-promo-banners',
      componentKey: 'promo-banners',
      order: 4,
      props: {
        columns: 2,
        backgroundColor: '#ffffff',
        overlayColor: 'rgba(0,0,0,0.45)',
        banners: [
          {
            imageUrl: 'https://picsum.photos/seed/minimal-banner-1/1200/800',
            subtitle: 'Nueva temporada',
            title: 'Coleccion Primavera',
            href: '/search?q=primavera',
            textPosition: 'bottom-left'
          },
          {
            imageUrl: 'https://picsum.photos/seed/minimal-banner-2/1200/800',
            subtitle: 'Oferta limitada',
            title: 'Hasta 40% OFF',
            href: '/search?q=sale',
            textPosition: 'bottom-right'
          }
        ]
      }
    },
    {
      id: 'minimal-flash-sale',
      componentKey: 'flash-sale',
      order: 5,
      props: {
        title: 'Flash Sale',
        source: 'featured',
        limit: 6,
        endTime: '2030-01-01T00:00:00.000Z',
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        timerBackgroundColor: '#111827',
        timerTextColor: '#ffffff',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        priceColor: '#ef4444',
        progressColor: '#fb7185',
        placeholderImageBaseUrl: 'https://picsum.photos/seed'
      }
    },
    {
      id: 'minimal-brands',
      componentKey: 'brand-carousel',
      order: 6,
      props: {
        title: 'Top Brands',
        brands: [
          { name: 'Shovia', slug: 'shovia', logoUrl: 'https://picsum.photos/seed/logo-shovia/220/100' },
          { name: 'Fusion', slug: 'fusion', logoUrl: 'https://picsum.photos/seed/logo-fusion/220/100' },
          { name: 'Hunter Shoes', slug: 'hunter-shoes', logoUrl: 'https://picsum.photos/seed/logo-hunter/220/100' },
          { name: 'Blaze Fashion', slug: 'blaze-fashion', logoUrl: 'https://picsum.photos/seed/logo-blaze/220/100' }
        ],
        backgroundColor: '#f9fafb',
        titleColor: '#111827',
        cardBackgroundColor: '#ffffff',
        cardBorderColor: '#e5e7eb'
      }
    },
    {
      id: 'minimal-trust',
      componentKey: 'trust-badges',
      order: 7,
      props: {
        badges: [
          { icon: '💰', title: 'Guaranteed Savings', description: 'Precios competitivos durante todo el mes.' },
          { icon: '🛡️', title: 'Try it risk-free', description: 'Politicas claras de devolucion y cambios.' },
          { icon: '🚚', title: 'Super Fast Delivery', description: 'Envios rapidos en zonas habilitadas.' },
          { icon: '🏷️', title: '1000+ products priced at cost', description: 'Gran variedad con ofertas permanentes.' }
        ],
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        textColor: '#6b7280'
      }
    }
  ]
}
