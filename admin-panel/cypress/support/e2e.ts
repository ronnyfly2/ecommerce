// Cypress support file for E2E tests
// This file runs before all tests and can contain custom commands and global hooks

// Import commands
// import './commands'

// Disable uncaught exception handler for testing
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  // This handles cases where the application throws expected errors
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('Network request failed')
  ) {
    return false
  }
  return true
});

// Configure timeouts
Cypress.Commands.overwrite('visit', (originalFn, url, options) => {
  return originalFn(url, { ...options, onBeforeLoad: () => {} })
});
