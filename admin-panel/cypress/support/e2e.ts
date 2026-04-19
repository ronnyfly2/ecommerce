import 'cypress-axe'

type AxeNodeLike = {
  target: string[]
  html?: string
}

type AxeViolationLike = {
  id: string
  nodes: AxeNodeLike[]
}

// Cypress support file for E2E tests
// This file runs before all tests and can contain custom commands and global hooks

// Import commands
// import './commands'

// Disable uncaught exception handler for testing
Cypress.on('uncaught:exception', (err, _runnable) => {
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

Cypress.Commands.add('runA11yAudit', (context, options) => {
  cy.injectAxe()
  cy.checkA11y(
    context,
    {
      includedImpacts: ['serious', 'critical'],
      ...options,
    },
    (violations) => {
      const typedViolations = violations as AxeViolationLike[]

      if (typedViolations.length === 0) {
        return
      }

      const details = typedViolations
        .map((violation) => {
          const nodeDetails = violation.nodes
            .map((node) => {
              const selectors = node.target.join(', ')
              const snippet = (node.html ?? '').replace(/\s+/g, ' ').slice(0, 180)
              return `${selectors} => ${snippet}`
            })
            .join(' || ')

          return `${violation.id}: ${nodeDetails}`
        })
        .join(' | ')

      throw new Error(`Accessibility violations found: ${details}`)
    },
  )
})
