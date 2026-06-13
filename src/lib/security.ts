import { NextRequest } from 'next/server'
import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number
  resetAt: number
  blocked: boolean
  blockedUntil: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.blockedUntil < now && entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  windowMs: number   // Time window in milliseconds
  maxRequests: number // Max requests per window
  blockDurationMs: number // Block duration after exceeding
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { windowMs: 15 * 60 * 1000, maxRequests: 5, blockDurationMs: 15 * 60 * 1000 },
  '/api/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 5, blockDurationMs: 60 * 60 * 1000 },
  '/api/auth/send-verify': { windowMs: 60 * 1000, maxRequests: 1, blockDurationMs: 5 * 60 * 1000 },
  '/api/admin/agent': { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 5 * 60 * 1000 },
  'default': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 },
}

export function checkRateLimit(identifier: string, pathname: string): { allowed: boolean; remaining: number; resetAt: number } {
  const config = DEFAULT_RATE_LIMITS[pathname] || DEFAULT_RATE_LIMITS['default']
  const key = `${identifier}:${pathname}`
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs, blocked: false, blockedUntil: 0 }
  }

  if (entry.blocked && entry.blockedUntil > now) {
    return { allowed: false, remaining: 0, resetAt: entry.blockedUntil }
  }

  entry.count++
  if (entry.count > config.maxRequests) {
    entry.blocked = true
    entry.blockedUntil = now + config.blockDurationMs
    rateLimitStore.set(key, entry)

    // Log intrusion event
    logIntrusionEvent(identifier, 'RATE_LIMIT_EXCEEDED', pathname, `Exceeded ${config.maxRequests} requests per ${config.windowMs / 1000}s`)

    return { allowed: false, remaining: 0, resetAt: entry.blockedUntil }
  }

  rateLimitStore.set(key, entry)
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

// ═══════════════════════════════════════════════════════════
// XSS DETECTION & SANITIZATION
// ═══════════════════════════════════════════════════════════

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<link[\s>]/i,
  /<meta[\s>]/i,
  /eval\s*\(/i,
  /expression\s*\(/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<svg[\s>]/i,
  /<img[^>]+onerror/i,
  /document\.(cookie|write|domain)/i,
  /window\.(location|open|eval)/i,
  /alert\s*\(/i,
  /confirm\s*\(/i,
  /prompt\s*\(/i,
  /(\b|\\b)(union\s+select|insert\s+into|delete\s+from|drop\s+table|update\s+\w+\s+set|alter\s+table)\b/i,
]

export function detectXSS(input: string): { isXSS: boolean; patterns: string[] } {
  if (!input || typeof input !== 'string') return { isXSS: false, patterns: [] }

  const detected: string[] = []
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      detected.push(pattern.source)
    }
  }

  return { isXSS: detected.length > 0, patterns: detected }
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return input

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') return sanitizeInput(obj)
  if (Array.isArray(obj)) return obj.map(sanitizeObject)
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  return obj
}

export function validateInput(input: string, fieldName: string): { valid: boolean; error?: string } {
  if (!input) return { valid: true }

  const xssCheck = detectXSS(input)
  if (xssCheck.isXSS) {
    logIntrusionEvent('system', 'XSS_DETECTED', fieldName, `XSS patterns detected: ${xssCheck.patterns.join(', ')}`)
    return { valid: false, error: `تم اكتشاف محتوى غير مسموح به في حقل ${fieldName}` }
  }

  return { valid: true }
}

// ═══════════════════════════════════════════════════════════
// CSRF PROTECTION
// ═══════════════════════════════════════════════════════════

const csrfTokens = new Map<string, { token: string; expiresAt: number }>()

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of csrfTokens.entries()) {
    if (entry.expiresAt < now) csrfTokens.delete(key)
  }
}, 10 * 60 * 1000)

