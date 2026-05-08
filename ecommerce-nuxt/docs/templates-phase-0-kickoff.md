# Fase 0 - Kickoff (Nuxt + Admin Templates)

## Estado
En progreso.

## Objetivo de Fase 0
Alinear negocio y tecnologia para arrancar el MVP de templates sin sobreingenieria.

## Alcance MVP propuesto
- Paginas: home, category
- Bloques habilitados: hero, banner, product-grid, rich-text, cta
- Canal: web

## Roles y flujo propuesto
- Editor: crea/edita drafts en admin-panel
- Revisor: valida consistencia de contenido/estructura
- Publicador: publica version

Flujo:
1. Draft
2. Review
3. Published

## Convencion de identificadores
Formato sugerido:
`<pagina>.<variante>.v<version>`

Ejemplos:
- `home.main.v1`
- `home.campaign.v1`
- `category.default.v1`

Reglas:
- `pagina`: dominio funcional (home, category, product, etc)
- `variante`: contexto o uso (main, campaign, default)
- `version`: entero incremental inmutable al publicar

## Definiciones para cerrar en esta fase
- Catalogo final de bloques MVP (maximo 8)
- Matriz de props permitidas por bloque
- Criterios de aprobacion para publish
- Responsables por rol

## Checklist Fase 0
- [ ] Validar alcance MVP (paginas y bloques)
- [ ] Confirmar roles editor/revisor/publicador
- [ ] Acordar nomenclatura definitiva de IDs
- [ ] Aprobar estados del flujo (draft/review/published)
- [ ] Congelar decision para iniciar Fase 1

## Riesgos tempranos
- Exceso de bloques en MVP (incrementa complejidad)
- Props no tipadas desde el inicio
- Publicacion sin validacion previa

## Decision recomendada para pasar a Fase 1
Aprobar este documento con maximo 5-8 bloques y 2 paginas iniciales.
