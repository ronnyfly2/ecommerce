# PDF Editor MVP - Fase 1 y 2

Fecha: 2026-05-07
Estado: Completado (definicion inicial)

## 1. Alcance y decisiones

- [x] Confirmar alcance MVP
  - [x] Subir PDF
  - [x] Agregar texto
  - [x] Agregar firma
  - [x] Exportar PDF final
- [x] Confirmar tipo de firma
  - [x] Firma visual (sin certificado digital en MVP)
- [x] Definir limite de tamano de archivo
  - [x] 10 MB por PDF
- [x] Definir formatos permitidos
  - [x] Solo `application/pdf` (.pdf)
- [x] Definir roles con acceso inicial
  - [x] `SUPER_ADMIN`, `ADMIN`, `BOSS`

Notas de alcance:
- El MVP no incluye firma digital certificada (PKI) ni validacion legal avanzada.
- Se contempla firma dibujada en canvas y firma por imagen como opcion habilitable.

## 2. UX y flujo funcional

- [x] Definir flujo principal
  - [x] Subir documento
  - [x] Navegar paginas
  - [x] Insertar texto
  - [x] Insertar firma
  - [x] Mover/redimensionar elementos
  - [x] Guardar borrador
  - [x] Exportar PDF
- [x] Definir estados de interfaz
  - [x] Cargando documento
  - [x] Error de lectura/procesamiento
  - [x] Guardado exitoso
  - [x] Exportacion en progreso
- [x] Definir toolbar minima
  - [x] Seleccionar
  - [x] Texto
  - [x] Firma
  - [x] Deshacer/Rehacer
  - [x] Guardar borrador
  - [x] Exportar

Notas UX:
- Desktop: panel lateral de herramientas + lienzo central de pagina.
- Mobile: barra de acciones compacta y herramientas en drawer inferior.
- Confirmacion antes de salir con cambios no guardados.

## Criterio de cierre de Fase 1-2

- [x] Alcance funcional definido y documentado.
- [x] Flujo de edicion definido de inicio a exportacion.
- [x] Estados UI minimos definidos.
- [x] Acciones base de toolbar definidas.

## 3. Implementacion tecnica frontend (estado actual)

- [x] Vista base creada: `PdfEditorView`.
- [x] Ruta registrada en panel: `/admin-tools/pdf-editor`.
- [x] Acceso desde sidebar: `Editor PDF`.
- [x] Carga de archivo PDF con validacion (`application/pdf`, max 10 MB).
- [x] Render de pagina actual con `pdfjs-dist`.
- [x] Navegacion entre paginas.
- [x] Capa de anotaciones por pagina.
- [x] Herramienta de texto (insertar, mover, color, tamano).
- [x] Herramienta de firma (canvas, insertar, mover, redimensionar).
- [x] Exportacion de PDF editado con `pdf-lib`.

Pendiente de fases siguientes:
- [x] Borrador local en navegador (guardar/cargar/limpiar por PDF actual).
- [x] Historial deshacer/rehacer (botones + atajos Cmd/Ctrl+Z y Cmd/Ctrl+Shift+Z).
- [x] Persistencia de borrador (backend) por usuario + documento.
- [x] Endpoints de guardado/recuperacion/eliminacion en `admin-api`.
- [x] Integracion en frontend (guardar/cargar priorizando servidor con fallback local).
- [x] Prueba E2E dedicada de persistencia de borrador en editor PDF (`cypress/e2e/pdf-editor.cy.ts`).