export function generateCsrfToken(sessionId: string): string {
  // SECURITY: Use crypto.randomBytes() instead of Math.random() for cryptographic safety
  // Also, do NOT encode sessionId in the token (was base64-encoded, could be decoded)
  const randomPart = crypto.randomBytes(32).toString('hex')
  const token = `${Date.now()}-${randomPart}`
  csrfTokens.set(sessionId, { token, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }) // 2 hours
  return token
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId)
  if (!stored) return false
  if (stored.expiresAt < Date.now()) {
    csrfTokens.delete(sessionId)
    return false
  }
  // SECURITY: Use timing-safe comparison to prevent timing attacks
  try {
    const storedBuf = Buffer.from(stored.token, 'utf8')
    const tokenBuf = Buffer.from(token, 'utf8')
    if (storedBuf.length !== tokenBuf.length) return false
    return crypto.timingSafeEqual(storedBuf, tokenBuf)
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════
// INTRUSION DETECTION
// ═══════════════════════════════════════════════════════════

interface IntrusionEvent {
  id: string
  ip: string
  type: string
  path: string
  details: string
  timestamp: Date
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

const intrusionLog: IntrusionEvent[] = []
const blockedIPs = new Map<string, { reason: string; blockedAt: number; blockedUntil: number }>()

const SEVERITY_MAP: Record<string, IntrusionEvent['severity']> = {
  'XSS_DETECTED': 'HIGH',
  'SQL_INJECTION': 'CRITICAL',
  'RATE_LIMIT_EXCEEDED': 'MEDIUM',
  'CSRF_VIOLATION': 'HIGH',
  'UNAUTHORIZED_ADMIN_ACCESS': 'CRITICAL',
  'SUSPICIOUS_PATTERN': 'MEDIUM',
  'PATH_TRAVERSAL': 'HIGH',
  'COMMAND_INJECTION': 'CRITICAL',
}

export function logIntrusionEvent(ip: string, type: string, path: string, details: string) {
  const event: IntrusionEvent = {
    id: `intr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    ip,
    type,
    path,
    details,
    timestamp: new Date(),
    severity: SEVERITY_MAP[type] || 'LOW',
  }

  intrusionLog.unshift(event)
  if (intrusionLog.length > 1000) intrusionLog.pop()

  // Auto-block on CRITICAL events
  if (event.severity === 'CRITICAL') {
    blockIP(ip, `${type}: ${details}`, 60 * 60 * 1000) // 1 hour
  }

  console.warn(`[SECURITY] ${event.severity} - ${type} from ${ip}: ${details}`)
}

export function blockIP(ip: string, reason: string, durationMs: number = 60 * 60 * 1000) {
  blockedIPs.set(ip, { reason, blockedAt: Date.now(), blockedUntil: Date.now() + durationMs })
}

export function unblockIP(ip: string): boolean {
  return blockedIPs.delete(ip)
}

export function isIPBlocked(ip: string): boolean {
  const entry = blockedIPs.get(ip)
  if (!entry) return false
  if (entry.blockedUntil < Date.now()) {
    blockedIPs.delete(ip)
    return false
  }
  return true
}

export function getIntrusionLog(limit: number = 50): IntrusionEvent[] {
  return intrusionLog.slice(0, limit)
}

export function getBlockedIPs(): Array<{ ip: string; reason: string; blockedAt: number; blockedUntil: number }> {
  const now = Date.now()
  const result: Array<{ ip: string; reason: string; blockedAt: number; blockedUntil: number }> = []
  for (const [ip, entry] of blockedIPs.entries()) {
    if (entry.blockedUntil > now) {
      result.push({ ip, ...entry })
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════════
// SQL INJECTION DETECTION
// ═══════════════════════════════════════════════════════════

const SQL_INJECTION_PATTERNS = [
  /('\s*(or|OR)\s+'[^']*'\s*=\s*')/i,
  /(\bunion\b\s+\bselect\b)/i,
  /(\binsert\b\s+\binto\b)/i,
  /(\bdelete\b\s+\bfrom\b)/i,
  /(\bdrop\b\s+\btable\b)/i,
  /(\bupdate\b\s+\w+\s+\bset\b)/i,
  /(1\s*=\s*1)/i,
  /('\s*;\s*-\s*-)/i,
  /(\bexec\b\s*\()/i,
  /(\bxp_cmdshell\b)/i,
  /(\binformation_schema\b)/i,
  /(char\s*\(\s*\d+\s*\))/i,
]

export function detectSQLInjection(input: string): { detected: boolean; patterns: string[] } {
  if (!input || typeof input !== 'string') return { detected: false, patterns: [] }

  const detected: string[] = []
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detected.push(pattern.source)
    }
  }

  return { detected: detected.length > 0, patterns: detected }
}

// ═══════════════════════════════════════════════════════════
// PATH TRAVERSAL & COMMAND INJECTION DETECTION
// ═══════════════════════════════════════════════════════════

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//i,
  /\.\.\\/i,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /\/var\/log/i,
]

const COMMAND_INJECTION_PATTERNS = [
  /;\s*(rm|cat|ls|chmod|chown|wget|curl|bash|sh|python|perl|ruby|nc|ncat)\b/i,
  /\|\s*(rm|cat|ls|chmod|chown|wget|curl|bash|sh)\b/i,
  /`[^`]*`/,
  /\$\([^)]*\)/,
]

export function detectPathTraversal(input: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some(p => p.test(input))
}

export function detectCommandInjection(input: string): boolean {
  return COMMAND_INJECTION_PATTERNS.some(p => p.test(input))
}

// ═══════════════════════════════════════════════════════════
// COMPREHENSIVE REQUEST SECURITY CHECK
// ═══════════════════════════════════════════════════════════

export function checkRequestSecurity(request: NextRequest): { safe: boolean; threats: string[]; ip: string } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const threats: string[] = []

  // Check if IP is blocked
  if (isIPBlocked(ip)) {
    threats.push('IP_BLOCKED')
  }

  // Check rate limit
  const rateLimit = checkRateLimit(ip, request.nextUrl.pathname)
  if (!rateLimit.allowed) {
    threats.push('RATE_LIMITED')
  }

  // Check URL for path traversal
  const url = request.nextUrl.pathname + request.nextUrl.search
  if (detectPathTraversal(url)) {
    threats.push('PATH_TRAVERSAL')
    logIntrusionEvent(ip, 'PATH_TRAVERSAL', url, 'Path traversal attempt detected in URL')
  }

  // Check for suspicious query parameters
  const searchParams = request.nextUrl.searchParams.toString()
  if (searchParams) {
    const xssCheck = detectXSS(decodeURIComponent(searchParams))
    if (xssCheck.isXSS) {
      threats.push('XSS_IN_URL')
      logIntrusionEvent(ip, 'XSS_DETECTED', url, `XSS in URL params: ${xssCheck.patterns.join(', ')}`)
    }

    const sqlCheck = detectSQLInjection(decodeURIComponent(searchParams))
    if (sqlCheck.detected) {
      threats.push('SQL_INJECTION_IN_URL')
      logIntrusionEvent(ip, 'SQL_INJECTION', url, `SQL injection in URL: ${sqlCheck.patterns.join(', ')}`)
    }

    if (detectCommandInjection(searchParams)) {
      threats.push('COMMAND_INJECTION_IN_URL')
      logIntrusionEvent(ip, 'COMMAND_INJECTION', url, 'Command injection in URL params')
    }
  }

  // Check User-Agent for suspicious patterns
  const userAgent = request.headers.get('user-agent') || ''
  const suspiciousAgents = ['sqlmap', 'nikto', 'nmap', 'metasploit', 'burpsuite', 'dirbuster', 'hydra', 'wpscan']
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    threats.push('SUSPICIOUS_USER_AGENT')
    logIntrusionEvent(ip, 'SUSPICIOUS_PATTERN', url, `Suspicious User-Agent: ${userAgent}`)
  }

  return { safe: threats.length === 0, threats, ip }
}

// ═══════════════════════════════════════════════════════════
// REQUEST FINGERPRINTING
// ═══════════════════════════════════════════════════════════

export function generateRequestFingerprint(request: NextRequest): string {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    request.headers.get('x-forwarded-for') || '',
  ]

  const raw = components.join('|')
  // SECURITY: Use SHA-256 for collision-resistant fingerprinting
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

// ═══════════════════════════════════════════════════════════
// SECURITY AUDIT
// ═══════════════════════════════════════════════════════════

export interface SecurityAuditReport {
  timestamp: string
  totalIntrusionEvents: number
  criticalEvents: number
  highEvents: number
  mediumEvents: number
  lowEvents: number
  blockedIPs: number
  rateLimitedPaths: string[]
  topThreatTypes: Array<{ type: string; count: number }>
  recentCriticalEvents: IntrusionEvent[]
  securityScore: number // 0-100
}

export function generateSecurityAudit(): SecurityAuditReport {
  const critical = intrusionLog.filter(e => e.severity === 'CRITICAL')
  const high = intrusionLog.filter(e => e.severity === 'HIGH')
  const medium = intrusionLog.filter(e => e.severity === 'MEDIUM')
  const low = intrusionLog.filter(e => e.severity === 'LOW')

  // Count threat types
  const typeCount = new Map<string, number>()
  for (const event of intrusionLog) {
    typeCount.set(event.type, (typeCount.get(event.type) || 0) + 1)
  }

  const topThreatTypes = Array.from(typeCount.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Calculate security score
  let score = 100
  score -= critical.length * 10
  score -= high.length * 5
  score -= medium.length * 2
  score -= low.length * 1
  score -= blockedIPs.size * 3
  score = Math.max(0, Math.min(100, score))

  return {
    timestamp: new Date().toISOString(),
    totalIntrusionEvents: intrusionLog.length,
    criticalEvents: critical.length,
    highEvents: high.length,
    mediumEvents: medium.length,
    lowEvents: low.length,
    blockedIPs: getBlockedIPs().length,
    rateLimitedPaths: Object.keys(DEFAULT_RATE_LIMITS),
    topThreatTypes,
    recentCriticalEvents: critical.slice(0, 10),
    securityScore: score,
  }
}
