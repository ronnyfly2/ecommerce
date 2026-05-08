# Catalogo MVP de Bloques

## Objetivo
Definir un set acotado de bloques para el MVP con props controladas.

## Bloques habilitados (MVP)

### 1) hero
Uso: seccion principal de entrada.
Props permitidas:
- title: string (requerido)
- subtitle: string (opcional)
- imageUrl: string (opcional)
- ctaLabel: string (opcional)
- ctaHref: string (opcional)

### 2) banner
Uso: comunicacion promocional o informativa.
Props permitidas:
- text: string (requerido)
- tone: enum(info|success|warning|danger)
- dismissible: boolean

### 3) product-grid
Uso: grilla de productos.
Props permitidas:
- title: string (opcional)
- source: enum(featured|new_arrivals|by_category)
- categorySlug: string (requerido cuando source=by_category)
- limit: number (1..24)

### 4) rich-text
Uso: contenido editorial breve.
Props permitidas:
- title: string (opcional)
- body: string (requerido, sanitizado)

### 5) cta
Uso: cierre con llamada a la accion.
Props permitidas:
- title: string (requerido)
- description: string (opcional)
- buttonLabel: string (requerido)
- buttonHref: string (requerido)

## Reglas generales
- No se permite HTML arbitrario fuera de campos explicitamente sanitizados.
- Todas las props se validan en backend antes de publicar.
- Campos desconocidos deben rechazarse.

## No incluido en MVP
- Reglas avanzadas de segmentacion
- A/B testing
- Bloques anidados
- Condicionales complejos
