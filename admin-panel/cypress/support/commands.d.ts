/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      injectAxe(): Chainable<void>
      checkA11y(
        context?: string | Node | null,
        options?: Record<string, unknown>,
        violationCallback?: (violations: unknown[]) => void,
        skipFailures?: boolean,
      ): Chainable<void>
      runA11yAudit(
        context?: string | Node | null,
        options?: Record<string, unknown>,
      ): Chainable<void>
    }
  }
}

export {}