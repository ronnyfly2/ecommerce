import type { TemplateDocument } from '~/types/template'

const SUPPORTED_SCHEMA_VERSIONS = new Set(['1.0.0'])
const COMPONENT_KEYS = new Set([
  'hero',
  'banner',
  'product-grid',
  'rich-text',
  'cta',
  'category-strip',
  'flash-sale',
  'brand-carousel',
  'trust-badges',
  'promo-banners'
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isSchemaVersionSupported(version: string): boolean {
  return SUPPORTED_SCHEMA_VERSIONS.has(version)
}

export function validateTemplateDocument(input: unknown): input is TemplateDocument {
  if (!isObject(input) || !isObject(input.meta) || !Array.isArray(input.sections)) {
    return false
  }

  const { meta, sections } = input
  if (
    typeof meta.templateKey !== 'string' ||
    typeof meta.channel !== 'string' ||
    typeof meta.pageType !== 'string' ||
    typeof meta.schemaVersion !== 'string'
  ) {
    return false
  }

  if (!isSchemaVersionSupported(meta.schemaVersion) || sections.length < 1 || sections.length > 20) {
    return false
  }

  const seenOrder = new Set<number>()

  for (const section of sections) {
    if (!isObject(section)) {
      return false
    }

    if (
      typeof section.id !== 'string' ||
      typeof section.componentKey !== 'string' ||
      typeof section.order !== 'number' ||
      !Number.isInteger(section.order)
    ) {
      return false
    }

    if (!COMPONENT_KEYS.has(section.componentKey)) {
      return false
    }

    if (seenOrder.has(section.order)) {
      return false
    }
    seenOrder.add(section.order)

    if (!isObject(section.props)) {
      return false
    }
  }

  return true
}
