/**
 * Error System Exports
 * Centralized access to all error handling functionality
 */

// Base error classes
export {
  BaseError,
  ValidationError,
  BusinessError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
  type ErrorContext,
  type ErrorMetadata,
  type SerializedError,
} from './base-error';

// Booking domain errors
export {
  ServiceNotFoundError,
  ServiceInactiveError,
  TimeSlotUnavailableError,
  BookingOutsideBusinessHoursError,
  HolidayBookingError,
  AdvanceBookingLimitError,
  LeadTimeViolationError,
  BookingNotFoundError,
  InvalidBookingStatusTransitionError,
  BookingAlreadyCancelledError,
  BookingAlreadyCompletedError,
  CancellationDeadlinePassedError,
  PaymentRequiredError,
  PaymentFailedError,
  RefundNotAllowedError,
  InvalidCustomerDataError,
  InvalidVehicleTypeError,
  InvalidLicensePlateError,
  CapacityExceededError,
  NoWashBayAvailableError,
  NoStaffAvailableError,
  InvalidStaffAssignmentError,
  BookingSystemMaintenanceError,
  ConcurrentBookingError,
  NotificationDeliveryError,
  createBookingError,
} from './booking-errors';

// Error handler
export {
  ErrorHandler,
  withErrorHandler,
  setupGlobalErrorHandlers,
  errorHandler,
  type ErrorHandlerOptions,
  type ErrorMetrics,
  type ErrorContext as HandlerErrorContext,
} from './error-handler';

/**
 * Error utility functions
 */

/**
 * Check if error is a known application error
 */
export function isApplicationError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.shouldRetry();
  }
  return false;
}

/**
 * Check if error is safe to expose to users
 */
export function isSafeToExpose(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.isSafeToExpose();
  }
  return false;
}

/**
 * Extract error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof BaseError) {
    return error.code;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Extract status code from any error
 */
export function getStatusCode(error: unknown): number {
  if (error instanceof BaseError) {
    return error.statusCode;
  }

  // Default to 500 for unknown errors
  return 500;
}

/**
 * Get user-friendly message from any error
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof BaseError) {
    return error.getUserMessage();
  }

  if (error instanceof Error) {
    // Only expose message if it's safe
    if (error.name === 'ValidationError') {
      return error.message;
    }
  }

  return 'An unexpected error occurred. Please try again later.';
}

/**
 * Create validation error from field errors
 */
export function createValidationError(
  fieldErrors: Array<{ field: string; message: string; value?: any }>
): ValidationError {
  return new ValidationError(
    `Validation failed: ${fieldErrors.length} error(s) found`,
    fieldErrors
  );
}

/**
 * Create business error with automatic error code generation
 */
export function createBusinessError(
  message: string,
  options: {
    statusCode?: number;
    context?: ErrorContext;
    retryable?: boolean;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  } = {}
): BusinessError {
  // Generate error code from message
  const code = message
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);

  return new BusinessError(message, code, options.context, options);
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorContext?: ErrorContext
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const processedError = errorHandler.handleApplicationError(error, errorContext);
      throw processedError;
    }
  }) as T;
}

/**
 * Assert condition and throw business error if false
 */
export function assert(
  condition: boolean,
  message: string,
  code?: string,
  context?: ErrorContext
): asserts condition {
  if (!condition) {
    throw new BusinessError(
      message,
      code || 'ASSERTION_FAILED',
      context
    );
  }
}

/**
 * Assert that value is not null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  message: string,
  context?: ErrorContext
): asserts value is T {
  if (value === null || value === undefined) {
    throw new BusinessError(
      message,
      'VALUE_REQUIRED',
      context
    );
  }
}

/**
 * Assert that user has permission
 */
export function assertPermission(
  hasPermission: boolean,
  permission: string,
  context?: ErrorContext
): asserts hasPermission {
  if (!hasPermission) {
    throw new AuthorizationError(
      `Permission required: ${permission}`,
      permission,
      context
    );
  }
}

/**
 * Assert that user is authenticated
 */
export function assertAuthenticated(
  isAuthenticated: boolean,
  context?: ErrorContext
): asserts isAuthenticated {
  if (!isAuthenticated) {
    throw new AuthenticationError('Authentication required', context);
  }
}

/**
 * Error boundary utility for React components
 */
export class ErrorBoundary {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  static logError(error: Error, errorInfo?: any) {
    const processedError = errorHandler.handleApplicationError(error, {
      component: 'ErrorBoundary',
      ...errorInfo,
    });

    return processedError;
  }
}

/**
 * Development utilities
 */
export const ErrorUtils = {
  /**
   * Test error creation and handling
   */
  testError(type: string, message?: string): BaseError {
    switch (type) {
      case 'validation':
        return new ValidationError(
          message || 'Test validation error',
          [{ field: 'test', message: 'Test field error' }]
        );

      case 'business':
        return new BusinessError(
          message || 'Test business error',
          'TEST_BUSINESS_ERROR'
        );

      case 'notfound':
        return new NotFoundError('TestResource', 'test-id');

      case 'auth':
        return new AuthenticationError(message || 'Test auth error');

      case 'authz':
        return new AuthorizationError(message || 'Test authorization error');

      case 'ratelimit':
        return new RateLimitError(message || 'Test rate limit error', 60000);

      case 'external':
        return new ExternalServiceError(
          'TestService',
          message || 'Test external service error'
        );

      case 'database':
        return new DatabaseError(
          'test_operation',
          message || 'Test database error'
        );

      case 'config':
        return new ConfigurationError(
          message || 'Test configuration error',
          'TEST_CONFIG'
        );

      default:
        return new BusinessError(
          message || 'Test unknown error',
          'TEST_UNKNOWN_ERROR'
        );
    }
  },

  /**
   * Simulate error scenarios for testing
   */
  async simulateErrorScenario(scenario: string): Promise<never> {
    const error = this.testError(scenario);
    throw error;
  },
};

/**
 * Type guards for specific error types
 */
export const ErrorTypeGuards = {
  isValidationError: (error: unknown): error is ValidationError =>
    error instanceof ValidationError,

  isBusinessError: (error: unknown): error is BusinessError =>
    error instanceof BusinessError,

  isNotFoundError: (error: unknown): error is NotFoundError =>
    error instanceof NotFoundError,

  isAuthenticationError: (error: unknown): error is AuthenticationError =>
    error instanceof AuthenticationError,

  isAuthorizationError: (error: unknown): error is AuthorizationError =>
    error instanceof AuthorizationError,

  isRateLimitError: (error: unknown): error is RateLimitError =>
    error instanceof RateLimitError,

  isExternalServiceError: (error: unknown): error is ExternalServiceError =>
    error instanceof ExternalServiceError,

  isDatabaseError: (error: unknown): error is DatabaseError =>
    error instanceof DatabaseError,

  isConfigurationError: (error: unknown): error is ConfigurationError =>
    error instanceof ConfigurationError,
};