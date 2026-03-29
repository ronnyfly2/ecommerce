# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo with two applications:
- `admin-api/` — NestJS 11 backend REST API + WebSocket server (port 3000)
- `admin-panel/` — Vue 3 frontend admin panel (port 5173)

## Commands

### Root (runs both apps)
```bash
npm run dev          # Start both API + Panel concurrently
npm run build        # Build both projects
npm run install:all  # Install deps in root + both apps
```

### Backend (`admin-api/`)
```bash
npm run start:dev        # Hot-reload dev server
npm run dev:clean        # Kill port 3000, then start dev
npm run build            # TypeScript compile
npm run lint             # ESLint with auto-fix
npm run test             # Jest unit tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
npm run test:e2e         # E2E tests
npm run migration:run    # Run pending TypeORM migrations
npm run migration:revert # Revert last migration
npm run seed             # Seed DB with initial data
npm run seed:clean       # Remove seeded data
```

### Frontend (`admin-panel/`)
```bash
npm run dev          # Vite dev server
npm run dev:clean    # Kill port 5173, then start dev
npm run build        # vue-tsc + Vite bundle
npm run e2e          # Run all Cypress E2E tests
npm run e2e:open     # Interactive Cypress runner
npm run e2e:run:orders  # RBAC order-filtering tests
npm run e2e:run:errors  # Error handling tests
npm run e2e:run:a11y    # Accessibility tests
```

### Swagger docs
Available at `http://localhost:3000/api/docs` in dev mode.

## Architecture

### Backend (NestJS)

**Each feature is a self-contained NestJS module** under `src/`:
`auth`, `users`, `products`, `orders`, `inventory`, `categories`, `coupons`, `dashboard`, `notifications`, `chat`, `reviews`, `images`, plus small reference-data modules (`colors`, `sizes`, `tags`, `currencies`, `measurement-units`).

**`src/common/`** holds cross-cutting infrastructure:
- `guards/` — `JwtAuthGuard` (reads `@Public()` to skip) and `RolesGuard` (reads `@Roles()`)
- `decorators/` — `@Roles()`, `@Public()`, `@GetUser()`
- `filters/` — `AllExceptionsFilter` (unified error envelope)
- `interceptors/` — `TransformInterceptor` (wraps success responses in `{ data }`)
- `enums/` — `Role` enum: `SUPER_ADMIN | ADMIN | BOSS | MARKETING | SALES | CUSTOMER`

**Global guards** are registered via `APP_GUARD` providers — all endpoints are protected by default; opt-in to public with `@Public()`.

**RBAC is enforced at the service layer**, not middleware, so each feature can apply its own filtering logic (e.g. customers see only their own orders).

**Database**: TypeORM with PostgreSQL. `src/data-source.ts` is used by the CLI for migrations. `autoLoadEntities: true` is set. Migrations live in `src/migration/`.

**Standardized API responses**:
```
Success:      { data: T }
List:         { data: T[] }  or  { data: { items: T[], meta: { total, page, limit, pages } } }
Error:        { statusCode, message, error?, timestamp, path }
```

### Frontend (Vue 3)

**Directory conventions:**
- `src/views/` — page-level components (one per route)
- `src/components/` — reusable components; sub-folders: `ui/`, `forms/`, `catalog/`, `shared/`
- `src/layouts/` — layout wrappers
- `src/stores/` — Pinia stores (one per feature)
- `src/services/` — Axios service modules; `http.ts` is the shared Axios instance with token handling
- `src/types/` — TypeScript types; `api.ts` defines response/error shapes
- `src/utils/api-list.ts` — normalizes both array and paginated list responses
- `src/utils/error.ts` — type-safe error extraction from Axios errors

**Vite proxies `/api` → backend**, so frontend calls `/api/...` paths.

**Real-time**: `chat-realtime.service.ts` and `notifications-realtime.service.ts` use Socket.io-client.

### Environment variables

Backend (`.env` in `admin-api/`): `DB_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MAIL_PROVIDER` (`noop` | `resend`), `RESEND_API_KEY`, `CORS_ORIGIN`, `UPLOAD_DIR`, `SEED_*`.

Frontend (`.env` in `admin-panel/`): `VITE_API_PROXY_TARGET`, `VITE_API_BASE_URL`, `VITE_SEED_*`, `VITE_GIPHY_API_KEY`.

See `.env.example` in each app for all required variables. Environment validation is enforced via Joi in `admin-api/src/config/env.validation.ts`.
