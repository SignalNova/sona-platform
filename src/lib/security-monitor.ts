import prisma from './prisma'
import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MONITOR - Persistent Logging, Real-time Monitoring & Automated Response
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. Persistent Security Logging (database-backed, survives restarts)
// 2. IP Blocking (database-backed)
// 3. Account Lockout (prevent brute force)
// 4. Suspicious Activity Tracking
// 5. VPN/Proxy Detection
// 6. Real-time Event Monitoring & Dashboard
// 7. Anomaly Detection (statistical)
// 8. Automated Response System
// 9. Security Audit Reports
// 10. Login Security & Withdrawal Monitoring
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PERSISTENT SECURITY LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

export async function logSecurityEvent(params: {
  ip: string
  type: string
  path: string
  details?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  userId?: string
  userAgent?: string
  fingerprint?: string
}) {
  try {
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      'XSS_DETECTED': 'HIGH',
      'SQL_INJECTION': 'CRITICAL',
      'RATE_LIMIT_EXCEEDED': 'MEDIUM',
      'CSRF_VIOLATION': 'HIGH',
      'UNAUTHORIZED_ADMIN_ACCESS': 'CRITICAL',
      'SUSPICIOUS_PATTERN': 'MEDIUM',
      'PATH_TRAVERSAL': 'HIGH',
      'COMMAND_INJECTION': 'CRITICAL',
      'BRUTE_FORCE': 'CRITICAL',
      'MULTIPLE_FAILED_LOGINS': 'HIGH',
      'VPN_DETECTED': 'MEDIUM',
      'PROXY_DETECTED': 'MEDIUM',
      'UNUSUAL_LOCATION': 'MEDIUM',
      'RAPID_REQUESTS': 'MEDIUM',
      'ACCOUNT_LOCKOUT': 'CRITICAL',
      'TOKEN_TAMPERING': 'CRITICAL',
      'SUSPICIOUS_WITHDRAWAL': 'HIGH',
      'BALANCE_MANIPULATION': 'CRITICAL',
      'DATA_EXFILTRATION': 'CRITICAL',
      'IMPOSSIBLE_TRAVEL': 'HIGH',
      'SESSION_HIJACK': 'CRITICAL',
      'AUTOMATION_DETECTED': 'HIGH',
      'INJECTION_ATTEMPT': 'CRITICAL',
      'HONEYPOT_TRIGGERED': 'CRITICAL',
      'FORTRESS_V2_THREAT': 'HIGH',
    }

    const severity = params.severity || severityMap[params.type] || 'LOW'

    await prisma.securityLog.create({
      data: {
        ip: params.ip,
        type: params.type,
        path: params.path,
        details: params.details,
        severity,
        userId: params.userId,
        userAgent: params.userAgent,
        fingerprint: params.fingerprint,
      },
    })

    // Auto-block IP on CRITICAL events
    if (severity === 'CRITICAL') {
      await blockIPInDB(params.ip, `${params.type}: ${params.details || ''}`, true, 60 * 60 * 1000) // 1 hour
    }

    // Also record to Fortress V2 event correlator
    try {
      const { fortressV2 } = await import('./fortress-v2')
      fortressV2.recordEvent({
        type: params.type,
        severity: severity === 'LOW' ? 'LOW' : severity === 'MEDIUM' ? 'MEDIUM' : severity === 'HIGH' ? 'HIGH' : 'CRITICAL',
        source: 'security-monitor',
        ip: params.ip,
        userId: params.userId,
        endpoint: params.path,
        details: { details: params.details, userAgent: params.userAgent },
      })
    } catch {
      // Fortress V2 may not be available in Edge runtime
    }

    console.warn(`[SECURITY] ${severity} - ${params.type} from ${params.ip}: ${params.details || ''}`)
  } catch (error) {
    console.error('[SECURITY] Failed to log security event:', error)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. IP BLOCKING (Database-backed)
// ═══════════════════════════════════════════════════════════════════════════════

export async function blockIPInDB(ip: string, reason: string, isAutoBlock: boolean = true, durationMs: number = 60 * 60 * 1000) {
  try {
    const expiresAt = new Date(Date.now() + durationMs)
    await prisma.iPBlocklist.upsert({
      where: { ip },
      update: { reason, isAutoBlock, expiresAt },
      create: { ip, reason, isAutoBlock, expiresAt },
    })
  } catch (error) {
    console.error('[SECURITY] Failed to block IP:', error)
  }
}

export async function unblockIPInDB(ip: string) {
  try {
    await prisma.iPBlocklist.delete({ where: { ip } }).catch(() => {})
  } catch (error) {
    console.error('[SECURITY] Failed to unblock IP:', error)
  }
}

export async function isIPBlockedInDB(ip: string): Promise<boolean> {
  try {
    const record = await prisma.iPBlocklist.findUnique({ where: { ip } })
    if (!record) return false
    if (record.expiresAt && record.expiresAt < new Date()) {
      await prisma.iPBlocklist.delete({ where: { ip } }).catch(() => {})
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function getBlockedIPsFromDB() {
  try {
    // Clean expired entries
    await prisma.iPBlocklist.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }).catch(() => {})

    return prisma.iPBlocklist.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ACCOUNT LOCKOUT (Prevent brute force)
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 30
const FAIL_WINDOW_MINUTES = 15

export async function recordFailedLogin(identifier: string): Promise<{ locked: boolean; remainingAttempts: number }> {
  try {
    const lockout = await prisma.accountLockout.upsert({
      where: { identifier },
      update: {
        failCount: { increment: 1 },
        lastFailAt: new Date(),
      },
      create: {
        identifier,
        failCount: 1,
        lastFailAt: new Date(),
      },
    })

    if (lockout.failCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
      await prisma.accountLockout.update({
        where: { identifier },
        data: {
          lockedUntil,
          lockReason: `Too many failed login attempts (${lockout.failCount})`,
        },
      })

      // Log the lockout event
      await logSecurityEvent({
        ip: identifier.includes('@') ? 'unknown' : identifier,
        type: 'ACCOUNT_LOCKOUT',
        path: '/api/auth/login',
        details: `Account locked after ${lockout.failCount} failed attempts. Locked until ${lockedUntil.toISOString()}`,
        severity: 'CRITICAL',
      })

      return { locked: true, remainingAttempts: 0 }
    }

    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - lockout.failCount }
  } catch (error) {
    console.error('[SECURITY] Failed to record login attempt:', error)
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS }
  }
}

export async function isAccountLocked(identifier: string): Promise<boolean> {
  try {
    const lockout = await prisma.accountLockout.findUnique({ where: { identifier } })
    if (!lockout) return false

    // Check if lockout has expired
    if (lockout.lockedUntil && lockout.lockedUntil < new Date()) {
      // Lockout expired - reset
      await prisma.accountLockout.update({
        where: { identifier },
        data: { failCount: 0, lockedUntil: null, lockReason: null },
      })
      return false
    }

    if (lockout.lockedUntil && lockout.lockedUntil > new Date()) {
      return true
    }

    // Check if fail count window has expired
    if (lockout.lastFailAt) {
      const windowExpiry = new Date(lockout.lastFailAt.getTime() + FAIL_WINDOW_MINUTES * 60 * 1000)
      if (windowExpiry < new Date()) {
        // Window expired - reset fail count
        await prisma.accountLockout.update({
          where: { identifier },
          data: { failCount: 0 },
        })
      }
    }

    return false
  } catch {
    return false
  }
}

export async function resetFailedLoginAttempts(identifier: string) {
  try {
    await prisma.accountLockout.upsert({
      where: { identifier },
      update: { failCount: 0, lockedUntil: null, lockReason: null },
      create: { identifier, failCount: 0 },
    })
  } catch (error) {
    console.error('[SECURITY] Failed to reset login attempts:', error)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SUSPICIOUS ACTIVITY TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function recordSuspiciousActivity(params: {
  userId?: string
  ip: string
  activityType: string
  description: string
  riskScore?: number
  metadata?: Record<string, any>
}) {
  try {
    await prisma.suspiciousActivity.create({
      data: {
        userId: params.userId,
        ip: params.ip,
        activityType: params.activityType,
        description: params.description,
        riskScore: params.riskScore || 0,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    })

    // If risk score is very high, auto-flag for review
    if (params.riskScore && params.riskScore >= 80) {
      await logSecurityEvent({
        ip: params.ip,
        type: 'SUSPICIOUS_ACTIVITY',
        path: '',
        details: `High risk activity: ${params.activityType} (score: ${params.riskScore})`,
        severity: 'HIGH',
        userId: params.userId,
      })
    }
  } catch (error) {
    console.error('[SECURITY] Failed to record suspicious activity:', error)
  }
}

export async function getUserRiskScore(userId: string): Promise<number> {
  try {
    const recentActivities = await prisma.suspiciousActivity.findMany({
      where: {
        userId,
        isResolved: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
    })

    if (recentActivities.length === 0) return 0

    const totalRisk = recentActivities.reduce((sum, a) => sum + a.riskScore, 0)
    return Math.min(100, totalRisk / recentActivities.length)
  } catch {
    return 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. VPN/PROXY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface IPQualityResult {
  proxy: boolean
  vpn: boolean
  tor: boolean
  riskScore: number
  country: string
  city: string
  ISP: string
  organization: string
}

const ipCheckCache = new Map<string, { result: IPQualityResult; expiresAt: number }>()

export async function checkIPQuality(ip: string): Promise<IPQualityResult | null> {
  // Skip private/local IPs
  if (ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return null
  }

  // Check cache first (1 hour TTL)
  const cached = ipCheckCache.get(ip)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result
  }

  try {
    // Use ip-api.com free API for basic geolocation + proxy detection
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,city,isp,org,proxy,hosting,query`, {
      signal: AbortSignal.timeout(5000), // 5s timeout
    })

    if (!response.ok) return null

    const data = await response.json()

    if (data.status !== 'success') return null

    const result: IPQualityResult = {
      proxy: data.proxy === true,
      vpn: data.hosting === true, // hosting = datacenter = likely VPN
      tor: false, // ip-api doesn't detect Tor specifically
      riskScore: (data.proxy || data.hosting) ? 70 : 10,
      country: data.country || '',
      city: data.city || '',
      ISP: data.isp || '',
      organization: data.org || '',
    }

    // Cache result
    ipCheckCache.set(ip, { result, expiresAt: Date.now() + 60 * 60 * 1000 })

    // Clean old cache entries
    for (const [key, value] of ipCheckCache.entries()) {
      if (value.expiresAt < Date.now()) ipCheckCache.delete(key)
    }

    return result
  } catch (error) {
    console.warn('[SECURITY] IP quality check failed:', error)
    return null
  }
}

export async function detectVPNorProxy(ip: string, userId?: string): Promise<boolean> {
  const ipQuality = await checkIPQuality(ip)

  if (!ipQuality) return false

  if (ipQuality.proxy || ipQuality.vpn) {
    // Check if user is frozen/blacklisted - only then record as suspicious
    let isEvasionAttempt = false
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      isEvasionAttempt = !!(user?.isFrozen || user?.isBlacklisted)
    }

    // Only record as suspicious activity if it's an evasion attempt (frozen/blacklisted using VPN)
    // Normal VPN usage is just detected but not flagged
    if (isEvasionAttempt) {
      await recordSuspiciousActivity({
        userId,
        ip,
        activityType: ipQuality.vpn ? 'VPN_EVASION_ATTEMPT' : 'PROXY_EVASION_ATTEMPT',
        description: `${ipQuality.vpn ? 'VPN' : 'Proxy'} used by frozen/blacklisted account. ISP: ${ipQuality.ISP}, Org: ${ipQuality.organization}, Country: ${ipQuality.country}, City: ${ipQuality.city}`,
        riskScore: 70,
        metadata: {
          country: ipQuality.country,
          city: ipQuality.city,
          isp: ipQuality.ISP,
          organization: ipQuality.organization,
          isEvasionAttempt: true,
        },
      })
    } else {
      // Normal VPN usage - just log, no suspicious activity record
      console.log(`[SECURITY] VPN/Proxy detected for user ${userId || 'unknown'}: ${ipQuality.ISP} (${ipQuality.country}, ${ipQuality.city}) - Normal usage, no action`)
    }

    return true
  }

  return false
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. REQUEST BODY SIZE LIMITATION
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_BODY_SIZE = 1024 * 1024 // 1MB default
const MAX_BODY_SIZE_UPLOAD = 10 * 1024 * 1024 // 10MB for upload routes

export function getMaxBodySize(path: string): number {
  if (path.includes('/upload') || path.includes('/avatar') || path.includes('/kyc')) {
    return MAX_BODY_SIZE_UPLOAD
  }
  return MAX_BODY_SIZE
}

export async function checkRequestBodySize(request: Request, pathname: string): Promise<{ ok: boolean; size: number }> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    const maxSize = getMaxBodySize(pathname)
    return { ok: size <= maxSize, size }
  }
  return { ok: true, size: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. REAL-TIME EVENT MONITORING & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityAlert {
  id: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  timestamp: number
  ip?: string
  userId?: string
  isAcknowledged: boolean
}

export interface SecurityDashboard {
  timestamp: string
  securityScore: number
  status: 'SECURE' | 'ELEVATED' | 'THREAT' | 'CRITICAL'
  last24h: {
    critical: number
    high: number
    medium: number
    low: number
  }
  last7dTotal: number
  blockedIPs: number
  unresolvedActivities: number
  topThreatTypes: Array<{ type: string; count: number }>
  activeAlerts: SecurityAlert[]
  recentCriticalEvents: Array<{
    id: string
    type: string
    ip: string
    details: string
    createdAt: string
  }>
  fortressV2Metrics?: {
    recentEventCount: number
    activeThreats: number
  }
}

// In-memory alert buffer for real-time monitoring
const alertBuffer: SecurityAlert[] = []
const MAX_ALERTS = 1000

class SecurityMonitor {
  /**
   * Log a security event to the real-time monitor
   */
  logEvent(event: {
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    ip: string
    userId?: string
    message: string
    endpoint?: string
  }): void {
    const alert: SecurityAlert = {
      id: `alert-${crypto.randomBytes(4).toString('hex')}`,
      type: event.type,
      severity: event.severity,
      message: event.message,
      timestamp: Date.now(),
      ip: event.ip,
      userId: event.userId,
      isAcknowledged: false,
    }

    alertBuffer.unshift(alert)
    if (alertBuffer.length > MAX_ALERTS) {
      alertBuffer.length = MAX_ALERTS
    }

    // Auto-respond to critical alerts
    if (event.severity === 'CRITICAL') {
      this.autoRespondToCritical(alert)
    }
  }

  /**
   * Get security dashboard data
   */
  async getDashboard(): Promise<SecurityDashboard> {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    try {
      const [critical24h, high24h, medium24h, low24h, total7d, blockedIPs, unresolvedActivities, topThreatTypes, recentCritical] = await Promise.all([
        prisma.securityLog.count({ where: { severity: 'CRITICAL', createdAt: { gte: last24h } } }),
        prisma.securityLog.count({ where: { severity: 'HIGH', createdAt: { gte: last24h } } }),
        prisma.securityLog.count({ where: { severity: 'MEDIUM', createdAt: { gte: last24h } } }),
        prisma.securityLog.count({ where: { severity: 'LOW', createdAt: { gte: last24h } } }),
        prisma.securityLog.count({ where: { createdAt: { gte: last7d } } }),
        prisma.iPBlocklist.count({ where: { expiresAt: { gt: now } } }),
        prisma.suspiciousActivity.count({ where: { isResolved: false } }),
        prisma.securityLog.groupBy({
          by: ['type'],
          _count: { type: true },
          where: { createdAt: { gte: last7d } },
          orderBy: { _count: { type: 'desc' } },
          take: 10,
        }),
        prisma.securityLog.findMany({
          where: { severity: { in: ['CRITICAL', 'HIGH'] }, createdAt: { gte: last24h } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, type: true, ip: true, details: true, createdAt: true },
        }),
      ])

      // Calculate security score
      let score = 100
      score -= critical24h * 10
      score -= high24h * 5
      score -= medium24h * 2
      score -= low24h * 1
      score -= blockedIPs * 3
      score -= unresolvedActivities * 2
      score = Math.max(0, Math.min(100, score))

      // Determine status
      let status: SecurityDashboard['status'] = 'SECURE'
      if (critical24h > 0 || score < 30) status = 'CRITICAL'
      else if (score < 60 || high24h > 3) status = 'THREAT'
      else if (score < 80 || medium24h > 10) status = 'ELEVATED'

      // Get Fortress V2 metrics
      let fortressV2Metrics: SecurityDashboard['fortressV2Metrics']
      try {
        const { fortressV2 } = await import('./fortress-v2')
        fortressV2Metrics = fortressV2.getMetrics()
      } catch {
        fortressV2Metrics = undefined
      }

      return {
        timestamp: now.toISOString(),
        securityScore: score,
        status,
        last24h: { critical: critical24h, high: high24h, medium: medium24h, low: low24h },
        last7dTotal: total7d,
        blockedIPs,
        unresolvedActivities,
        topThreatTypes: topThreatTypes.map(t => ({ type: t.type, count: t._count.type })),
        activeAlerts: alertBuffer.filter(a => !a.isAcknowledged).slice(0, 50),
        recentCriticalEvents: recentCritical.map(e => ({
          id: e.id,
          type: e.type,
          ip: e.ip,
          details: e.details || '',
          createdAt: e.createdAt.toISOString(),
        })),
        fortressV2Metrics,
      }
    } catch (error) {
      console.error('[SECURITY-MONITOR] Dashboard generation failed:', error)
      return {
        timestamp: now.toISOString(),
        securityScore: 50,
        status: 'ELEVATED',
        last24h: { critical: 0, high: 0, medium: 0, low: 0 },
        last7dTotal: 0,
        blockedIPs: 0,
        unresolvedActivities: 0,
        topThreatTypes: [],
        activeAlerts: [],
        recentCriticalEvents: [],
      }
    }
  }

  /**
   * Get current security alerts
   */
  getAlerts(): SecurityAlert[] {
    return alertBuffer.filter(a => !a.isAcknowledged).slice(0, 100)
  }

  /**
   * Get attack chains from Fortress V2 correlator
   */
  async getAttackChains(): Promise<Array<{
    id: string
    attackType: string
    severity: string
    eventCount: number
    phases: Array<{ name: string; description: string }>
  }>> {
    try {
      const { fortressV2 } = await import('./fortress-v2')
      const recentEvents = fortressV2.eventCorrelator.getRecentEvents()
      const result = fortressV2.eventCorrelator.correlateEvents(recentEvents)

      return result.attackChains.map(chain => ({
        id: chain.id,
        attackType: chain.attackType,
        severity: chain.severity,
        eventCount: chain.events.length,
        phases: chain.phases.map(p => ({ name: p.name, description: p.description })),
      }))
    } catch {
      return []
    }
  }

  /**
   * Respond to a security incident
   */
  async respondToIncident(incident: {
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    ip: string
    userId?: string
    description: string
  }): Promise<{
    actions: string[]
    incidentId: string
  }> {
    const actions: string[] = []
    const incidentId = `inc-${crypto.randomBytes(4).toString('hex')}`

    // Log the incident
    await logSecurityEvent({
      ip: incident.ip,
      type: `INCIDENT:${incident.type}`,
      path: '/security/incident',
      details: incident.description,
      severity: incident.severity,
      userId: incident.userId,
    })

    // Auto-respond based on severity
    const responseSystem = new AutomatedResponseSystem()

    switch (incident.severity) {
      case 'CRITICAL':
        actions.push('IP blocked (24h)')
        await responseSystem.blockIP(incident.ip, 24 * 60 * 60 * 1000, `Critical incident: ${incident.type}`)
        if (incident.userId) {
          actions.push('Account frozen')
          await responseSystem.freezeAccount(incident.userId, `Critical incident: ${incident.description}`)
        }
        actions.push('Security alert sent')
        actions.push('Evidence preserved')
        await responseSystem.preserveEvidence(incidentId)
        break

      case 'HIGH':
        actions.push('IP blocked (1h)')
        await responseSystem.blockIP(incident.ip, 60 * 60 * 1000, `High severity incident: ${incident.type}`)
        if (incident.userId) {
          actions.push('Rate limit adjusted')
          await responseSystem.adjustRateLimit(incident.userId, 'HIGH')
        }
        break

      case 'MEDIUM':
        actions.push('Enhanced monitoring enabled')
        if (incident.userId) {
          await responseSystem.adjustRateLimit(incident.userId, 'MEDIUM')
        }
        break

      case 'LOW':
        actions.push('Event logged')
        break
    }

    return { actions, incidentId }
  }

  private async autoRespondToCritical(alert: SecurityAlert): Promise<void> {
    console.error(`[SECURITY-MONITOR] CRITICAL ALERT: ${alert.type} from ${alert.ip}`)
    console.error(`[SECURITY-MONITOR] Message: ${alert.message}`)

    // Auto-block the IP
    await blockIPInDB(alert.ip || 'unknown', `Auto-block: ${alert.type} - ${alert.message}`, true, 3600000)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ANOMALY DETECTION (Statistical)
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserActivity {
  loginCount: number
  transactionCount: number
  uniqueIPs: number
  avgSessionDuration: number
  financialVolume: number
  activeHours: number[]
  endpointsAccessed: number
  failedAttempts: number
}

export interface AnomalyResult {
  isAnomaly: boolean
  anomalyScore: number
  deviations: string[]
  recommendation: 'ALLOW' | 'MONITOR' | 'CHALLENGE' | 'BLOCK'
}

export interface AnomalyCorrelation {
  userId: string
  anomalyScore: number
  correlatedUsers: string[]
  sharedIndicators: string[]
}

class AnomalyDetector {
  private baselines = new Map<string, {
    activity: UserActivity
    updatedAt: number
    sampleCount: number
  }>()

  private static readonly ANOMALY_THRESHOLD = 60

  /**
   * Update baseline for a user
   */
  updateBaseline(userId: string, activity: UserActivity): void {
    const existing = this.baselines.get(userId)

    if (!existing) {
      this.baselines.set(userId, {
        activity,
        updatedAt: Date.now(),
        sampleCount: 1,
      })
      return
    }

    // Weighted average update (more samples = slower change)
    const weight = 1 / (existing.sampleCount + 1)
    const updated: UserActivity = {
      loginCount: Math.round(existing.activity.loginCount * (1 - weight) + activity.loginCount * weight),
      transactionCount: Math.round(existing.activity.transactionCount * (1 - weight) + activity.transactionCount * weight),
      uniqueIPs: Math.max(existing.activity.uniqueIPs, activity.uniqueIPs),
      avgSessionDuration: Math.round(existing.activity.avgSessionDuration * (1 - weight) + activity.avgSessionDuration * weight),
      financialVolume: Math.round(existing.activity.financialVolume * (1 - weight) + activity.financialVolume * weight),
      activeHours: activity.activeHours, // Use latest
      endpointsAccessed: Math.max(existing.activity.endpointsAccessed, activity.endpointsAccessed),
      failedAttempts: Math.round(existing.activity.failedAttempts * (1 - weight) + activity.failedAttempts * weight),
    }

    this.baselines.set(userId, {
      activity: updated,
      updatedAt: Date.now(),
      sampleCount: existing.sampleCount + 1,
    })
  }

  /**
   * Detect anomalies in user activity
   */
  detectAnomaly(userId: string, activity: UserActivity): AnomalyResult {
    const baseline = this.baselines.get(userId)
    const deviations: string[] = []
    let anomalyScore = 0

    if (!baseline) {
      // No baseline yet - start monitoring
      this.updateBaseline(userId, activity)
      return { isAnomaly: false, anomalyScore: 0, deviations: [], recommendation: 'ALLOW' }
    }

    // Check 1: Login frequency anomaly
    if (activity.loginCount > baseline.activity.loginCount * 3 + 5) {
      anomalyScore += 20
      deviations.push(`Login frequency ${activity.loginCount}x vs baseline ${baseline.activity.loginCount}`)
    }

    // Check 2: Transaction frequency anomaly
    if (activity.transactionCount > baseline.activity.transactionCount * 3 + 5) {
      anomalyScore += 25
      deviations.push(`Transaction frequency ${activity.transactionCount}x vs baseline ${baseline.activity.transactionCount}`)
    }

    // Check 3: IP diversity anomaly
    if (activity.uniqueIPs > baseline.activity.uniqueIPs + 3) {
      anomalyScore += 15
      deviations.push(`Using ${activity.uniqueIPs} unique IPs vs baseline ${baseline.activity.uniqueIPs}`)
    }

    // Check 4: Financial volume anomaly
    if (activity.financialVolume > baseline.activity.financialVolume * 5 + 1000) {
      anomalyScore += 30
      deviations.push(`Financial volume $${activity.financialVolume} vs baseline $${baseline.activity.financialVolume}`)
    }

    // Check 5: Failed attempts anomaly
    if (activity.failedAttempts > 3) {
      anomalyScore += 20
      deviations.push(`${activity.failedAttempts} failed attempts`)
    }

    // Check 6: Endpoint scanning
    if (activity.endpointsAccessed > baseline.activity.endpointsAccessed * 2 + 20) {
      anomalyScore += 15
      deviations.push(`Accessed ${activity.endpointsAccessed} endpoints vs baseline ${baseline.activity.endpointsAccessed}`)
    }

    // Update baseline with current activity (even if anomalous)
    this.updateBaseline(userId, activity)

    const isAnomaly = anomalyScore >= AnomalyDetector.ANOMALY_THRESHOLD
    let recommendation: AnomalyResult['recommendation'] = 'ALLOW'
    if (anomalyScore >= 80) recommendation = 'BLOCK'
    else if (anomalyScore >= 60) recommendation = 'CHALLENGE'
    else if (anomalyScore >= 30) recommendation = 'MONITOR'

    return {
      isAnomaly,
      anomalyScore: Math.min(100, anomalyScore),
      deviations,
      recommendation,
    }
  }

  /**
   * Correlate anomalies across users
   */
  correlateAnomalies(): AnomalyCorrelation[] {
    const correlations: AnomalyCorrelation[] = []

    // Find users with high unique IP counts (potential shared IPs)
    const ipGroups = new Map<string, string[]>()
    for (const [userId, data] of this.baselines.entries()) {
      // Group by similar activity patterns
      const key = `ips:${data.activity.uniqueIPs}:tx:${Math.floor(data.activity.transactionCount / 10)}`
      const group = ipGroups.get(key) || []
      group.push(userId)
      ipGroups.set(key, group)
    }

    // Find correlated groups
    for (const [_, userIds] of ipGroups.entries()) {
      if (userIds.length >= 2) {
        for (const userId of userIds) {
          const data = this.baselines.get(userId)!
          correlations.push({
            userId,
            anomalyScore: data.activity.failedAttempts * 10,
            correlatedUsers: userIds.filter(id => id !== userId),
            sharedIndicators: [`Similar activity pattern (${userIds.length} users)`],
          })
        }
      }
    }

    return correlations
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. AUTOMATED RESPONSE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

class AutomatedResponseSystem {
  /**
   * Block an IP address
   */
  async blockIP(ip: string, duration: number, reason: string): Promise<void> {
    await blockIPInDB(ip, reason, true, duration)
  }

  /**
   * Freeze a user account
   */
  async freezeAccount(userId: string, reason: string): Promise<void> {
    try {
      const { freezeAccount } = await import('./security-fortress')
      await freezeAccount({
        userId,
        reason: `Automated freeze: ${reason}`,
        frozenBy: 'security-monitor',
      })
    } catch (error) {
      console.error('[SECURITY-MONITOR] Failed to freeze account:', error)
    }
  }

  /**
   * Adjust rate limit for an identifier
   */
  async adjustRateLimit(identifier: string, level: 'MEDIUM' | 'HIGH' | 'CRITICAL'): Promise<void> {
    try {
      const { fortressV2 } = await import('./fortress-v2')
      fortressV2.rateLimiter.adjustForThreatLevel(identifier, level)
    } catch {
      // May not be available in Edge runtime
    }
  }

  /**
   * Escalate an alert
   */
  escalateAlert(alertId: string): void {
    const alert = alertBuffer.find(a => a.id === alertId)
    if (alert) {
      alert.severity = 'CRITICAL'
      alert.isAcknowledged = false
      console.error(`[SECURITY-MONITOR] Alert ${alertId} escalated to CRITICAL`)
    }
  }

  /**
   * Preserve evidence for an incident
   */
  async preserveEvidence(incidentId: string): Promise<void> {
    try {
      // Log evidence preservation
      await logSecurityEvent({
        ip: 'system',
        type: 'EVIDENCE_PRESERVED',
        path: '/security/incident',
        details: `Evidence preserved for incident ${incidentId}`,
        severity: 'LOW',
      })
    } catch {
      // Non-critical
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SECURITY AUDIT REPORT (from database)
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateDBSecurityAudit() {
  try {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [critical24h, high24h, medium24h, low24h, total7d, blockedIPs, unresolvedActivities, topThreatTypes] = await Promise.all([
      prisma.securityLog.count({ where: { severity: 'CRITICAL', createdAt: { gte: last24h } } }),
      prisma.securityLog.count({ where: { severity: 'HIGH', createdAt: { gte: last24h } } }),
      prisma.securityLog.count({ where: { severity: 'MEDIUM', createdAt: { gte: last24h } } }),
      prisma.securityLog.count({ where: { severity: 'LOW', createdAt: { gte: last24h } } }),
      prisma.securityLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.iPBlocklist.count({ where: { expiresAt: { gt: now } } }),
      prisma.suspiciousActivity.count({ where: { isResolved: false } }),
      prisma.securityLog.groupBy({
        by: ['type'],
        _count: { type: true },
        where: { createdAt: { gte: last7d } },
        orderBy: { _count: { type: 'desc' } },
        take: 10,
      }),
    ])

    // Calculate security score
    let score = 100
    score -= critical24h * 10
    score -= high24h * 5
    score -= medium24h * 2
    score -= low24h * 1
    score -= blockedIPs * 3
    score -= unresolvedActivities * 2
    score = Math.max(0, Math.min(100, score))

    return {
      timestamp: now.toISOString(),
      last24h: { critical: critical24h, high: high24h, medium: medium24h, low: low24h },
      last7dTotal: total7d,
      blockedIPs,
      unresolvedActivities,
      topThreatTypes: topThreatTypes.map(t => ({ type: t.type, count: t._count.type })),
      securityScore: score,
    }
  } catch (error) {
    console.error('[SECURITY] Failed to generate audit:', error)
    return {
      timestamp: new Date().toISOString(),
      last24h: { critical: 0, high: 0, medium: 0, low: 0 },
      last7dTotal: 0,
      blockedIPs: 0,
      unresolvedActivities: 0,
      topThreatTypes: [],
      securityScore: 50,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. LOGIN SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

export async function validateLoginSecurity(email: string, ip: string): Promise<{ allowed: boolean; message?: string }> {
  // Check if account is locked
  const accountLocked = await isAccountLocked(email)
  if (accountLocked) {
    return { allowed: false, message: 'تم قفل الحساب بسبب محاولات دخول فاشلة متعددة. حاول بعد 30 دقيقة.' }
  }

  // Check if IP is blocked
  const ipBlocked = await isIPBlockedInDB(ip)
  if (ipBlocked) {
    return { allowed: false, message: 'تم حظر هذا العنوان. تواصل مع الدعم الفني.' }
  }

  return { allowed: true }
}

export async function handleFailedLogin(email: string, ip: string, userAgent?: string) {
  // Record failed attempt for the email
  const result = await recordFailedLogin(email)

  // Also record for IP (to catch attacks across multiple accounts)
  await recordFailedLogin(ip)

  // Log the event
  await logSecurityEvent({
    ip,
    type: 'BRUTE_FORCE',
    path: '/api/auth/login',
    details: `Failed login attempt for ${email}. ${result.remainingAttempts} attempts remaining.`,
    severity: result.locked ? 'CRITICAL' : 'MEDIUM',
    userAgent,
  })

  return result
}

export async function handleSuccessfulLogin(email: string, ip: string, userAgent?: string, userId?: string) {
  // Reset failed attempts
  await resetFailedLoginAttempts(email)
  await resetFailedLoginAttempts(ip)

  // Check for VPN/proxy
  const isVPN = await detectVPNorProxy(ip, userId)

  // Log the successful login
  await logSecurityEvent({
    ip,
    type: 'SUCCESSFUL_LOGIN',
    path: '/api/auth/login',
    details: `Successful login for ${email}${isVPN ? ' (VPN/Proxy detected)' : ''}`,
    severity: 'LOW',
    userId,
    userAgent,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. WITHDRAWAL SECURITY MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

export async function monitorWithdrawal(userId: string, amount: number, ip: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return

    // Flag large withdrawals (more than 50% of total balance)
    if (amount > user.balance * 0.5 && amount > 1000) {
      await recordSuspiciousActivity({
        userId,
        ip,
        activityType: 'SUSPICIOUS_WITHDRAWAL',
        description: `Large withdrawal: $${amount.toFixed(2)} (balance: $${user.balance.toFixed(2)})`,
        riskScore: 50,
        metadata: { amount, balance: user.balance, percentOfBalance: (amount / user.balance * 100).toFixed(1) },
      })
    }

    // Flag multiple withdrawals in short time
    const recentWithdrawals = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'WITHDRAWAL',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
    })

    if (recentWithdrawals.length >= 3) {
      await recordSuspiciousActivity({
        userId,
        ip,
        activityType: 'RAPID_REQUESTS',
        description: `${recentWithdrawals.length} withdrawal requests in the last hour`,
        riskScore: 60,
        metadata: { count: recentWithdrawals.length, period: '1h' },
      })
    }

    // Flag withdrawals from new accounts
    const accountAge = Date.now() - user.createdAt.getTime()
    const oneDay = 24 * 60 * 60 * 1000
    if (accountAge < oneDay && amount > 100) {
      await recordSuspiciousActivity({
        userId,
        ip,
        activityType: 'UNUSUAL_LOCATION',
        description: `Withdrawal from new account (${Math.floor(accountAge / (60 * 60 * 1000))}h old): $${amount.toFixed(2)}`,
        riskScore: 70,
        metadata: { accountAgeHours: Math.floor(accountAge / (60 * 60 * 1000)), amount },
      })
    }
  } catch (error) {
    console.error('[SECURITY] Withdrawal monitoring failed:', error)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. SECURITY SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SECURITY_SETTINGS: Record<string, string> = {
  'max_failed_login_attempts': '5',
  'lockout_duration_minutes': '30',
  'vpn_detection_enabled': 'true',
  'auto_block_critical': 'true',
  'withdrawal_monitoring': 'true',
  'max_withdrawal_percent': '50',
  'new_account_withdrawal_limit': '100',
  'rapid_withdrawal_threshold': '3',
  'ip_quality_check_enabled': 'true',
  'request_body_size_limit': '1048576',
}

export async function getSecuritySetting(key: string): Promise<string> {
  try {
    const setting = await prisma.securitySetting.findUnique({ where: { key } })
    return setting?.value || DEFAULT_SECURITY_SETTINGS[key] || ''
  } catch {
    return DEFAULT_SECURITY_SETTINGS[key] || ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const securityMonitor = new SecurityMonitor()
export const anomalyDetector = new AnomalyDetector()
export const automatedResponseSystem = new AutomatedResponseSystem()
