import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*.trycloudflare.com'],
  poweredByHeader: false,
  async headers() {
    return [
      // ─── 1. GENERAL: HTML pages - no caching (dynamic content) ───
      // Security headers are handled by middleware (src/middleware.ts) and
      // SecurityHeadersManager (src/lib/security-headers.ts).  We only set
      // caching and CORS headers here to avoid conflicts with middleware.
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), tracking=(), local-fonts=()' },
          // Cross-Origin: MUST be cross-origin for tunnel/CDN setups
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          // Do NOT set Cross-Origin-Embedder-Policy – it breaks resource loading
          // Content Security Policy – permissive for Next.js to work
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' data: blob: https:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "media-src 'self'",
              "worker-src 'self' blob:",
            ].join('; '),
          },
          // Default: no-cache for HTML pages
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },

      // ─── 2. API routes - strict no-cache ───
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },

      // ─── 3. Static JS/CSS bundles - immutable caching ───
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },

      // ─── 4. Public images - cache with revalidation ───
      {
        source: '/(.*)\\.(png|jpg|jpeg|gif|svg|ico|webp)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // MUST be cross-origin for images loaded through tunnel/CDN
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
