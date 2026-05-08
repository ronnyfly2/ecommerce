# Roadmap: Templates Hibridos (Nuxt + Admin Panel)

## Objetivo
Permitir que ecommerce-nuxt renderice componentes locales mediante estructuras configurables publicadas desde admin-panel y servidas por admin-api, manteniendo control tecnico, performance y seguridad.

## Alcance inicial
- Canal inicial: web
- Paginas iniciales: home, category
- Bloques iniciales: hero, banner, product-grid, rich-text, cta

## Fase 0 - Alineacion funcional (2-3 dias)
### Objetivos
- Cerrar alcance MVP funcional y operativo.
- Definir quienes editan, validan y publican templates.
- Fijar convencion de identificadores.

### Entregables
- Documento de alcance MVP.
- Lista de bloques del MVP con responsable funcional.
- Convencion de IDs de template.

### Criterios de salida
- Aprobacion de alcance por producto/negocio/tecnico.
- IDs y reglas de nombrado documentadas.

## Fase 1 - Contrato tecnico y schema (3-4 dias)
### Objetivos
- Diseñar schema JSON versionado para templates.
- Definir validaciones estrictas para componentKey/props.
- Definir versionado y estados (draft/published).

### Entregables
- Especificacion tecnica del contrato de template.
- JSON schema versionado.
- Matriz de props permitidas por componente.

### Criterios de salida
- Contrato revisado por backend y frontend.
- Schema utilizable en validacion server-side.

## Fase 2 - Backend API (1 semana)
### Objetivos
- Construir modulo de templates en admin-api.
- Exponer lectura publica por templateKey.
- Implementar CRUD draft, publish, historial y rollback.

### Endpoints minimos sugeridos
- GET /templates/:templateKey?channel=web
- POST /admin/templates
- PUT /admin/templates/:id
- POST /admin/templates/:id/publish
- POST /admin/templates/:id/rollback

### Entregables
- API funcional con validacion de schema.
- Pruebas unitarias y e2e base.

### Criterios de salida
- Flujo draft -> publish funcionando.
- Lectura publica estable para Nuxt.

## Fase 3 - Runtime Nuxt (1 semana)
### Objetivos
- Crear registry local componentKey -> componente.
- Renderizar secciones dinamicas desde API.
- Agregar fallback seguro a template local.

### Entregables
- Motor de render de templates en Nuxt.
- Cache y manejo de errores/fallback.

### Criterios de salida
- Home/category renderizan desde API.
- Fallback probado ante fallo de API o schema invalido.

## Fase 4 - Gestor en Admin Panel (1-2 semanas)
### Objetivos
- Crear interfaz de gestion de templates.
- Soportar orden de bloques, props y preview.
- Implementar flujo de publicacion con auditoria.

### Entregables
- Pantallas de listado/edicion/publicacion.
- Preview funcional previo a publicar.
- Registro de cambios (quien y cuando).

### Criterios de salida
- Equipo no tecnico puede operar templates de forma guiada.
- Publicaciones trazables y controladas.

## Fase 5 - Calidad y hardening (4-5 dias)
### Objetivos
- Cubrir pruebas de contrato, render y publicacion.
- Instrumentar logs/metricas de errores y fallback.
- Asegurar sanitizacion y validacion estricta.

### Entregables
- Suite minima de pruebas automatizadas.
- Dashboard o reporte de metricas claves.

### Criterios de salida
- Riesgo operativo bajo para salida a produccion.

## Fase 6 - Go-live controlado (3-4 dias)
### Objetivos
- Activar por feature flag con rollout gradual.
- Establecer plan de rollback inmediato.

### Entregables
- Estrategia de despliegue 10% -> 50% -> 100%.
- Runbook de rollback operativo.

### Criterios de salida
- Publicacion en produccion sin regresiones criticas.

## KPIs de exito
- Tiempo para publicar cambios de estructura.
- Numero de cambios sin redeploy de frontend.
- Tasa de error por template publicado.
- Tiempo de recuperacion via rollback.

## Cronograma sugerido (6 semanas)
1. Semana 1: Fase 0 + Fase 1
2. Semana 2: Fase 2 (base)
3. Semana 3: Fase 3
4. Semana 4: Fase 4 (MVP)
5. Semana 5: Fase 4 + Fase 5
6. Semana 6: Fase 6 + estabilizacion
