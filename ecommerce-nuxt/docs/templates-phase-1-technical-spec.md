# Fase 1 - Contrato tecnico y schema

## Estado
En progreso.

## Objetivo
Definir un contrato estable entre admin-panel, admin-api y ecommerce-nuxt para publicar y consumir estructuras de pagina por identificador.

## Principios
- Nuxt renderiza componentes locales (no HTML remoto arbitrario).
- Admin-panel gestiona configuracion en JSON por templateKey.
- admin-api valida y versiona antes de publicar.
- Version publicada es inmutable.

## Entidades principales

### Template
- id: string (uuid)
- templateKey: string (ej: home.main)
- channel: enum(web)
- pageType: enum(home|category)
- version: integer (1..n)
- status: enum(draft|published|deprecated)
- schemaVersion: string (ej: 1.0.0)
- content: object (TemplateDocument)
- createdBy: string
- updatedBy: string
- publishedBy: string | null
- createdAt: date-time
- updatedAt: date-time
- publishedAt: date-time | null

### TemplateDocument
- meta: object
- sections: array<TemplateSection>

### TemplateSection
- id: string
- componentKey: enum(hero|banner|product-grid|rich-text|cta)
- props: object
- dataSource: object | null
- visibilityRules: object | null
- order: integer

## Reglas de negocio
- Solo se permiten componentKey whitelisteados.
- Cada componentKey valida props estrictamente.
- Campos extra desconocidos se rechazan.
- order debe ser unico dentro del template.
- sections debe tener al menos 1 item y maximo 20 para MVP.
- templateKey + channel + version debe ser unico.
- Solo puede existir 1 version published activa por templateKey + channel.

## Versionado
- Draft editable sin restricciones de version final.
- Publish crea o confirma una version numerica inmutable.
- Cambios estructurales o de props generan nueva version.
- Rollback republica una version anterior como nueva version published.

## Seguridad
- body de rich-text debe pasar sanitizacion server-side.
- URLs deben validarse como http/https o rutas internas absolutas con slash inicial.
- No se permiten scripts, handlers inline ni iframes en contenido.

## Consumo en Nuxt
- Nuxt solicita por templateKey y channel.
- Nuxt recibe un documento publicado con schemaVersion compatible.
- Si falla API o validacion runtime, se usa fallback local.

## Compatibilidad
- schemaVersion usa semver.
- Cambio breaking incrementa major.
- Nuxt debe declarar versiones soportadas para evitar render inconsistente.

## Criterios de salida de Fase 1
- Schema JSON v1 publicado y revisado.
- Contrato de endpoints aprobado por backend/frontend.
- Matriz de props permitidas congelada para MVP.
