/**
 * Type guard to check if a value has an HTTP response structure
 */
function isHttpErrorResponse(value: unknown): value is { response?: { data?: { message?: unknown } } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'response' in value &&
    typeof (value as any).response === 'object' &&
    (value as any).response !== null &&
    'data' in (value as any).response
  )
}

/**
 * Extract error message from caught exception
 * Handles various error structures: HTTP responses, Error objects, unknown types
 *
 * @param error - The caught error/exception
 * @param defaultMessage - Fallback message if extraction fails
 * @returns Extracted error message string
 */
export function extractErrorMessage(error: unknown, defaultMessage = 'Algo salió mal'): string {
  // Handle HTTP response errors
  if (isHttpErrorResponse(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string') {
      return message
    }
    if (Array.isArray(message) && message.length > 0 && typeof message[0] === 'string') {
      return message[0]
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message
  }

  // Handle objects with message property
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as any).message
    if (typeof msg === 'string') {
      return msg
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Fallback
  return defaultMessage
}

/**
 * Type-safe error handler for API calls
 * Returns structured error info for logging/UI
 *
 * @param error - The caught error/exception
 * @returns Object with message and additional error context
 */
export function parseApiError(error: unknown) {
  const message = extractErrorMessage(error)
  const statusCode = isHttpErrorResponse(error) ? (error.response?.data as any)?.statusCode : undefined

  return {
    message,
    statusCode,
    isNetworkError: error instanceof Error && error.message.includes('Network'),
    isValidationError: Array.isArray((error as any)?.response?.data?.message),
  }
}
