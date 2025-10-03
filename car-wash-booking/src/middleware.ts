import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Minimal middleware to fix 403 error while maintaining basic security
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply basic security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Block only the most dangerous paths (no user agent blocking)
  const CRITICAL_BLOCKED_PATHS = [
    '/.env',
    '/.git/',
    '/wp-admin',
    '/wp-login.php',
    '/.htaccess',
  ];

  if (CRITICAL_BLOCKED_PATHS.some(path => pathname.includes(path))) {
    return new NextResponse(null, { status: 404 });
  }

  // Maintenance mode check (if enabled)
  if (process.env.MAINTENANCE_MODE === 'true' && !pathname.startsWith('/admin')) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Maintenance - Kiilto & Loisto</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { text-align: center; padding: 2rem; }
            h1 { font-size: 3rem; margin-bottom: 1rem; }
            p { font-size: 1.2rem; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔧 Huoltokatko</h1>
            <p>Sivusto on väliaikaisesti pois käytöstä huollon vuoksi.</p>
            <p>Palaamme pian takaisin!</p>
          </div>
        </body>
      </html>`,
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

// Only run middleware on specific paths to avoid conflicts
export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     * This prevents middleware from interfering with Netlify's serving
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|css|js)$).*)',
  ],
};