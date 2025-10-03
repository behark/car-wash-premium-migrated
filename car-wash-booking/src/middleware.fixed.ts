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

// Only block known malicious bots - FIXED: Removed generic terms
const BLOCKED_USER_AGENTS = [
  'masscan',
  'python-requests',
  'nikto',
  'sqlmap',
  'havij',
  'acunetix',
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

  // Skip middleware for static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname.includes('.') // Skip files with extensions
  ) {
    return NextResponse.next();
  }

  // Apply security headers
  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Block suspicious paths
  if (BLOCKED_PATHS.some(path => pathname.includes(path))) {
    return new NextResponse(null, { status: 404 });
  }

  // Block suspicious user agents - FIXED: Added more legitimate bots
  if (BLOCKED_USER_AGENTS.some(agent => userAgent.toLowerCase().includes(agent))) {
    // Expanded whitelist for legitimate bots
    const legitimateBots = [
      'googlebot', 'bingbot', 'slurp', 'duckduckbot',
      'netlify', 'vercel', 'lighthouse', 'gtmetrix',
      'pingdom', 'uptime', 'statuscake', 'newrelic',
      'facebookexternalhit', 'twitterbot', 'linkedinbot',
      'whatsapp', 'telegram', 'discord', 'slack'
    ];

    const isLegitimate = legitimateBots.some(bot => userAgent.toLowerCase().includes(bot));

    if (!isLegitimate) {
      console.log(`[Security] Blocked suspicious bot: ${userAgent} from ${ip}`);
      return new NextResponse(null, { status: 403 });
    }
  }

  // Check for SQL injection attempts - only on URLs with query params
  if (search) {
    const fullUrl = url + search;
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(fullUrl)) {
        console.error(`[Security] SQL injection attempt detected from ${ip}: ${fullUrl}`);
        return new NextResponse(null, { status: 400 });
      }
    }
  }

  // Check for XSS attempts - only on URLs with query params
  if (search) {
    const fullUrl = url + search;
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(fullUrl)) {
        console.error(`[Security] XSS attempt detected from ${ip}: ${fullUrl}`);
        return new NextResponse(null, { status: 400 });
      }
    }
  }

  // Rate limiting for API routes only
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
                'Content-Type': 'application/json',
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
    const allowedOrigins = [
      'https://kiiltoloisto.fi',
      'https://www.kiiltoloisto.fi',
      'http://localhost:3000',
      'http://localhost:8888'
    ];

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

  // REMOVED CSP - Now handled at Netlify level to prevent conflicts
  // CSP was causing issues with Netlify's CDN and deployment verification

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

// Configuration for which paths the middleware should run on - FIXED: More specific matching
export const config = {
  matcher: [
    // Only run on API routes and dynamic pages
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|icons|images|manifest.json|robots.txt|sitemap.xml|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|eot|css|js)$).*)',
  ],
};