/**
 * Base Error Classes
 * Enterprise-grade error hierarchy with proper error codes and context
 */

import { logger } from '../logger';

export interface ErrorContext {
  [key: string]: any;
}

export interface ErrorMetadata {
  timestamp: Date;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  version?: string;
}

export interface SerializedError {
  name: string;
  message: string;
  code: string;
  statusCode: number;
  context: ErrorContext;
  metadata: ErrorMetadata;
  stack?: string;
  cause?: SerializedError;
}

/**
 * Base application error class
 */
export abstract class BaseError extends Error {
  public readonly name: string;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context: ErrorContext;
  public readonly metadata: ErrorMetadata;
  public readonly isOperational: boolean;
  public readonly retryable: boolean;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context: ErrorContext = {},
    metadata: Partial<ErrorMetadata> = {},
    options: {
      isOperational?: boolean;
      retryable?: boolean;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(message);

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = { ...context };
    this.metadata = {
      timestamp: new Date(),
      correlationId: this.generateCorrelationId(),
      ...metadata,
    };
    this.isOperational = options.isOperational ?? true;
    this.retryable = options.retryable ?? false;
    this.severity = options.severity ?? 'medium';

    // Preserve the original stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Chain the cause if provided
    if (options.cause) {
      this.cause = options.cause;
    }

    // Log the error creation for debugging
    this.logError();
  }

  /**
   * Convert error to JSON serializable format
   */
  toJSON(): SerializedError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      metadata: this.metadata,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
      cause: this.cause ? this.serializeCause(this.cause) : undefined,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    // Default implementation returns the message
    // Subclasses can override for user-specific messaging
    return this.message;
  }

  /**
   * Get error details for API responses
   */
  getApiResponse(): {
    error: {
      code: string;
      message: string;
      details?: any;
    };
    statusCode: number;
  } {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        details: process.env.NODE_ENV === 'development' ? this.context : undefined,
      },
      statusCode: this.statusCode,
    };
  }

  /**
   * Add context to the error
   */
  addContext(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(correlationId: string): this {
    this.metadata.correlationId = correlationId;
    return this;
  }

  /**
   * Set user ID for error tracking
   */
  setUserId(userId: string): this {
    this.metadata.userId = userId;
    return this;
  }

  /**
   * Set operation name
   */
  setOperation(operation: string): this {
    this.metadata.operation = operation;
    return this;
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(): boolean {
    return this.retryable;
  }

  /**
   * Check if error is safe to expose to users
   */
  isSafeToExpose(): boolean {
    return this.isOperational;
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private logError(): void {
    const logLevel = this.getLogLevel();
    const logData = {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        isOperational: this.isOperational,
        retryable: this.retryable,
        severity: this.severity,
      },
      context: this.context,
      metadata: this.metadata,
    };

    logger[logLevel]('Error created', logData);
  }

  private getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
    switch (this.severity) {
      case 'low':
        return 'debug';
      case 'medium':
        return 'info';
      case 'high':
        return 'warn';
      case 'critical':
        return 'error';
      default:
        return 'info';
    }
  }

  private serializeCause(cause: any): SerializedError | any {
    if (cause instanceof BaseError) {
      return cause.toJSON();
    }

    if (cause instanceof Error) {
      return {
        name: cause.name,
        message: cause.message,
        stack: process.env.NODE_ENV === 'development' ? cause.stack : undefined,
      };
    }

    return cause;
  }
}

/**
 * Validation Error - for input validation failures
 */
export class ValidationError extends BaseError {
  public readonly errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    message: string,
    errors: Array<{ field: string; message: string; value?: any }> = [],
    context: ErrorContext = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { ...context, validationErrors: errors },
      {},
      { severity: 'low', retryable: false }
    );

    this.errors = errors;
  }

  getUserMessage(): string {
    if (this.errors.length === 1) {
      return `Invalid ${this.errors[0].field}: ${this.errors[0].message}`;
    }

    return `Validation failed: ${this.errors.length} error(s) found`;
  }

  getApiResponse() {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        details: {
          errors: this.errors,
        },
      },
      statusCode: this.statusCode,
    };
  }
}

