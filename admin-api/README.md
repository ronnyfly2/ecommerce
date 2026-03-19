# Ecommerce Admin API

Backend administration API para plataforma de ecommerce construida con NestJS, TypeORM y PostgreSQL.

## Características

- 🔐 Autenticación JWT con roles (SUPER_ADMIN, ADMIN, CUSTOMER)
- 📦 Gestión completa de productos, variantes, inventario
- 🏷️ Sistema de cupones con descuentos % y monto fijo
- 📋 Procesamiento de órdenes con estado máquina
- 🛣️ Gestión de direcciones de envío
- 🖼️ Upload de imágenes con almacenamiento local
- 📊 Documentación automática con Swagger/OpenAPI
- ✅ Validación global de DTOs
- 🚨 Manejo centralizado de excepciones

## Stack Tecnológico

- **Runtime**: Node.js 18+
- **Framework**: NestJS 11+ con TypeORM 0.3
- **Database**: PostgreSQL 12+
- **Auth**: JWT + Passport.js + bcrypt
- **Upload**: Multer (almacenamiento local)
- **Documentación**: Swagger/OpenAPI
- **Validación**: class-validator + class-transformer
- **Desarrollo**: TypeScript, TypeORM CLI

## Instalación

### 1. Clonar y dependencias

```bash
git clone <repo-url>
cd admin-api
npm install
```

### 2. Variables de entorno

Crear `.env` en raíz:

```env
# Base
NODE_ENV=development
PORT=3000

# Database
DB_HOST=postgresql-209519-0.cloudclusters.net
DB_PORT=10012
DB_USER=admin
DB_PASS=your_password
DB_NAME=ecommerce
DB_SSL=true

# JWT
JWT_SECRET=your_secret_key_here_min_32_char
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_secret_min_32_char
JWT_REFRESH_EXPIRES_IN=30d
JWT_REFRESH_COOKIE_NAME=refresh_token
JWT_REFRESH_COOKIE_SECURE=false
JWT_REFRESH_COOKIE_SAME_SITE=lax
JWT_REFRESH_FINGERPRINT_SALT=your_fingerprint_salt_min_16

# Seed admin users (opcional, recomendado)
SEED_SUPER_ADMIN_EMAIL=superadmin@ecommerce.com
SEED_SUPER_ADMIN_PASSWORD=ChangeMeSuperAdmin123!
SEED_ADMIN_EMAIL=admin@ecommerce.com
SEED_ADMIN_PASSWORD=ChangeMeAdmin123!

# Upload
UPLOAD_DIR=uploads
```

### 3. Database setup

Para desarrollo (sincronización automática):

```bash
npm run start:dev
```

Para producción (con migraciones):

```bash
npm run migration:run
npm run seed
npm run start:prod
```

## Desarrollo

### Comandos principales

```bash
# Ejecutar en desarrollo con hot-reload
npm run start:dev

# Compilar TypeScript
npm run build

# Ejecutar en producción
npm run start:prod

# Generar migraciones (después de cambiar entidades)
npm run migration:generate -- -n DescriptionOfChanges

# Ejecutar migraciones pendientes
npm run migration:run

# Revertir última migración
npm run migration:revert

# Poblar base de datos con datos iniciales
npm run seed
```

### Compilación

La aplicación compila sin errores TypeScript:

```bash
npm run build
# Genera carpeta dist/ lista para CI/CD
```

## Checklist de despliegue a producción

### Variables de entorno obligatorias en producción

```env
NODE_ENV=production

# Base de datos
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASS=...
DB_NAME=...
DB_SSL=true

# JWT — usar valores largos y aleatorios (mínimo 32 chars)
JWT_SECRET=<valor-aleatorio-min-32>
JWT_REFRESH_SECRET=<valor-aleatorio-min-32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Cookie de refresh (HTTPS obligatorio en prod)
JWT_REFRESH_COOKIE_SECURE=true
JWT_REFRESH_COOKIE_SAME_SITE=strict
JWT_REFRESH_FINGERPRINT_SALT=<valor-aleatorio-min-16>

# CORS — dominios autorizados separados por coma
CORS_ORIGIN=https://yourdomain.com

# Almacenamiento
UPLOAD_DIR=./uploads
```

