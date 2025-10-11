/**
 * Centralized Error Handler
 * Enterprise error processing, logging, monitoring, and response formatting
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { BaseError, ConfigurationError as _ConfigurationError } from './base-error';
import { logger } from '../logger';
import { trackError } from '../monitoring';

export interface ErrorHandlerOptions {
  enableStackTrace?: boolean;
  enableSentry?: boolean;
  enableMetrics?: boolean;
  customFormatters?: Map<string, (error: BaseError) => any>;
  onError?: (error: Error, context?: any) => void;
}

export interface ErrorMetrics {
  total: number;
  byType: Map<string, number>;
  byCode: Map<string, number>;
  bySeverity: Map<string, number>;
  recentErrors: Array<{
    timestamp: Date;
    type: string;
    code: string;
    message: string;
    correlationId?: string;
  }>;
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  component?: string;
  correlationId?: string;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Centralized error handler for consistent error processing
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private options: ErrorHandlerOptions;
  private metrics: ErrorMetrics;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      enableStackTrace: process.env.NODE_ENV === 'development',
      enableSentry: process.env.NODE_ENV === 'production',
      enableMetrics: true,
      ...options,
    };

    this.metrics = {
      total: 0,
      byType: new Map(),
      byCode: new Map(),
      bySeverity: new Map(),
      recentErrors: [],
    };
  }

  static getInstance(options?: ErrorHandlerOptions): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options);
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error in API routes
   */
  handleApiError(
    error: unknown,
    req: NextApiRequest,
    res: NextApiResponse,
    context: ErrorContext = {}
  ): void {
    const processedError = this.processError(error, {
      ...context,
      endpoint: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: this.getClientIp(req),
    });

    const response = this.formatApiResponse(processedError);

    // Set appropriate headers
    this.setResponseHeaders(res, processedError);

    // Send response
    res.status(response.statusCode).json(response.body);
  }

  /**
   * Handle error in application logic
   */
  handleApplicationError(error: unknown, context: ErrorContext = {}): BaseError {
    return this.processError(error, context);
  }

  /**
   * Handle unhandled errors and rejections
   */
  handleUnhandledError(
    error: unknown,
    type: 'uncaughtException' | 'unhandledRejection',
    context: ErrorContext = {}
  ): void {
    const processedError = this.processError(error, {
      ...context,
      severity: 'critical',
      operation: `unhandled_${type}`,
    });

    logger.error(`Unhandled ${type}`, {
      error: processedError.toJSON(),
      context,
    });

    // In production, gracefully shut down after logging
    if (process.env.NODE_ENV === 'production') {
      logger.error('Initiating graceful shutdown due to unhandled error');

      setTimeout(() => {
        process.exit(1);
      }, 5000); // Give 5 seconds for cleanup
    }
  }

  /**
   * Process and normalize error
   */
  private processError(error: unknown, context: ErrorContext = {}): BaseError {
    let processedError: BaseError;

    if (error instanceof BaseError) {
      processedError = error;

      // Add context if provided
      if (context.correlationId) {
        processedError.setCorrelationId(context.correlationId);
      }
      if (context.userId) {
        processedError.setUserId(context.userId);
      }
      if (context.operation) {
        processedError.setOperation(context.operation);
      }
    } else if (error instanceof Error) {
      processedError = this.convertStandardError(error, context);
    } else {
      processedError = this.convertUnknownError(error, context);
    }

    // Update metrics
    this.updateMetrics(processedError);

    // Log the error
    this.logError(processedError, context);

    // Send to monitoring services
    this.sendToMonitoring(processedError, context);

    // Call custom error handler if provided
    if (this.options.onError) {
      this.options.onError(processedError, context);
    }

    return processedError;
  }

  /**
   * Convert standard Error to BaseError
   */
  private convertStandardError(error: Error, context: ErrorContext): BaseError {
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return new (require('./base-error').ValidationError)(error.message, [], {
        originalError: error.name,
      });
    }

    if (error.name === 'PrismaClientKnownRequestError') {
      return this.convertPrismaError(error, context);
    }

    if (error.name === 'PrismaClientValidationError') {
      return new (require('./base-error').ValidationError)(
        'Database validation error',
        [{ field: 'database', message: error.message }],
        { originalError: error.name }
      );
    }

    if (error.name === 'JsonWebTokenError') {
      return new (require('./base-error').AuthenticationError)('Invalid authentication token', {
        originalError: error.name,
      });
    }

    if (error.name === 'TokenExpiredError') {
      return new (require('./base-error').AuthenticationError)('Authentication token expired', {
        originalError: error.name,
      });
    }

    // Default conversion
    return new (require('./base-error').BaseError)(
      error.message || 'An unexpected error occurred',
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name },
      context,
      {
        severity: 'high',
        isOperational: false,
        cause: error,
      }
    );
  }

  /**
   * Convert Prisma errors to domain errors
   */
  private convertPrismaError(error: any, _context: ErrorContext): BaseError {
    const { DatabaseError } = require('./base-error');

    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return new (require('./base-error').BusinessError)(
          'A record with this information already exists',
          'DUPLICATE_RECORD',
          { field: error.meta?.target, originalError: error.code }
        );

      case 'P2025': // Record not found
        return new (require('./base-error').NotFoundError)('Record', undefined, {
          originalError: error.code,
        });

      case 'P2003': // Foreign key constraint violation
        return new (require('./base-error').BusinessError)(
          'Referenced record does not exist',
          'INVALID_REFERENCE',
          { field: error.meta?.field_name, originalError: error.code }
        );

      case 'P2014': // Invalid ID
        return new (require('./base-error').ValidationError)(
          'Invalid ID provided',
          [{ field: 'id', message: 'Invalid format' }],
          { originalError: error.code }
        );

      default:
        return new DatabaseError(
          'database_operation',
          error.message,
          { originalError: error.code },
          { cause: error }
        );
    }
  }

  /**
   * Convert unknown error types
   */
  private convertUnknownError(error: unknown, context: ErrorContext): BaseError {
    const { BaseError } = require('./base-error');

    let message = 'An unknown error occurred';
    let errorData: any = {};

    if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        message = error.message;
      }
      errorData = { ...error };
    }

    return new BaseError(
      message,
      'UNKNOWN_ERROR',
      500,
      { ...errorData, errorType: typeof error },
      context,
      {
        severity: 'high',
        isOperational: false,
      }
    );
  }

  /**
   * Format error for API response
   */
  private formatApiResponse(error: BaseError): {
    statusCode: number;
    body: any;
  } {
    const { statusCode } = error.getApiResponse();

    // Check for custom formatter
    if (this.options.customFormatters?.has(error.code)) {
      const formatter = this.options.customFormatters.get(error.code)!;
      return {
        statusCode,
        body: formatter(error),
      };
    }

    // Default formatting
    const body: any = {
      success: false,
      error: {
        code: error.code,
        message: error.getUserMessage(),
      },
      timestamp: new Date().toISOString(),
    };

    // Add correlation ID for tracking
    if (error.metadata.correlationId) {
      body.correlationId = error.metadata.correlationId;
    }

    // Add details in development
    if (this.options.enableStackTrace) {
      body.error.details = error.context;
      body.error.stack = error.stack;
    }

    // Add retry information for retryable errors
    if (error.shouldRetry()) {
      body.error.retryable = true;

      if (error instanceof require('./base-error').RateLimitError) {
        // Using type assertion to tell TypeScript this property exists
        body.error.retryAfter = (error as any).retryAfter;
      }
    }

    return { statusCode, body };
  }

  /**
   * Set appropriate response headers
   */
  private setResponseHeaders(res: NextApiResponse, error: BaseError): void {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Rate limiting headers
    if (error instanceof require('./base-error').RateLimitError) {
      res.setHeader('Retry-After', String(Math.ceil((error as any).retryAfter / 1000)));
    }

    // Correlation ID for tracking
    if (error.metadata.correlationId) {
      res.setHeader('X-Correlation-ID', error.metadata.correlationId);
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: BaseError): void {
    if (!this.options.enableMetrics) return;

    this.metrics.total++;

    // By type
    const type = error.constructor.name;
    this.metrics.byType.set(type, (this.metrics.byType.get(type) || 0) + 1);

    // By code
    this.metrics.byCode.set(error.code, (this.metrics.byCode.get(error.code) || 0) + 1);

    // By severity
    this.metrics.bySeverity.set(
      error.severity,
      (this.metrics.bySeverity.get(error.severity) || 0) + 1
    );

    // Recent errors (keep last 100)
    this.metrics.recentErrors.push({
      timestamp: new Date(),
      type,
      code: error.code,
      message: error.message,
      correlationId: error.metadata.correlationId,
    });

    if (this.metrics.recentErrors.length > 100) {
      this.metrics.recentErrors.shift();
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: BaseError, context: ErrorContext): void {
    const logLevel = this.getLogLevel(error);
    const logData = {
      error: error.toJSON(),
      context,
      correlationId: error.metadata.correlationId,
    };

    logger[logLevel]('Error processed', logData);
  }

  /**
   * Send error to monitoring services
   */
  private sendToMonitoring(error: BaseError, context: ErrorContext): void {
    if (this.options.enableSentry && error.severity !== 'low') {
      try {
        trackError(error, {
          ...context,
          errorCode: error.code,
          errorType: error.constructor.name,
          correlationId: error.metadata.correlationId,
        });
      } catch (monitoringError) {
        logger.warn('Failed to send error to monitoring service', {
          error: monitoringError,
          originalError: error.code,
        });
      }
    }
  }

  /**
   * Get appropriate log level for error
   */
  private getLogLevel(error: BaseError): 'debug' | 'info' | 'warn' | 'error' {
    if (!error.isOperational) {
      return 'error';
    }

    switch (error.severity) {
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

  /**
   * Get client IP address
   */
  private getClientIp(req: NextApiRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return {
      total: this.metrics.total,
      byType: new Map(this.metrics.byType),
      byCode: new Map(this.metrics.byCode),
      bySeverity: new Map(this.metrics.bySeverity),
      recentErrors: [...this.metrics.recentErrors],
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.total = 0;
    this.metrics.byType.clear();
    this.metrics.byCode.clear();
    this.metrics.bySeverity.clear();
    this.metrics.recentErrors = [];
  }
}

/**
 * Global error handler middleware for API routes
 */
export function withErrorHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: ErrorHandlerOptions = {}
) {
  const errorHandler = ErrorHandler.getInstance(options);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler.handleApiError(error, req, res, {
        operation: `${req.method} ${req.url}`,
      });
    }
  };
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(options: ErrorHandlerOptions = {}): void {
  const errorHandler = ErrorHandler.getInstance(options);

  // Handle uncaught exceptions
  process.on('uncaughtException', error => {
    errorHandler.handleUnhandledError(error, 'uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', reason => {
    errorHandler.handleUnhandledError(reason, 'unhandledRejection');
  });

  logger.info('Global error handlers configured');
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
