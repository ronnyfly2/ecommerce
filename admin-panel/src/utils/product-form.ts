import type { MeasurementUnit, Product, ProductFeature } from '@/types/api'

export function normalizeSku(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function normalizeOptionalNumber(value: number | string) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return numeric
}

export function mapAttributeValuesToForm(values: Product['attributeValues']) {
  return Object.fromEntries((values ?? []).map((attribute) => [attribute.key, attribute.value])) as Record<
    string,
    string | number | boolean
  >
}

export function mapFeaturesToForm(values: Product['features']) {
  if (!values?.length) {
    return [{ icon: '', name: '' }] as ProductFeature[]
  }

  return values.map((feature) => ({
    icon: feature.icon ?? '',
    name: feature.name ?? '',
  }))
}

export function toUnitOptions(units: MeasurementUnit[]) {
  return units.map((unit) => ({ value: unit.code, label: `${unit.label} (${unit.code})` }))
}

export function includeCurrentUnit(
  options: Array<{ value: string; label: string }>,
  currentValue: string,
  fallbackLabel: string,
) {
  const normalized = currentValue.trim().toLowerCase()
  if (!normalized) {
    return options
  }
  if (options.some((option) => option.value === normalized)) {
    return options
  }
  return [{ value: normalized, label: `${fallbackLabel} (${normalized})` }, ...options]
}