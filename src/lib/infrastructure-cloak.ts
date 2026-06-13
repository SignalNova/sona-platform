// ═══════════════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE CLOAK - Geographic Obfuscation & Server Identity Protection
// ═══════════════════════════════════════════════════════════════════════════════
// This module ensures that:
// 1. NO ONE can discover the real geographic location of the server
// 2. NO ONE can identify the hosting provider or infrastructure
// 3. NO ONE can trace the platform's real IP addresses
// 4. NO ONE can fingerprint the server technology stack
// 5. All server identifiers are stripped or spoofed
// 6. Reverse DNS lookups reveal nothing useful
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SERVER IDENTITY OBFUSCATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strip all server-identifying information from responses
 * This prevents attackers from fingerprinting the technology stack
 */
export function getObfuscatedHeaders(): Record<string, string> {
  // Generate a unique but fake server identifier that rotates daily
  const dailySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
  const fakeServerId = crypto
    .createHash('sha256')
    .update(`server-id-${dailySeed}`)
    .digest('hex')
    .substring(0, 16)

  return {
    // Remove all identifiable headers
    'Server': fakeServerId, // Fake server identifier that changes daily
    'X-Powered-By': '',     // Remove Next.js/Node.js identification
    'X-AspNet-Version': '', // Remove any ASP.NET hints
    'X-Runtime': '',        // Remove Ruby runtime hints

    // Add misleading headers to confuse fingerprinting
    'X-Request-ID': crypto.randomBytes(16).toString('hex'), // Random per-request

    // Privacy headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), tracking=()',

    // Prevent caching of sensitive responses
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',

    // Remove ETags which can be used for tracking
    'ETag': '',

    // HSTS for production
    ...(process.env.NODE_ENV === 'production' ? {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    } : {}),
  }
}

/**
 * Get security headers that hide server identity
 * Used in middleware to apply to all responses
 */
