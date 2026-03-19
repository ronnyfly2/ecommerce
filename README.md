# ecommerce

Modern full-stack ecommerce admin platform built with Vue 3, NestJS, TypeORM, and PostgreSQL.

## Project Structure

```
ecommerce/
├── admin-api/          # NestJS backend API
├── admin-panel/        # Vue 3 frontend admin panel
└── README.md          # This file - API contracts & documentation
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or pnpm

### Installation

```bash
# Install backend dependencies
cd admin-api
npm install
npm run migration:run
npm run seed

# Install frontend dependencies
cd ../admin-panel
npm install
```

### Running Development Servers

```bash
# Terminal 1: Backend API (runs on http://localhost:3000)
cd admin-api
npm run start

# Terminal 2: Frontend Panel (runs on http://localhost:5173)
cd admin-panel
npm run dev

# Terminal 3: Run E2E tests
cd admin-panel
npm run e2e:open
```

## API Response Format Standards

All API responses follow a consistent envelope structure for predictability and type safety.

### Success Response

```typescript
type ApiResponse<T> = {
	data: T
	meta?: {
		timestamp: string
		path: string
		version: string
	}
}
```

### Error Response

```typescript
type ApiErrorResponse = {
	statusCode: number
	message: string | string[]  // Array for validation errors
	error?: string
	timestamp: string
	path: string
}
```

## List Response Contracts

Lists are returned in two formats depending on the endpoint:

### 1. Simple Array (Small Collections)

```typescript
GET /api/sizes
Response: {
	data: [
		{ id: "1", name: "XS" },
		{ id: "2", name: "S" },
		{ id: "3", name: "M" }
	]
}
```

### 2. Paginated Response (Large Collections)

```typescript
GET /api/products?page=1&limit=20
Response: {
	data: {
		items: [
			{ id: "1", name: "Product 1", price: 99.99, ... },
			{ id: "2", name: "Product 2", price: 149.99, ... }
		],
		meta: {
			total: 250,
			page: 1,
			limit: 20,
			pages: 13
		}
	}
}
```

### Frontend Normalization

Both formats are normalized by the `normalizeApiList()` helper:

```typescript
// admin-panel/src/utils/api-list.ts
const result = normalizeApiList(data)
// Returns: { items: T[], total: number }
```

## Role-Based Access Control (RBAC)

### User Roles

```typescript
enum Role {
	SUPER_ADMIN = 'super_admin',  // Full system access
	ADMIN = 'admin',               // Full data access
	CUSTOMER = 'customer'          // Own data access only
}
```

### Critical: Orders Endpoint (Role-Filtered)

⚠️ **SECURITY CRITICAL**: This endpoint must respect user roles.

```typescript
GET /api/orders?page=1&limit=20
```

**Admin/Super Admin**: See ALL orders from all customers
**Customer**: See ONLY their own orders

```typescript
// Backend Implementation (admin-api/src/orders/orders.service.ts)
async findAll(requestUser: Pick<User, 'id' | 'role'>, query: QueryOrdersDto) {
	const where: FindOptionsWhere<Order> = {}
  
	if (!this.isAdminRole(requestUser.role)) {
		where.user = { id: requestUser.id }
	}
  
	return this.ordersRepository.find({ where, ... })
}
```

### Orders Statistics Endpoint

```typescript
GET /api/orders/stats
```

Returns aggregated statistics filtered by role:

```typescript
{
	data: {
		totalOrders: number,
		totalRevenue: number,
		pendingOrders: number,
		confirmedOrders: number,
		shippedOrders: number,
		deliveredOrders: number,
		cancelledOrders: number
	}
}
```

## Protected Endpoints by Role

| Endpoint | Method | Super Admin | Admin | Customer |
|----------|--------|:-----------:|:-----:|:--------:|
| /orders | GET | ✓ All | ✓ All | ✓ Own only |
| /orders/stats | GET | ✓ | ✓ | ✓ Own stats |
| /products | GET | ✓ | ✓ | ✓ |
| /products | POST/PATCH/DEL | ✓ | ✓ | ✗ |
| /users | GET/POST/PATCH | ✓ | ✓ | ✗ |
| /inventory | GET/POST/PATCH | ✓ | ✓ | ✗ |
| /categories | GET | ✓ | ✓ | ✓ |
| /categories | POST/PATCH/DEL | ✓ | ✓ | ✗ |

## Error Handling

### Validation Errors (400)

```json
{
	"statusCode": 400,
	"message": [
		"email must be an email",
		"password must be at least 8 characters"
	],
	"error": "Bad Request"
}
```

**Frontend handling uses type guard:**
```typescript
import { extractErrorMessage } from '@/utils/error'

