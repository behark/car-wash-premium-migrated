/**
 * Centralized Error Handling Utilities
 * Provides consistent error handling and logging across all endpoints
 */

import { ZodError, ZodIssue } from 'zod';
import { ErrorCodes, createErrorResponse, ErrorResponse } from './api-response';

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * HTTP Status Codes mapping
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Maps error types to appropriate HTTP status codes and error codes
 * @param error - The error to handle
 * @returns Object containing status code and error response
 */
export function handleError(error: any): {
  statusCode: number;
  body: ErrorResponse;
} {
  // Log error for debugging (sanitized in production)
  logError(error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      body: createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Validation failed',
        formatZodErrors(error)
      ),
    };
  }

  // Handle custom API errors
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: createErrorResponse(error.code, error.message, error.details),
    };
  }

  // Handle Prisma errors
  if (error.code && error.code.startsWith('P')) {
    return handlePrismaError(error);
  }

  // Handle specific error messages
  if (error.message) {
    const messageHandlers: Record<string, { status: number; code: string }> = {
      'Service not found': { status: HttpStatus.NOT_FOUND, code: ErrorCodes.NOT_FOUND },
      'Booking not found': { status: HttpStatus.NOT_FOUND, code: ErrorCodes.NOT_FOUND },
      'Time slot is not available': { status: HttpStatus.CONFLICT, code: ErrorCodes.CONFLICT },
      'Method not allowed': {
        status: HttpStatus.METHOD_NOT_ALLOWED,
        code: ErrorCodes.METHOD_NOT_ALLOWED,
      },
      'Unauthorized': { status: HttpStatus.UNAUTHORIZED, code: ErrorCodes.UNAUTHORIZED },
      'Forbidden': { status: HttpStatus.FORBIDDEN, code: ErrorCodes.FORBIDDEN },
    };

    for (const [message, handler] of Object.entries(messageHandlers)) {
      if (error.message.includes(message)) {
        return {
          statusCode: handler.status,
          body: createErrorResponse(handler.code, error.message),
        };
      }
    }
  }

  // Default error response
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    body: createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message || 'Internal server error',
      process.env.NODE_ENV === 'production' ? undefined : error.stack
    ),
  };
}

/**
 * Handles Prisma-specific errors
 * @param error - Prisma error object
 * @returns Formatted error response
 */
function handlePrismaError(error: any): {
  statusCode: number;
  body: ErrorResponse;
} {
  const prismaErrorMap: Record<string, { status: number; code: string; message: string }> = {
    P2002: {
      status: HttpStatus.CONFLICT,
      code: ErrorCodes.CONFLICT,
      message: 'A record with this value already exists',
    },
    P2025: {
      status: HttpStatus.NOT_FOUND,
      code: ErrorCodes.NOT_FOUND,
      message: 'Record not found',
    },
    P2003: {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCodes.INVALID_INPUT,
      message: 'Invalid reference: related record does not exist',
    },
    P2000: {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCodes.INVALID_INPUT,
      message: 'Value too long for column',
    },
  };

  const errorMapping = prismaErrorMap[error.code];
  if (errorMapping) {
    return {
      statusCode: errorMapping.status,
      body: createErrorResponse(
        errorMapping.code,
        errorMapping.message,
        error.meta
      ),
    };
  }

  // Generic database error
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    body: createErrorResponse(
      ErrorCodes.DATABASE_ERROR,
      'Database operation failed',
      process.env.NODE_ENV === 'production' ? undefined : error
    ),
  };
}

/**
 * Formats Zod validation errors for API response
 * @param error - ZodError instance
 * @returns Formatted validation errors
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  const errors = (error as any).errors || [];
  errors.forEach((err: ZodIssue) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
}

/**
 * Logs errors with appropriate detail level based on environment
 * @param error - Error to log
 */
function logError(error: any): void {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';

  if (environment === 'production') {
    // In production, log minimal error info
    console.error(JSON.stringify({
      timestamp,
      level: 'error',
      message: error.message || 'Unknown error',
      code: error.code,
      name: error.name,
    }));
  } else {
    // In development, log full error details
    console.error('🔴 Error occurred:', {
      timestamp,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error,
      },
    });
  }
}

/**
 * Creates standardized error responses for common scenarios
 */
export const CommonErrors = {
  notFound: (resource: string) =>
    new ApiError(
      ErrorCodes.NOT_FOUND,
      `${resource} not found`,
      HttpStatus.NOT_FOUND
    ),

  unauthorized: (message = 'Authentication required') =>
    new ApiError(
      ErrorCodes.UNAUTHORIZED,
      message,
      HttpStatus.UNAUTHORIZED
    ),

  forbidden: (message = 'Access denied') =>
    new ApiError(
      ErrorCodes.FORBIDDEN,
      message,
      HttpStatus.FORBIDDEN
    ),

  validation: (message: string, details?: any) =>
    new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      message,
      HttpStatus.BAD_REQUEST,
      details
    ),

  conflict: (message: string) =>
    new ApiError(
      ErrorCodes.CONFLICT,
      message,
      HttpStatus.CONFLICT
    ),

  methodNotAllowed: (method: string) =>
    new ApiError(
      ErrorCodes.METHOD_NOT_ALLOWED,
      `Method ${method} is not allowed`,
      HttpStatus.METHOD_NOT_ALLOWED
    ),

  internal: (message = 'Internal server error') =>
    new ApiError(
      ErrorCodes.INTERNAL_ERROR,
      message,
      HttpStatus.INTERNAL_SERVER_ERROR
    ),
};