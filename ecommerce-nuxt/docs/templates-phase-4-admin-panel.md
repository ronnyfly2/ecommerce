# Fase 4 - Gestor de Templates (admin-panel)

## Objetivo
Permitir gestionar templates de forma guiada: crear, editar, previsualizar y publicar.

## Duracion estimada
1-2 semanas.

## Alcance
- Listado de templates
- Editor de secciones
- Formulario de props por componentKey
- Preview previa a publicacion
- Publish con validacion y confirmacion
- Historial de versiones

## Estructura sugerida en admin-panel
- src/views/templates/TemplatesListView.vue
- src/views/templates/TemplateEditorView.vue
- src/views/templates/TemplateHistoryView.vue
- src/components/templates/SectionList.vue
- src/components/templates/SectionEditor.vue
- src/components/templates/TemplatePreview.vue
- src/services/templates.service.ts
- src/stores/templates.ts
- src/types/templates.ts

## UX funcional minima
- Crear draft desde templateKey + pageType + channel
- Agregar/quitar/reordenar secciones
- Editar props por bloque con validaciones en formulario
- Previsualizar en entorno controlado
- Publicar con modal de confirmacion

## Reglas de producto
- No publicar si schema invalido
- Mostrar errores de validacion claros por campo
- Mostrar estado actual: draft/published/deprecated
- Solo roles autorizados pueden publicar

## Secuencia de implementacion
1. Crear rutas y vistas base
2. Implementar servicio API y store
3. Implementar editor de secciones
4. Implementar formularios por bloque
5. Integrar preview
6. Integrar publish/deprecate/rollback
7. Agregar pruebas e2e de flujo principal

## Definicion de listo
- Usuario autorizado puede pasar de draft a published
- Errores de validacion se muestran antes de publicar
- Historial de versiones accesible

## Casos de prueba minimos
- crear draft y guardar
- editar props validas
- bloquear props invalidas
- publicar version y verla en historial
- rollback desde historial
