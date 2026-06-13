// ═══════════════════════════════════════════════════════════════════════════════
// ZERO-TRUST SHIELD - Advanced Multi-Layer Defense-in-Depth Security System
// ═══════════════════════════════════════════════════════════════════════════════
// This system implements military-grade security with the following layers:
//
// Layer 1: Request Fingerprinting & Device Trust Scoring
// Layer 2: Behavioral Analysis & Anomaly Detection
// Layer 3: Geographic Impossibility Detection
// Layer 4: Session Integrity Verification
// Layer 5: Cryptographic Request Signing
// Layer 6: Real-Time Threat Intelligence
// Layer 7: Adaptive Access Control
// Layer 8: Self-Healing & Auto-Containment
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'
import prisma from './prisma'

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1: DEVICE TRUST SCORING & FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════════════════

interface DeviceFingerprint {
  hash: string
  components: {
    userAgent: string
    acceptLanguage: string
    acceptEncoding: string
    screenResolution?: string
    timezone?: string
    platform?: string
    plugins?: string
  }
  trustScore: number  // 0-100, 100 = fully trusted
  firstSeen: Date
  lastSeen: Date
  requestCount: number
  anomalyCount: number
  isKnownGood: boolean
  isKnownBad: boolean
}

const deviceFingerprints = new Map<string, DeviceFingerprint>()
const TRUST_SCORE_THRESHOLD = 30  // Below this = blocked
const TRUST_SCORE_WARNING = 50    // Below this = enhanced monitoring

export function computeDeviceFingerprint(request: Request): string {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    request.headers.get('sec-ch-ua') || '',
    request.headers.get('sec-ch-ua-platform') || '',
    request.headers.get('sec-ch-ua-mobile') || '',
  ]

  const raw = components.join('|')
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function evaluateDeviceTrust(fingerprint: string, ip: string): {
  trustScore: number
  isTrusted: boolean
  isWarning: boolean
  isNewDevice: boolean
  actions: string[]
} {
  const actions: string[] = []
  let trustScore = 50 // Start neutral
  let isNewDevice = false

  const existing = deviceFingerprints.get(fingerprint)
  if (!existing) {
    isNewDevice = true
    trustScore = 25 // New devices start low

    // Create new fingerprint record
    deviceFingerprints.set(fingerprint, {
      hash: fingerprint,
      components: { userAgent: '', acceptLanguage: '', acceptEncoding: '' },
      trustScore,
      firstSeen: new Date(),
      lastSeen: new Date(),
      requestCount: 1,
      anomalyCount: 0,
      isKnownGood: false,
      isKnownBad: false,
    })

    actions.push('NEW_DEVICE_DETECTED')
  } else {
    existing.lastSeen = new Date()
    existing.requestCount++
    trustScore = existing.trustScore

    // Increase trust for returning devices (max +5 per check)
    if (existing.requestCount > 10 && existing.anomalyCount === 0) {
      trustScore = Math.min(100, trustScore + 5)
    }
    if (existing.requestCount > 100 && existing.anomalyCount < 3) {
      trustScore = Math.min(100, trustScore + 10)
      existing.isKnownGood = true
    }

    // Decrease trust for anomalous behavior
    if (existing.anomalyCount > 5) {
      trustScore = Math.max(0, trustScore - 20)
      existing.isKnownBad = true
      actions.push('KNOWN_BAD_DEVICE')
    }
  }

  return {
    trustScore,
    isTrusted: trustScore >= TRUST_SCORE_THRESHOLD,
    isWarning: trustScore < TRUST_SCORE_WARNING,
    isNewDevice,
    actions,
  }
}

