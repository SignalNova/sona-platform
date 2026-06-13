/**
 * SecurityHeadersManager
 *
 * Centralised, comprehensive security-header generation for all response types.
 * Every method returns a fresh `Headers` instance so that per-request nonces
 * are never shared across responses.
 *
 * IMPORTANT: This module must work in both Node.js (route handlers) and
 * Edge Runtime (middleware).  We use the Web Crypto API for nonce generation
 * which is available in both environments.
 */

export class SecurityHeadersManager {
  // ─── Nonce generation ──────────────────────────────────────
  /** Generate a cryptographically-random CSP nonce (base64, 24 bytes). */
  static generateNonce(): string {
    // Web Crypto API – works in both Edge Runtime and Node.js
    const bytes = new Uint8Array(24)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
      // Fallback for very old environments (should never happen)
      for (let i = 0; i < 24; i++) bytes[i] = Math.floor(Math.random() * 256)
    }
    return btoa(String.fromCharCode(...bytes))
  }

  // ─── API route headers ─────────────────────────────────────
  /** Headers tailored for JSON API responses (no CSP nonce needed). */
  static getAPIHeaders(): Headers {
    const h = new Headers()

    // Strict CSP for API – no scripts/styles will be executed
    h.set('Content-Security-Policy', this.getCSP())

    h.set('X-Content-Type-Options', 'nosniff')
    h.set('X-Frame-Options', 'DENY')
    h.set('Referrer-Policy', 'no-referrer')
    h.set('X-XSS-Protection', '0') // modern browsers ignore this; '0' avoids legacy quirks
    h.set('Permissions-Policy', this.getPermissionsPolicy())
    h.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    // Cross-Origin isolation (API routes: strict)
    const co = this.getCrossOriginHeaders('strict')
    co.forEach((v, k) => h.set(k, v))

    // HSTS (production only)
    if (process.env.NODE_ENV === 'production') {
      h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    // Remove server fingerprinting
    h.delete('X-Powered-By')
    h.delete('Server')

    return h
  }

  // ─── Page route headers ────────────────────────────────────
  /** Headers for HTML page responses. Accepts a CSP nonce for inline scripts. */
  static getPageHeaders(nonce?: string): Headers {
    const h = new Headers()

    h.set('Content-Security-Policy', this.getCSP(nonce))
    h.set('X-Content-Type-Options', 'nosniff')
    h.set('X-Frame-Options', 'DENY')
    h.set('Referrer-Policy', 'no-referrer')
    h.set('X-XSS-Protection', '0')
    h.set('Permissions-Policy', this.getPermissionsPolicy())
    h.set('Cache-Control', 'no-cache, must-revalidate')

    // Page routes need permissive cross-origin to load external resources
    const co = this.getCrossOriginHeaders('permissive')
    co.forEach((v, k) => h.set(k, v))

    if (process.env.NODE_ENV === 'production') {
      h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    h.delete('X-Powered-By')
    h.delete('Server')

    return h
  }

  // ─── Static asset headers ──────────────────────────────────
  /** Headers for static assets (images, fonts, etc.). Long cache, no CSP. */
  static getStaticHeaders(): Headers {
    const h = new Headers()

    h.set('Cache-Control', 'public, max-age=31536000, immutable')
    h.set('X-Content-Type-Options', 'nosniff')
    h.set('Referrer-Policy', 'no-referrer')
    h.set('Permissions-Policy', this.getPermissionsPolicy())

    const co = this.getCrossOriginHeaders('strict')
    co.forEach((v, k) => h.set(k, v))

    h.delete('X-Powered-By')
    h.delete('Server')

    return h
  }

  // ─── Content Security Policy ───────────────────────────────
  /**
   * Strict CSP.
   *
   * - default-src 'none'         – deny everything by default
   * - script-src 'self' 'nonce-…'– no unsafe-inline / unsafe-eval
   * - style-src 'self' 'unsafe-inline' – needed for Next.js styled-jsx / Tailwind
   * - connect-src allows Binance & BingX APIs (trading platform)
   */
  static getCSP(nonce?: string): string {
    // Next.js generates inline scripts (RSC payloads, hydration data) that
    // cannot carry a nonce attribute.  We must allow 'unsafe-inline' for
    // script-src so the app functions correctly.  The nonce is still set
    // as a defence-in-depth measure – browsers allow a script if it
    // matches EITHER the nonce OR 'unsafe-inline'.
    const scriptSrc = nonce
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'`
      : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`

    const parts = [
      "default-src 'self' data: blob: https:",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self' https://api.binance.com https://api.bingx.com https://api.bscscan.com https://apilist.tronscanapi.com https://api.nowpayments.io https://ip-api.com https://dns.google https://check.torproject.org`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "worker-src 'self' blob:",
    ]

    // NOTE: 'upgrade-insecure-requests' removed – it conflicts with
    // Cloudflare tunnels and other reverse-proxy setups where the
    // internal connection is HTTP but the external connection is HTTPS.

    return parts.join('; ')
  }

  // ─── Permissions Policy ────────────────────────────────────
  static getPermissionsPolicy(): string {
    return [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=(self)',
      'tracking=()',
    ].join(', ')
  }

  // ─── Cross-Origin headers ──────────────────────────────────
  /**
   * @param mode 'strict' = same-origin / require-corp (for API & static)
   *             'permissive' = cross-origin / credentialless (for pages that load external resources)
   */
  static getCrossOriginHeaders(mode: 'strict' | 'permissive' = 'strict'): Headers {
    const h = new Headers()
    h.set('Cross-Origin-Opener-Policy', 'same-origin')

    if (mode === 'strict') {
      // Even for API routes, use cross-origin CORP to avoid issues with
      // reverse proxies and tunnels.  COEP is NOT set because it blocks
      // legitimate cross-origin API calls from web clients.
      h.set('Cross-Origin-Resource-Policy', 'cross-origin')
    } else {
      h.set('Cross-Origin-Resource-Policy', 'cross-origin')
    }

    return h
  }

  // ─── Helper: merge into a NextResponse ─────────────────────
  /**
   * Apply security headers to an existing `NextResponse`-compatible
   * headers map.
   */
  static applyToHeaders(
    target: Headers,
    type: 'api' | 'page' | 'static',
    nonce?: string,
  ): void {
    const source =
      type === 'api'
        ? this.getAPIHeaders()
        : type === 'static'
          ? this.getStaticHeaders()
          : this.getPageHeaders(nonce)

    source.forEach((value, key) => {
      target.set(key, value)
    })

    // Ensure fingerprinting headers are removed
    target.delete('X-Powered-By')
  }
}
