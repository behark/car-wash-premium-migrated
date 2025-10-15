/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable standalone output for deployment
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'kiiltoloisto.fi' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: ['date-fns', 'lucide-react'],
  },

  // Production optimization
  compress: true,
};

module.exports = nextConfig;