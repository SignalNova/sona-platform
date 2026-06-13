// ═══════════════════════════════════════════════════════════════════════════════
// STEALTH INFRASTRUCTURE - Infrastructure Hiding & Traffic Analysis Prevention
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. IP/Location Obfuscation - Remove identifying headers, mask real IP
// 2. DNS Protection - Prevent DNS-based discovery
// 3. Traffic Analysis Prevention - Normalize traffic patterns
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'
import type { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. IP/LOCATION OBFUSCATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProxyValidation {
  isValid: boolean
  trustLevel: 'TRUSTED' | 'SUSPICIOUS' | 'UNTRUSTED'
  detectedProxies: number
  clientIP: string
  reason?: string
}

class InfrastructureStealth {
  // Headers that reveal server identity - must be stripped
  private static readonly REVEALING_HEADERS = [
    'Server',
    'X-Powered-By',
    'X-AspNet-Version',
    'X-Runtime',
    'X-Version',
    'X-Application-Context',
    'X-Request-ID',
    'X-Real-IP',
    'X-Forwarded-For',
    'X-Forwarded-Host',
    'X-Forwarded-Proto',
    'X-Original-URL',
    'X-Rewrite-URL',
    'Via',
    'Front-End-Https',
    'X-Backend-Server',
    'X-Served-By',
    'X-Cache',
    'X-Cache-Hits',
    'X-Fastly-Request-ID',
    'X-Amz-Cf-Id',
    'X-Cloud-Trace-Context',
  ]

  // Geo-related fields that must be stripped from responses
  private static readonly GEO_FIELDS = [
    'location', 'latitude', 'longitude', 'geo', 'coordinates',
    'country_code', 'region', 'timezone', 'postal_code',
    'server_location', 'datacenter', 'region_code',
  ]

  /**
   * Sanitize response headers to remove server-identifying information
   */
  sanitizeHeaders(headers: Headers): Headers {
    const sanitized = new Headers(headers)

    // Remove all revealing headers
    for (const header of InfrastructureStealth.REVEALING_HEADERS) {
      sanitized.delete(header)
    }

    // Set fake/masked values for required headers
    const dailySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
    const fakeServerId = crypto
      .createHash('sha256')
      .update(`stealth-${dailySeed}`)
      .digest('hex')
      .substring(0, 16)

    sanitized.set('Server', fakeServerId)
    sanitized.set('X-Powered-By', '')
    sanitized.set('X-Request-ID', crypto.randomBytes(16).toString('hex'))

    // Security headers (always set)
    sanitized.set('X-Content-Type-Options', 'nosniff')
    sanitized.set('X-Frame-Options', 'DENY')
    sanitized.set('Referrer-Policy', 'no-referrer')

    // Prevent caching of sensitive responses
    sanitized.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    sanitized.set('Pragma', 'no-cache')

    return sanitized
  }

  /**
   * Validate the proxy chain to prevent IP spoofing
   * Ensures that X-Forwarded-For headers are legitimate
   */
  validateProxyChain(request: NextRequest): ProxyValidation {
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const via = request.headers.get('via')

    let detectedProxies = 0
    const reasons: string[] = []

    // Count proxy hops
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim())
      detectedProxies = ips.length

      // Check for suspicious IP chain patterns
      if (ips.length > 5) {
        reasons.push('Excessive proxy chain length')
      }

      // Check for private IPs in the chain (possible spoofing)
      const hasPrivateIP = ips.some(ip =>
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('172.16.') ||
        ip === '127.0.0.1' ||
        ip === 'unknown'
      )

      if (hasPrivateIP && ips.length > 1) {
        reasons.push('Private IP in proxy chain - possible spoofing')
      }
    }

    if (via) {
      detectedProxies += via.split(',').length
    }

    // Determine client IP (rightmost in X-Forwarded-For is closest to us)
    const clientIP = forwardedFor
      ? forwardedFor.split(',').pop()?.trim() || 'unknown'
      : realIP || 'unknown'

    // Determine trust level
    let trustLevel: ProxyValidation['trustLevel'] = 'TRUSTED'
    if (reasons.length > 0 || detectedProxies > 5) {
      trustLevel = 'UNTRUSTED'
    } else if (detectedProxies > 2) {
      trustLevel = 'SUSPICIOUS'
    }

    return {
      isValid: trustLevel !== 'UNTRUSTED',
      trustLevel,
      detectedProxies,
      clientIP,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    }
  }

  /**
   * Strip geolocation data from response objects
   * Prevents leakage of server location through API responses
   */
  stripLocationData(data: any): any {
    if (typeof data !== 'object' || data === null) return data

    if (Array.isArray(data)) {
      return data.map(item => this.stripLocationData(item))
    }

    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      // Skip geo-related fields
      const lowerKey = key.toLowerCase()
      if (InfrastructureStealth.GEO_FIELDS.some(field => lowerKey.includes(field))) {
        continue
      }

      // Recursively clean nested objects
      if (typeof value === 'object' && value !== null) {
        result[key] = this.stripLocationData(value)
      } else {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Get security headers for stealth mode
   */
  getStealthHeaders(): Record<string, string> {
    const dailySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
    const fakeServerId = crypto
      .createHash('sha256')
      .update(`stealth-server-${dailySeed}`)
      .digest('hex')
      .substring(0, 16)

    return {
      'Server': fakeServerId,
      'X-Powered-By': '',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), tracking=()',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'X-Debug-Mode': 'off',
      'SourceMap': '',
      'X-SourceMap': '',
      ...(process.env.NODE_ENV === 'production' ? {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      } : {}),
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DNS PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface DNSValidationResult {
  isProtected: boolean
  checks: {
    name: string
    status: 'PASS' | 'WARN' | 'FAIL'
    details: string
    recommendation?: string
  }[]
  score: number // 0-100
}

export interface SubdomainCheckResult {
  isVulnerable: boolean
  vulnerableSubdomains: string[]
  recommendations: string[]
}

class DNSProtection {
  /**
   * Validate DNS configuration for security
   */
  validateDNSConfig(): DNSValidationResult {
    const checks: DNSValidationResult['checks'] = []
    let score = 100

    // Check 1: CDN protection
    const behindCDN = process.env.BEHIND_CDN === 'true' || process.env.USE_CLOUDFLARE === 'true'
    checks.push({
      name: 'CDN/Proxy Protection',
      status: behindCDN ? 'PASS' : 'FAIL',
      details: behindCDN
        ? 'Traffic routed through CDN - origin IP protected'
        : 'No CDN detected - origin server IP is directly accessible',
      recommendation: behindCDN ? undefined : 'Deploy behind Cloudflare or similar CDN to mask origin IP',
    })
    if (!behindCDN) score -= 30

    // Check 2: Direct IP access blocking
    const blockDirectIP = process.env.BLOCK_DIRECT_IP_ACCESS === 'true'
    checks.push({
      name: 'Direct IP Access',
      status: blockDirectIP ? 'PASS' : 'WARN',
      details: blockDirectIP
        ? 'Direct IP access is blocked'
        : 'Direct IP access may be possible - server could be discovered via IP scan',
      recommendation: blockDirectIP ? undefined : 'Configure firewall to block direct IP access',
    })
    if (!blockDirectIP) score -= 15

    // Check 3: DNSSEC
    checks.push({
      name: 'DNSSEC',
      status: 'WARN',
      details: 'DNSSEC validation should be enabled to prevent DNS spoofing',
      recommendation: 'Enable DNSSEC for your domain registrar and DNS provider',
    })
    score -= 10

    // Check 4: SPF/DKIM/DMARC
    const hasMailConfig = !!process.env.SMTP_HOST || !!process.env.EMAIL_SERVER
    checks.push({
      name: 'Email DNS Records',
      status: hasMailConfig ? 'WARN' : 'PASS',
      details: hasMailConfig
        ? 'Email is configured - ensure SPF/DKIM/DMARC records do not leak origin IP'
        : 'No email configuration detected - no DNS record leakage risk from email',
      recommendation: hasMailConfig
        ? 'Use external mail relay (SendGrid/Mailgun) to avoid origin IP in email headers'
        : undefined,
    })
    if (hasMailConfig) score -= 5

    // Check 5: Wildcard subdomain
    checks.push({
      name: 'Wildcard Subdomain',
      status: 'WARN',
      details: 'Wildcard DNS records can expose subdomains to enumeration',
      recommendation: 'Avoid wildcard DNS records; use specific records only',
    })
    score -= 5

    return {
      isProtected: score >= 70,
      checks,
      score: Math.max(0, score),
    }
  }

  /**
   * Check for subdomain takeover vulnerabilities
   */
  checkSubdomainTakeover(): SubdomainCheckResult {
    const vulnerableSubdomains: string[] = []
    const recommendations: string[] = []

    // Common subdomain takeover indicators
    const commonVulnerablePatterns = [
      { subdomain: 'staging', service: 'AWS S3/CloudFront', check: 'CNAME points to inactive bucket' },
      { subdomain: 'dev', service: 'GitHub Pages', check: 'CNAME points to deleted repository' },
      { subdomain: 'api', service: 'Heroku', check: 'CNAME points to deleted app' },
      { subdomain: 'app', service: 'Azure', check: 'CNAME points to deactivated resource' },
      { subdomain: 'blog', service: 'WordPress/Tumblr', check: 'CNAME points to inactive blog' },
      { subdomain: 'docs', service: 'GitBook/ReadTheDocs', check: 'CNAME points to deleted project' },
    ]

    for (const pattern of commonVulnerablePatterns) {
      // In production, we would actually check DNS records
      // For now, we add recommendations
      recommendations.push(`Check ${pattern.subdomain}.${process.env.AUTHORIZED_DOMAINS?.split(',')[0] || 'domain'} for ${pattern.service} takeover (${pattern.check})`)
    }

    recommendations.push('Regularly audit DNS records for stale CNAME entries')
    recommendations.push('Use DNS monitoring services to detect unauthorized changes')
    recommendations.push('Remove DNS records immediately when deactivating cloud services')

    return {
      isVulnerable: vulnerableSubdomains.length > 0,
      vulnerableSubdomains,
      recommendations,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TRAFFIC ANALYSIS PREVENTION
// ═══════════════════════════════════════════════════════════════════════════════

class TrafficAnalysisPrevention {
  // Target response sizes for padding (in bytes)
  private static readonly SIZE_BUCKETS = [
    256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536,
  ]

  // Auth endpoint constant time settings
  private static readonly AUTH_RESPONSE_TIME_MS = 250 // Fixed time for auth responses

  /**
   * Pad a response to a target size to prevent size-based analysis
   * Response sizes can leak information about the content
   */
  padResponse<T>(response: T, targetSize?: number): T & { _padding?: string } {
    const serialized = JSON.stringify(response)
    const currentSize = Buffer.byteLength(serialized, 'utf8')

    if (targetSize && currentSize >= targetSize) {
      return response as T & { _padding?: string } // Already at or above target size
    }

    // Find the nearest size bucket
    const target = targetSize || this.findNearestBucket(currentSize)

    if (currentSize < target) {
      const paddingSize = target - currentSize - 20 // Account for the padding field itself
      if (paddingSize > 0) {
        // Add random padding data
        const padding = crypto.randomBytes(Math.ceil(paddingSize / 2)).toString('hex').substring(0, paddingSize)

        if (typeof response === 'object' && response !== null && !Array.isArray(response)) {
          return { ...response, _padding: padding } as T & { _padding?: string }
        }
      }
    }

    return response as T & { _padding?: string }
  }

  /**
   * Execute an operation in constant time to prevent timing side-channels
   * Used for authentication and other sensitive operations
   */
  async constantTimeOperation<T>(
    operation: () => T,
    targetMs: number = TrafficAnalysisPrevention.AUTH_RESPONSE_TIME_MS
  ): Promise<T> {
    const startTime = performance.now()

    // Execute the operation
    const result = operation()

    // Calculate elapsed time
    const elapsed = performance.now() - startTime

    // If operation was faster than target, wait the remaining time
    const remainingMs = targetMs - elapsed
    if (remainingMs > 0) {
      // Add small random jitter to prevent exact timing analysis
      const jitter = crypto.randomInt(0, 50)
      await new Promise(resolve => setTimeout(resolve, remainingMs + jitter))
    }

    return result
  }

  /**
   * Add traffic shaping delay to normalize request patterns
   * Makes it harder to identify specific operations by timing
   */
  async addTrafficShapingDelay(endpoint: string): Promise<void> {
    // Different endpoints have different typical response times
    // We normalize all responses to a common range
    const baseDelay = this.getEndpointBaseDelay(endpoint)
    const jitter = crypto.randomInt(0, 100)

    await new Promise(resolve => setTimeout(resolve, baseDelay + jitter))
  }

  /**
   * Get base delay for an endpoint type
   * Financial endpoints get more delay to prevent timing attacks
   */
  private getEndpointBaseDelay(endpoint: string): number {
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) {
      return 200 // Auth endpoints - constant time is critical
    }
    if (endpoint.includes('/withdraw') || endpoint.includes('/transfer')) {
      return 150 // Financial endpoints
    }
    if (endpoint.includes('/admin')) {
      return 100 // Admin endpoints
    }
    return 50 // Default
  }

  /**
   * Find the nearest size bucket for padding
   */
  private findNearestBucket(currentSize: number): number {
    for (const bucket of TrafficAnalysisPrevention.SIZE_BUCKETS) {
      if (currentSize <= bucket) return bucket
    }
    // If larger than largest bucket, round up to nearest 64KB
    return Math.ceil(currentSize / 65536) * 65536
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const infrastructureStealth = new InfrastructureStealth()
export const dnsProtection = new DNSProtection()
export const trafficAnalysisPrevention = new TrafficAnalysisPrevention()
