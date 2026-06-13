// ═══════════════════════════════════════════════════════════════════════════════
// SENTINEL - Real-Time Intrusion Detection & Response System
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. Real-time monitoring of all security events
// 2. Pattern-based attack detection
// 3. Automated incident response
// 4. Attack chain reconstruction
// 5. Predictive threat assessment
// 6. Security metrics & alerting
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'
import prisma from './prisma'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. EVENT COLLECTION & ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityEvent {
  id: string
  timestamp: number
  type: SecurityEventType
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  source: string
  ip: string
  userId?: string
  endpoint?: string
  details: Record<string, any>
  fingerprint: string // Correlation ID for attack chains
}

type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'AUTH_SUCCESS'
  | 'RATE_LIMIT_HIT'
  | 'XSS_ATTEMPT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'PATH_TRAVERSAL_ATTEMPT'
  | 'COMMAND_INJECTION_ATTEMPT'
  | 'CSRF_VIOLATION'
  | 'IMPOSSIBLE_TRAVEL'
  | 'SESSION_HIJACK_SUSPECT'
  | 'VPN_DETECTED'
  | 'TOR_DETECTED'
  | 'PROXY_DETECTED'
  | 'SAME_IP_ACCOUNTS'
  | 'SCRAPING_DETECTED'
  | 'HONEYPOT_TRIGGERED'
  | 'GEOGRAPHIC_PROBING'
  | 'ADMIN_ACCESS'
  | 'FINANCIAL_OPERATION'
  | 'BULK_OPERATION'
  | 'REPLAY_ATTACK'
  | 'TOKEN_FORGERY'
  | 'ACCOUNT_TAKEOVER_SUSPECT'
  | 'DATA_EXFILTRATION_SUSPECT'
  | 'BRUTE_FORCE_ATTACK'
  | 'CREDENTIAL_STUFFING'
  | 'API_ABUSE'
  | 'ZERO_DAY_EXPLOIT_SUSPECT'

// Event buffer for real-time analysis
const eventBuffer: SecurityEvent[] = []
const MAX_BUFFER_SIZE = 10000

/**
 * Record a security event for real-time analysis
 */
export async function recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'fingerprint'>): Promise<{
  eventId: string
  threatLevel: ThreatLevel
  recommendedAction: RecommendedAction
  relatedEvents: number
}> {
  const fullEvent: SecurityEvent = {
    ...event,
    id: `evt-${crypto.randomBytes(8).toString('hex')}`,
    timestamp: Date.now(),
    fingerprint: generateEventFingerprint(event),
  }

  // Add to buffer
  eventBuffer.unshift(fullEvent)
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.length = MAX_BUFFER_SIZE
  }

  // Analyze the event
  const analysis = analyzeEvent(fullEvent)

  // Persist to database (non-blocking)
  persistEvent(fullEvent).catch(err =>
    console.error('[SENTINEL] Failed to persist event:', err)
  )

  // Auto-respond to critical events
  if (analysis.threatLevel === 'CRITICAL') {
    await autoRespond(fullEvent, analysis)
  }

  return {
    eventId: fullEvent.id,
    threatLevel: analysis.threatLevel,
    recommendedAction: analysis.recommendedAction,
    relatedEvents: analysis.relatedEventCount,
  }
}

