# Backlog de Ejecucion - Templates Hibridos

## Prioridad P0
- Definir y aprobar schema v1 y API contract
- Crear modulo templates en admin-api
- Implementar GET publico por templateKey
- Implementar publish con reglas de version
- Implementar renderer base en Nuxt con registry
- Integrar home con templateKey fijo y fallback

## Prioridad P1
- Integrar category con templateKey fijo
- Implementar editor de templates en admin-panel
- Implementar preview y validacion en formulario
- Implementar historial y rollback en admin-panel
- Agregar pruebas e2e de flujo principal

## Prioridad P2
- Instrumentar metricas y alertas
- Activar feature flags por pagina
- Rollout gradual en produccion
- Mejoras UX del editor

## Tickets sugeridos por equipo

### Backend (admin-api)
- BE-TPL-01 Entity + migration templates
- BE-TPL-02 DTOs y validador schema v1
- BE-TPL-03 GET template publicado
- BE-TPL-04 Publish y unicidad de published
- BE-TPL-05 Rollback como nueva version
- BE-TPL-06 Tests unitarios/e2e

### Frontend ecommerce (Nuxt)
- FE-NUXT-TPL-01 Tipos TemplateDocument
- FE-NUXT-TPL-02 Servicio de lectura API
- FE-NUXT-TPL-03 Registry + TemplateRenderer
- FE-NUXT-TPL-04 Integracion home + fallback
- FE-NUXT-TPL-05 Integracion category + fallback
- FE-NUXT-TPL-06 Tests unitarios renderer

### Frontend admin-panel
- FE-ADMIN-TPL-01 Vistas listado/editor/historial
- FE-ADMIN-TPL-02 Store + servicio templates API
- FE-ADMIN-TPL-03 Formularios por bloque
- FE-ADMIN-TPL-04 Preview + validacion previa
- FE-ADMIN-TPL-05 Publish/deprecate/rollback UI
- FE-ADMIN-TPL-06 E2E flujo de publicacion

## Dependencias clave
- BE-TPL-03 depende de BE-TPL-01 y BE-TPL-02
- FE-NUXT-TPL-02 depende de BE-TPL-03
- FE-ADMIN-TPL-02 depende de endpoints admin listos

## Criterio de finalizacion de iniciativa
- Home y category operando con templates publicados
- Fallback y rollback verificados
- Monitoreo activo en produccion
