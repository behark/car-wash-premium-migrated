/**
 * Error System Exports
 * Centralized access to all error handling functionality
 */

// Define interfaces first
export type ErrorContext = { [key: string]: any };
export type ErrorMetadata = {
  timestamp: string;
  traceId?: string;
  context?: ErrorContext;
};
export type SerializedError = {
  name: string;
  message: string;
  code: string;
  statusCode: number;
  stack?: string;
  metadata: ErrorMetadata;
};

// Base Error Class
export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly retryable?: boolean;
  public readonly severity?: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context?: ErrorContext,
    options: { retryable?: boolean; severity?: 'low' | 'medium' | 'high' | 'critical' } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.retryable = options.retryable;
    this.severity = options.severity;
    Error.captureStackTrace(this, this.constructor);
  }

  shouldRetry(): boolean {
    return this.retryable === true;
  }

  isSafeToExpose(): boolean {
    return this.statusCode < 500;
  }

  getUserMessage(): string {
    return this.isSafeToExpose() ? this.message : 'An unexpected error occurred.';
  }
}

// Specific Error Classes
export class ValidationError extends BaseError {
  public readonly fieldErrors: Array<{ field: string; message: string; value?: any }>;

  constructor(message: string, fieldErrors: Array<{ field: string; message: string; value?: any }>, context?: ErrorContext) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.fieldErrors = fieldErrors;
  }
}

export class BusinessError extends BaseError {
  constructor(
    message: string,
    code: string = 'BUSINESS_RULE_VIOLATION',
    context?: ErrorContext,
    options?: { retryable?: boolean; severity?: 'low' | 'medium' | 'high' | 'critical' }
  ) {
    super(message, code, 400, context, options);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id: string, context?: ErrorContext) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404, context);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication required', context?: ErrorContext) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Permission denied', permission?: string, context?: ErrorContext) {
    super(message, 'AUTHORIZATION_ERROR', 403, { ...context, requiredPermission: permission });
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Too many requests', retryAfter: number, context?: ErrorContext) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { ...context, retryAfter });
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string, context?: ErrorContext) {
    super(`Error from external service ${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, context, { retryable: true });
  }
}

export class DatabaseError extends BaseError {
  constructor(operation: string, message: string, context?: ErrorContext) {
    super(`Database error during ${operation}: ${message}`, 'DATABASE_ERROR', 500, context, { retryable: true });
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, configKey: string, context?: ErrorContext) {
    super(`Configuration error for ${configKey}: ${message}`, 'CONFIGURATION_ERROR', 500, context);
  }
}


// Booking domain errors
export class ServiceNotFoundError extends NotFoundError {
    constructor(serviceId: string) {
        super('Service', serviceId);
    }
}
export class ServiceInactiveError extends BusinessError {}
export class TimeSlotUnavailableError extends BusinessError {}
export class BookingOutsideBusinessHoursError extends BusinessError {}
export class HolidayBookingError extends BusinessError {}
export class AdvanceBookingLimitError extends BusinessError {}
export class LeadTimeViolationError extends BusinessError {}
export class InvalidBookingStatusTransitionError extends BusinessError {}
export class BookingAlreadyCancelledError extends BusinessError {}
export class BookingAlreadyCompletedError extends BusinessError {}
export class CancellationDeadlinePassedError extends BusinessError {}
export class PaymentRequiredError extends BusinessError {}
export class PaymentFailedError extends BusinessError {}
export class RefundNotAllowedError extends BusinessError {}
export class InvalidCustomerDataError extends ValidationError {}
export class InvalidVehicleTypeError extends BusinessError {}
export class InvalidLicensePlateError extends BusinessError {}
export class CapacityExceededError extends BusinessError {}
export class NoWashBayAvailableError extends BusinessError {}
export class NoStaffAvailableError extends BusinessError {}
export class InvalidStaffAssignmentError extends BusinessError {}
export class BookingSystemMaintenanceError extends BusinessError {}
export class ConcurrentBookingError extends BusinessError {}
export class NotificationDeliveryError extends ExternalServiceError {
    constructor(service: string, message: string, context?: ErrorContext) {
        super(service, message, context);
    }
}

export function createBookingError(message: string, code: string, context?: ErrorContext): BusinessError {
  return new BusinessError(message, code, context);
}


// Mock Error Handler
export const errorHandler = {
  handleApplicationError: (error: any, context?: ErrorContext): BaseError => {
    if (error instanceof BaseError) {
      return error;
    }
    // In a real scenario, you would log the error and its context
    console.error("Handling error:", error, context);
    return new BusinessError('An unexpected error occurred.', 'UNEXPECTED_ERROR', context);
  }
};

export const { withErrorHandler, setupGlobalErrorHandlers } = {
  withErrorHandler: (fn: Function) => fn,
  setupGlobalErrorHandlers: () => {},
};


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
