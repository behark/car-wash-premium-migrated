/**
 * Input Sanitization and XSS Protection
 * Provides comprehensive sanitization for user inputs
 */

// HTML entities that need escaping
const HTML_ENTITIES: { [key: string]: string } = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

// Dangerous HTML tags and attributes
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
  'style',
  'form',
  'input',
  'button',
];

const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onmouseout',
  'onkeydown',
  'onkeyup',
  'javascript:',
  'data:text/html',
];

// SQL injection patterns
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|DECLARE|FETCH|CURSOR)\b)/gi,
  /(\b(OR|AND)\b\s*(['"]?)[\w\s]*\1\s*=\s*\1[\w\s]*\1)/gi,
  /(;|\-\-|\/\*|\*\/|xp_|sp_|0x)/gi,
];

// NoSQL injection patterns
const NOSQL_PATTERNS = [
  /(\$\w+)/g,  // MongoDB operators
  /(\{[^}]*\})/g,  // JSON objects
  /(\[[^\]]*\])/g,  // Arrays
];

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';

  return str.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from string
 */
export function stripHtml(str: string): string {
  if (typeof str !== 'string') return '';

  // Remove all HTML tags
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize HTML content (allow safe tags only)
 */
export function sanitizeHtml(html: string, allowedTags: string[] = []): string {
  if (typeof html !== 'string') return '';

  // Default allowed tags
  const safeTags = allowedTags.length > 0 ? allowedTags : ['p', 'br', 'strong', 'em', 'u', 'span'];

  // Remove dangerous tags
  let sanitized = html;
  DANGEROUS_TAGS.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  // Remove dangerous attributes
  DANGEROUS_ATTRIBUTES.forEach(attr => {
    const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  // Remove tags not in allowed list
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitized = sanitized.replace(tagRegex, (match, tag) => {
    return safeTags.includes(tag.toLowerCase()) ? match : '';
  });

  return sanitized;
}

/**
 * Sanitize SQL input
 */
export function sanitizeSql(input: string): string {
  if (typeof input !== 'string') return '';

  let sanitized = input;

  // Check for SQL injection patterns
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(sanitized)) {
      // Log potential SQL injection attempt
      console.warn('[Security] Potential SQL injection detected:', input);
      // Remove suspicious patterns
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // Escape single quotes
  sanitized = sanitized.replace(/'/g, "''");

  return sanitized;
}

/**
 * Sanitize NoSQL input
 */
export function sanitizeNoSql(input: any): any {
  if (typeof input === 'string') {
    // Remove MongoDB operators
    let sanitized = input;
    for (const pattern of NOSQL_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }
    return sanitized;
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = Array.isArray(input) ? [] : {};

    for (const key in input) {
      // Skip keys starting with $ (MongoDB operators)
      if (key.startsWith('$')) {
        console.warn('[Security] Potential NoSQL injection detected:', key);
        continue;
      }

      sanitized[key] = sanitizeNoSql(input[key]);
    }

    return sanitized;
  }

  return input;
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== 'string') return '';

  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '');

  // Remove special characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    sanitized = sanitized.substring(0, 250) + '.' + ext;
  }

  return sanitized;
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);

    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    // Remove javascript: and data: URLs
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return '';
    }

    return url;
  } catch {
    return '';
  }
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';

  // Basic email validation and sanitization
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const trimmed = email.trim().toLowerCase();

  if (!emailRegex.test(trimmed)) {
    return '';
  }

  // Remove any HTML or script tags
  return stripHtml(trimmed);
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';

  // Remove all non-numeric characters except + for country code
  return phone.replace(/[^0-9+]/g, '');
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson(jsonString: string): object | null {
  if (typeof jsonString !== 'string') return null;

  try {
    // Parse JSON
    const parsed = JSON.parse(jsonString);

    // Recursively sanitize the parsed object
    return sanitizeObject(parsed);
  } catch {
    return null;
  }
}

/**
 * Recursively sanitize an object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};

    for (const key in obj) {
      // Sanitize the key
      const sanitizedKey = escapeHtml(key);

      // Skip dangerous keys
      if (sanitizedKey.startsWith('__') || sanitizedKey.startsWith('constructor')) {
        continue;
      }

      // Recursively sanitize the value
      sanitized[sanitizedKey] = sanitizeObject(obj[key]);
    }

    return sanitized;
  }

  return obj;
}

/**
 * Create a sanitized copy of request body
 */
export function sanitizeRequestBody(body: any): any {
  if (!body) return {};

  const sanitized: any = {};

  for (const key in body) {
    const value = body[key];

    // Skip prototype properties
    if (!body.hasOwnProperty(key)) {
      continue;
    }

    // Sanitize based on key name
    if (key.toLowerCase().includes('email')) {
      sanitized[key] = sanitizeEmail(value);
    } else if (key.toLowerCase().includes('phone')) {
      sanitized[key] = sanitizePhone(value);
    } else if (key.toLowerCase().includes('url')) {
      sanitized[key] = sanitizeUrl(value);
    } else if (key.toLowerCase().includes('html')) {
      sanitized[key] = sanitizeHtml(value);
    } else if (typeof value === 'string') {
      sanitized[key] = escapeHtml(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Rate limit key sanitization
 */
export function sanitizeRateLimitKey(key: string): string {
  if (typeof key !== 'string') return '';

  // Remove special characters that could be used for Redis injection
  return key.replace(/[^a-zA-Z0-9:._-]/g, '');
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') return '';

  // Remove SQL and NoSQL patterns
  let sanitized = sanitizeSql(query);
  sanitized = sanitizeNoSql(sanitized) as string;

  // Remove special characters used in search engines
  sanitized = sanitized.replace(/[*?~^]/g, '');

  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized.trim();
}

/**
 * Check if input contains malicious patterns
 */
export function isMalicious(input: string): boolean {
  if (typeof input !== 'string') return false;

  // Check for SQL injection
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check for XSS
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check for path traversal
  if (input.includes('../') || input.includes('..\\')) {
    return true;
  }

  return false;
}

// Export all sanitization functions
const sanitizerUtils = {
  escapeHtml,
  stripHtml,
  sanitizeHtml,
  sanitizeSql,
  sanitizeNoSql,
  sanitizeFileName,
  sanitizeUrl,
  sanitizeEmail,
  sanitizePhone,
  sanitizeJson,
  sanitizeObject,
  sanitizeRequestBody,
  sanitizeRateLimitKey,
  sanitizeSearchQuery,
  isMalicious,
};

export default sanitizerUtils;