### Pasos previos al primer despliegue

```bash
# 1. Ejecutar migraciones (synchronize está deshabilitado en producción)
npm run migration:run

# 2. Poblar datos iniciales (usuarios admin/superadmin)
SEED_SUPER_ADMIN_EMAIL=admin@tudominio.com \
SEED_SUPER_ADMIN_PASSWORD=<password-seguro> \
npm run seed

# 3. Iniciar en producción
npm run start:prod
```

### Verificación post-despliegue (smoke test)

```bash
BASE_URL=https://api.tudominio.com

# Health check — no requiere autenticación
curl "$BASE_URL/api/health"
# Esperado: {"data":{"status":"ok","db":"connected",...}}

# Login
curl -s -c /tmp/cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tudominio.com","password":"<password>"}' | jq .data.accessToken

# Verificar identidad con el access token
TOKEN=<access_token_del_paso_anterior>
curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .data.email
```

### Resumen de medidas de seguridad activas en producción

| Aspecto | Estado | Detalle |
|---|---|---|
| TypeORM synchronize | ✅ Deshabilitado | Usar `migration:run` en prod |
| Swagger | ✅ Solo en dev | No expuesto cuando `NODE_ENV=production` |
| Cookie refresh `secure` | ✅ Auto en prod | Requiere HTTPS |
| Cookie `sameSite` | ✅ `strict` en prod | |
| CORS | ✅ Configurable | Controlado por `CORS_ORIGIN` |
| Graceful shutdown | ✅ Activo | Compatible con Docker/Kubernetes |
| Rate limiting | ⚠️ En memoria | Migrar a Redis para múltiples instancias |
| Uploads | ⚠️ Almacenamiento local | Migrar a S3/GCS en producción real |

---

## CI (GitHub Actions)

El proyecto incluye un pipeline en GitHub Actions: [.github/workflows/ci.yml](.github/workflows/ci.yml).

Se ejecuta en:
- push a ramas `main`, `master`, `develop`
- pull requests

El workflow levanta PostgreSQL (service container) y ejecuta:
- instalación con `npm ci`
- compilación con `npm run build`
- tests unitarios con `npm run test -- --runInBand`
- tests e2e con `npm run test:e2e`

## Estructura del proyecto

```
src/
├── auth/                 # JWT, login, register
├── users/                # CRUD usuarios (admin)
├── sizes/                # Tallas (XS → XXL)
├── colors/               # Colores disponibles
├── categories/           # Categorías productos (jerarquía)
├── products/             # Productos y variantes
├── images/               # Upload de imágenes
├── inventory/            # Movimientos stock
├── coupons/              # Códigos descuento
├── orders/               # Órdenes y checkout
├── common/               # Guards, decorators, filters, enums
├── app.module.ts         # Módulo principal
└── main.ts              # Entry point

uploads/                  # Almacenamiento local de imágenes

scripts/
├── seed.ts              # Población inicial de datos
└── migrations.ts        # Runner de migraciones
```

## Modelos de datos

### User (Usuarios)