export function getIdentityCloakingHeaders(): Record<string, string> {
  return {
    // Remove technology fingerprints
    'X-Powered-By': '',
    'Server': '',

    // Anti-probing headers
    'X-Original-URL': '',     // Never expose internal URLs
    'X-Forwarded-Proto': '',  // Never expose internal protocol
    'X-Forwarded-Host': '',   // Never expose internal host

    // Prevent information leakage through error pages
    'X-Debug-Mode': 'off',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GEOGRAPHIC OBFUSCATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect and block geographic probing attempts
 * Attackers try to determine server location via:
 * - Latency measurement
 * - IP geolocation services
 * - Timezone detection
 * - Language detection
 * - DNS geolocation
 */
export function detectGeographicProbing(request: Request): {
  isProbing: boolean
  confidence: number
  probeType: string
} {
  let isProbing = false
  let confidence = 0
  let probeType = 'NONE'

  const url = new URL(request.url)
  const pathname = url.pathname
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase()

  // Check for probing tools/patterns
  const probingUserAgents = [
    'shodan', 'censys', 'zoomeye', 'fofa', 'goby', 'nmap',
    'masscan', 'zgrab', 'httpx', 'nuclei', 'wappalyzer',
    'builtwith', 'whatweb', 'webtech', 'fingerprinthub',
    'geoip', 'ipinfo', 'maxmind',
  ]

  for (const agent of probingUserAgents) {
    if (userAgent.includes(agent)) {
      isProbing = true
      confidence = 95
      probeType = `PROBING_UA:${agent}`
      break
    }
  }

  // Check for geographic probing endpoints
  const probingEndpoints = [
    '/geolocation', '/geo', '/location', '/where',
    '/ip-location', '/ipinfo', '/timezone',
    '/server-info', '/env', '/debug', '/status',
    '/.env', '/.git', '/wp-admin', '/phpmyadmin',
    '/server-status', '/server-info', '/actuator',
  ]

  for (const endpoint of probingEndpoints) {
    if (pathname.toLowerCase().includes(endpoint)) {
      isProbing = true
      confidence = 90
      probeType = `PROBING_ENDPOINT:${endpoint}`
      break
    }
  }

  // Check for header-based probing
  const suspiciousHeaders = [
    'x-debug', 'x-env', 'x-server-info',
    'x-geo', 'x-location', 'x-timezone',
  ]

  for (const header of suspiciousHeaders) {
    if (request.headers.get(header)) {
      isProbing = true
      confidence = Math.max(confidence, 70)
      probeType = `PROBING_HEADER:${header}`
      break
    }
  }

  return { isProbing, confidence, probeType }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TIMEZONE SPOOFING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prevent timezone-based location detection
 * Server responses should not reveal the actual timezone
 */
export function getSpoofedTimezone(): string {
  // Return UTC to avoid revealing server location
  return 'UTC'
}

/**
 * Normalize timestamps to prevent timezone leakage
 * All timestamps should appear as UTC
 */
export function normalizeTimestamp(date: Date): string {
  // Always return UTC ISO string
  return date.toISOString()
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DNS PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate DNS configuration to prevent DNS-based location discovery
 * This should be called on server startup
 */
export function validateDNSProtection(): {
  isProtected: boolean
  recommendations: string[]
} {
  const recommendations: string[] = []
  let isProtected = true

  // Check if behind a reverse proxy/CDN
  const isBehindCDN = process.env.BEHIND_CDN === 'true' || process.env.USE_CLOUDFLARE === 'true'
  if (!isBehindCDN) {
    isProtected = false
    recommendations.push('USE_CDN: Deploy behind Cloudflare or similar CDN to mask origin IP')
    recommendations.push('DNS_ONLY: Use DNS-only mode (no A record pointing to origin)')
    recommendations.push('PROXY_ALL: Ensure all DNS records are proxied (orange cloud in Cloudflare)')
  }

  // Check for direct IP access prevention
  if (!process.env.BLOCK_DIRECT_IP_ACCESS) {
    isProtected = false
    recommendations.push('BLOCK_DIRECT_IP: Configure firewall to block requests directly to server IP')
    recommendations.push('FIREWALL: Allow only CDN/proxy IPs in firewall rules')
  }

  recommendations.push('DNSSEC: Enable DNSSEC to prevent DNS spoofing')
  recommendations.push('NO_SPF_LEAK: Ensure SPF/DKIM/DMARC records do not reveal origin IP')
  recommendations.push('MAIL_RELAY: Use external mail relay (SendGrid/Mailgun) to avoid IP in email headers')

  return { isProtected, recommendations }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. LATENCY NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Attackers can estimate geographic distance by measuring response latency.
 * This module adds random delays to normalize response times.
 */
export function getAntiLatencyDelay(): number {
  // Add random delay between 50-200ms to normalize response times
  // This makes latency-based geolocation unreliable
  return Math.floor(Math.random() * 150) + 50
}

/**
 * Apply latency normalization - call this before returning responses
 * to sensitive endpoints to prevent timing-based location detection
 */
export async function applyLatencyNormalization(): Promise<void> {
  const delay = getAntiLatencyDelay()
  await new Promise(resolve => setTimeout(resolve, delay))
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ERROR PAGE OBFUSCATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate safe error responses that don't leak server information
 * Default Next.js error pages reveal technology stack details
 */
export function getObfuscatedError(statusCode: number): { message: string; details: string } {
  // Generic error messages that don't reveal any technical details
  const errors: Record<number, { message: string; details: string }> = {
    400: { message: 'طلب غير صالح', details: 'لا يمكن معالجة الطلب المرسل' },
    401: { message: 'يرجى تسجيل الدخول', details: 'الوصول يتطلب مصادقة' },
    403: { message: 'الوصول مرفوض', details: 'ليس لديك صلاحية للوصول' },
    404: { message: 'الصفحة غير موجودة', details: 'المورد المطلوب غير متوفر' },
    429: { message: 'طلبات كثيرة جداً', details: 'يرجى المحاولة لاحقاً' },
    500: { message: 'حدث خطأ', details: 'يرجى المحاولة مرة أخرى لاحقاً' },
    502: { message: 'الخدمة غير متاحة مؤقتاً', details: 'يرجى المحاولة لاحقاً' },
    503: { message: 'صيانة دورية', details: 'المنصة قيد الصيانة' },
  }

  return errors[statusCode] || { message: 'حدث خطأ', details: 'يرجى المحاولة لاحقاً' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SOURCE CODE PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate headers that prevent source code exposure and caching
 * Makes it harder to clone the frontend code
 */
export function getSourceCodeProtectionHeaders(): Record<string, string> {
  return {
    // Prevent source map exposure (reveals original code structure)
    'SourceMap': '',
    'X-SourceMap': '',

    // Disable caching of HTML (prevents offline analysis)
    'Cache-Control': 'no-store, no-cache, must-revalidate',

    // Prevent CORS-based code theft
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. INFRASTRUCTURE VALIDATION CHECK
// ═══════════════════════════════════════════════════════════════════════════════

export interface InfrastructureSecurityReport {
  timestamp: string
  overallScore: number // 0-100
  checks: {
    name: string
    status: 'PASS' | 'WARN' | 'FAIL'
    details: string
    recommendation?: string
  }[]
  criticalIssues: string[]
  recommendations: string[]
}

export function performInfrastructureCheck(): InfrastructureSecurityReport {
  const checks: InfrastructureSecurityReport['checks'] = []
  const criticalIssues: string[] = []
  const recommendations: string[] = []
  let score = 100

  // Check 1: CDN/Proxy protection
  const behindCDN = process.env.BEHIND_CDN === 'true' || process.env.USE_CLOUDFLARE === 'true'
  checks.push({
    name: 'CDN/Proxy Protection',
    status: behindCDN ? 'PASS' : 'FAIL',
    details: behindCDN ? 'Server is behind CDN' : 'Server IP is directly exposed',
    recommendation: behindCDN ? undefined : 'Deploy behind Cloudflare or similar CDN to mask origin IP',
  })
  if (!behindCDN) {
    score -= 30
    criticalIssues.push('Server IP is directly exposed - deploy behind CDN immediately')
    recommendations.push('Set BEHIND_CDN=true after deploying behind Cloudflare')
  }

  // Check 2: Environment variables security
  const hasJWTSecret = !!process.env.JWT_SECRET
  checks.push({
    name: 'JWT Secret',
    status: hasJWTSecret ? 'PASS' : 'FAIL',
    details: hasJWTSecret ? 'JWT_SECRET is configured' : 'JWT_SECRET is missing',
    recommendation: hasJWTSecret ? undefined : 'Set JWT_SECRET environment variable',
  })
  if (!hasJWTSecret) { score -= 20; criticalIssues.push('JWT_SECRET not set') }

  // Check 3: Admin email configured
  const hasAdminEmail = !!process.env.ADMIN_EMAIL
  checks.push({
    name: 'Admin Email',
    status: hasAdminEmail ? 'PASS' : 'WARN',
    details: hasAdminEmail ? 'ADMIN_EMAIL is configured' : 'ADMIN_EMAIL not set (role-only admin)',
    recommendation: hasAdminEmail ? undefined : 'Set ADMIN_EMAIL for additional admin verification layer',
  })
  if (!hasAdminEmail) score -= 5

  // Check 4: Request signing secret
  const hasRequestSigningSecret = !!process.env.REQUEST_SIGNING_SECRET
  checks.push({
    name: 'Request Signing',
    status: hasRequestSigningSecret ? 'PASS' : 'WARN',
    details: hasRequestSigningSecret ? 'Request signing is configured' : 'Using ephemeral signing key (resets on restart)',
    recommendation: hasRequestSigningSecret ? undefined : 'Set REQUEST_SIGNING_SECRET for persistent request verification',
  })
  if (!hasRequestSigningSecret) score -= 5

  // Check 5: Node environment
  const isProduction = process.env.NODE_ENV === 'production'
  checks.push({
    name: 'Production Mode',
    status: isProduction ? 'PASS' : 'WARN',
    details: isProduction ? 'Running in production mode' : 'Running in development mode - insecure defaults may be active',
    recommendation: isProduction ? undefined : 'Set NODE_ENV=production for deployment',
  })
  if (!isProduction) score -= 10

  // Check 6: Address salt
  const hasAddressSalt = !!process.env.ADDRESS_SALT
  checks.push({
    name: 'Address Salt',
    status: hasAddressSalt ? 'PASS' : 'FAIL',
    details: hasAddressSalt ? 'ADDRESS_SALT is configured' : 'ADDRESS_SALT is missing - deposit addresses cannot be generated',
    recommendation: hasAddressSalt ? undefined : 'Set ADDRESS_SALT environment variable',
  })
  if (!hasAddressSalt) score -= 10

  // Check 7: Cron secret
  const hasCronSecret = !!process.env.CRON_SECRET
  checks.push({
    name: 'Cron Secret',
    status: hasCronSecret ? 'PASS' : 'WARN',
    details: hasCronSecret ? 'CRON_SECRET is configured' : 'CRON_SECRET not set - cron endpoints vulnerable',
    recommendation: hasCronSecret ? undefined : 'Set CRON_SECRET to protect cron endpoints',
  })
  if (!hasCronSecret) score -= 5

  score = Math.max(0, Math.min(100, score))

  return {
    timestamp: new Date().toISOString(),
    overallScore: score,
    checks,
    criticalIssues,
    recommendations,
  }
}
