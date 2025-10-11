import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
// Use edge-compatible utilities for middleware
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `corr_${timestamp}_${random}`;
}

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

// Commented out unused function - can be enabled when needed
// function getClientIp(req: NextRequest): string {
//   const forwarded = req.headers.get('x-forwarded-for');
//   if (forwarded) {
//     return forwarded.split(',')[0].trim();
//   }

//   const realIp = req.headers.get('x-real-ip');
//   if (realIp) {
//     return realIp;
//   }

//   const cloudflareIp = req.headers.get('cf-connecting-ip');
//   if (cloudflareIp) {
//     return cloudflareIp;
//   }

//   return 'unknown';
// }

function extractUserInfo(req: NextRequest): { userId?: string; sessionId?: string } {
  try {
    const userIdHeader = req.headers.get('x-user-id');
    const sessionIdHeader = req.headers.get('x-session-id');

    const cookieUserId = req.cookies.get('user-id')?.value;
    const cookieSessionId = req.cookies.get('session-id')?.value ||
                          req.cookies.get('next-auth.session-token')?.value;

    return {
      userId: userIdHeader || cookieUserId,
      sessionId: sessionIdHeader || cookieSessionId,
    };
  } catch (error) {
    console.debug('Failed to extract user info', error);
    return {};
  }
}

// Enhanced middleware with comprehensive security features and correlation tracking
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate correlation and request IDs
  const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId();
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Apply comprehensive security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Add correlation and request tracking headers
  response.headers.set('X-Correlation-ID', correlationId);
  response.headers.set('X-Request-ID', requestId);

  // Log request for monitoring (Edge Runtime compatible)
  const { userId } = extractUserInfo(request);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[${correlationId}] ${request.method} ${pathname}${userId ? ` (user: ${userId})` : ''}`);
  }

  // Block dangerous paths and common attack vectors
  const CRITICAL_BLOCKED_PATHS = [
    '/.env',
    '/.git/',
    '/wp-admin',
    '/wp-login.php',
    '/.htaccess',
    '/config.json',
    '/.aws/',
    '/phpinfo.php',
    '/admin.php',
    '/.DS_Store',
  ];

  if (CRITICAL_BLOCKED_PATHS.some(path => pathname.includes(path))) {
    return new NextResponse(null, { status: 404 });
  }

  // Authentication check for admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/login';
        url.searchParams.set('callbackUrl', request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }

      // Verify admin role
      if ((token as any).role !== 'admin' && (token as any).role !== 'super_admin') {
        return new NextResponse(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Admin access required',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
    } catch (error) {
      console.error('Auth check error:', error);
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  // API Security: Check for suspicious payloads
  if (pathname.startsWith('/api/') && request.method !== 'GET') {
    const contentLength = request.headers.get('content-length');
    const maxPayloadSize = 10 * 1024 * 1024; // 10MB limit

    if (contentLength && parseInt(contentLength) > maxPayloadSize) {
      return new NextResponse(
        JSON.stringify({
          error: 'Payload Too Large',
          message: 'Request body exceeds maximum allowed size',
        }),
        {
          status: 413,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
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