try {
	await service.create(data)
} catch (error) {
	const msg = extractErrorMessage(error, 'Default message')
	toast.error('Error', msg)
}
```

### Authorization Errors (403)

Returned when authenticated user lacks required permissions.

### Not Found Errors (404)

```json
{
	"statusCode": 404,
	"message": "Resource not found",
	"error": "Not Found"
}
```

## Pagination Parameters

All paginated endpoints support:

```typescript
page?: number       // Starting page (default: 1)
limit?: number      // Items per page (default: 20, max: 100)
search?: string     // Search term (endpoint-specific)
sortBy?: string     // Sort field
sortOrder?: 'asc' | 'desc'
```

## Available Services

### Backend Services (NestJS)

- **auth** - JWT authentication & refresh tokens
- **users** - User management with roles
- **products** - Products with variants, images, pricing
- **orders** - Orders with status tracking & role filtering
- **inventory** - Stock movements with user attribution
- **categories** - Hierarchical product categories
- **sizes** - Size variants
- **colors** - Color variants
- **coupons** - Discount codes with conditions
- **images** - Asset upload & management

### Frontend Services (Vue 3)

- **auth** - Login, logout, session management
- **users** - CRUD operations for users
- **products** - Products, variants, images
- **orders** - Orders list (role-filtered)
- **inventory** - Stock adjustments
- **catalog** - Categories, sizes, colors
- **coupons** - Coupon management

## End-to-End Testing

### Running Tests

```bash
# Run order filtering tests (CRITICAL for RBAC)
npm run e2e:run:orders

# Run error handling tests
npm run e2e:run:errors

# Open interactive test runner
npm run e2e:open

# Run all E2E tests
npm run e2e
```

### Test Files

- `cypress/e2e/orders.role-filtering.cy.ts` - RBAC verification
- `cypress/e2e/error-handling.cy.ts` - Error message extraction

See `cypress/README.md` for detailed testing documentation.

## Type Safety

### Frontend Types

All API responses are typed:

```typescript
// admin-panel/src/types/api.ts
export type ApiResponse<T> = { data: T; meta?: {...} }
export type ApiListData<T> = T[] | ApiPaginatedData<T>
export type ApiPaginatedData<T> = { items: T[]; meta: {...} }
```

### Error Extraction Utility

Type-safe error message extraction replaces `any` types:

```typescript
// admin-panel/src/utils/error.ts
export function extractErrorMessage(error: unknown, defaultMsg?: string): string
export function parseApiError(error: unknown): ApiErrorInfo
```

## Architecture Decisions

### API List Response Flexibility

**Why two formats?**
- Simple arrays for small, fixed collections (sizes, colors)
- Pagination for large, frequently-updated collections (products, orders)

**Benefit**: Frontend normalizer handles both seamlessly via `normalizeApiList()`

### Role-Based Filtering at Service Layer

**Why service, not middleware?**
- Each entity may have different filtering logic
- Services can access complete request context (header, query)
- Easier to test and maintain per-service rules

**Orders service example:**
```typescript
// Customers filtered to own orders
// Admins see all orders
```

### Type Guards for Error Handling

**Why type guards vs. any?**
- Safer: Handles unknown error shapes gracefully
- Testable: Can verify message extraction works correctly
- Maintainable: Error format changes won't break catch blocks

## Environment Variables

### Backend (.env)

```
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h
UPLOAD_DIR=./uploads
NODE_ENV=development
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3000/api
VITE_SEED_ADMIN_EMAIL=admin@local.dev
VITE_SEED_ADMIN_PASSWORD=Admin2026!
```

## Security Notes

⚠️ **Critical Security Requirements:**

1. **Order Filtering**: Backend MUST verify user role when returning orders
	 - Test with: `npm run e2e:run:orders`
2. **Authentication**: All protected endpoints require valid JWT token
3. **Authorization**: Each service should validate user role for write operations
4. **Input Validation**: All inputs validated at controller/service level
5. **Error Messages**: Never expose sensitive database details in error responses

## Contributing

### Before Committing

```bash
# Build both projects
npm run build  # From admin-api
npm run build  # From admin-panel

# Run E2E tests
npm run e2e
```

### Code Standards

- No `any` types (use type guards instead)
- All API responses typed with `ApiResponse<T>`
- All errors caught with `extractErrorMessage()`
- All list endpoints normalized with `normalizeApiList()`

## Troubleshooting

### Tests fail with "Connection refused"

Ensure backend is running: `cd admin-api && npm run start`

### Frontend shows "Cannot find module '@/utils/error'"

Run build to regenerate types: `npm run build`

### Orders endpoint returns all orders for customers

**CRITICAL BUG**: Check that backend is respecting user role:
```typescript
// admin-api/src/orders/orders.service.ts
if (!this.isAdminRole(requestUser.role)) {
	where.user = { id: requestUser.id }
}
```

## Performance Considerations

- Dashboard KPI stats are cached at component level
- Pagination defaults to limit: 20 (max: 100)
- Images are stored locally in `./uploads`
- JWT tokens expire after 1 hour

## Future Enhancements

- [ ] GraphQL API layer
- [ ] Real-time WebSocket updates for orders
- [ ] Advanced search with Elasticsearch
- [ ] Multi-tenant support
- [ ] Mobile app with React Native
- [ ] Async job queue for image processing

