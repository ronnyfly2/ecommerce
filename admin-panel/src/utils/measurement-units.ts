import type { CategoryAttributeDefinition } from '@/types/api'

export type MeasurementUnitPreset = {
  value: string
  label: string
  family: 'weight' | 'length' | 'volume' | 'area' | 'count' | 'temperature' | 'time'
}

export const MEASUREMENT_UNIT_PRESETS: MeasurementUnitPreset[] = [
  { value: 'mcg', label: 'Microgramos', family: 'weight' },
  { value: 'mg', label: 'Miligramos', family: 'weight' },
  { value: 'g', label: 'Gramos', family: 'weight' },
  { value: 'kg', label: 'Kilogramos', family: 'weight' },
  { value: 'lb', label: 'Libras', family: 'weight' },
  { value: 'oz', label: 'Onzas', family: 'weight' },
  { value: 'st', label: 'Stone', family: 'weight' },
  { value: 't', label: 'Toneladas', family: 'weight' },
  { value: 'mm', label: 'Milimetros', family: 'length' },
  { value: 'cm', label: 'Centimetros', family: 'length' },
  { value: 'm', label: 'Metros', family: 'length' },
  { value: 'km', label: 'Kilometros', family: 'length' },
  { value: 'in', label: 'Pulgadas', family: 'length' },
  { value: 'ft', label: 'Pies', family: 'length' },
  { value: 'yd', label: 'Yardas', family: 'length' },
  { value: 'mi', label: 'Millas', family: 'length' },
  { value: 'ml', label: 'Mililitros', family: 'volume' },
  { value: 'l', label: 'Litros', family: 'volume' },
  { value: 'm3', label: 'Metros cubicos', family: 'volume' },
  { value: 'fl oz', label: 'Onzas fluidas', family: 'volume' },
  { value: 'cc', label: 'Centimetros cubicos', family: 'volume' },
  { value: 'gal', label: 'Galones', family: 'volume' },
  { value: 'qt', label: 'Cuartos', family: 'volume' },
  { value: 'pt', label: 'Pintas', family: 'volume' },
  { value: 'cm2', label: 'Centimetros cuadrados', family: 'area' },
  { value: 'm2', label: 'Metros cuadrados', family: 'area' },
  { value: 'ha', label: 'Hectareas', family: 'area' },
  { value: 'u', label: 'Unidades', family: 'count' },
  { value: 'pack', label: 'Packs', family: 'count' },
  { value: 'par', label: 'Pares', family: 'count' },
  { value: 'c', label: 'Celsius', family: 'temperature' },
  { value: 'f', label: 'Fahrenheit', family: 'temperature' },
  { value: 'min', label: 'Minutos', family: 'time' },
  { value: 'h', label: 'Horas', family: 'time' },
  { value: 'd', label: 'Dias', family: 'time' },
]

export function inferMeasurementUnitFamily(
  definition: Pick<CategoryAttributeDefinition, 'type' | 'key' | 'label' | 'unit'>,
) {
  if (definition.type !== 'number') {
    return null
  }

  const haystack = `${definition.key} ${definition.label} ${definition.unit ?? ''}`.toLowerCase()

  if (/(peso|weight|masa)/.test(haystack)) {
    return 'weight'
  }

  if (/(largo|ancho|alto|diam|length|width|height|profundidad|size)/.test(haystack)) {
    return 'length'
  }

  if (/(capacidad|volume|volumen|litro|ml)/.test(haystack)) {
    return 'volume'
  }

  if (/(area|superficie|m2|cm2|hect)/.test(haystack)) {
    return 'area'
  }

  if (/(temperatura|temp)/.test(haystack)) {
    return 'temperature'
  }

  if (/(tiempo|duracion|hours|hora|minuto|dia)/.test(haystack)) {
    return 'time'
  }

  if (/(cantidad|unidades|pack|par|qty)/.test(haystack)) {
    return 'count'
  }

  return null
}

export function suggestMeasurementUnits(definition: Pick<CategoryAttributeDefinition, 'type' | 'key' | 'label' | 'unit'>) {
  if (definition.type !== 'number') {
    return []
  }

  const family = inferMeasurementUnitFamily(definition)

  if (family) {
    return MEASUREMENT_UNIT_PRESETS.filter((item) => item.family === family)
  }

  return MEASUREMENT_UNIT_PRESETS
}