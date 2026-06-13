import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { SecurityHeadersManager } from '@/lib/security-headers'
import { DBRateLimiter, RATE_LIMITS } from '@/lib/db-rate-limiter'

/**
 * GET /api/security/headers-test
 *
 * Admin-only endpoint that returns the current security headers
 * configuration for verification / testing purposes.
 */
export async function GET(request: NextRequest) {
  try {
    // === Auth check – admin only ===
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    if (authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'وصول مرفوض. مسؤولون فقط.' }, { status: 403 })
    }

    // === Collect all security header configurations ===
    const nonce = SecurityHeadersManager.generateNonce()

    const apiHeaders: Record<string, string> = {}
    SecurityHeadersManager.getAPIHeaders().forEach((v, k) => { apiHeaders[k] = v })

    const pageHeaders: Record<string, string> = {}
    SecurityHeadersManager.getPageHeaders(nonce).forEach((v, k) => { pageHeaders[k] = v })

    const staticHeaders: Record<string, string> = {}
    SecurityHeadersManager.getStaticHeaders().forEach((v, k) => { staticHeaders[k] = v })

    const strictCOHeaders: Record<string, string> = {}
    SecurityHeadersManager.getCrossOriginHeaders('strict').forEach((v, k) => { strictCOHeaders[k] = v })

    const permissiveCOHeaders: Record<string, string> = {}
    SecurityHeadersManager.getCrossOriginHeaders('permissive').forEach((v, k) => { permissiveCOHeaders[k] = v })

    // === Collect rate limit configurations ===
    const rateLimitConfigs = Object.fromEntries(
      Object.entries(RATE_LIMITS).map(([key, cfg]) => [
        key,
        {
          action: cfg.action,
          maxAttempts: cfg.maxAttempts,
          windowMs: cfg.windowMs,
          windowHuman: formatDuration(cfg.windowMs),
        },
      ])
    )

    // === Build response ===
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      nonce,
      headers: {
        api: apiHeaders,
        page: pageHeaders,
        static: staticHeaders,
      },
      csp: {
        strict: SecurityHeadersManager.getCSP(),
        withNonce: SecurityHeadersManager.getCSP(nonce),
      },
      permissionsPolicy: SecurityHeadersManager.getPermissionsPolicy(),
      crossOrigin: {
        strict: strictCOHeaders,
        permissive: permissiveCOHeaders,
      },
      rateLimits: rateLimitConfigs,
    })
  } catch (error) {
    console.error('Security headers test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return `${hours}h`
}