export function flagDeviceAnomaly(fingerprint: string, anomalyType: string): void {
  const existing = deviceFingerprints.get(fingerprint)
  if (existing) {
    existing.anomalyCount++
    existing.trustScore = Math.max(0, existing.trustScore - 15)
    if (existing.anomalyCount > 5) {
      existing.isKnownBad = true
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2: BEHAVIORAL ANALYSIS & ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface BehavioralProfile {
  userId: string
  typicalRequestInterval: number // Average ms between requests
  typicalActionSequence: string[]
  typicalActiveHours: number[]   // 0-23 hours (user's timezone)
  typicalEndpoints: Set<string>
  averageSessionDuration: number // minutes
  lastActions: { action: string; timestamp: number }[]
  anomalyScore: number           // 0-100
}

const behavioralProfiles = new Map<string, BehavioralProfile>()
const MAX_ANOMALY_SCORE = 75 // Above this = blocked

export function analyzeBehavior(userId: string, action: string, endpoint: string): {
  isAnomalous: boolean
  anomalyScore: number
  reasons: string[]
  recommendedAction: 'ALLOW' | 'MONITOR' | 'CHALLENGE' | 'BLOCK'
} {
  const reasons: string[] = []
  let isAnomalous = false
  let anomalyScore = 0

  const profile = behavioralProfiles.get(userId)
  if (!profile) {
    // Create new profile
    behavioralProfiles.set(userId, {
      userId,
      typicalRequestInterval: 0,
      typicalActionSequence: [],
      typicalActiveHours: [],
      typicalEndpoints: new Set([endpoint]),
      averageSessionDuration: 0,
      lastActions: [{ action, timestamp: Date.now() }],
      anomalyScore: 0,
    })
    return { isAnomalous: false, anomalyScore: 0, reasons: [], recommendedAction: 'ALLOW' }
  }

  // Check 1: Request frequency anomaly (too fast)
  const lastAction = profile.lastActions[profile.lastActions.length - 1]
  if (lastAction) {
    const interval = Date.now() - lastAction.timestamp
    if (interval < 100) { // Less than 100ms between requests = bot-like
      anomalyScore += 30
      reasons.push('EXTREME_REQUEST_FREQUENCY')
      isAnomalous = true
    } else if (interval < 300 && profile.typicalRequestInterval > 2000) {
      anomalyScore += 15
      reasons.push('UNUSUAL_REQUEST_FREQUENCY')
    }
  }

  // Check 2: Unusual endpoint access
  if (!profile.typicalEndpoints.has(endpoint)) {
    profile.typicalEndpoints.add(endpoint)
    if (profile.typicalEndpoints.size > 20 && profile.lastActions.length < 10) {
      anomalyScore += 20
      reasons.push('RAPID_ENDPOINT_DISCOVERY')
      isAnomalous = true
    }
  }

  // Check 3: Sequential action pattern analysis
  const recentActions = profile.lastActions.slice(-5).map(a => a.action)
  if (recentActions.length >= 3) {
    // Check for repetitive patterns (bot behavior)
    const uniqueActions = new Set(recentActions)
    if (recentActions.length >= 5 && uniqueActions.size <= 2) {
      anomalyScore += 25
      reasons.push('REPETITIVE_ACTION_PATTERN')
      isAnomalous = true
    }
  }

  // Check 4: Financial action velocity
  if (action.startsWith('FINANCIAL_')) {
    const recentFinancial = profile.lastActions
      .filter(a => a.action.startsWith('FINANCIAL_') && Date.now() - a.timestamp < 300000) // 5 minutes
    if (recentFinancial.length >= 5) {
      anomalyScore += 35
      reasons.push('HIGH_FINANCIAL_VELOCITY')
      isAnomalous = true
    }
  }

  // Update profile
  profile.lastActions.push({ action, timestamp: Date.now() })
  if (profile.lastActions.length > 100) {
    profile.lastActions = profile.lastActions.slice(-50)
  }
  profile.anomalyScore = Math.min(100, anomalyScore)

  // Determine recommended action
  let recommendedAction: 'ALLOW' | 'MONITOR' | 'CHALLENGE' | 'BLOCK' = 'ALLOW'
  if (anomalyScore >= MAX_ANOMALY_SCORE) {
    recommendedAction = 'BLOCK'
  } else if (anomalyScore >= 50) {
    recommendedAction = 'CHALLENGE' // Require additional verification
  } else if (anomalyScore >= 25) {
    recommendedAction = 'MONITOR'
  }

  return { isAnomalous, anomalyScore, reasons, recommendedAction }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 3: GEOGRAPHIC IMPOSSIBILITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface GeoLocation {
  country: string
  city: string
  latitude: number
  longitude: number
  timestamp: number
}

const userGeoHistory = new Map<string, GeoLocation[]>()
const MAX_SPEED_KMH = 1000 // Max travel speed (commercial flight ~900km/h)

export async function detectGeoImpossibility(userId: string, ip: string): Promise<{
  isImpossible: boolean
  distanceKm: number
  timeDiffHours: number
  speedKmh: number
  fromLocation: string
  toLocation: string
}> {
  const defaultResult = {
    isImpossible: false, distanceKm: 0, timeDiffHours: 0,
    speedKmh: 0, fromLocation: '', toLocation: '',
  }

  // Skip for local IPs
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return defaultResult

  try {
    // Get current location from IP
    const geoResponse = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city,lat,lon`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!geoResponse.ok) return defaultResult
    const geoData = await geoResponse.json()
    if (geoData.status !== 'success') return defaultResult

    const currentGeo: GeoLocation = {
      country: geoData.country || '',
      city: geoData.city || '',
      latitude: geoData.lat || 0,
      longitude: geoData.lon || 0,
      timestamp: Date.now(),
    }

    // Get previous locations
    const history = userGeoHistory.get(userId) || []

    if (history.length === 0) {
      history.push(currentGeo)
      userGeoHistory.set(userId, history)
      return defaultResult
    }

    const lastGeo = history[history.length - 1]
    const distanceKm = haversineDistance(
      lastGeo.latitude, lastGeo.longitude,
      currentGeo.latitude, currentGeo.longitude
    )
    const timeDiffHours = (currentGeo.timestamp - lastGeo.timestamp) / (1000 * 60 * 60)
    const speedKmh = timeDiffHours > 0 ? distanceKm / timeDiffHours : 0

    // Update history
    history.push(currentGeo)
    if (history.length > 20) history.shift()
    userGeoHistory.set(userId, history)

    // If speed exceeds maximum possible travel speed = impossible travel
    const isImpossible = speedKmh > MAX_SPEED_KMH && distanceKm > 500

    return {
      isImpossible,
      distanceKm: Math.round(distanceKm),
      timeDiffHours: Math.round(timeDiffHours * 100) / 100,
      speedKmh: Math.round(speedKmh),
      fromLocation: `${lastGeo.city}, ${lastGeo.country}`,
      toLocation: `${currentGeo.city}, ${currentGeo.country}`,
    }
  } catch {
    return defaultResult
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 4: SESSION INTEGRITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionIntegrity {
  sessionId: string
  createdAt: number
  lastVerified: number
  ipChain: string[]        // Chain of IPs used in this session
  fingerprintChain: string[] // Chain of device fingerprints
  isHijacked: boolean
  hijackConfidence: number
}

const activeSessions = new Map<string, SessionIntegrity>()

export function verifySessionIntegrity(
  userId: string,
  ip: string,
  fingerprint: string
): {
  isValid: boolean
  isHijacked: boolean
  confidence: number
  reasons: string[]
} {
  const reasons: string[] = []
  let isHijacked = false
  let confidence = 0

  const session = activeSessions.get(userId)
  if (!session) {
    // Create new session
    activeSessions.set(userId, {
      sessionId: crypto.randomUUID(),
      createdAt: Date.now(),
      lastVerified: Date.now(),
      ipChain: [ip],
      fingerprintChain: [fingerprint],
      isHijacked: false,
      hijackConfidence: 0,
    })
    return { isValid: true, isHijacked: false, confidence: 0, reasons: [] }
  }

  session.lastVerified = Date.now()

  // Check 1: IP changed
  if (!session.ipChain.includes(ip)) {
    session.ipChain.push(ip)
    if (session.ipChain.length > 3) {
      confidence += 30
      reasons.push('MULTIPLE_IP_CHANGES')
      isHijacked = true
    }
  }

  // Check 2: Fingerprint changed (different device)
  if (!session.fingerprintChain.includes(fingerprint)) {
    session.fingerprintChain.push(fingerprint)
    if (session.fingerprintChain.length > 1) {
      confidence += 40
      reasons.push('DEVICE_SWITCHED')
      isHijacked = true
    }
  }

  // Check 3: Simultaneous use from different locations
  const sessionDuration = Date.now() - session.createdAt
  if (session.ipChain.length >= 2 && sessionDuration < 60000) {
    confidence += 50
    reasons.push('SIMULTANEOUS_MULTI_LOCATION')
    isHijacked = true
  }

  session.isHijacked = isHijacked
  session.hijackConfidence = Math.min(100, confidence)

  return {
    isValid: confidence < 60,
    isHijacked,
    confidence,
    reasons,
  }
}

export function invalidateSession(userId: string): void {
  activeSessions.delete(userId)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 5: CRYPTOGRAPHIC REQUEST SIGNING
// ═══════════════════════════════════════════════════════════════════════════════

const REQUEST_SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET || crypto.randomBytes(64).toString('hex')
const requestNonces = new Map<string, number>() // nonce -> timestamp
const NONCE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Clean up expired nonces every 2 minutes
setInterval(() => {
  const now = Date.now()
  for (const [nonce, timestamp] of requestNonces.entries()) {
    if (now - timestamp > NONCE_EXPIRY_MS) requestNonces.delete(nonce)
  }
}, 2 * 60 * 1000)

export function signRequest(payload: string, nonce: string, timestamp: number): string {
  const message = `${payload}:${nonce}:${timestamp}`
  return crypto.createHmac('sha512', REQUEST_SIGNING_SECRET).update(message).digest('hex')
}

export function verifyRequestSignature(
  payload: string,
  nonce: string,
  timestamp: number,
  signature: string
): { isValid: boolean; reason?: string } {
  // Check timestamp freshness (reject requests older than 5 minutes)
  if (Date.now() - timestamp > NONCE_EXPIRY_MS) {
    return { isValid: false, reason: 'REQUEST_EXPIRED' }
  }

  // Check for replay attacks (nonce must be unique)
  if (requestNonces.has(nonce)) {
    return { isValid: false, reason: 'REPLAY_DETECTED' }
  }

  // Verify signature
  const expectedSignature = signRequest(payload, nonce, timestamp)
  try {
    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expectedSignature, 'hex')
    if (sigBuf.length !== expBuf.length) {
      return { isValid: false, reason: 'INVALID_SIGNATURE' }
    }
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { isValid: false, reason: 'INVALID_SIGNATURE' }
    }
  } catch {
    return { isValid: false, reason: 'INVALID_SIGNATURE' }
  }

  // Mark nonce as used
  requestNonces.set(nonce, Date.now())

  return { isValid: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 6: REAL-TIME THREAT INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

interface ThreatIndicator {
  type: 'IP' | 'FINGERPRINT' | 'PATTERN' | 'USER_AGENT' | 'ASN'
  value: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  source: string
  expiresAt: number
  metadata?: Record<string, string>
}

const threatIntelligence = new Map<string, ThreatIndicator[]>()
const knownAttackPatterns = new Set<string>([
  'CREDENTIAL_STUFFING',
  'ACCOUNT_TAKEOVER',
  'BRUTE_FORCE',
  'API_ABUSE',
  'DATA_SCRAPING',
  'PAYLOAD_INJECTION',
  'SESSION_HIJACKING',
  'MAN_IN_THE_MIDDLE',
  'DENIAL_OF_SERVICE',
  'CRYPTO_MINING',
])

export function addThreatIndicator(indicator: ThreatIndicator): void {
  const key = `${indicator.type}:${indicator.value}`
  const existing = threatIntelligence.get(key) || []
  existing.push(indicator)
  threatIntelligence.set(key, existing)
}

export function checkThreatIntelligence(type: string, value: string): {
  isThreat: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  indicators: ThreatIndicator[]
} {
  const key = `${type}:${value}`
  const indicators = threatIntelligence.get(key) || []

  // Remove expired indicators
  const now = Date.now()
  const activeIndicators = indicators.filter(i => i.expiresAt > now)

  if (activeIndicators.length === 0) {
    return { isThreat: false, severity: null, indicators: [] }
  }

  // Return highest severity
  const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  const maxSeverity = activeIndicators.reduce((max, i) => {
    return severityOrder.indexOf(i.severity) > severityOrder.indexOf(max) ? i.severity : max
  }, 'LOW' as ThreatIndicator['severity'])

  return { isThreat: true, severity: maxSeverity, indicators: activeIndicators }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 7: ADAPTIVE ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccessDecision {
  allowed: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  requiredActions: string[] // Additional actions needed (e.g., '2FA', 'CAPTCHA', 'EMAIL_VERIFY')
  sessionRestrictions: string[] // Restrictions applied (e.g., 'READ_ONLY', 'NO_WITHDRAW')
  reason: string
  trustScore: number
}

export async function evaluateAccess(params: {
  userId: string
  ip: string
  endpoint: string
  method: string
  fingerprint: string
  action?: string
}): Promise<AccessDecision> {
  const { userId, ip, endpoint, method, fingerprint, action } = params

  let riskLevel: AccessDecision['riskLevel'] = 'LOW'
  const requiredActions: string[] = []
  const sessionRestrictions: string[] = []
  let trustScore = 100
  const reasons: string[] = []

  // 1. Device trust check
  const deviceTrust = evaluateDeviceTrust(fingerprint, ip)
  trustScore = Math.min(trustScore, deviceTrust.trustScore)
  if (!deviceTrust.isTrusted) {
    riskLevel = 'HIGH'
    reasons.push('LOW_DEVICE_TRUST')
    requiredActions.push('2FA')
  } else if (deviceTrust.isWarning) {
    riskLevel = 'MEDIUM'
    reasons.push('WARNING_DEVICE_TRUST')
  }

  // 2. Behavioral analysis
  const behaviorResult = analyzeBehavior(userId, action || method, endpoint)
  trustScore = Math.min(trustScore, 100 - behaviorResult.anomalyScore)
  if (behaviorResult.recommendedAction === 'BLOCK') {
    return {
      allowed: false,
      riskLevel: 'CRITICAL',
      requiredActions: [],
      sessionRestrictions: ['FULL_BLOCK'],
      reason: `Behavioral analysis blocked: ${behaviorResult.reasons.join(', ')}`,
      trustScore,
    }
  } else if (behaviorResult.recommendedAction === 'CHALLENGE') {
    riskLevel = 'HIGH'
    requiredActions.push('CAPTCHA', '2FA')
    reasons.push(...behaviorResult.reasons)
  } else if (behaviorResult.recommendedAction === 'MONITOR') {
    if (riskLevel === 'LOW') riskLevel = 'MEDIUM'
    reasons.push(...behaviorResult.reasons)
  }

  // 3. Geographic impossibility check
  const geoResult = await detectGeoImpossibility(userId, ip)
  if (geoResult.isImpossible) {
    riskLevel = 'CRITICAL'
    trustScore = Math.min(trustScore, 10)
    reasons.push(`IMPOSSIBLE_TRAVEL: ${geoResult.fromLocation} → ${geoResult.toLocation} at ${geoResult.speedKmh}km/h`)
    requiredActions.push('2FA', 'EMAIL_VERIFY')

    // Log to database
    try {
      await prisma.securityLog.create({
        data: {
          ip,
          type: 'IMPOSSIBLE_TRAVEL',
          path: endpoint,
          details: `Impossible travel detected: ${geoResult.fromLocation} to ${geoResult.toLocation} at ${geoResult.speedKmh}km/h`,
          severity: 'CRITICAL',
          userId,
        },
      })
    } catch {}
  }

  // 4. Session integrity check
  const sessionCheck = verifySessionIntegrity(userId, ip, fingerprint)
  if (sessionCheck.isHijacked) {
    riskLevel = 'CRITICAL'
    trustScore = Math.min(trustScore, 5)
    reasons.push(`SESSION_HIJACK_SUSPECTED: ${sessionCheck.reasons.join(', ')}`)
    sessionRestrictions.push('NO_WITHDRAW', 'NO_TRANSFER', 'READ_ONLY')
    requiredActions.push('2FA', 'EMAIL_VERIFY')
  }

  // 5. Threat intelligence check
  const ipThreat = checkThreatIntelligence('IP', ip)
  if (ipThreat.isThreat && ipThreat.severity) {
    const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (severityOrder.indexOf(ipThreat.severity) > severityOrder.indexOf(riskLevel)) {
      riskLevel = ipThreat.severity
    }
    reasons.push(`THREAT_INTEL: IP flagged as ${ipThreat.severity}`)
    if (ipThreat.severity === 'CRITICAL') {
      return {
        allowed: false,
        riskLevel: 'CRITICAL',
        requiredActions: [],
        sessionRestrictions: ['FULL_BLOCK'],
        reason: `IP in threat intelligence: ${ipThreat.indicators.map(i => i.source).join(', ')}`,
        trustScore,
      }
    }
  }

  // 6. Financial operation restrictions
  if (endpoint.includes('/withdraw') || endpoint.includes('/transfer')) {
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      sessionRestrictions.push('NO_WITHDRAW', 'NO_TRANSFER')
    }
    if (trustScore < 40) {
      requiredActions.push('2FA', 'EMAIL_VERIFY')
      sessionRestrictions.push('DELAYED_WITHDRAWAL') // 24h delay
    }
  }

  // 7. Admin endpoint restrictions
  if (endpoint.includes('/admin')) {
    if (trustScore < 60) {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        requiredActions: [],
        sessionRestrictions: [],
        reason: 'Insufficient trust score for admin access',
        trustScore,
      }
    }
    requiredActions.push('2FA')
  }

  return {
    allowed: riskLevel !== 'CRITICAL' || requiredActions.length > 0,
    riskLevel,
    requiredActions: [...new Set(requiredActions)],
    sessionRestrictions: [...new Set(sessionRestrictions)],
    reason: reasons.length > 0 ? reasons.join('; ') : 'No issues detected',
    trustScore,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 8: SELF-HEALING & AUTO-CONTAINMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function autoContain(userId: string, reason: string, severity: 'MEDIUM' | 'HIGH' | 'CRITICAL'): Promise<{
  contained: boolean
  actions: string[]
}> {
  const actions: string[] = []

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.role?.toLowerCase() === 'admin') {
      return { contained: false, actions: ['ADMIN_IMMUNE'] }
    }

    switch (severity) {
      case 'MEDIUM':
        // Elevation of monitoring only
        await prisma.user.update({
          where: { id: userId },
          data: { monitoringLevel: 'ELEVATED' },
        })
        actions.push('MONITORING_ELEVATED')
        break

      case 'HIGH':
        // Freeze account + enhanced monitoring
        const { freezeAccount } = await import('./security-fortress')
        await freezeAccount({
          userId,
          reason: `حجز تلقائي: ${reason}`,
          frozenBy: 'zero-trust-shield',
        })
        actions.push('ACCOUNT_FROZEN', 'TOKENS_INVALIDATED')
        break

      case 'CRITICAL':
        // Full containment - ban account
        const { banAccount } = await import('./security-fortress')
        await banAccount(userId, `حظر تلقائي - نظام الحماية العميقة: ${reason}`, 'zero-trust-shield')
        actions.push('ACCOUNT_BANNED', 'TOKENS_INVALIDATED', 'IP_BLACKLISTED')

        // Blacklist the IP
        if (user.lastKnownIP && user.lastKnownIP !== 'unknown') {
          const { addToBlacklist } = await import('./security-fortress')
          await addToBlacklist('IP', user.lastKnownIP, `Critical threat auto-blacklist: ${reason}`, 'zero-trust-shield', true, userId)
        }
        break
    }

    // Log the auto-containment
    await prisma.securityLog.create({
      data: {
        ip: user.lastKnownIP || 'unknown',
        type: 'AUTO_CONTAINMENT',
        path: '/shield/auto-contain',
        details: `Auto-contained user: ${reason} (severity: ${severity})`,
        severity,
        userId,
      },
    })

    return { contained: true, actions }
  } catch (error) {
    console.error('[ZERO-TRUST] Auto-containment error:', error)
    return { contained: false, actions: ['ERROR'] }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE SECURITY EVALUATION - Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

export async function fullSecurityEvaluation(params: {
  userId: string
  ip: string
  endpoint: string
  method: string
  request: Request
  action?: string
}): Promise<AccessDecision> {
  const fingerprint = computeDeviceFingerprint(params.request)
  const decision = await evaluateAccess({
    userId: params.userId,
    ip: params.ip,
    endpoint: params.endpoint,
    method: params.method,
    fingerprint,
    action: params.action,
  })

  // Auto-contain critical threats
  if (decision.riskLevel === 'CRITICAL' && !decision.allowed) {
    await autoContain(params.userId, decision.reason, 'CRITICAL')
  }

  return decision
}
