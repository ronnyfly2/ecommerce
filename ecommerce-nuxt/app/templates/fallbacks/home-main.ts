import type { TemplateDocument } from '~/types/template'

export const homeMainFallbackTemplate: TemplateDocument = {
  meta: {
    templateKey: 'home.main',
    channel: 'web',
    pageType: 'home',
    schemaVersion: '1.0.0'
  },
  sections: [
    {
      id: 'hero-main',
      componentKey: 'hero',
      order: 1,
      props: {
        title: 'Bienvenido a nuestra tienda',
        subtitle: 'Descubre ofertas destacadas y nuevos productos cada semana.',
        ctaLabel: 'Explorar catalogo',
        ctaHref: '/category/default'
      }
    },
    {
      id: 'banner-shipping',
      componentKey: 'banner',
      order: 2,
      props: {
        text: 'Envio gratis en compras superiores a $50',
        tone: 'success'
      }
    },
    {
      id: 'grid-featured',
      componentKey: 'product-grid',
      order: 3,
      props: {
        title: 'Productos destacados',
        source: 'featured',
        limit: 8
      }
    },
    {
      id: 'cta-home',
      componentKey: 'cta',
      order: 4,
      props: {
        title: 'Listo para comprar?',
        description: 'Revisa nuestras categorias y encuentra lo que necesitas.',
        buttonLabel: 'Ver categorias',
        buttonHref: '/category/default'
      }
    }
  ]
}
