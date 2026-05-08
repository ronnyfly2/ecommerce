# Fase 2 - Backend (admin-api)

## Objetivo
Implementar el modulo de templates en admin-api con validacion, versionado y publicacion.

## Duracion estimada
1 semana.

## Alcance
- CRUD de drafts
- Publish de version
- Lectura publica por templateKey
- Rollback como nueva version
- Deprecation de version

## Estructura sugerida en admin-api
- src/templates/templates.module.ts
- src/templates/templates.controller.ts
- src/templates/templates.admin.controller.ts
- src/templates/templates.service.ts
- src/templates/templates.repository.ts
- src/templates/dto/
- src/templates/entities/
- src/templates/validators/

## Modelo de datos sugerido
### Tabla templates
- id uuid pk
- template_key varchar(120)
- channel varchar(20)
- page_type varchar(40)
- version int
- status varchar(20)
- schema_version varchar(20)
- content jsonb
- publish_note text nullable
- created_by varchar(120)
- updated_by varchar(120)
- published_by varchar(120) nullable
- created_at timestamptz
- updated_at timestamptz
- published_at timestamptz nullable

### Indices y constraints
- unique(template_key, channel, version)
- partial unique(template_key, channel) where status='published'
- index(template_key, channel, status)

## Endpoints a implementar
### Publico
- GET /api/templates/:templateKey?channel=web&version=

### Admin
- POST /api/admin/templates
- PUT /api/admin/templates/:id
- POST /api/admin/templates/:id/publish
- POST /api/admin/templates/:id/deprecate
- POST /api/admin/templates/:id/rollback

## Validacion y seguridad
- Validar content contra templates-schema-v1.json
- Rechazar additionalProperties
- Sanitizar rich-text.body antes de persistir/publicar
- Validar UrlOrPath segun contrato

## Secuencia de implementacion
1. Crear entity + migration + indices
2. Implementar dto de create/update/publish/rollback
3. Implementar validador de schema
4. Implementar service con reglas de versionado
5. Exponer controller publico
6. Exponer controller admin con roles
7. Agregar pruebas unitarias
8. Agregar pruebas e2e base

## Definicion de listo
- Endpoints responden en formato estandar de API
- Reglas de version y publish enforceadas
- Pruebas cubren casos happy-path y errores criticos

## Casos de prueba minimos
- crear draft valido
- update draft valido
- publish draft crea version published
- no permite 2 published del mismo templateKey+channel
- rollback crea nueva version published
- schema invalido bloquea publish
- rich-text inseguro es sanitizado
