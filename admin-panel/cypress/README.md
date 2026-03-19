# E2E Tests Documentation

## Overview

This project uses Cypress for end-to-end testing. The tests validate critical flows including role-based access control, error handling, and user interactions.

## Test Files

### `cypress/e2e/orders.role-filtering.cy.ts`
Tests for role-based order filtering - the most critical security feature:

- **Admin user tests:**
  - Can see all orders regardless of who placed them
  - Can filter orders by status
  - Dashboard shows complete statistics

- **Customer user tests:**
  - Only see their own orders
  - Cannot access global order filters
  - Dashboard shows personal statistics only

- **Authorization tests:**
  - Unauthenticated access is redirected to login
  - Direct API access respects role-based filtering

### `cypress/e2e/error-handling.cy.ts`
Tests for error handling and user feedback:

- **Login error handling:**
  - Invalid credentials show readable error messages
  - Network errors are handled gracefully
  - Form recovers after errors

- **Validation error handling:**
  - API validation errors display as readable messages
  - Array-format error messages are properly handled
  - Users can retry after validation errors

- **Toast notifications:**
  - Success actions show confirmation toasts
  - Failed actions show error toasts

## Running Tests

### Interactive Mode
```bash
npm run e2e:open
```
Opens the Cypress test runner where you can see tests run with live preview.

### Headless Mode
```bash
npm run e2e
```
Runs all tests headlessly (useful for CI/CD).

### Specific Test Suite
```bash
npm run e2e:run:orders
npm run e2e:run:errors
```

## Configuration

### Environment Variables
Tests use environment variables for credentials. Set them in `cypress.env.json`:

```json
{
  "ADMIN_EMAIL": "admin@local.dev",
  "ADMIN_PASSWORD": "Admin2026!",
  "CUSTOMER_EMAIL": "customer@local.dev",
  "CUSTOMER_PASSWORD": "Customer123!"
}
```

Or they default to seed credentials from `.env`.

### Base URL
Tests default to `http://localhost:5173`. Update in `cypress.config.ts` if needed.

## Test Structure

All tests follow this pattern:
1. **beforeEach**: Common setup (login, navigate)
2. **it()**: Individual test case with descriptive name
3. **Assertions**: Verify expected behavior using `cy.get()`, `cy.visit()`, etc.

## Critical Test Cases

### Role-Based Access (SECURITY CRITICAL)
The `orders.role-filtering` test suite is the most critical. It verifies:
- Frontend properly filters data based on role
- Backend API respects role-based filtering
- Customers cannot see other users' orders

**This test must pass before each release.**

### Error Handling
The `error-handling` test suite ensures:
- Error messages are readable (using `extractErrorMessage` utility)
- UI remains responsive after errors
- No type errors from `any` types in catch blocks

## Troubleshooting

### Tests timeout
- Increase `defaultCommandTimeout` in `cypress.config.ts`
- Ensure development server is running: `npm run dev`

### CORS errors
- Verify backend is running on expected port
- Check `cypress.config.ts` baseUrl

### Login fails
- Update credentials in `cypress.env.json`
- Ensure seed data is generated: `npm run seed` in admin-api

### Element not found
- Use `cy.get()` with more specific selectors
- Add `data-test` attributes to elements you want to target

## Best Practices

1. **Use data-test attributes** for reliable element selection:
   ```html
   <button data-test="create-user-btn">Create</button>
   ```

2. **Wait for elements** instead of fixed delays:
   ```js
   cy.get('table').should('be.visible')  // Waits up to 4s by default
   ```

3. **Test user workflows, not implementation**:
   ```js
   // Good: User creates order
   // Bad: Internal component state is updated
   ```

4. **Keep tests independent**:
   ```js
   // Each test can run alone
   // Don't depend on results from previous tests
   ```

## Future Test Coverage

Consider adding tests for:
- **Inventory management**: Creating/updating stock movements
- **Product management**: CRUD operations for products and variants
- **Coupons**: Create, apply, validate coupon logic
- **User management**: Create/deactivate users
- **Permissions**: Verify role-based button visibility

## CI/CD Integration

To add to CI/CD pipeline:
```yaml
- name: Run E2E Tests
  run: npm run e2e
  env:
    CYPRESS_BASE_URL: http://localhost:3000
```

Make sure:
1. Backend server is running or seeded
2. Frontend dev server is running or built
3. Database is initialized with seed data
