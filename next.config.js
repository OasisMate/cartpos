const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable in dev to avoid file generation and warnings
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 86400, // 24 hours
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apiCache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300, // 5 minutes
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
  buildExcludes: [/middleware-manifest\.json$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: Electron builds require special handling
  // Static export is not compatible with API routes
  // Electron setup is available but requires running Next.js as a server

  // Baseline security headers (safe defaults that don't break the app).
  // A strict Content-Security-Policy is intentionally deferred (needs per-page nonce work).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' }, // clickjacking
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)