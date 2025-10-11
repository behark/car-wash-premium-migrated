/**
 * CORS Configuration and Headers Management
 * Provides standardized CORS headers across all endpoints
 */

export interface CorsConfig {
  origins?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Default CORS configuration
 */
const defaultCorsConfig: CorsConfig = {
  origins: ['*'], // Allow all origins in development, restrict in production
  credentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * Gets standardized CORS headers
 * @param config - Optional CORS configuration overrides
 * @returns CORS headers object
 */
export function getCorsHeaders(config: CorsConfig = {}): Record<string, string> {
  const mergedConfig = { ...defaultCorsConfig, ...config };

  // Determine allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : mergedConfig.origins || ['*'];

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigins.join(', '),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Max-Age': String(mergedConfig.maxAge),
    'Content-Type': 'application/json',
  };

  if (mergedConfig.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Add security headers
  headers['X-Content-Type-Options'] = 'nosniff';
  headers['X-Frame-Options'] = 'DENY';
  headers['X-XSS-Protection'] = '1; mode=block';
  headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

  return headers;
}

/**
 * Creates an OPTIONS response for CORS preflight requests
 * @param headers - Optional headers to include
 * @returns OPTIONS response object
 */
export function createOptionsResponse(headers?: Record<string, string>) {
  return {
    statusCode: 204, // No Content is more appropriate for OPTIONS
    headers: headers || getCorsHeaders(),
    body: '',
  };
}

/**
 * Validates origin against allowed origins
 * @param origin - The origin to validate
 * @param allowedOrigins - List of allowed origins
 * @returns True if origin is allowed
 */
export function isOriginAllowed(origin: string, allowedOrigins: string[] = []): boolean {
  // If wildcard is present, allow all origins
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // Check if origin is in allowed list
  return allowedOrigins.includes(origin);
}

/**
 * Gets CORS headers with dynamic origin based on request
 * @param requestOrigin - The origin from the request headers
 * @param config - Optional CORS configuration
 * @returns CORS headers with appropriate origin
 */
export function getDynamicCorsHeaders(
  requestOrigin: string | undefined,
  config: CorsConfig = {}
): Record<string, string> {
  const headers = getCorsHeaders(config);

  // Get allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : config.origins || ['*'];

  // If specific origins are configured and request has an origin
  if (requestOrigin && !allowedOrigins.includes('*')) {
    if (isOriginAllowed(requestOrigin, allowedOrigins)) {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
      headers['Vary'] = 'Origin'; // Important for caching
    } else {
      // Don't set CORS header for disallowed origins
      delete headers['Access-Control-Allow-Origin'];
    }
  }

  return headers;
}