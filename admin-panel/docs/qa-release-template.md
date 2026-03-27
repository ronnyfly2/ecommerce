# Plantilla de QA de Release

Usar esta plantilla para validar una entrega de frontend del admin panel antes de merge o deploy.

## Información general

- Fecha:
- Responsable:
- Branch / PR:
- Entorno probado:
- Backend usado:

## Alcance de la validación

Marcar lo que corresponda:

- [ ] Cambios visuales
- [ ] Cambios de navegación
- [ ] Cambios de permisos/roles
- [ ] Cambios de formularios
- [ ] Cambios de tablas/listados
- [ ] Cambios de accesibilidad
- [ ] Cambios de notificaciones

## Checklist técnico

- [ ] `npm run build`
- [ ] `npm run e2e:run:a11y`
- [ ] Smoke test manual de teclado ejecutado

## Checklist funcional mínima

- [ ] Login
- [ ] Dashboard
- [ ] Productos
- [ ] Órdenes
- [ ] Usuarios
- [ ] Notificaciones

## Checklist de accesibilidad

- [ ] Foco visible en controles principales
- [ ] Navegación por teclado sin bloqueos
- [ ] Modales cierran con `Escape`
- [ ] Trap de foco en diálogos correcto
- [ ] Mensajes de error/éxito visibles y comprensibles
- [ ] Sin fallos críticos/serios en Axe

## Evidencia

- Screenshots:
- Videos:
- Notas:

## Hallazgos

| Severidad | Módulo | Descripción | Estado |
| --- | --- | --- | --- |
| Baja | | | |

## Decisión final

- [ ] Aprobado
- [ ] Aprobado con observaciones
- [ ] Bloqueado

## Observaciones finales

-