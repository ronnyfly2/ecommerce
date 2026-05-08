# API Contract - Templates (Fase 1)

## Convenciones de respuesta
Exito:
- { data: ... }

Error:
- { statusCode, message, error?, timestamp, path }

## Endpoints de lectura (Nuxt)

### GET /api/templates/:templateKey
Query params:
- channel: web (requerido)
- version: number (opcional, por defecto ultima published)

Response 200:
- data.id
- data.templateKey
- data.channel
- data.pageType
- data.version
- data.schemaVersion
- data.status
- data.content
- data.publishedAt

Errores esperados:
- 404 template no encontrado
- 409 schemaVersion no compatible

## Endpoints de gestion (Admin Panel)

### POST /api/admin/templates
Crea draft inicial.

Body:
- templateKey: string
- channel: web
- pageType: home|category
- schemaVersion: string
- content: TemplateDocument

Response 201:
- data.id
- data.status (draft)

### PUT /api/admin/templates/:id
Actualiza draft.

Body:
- content: TemplateDocument
- schemaVersion: string

Response 200:
- data.id
- data.status
- data.updatedAt

### POST /api/admin/templates/:id/publish
Publica draft vigente como nueva version.

Body:
- publishNote: string (opcional)

Response 200:
- data.id
- data.templateKey
- data.version
- data.status (published)
- data.publishedAt

### POST /api/admin/templates/:id/deprecate
Marca published como deprecated.

Body:
- reason: string (opcional)

Response 200:
- data.id
- data.status (deprecated)

### POST /api/admin/templates/:id/rollback
Genera una nueva version published a partir de una version previa.

Body:
- sourceVersion: number (requerido)
- reason: string (opcional)

Response 200:
- data.id
- data.version (nueva)
- data.status (published)

## Reglas de validacion
- content debe validar contra schema JSON v1.
- props deben validar por componentKey.
- URLs validas y rich-text sanitizado.
- campos desconocidos se rechazan.

## Autorizacion sugerida
- GET lectura publica: Jwt opcional segun canal.
- Endpoints admin: roles ADMIN|SUPER_ADMIN|MARKETING (a definir por negocio).
