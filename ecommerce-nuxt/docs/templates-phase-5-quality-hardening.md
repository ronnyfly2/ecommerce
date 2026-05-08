# Fase 5 - Calidad y Hardening

## Objetivo
Reducir riesgo de produccion con pruebas, observabilidad y controles de seguridad.

## Duracion estimada
4-5 dias.

## Alcance
- Tests de contrato y regresion
- Monitoreo de errores de templates
- Alertas de fallback anomalo
- Controles de seguridad de contenido

## Pruebas recomendadas
### Backend
- contrato schema v1
- reglas de versionado/publish
- validacion URL y rich-text sanitizado

### Frontend Nuxt
- renderer por componentKey
- manejo de componente desconocido
- fallback por error de API y schemaVersion

### Admin panel
- flujo de edicion -> validacion -> publish
- mensajes de error por campo

## Observabilidad
### Logs estructurados
Campos minimos:
- templateKey
- version
- schemaVersion
- pageType
- renderStatus
- fallbackUsed
- errorCode

### Metricas
- template_render_ok_total
- template_render_fallback_total
- template_render_error_total
- template_publish_total
- template_publish_error_total

### Alertas
- fallback rate > 5% en 15 min
- publish error rate > 3% en 30 min

## Seguridad
- sanitizador estricto para rich-text
- bloqueo de scripts y eventos inline
- validacion de URL http/https o path interno
- rechazo de campos desconocidos

## Definicion de listo
- Cobertura minima definida y cumplida en flujos criticos
- Alertas configuradas para fallback/error
- Checklist de seguridad aprobado