```typescript
{
  id: UUID
  email: string (unique)
  firstName: string
  lastName: string
  passwordHash: string (bcrypt)
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER'
  isActive: boolean
  avatar: URL
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Product (Productos)

```typescript
{
  id: UUID
  name: string
  slug: string (unique)
  description: string
  basePrice: decimal
  category: Category (FK)
  isFeatured: boolean
  variants: ProductVariant[] (1→N)
  images: ProductImage[] (1→N)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### ProductVariant (Variantes S/C + Stock)

```typescript
{
  id: UUID
  product: Product (FK)
  size: Size (FK)
  color: Color (FK)
  sku: string (unique)
  stock: integer
  additionalPrice: decimal (suma a basePrice)
  createdAt: timestamp
}
```

### Order (Órdenes)

```typescript
{
  id: UUID
  user: User (FK)
  items: OrderItem[] (1→N)
  subtotal: decimal
  discount: decimal (del cupón)
  total: decimal
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  coupon: Coupon (FK, nullable)
  shippingAddresses: ShippingAddress[] (1→N)
  notes: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Coupon (Cupones)

```typescript
{
  id: UUID
  code: string (unique)
  type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  value: decimal
  minOrderAmount: decimal
  maxUsage: integer
  usageCount: integer
  startDate: timestamp
  endDate: timestamp
  isActive: boolean
  createdAt: timestamp
}
```

## API Endpoints

### Autenticación

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout      # [PROTECTED]
POST /api/auth/logout-all  # [PROTECTED]
POST /api/auth/logout-device  # [PROTECTED]
GET  /api/auth/sessions       # [PROTECTED]
GET /api/auth/me          # [PROTECTED]
```

### Usuarios (ADMIN only)

```http
GET    /api/users         # [ADMIN] - Listar con paginación/filtros
POST   /api/users         # [ADMIN] - Crear nuevo usuario
GET    /api/users/:id     # [ADMIN]
PATCH  /api/users/:id     # [ADMIN] - Update (rol, estado)
DELETE /api/users/:id     # [ADMIN] - Soft delete
```

**Query params (GET /api/users):**
- `page`: 1 (default)
- `limit`: 10 (default)
- `search`: buscar email/firstName/lastName
- `role`: filtrar por rol
- `isActive`: true|false

### Tallas

```http
GET    /api/sizes
POST   /api/sizes         # [ADMIN]
PATCH  /api/sizes/:id     # [ADMIN]
DELETE /api/sizes/:id     # [ADMIN]
```

### Colores

```http
GET    /api/colors
POST   /api/colors        # [ADMIN] - hexCode validado
PATCH  /api/colors/:id    # [ADMIN]
DELETE /api/colors/:id    # [ADMIN]
```

### Categorías (con jerarquía)

```http
GET    /api/categories
GET    /api/categories/tree        # Retorna estructura anidada
POST   /api/categories             # [ADMIN]
PATCH  /api/categories/:id         # [ADMIN]
DELETE /api/categories/:id         # [ADMIN]
```

### Productos y Variantes

```http
GET    /api/products                          # Con paginación
POST   /api/products                          # [ADMIN]
PATCH  /api/products/:id                      # [ADMIN]
DELETE /api/products/:id                      # [ADMIN]

GET    /api/products/:id/variants             # [ADMIN]
POST   /api/products/:id/variants             # [ADMIN]
PATCH  /api/products/:id/variants/:variantId  # [ADMIN]
DELETE /api/products/:id/variants/:variantId  # [ADMIN]
```

### Imágenes

```http
POST /api/images/upload        # [ADMIN] - Multer diskStorage
# Response: { url: '/uploads/timestamp-hash.jpg' }
```

### Inventario

```http
POST /api/inventory/adjustment     # [ADMIN] - Ajuste manual stock
GET  /api/inventory/movements      # [ADMIN] - Historial con paginación
# Auto: Se crean movimientos automáticos al confirmar órdenes
```

**Enum InventoryMovementType:**
- PURCHASE (entrada inicial)
- SALE (venta, auto al confirmar orden)
- ADJUSTMENT (ajuste manual)
- RETURN (devolución)

### Cupones

```http
GET    /api/coupons              # [ADMIN]
POST   /api/coupons              # [ADMIN]
PATCH  /api/coupons/:id          # [ADMIN]
DELETE /api/coupons/:id          # [ADMIN]

POST   /api/coupons/validate     # Validar código + calcular descuento
# Body: { code: string, subtotal: decimal }
# Response: { isValid: boolean, discount: decimal }
```

### Órdenes

```http
GET    /api/orders                 # [PROTECTED] - Mis órdenes
GET    /api/orders/stats           # [ADMIN] - Estadísticas
POST   /api/orders                 # [PROTECTED] - Crear orden
GET    /api/orders/:id             # [PROTECTED]
PATCH  /api/orders/:id/status      # [ADMIN] - Cambiar estado

# State machine: PENDING → CONFIRMED → SHIPPED → DELIVERED
# Al confirmar: decrementan automáticamente stock
```

## Flujos principales

### 1. Registro e inicio de sesión

```bash
# Registrar
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Response
{
  "statusCode": 201,
  "message": "Success",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "CUSTOMER"
  }
}

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Response
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "accessToken": "eyJhbGc..."
  }
}
```

### 2. Crear producto con variantes

```bash
# Como ADMIN, con Bearer token
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "T-Shirt Classic",
    "description": "Premium cotton t-shirt",
    "basePrice": 29.99,
    "categoryId": "category-uuid",
    "isFeatured": true
  }'

# Response con createdAt, slug generado
{
  "id": "product-uuid",
  "slug": "t-shirt-classic",
  "variants": []
}

# Agregar variante (S+Color)
curl -X POST http://localhost:3000/api/products/product-uuid/variants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sizeId": "size-uuid",
    "colorId": "color-uuid",
    "sku": "TS-BLK-M-001",
    "stock": 50,
    "additionalPrice": 0
  }'
```

### 3. Crear y confirmar orden con cupón

```bash
# Crear orden
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "variantId": "variant-uuid",
        "quantity": 2
      }
    ],
    "shippingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US",
      "phoneNumber": "+1234567890"
    },
    "couponCode": "SAVE10"
  }'

# Response: PENDING status
{
  "id": "order-uuid",
  "status": "PENDING",
  "subtotal": 59.98,
  "discount": 5.998,
  "total": 53.98
}

# Confirmar orden (ADMIN)
curl -X PATCH http://localhost:3000/api/orders/order-uuid/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "CONFIRMED"}'

# Auto-decrementa stock de variantes
```

## Control de acceso por rol

| Endpoint | SUPER_ADMIN | ADMIN | CUSTOMER |
|----------|-------------|-------|----------|
| GET /users | ✅ | ✅ | ❌ |
| POST /users | ✅ | ✅ | ❌ |
| PATCH /users/:id | ✅ | ✅ | ❌ |
| POST /products | ✅ | ✅ | ❌ |
| POST /orders | ✅ | ✅ | ✅ |
| GET /orders/me | ✅ | ✅ | ✅ (mis órdenes) |
| PATCH /orders/:id/status | ✅ | ✅ | ❌ |
| GET /inventory/movements | ✅ | ✅ | ❌ |

## Swagger/OpenAPI

La documentación interactiva está en: **http://localhost:3000/api/docs**

Incluye:
- Autenticación Bearer (copiar token de login en "Authorize")
- Esquema de todas las DTOs
- Ejemplos de request/response
- Validaciones necesarias

## Datos iniciales

Después de `npm run seed`:

**Super Admin:**
- Email: valor de `SEED_SUPER_ADMIN_EMAIL` (default: superadmin@ecommerce.com)
- Password: valor de `SEED_SUPER_ADMIN_PASSWORD`
- Role: SUPER_ADMIN

**Admin:**
- Email: valor de `SEED_ADMIN_EMAIL` (default: admin@ecommerce.com)
- Password: valor de `SEED_ADMIN_PASSWORD`
- Role: ADMIN

**Tallas:** XS, S, M, L, XL, XXL
**Colores:** Black, White, Red, Blue, Green, Yellow, Gray, Navy

## Troubleshooting

### Error: "Cannot find module 'typeorm'"

```bash
npm install
npm run build
```

### Database connection error

Verificar `.env`:
- DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
- DB_SSL=true para cloudclusters

```bash
# Test conexión desde terminal
psql -h postgresql-209519-0.cloudclusters.net -p 10012 -U admin -d ecommerce
```

### Seed script falla

```bash
npm run build  # Compilar primero
npm run seed
```

### JWT token inválido

- Copiar token complete sin prefijo "Bearer "
- Verificar que no esté expirado (24h default)
- En Swagger: usar botón "Authorize"

## Deployment

### Preparar para producción

1. Compilar:
   ```bash
   npm install --production
   npm run build
   ```

2. Migraciones:
   ```bash
   npm run migration:run
   ```

3. Seed (opcional):
   ```bash
   npm run seed
   ```

4. Iniciar servidor:
   ```bash
   npm run start:prod
   ```

### Docker (opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY dist .
EXPOSE 3000
CMD ["node", "main.js"]
```

## Soporte y contacto

Para reportar bugs o proponer features, contactar al equipo de backend.

---

**Versión:** 1.0.0  
**Última actualización:** 2024
