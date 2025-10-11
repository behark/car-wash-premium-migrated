/**
 * Request Handler Utility
 * Provides a standardized way to handle API requests with error handling,
 * validation, and response formatting
 */

import { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { z } from 'zod';
import { getCorsHeaders, createOptionsResponse } from './cors';
import { createSuccessResponse, createErrorResponse } from './api-response';
import { handleError, HttpStatus, CommonErrors } from './error-handler';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface RequestHandlerConfig {
  /**
   * Allowed HTTP methods for this endpoint
   */
  allowedMethods: HttpMethod[];

  /**
   * Optional validation schemas
   */
  validation?: {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
    headers?: z.ZodSchema;
  };

  /**
   * Whether to require authentication
   */
  requireAuth?: boolean;

  /**
   * Custom CORS configuration
   */
  corsConfig?: {
    origins?: string[];
    credentials?: boolean;
    maxAge?: number;
  };

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface ParsedRequest<B = any, Q = any> {
  method: HttpMethod;
  body?: B;
  query?: Q;
  headers: Record<string, string>;
  path: string;
}

/**
 * Creates a standardized request handler with built-in error handling,
 * validation, and response formatting
 *
 * @param config - Handler configuration
 * @param handler - The actual handler function
 * @returns Netlify handler function
 */
export function createHandler<TBody = any, TQuery = any>(
  config: RequestHandlerConfig,
  handler: (request: ParsedRequest<TBody, TQuery>) => Promise<any>
): Handler {
  return async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
    const corsHeaders = getCorsHeaders(config.corsConfig);

    try {
      // Handle OPTIONS requests for CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return createOptionsResponse(corsHeaders);
      }

      // Check if method is allowed
      const method = event.httpMethod as HttpMethod;
      if (!config.allowedMethods.includes(method)) {
        throw CommonErrors.methodNotAllowed(method);
      }

      // Parse request
      const request: ParsedRequest<TBody, TQuery> = {
        method,
        headers: (event.headers || {}) as Record<string, string>,
        path: event.path,
      };

      // Validate and parse body if present and schema provided
      if (event.body && config.validation?.body) {
        try {
          const parsedBody = JSON.parse(event.body);
          request.body = config.validation.body.parse(parsedBody) as TBody;
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw CommonErrors.validation('Invalid JSON in request body');
          }
          throw error; // Re-throw for Zod errors to be caught by outer try-catch
        }
      } else if (event.body && !config.validation?.body) {
        // Parse body without validation if no schema provided
        try {
          request.body = JSON.parse(event.body) as TBody;
        } catch {
          request.body = event.body as any as TBody; // Use raw body if not JSON
        }
      }

      // Validate and parse query parameters if schema provided
      if (config.validation?.query) {
        request.query = config.validation.query.parse(event.queryStringParameters || {}) as TQuery;
      } else {
        request.query = event.queryStringParameters as any as TQuery;
      }

      // Validate headers if schema provided
      if (config.validation?.headers) {
        config.validation.headers.parse(event.headers || {});
      }

      // Check authentication if required
      if (config.requireAuth) {
        const authHeader = event.headers?.authorization;
        if (!authHeader) {
          throw CommonErrors.unauthorized();
        }
        // Add your authentication logic here
        // For now, we'll just check if the header exists
      }

      // Execute the handler
      const result = await handler(request);

      // Format successful response
      const response = createSuccessResponse(result);

      return {
        statusCode: HttpStatus.OK,
        headers: corsHeaders,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      // Handle errors
      const errorResponse = handleError(error);

      return {
        statusCode: errorResponse.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(errorResponse.body),
      };
    }
  };
}

/**
 * Creates a handler specifically for GET requests
 */
export function createGetHandler<TQuery = any>(
  config: Omit<RequestHandlerConfig, 'allowedMethods'> & {
    validation?: { query?: z.ZodSchema; headers?: z.ZodSchema };
  },
  handler: (request: ParsedRequest<never, TQuery>) => Promise<any>
): Handler {
  return createHandler(
    { ...config, allowedMethods: ['GET', 'OPTIONS'] },
    handler
  );
}

/**
 * Creates a handler specifically for POST requests
 */
export function createPostHandler<TBody = any, TQuery = any>(
  config: Omit<RequestHandlerConfig, 'allowedMethods'>,
  handler: (request: ParsedRequest<TBody, TQuery>) => Promise<any>
): Handler {
  return createHandler(
    { ...config, allowedMethods: ['POST', 'OPTIONS'] },
    handler
  );
}

/**
 * Creates a handler specifically for PUT requests
 */
export function createPutHandler<TBody = any, TQuery = any>(
  config: Omit<RequestHandlerConfig, 'allowedMethods'>,
  handler: (request: ParsedRequest<TBody, TQuery>) => Promise<any>
): Handler {
  return createHandler(
    { ...config, allowedMethods: ['PUT', 'OPTIONS'] },
    handler
  );
}

/**
 * Creates a handler specifically for DELETE requests
 */
export function createDeleteHandler<TQuery = any>(
  config: Omit<RequestHandlerConfig, 'allowedMethods'> & {
    validation?: { query?: z.ZodSchema; headers?: z.ZodSchema };
  },
  handler: (request: ParsedRequest<never, TQuery>) => Promise<any>
): Handler {
  return createHandler(
    { ...config, allowedMethods: ['DELETE', 'OPTIONS'] },
    handler
  );
}

/**
 * Creates a handler that supports multiple methods with different handlers
 */
export function createMultiMethodHandler(
  config: Omit<RequestHandlerConfig, 'allowedMethods'>,
  handlers: {
    GET?: (request: ParsedRequest) => Promise<any>;
    POST?: (request: ParsedRequest) => Promise<any>;
    PUT?: (request: ParsedRequest) => Promise<any>;
    PATCH?: (request: ParsedRequest) => Promise<any>;
    DELETE?: (request: ParsedRequest) => Promise<any>;
  }
): Handler {
  const allowedMethods: HttpMethod[] = ['OPTIONS'];
  if (handlers.GET) allowedMethods.push('GET');
  if (handlers.POST) allowedMethods.push('POST');
  if (handlers.PUT) allowedMethods.push('PUT');
  if (handlers.PATCH) allowedMethods.push('PATCH');
  if (handlers.DELETE) allowedMethods.push('DELETE');

  return createHandler(
    { ...config, allowedMethods },
    async (request) => {
      const handler = handlers[request.method as keyof typeof handlers];
      if (!handler) {
        throw CommonErrors.methodNotAllowed(request.method);
      }
      return handler(request);
    }
  );
}