function generateEventFingerprint(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'fingerprint'>): string {
  // Create a fingerprint that correlates related events (same attacker/session)
  const components = [
    event.ip,
    event.userId || '',
    event.type,
    Math.floor(Date.now() / (5 * 60 * 1000)), // 5-minute window
  ]
  return crypto.createHash('sha256').update(components.join(':')).digest('hex').substring(0, 16)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PATTERN-BASED ATTACK DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

type ThreatLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type RecommendedAction = 'LOG' | 'MONITOR' | 'THROTTLE' | 'CHALLENGE' | 'BLOCK' | 'CONTAIN' | 'SHUTDOWN'

interface EventAnalysis {
  threatLevel: ThreatLevel
  recommendedAction: RecommendedAction
  attackPattern: string | null
  relatedEventCount: number
  confidence: number
}

function analyzeEvent(event: SecurityEvent): EventAnalysis {
  let threatLevel: ThreatLevel = 'NONE'
  let recommendedAction: RecommendedAction = 'LOG'
  let attackPattern: string | null = null
  let confidence = 0
  let relatedEventCount = 0

  // Map severity to threat level
  const severityToThreat: Record<string, ThreatLevel> = {
    'INFO': 'NONE',
    'LOW': 'LOW',
    'MEDIUM': 'MEDIUM',
    'HIGH': 'HIGH',
    'CRITICAL': 'CRITICAL',
  }
  threatLevel = severityToThreat[event.severity] || 'NONE'

  // Count related events in the last 5 minutes
  const fiveMinAgo = Date.now() - 5 * 60 * 1000
  const recentRelated = eventBuffer.filter(e =>
    e.ip === event.ip &&
    e.timestamp > fiveMinAgo
  )
  relatedEventCount = recentRelated.length

  // Pattern 1: Brute Force - Multiple auth failures from same IP
  if (event.type === 'AUTH_FAILURE') {
    const authFailures = recentRelated.filter(e => e.type === 'AUTH_FAILURE')
    if (authFailures.length >= 5) {
      threatLevel = 'CRITICAL'
      attackPattern = 'BRUTE_FORCE'
      recommendedAction = 'CONTAIN'
      confidence = 90
    } else if (authFailures.length >= 3) {
      threatLevel = 'HIGH'
      attackPattern = 'BRUTE_FORCE_SUSPECT'
      recommendedAction = 'BLOCK'
      confidence = 70
    }
  }

  // Pattern 2: Credential Stuffing - Multiple auth failures with different emails from same IP
  if (event.type === 'AUTH_FAILURE') {
    const uniqueEmails = new Set(recentRelated
      .filter(e => e.type === 'AUTH_FAILURE')
      .map(e => e.details?.email)
      .filter(Boolean)
    )
    if (uniqueEmails.size >= 3) {
      threatLevel = 'CRITICAL'
      attackPattern = 'CREDENTIAL_STUFFING'
      recommendedAction = 'CONTAIN'
      confidence = 95
    }
  }

  // Pattern 3: Injection Campaign - Multiple injection attempts
  if (event.type.includes('INJECTION') || event.type === 'XSS_ATTEMPT') {
    const injectionAttempts = recentRelated.filter(e =>
      e.type.includes('INJECTION') || e.type === 'XSS_ATTEMPT'
    )
    if (injectionAttempts.length >= 3) {
      threatLevel = 'CRITICAL'
      attackPattern = 'INJECTION_CAMPAIGN'
      recommendedAction = 'CONTAIN'
      confidence = 85
    }
  }

  // Pattern 4: Account Takeover - Impossible travel + auth events
  if (event.type === 'IMPOSSIBLE_TRAVEL') {
    const authEvents = recentRelated.filter(e => e.type === 'AUTH_SUCCESS')
    if (authEvents.length > 0) {
      threatLevel = 'CRITICAL'
      attackPattern = 'ACCOUNT_TAKEOVER'
      recommendedAction = 'CONTAIN'
      confidence = 90
    }
  }

  // Pattern 5: Data Exfiltration - Large volume of data access
  if (event.type === 'BULK_OPERATION' || event.type === 'API_ABUSE') {
    const bulkOps = recentRelated.filter(e => e.type === 'BULK_OPERATION')
    if (bulkOps.length >= 3) {
      threatLevel = 'HIGH'
      attackPattern = 'DATA_EXFILTRATION'
      recommendedAction = 'BLOCK'
      confidence = 75
    }
  }

  // Pattern 6: Reconnaissance - Endpoint scanning
  if (event.type === 'SCRAPING_DETECTED' || event.type === 'HONEYPOT_TRIGGERED') {
    threatLevel = 'HIGH'
    attackPattern = 'RECONNAISSANCE'
    recommendedAction = 'BLOCK'
    confidence = 80
  }

  // Pattern 7: Zero-Day Suspect - Unusual/unexpected patterns
  if (event.type === 'ZERO_DAY_EXPLOIT_SUSPECT') {
    threatLevel = 'CRITICAL'
    attackPattern = 'ZERO_DAY_EXPLOIT'
    recommendedAction = 'SHUTDOWN'
    confidence = 60 // Lower confidence since it's hard to confirm
  }

  // Escalate based on event volume
  if (relatedEventCount >= 20 && threatLevel === 'MEDIUM') {
    threatLevel = 'HIGH'
    recommendedAction = 'BLOCK'
  }
  if (relatedEventCount >= 50) {
    threatLevel = 'CRITICAL'
    recommendedAction = 'CONTAIN'
  }

  return { threatLevel, recommendedAction, attackPattern, relatedEventCount, confidence }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUTOMATED INCIDENT RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

async function autoRespond(event: SecurityEvent, analysis: EventAnalysis): Promise<void> {
  console.error(`[SENTINEL] CRITICAL: ${analysis.attackPattern} detected from ${event.ip}`)
  console.error(`[SENTINEL] Action: ${analysis.recommendedAction}, Confidence: ${analysis.confidence}%`)

  switch (analysis.recommendedAction) {
    case 'BLOCK':
      await blockIP(event.ip, analysis.attackPattern || 'CRITICAL_EVENT')
      break

    case 'CONTAIN':
      await blockIP(event.ip, analysis.attackPattern || 'CRITICAL_EVENT')
      if (event.userId) {
        try {
          const { autoContain } = await import('./zero-trust-shield')
          await autoContain(event.userId, analysis.attackPattern || 'Critical threat detected', 'HIGH')
        } catch {}
      }
      break

    case 'SHUTDOWN':
      // Emergency mode - block all non-essential access
      console.error('[SENTINEL] EMERGENCY: Activating emergency lockdown')
      await blockIP(event.ip, 'ZERO_DAY_SUSPECT')
      if (event.userId) {
        try {
          const { autoContain } = await import('./zero-trust-shield')
          await autoContain(event.userId, 'Emergency lockdown - zero day suspect', 'CRITICAL')
        } catch {}
      }
      break

    default:
      break
  }

  // Log the response
  await prisma.securityLog.create({
    data: {
      ip: event.ip,
      type: `AUTO_RESPONSE:${analysis.recommendedAction}`,
      path: event.endpoint || '/sentinel',
      details: `Auto-responded to ${analysis.attackPattern} with ${analysis.recommendedAction}. Confidence: ${analysis.confidence}%`,
      severity: 'CRITICAL',
      userId: event.userId,
    },
  }).catch(() => {})
}

async function blockIP(ip: string, reason: string): Promise<void> {
  try {
    await prisma.iPBlocklist.upsert({
      where: { ip },
      update: {
        reason: `SENTINEL: ${reason}`,
        isAutoBlock: true,
        expiresAt: null, // Permanent block for critical threats
      },
      create: {
        ip,
        reason: `SENTINEL: ${reason}`,
        isAutoBlock: true,
        expiresAt: null,
      },
    })
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ATTACK CHAIN RECONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface AttackChain {
  id: string
  ip: string
  userId?: string
  events: SecurityEvent[]
  startTime: number
  endTime: number
  duration: number
  eventCount: number
  attackType: string
  severity: ThreatLevel
  phases: AttackPhase[]
}

interface AttackPhase {
  name: string
  startTime: number
  endTime: number
  events: SecurityEvent[]
  description: string
}

/**
 * Reconstruct an attack chain from related events
 * Groups events by IP/user and identifies attack phases
 */
export function reconstructAttackChain(ip: string): AttackChain | null {
  const ipEvents = eventBuffer
    .filter(e => e.ip === ip)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (ipEvents.length < 2) return null

  const phases: AttackPhase[] = []
  let currentPhaseEvents: SecurityEvent[] = []
  let currentPhaseType = ''

  // Identify attack phases based on event types
  for (const event of ipEvents) {
    const phaseType = mapEventToPhase(event.type)

    if (phaseType !== currentPhaseType && currentPhaseEvents.length > 0) {
      phases.push({
        name: getPhaseName(currentPhaseType),
        startTime: currentPhaseEvents[0].timestamp,
        endTime: currentPhaseEvents[currentPhaseEvents.length - 1].timestamp,
        events: [...currentPhaseEvents],
        description: getPhaseDescription(currentPhaseType, currentPhaseEvents),
      })
      currentPhaseEvents = []
    }

    currentPhaseType = phaseType
    currentPhaseEvents.push(event)
  }

  // Add last phase
  if (currentPhaseEvents.length > 0) {
    phases.push({
      name: getPhaseName(currentPhaseType),
      startTime: currentPhaseEvents[0].timestamp,
      endTime: currentPhaseEvents[currentPhaseEvents.length - 1].timestamp,
      events: [...currentPhaseEvents],
      description: getPhaseDescription(currentPhaseType, currentPhaseEvents),
    })
  }

  const userId = ipEvents.find(e => e.userId)?.userId

  return {
    id: `chain-${crypto.randomBytes(4).toString('hex')}`,
    ip,
    userId,
    events: ipEvents,
    startTime: ipEvents[0].timestamp,
    endTime: ipEvents[ipEvents.length - 1].timestamp,
    duration: ipEvents[ipEvents.length - 1].timestamp - ipEvents[0].timestamp,
    eventCount: ipEvents.length,
    attackType: identifyAttackType(ipEvents),
    severity: determineChainSeverity(ipEvents),
    phases,
  }
}

function mapEventToPhase(type: SecurityEventType): string {
  if (type === 'SCRAPING_DETECTED' || type === 'HONEYPOT_TRIGGERED' || type === 'GEOGRAPHIC_PROBING') return 'RECON'
  if (type === 'AUTH_FAILURE' || type === 'BRUTE_FORCE_ATTACK' || type === 'CREDENTIAL_STUFFING') return 'EXPLOIT'
  if (type === 'SQL_INJECTION_ATTEMPT' || type === 'XSS_ATTEMPT' || type === 'PATH_TRAVERSAL_ATTEMPT') return 'EXPLOIT'
  if (type === 'AUTH_SUCCESS' || type === 'ADMIN_ACCESS') return 'PERSIST'
  if (type === 'DATA_EXFILTRATION_SUSPECT' || type === 'BULK_OPERATION') return 'EXFIL'
  if (type === 'IMPOSSIBLE_TRAVEL' || type === 'SESSION_HIJACK_SUSPECT' || type === 'ACCOUNT_TAKEOVER_SUSPECT') return 'LATERAL'
  return 'UNKNOWN'
}

function getPhaseName(type: string): string {
  const names: Record<string, string> = {
    'RECON': 'الاستطلاع (Reconnaissance)',
    'EXPLOIT': 'الاستغلال (Exploitation)',
    'PERSIST': 'الاستمرار (Persistence)',
    'LATERAL': 'التحرك الجانبي (Lateral Movement)',
    'EXFIL': 'تسريب البيانات (Exfiltration)',
    'UNKNOWN': 'غير معروف (Unknown)',
  }
  return names[type] || type
}

function getPhaseDescription(type: string, events: SecurityEvent[]): string {
  const count = events.length
  switch (type) {
    case 'RECON': return `تم اكتشاف ${count} محاولات استطلاع - فحص البنية التحتية واكتشاف الثغرات`
    case 'EXPLOIT': return `تم اكتشاف ${count} محاولات استغلال - محاولات اختراق نشطة`
    case 'PERSIST': return `تم اكتشاف ${count} محاولات استمرار - محاولة البقاء في النظام`
    case 'LATERAL': return `تم اكتشاف ${count} تحركات جانبية - محاولة الوصول لحسابات أخرى`
    case 'EXFIL': return `تم اكتشاف ${count} محاولات تسريب - محاولة سحب البيانات`
    default: return `${count} أحداث غير مصنفة`
  }
}

function identifyAttackType(events: SecurityEvent[]): string {
  const types = new Set(events.map(e => e.type))
  if (types.has('BRUTE_FORCE_ATTACK') || types.has('CREDENTIAL_STUFFING')) return 'BRUTE_FORCE'
  if (types.has('SQL_INJECTION_ATTEMPT') || types.has('XSS_ATTEMPT')) return 'INJECTION'
  if (types.has('ACCOUNT_TAKEOVER_SUSPECT') || types.has('IMPOSSIBLE_TRAVEL')) return 'ACCOUNT_TAKEOVER'
  if (types.has('DATA_EXFILTRATION_SUSPECT')) return 'DATA_EXFILTRATION'
  if (types.has('SCRAPING_DETECTED')) return 'RECONNAISSANCE'
  return 'MULTI_VECTOR'
}

function determineChainSeverity(events: SecurityEvent[]): ThreatLevel {
  const maxSeverity = events.reduce((max, e) => {
    const order = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    return order.indexOf(e.severity) > order.indexOf(max) ? e.severity : max
  }, 'INFO' as SecurityEvent['severity'])

  const severityMap: Record<string, ThreatLevel> = {
    'INFO': 'LOW',
    'LOW': 'LOW',
    'MEDIUM': 'MEDIUM',
    'HIGH': 'HIGH',
    'CRITICAL': 'CRITICAL',
  }
  return severityMap[maxSeverity] || 'MEDIUM'
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SECURITY METRICS & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityMetrics {
  timestamp: number
  eventsLast5Min: number
  eventsLast1Hour: number
  eventsLast24Hours: number
  criticalEvents24h: number
  blockedIPs: number
  activeThreats: number
  topAttackTypes: Array<{ type: string; count: number }>
  topAttackerIPs: Array<{ ip: string; eventCount: number; lastEvent: string }>
  securityScore: number // 0-100
  status: 'SECURE' | 'ELEVATED' | 'THREAT' | 'CRITICAL'
}

export function getSecurityMetrics(): SecurityMetrics {
  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000
  const oneHourAgo = now - 60 * 60 * 1000
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

  const events5Min = eventBuffer.filter(e => e.timestamp > fiveMinAgo)
  const events1Hour = eventBuffer.filter(e => e.timestamp > oneHourAgo)
  const events24h = eventBuffer.filter(e => e.timestamp > twentyFourHoursAgo)
  const criticalEvents24h = events24h.filter(e => e.severity === 'CRITICAL')

  // Top attack types
  const typeCount = new Map<string, number>()
  for (const event of events24h) {
    typeCount.set(event.type, (typeCount.get(event.type) || 0) + 1)
  }
  const topAttackTypes = Array.from(typeCount.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top attacker IPs
  const ipEventCount = new Map<string, { count: number; lastType: string }>()
  for (const event of events24h) {
    const existing = ipEventCount.get(event.ip)
    if (existing) {
      existing.count++
      existing.lastType = event.type
    } else {
      ipEventCount.set(event.ip, { count: 1, lastType: event.type })
    }
  }
  const topAttackerIPs = Array.from(ipEventCount.entries())
    .map(([ip, data]) => ({ ip, eventCount: data.count, lastEvent: data.lastType }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 10)

  // Calculate security score
  let securityScore = 100
  securityScore -= criticalEvents24h.length * 5
  securityScore -= events24h.filter(e => e.severity === 'HIGH').length * 2
  securityScore -= events24h.filter(e => e.severity === 'MEDIUM').length * 0.5
  securityScore = Math.max(0, Math.min(100, securityScore))

  // Determine status
  let status: SecurityMetrics['status'] = 'SECURE'
  if (criticalEvents24h.length > 0 || securityScore < 30) status = 'CRITICAL'
  else if (events5Min.filter(e => e.severity === 'HIGH').length > 0 || securityScore < 60) status = 'THREAT'
  else if (events1Hour.filter(e => e.severity === 'MEDIUM').length > 5 || securityScore < 80) status = 'ELEVATED'

  return {
    timestamp: now,
    eventsLast5Min: events5Min.length,
    eventsLast1Hour: events1Hour.length,
    eventsLast24Hours: events24h.length,
    criticalEvents24h: criticalEvents24h.length,
    blockedIPs: ipEventCount.size,
    activeThreats: criticalEvents24h.filter(e => now - e.timestamp < 15 * 60 * 1000).length,
    topAttackTypes,
    topAttackerIPs,
    securityScore,
    status,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

async function persistEvent(event: SecurityEvent): Promise<void> {
  await prisma.securityLog.create({
    data: {
      ip: event.ip,
      type: event.type,
      path: event.endpoint || '/sentinel',
      details: JSON.stringify(event.details),
      severity: event.severity,
      userId: event.userId,
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. STARTUP & CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

// Clean up old events from buffer every 5 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  while (eventBuffer.length > 0 && eventBuffer[eventBuffer.length - 1].timestamp < oneHourAgo) {
    eventBuffer.pop()
  }
}, 5 * 60 * 1000)
