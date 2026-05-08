import type { TemplateDocument } from '~/types/template'

export const categoryDefaultFallbackTemplate: TemplateDocument = {
  meta: {
    templateKey: 'category.default',
    channel: 'web',
    pageType: 'category',
    schemaVersion: '1.0.0'
  },
  sections: [
    {
      id: 'category-hero',
      componentKey: 'hero',
      order: 1,
      props: {
        title: 'Categoria',
        subtitle: 'Explora productos segun tus preferencias.'
      }
    },
    {
      id: 'category-grid',
      componentKey: 'product-grid',
      order: 2,
      props: {
        title: 'Resultados de categoria',
        source: 'by_category',
        categorySlug: 'default',
        limit: 12
      }
    }
  ]
}
