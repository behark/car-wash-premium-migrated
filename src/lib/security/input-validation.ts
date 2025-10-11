import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Security utility for input validation and sanitization
 */

// Common regex patterns for validation
const patterns = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s]+$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
};

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li', 'ol'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize plain text input
 */
export function sanitizeText(text: string): string {
  // Remove any HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Remove any script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize and validate email
 */
export function sanitizeEmail(email: string): string | null {
  const sanitized = sanitizeText(email.toLowerCase());
  return patterns.email.test(sanitized) ? sanitized : null;
}

/**
 * Sanitize and validate phone number
 */
export function sanitizePhone(phone: string): string | null {
  const sanitized = sanitizeText(phone.replace(/\s/g, ''));
  return patterns.phone.test(sanitized) ? sanitized : null;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  const sanitized = sanitizeText(url);

  // Prevent javascript: and data: URLs
  if (sanitized.startsWith('javascript:') || sanitized.startsWith('data:')) {
    return null;
  }

  return patterns.url.test(sanitized) ? sanitized : null;
}

/**
 * Check if password meets security requirements
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Prevent SQL injection by escaping special characters
 */
export function escapeSql(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '\\0')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJson<T>(json: string, schema: z.ZodSchema<T>): T | null {
  try {
    const parsed = JSON.parse(json);
    const validated = schema.parse(parsed);
    return validated;
  } catch (error) {
    console.error('JSON validation error:', error);
    return null;
  }
}

// Zod schemas for common data types
export const schemas = {
  // User registration schema
  userRegistration: z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
    name: z.string().min(2).max(100).regex(/^[a-zA-Z\s]+$/),
    phone: z.string().optional(),
  }),

  // Booking schema
  booking: z.object({
    serviceId: z.number().int().positive(),
    date: z.string().datetime(),
    timeSlot: z.string(),
    customerName: z.string().min(2).max(100),
    customerEmail: z.string().email(),
    customerPhone: z.string(),
    vehicleInfo: z.object({
      make: z.string().max(50),
      model: z.string().max(50),
      licensePlate: z.string().max(20),
    }),
    notes: z.string().max(500).optional(),
  }),

  // Service schema
  service: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(1000),
    price: z.number().positive(),
    duration: z.number().int().positive(),
    category: z.string().max(50),
    active: z.boolean(),
  }),

  // Payment schema
  payment: z.object({
    amount: z.number().positive(),
    currency: z.enum(['EUR', 'USD', 'GBP']),
    paymentMethod: z.enum(['card', 'bank_transfer', 'cash']),
    bookingId: z.number().int().positive(),
  }),

  // Query parameters schema
  queryParams: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(100).optional(),
  }),
};

/**
 * Middleware helper for API route validation
 */
export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Rate limiting key generator (prevents bypass attempts)
 */
export function generateRateLimitKey(
  ip: string,
  userAgent: string | null,
  endpoint: string
): string {
  // Normalize IP (handle IPv6 and proxied IPs)
  const normalizedIp = ip.split(',')[0].trim().toLowerCase();

  // Create a composite key that's harder to bypass
  const components = [
    normalizedIp,
    userAgent ? userAgent.substring(0, 50) : 'unknown',
    endpoint,
  ];

  return components.join(':');
}

/**
 * Check for common attack patterns in request
 */
export function detectSuspiciousPatterns(input: string): {
  isSuspicious: boolean;
  patterns: string[];
} {
  const suspiciousPatterns = [
    // SQL Injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b.*\b(FROM|INTO|WHERE|TABLE)\b)/i,
    /(--|\||;|\/\*|\*\/|xp_|sp_|0x)/i,

    // XSS patterns
    /(<script|<iframe|javascript:|onerror=|onload=|alert\(|prompt\(|confirm\()/i,

    // Path traversal
    /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%c0%ae%c0%ae%c0%af)/i,

    // Command injection
    /(\||;|&|\$\(|`|\${|<\(|>\()/,

    // LDAP injection
    /(\*|\(|\)|\\|\/|,|=|\+|<|>|#|;|"|')/,

    // XML injection
    /(<\?xml|<!DOCTYPE|<!ENTITY|SYSTEM|PUBLIC)/i,
  ];

  const detectedPatterns: string[] = [];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source);
    }
  }

  return {
    isSuspicious: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: { name: string; size: number; type: string },
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { isValid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  // Check file extension
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `File extension ${extension} is not allowed`,
    };
  }

  // Check for double extensions (e.g., file.jpg.exe)
  const doubleExtPattern = /\.[^.]+\.[^.]+$/;
  if (doubleExtPattern.test(file.name)) {
    return {
      isValid: false,
      error: 'Files with double extensions are not allowed',
    };
  }

  return { isValid: true };
}