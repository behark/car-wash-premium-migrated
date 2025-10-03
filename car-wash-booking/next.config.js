const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true, // Temporarily disabled to fix redirect loop issue
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 365 days
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-static',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 365 days
        }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /api\/.*$/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'apis',
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 10, // Fall back to cache if api does not response within 10 seconds
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Removed 'output: export' to enable API routes and server-side rendering
  // Required for booking system API endpoints and Netlify Functions
  images: {
    unoptimized: false, // Enable image optimization
  },
  // Temporarily disable custom headers for Netlify deployment debugging
  // async headers() {
  //   const csp = [
  //     "default-src 'self'",
  //     "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  //     "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  //     "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://images.pexels.com",
  //     "font-src 'self' data: https://fonts.gstatic.com",
  //     "connect-src 'self'",
  //     "frame-ancestors 'self'",
  //     "form-action 'self'",
  //     "base-uri 'self'"
  //   ].join('; ');
  //   return [
  //     {
  //       source: '/:path*',
  //       headers: [
  //         { key: 'Content-Security-Policy', value: csp },
  //         { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  //         { key: 'X-Content-Type-Options', value: 'nosniff' },
  //           { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  //           { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  //         { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  //         { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  //         { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  //         { key: 'X-DNS-Prefetch-Control', value: 'on' }
  //       ]
  //     },
  //     {
  //       source: '/_next/static/:path*',
  //       headers: [
  //         { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
  //       ]
  //     }
  //   ];
  // }
};

module.exports = withPWA(nextConfig);