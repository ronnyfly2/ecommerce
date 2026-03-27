# Ecommerce Admin Panel

Panel administrativo construido con:

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- Tailwind CSS v4 (CSS-first)

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Variables de entorno

No requiere `.env` para desarrollo local si el API corre en `http://localhost:3000`, porque Vite proxy redirige `/api`.

Si necesitas apuntar a otro backend, edita `vite.config.ts` en la sección `server.proxy`.

## Estructura

```txt
src/
	assets/main.css              # Design system + tokens + utilities
	components/
		ui/                        # Componentes base del design system
		shared/                    # Sidebar, topbar, shell components
	layouts/
	router/
	services/                    # API client (axios) y módulos por recurso
	stores/                      # Pinia stores
	types/                       # Tipos de API
	views/                       # Módulos/páginas
```

## Design System

El sistema visual está definido en `src/assets/main.css` usando Tailwind v4 con `@theme`.

### 1. Design tokens

Se usan tokens para mantener consistencia:

- Color tokens: `--color-primary-*`, `--color-surface-*`, `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*`
- Typography tokens: `--font-sans`, `--text-*`, `--font-weight-*`, `--leading-*`
- Layout tokens: `--sidebar-width`, `--topbar-height`
- Radius/shadow tokens: `--radius-*`, `--shadow-*`
- Motion tokens: `--transition-fast|normal|slow`

Regla: siempre preferir token antes que hardcodear color/medida.

### 2. Utilities del sistema

Utilities custom disponibles:

- `card`, `card-hover`
- `sidebar-item`, `sidebar-item-active`
- `input-base`, `input-error`
- `btn-base`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `btn-sm`, `btn-lg`
- `badge-base`
- `table-base`, `table-th`, `table-td`, `table-tr-hover`
- `text-heading-*`, `text-body`, `text-muted`, `text-caption`

### 3. Componentes UI base

Componentes disponibles en `src/components/ui`:

- `UiButton`
- `UiInput`
- `UiSelect`
- `UiTextarea`
- `UiCard`
- `UiBadge`
- `UiModal`
- `UiConfirm`
- `UiTable`
- `UiPagination`
- `UiToast` + `UiToastContainer`
- `UiSpinner`

Regla: antes de crear un componente nuevo, revisar si se puede resolver combinando estos.

### 4. Patrones de estados

- `loading`: skeletons, spinner en botones y/o pantalla
- `empty`: estado vacío explícito con mensaje
- `error`: toast global + mensaje contextual cuando aplica

### 5. Semántica de color

- Primary: acciones principales y foco
- Success: operaciones correctas
- Warning: pendientes/alertas suaves
- Danger: eliminación o fallas
- Info: estados intermedios y metadata

## Convenciones del proyecto

- Rutas protegidas por guard global en `src/router/index.ts`
- Sesión en `src/stores/auth.ts`
- Cliente HTTP con refresh automático en `src/services/http.ts`
- Respuestas de API tipadas con envelope `ApiResponse<T>`

## QA de Accesibilidad

- Smoke test manual de teclado: [docs/keyboard-smoke-test.md](docs/keyboard-smoke-test.md)
- Plantilla de QA de release: [docs/qa-release-template.md](docs/qa-release-template.md)
- Auditoría automatizada con Axe: `npm run e2e:run:a11y`

## Módulos implementados

- Auth (login + sesión)
- Dashboard
- Productos (listado, alta/edición, detalle, variantes)
- Órdenes (listado + detalle + cambio de estado)
- Cupones
- Usuarios
- Inventario
- Categorías
- Tallas
- Colores
