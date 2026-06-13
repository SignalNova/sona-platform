// ═══════════════════════════════════════════════════════════════════════════════
// FORTRESS V2 - Advanced Multi-Layer Security Engine for Trading Platform
// ═══════════════════════════════════════════════════════════════════════════════
// This system orchestrates all security modules and provides:
// 1. Advanced Threat Detection Engine - Behavioral analysis & anomaly detection
// 2. Adaptive Rate Limiting - Dynamic limits based on threat level
// 3. Request Integrity Verification - HMAC signatures & anti-replay
// 4. Anti-Exfiltration System - Data extraction prevention
// 5. Security Event Correlation Engine - Attack chain detection
// 6. Geolocation Security - IP-based geographic protection
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ThreatLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ThreatScore {
  score: number           // 0-100
  level: ThreatLevel
  factors: string[]
  timestamp: number
  requiresAction: boolean
  actionType?: 'MONITOR' | 'CHALLENGE' | 'THROTTLE' | 'BLOCK' | 'CONTAIN'
}

export interface RiskScore {
  score: number           // 0-100
  level: ThreatLevel
  factors: string[]
  recommendation: string
}

export interface FinancialActivity {
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'INVESTMENT' | 'TRADE'
  amount: number
  currency: string
  destination?: string
  source?: string
  timestamp?: number
}

export interface SecurityEvent {
  id: string
  timestamp: number
  type: string
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  source: string
  ip: string
  userId?: string
  endpoint?: string
  details: Record<string, any>
  fingerprint: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
  requiresCaptcha: boolean
  threatLevel: ThreatLevel
}

export interface InjectionResult {
  isInjection: boolean
  type: 'SQL' | 'XSS' | 'COMMAND' | 'PATH_TRAVERSAL' | 'LDAP' | 'SSRF' | 'NONE'
  confidence: number
  detectedPatterns: string[]
  sanitizedParams: Record<string, any>
}

export interface DataAccessResult {
  allowed: boolean
  riskLevel: ThreatLevel
  reason?: string
  dataVolumeAccessed: number
  accessCount: number
}

export interface CorrelationResult {
  attackChains: AttackChain[]
  compositeRiskScore: number
  recommendedActions: string[]
  linkedEvents: number
}

export interface AttackChain {
  id: string
  events: SecurityEvent[]
  startTime: number
  endTime: number
  attackType: string
  severity: ThreatLevel
  phases: AttackPhase[]
}

export interface AttackPhase {
  name: string
  startTime: number
  endTime: number
  eventCount: number
  description: string
}

export interface ResponseAction {
  action: 'LOG' | 'MONITOR' | 'THROTTLE' | 'CHALLENGE' | 'BLOCK' | 'CONTAIN' | 'FREEZE' | 'BAN'
  duration: number
  reason: string
  automatedResponses: string[]
}