/**
 * Business Logic Error - for domain rule violations
 */
export class BusinessError extends BaseError {
  constructor(
    message: string,
    code: string,
    context: ErrorContext = {},
    options: {
      statusCode?: number;
      retryable?: boolean;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ) {
    super(
      message,
      code,
      options.statusCode ?? 400,
      context,
      {},
      {
        severity: options.severity ?? 'medium',
        retryable: options.retryable ?? false,
        isOperational: true,
      }
    );
  }
}

/**
 * Not Found Error - for missing resources
 */
export class NotFoundError extends BaseError {
  constructor(
    resource: string,
    identifier?: string | number,
    context: ErrorContext = {}
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(
      message,
      'NOT_FOUND',
      404,
      { ...context, resource, identifier },
      {},
      { severity: 'low', retryable: false }
    );
  }

  getUserMessage(): string {
    return 'The requested resource was not found';
  }
}

/**
 * Authentication Error - for authentication failures
 */
export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required', context: ErrorContext = {}) {
    super(
      message,
      'AUTHENTICATION_REQUIRED',
      401,
      context,
      {},
      { severity: 'medium', retryable: false }
    );
  }

  getUserMessage(): string {
    return 'Authentication required. Please log in to continue.';
  }
}

/**
 * Authorization Error - for permission failures
 */
export class AuthorizationError extends BaseError {
  constructor(
    message = 'Insufficient permissions',
    requiredPermission?: string,
    context: ErrorContext = {}
  ) {
    super(
      message,
      'INSUFFICIENT_PERMISSIONS',
      403,
      { ...context, requiredPermission },
      {},
      { severity: 'medium', retryable: false }
    );
  }

  getUserMessage(): string {
    return 'You do not have permission to perform this action.';
  }
}

/**
 * Rate Limit Error - for rate limiting
 */
export class RateLimitError extends BaseError {
  public readonly retryAfter: number;

  constructor(
    message = 'Rate limit exceeded',
    retryAfter: number,
    context: ErrorContext = {}
  ) {
    super(
      message,
      'RATE_LIMIT_EXCEEDED',
      429,
      { ...context, retryAfter },
      {},
      { severity: 'low', retryable: true }
    );

    this.retryAfter = retryAfter;
  }

  getUserMessage(): string {
    return `Request limit exceeded. Please try again in ${Math.ceil(this.retryAfter / 1000)} seconds.`;
  }

  getApiResponse() {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        details: {
          retryAfter: this.retryAfter,
        },
      },
      statusCode: this.statusCode,
    };
  }
}

/**
 * External Service Error - for third-party service failures
 */
export class ExternalServiceError extends BaseError {
  public readonly serviceName: string;

  constructor(
    serviceName: string,
    message: string,
    context: ErrorContext = {},
    options: {
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(
      message,
      'EXTERNAL_SERVICE_ERROR',
      options.statusCode ?? 502,
      { ...context, serviceName },
      {},
      {
        severity: 'high',
        retryable: options.retryable ?? true,
        cause: options.cause,
      }
    );

    this.serviceName = serviceName;
  }

  getUserMessage(): string {
    return 'A service is temporarily unavailable. Please try again later.';
  }
}

/**
 * Database Error - for database operation failures
 */
export class DatabaseError extends BaseError {
  public readonly operation: string;

  constructor(
    operation: string,
    message: string,
    context: ErrorContext = {},
    options: {
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      { ...context, operation },
      {},
      {
        severity: 'high',
        retryable: options.retryable ?? false,
        isOperational: false,
        cause: options.cause,
      }
    );

    this.operation = operation;
  }

  getUserMessage(): string {
    return 'A database error occurred. Please try again later.';
  }
}

/**
 * Configuration Error - for application configuration issues
 */
export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    configKey?: string,
    context: ErrorContext = {}
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      500,
      { ...context, configKey },
      {},
      {
        severity: 'critical',
        retryable: false,
        isOperational: false,
      }
    );
  }

  getUserMessage(): string {
    return 'A configuration error occurred. Please contact support.';
  }
}