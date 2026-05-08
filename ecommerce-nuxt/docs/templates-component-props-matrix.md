# Matriz de Props Permitidas (MVP)

## Objetivo
Definir el contrato funcional de props por componentKey para validacion backend y tipado frontend.

## Matriz

| componentKey | Prop | Tipo | Requerido | Regla |
|---|---|---|---|---|
| hero | title | string | si | 1..120 |
| hero | subtitle | string | no | <= 240 |
| hero | imageUrl | string | no | URL http/https o ruta interna |
| hero | ctaLabel | string | no | <= 40 |
| hero | ctaHref | string | no | URL http/https o ruta interna |
| banner | text | string | si | 1..160 |
| banner | tone | enum | no | info/success/warning/danger |
| banner | dismissible | boolean | no | true/false |
| product-grid | title | string | no | <= 120 |
| product-grid | source | enum | si | featured/new_arrivals/by_category |
| product-grid | categorySlug | string | condicional | requerido cuando source=by_category |
| product-grid | limit | number | no | 1..24 |
| rich-text | title | string | no | <= 120 |
| rich-text | body | string | si | 1..5000, sanitizado |
| cta | title | string | si | 1..120 |
| cta | description | string | no | <= 240 |
| cta | buttonLabel | string | si | 1..40 |
| cta | buttonHref | string | si | URL http/https o ruta interna |

## Reglas transversales
- Campos extra no definidos deben rechazarse.
- Strings deben normalizarse trim en backend antes de validar.
- rich-text.body debe sanitizarse antes de persistir/publicar.
- URLs invalidas bloquean publish.