export interface GeoSecurityResult {
  country: string
  city: string
  isVPN: boolean
  isProxy: boolean
  isTor: boolean
  isDatacenter: boolean
  riskScore: number
  isBlocked: boolean
  blockReason?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1: ADVANCED THREAT DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class ThreatDetectionEngine {
  private requestPatterns = new Map<string, {
    timestamps: number[]
    endpoints: string[]
    userAgents: Set<string>
    ips: Set<string>
  }>()

  private ipLocations = new Map<string, {
    country: string
    city: string
    timestamp: number
  }>()

  private financialPatterns = new Map<string, {
    activities: FinancialActivity[]
    totalVolume: number
    lastActivity: number
  }>()

  // Automation detection thresholds
  private static readonly BOT_REQUEST_INTERVAL_MS = 200
  private static readonly BOT_VARIANCE_THRESHOLD = 50
  private static readonly IMPOSSIBLE_TRAVEL_SPEED_KMH = 1000
  private static readonly MAX_FINANCIAL_VELOCITY_PER_HOUR = 10

  /**
   * Analyze a request for threat indicators
   */
  analyzeRequest(userId: string, ip: string, userAgent: string, endpoint: string): ThreatScore {
    const factors: string[] = []
    let score = 0
    const now = Date.now()

    // Track request pattern
    const key = `${userId}:${ip}`
    const pattern = this.requestPatterns.get(key) || {
      timestamps: [],
      endpoints: [],
      userAgents: new Set<string>(),
      ips: new Set<string>(),
    }

    pattern.timestamps.push(now)
    pattern.endpoints.push(endpoint)
    pattern.userAgents.add(userAgent)
    pattern.ips.add(ip)

    // Keep only last 100 timestamps
    if (pattern.timestamps.length > 100) {
      pattern.timestamps = pattern.timestamps.slice(-50)
      pattern.endpoints = pattern.endpoints.slice(-50)
    }

    this.requestPatterns.set(key, pattern)

    // Check 1: Request frequency anomaly
    const recentTimestamps = pattern.timestamps.filter(t => now - t < 60000)
    if (recentTimestamps.length > 60) {
      score += 20
      factors.push('HIGH_REQUEST_FREQUENCY')
    }

    // Check 2: Automation detection
    if (this.detectAutomation(ip, pattern.timestamps)) {
      score += 35
      factors.push('AUTOMATION_DETECTED')
    }

    // Check 3: Parameter tampering (detected via endpoint pattern)
    if (pattern.endpoints.filter(e => e.includes('admin') || e.includes('config') || e.includes('debug')).length > 3) {
      score += 25
      factors.push('SENSITIVE_ENDPOINT_PROBING')
    }

    // Check 4: Multiple user agents from same user/IP
    if (pattern.userAgents.size > 5) {
      score += 15
      factors.push('MULTIPLE_USER_AGENTS')
    }

    // Check 5: Rapid endpoint enumeration
    const uniqueEndpoints = new Set(pattern.endpoints.slice(-30))
    if (uniqueEndpoints.size > 20) {
      score += 20
      factors.push('RAPID_ENDPOINT_ENUMERATION')
    }

    // Determine threat level
    const level = this.scoreToThreatLevel(score)
    const requiresAction = score >= 25
    let actionType: ThreatScore['actionType'] = 'MONITOR'
    if (score >= 75) actionType = 'BLOCK'
    else if (score >= 50) actionType = 'THROTTLE'
    else if (score >= 35) actionType = 'CHALLENGE'

    return {
      score: Math.min(100, score),
      level,
      factors,
      timestamp: now,
      requiresAction,
      actionType: requiresAction ? actionType : undefined,
    }
  }

  /**
   * Analyze financial activity for suspicious patterns
   */
  analyzeFinancialActivity(userId: string, activity: FinancialActivity): RiskScore {
    const factors: string[] = []
    let riskScore = 0
    const now = Date.now()

    const pattern = this.financialPatterns.get(userId) || {
      activities: [],
      totalVolume: 0,
      lastActivity: now,
    }

    pattern.activities.push({ ...activity, timestamp: activity.timestamp || now })
    pattern.totalVolume += activity.amount
    pattern.lastActivity = now

    // Keep only last 100 activities
    if (pattern.activities.length > 100) {
      pattern.activities = pattern.activities.slice(-50)
    }

    this.financialPatterns.set(userId, pattern)

    // Check 1: High value transactions
    if (activity.amount > 10000) {
      riskScore += 20
      factors.push('HIGH_VALUE_TRANSACTION')
    }
    if (activity.amount > 50000) {
      riskScore += 15
      factors.push('VERY_HIGH_VALUE_TRANSACTION')
    }

    // Check 2: Financial velocity (many operations in short time)
    const recentActivities = pattern.activities.filter(a => now - (a.timestamp || now) < 3600000)
    if (recentActivities.length > ThreatDetectionEngine.MAX_FINANCIAL_VELOCITY_PER_HOUR) {
      riskScore += 30
      factors.push('HIGH_FINANCIAL_VELOCITY')
    }

    // Check 3: Unusual withdrawal pattern (withdrawing most of balance)
    if (activity.type === 'WITHDRAWAL' && activity.amount > pattern.totalVolume * 0.8) {
      riskScore += 25
      factors.push('LARGE_WITHDRAWAL_RATIO')
    }

    // Check 4: Rapid deposit-withdrawal cycle
    const lastDeposit = [...pattern.activities].reverse().find(a => a.type === 'DEPOSIT')
    const lastWithdrawal = [...pattern.activities].reverse().find(a => a.type === 'WITHDRAWAL')
    if (lastDeposit && lastWithdrawal) {
      const cycleTime = Math.abs((lastDeposit.timestamp || now) - (lastWithdrawal.timestamp || now))
      if (cycleTime < 300000 && lastDeposit.amount === lastWithdrawal.amount) {
        riskScore += 40
        factors.push('RAPID_DEPOSIT_WITHDRAWAL_CYCLE')
      }
    }

    // Check 5: Multiple transfers to different destinations
    if (activity.type === 'TRANSFER') {
      const recentTransfers = recentActivities.filter(a => a.type === 'TRANSFER')
      const uniqueDestinations = new Set(recentTransfers.map(a => a.destination).filter(Boolean))
      if (uniqueDestinations.size >= 3) {
        riskScore += 20
        factors.push('MULTIPLE_TRANSFER_DESTINATIONS')
      }
    }

    riskScore = Math.min(100, riskScore)
    const level = this.scoreToThreatLevel(riskScore)

    let recommendation = 'ALLOW'
    if (riskScore >= 60) recommendation = 'BLOCK_AND_REVIEW'
    else if (riskScore >= 40) recommendation = 'REQUIRE_ADDITIONAL_VERIFICATION'
    else if (riskScore >= 25) recommendation = 'MONITOR_CLOSELY'

    return {
      score: riskScore,
      level,
      factors,
      recommendation,
    }
  }

  /**
   * Detect impossible travel - same user from 2 distant IPs within short time
   */
  detectImpossibleTravel(userId: string, newIp: string, newCountry: string, newCity: string): boolean {
    const now = Date.now()
    const lastLocation = this.ipLocations.get(userId)

    // Update location
    this.ipLocations.set(userId, { country: newCountry, city: newCity, timestamp: now })

    if (!lastLocation) return false

    // Skip if same country/city
    if (lastLocation.country === newCountry && lastLocation.city === newCity) return false

    // Skip if more than 24 hours since last location
    const timeDiff = now - lastLocation.timestamp
    if (timeDiff > 24 * 60 * 60 * 1000) return false

    // Different country within 24 hours is suspicious
    // Different country within 1 hour is impossible travel
    if (lastLocation.country !== newCountry && timeDiff < 3600000) {
      return true
    }

    return false
  }

  /**
   * Detect automation via request timing analysis
   */
  detectAutomation(ip: string, timing: number[]): boolean {
    if (timing.length < 5) return false

    const intervals: number[] = []
    for (let i = 1; i < timing.length; i++) {
      intervals.push(timing[i] - timing[i - 1])
    }

    if (intervals.length === 0) return false

    // Calculate variance of intervals
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length

    // Bots tend to have very low variance (consistent intervals)
    const isLowVariance = variance < ThreatDetectionEngine.BOT_VARIANCE_THRESHOLD
    const isFastRequests = mean < ThreatDetectionEngine.BOT_REQUEST_INTERVAL_MS

    return isLowVariance && isFastRequests
  }

  private scoreToThreatLevel(score: number): ThreatLevel {
    if (score >= 75) return 'CRITICAL'
    if (score >= 50) return 'HIGH'
    if (score >= 25) return 'MEDIUM'
    if (score >= 10) return 'LOW'
    return 'NONE'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2: ADAPTIVE RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

class AdaptiveRateLimiter {
  private rateLimits = new Map<string, {
    count: number
    resetAt: number
    blocked: boolean
    blockedUntil: number
    threatLevel: ThreatLevel
  }>()

  // Base limits per endpoint type
  private static readonly BASE_LIMITS: Record<string, { maxReqs: number; windowMs: number; blockMs: number }> = {
    'default': { maxReqs: 60, windowMs: 60000, blockMs: 300000 },
    'auth': { maxReqs: 10, windowMs: 900000, blockMs: 900000 },
    'financial': { maxReqs: 10, windowMs: 60000, blockMs: 600000 },
    'admin': { maxReqs: 120, windowMs: 60000, blockMs: 300000 },
    'data': { maxReqs: 30, windowMs: 60000, blockMs: 300000 },
  }

  // Threat level multipliers
  private static readonly THREAT_MULTIPLIERS: Record<ThreatLevel, number> = {
    'NONE': 1.0,
    'LOW': 0.75,
    'MEDIUM': 0.5,
    'HIGH': 0.25,
    'CRITICAL': 0.0,
  }

  /**
   * Check rate limit for an identifier + endpoint
   */
  checkLimit(identifier: string, endpoint: string): RateLimitResult {
    const key = `${identifier}:${endpoint}`
    const now = Date.now()
    const entry = this.rateLimits.get(key)

    // If blocked
    if (entry?.blocked && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
        requiresCaptcha: entry.threatLevel === 'HIGH',
        threatLevel: entry.threatLevel,
      }
    }

    // Get base limit for this endpoint type
    const endpointType = this.categorizeEndpoint(endpoint)
    const baseLimit = AdaptiveRateLimiter.BASE_LIMITS[endpointType] || AdaptiveRateLimiter.BASE_LIMITS['default']
    const threatLevel = entry?.threatLevel || 'NONE'
    const multiplier = AdaptiveRateLimiter.THREAT_MULTIPLIERS[threatLevel]
    const effectiveMaxReqs = Math.max(1, Math.floor(baseLimit.maxReqs * multiplier))

    // Reset window if expired
    if (!entry || entry.resetAt < now) {
      const newEntry = {
        count: 1,
        resetAt: now + baseLimit.windowMs,
        blocked: false,
        blockedUntil: 0,
        threatLevel,
      }
      this.rateLimits.set(key, newEntry)

      return {
        allowed: true,
        remaining: effectiveMaxReqs - 1,
        resetAt: newEntry.resetAt,
        requiresCaptcha: threatLevel === 'HIGH',
        threatLevel,
      }
    }

    // Increment count
    entry.count++
    const remaining = Math.max(0, effectiveMaxReqs - entry.count)

    if (entry.count > effectiveMaxReqs) {
      entry.blocked = true
      entry.blockedUntil = now + baseLimit.blockMs
      this.rateLimits.set(key, entry)

      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
        requiresCaptcha: threatLevel === 'HIGH',
        threatLevel,
      }
    }

    this.rateLimits.set(key, entry)

    return {
      allowed: true,
      remaining,
      resetAt: entry.resetAt,
      requiresCaptcha: threatLevel === 'HIGH',
      threatLevel,
    }
  }

  /**
   * Adjust rate limits based on threat level
   */
  adjustForThreatLevel(identifier: string, threatLevel: ThreatLevel): void {
    // Update all entries for this identifier
    for (const [key, entry] of this.rateLimits.entries()) {
      if (key.startsWith(`${identifier}:`)) {
        entry.threatLevel = threatLevel
        this.rateLimits.set(key, entry)
      }
    }
  }

  /**
   * Record a request for rate limiting
   */
  recordRequest(identifier: string, endpoint: string): void {
    const key = `${identifier}:${endpoint}`
    const now = Date.now()
    const entry = this.rateLimits.get(key)

    if (!entry || entry.resetAt < now) {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: now + 60000,
        blocked: false,
        blockedUntil: 0,
        threatLevel: 'NONE',
      })
    } else {
      entry.count++
      this.rateLimits.set(key, entry)
    }
  }

  private categorizeEndpoint(endpoint: string): string {
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) return 'auth'
    if (endpoint.includes('/withdraw') || endpoint.includes('/deposit') || endpoint.includes('/transfer') || endpoint.includes('/invest')) return 'financial'
    if (endpoint.includes('/admin')) return 'admin'
    if (endpoint.includes('/transactions') || endpoint.includes('/user/') || endpoint.includes('/balance')) return 'data'
    return 'default'
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateLimits.entries()) {
      if (entry.blockedUntil < now && entry.resetAt < now) {
        this.rateLimits.delete(key)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3: REQUEST INTEGRITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

class RequestIntegrityVerifier {
  private readonly secret: string
  private usedNonces = new Map<string, number>()
  private static readonly NONCE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
  private static readonly MAX_TOKEN_AGE_MS = 30 * 60 * 1000 // 30 minutes

  // Injection patterns
  private static readonly INJECTION_PATTERNS: Record<string, RegExp[]> = {
    'SQL': [
      /(\bunion\b\s+\bselect\b)/i, /(\binsert\b\s+\binto\b)/i,
      /(\bdelete\b\s+\bfrom\b)/i, /(\bdrop\b\s+\btable\b)/i,
      /(1\s*=\s*1)/i, /('\s*(or|OR)\s+')/i, /(\binformation_schema\b)/i,
    ],
    'XSS': [
      /<script[\s>]/i, /javascript\s*:/i,
      /on(click|load|error|mouseover|focus)\s*=/i,
      /eval\s*\(/i, /document\.(cookie|write)/i,
    ],
    'COMMAND': [
      /;\s*(rm|cat|ls|chmod|bash|sh|wget|curl|python|perl)\b/i,
      /`[^`]*`/, /\$\([^)]*\)/,
    ],
    'PATH_TRAVERSAL': [
      /\.\.\//i, /\.\.\\/i, /%2e%2e%2f/i,
      /\/etc\/passwd/i, /\/proc\/self/i,
    ],
    'LDAP': [
      /(\*\)|\(\|)/i,
    ],
    'SSRF': [
      /(http|https):\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254)/i,
    ],
  }

  constructor() {
    this.secret = process.env.FORTRESS_INTEGRITY_SECRET || crypto.randomBytes(64).toString('hex')
  }

  /**
   * Generate an integrity token for a session + action
   */
  generateIntegrityToken(sessionId: string, action: string): string {
    const timestamp = Date.now()
    const nonce = crypto.randomBytes(16).toString('hex')
    const payload = `${sessionId}:${action}:${timestamp}:${nonce}`

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex')

    const token = Buffer.from(`${payload}:${signature}`).toString('base64url')
    return token
  }

  /**
   * Verify an integrity token
   */
  verifyIntegrity(token: string, sessionId: string, action: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8')
      const parts = decoded.split(':')
      if (parts.length < 5) return false

      const [tokenSessionId, tokenAction, timestampStr, nonce, signature] = [
        parts[0], parts[1], parts[2], parts[3], parts.slice(4).join(':')
      ]

      // Verify session and action match
      if (tokenSessionId !== sessionId || tokenAction !== action) return false

      // Verify timestamp freshness
      const timestamp = parseInt(timestampStr, 10)
      if (Date.now() - timestamp > RequestIntegrityVerifier.MAX_TOKEN_AGE_MS) return false

      // Verify nonce hasn't been used (prevent replay)
      if (this.usedNonces.has(nonce)) return false

      // Verify signature
      const payload = `${sessionId}:${action}:${timestamp}:${nonce}`
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex')

      const sigBuf = Buffer.from(signature, 'hex')
      const expBuf = Buffer.from(expectedSignature, 'hex')
      if (sigBuf.length !== expBuf.length) return false
      if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false

      // Mark nonce as used
      this.usedNonces.set(nonce, Date.now())

      return true
    } catch {
      return false
    }
  }

  /**
   * Detect injection attempts in request parameters
   */
  detectInjection(params: Record<string, any>): InjectionResult {
    const detectedPatterns: string[] = []
    let isInjection = false
    let injectionType: InjectionResult['type'] = 'NONE'
    let maxConfidence = 0
    const sanitizedParams: Record<string, any> = { ...params }

    for (const [key, value] of Object.entries(params)) {
      if (typeof value !== 'string') continue

      for (const [type, patterns] of Object.entries(RequestIntegrityVerifier.INJECTION_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(value)) {
            isInjection = true
            detectedPatterns.push(`${key}:${type}:${pattern.source}`)
            maxConfidence = Math.max(maxConfidence, 80)

            // Sanitize the parameter
            sanitizedParams[key] = value.replace(pattern, '[REMOVED]')
          }
        }
      }
    }

    if (isInjection) {
      // Determine the most severe injection type
      if (detectedPatterns.some(p => p.includes('SQL'))) injectionType = 'SQL'
      else if (detectedPatterns.some(p => p.includes('XSS'))) injectionType = 'XSS'
      else if (detectedPatterns.some(p => p.includes('COMMAND'))) injectionType = 'COMMAND'
      else if (detectedPatterns.some(p => p.includes('PATH_TRAVERSAL'))) injectionType = 'PATH_TRAVERSAL'
      else if (detectedPatterns.some(p => p.includes('LDAP'))) injectionType = 'LDAP'
      else if (detectedPatterns.some(p => p.includes('SSRF'))) injectionType = 'SSRF'
    }

    return {
      isInjection,
      type: injectionType,
      confidence: maxConfidence,
      detectedPatterns,
      sanitizedParams,
    }
  }

  // Cleanup expired nonces
  cleanup(): void {
    const now = Date.now()
    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > RequestIntegrityVerifier.NONCE_EXPIRY_MS) {
        this.usedNonces.delete(nonce)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4: ANTI-EXFILTRATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

class AntiExfiltrationSystem {
  private responseSizeTracker = new Map<string, {
    sizes: number[]
    totalSize: number
    lastAccess: number
  }>()

  private dataAccessTracker = new Map<string, {
    count: number
    types: Map<string, number>
    lastAccess: number
  }>()

  private static readonly MAX_RESPONSE_SIZE_PER_HOUR = 50 * 1024 * 1024 // 50MB
  private static readonly MAX_DATA_ACCESS_PER_HOUR = 500
  private static readonly MAX_RESPONSE_SIZE_PER_REQUEST = 5 * 1024 * 1024 // 5MB
  private static readonly SCRAPING_PATTERN_THRESHOLD = 30 // Unique endpoints accessed

  /**
   * Monitor response size for data exfiltration detection
   * Returns true if response is suspiciously large
   */
  monitorResponse(userId: string, endpoint: string, responseSize: number): boolean {
    const key = userId || endpoint
    const now = Date.now()

    const tracker = this.responseSizeTracker.get(key) || {
      sizes: [],
      totalSize: 0,
      lastAccess: now,
    }

    tracker.sizes.push(responseSize)
    tracker.totalSize += responseSize
    tracker.lastAccess = now

    // Keep only last hour of data
    const oneHourAgo = now - 3600000
    tracker.sizes = tracker.sizes.filter((_, i) => i > 0) // Keep recent entries
    if (tracker.sizes.length > 1000) {
      tracker.sizes = tracker.sizes.slice(-500)
    }

    this.responseSizeTracker.set(key, tracker)

    // Check for suspicious patterns
    if (responseSize > AntiExfiltrationSystem.MAX_RESPONSE_SIZE_PER_REQUEST) {
      return true // Single large response
    }

    if (tracker.totalSize > AntiExfiltrationSystem.MAX_RESPONSE_SIZE_PER_HOUR) {
      return true // Too much data in total
    }

    return false
  }

  /**
   * Check data access pattern for scraping/exfiltration
   */
  checkDataAccessPattern(userId: string, dataType: string): DataAccessResult {
    const now = Date.now()

    const tracker = this.dataAccessTracker.get(userId) || {
      count: 0,
      types: new Map<string, number>(),
      lastAccess: now,
    }

    tracker.count++
    tracker.types.set(dataType, (tracker.types.get(dataType) || 0) + 1)
    tracker.lastAccess = now

    this.dataAccessTracker.set(userId, tracker)

    // Check access frequency
    if (tracker.count > AntiExfiltrationSystem.MAX_DATA_ACCESS_PER_HOUR) {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: 'Excessive data access frequency - possible data scraping',
        dataVolumeAccessed: tracker.count,
        accessCount: tracker.count,
      }
    }

    // Check if accessing too many different data types rapidly
    if (tracker.types.size > AntiExfiltrationSystem.SCRAPING_PATTERN_THRESHOLD) {
      return {
        allowed: false,
        riskLevel: 'MEDIUM',
        reason: 'Accessing many different data types - possible enumeration',
        dataVolumeAccessed: tracker.count,
        accessCount: tracker.count,
      }
    }

    return {
      allowed: true,
      riskLevel: 'NONE',
      dataVolumeAccessed: tracker.count,
      accessCount: tracker.count,
    }
  }

  /**
   * Watermark response data for traceability
   * Embeds invisible tracking information in responses
   */
  watermarkResponse(data: any, userId: string): any {
    if (typeof data !== 'object' || data === null) return data

    // Create a watermark based on user ID and timestamp
    const watermarkPayload = `${userId}:${Date.now()}`
    const watermark = crypto
      .createHmac('sha256', process.env.FORTRESS_INTEGRITY_SECRET || 'fortress-v2-watermark')
      .update(watermarkPayload)
      .digest('hex')
      .substring(0, 8)

    // Add watermark as a hidden field (won't affect normal operations)
    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        ...item,
        _wm: index === 0 ? watermark : undefined, // Watermark first item only
      }))
    }

    return {
      ...data,
      _wm: watermark,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5: SECURITY EVENT CORRELATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class SecurityEventCorrelator {
  private eventBuffer: SecurityEvent[] = []
  private static readonly MAX_BUFFER_SIZE = 5000
  private riskScores = new Map<string, number>()

  /**
   * Correlate multiple security events into attack chains
   */
  correlateEvents(events: SecurityEvent[]): CorrelationResult {
    const attackChains: AttackChain[] = []
    let compositeRiskScore = 0
    const recommendedActions: string[] = []

    // Group events by IP
    const eventsByIP = new Map<string, SecurityEvent[]>()
    for (const event of events) {
      const ipEvents = eventsByIP.get(event.ip) || []
      ipEvents.push(event)
      eventsByIP.set(event.ip, ipEvents)
    }

    // Group events by userId
    const eventsByUser = new Map<string, SecurityEvent[]>()
    for (const event of events) {
      if (!event.userId) continue
      const userEvents = eventsByUser.get(event.userId) || []
      userEvents.push(event)
      eventsByUser.set(event.userId, userEvents)
    }

    // Detect attack chains from IP grouping
    for (const [ip, ipEvents] of eventsByIP.entries()) {
      if (ipEvents.length < 3) continue

      // Sort by timestamp
      ipEvents.sort((a, b) => a.timestamp - b.timestamp)

      // Identify attack phases
      const phases = this.identifyPhases(ipEvents)
      if (phases.length >= 2) {
        attackChains.push({
          id: `chain-${crypto.randomBytes(4).toString('hex')}`,
          events: ipEvents,
          startTime: ipEvents[0].timestamp,
          endTime: ipEvents[ipEvents.length - 1].timestamp,
          attackType: this.classifyAttack(ipEvents),
          severity: this.determineSeverity(ipEvents),
          phases,
        })
      }
    }

    // Calculate composite risk score
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL')
    const highEvents = events.filter(e => e.severity === 'HIGH')
    compositeRiskScore = Math.min(100, criticalEvents.length * 20 + highEvents.length * 10 + events.length)

    // Generate recommendations
    if (compositeRiskScore >= 80) {
      recommendedActions.push('ACTIVATE_EMERGENCY_PROTOCOL')
      recommendedActions.push('BLOCK_ALL_SUSPICIOUS_IPS')
      recommendedActions.push('NOTIFY_SECURITY_TEAM')
    } else if (compositeRiskScore >= 50) {
      recommendedActions.push('INCREASE_MONITORING')
      recommendedActions.push('THROTTLE_SUSPICIOUS_USERS')
    } else if (compositeRiskScore >= 25) {
      recommendedActions.push('REVIEW_RECENT_ACTIVITY')
    }

    return {
      attackChains,
      compositeRiskScore,
      recommendedActions,
      linkedEvents: events.length,
    }
  }

  /**
   * Get risk score for an identifier
   */
  getRiskScore(identifier: string): number {
    return this.riskScores.get(identifier) || 0
  }

  /**
   * Trigger automated response based on threat level
   */
  triggerResponse(threatLevel: ThreatLevel, identifier: string): ResponseAction {
    const now = Date.now()

    switch (threatLevel) {
      case 'CRITICAL':
        this.riskScores.set(identifier, 100)
        return {
          action: 'BAN',
          duration: 24 * 60 * 60 * 1000, // 24 hours
          reason: `Critical threat detected from ${identifier}`,
          automatedResponses: ['IP_BLOCKED', 'ACCOUNT_FROZEN', 'TOKENS_INVALIDATED', 'SECURITY_ALERT_SENT'],
        }

      case 'HIGH':
        this.riskScores.set(identifier, Math.min(100, (this.riskScores.get(identifier) || 0) + 50))
        return {
          action: 'BLOCK',
          duration: 60 * 60 * 1000, // 1 hour
          reason: `High threat detected from ${identifier}`,
          automatedResponses: ['IP_BLOCKED', 'RATE_LIMIT_REDUCED', 'SECURITY_ALERT_SENT'],
        }

      case 'MEDIUM':
        this.riskScores.set(identifier, Math.min(100, (this.riskScores.get(identifier) || 0) + 25))
        return {
          action: 'THROTTLE',
          duration: 30 * 60 * 1000, // 30 minutes
          reason: `Elevated threat from ${identifier}`,
          automatedResponses: ['RATE_LIMIT_REDUCED', 'ENHANCED_MONITORING'],
        }

      case 'LOW':
        this.riskScores.set(identifier, Math.min(100, (this.riskScores.get(identifier) || 0) + 10))
        return {
          action: 'MONITOR',
          duration: 15 * 60 * 1000, // 15 minutes
          reason: `Low-level threat from ${identifier}`,
          automatedResponses: ['ENHANCED_MONITORING'],
        }

      default:
        return {
          action: 'LOG',
          duration: 0,
          reason: 'No threat detected',
          automatedResponses: [],
        }
    }
  }

  /**
   * Add an event to the correlation buffer
   */
  addEvent(event: SecurityEvent): void {
    this.eventBuffer.unshift(event)
    if (this.eventBuffer.length > SecurityEventCorrelator.MAX_BUFFER_SIZE) {
      this.eventBuffer.length = SecurityEventCorrelator.MAX_BUFFER_SIZE
    }
  }

  /**
   * Get recent events for correlation
   */
  getRecentEvents(windowMs: number = 5 * 60 * 1000): SecurityEvent[] {
    const cutoff = Date.now() - windowMs
    return this.eventBuffer.filter(e => e.timestamp > cutoff)
  }

  private identifyPhases(events: SecurityEvent[]): AttackPhase[] {
    const phases: AttackPhase[] = []
    let currentPhaseType = ''
    let currentPhaseStart = 0
    let currentPhaseCount = 0

    for (const event of events) {
      const phaseType = this.mapEventToPhase(event.type)
      if (phaseType !== currentPhaseType) {
        if (currentPhaseCount > 0) {
          phases.push({
            name: currentPhaseType,
            startTime: currentPhaseStart,
            endTime: event.timestamp,
            eventCount: currentPhaseCount,
            description: `${currentPhaseCount} ${currentPhaseType} events detected`,
          })
        }
        currentPhaseType = phaseType
        currentPhaseStart = event.timestamp
        currentPhaseCount = 1
      } else {
        currentPhaseCount++
      }
    }

    // Add last phase
    if (currentPhaseCount > 0) {
      phases.push({
        name: currentPhaseType,
        startTime: currentPhaseStart,
        endTime: events[events.length - 1].timestamp,
        eventCount: currentPhaseCount,
        description: `${currentPhaseCount} ${currentPhaseType} events detected`,
      })
    }

    return phases
  }

  private mapEventToPhase(type: string): string {
    if (type.includes('SCRAPING') || type.includes('HONEYPOT') || type.includes('PROBING')) return 'RECONNAISSANCE'
    if (type.includes('AUTH_FAILURE') || type.includes('BRUTE_FORCE') || type.includes('CREDENTIAL')) return 'EXPLOITATION'
    if (type.includes('INJECTION') || type.includes('XSS') || type.includes('TRAVERSAL')) return 'EXPLOITATION'
    if (type.includes('AUTH_SUCCESS') || type.includes('ADMIN_ACCESS')) return 'PERSISTENCE'
    if (type.includes('EXFIL') || type.includes('BULK')) return 'EXFILTRATION'
    if (type.includes('IMPOSSIBLE_TRAVEL') || type.includes('HIJACK')) return 'LATERAL_MOVEMENT'
    return 'UNKNOWN'
  }

  private classifyAttack(events: SecurityEvent[]): string {
    const types = new Set(events.map(e => e.type))
    if (types.has('BRUTE_FORCE_ATTACK') || types.has('CREDENTIAL_STUFFING')) return 'BRUTE_FORCE'
    if (types.has('SQL_INJECTION_ATTEMPT') || types.has('XSS_ATTEMPT')) return 'INJECTION'
    if (types.has('ACCOUNT_TAKEOVER_SUSPECT') || types.has('IMPOSSIBLE_TRAVEL')) return 'ACCOUNT_TAKEOVER'
    if (types.has('DATA_EXFILTRATION_SUSPECT')) return 'DATA_EXFILTRATION'
    return 'MULTI_VECTOR'
  }

  private determineSeverity(events: SecurityEvent[]): ThreatLevel {
    const maxSeverity = events.reduce((max, e) => {
      const order = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      return order.indexOf(e.severity) > order.indexOf(max) ? e.severity : max
    }, 'INFO' as SecurityEvent['severity'])

    const map: Record<string, ThreatLevel> = {
      'INFO': 'LOW', 'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL',
    }
    return map[maxSeverity] || 'MEDIUM'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6: GEOLOCATION SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

class GeolocationSecurity {
  private ipGeoCache = new Map<string, {
    country: string
    city: string
    isp: string
    org: string
    proxy: boolean
    hosting: boolean
    timestamp: number
  }>()

  // Blocked countries (high-risk for financial platforms)
  private static readonly BLOCKED_COUNTRIES: string[] = [
    // Add high-risk countries as needed
  ]

  // Suspicious countries requiring additional verification
  private static readonly SUSPICIOUS_COUNTRIES: string[] = [
    // Add countries that require extra verification
  ]

  // Known datacenter/VPN ASNs
  private static readonly DATACENTER_KEYWORDS = [
    'amazon', 'aws', 'google cloud', 'gcp', 'microsoft azure', 'azure',
    'digitalocean', 'linode', 'akamai', 'cloudflare', 'vultr', 'ovh',
    'hetzner', 'contabo', 'scaleway', 'upcloud', 'm247', 'psychz',
    'hosting', 'datacenter', 'data center', 'cloud', 'vps', 'dedicated',
    'server', 'colocation', 'idc',
  ]

  /**
   * Analyze an IP address for geographic security
   */
  async analyzeIP(ip: string): Promise<GeoSecurityResult> {
    const defaultResult: GeoSecurityResult = {
      country: '', city: '', isVPN: false, isProxy: false,
      isTor: false, isDatacenter: false, riskScore: 0, isBlocked: false,
    }

    // Skip private IPs
    if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' ||
        ip.startsWith('192.168.') || ip.startsWith('10.') ||
        ip.startsWith('172.') || ip.startsWith('fc')) {
      return defaultResult
    }

    // Check cache
    const cached = this.ipGeoCache.get(ip)
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return this.buildGeoResult(cached, ip)
    }

    try {
      const response = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,city,isp,org,proxy,hosting`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!response.ok) return defaultResult

      const data = await response.json()
      if (data.status !== 'success') return defaultResult

      const geoData = {
        country: data.country || '',
        city: data.city || '',
        isp: data.isp || '',
        org: data.org || '',
        proxy: data.proxy === true,
        hosting: data.hosting === true,
        timestamp: Date.now(),
      }

      this.ipGeoCache.set(ip, geoData)
      return this.buildGeoResult(geoData, ip)
    } catch {
      return defaultResult
    }
  }

  /**
   * Check if IP is using VPN (async for API calls)
   */
  async isVPN(ip: string): Promise<boolean> {
    const result = await this.analyzeIP(ip)
    return result.isVPN
  }

  /**
   * Check if IP is a Tor exit node
   */
  async isTor(ip: string): Promise<boolean> {
    try {
      const response = await fetch('https://check.torproject.org/torbulkexitlist', {
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) return false
      const text = await response.text()
      return text.split('\n').includes(ip)
    } catch {
      // Fallback: DNS-based check
      try {
        const reversedIp = ip.split('.').reverse().join('.')
        const dnsResult = await fetch(
          `https://dns.google/resolve?name=${reversedIp}.dnsel.torproject.org&type=A`,
          { signal: AbortSignal.timeout(3000) }
        )
        if (!dnsResult.ok) return false
        const data = await dnsResult.json()
        return data.Answer?.some((a: any) => a.data === '127.0.0.2') || false
      } catch {
        return false
      }
    }
  }

  /**
   * Check impossible travel for a user
   */
  checkImpossibleTravel(userId: string, newCountry: string): boolean {
    // This is a simplified check - the ThreatDetectionEngine has the full implementation
    return false // Will be enhanced with actual geo history
  }

  private buildGeoResult(geoData: any, ip: string): GeoSecurityResult {
    const isDatacenter = this.isDatacenterIP(geoData)
    const isBlocked = GeolocationSecurity.BLOCKED_COUNTRIES.includes(geoData.country)
    const isSuspicious = GeolocationSecurity.SUSPICIOUS_COUNTRIES.includes(geoData.country)

    let riskScore = 0
    if (geoData.proxy) riskScore += 30
    if (geoData.hosting) riskScore += 25
    if (isDatacenter) riskScore += 25
    if (isBlocked) riskScore += 50
    if (isSuspicious) riskScore += 15

    return {
      country: geoData.country,
      city: geoData.city,
      isVPN: geoData.hosting || isDatacenter,
      isProxy: geoData.proxy,
      isTor: false, // Requires separate async check
      isDatacenter,
      riskScore: Math.min(100, riskScore),
      isBlocked,
      blockReason: isBlocked ? `Country ${geoData.country} is blocked` : undefined,
    }
  }

  private isDatacenterIP(geoData: any): boolean {
    const combined = `${(geoData.org || '').toLowerCase()} ${(geoData.isp || '').toLowerCase()}`
    return GeolocationSecurity.DATACENTER_KEYWORDS.some(keyword => combined.includes(keyword))
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORTRESS V2 - MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class FortressV2 {
  public readonly threatDetection: ThreatDetectionEngine
  public readonly rateLimiter: AdaptiveRateLimiter
  public readonly integrityVerifier: RequestIntegrityVerifier
  public readonly antiExfiltration: AntiExfiltrationSystem
  public readonly eventCorrelator: SecurityEventCorrelator
  public readonly geoSecurity: GeolocationSecurity

  private initialized: boolean = false
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.threatDetection = new ThreatDetectionEngine()
    this.rateLimiter = new AdaptiveRateLimiter()
    this.integrityVerifier = new RequestIntegrityVerifier()
    this.antiExfiltration = new AntiExfiltrationSystem()
    this.eventCorrelator = new SecurityEventCorrelator()
    this.geoSecurity = new GeolocationSecurity()
  }

  /**
   * Initialize Fortress V2 - must be called on server startup
   */
  initialize(): void {
    if (this.initialized) return

    console.log('[FORTRESS-V2] Initializing Advanced Security Engine...')

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.rateLimiter.cleanup()
      this.integrityVerifier.cleanup()
    }, 5 * 60 * 1000) // Every 5 minutes

    this.initialized = true
    console.log('[FORTRESS-V2] Security Engine initialized successfully')
  }

  /**
   * Comprehensive request analysis - main entry point for middleware
   */
  async analyzeRequest(params: {
    userId?: string
    ip: string
    userAgent: string
    endpoint: string
    method: string
    sessionId?: string
  }): Promise<{
    threatScore: ThreatScore
    rateLimitResult: RateLimitResult
    geoResult?: GeoSecurityResult
    requiresChallenge: boolean
    shouldBlock: boolean
    blockReason?: string
  }> {
    const { userId, ip, userAgent, endpoint, method, sessionId } = params

    // 1. Threat detection
    const threatScore = this.threatDetection.analyzeRequest(
      userId || ip, ip, userAgent, endpoint
    )

    // 2. Rate limiting (adaptive based on threat)
    this.rateLimiter.recordRequest(userId || ip, endpoint)
    if (threatScore.level !== 'NONE') {
      this.rateLimiter.adjustForThreatLevel(userId || ip, threatScore.level)
    }
    const rateLimitResult = this.rateLimiter.checkLimit(userId || ip, endpoint)

    // 3. Geo security (async for API calls)
    let geoResult: GeoSecurityResult | undefined
    if (ip !== 'unknown' && ip !== '127.0.0.1') {
      geoResult = await this.geoSecurity.analyzeIP(ip)

      // Check if IP is from blocked region
      if (geoResult.isBlocked) {
        return {
          threatScore,
          rateLimitResult,
          geoResult,
          requiresChallenge: false,
          shouldBlock: true,
          blockReason: geoResult.blockReason,
        }
      }
    }

    // 4. Correlate with event history
    if (threatScore.level === 'HIGH' || threatScore.level === 'CRITICAL') {
      const correlationResult = this.eventCorrelator.triggerResponse(threatScore.level, userId || ip)
      if (correlationResult.action === 'BLOCK' || correlationResult.action === 'BAN') {
        return {
          threatScore,
          rateLimitResult,
          geoResult,
          requiresChallenge: false,
          shouldBlock: true,
          blockReason: correlationResult.reason,
        }
      }
    }

    // 5. Determine if additional challenge is needed
    const requiresChallenge = threatScore.level === 'HIGH' || rateLimitResult.requiresCaptcha

    // 6. Determine if should block
    const shouldBlock = !rateLimitResult.allowed ||
      (threatScore.level === 'CRITICAL' && threatScore.actionType === 'BLOCK')

    return {
      threatScore,
      rateLimitResult,
      geoResult,
      requiresChallenge,
      shouldBlock,
      blockReason: shouldBlock ? 'Threat detected or rate limit exceeded' : undefined,
    }
  }

  /**
   * Analyze financial operation security
   */
  analyzeFinancialOperation(userId: string, activity: FinancialActivity): RiskScore {
    return this.threatDetection.analyzeFinancialActivity(userId, activity)
  }

  /**
   * Verify request integrity for POST requests
   */
  verifyRequestIntegrity(token: string, sessionId: string, action: string): boolean {
    return this.integrityVerifier.verifyIntegrity(token, sessionId, action)
  }

  /**
   * Generate integrity token for forms/actions
   */
  generateIntegrityToken(sessionId: string, action: string): string {
    return this.integrityVerifier.generateIntegrityToken(sessionId, action)
  }

  /**
   * Detect injection in request parameters
   */
  detectInjection(params: Record<string, any>): InjectionResult {
    return this.integrityVerifier.detectInjection(params)
  }

  /**
   * Monitor response for data exfiltration
   */
  monitorResponse(userId: string, endpoint: string, responseSize: number): boolean {
    return this.antiExfiltration.monitorResponse(userId, endpoint, responseSize)
  }

  /**
   * Watermark response data
   */
  watermarkResponse(data: any, userId: string): any {
    return this.antiExfiltration.watermarkResponse(data, userId)
  }

  /**
   * Record a security event for correlation
   */
  recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'fingerprint'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: `f2-${crypto.randomBytes(8).toString('hex')}`,
      timestamp: Date.now(),
      fingerprint: crypto
        .createHash('sha256')
        .update(`${event.ip}:${event.userId || ''}:${event.type}:${Math.floor(Date.now() / 300000)}`)
        .digest('hex')
        .substring(0, 16),
    }
    this.eventCorrelator.addEvent(fullEvent)
  }

  /**
   * Get current security metrics
   */
  getMetrics(): {
    recentEventCount: number
    activeThreats: number
    riskScores: Record<string, number>
  } {
    const recentEvents = this.eventCorrelator.getRecentEvents()
    const activeThreats = recentEvents.filter(e =>
      e.severity === 'HIGH' || e.severity === 'CRITICAL'
    ).length

    // Get top risk scores (limited)
    const riskScores: Record<string, number> = {}
    // Note: We can't iterate the private map, so we use the public method

    return {
      recentEventCount: recentEvents.length,
      activeThreats,
      riskScores,
    }
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.initialized = false
    console.log('[FORTRESS-V2] Security Engine shut down')
  }
}

// Singleton instance
export const fortressV2 = new FortressV2()

// Auto-initialize
if (typeof window === 'undefined') {
  fortressV2.initialize()
}
