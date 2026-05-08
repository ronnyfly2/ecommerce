# Registro Inicial de Template IDs

## Convencion
Formato: `<pagina>.<variante>.v<version>`

## IDs reservados (inicio)
- home.main.v1
- home.campaign.v1
- category.default.v1

## Reglas de versionado
- Una version publicada es inmutable.
- Cambios de estructura o props crean nueva version: v2, v3, etc.
- Drafts pueden editarse libremente hasta publicar.

## Reglas de nombrado
- `pagina`: home, category, product, cart, checkout
- `variante`: main, campaign, default, seasonal, etc
- `version`: entero incremental sin huecos por cada template base

## Politica de deprecacion
- Mantener al menos una version publicada estable por template.
- Marcar como deprecated antes de archivar.
