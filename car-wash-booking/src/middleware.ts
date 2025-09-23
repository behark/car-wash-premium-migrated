import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security configuration
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Rate limiting configuration
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// Blocked paths and patterns
const BLOCKED_PATHS = [
  '/.env',
  '/.git',
  '/wp-admin',
  '/wp-login.php',
  '/.htaccess',
  '/xmlrpc.php',
  '/config.php',
  '/admin.php',
];

const BLOCKED_USER_AGENTS = [
  'bot',
  'crawler',
  'spider',
  'scraper',
  'curl',
  'wget',
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi,
  /(\b(OR|AND)\b\s*\d+\s*=\s*\d+)/gi,
  /(\'|\"|;|--|\/\*|\*\/)/g,
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]*onerror=/gi,
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const url = request.url;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';

  // Apply security headers
  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Block suspicious paths
  if (BLOCKED_PATHS.some(path => pathname.includes(path))) {
    return new NextResponse(null, { status: 404 });
  }

  // Block suspicious user agents
  if (BLOCKED_USER_AGENTS.some(agent => userAgent.toLowerCase().includes(agent))) {
    // Allow legitimate bots (Google, Bing, etc.)
    const legitimateBots = ['googlebot', 'bingbot', 'slurp', 'duckduckbot'];
    if (!legitimateBots.some(bot => userAgent.toLowerCase().includes(bot))) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // Check for SQL injection attempts
  const fullUrl = url + search;
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(fullUrl)) {
      console.error(`[Security] SQL injection attempt detected from ${ip}: ${fullUrl}`);
      return new NextResponse(null, { status: 400 });
    }
  }

  // Check for XSS attempts
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(fullUrl)) {
      console.error(`[Security] XSS attempt detected from ${ip}: ${fullUrl}`);
      return new NextResponse(null, { status: 400 });
    }
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const now = Date.now();
    const userKey = `${ip}:${pathname}`;

    const rateLimitData = rateLimitMap.get(userKey);

    if (rateLimitData) {
      if (now - rateLimitData.timestamp < RATE_LIMIT_WINDOW) {
        if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
          return new NextResponse(
            JSON.stringify({ error: 'Too many requests' }),
            {
              status: 429,
              headers: {
                'Retry-After': Math.ceil((RATE_LIMIT_WINDOW - (now - rateLimitData.timestamp)) / 1000).toString(),
                'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': new Date(rateLimitData.timestamp + RATE_LIMIT_WINDOW).toISOString(),
              }
            }
          );
        }
        rateLimitData.count++;
      } else {
        rateLimitMap.set(userKey, { count: 1, timestamp: now });
      }
    } else {
      rateLimitMap.set(userKey, { count: 1, timestamp: now });
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance on each request
      const cutoff = now - RATE_LIMIT_WINDOW * 2;
      for (const [key, data] of rateLimitMap.entries()) {
        if (data.timestamp < cutoff) {
          rateLimitMap.delete(key);
        }
      }
    }
  }

  // CORS handling for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['https://kiiltoloisto.fi'];

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }

  // Content Security Policy nonce for inline scripts
  if (pathname.endsWith('.html') || pathname === '/') {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    response.headers.set(
      'Content-Security-Policy',
      `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://www.google.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data: https://images.unsplash.com https://*.stripe.com;
        font-src 'self' data: https://fonts.gstatic.com;
        connect-src 'self' https://api.stripe.com;
        frame-src 'self' https://js.stripe.com https://www.google.com;
      `.replace(/\s+/g, ' ').trim()
    );
  }

  // Maintenance mode
  if (process.env.MAINTENANCE_MODE === 'true' && !pathname.startsWith('/admin')) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Maintenance</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            h1 {
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            p {
              font-size: 1.2rem;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔧 Huoltokatko</h1>
            <p>Sivusto on väliaikaisesti pois käytöstä huollon vuoksi.</p>
            <p>Palaamme pian takaisin!</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 503,
        headers: {
          'Content-Type': 'text/html',
          'Retry-After': '3600',
        },
      }
    );
  }

  return response;
}

// Configuration for which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};