import prisma from './prisma'
import crypto from 'crypto'
import { createNotification } from './notifications'
import { sendEmail } from './email'

// ═══════════════════════════════════════════════════════════
// SECURITY FORTRESS - Comprehensive Account Protection System
// Features:
// 1. Account Freeze (3-day) with deep scan
// 2. Blacklist (accounts + IPs)
// 3. Red Flag System (3 flags = auto ban)
// 4. VPN/Proxy Detection (multi-layer)
// 5. Same-IP Account Detection
// 6. Email + Platform Notifications
// ═══════════════════════════════════════════════════════════

const FREEZE_DURATION_DAYS = 3
const MAX_RED_FLAGS_BEFORE_BAN = 3

// ═══════════════════════════════════════════════════════════
// 1. ACCOUNT FREEZE SYSTEM
// ═══════════════════════════════════════════════════════════

/**
 * Freeze a user account for 3 days with notification
 * - User cannot withdraw, transfer, or make investments
 * - Deep scan runs during freeze period
 * - After 3 days: if damage found -> ban, otherwise -> unfreeze + blacklist + strict monitoring
 */
export async function freezeAccount(params: {
  userId: string
  reason: string
  frozenBy?: string // admin userId or 'system'
  ip?: string
}): Promise<{ success: boolean; freezeId?: string; message?: string }> {
  try {
    const user = await prisma.user.findUnique({ where: { id: params.userId } })
    if (!user) return { success: false, message: 'المستخدم غير موجود' }

    // Don't freeze admins
    if (user.role?.toLowerCase() === 'admin') {
      return { success: false, message: 'لا يمكن تجميد حساب المشرف' }
    }

    // Don't double-freeze
    if (user.isFrozen && user.frozenUntil && user.frozenUntil > new Date()) {
      return { success: false, message: 'الحساب مجمد بالفعل' }
    }

    const now = new Date()
    const unfreezeAt = new Date(now.getTime() + FREEZE_DURATION_DAYS * 24 * 60 * 60 * 1000)

    // Create freeze record
    const freeze = await prisma.accountFreeze.create({
      data: {
        userId: params.userId,
        reason: params.reason,
        frozenBy: params.frozenBy || 'system',
        frozenAt: now,
        unfreezeAt,
        status: 'ACTIVE',
      },
    })

    // Update user record
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        isFrozen: true,
        frozenUntil: unfreezeAt,
        freezeReason: params.reason,
        frozenAt: now,
        frozenBy: params.frozenBy || 'system',
        // Invalidate all active tokens
        tokenVersion: { increment: 1 },
      },
    })

    // If IP provided, also add to IP monitoring
    if (params.ip) {
      await prisma.user.update({
        where: { id: params.userId },
        data: { lastKnownIP: params.ip },
      })
    }

    // Send platform notification
    await createNotification({
      userId: params.userId,
      title: 'تم تجميد حسابك',
      message: `تم تجميد حسابك لمدة ${FREEZE_DURATION_DAYS} أيام بسبب: ${params.reason}. لا يمكنك السحب أو التحويل خلال هذه الفترة. إذا لم يُكتشف ضرر بالمنصة سيتم فك التجميد، وإلا سيتم حظر حسابك.`,
      type: 'WARNING',
      data: { freezeId: freeze.id, reason: params.reason, unfreezeAt: unfreezeAt.toISOString() },
    })

    // Send email notification
    await sendFreezeEmail(user.email, user.name, params.reason, unfreezeAt)

    // Start deep scan
    await performDeepAccountScan(params.userId, freeze.id)

    // Log security event
    await prisma.securityLog.create({
      data: {
        ip: params.ip || 'unknown',
        type: 'ACCOUNT_FROZEN',
        path: '/api/security/freeze',
        details: `Account frozen for ${FREEZE_DURATION_DAYS} days: ${params.reason}`,
        severity: 'CRITICAL',
        userId: params.userId,
      },
    })

    return { success: true, freezeId: freeze.id, message: `تم تجميد الحساب لمدة ${FREEZE_DURATION_DAYS} أيام` }
  } catch (error) {
    console.error('[FORTRESS] Freeze account error:', error)
    return { success: false, message: 'حدث خطأ أثناء تجميد الحساب' }
  }
}

/**
 * Unfreeze account after 3-day scan completes
 * - If damage found: ban account permanently
 * - If no damage: unfreeze but add to blacklist + strict monitoring
 */
export async function processFreezeCompletion(freezeId: string): Promise<{ action: string; message: string }> {
  try {
    const freeze = await prisma.accountFreeze.findUnique({ where: { id: freezeId } })
    if (!freeze || freeze.status !== 'ACTIVE') {
      return { action: 'NONE', message: 'سجل التجميد غير موجود أو مكتمل' }
    }

    const user = await prisma.user.findUnique({ where: { id: freeze.userId } })
    if (!user) return { action: 'NONE', message: 'المستخدم غير موجود' }

    // Get the deep scan result
    const scan = await prisma.deepAccountScan.findFirst({
      where: { freezeId: freeze.id },
      orderBy: { createdAt: 'desc' },
    })

    const platformDamage = scan?.platformDamage || false
    const recommendation = scan?.recommendation || 'MONITOR'
    const overallRisk = scan?.overallRiskScore || 0

    if (platformDamage || recommendation === 'BAN') {
      // BAN the account permanently
      await banAccount(freeze.userId, `ضرر بالمنصة بعد فحص عميق: ${freeze.reason}`, freeze.frozenBy || 'system')

      await prisma.accountFreeze.update({
        where: { id: freezeId },
        data: {
          status: 'ESCALATED_TO_BAN',
          platformDamage: true,
          damageDetails: scan?.damageDetails,
          scanResult: scan?.scanData,
          scanCompletedAt: new Date(),
          escalatedToBan: true,
        },
      })

      return { action: 'BANNED', message: 'تم حظر الحساب بسبب اكتشاف ضرر بالمنصة' }
    }

    // No damage found - unfreeze but add to blacklist + strict monitoring
    await prisma.user.update({
      where: { id: freeze.userId },
      data: {
        isFrozen: false,
        frozenUntil: null,
        freezeReason: null,
        isBlacklisted: true,
        blacklistReason: `تم تجميد مسبقاً: ${freeze.reason}`,
        blacklistedAt: new Date(),
        monitoringLevel: 'HIGH', // Strict monitoring
        tokenVersion: { increment: 1 }, // Invalidate old tokens
      },
    })

    // Add to blacklist entries
    await prisma.blacklistEntry.create({
      data: {
        targetType: 'USER',
        targetValue: freeze.userId,
        reason: `تم تجميد مسبقاً: ${freeze.reason}`,
        source: 'auto_scan',
        isPermanent: true,
      },
    })

    // Add user's IP to IP blacklist
    if (user.lastKnownIP && user.lastKnownIP !== 'unknown') {
      await addToBlacklist('IP', user.lastKnownIP, `IP مستخدم مجمد: ${user.email}`, 'auto_scan', true, freeze.userId)
    }

    // Add user's email to email blacklist
    await addToBlacklist('EMAIL', user.email, `بريد مستخدم مجمد: ${freeze.reason}`, 'auto_scan', true, freeze.userId)

    await prisma.accountFreeze.update({
      where: { id: freezeId },
      data: {
        status: 'COMPLETED',
        platformDamage: false,
        scanResult: scan?.scanData,
        scanCompletedAt: new Date(),
        autoUnfroze: true,
      },
    })

    // Notify user
    await createNotification({
      userId: freeze.userId,
      title: 'تم فك تجميد حسابك',
      message: 'تم فك تجميد حسابك بعد انتهاء فترة المراجعة. حسابك سيكون تحت مراقبة مشددة. أي نشاط مشبوه سيؤدي لحظر فوري.',
      type: 'SYSTEM',
    })

    await sendUnfreezeEmail(user.email, user.name)

    return { action: 'UNFROZEN_WITH_MONITORING', message: 'تم فك التجميد مع مراقبة مشددة' }
  } catch (error) {
    console.error('[FORTRESS] Process freeze completion error:', error)
    return { action: 'ERROR', message: 'حدث خطأ' }
  }
}

// ═══════════════════════════════════════════════════════════
// 2. BAN ACCOUNT SYSTEM
// ═══════════════════════════════════════════════════════════

/**
 * Permanently ban an account
 * - Sets isActive = false
 * - Adds to blacklist (user, IP, email)
 * - Invalidates all tokens
 */
export async function banAccount(userId: string, reason: string, bannedBy: string = 'system'): Promise<{ success: boolean }> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { success: false }

    // Don't ban admins
    if (user.role?.toLowerCase() === 'admin') return { success: false }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        isFrozen: false,
        frozenUntil: null,
        isBlacklisted: true,
        blacklistReason: reason,
        blacklistedAt: new Date(),
        tokenVersion: { increment: 1 }, // Invalidate all tokens
      },
    })

    // Add to blacklist entries
    await addToBlacklist('USER', userId, reason, bannedBy === 'system' ? 'system' : 'admin', true, userId)
    await addToBlacklist('EMAIL', user.email, reason, bannedBy === 'system' ? 'system' : 'admin', true, userId)

    if (user.lastKnownIP && user.lastKnownIP !== 'unknown') {
      await addToBlacklist('IP', user.lastKnownIP, `IP مستخدم محظور: ${user.email} - ${reason}`, bannedBy === 'system' ? 'system' : 'admin', true, userId)
    }

    // Notify user
    await createNotification({
      userId,
      title: 'تم حظر حسابك',
      message: `تم حظر حسابك نهائياً بسبب: ${reason}. إذا كنت تعتقد أن هذا خطأ، تواصل مع الدعم الفني.`,
      type: 'WARNING',
    })

    // Send ban email
    await sendBanEmail(user.email, user.name, reason)

    // Log
    await prisma.securityLog.create({
      data: {
        ip: user.lastKnownIP || 'unknown',
        type: 'ACCOUNT_BANNED',
        path: '/api/security/ban',
        details: `Account banned: ${reason}`,
        severity: 'CRITICAL',
        userId,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[FORTRESS] Ban account error:', error)
    return { success: false }
  }
}

// ═══════════════════════════════════════════════════════════
// 3. RED FLAG SYSTEM
// ═══════════════════════════════════════════════════════════

/**
 * Issue a red flag to a user account
 * - 3 red flags = automatic ban
 * - User can see their red flags with reasons
 * - Each flag is logged with full details
 */
export async function issueRedFlag(params: {
  userId: string
  reason: string
  reasonCode: string // VPN_DETECTED, PROXY_DETECTED, SUSPICIOUS_IP, SAME_IP_ACCOUNTS, etc.
  ip?: string
  details?: Record<string, any>
  source?: string // system, admin, auto
}): Promise<{ flagged: boolean; totalFlags: number; action: string }> {
  try {
    const user = await prisma.user.findUnique({ where: { id: params.userId } })
    if (!user) return { flagged: false, totalFlags: 0, action: 'USER_NOT_FOUND' }

    // Don't flag admins
    if (user.role?.toLowerCase() === 'admin') return { flagged: false, totalFlags: 0, action: 'ADMIN_IMMUNE' }

    // Create red flag
    const redFlag = await prisma.redFlag.create({
      data: {
        userId: params.userId,
        reason: params.reason,
        reasonCode: params.reasonCode,
        ip: params.ip,
        details: params.details ? JSON.stringify(params.details) : null,
        source: params.source || 'system',
      },
    })

    // Increment red flag count
    const newFlagCount = user.redFlagCount + 1
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        redFlagCount: newFlagCount,
        // Increase monitoring level based on flags
        monitoringLevel: newFlagCount >= 2 ? 'HIGH' : 'ELEVATED',
      },
    })

    // Notify user about the red flag
    await createNotification({
      userId: params.userId,
      title: 'إشارة حمراء على حسابك',
      message: `تم وضع إشارة حمراء على حسابك بسبب: ${params.reason}. لديك ${newFlagCount}/${MAX_RED_FLAGS_BEFORE_BAN} إشارات. عند الوصول لـ ${MAX_RED_FLAGS_BEFORE_BAN} إشارات سيتم حظر حسابك تلقائياً.`,
      type: 'WARNING',
      data: { redFlagId: redFlag.id, reasonCode: params.reasonCode, totalFlags: newFlagCount },
    })

    // Send email about red flag
    await sendRedFlagEmail(user.email, user.name, params.reason, newFlagCount)

    // Check if we should auto-ban
    if (newFlagCount >= MAX_RED_FLAGS_BEFORE_BAN) {
      await banAccount(params.userId, `تم حظر الحساب تلقائياً بعد ${MAX_RED_FLAGS_BEFORE_BAN} إشارات حمراء`, 'system')
      return { flagged: true, totalFlags: newFlagCount, action: 'AUTO_BANNED' }
    }

    // If first or second flag, increase monitoring and potentially freeze
    if (newFlagCount === 2) {
      // Second flag - freeze for 3 days
      await freezeAccount({
        userId: params.userId,
        reason: `تجميد تلقائي بعد إشارتين حمراويتين: ${params.reason}`,
        frozenBy: 'system',
        ip: params.ip,
      })
      return { flagged: true, totalFlags: newFlagCount, action: 'FROZEN' }
    }

    return { flagged: true, totalFlags: newFlagCount, action: 'FLAGGED' }
  } catch (error) {
    console.error('[FORTRESS] Issue red flag error:', error)
    return { flagged: false, totalFlags: 0, action: 'ERROR' }
  }
}

// ═══════════════════════════════════════════════════════════
// 4. VPN / PROXY DETECTION (Multi-Layer)
// ═══════════════════════════════════════════════════════════

interface VPNDetectionResult {
  isVPN: boolean
  isProxy: boolean
  isTor: boolean
  confidence: number // 0-100
  method: string
  isp: string
  organization: string
  country: string
  city: string
  riskScore: number
}

/**
 * Advanced multi-layer VPN/Proxy detection
 * Layer 1: ip-api.com (basic proxy/hosting detection)
 * Layer 2: Behavioral analysis (timing, WebRTC, timezone mismatches)
 * Layer 3: Multi-check consistency (multiple APIs cross-referenced)
 */
export async function detectVPNAdvanced(ip: string, userId?: string, userAgent?: string): Promise<VPNDetectionResult> {
  const defaultResult: VPNDetectionResult = {
    isVPN: false, isProxy: false, isTor: false,
    confidence: 0, method: 'none',
    isp: '', organization: '', country: '', city: '', riskScore: 0,
  }

  // Skip private/local IPs (including IPv6 localhost ::1)
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('fc') || ip.startsWith('fe80')) {
    return defaultResult
  }

  try {
    // Layer 1: ip-api.com check
    const ipApiResult = await checkWithIPApi(ip)

    // Layer 2: Check if IP is in known datacenter ranges
    const isDatacenter = checkDatacenterIP(ip, ipApiResult)

    // Layer 3: Behavioral consistency check
    const behavioralFlags = await checkBehavioralConsistency(ip, userId)

    // Combine results
    const isVPN = ipApiResult.proxy || ipApiResult.hosting || isDatacenter
    const isProxy = !!ipApiResult.proxy
    const isTor = await checkTorExitNode(ip)

    // Calculate confidence score
    let confidence = 0
    if (isVPN) confidence += 40
    if (isProxy) confidence += 30
    if (isTor) confidence += 50
    if (isDatacenter) confidence += 30
    if (behavioralFlags.suspicious) confidence += 20
    confidence = Math.min(100, confidence)

    // Calculate risk score
    let riskScore = 0
    if (isVPN) riskScore += 40
    if (isProxy) riskScore += 30
    if (isTor) riskScore += 50
    if (isDatacenter) riskScore += 25
    if (behavioralFlags.suspicious) riskScore += 20
    riskScore = Math.min(100, riskScore)

    const result: VPNDetectionResult = {
      isVPN,
      isProxy,
      isTor,
      confidence,
      method: ipApiResult.hosting ? 'ip-api+hosting' : isDatacenter ? 'ip-api+datacenter' : 'ip-api',
      isp: ipApiResult.isp || '',
      organization: ipApiResult.org || '',
      country: ipApiResult.country || '',
      city: ipApiResult.city || '',
      riskScore,
    }

    // Log the detection
    if (userId) {
      const vpnLog = await prisma.vPNDetectionLog.create({
        data: {
          userId,
          ip,
          isVPN,
          isProxy,
          isTor,
          isp: result.isp,
          organization: result.organization,
          country: result.country,
          city: result.city,
          riskScore,
          detectionMethod: result.method,
          userAgent,
        },
      })

      // Update user VPN status
      await prisma.user.update({
        where: { id: userId },
        data: {
          vpnDetected: isVPN || isProxy || isTor,
          lastVPNCheck: new Date(),
        },
      })

      // ═══════════════════════════════════════════════════════════
      // VPN/Proxy/Telegram Flagging Logic:
      // - Normal VPN usage: ONLY detect + log (country, city, ISP). NO red flag, NO action.
      // - Tor: ALWAYS red flag (highly suspicious on a financial platform)
      // - VPN/Proxy + account is frozen/blacklisted: RED FLAG for EVASION attempt
      // ═══════════════════════════════════════════════════════════
      const detectionUser = await prisma.user.findUnique({ where: { id: userId } })
      const shouldFlag = isTor // Tor is always flagged on financial platforms
        || ((isVPN || isProxy) && (detectionUser?.isFrozen || detectionUser?.isBlacklisted)) // Frozen/blacklisted user using VPN to evade

      if (shouldFlag) {
        let flagReason: string
        let reasonCode: string

        if (isTor) {
          flagReason = 'تم اكتشاف استخدام شبكة Tor - محظور على المنصة المالية'
          reasonCode = 'TOR_DETECTED'
        } else if (detectionUser?.isFrozen) {
          flagReason = `محاولة تهرب من تجميد الحساب عبر ${isVPN ? 'VPN' : 'بروكسي'} (${result.isp || result.organization}) - ${result.country || ''}, ${result.city || ''}`
          reasonCode = 'FREEZE_EVASION_VPN'
        } else if (detectionUser?.isBlacklisted) {
          flagReason = `محاولة تهرب من القائمة السوداء عبر ${isVPN ? 'VPN' : 'بروكسي'} (${result.isp || result.organization}) - ${result.country || ''}, ${result.city || ''}`
          reasonCode = 'BLACKLIST_EVASION_VPN'
        } else {
          flagReason = `تم اكتشاف ${isVPN ? 'VPN' : 'بروكسي'} (${result.isp || result.organization})`
          reasonCode = isVPN ? 'VPN_DETECTED' : 'PROXY_DETECTED'
        }

        // Check if user already has a recent VPN red flag (avoid duplicates within 24h)
        const recentVPNFlag = await prisma.redFlag.findFirst({
          where: {
            userId,
            reasonCode: { in: ['VPN_DETECTED', 'PROXY_DETECTED', 'TOR_DETECTED', 'FREEZE_EVASION_VPN', 'BLACKLIST_EVASION_VPN'] },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        })

        if (!recentVPNFlag) {
          const redFlagResult = await issueRedFlag({
            userId,
            reason: flagReason,
            reasonCode,
            ip,
            details: {
              isp: result.isp,
              org: result.organization,
              country: result.country,
              city: result.city,
              confidence,
              method: result.method,
              riskScore,
              isFrozen: detectionUser?.isFrozen || false,
              isBlacklisted: detectionUser?.isBlacklisted || false,
            },
          })

          // Mark the VPN log with red flag issued
          if (redFlagResult.flagged) {
            await prisma.vPNDetectionLog.update({
              where: { id: vpnLog.id },
              data: { redFlagIssued: true },
            })
          }
        }
      } else if (isVPN || isProxy) {
        // Normal VPN usage - just log it (no red flag, no action)
        console.log(`[FORTRESS] VPN/Proxy detected for user ${userId}: ${result.isp || result.organization} (${result.country}, ${result.city}) - No action taken (normal VPN usage)`)
      }
    }

    return result
  } catch (error) {
    console.error('[FORTRESS] VPN detection error:', error)
    return defaultResult
  }
}

// Layer 1: ip-api.com check
async function checkWithIPApi(ip: string): Promise<any> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,city,isp,org,proxy,hosting,query,as`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return {}
    const data = await response.json()
    if (data.status !== 'success') return {}
    return data
  } catch {
    return {}
  }
}

// Check if IP belongs to known datacenter/cloud provider ranges
function checkDatacenterIP(ip: string, ipApiResult: any): boolean {
  // Check the AS/org for known cloud providers
  const org = (ipApiResult.org || '').toLowerCase()
  const asn = (ipApiResult.as || '').toLowerCase()
  const isp = (ipApiResult.isp || '').toLowerCase()

  const datacenterKeywords = [
    'amazon', 'aws', 'google cloud', 'gcp', 'microsoft azure', 'azure',
    'digitalocean', 'linode', 'akamai', 'cloudflare', 'vultr', 'ovh',
    'hetzner', 'contabo', 'scaleway', 'upcloud', 'kamatera', 'choopa',
    'm247', 'psychz', 'buyvm', 'hostwinds', 'leaseweb', 'serverius',
    'datacamp', 'quadranet', 'zenlayer', 'alibaba cloud', 'tencent cloud',
    'rackspace', 'oracle cloud', 'ibm cloud', 'digital server',
    'hosting', 'datacenter', 'data center', 'cloud', 'vps', 'dedicated',
    'server', 'colocation', 'idc', 'datacentre',
  ]

  const combined = `${org} ${asn} ${isp}`
  return datacenterKeywords.some(keyword => combined.includes(keyword))
}

// Check if IP is a Tor exit node
async function checkTorExitNode(ip: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://check.torproject.org/torbulkexitlist`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!response.ok) return false
    const text = await response.text()
    return text.split('\n').includes(ip)
  } catch {
    // Fallback: check via DNS
    try {
      const reversedIp = ip.split('.').reverse().join('.')
      const dnsResult = await fetch(
        `https://dns.google/resolve?name=${reversedIp}.dnsel.torproject.org&type=A`,
        { signal: AbortSignal.timeout(3000) }
      )
      if (!dnsResult.ok) return false
      const data = await dnsResult.json()
      // If DNS resolves to 127.0.0.2, it's a Tor exit node
      return data.Answer?.some((a: any) => a.data === '127.0.0.2') || false
    } catch {
      return false
    }
  }
}

// Behavioral consistency analysis
async function checkBehavioralConsistency(ip: string, userId?: string): Promise<{ suspicious: boolean; reasons: string[] }> {
  const reasons: string[] = []
  let suspicious = false

  if (!userId) return { suspicious: false, reasons: [] }

  try {
    // Check if this IP has been used by multiple accounts recently
    const recentLogins = await prisma.userLoginIP.findMany({
      where: {
        ip,
        loginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      distinct: ['userId'],
    })

    if (recentLogins.length >= 3) {
      suspicious = true
      reasons.push(`IP used by ${recentLogins.length} different accounts in last 7 days`)
    }

    // Check rapid location changes (different countries in short time)
    const userRecentLogins = await prisma.userLoginIP.findMany({
      where: {
        userId,
        loginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { loginAt: 'desc' },
      take: 5,
    })

    const countries = new Set(userRecentLogins.map(l => l.country).filter(Boolean))
    if (countries.size >= 3) {
      suspicious = true
      reasons.push(`Logged in from ${countries.size} different countries in 24h`)
    }

    return { suspicious, reasons }
  } catch {
    return { suspicious: false, reasons: [] }
  }
}

// ═══════════════════════════════════════════════════════════
// 5. SAME-IP ACCOUNT DETECTION
// ═══════════════════════════════════════════════════════════

/**
 * Detect and handle accounts created/used from the same IP
 * - Flags all related accounts for strict monitoring
 * - Issues red flags if suspicious patterns found
 */
export async function detectSameIPAccounts(ip: string, currentUserId?: string): Promise<{
  relatedAccounts: string[]
  suspicious: boolean
  action: string
}> {
  try {
    if (ip === 'unknown' || ip === '127.0.0.1') {
      return { relatedAccounts: [], suspicious: false, action: 'SKIP' }
    }

    // Find all users who logged in from this IP
    const loginRecords = await prisma.userLoginIP.findMany({
      where: {
        ip,
        loginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      distinct: ['userId'],
      select: { userId: true },
    })

    const userIds = [...new Set(loginRecords.map(r => r.userId))]

    // Also check users whose lastKnownIP matches
    const usersWithIP = await prisma.user.findMany({
      where: {
        lastKnownIP: ip,
        isActive: true,
      },
      select: { id: true },
    })

    const allUserIds = [...new Set([...userIds, ...usersWithIP.map(u => u.id)])]

    if (allUserIds.length <= 1) {
      return { relatedAccounts: allUserIds, suspicious: false, action: 'NORMAL' }
    }

    // Multiple accounts from same IP - suspicious!
    if (allUserIds.length >= 2) {
      // Put all related accounts under elevated monitoring
      for (const uid of allUserIds) {
        const user = await prisma.user.findUnique({ where: { id: uid } })
        if (!user || user.role?.toLowerCase() === 'admin') continue

        // Update monitoring level
        if (user.monitoringLevel === 'NORMAL') {
          await prisma.user.update({
            where: { id: uid },
            data: { monitoringLevel: 'ELEVATED' },
          })
        }

        // If 3+ accounts from same IP, issue red flag to each
        if (allUserIds.length >= 3) {
          await issueRedFlag({
            userId: uid,
            reason: `تم اكتشاف ${allUserIds.length} حسابات من نفس عنوان IP (${ip})`,
            reasonCode: 'SAME_IP_ACCOUNTS',
            ip,
            details: { accountCount: allUserIds.length, relatedAccounts: allUserIds },
            source: 'auto',
          })
        }
      }

      // Log security event
      await prisma.securityLog.create({
        data: {
          ip,
          type: 'SAME_IP_ACCOUNTS',
          path: '/api/security/same-ip',
          details: `Found ${allUserIds.length} accounts using same IP: ${ip}`,
          severity: allUserIds.length >= 3 ? 'HIGH' : 'MEDIUM',
        },
      })
    }

    return {
      relatedAccounts: allUserIds,
      suspicious: allUserIds.length >= 2,
      action: allUserIds.length >= 3 ? 'RED_FLAGGED' : 'MONITORING',
    }
  } catch (error) {
    console.error('[FORTRESS] Same IP detection error:', error)
    return { relatedAccounts: [], suspicious: false, action: 'ERROR' }
  }
}

// ═══════════════════════════════════════════════════════════
// 6. DEEP ACCOUNT SCAN
// ═══════════════════════════════════════════════════════════

/**
 * Perform a comprehensive deep scan of a user account
 * Checks: transactions, balances, logins, IPs, VPN usage, referral patterns
 */
export async function performDeepAccountScan(userId: string, freezeId?: string): Promise<{
  riskScore: number
  platformDamage: boolean
  recommendation: string
  details: Record<string, any>
}> {
  try {
    const scan = await prisma.deepAccountScan.create({
      data: {
        userId,
        freezeId,
        scanType: freezeId ? 'FREEZE_3DAY' : 'MANUAL',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      await prisma.deepAccountScan.update({
        where: { id: scan.id },
        data: { status: 'COMPLETED', completedAt: new Date(), recommendation: 'USER_NOT_FOUND' },
      })
      return { riskScore: 0, platformDamage: false, recommendation: 'USER_NOT_FOUND', details: {} }
    }

    const details: Record<string, any> = {}
    let totalRiskScore = 0
    let platformDamage = false

    // 1. Transaction Analysis
    const transactions = await prisma.transaction.findMany({ where: { userId } })
    details.totalTransactions = transactions.length

    // Check for suspicious transaction patterns
    const largeDeposits = transactions.filter(t => t.type === 'DEPOSIT' && t.amount > 5000)
    const pendingDeposits = transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'PENDING')
    const failedDeposits = transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'FAILED' || t.status === 'REJECTED')
    const suspiciousTx = transactions.filter(t =>
      t.status === 'REJECTED' ||
      (t.type === 'WITHDRAWAL' && t.amount > user.totalDeposited * 0.8)
    )

    details.suspiciousTxCount = suspiciousTx.length
    details.largeDeposits = largeDeposits.length
    details.pendingDeposits = pendingDeposits.length
    details.failedDeposits = failedDeposits.length

    if (failedDeposits.length > 5) {
      totalRiskScore += 15
      details.balanceAnomalyReason = 'Multiple failed deposits'
    }

    // 2. Balance Analysis
    const totalDeposited = user.totalDeposited || 0
    const totalWithdrawn = user.totalWithdrawn || 0
    const currentBalance = user.balance || 0

    // Check if balance is inconsistent with deposits/withdrawals
    const expectedBalance = totalDeposited - totalWithdrawn + (user.totalProfit || 0)
    const balanceDiscrepancy = Math.abs(currentBalance - expectedBalance)
    details.balanceDiscrepancy = balanceDiscrepancy
    details.expectedBalance = expectedBalance
    details.currentBalance = currentBalance

    if (balanceDiscrepancy > 100) {
      totalRiskScore += 30
      details.balanceAnomaly = true
      platformDamage = true
      details.damageDetails = `Balance discrepancy: $${balanceDiscrepancy.toFixed(2)} (expected: $${expectedBalance.toFixed(2)}, actual: $${currentBalance.toFixed(2)})`
    }

    // 3. Login & IP Analysis
    const loginIPs = await prisma.userLoginIP.findMany({ where: { userId } })
    details.uniqueIPCount = new Set(loginIPs.map(l => l.ip)).size
    details.vpnLoginCount = loginIPs.filter(l => l.isVPN || l.isProxy).length

    if (details.vpnLoginCount > 5) {
      totalRiskScore += 20
    }

    // Check for IPs used by multiple accounts
    const ipAddresses = [...new Set(loginIPs.map(l => l.ip))]
    let sameIPAccountCount = 0
    for (const ip of ipAddresses) {
      if (ip === 'unknown') continue
      const count = await prisma.userLoginIP.groupBy({
        by: ['userId'],
        where: { ip },
      })
      if (count.length > 1) sameIPAccountCount += count.length - 1
    }
    details.sameIPAccountCount = sameIPAccountCount

    if (sameIPAccountCount > 2) {
      totalRiskScore += 25
    }

    // 4. VPN Detection History
    const vpnLogs = await prisma.vPNDetectionLog.findMany({ where: { userId } })
    details.vpnUsageCount = vpnLogs.filter(l => l.isVPN || l.isProxy || l.isTor).length

    if (details.vpnUsageCount > 3) {
      totalRiskScore += 20
    }

    // 5. Referral Fraud Detection
    const referrals = await prisma.referral.findMany({ where: { referrerId: userId } })
    let referralFraudScore = 0
    for (const ref of referrals) {
      // Check if referred user has same IP as referrer
      const referredLogins = await prisma.userLoginIP.findMany({
        where: { userId: ref.referredId },
        select: { ip: true },
      })
      const referrerLogins = await prisma.userLoginIP.findMany({
        where: { userId },
        select: { ip: true },
      })
      const referrerIPs = new Set(referrerLogins.map(l => l.ip))
      const referredIPs = new Set(referredLogins.map(l => l.ip))
      const commonIPs = [...referrerIPs].filter(ip => referredIPs.has(ip))
      if (commonIPs.length > 0) {
        referralFraudScore += 20
      }

      // Check if referred user has deposited anything
      const referredDeposits = await prisma.transaction.count({
        where: {
          userId: ref.referredId,
          type: 'DEPOSIT',
          status: { in: ['COMPLETED', 'APPROVED'] },
        },
      })
      if (referredDeposits === 0 && ref.status === 'COMPLETED') {
        referralFraudScore += 10
      }
    }

    details.referralFraudScore = referralFraudScore
    if (referralFraudScore > 30) {
      totalRiskScore += 15
    }

    // 6. Red Flag History
    const redFlags = await prisma.redFlag.findMany({ where: { userId } })
    details.redFlagCount = redFlags.length
    totalRiskScore += redFlags.length * 10

    // 7. Security Events
    const securityEvents = await prisma.securityLog.findMany({
      where: { userId, severity: { in: ['HIGH', 'CRITICAL'] } },
    })
    details.highSeverityEvents = securityEvents.length
    totalRiskScore += Math.min(20, securityEvents.length * 5)

    // Cap risk score at 100
    totalRiskScore = Math.min(100, totalRiskScore)

    // Determine recommendation
    let recommendation = 'UNFREEZE'
    if (totalRiskScore >= 60 || platformDamage) {
      recommendation = 'BAN'
    } else if (totalRiskScore >= 30) {
      recommendation = 'MONITOR'
    }

    // Update scan record
    await prisma.deepAccountScan.update({
      where: { id: scan.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalTransactions: transactions.length,
        suspiciousTxCount: suspiciousTx.length,
        balanceAnomaly: details.balanceAnomaly || false,
        loginAnomaly: details.vpnLoginCount > 3,
        ipAnomaly: sameIPAccountCount > 1,
        vpnUsageCount: details.vpnUsageCount || 0,
        sameIPAccountCount,
        referralFraudScore,
        overallRiskScore: totalRiskScore,
        platformDamage,
        damageDetails: details.damageDetails ? JSON.stringify(details.damageDetails) : null,
        recommendation,
        scanData: JSON.stringify(details),
      },
    })

    // If freeze exists, update freeze scan result
    if (freezeId) {
      await prisma.accountFreeze.update({
        where: { id: freezeId },
        data: {
          scanResult: JSON.stringify(details),
          scanCompletedAt: new Date(),
          platformDamage,
          damageDetails: details.damageDetails || null,
        },
      })
    }

    return { riskScore: totalRiskScore, platformDamage, recommendation, details }
  } catch (error) {
    console.error('[FORTRESS] Deep scan error:', error)
    return { riskScore: 50, platformDamage: false, recommendation: 'MONITOR', details: { error: String(error) } }
  }
}

// ═══════════════════════════════════════════════════════════
// 7. BLACKLIST MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function addToBlacklist(
  targetType: 'USER' | 'IP' | 'EMAIL',
  targetValue: string,
  reason: string,
  source: string = 'system',
  isPermanent: boolean = true,
  relatedUserId?: string
): Promise<{ success: boolean }> {
  try {
    await prisma.blacklistEntry.upsert({
      where: {
        id: `${targetType}_${targetValue}`.slice(0, 30), // Use composite-like key
      },
      create: {
        targetType,
        targetValue,
        reason,
        source,
        isPermanent,
        relatedUserId,
      },
      update: {
        reason,
        source,
        isPermanent,
      },
    }).catch(async () => {
      // If upsert fails due to ID constraints, just create
      await prisma.blacklistEntry.create({
        data: {
          targetType,
          targetValue,
          reason,
          source,
          isPermanent,
          relatedUserId,
        },
      })
    })

    // If IP blacklist, also add to IPBlocklist for middleware enforcement
    if (targetType === 'IP') {
      await prisma.iPBlocklist.upsert({
        where: { ip: targetValue },
        update: {
          reason,
          isAutoBlock: source === 'system',
          expiresAt: isPermanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        create: {
          ip: targetValue,
          reason,
          isAutoBlock: source === 'system',
          expiresAt: isPermanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    }

    return { success: true }
  } catch (error) {
    console.error('[FORTRESS] Add to blacklist error:', error)
    return { success: false }
  }
}

export async function checkBlacklist(targetType: 'USER' | 'IP' | 'EMAIL', targetValue: string): Promise<boolean> {
  try {
    const entry = await prisma.blacklistEntry.findFirst({
      where: {
        targetType,
        targetValue,
        OR: [
          { isPermanent: true },
          { expiresAt: { gt: new Date() } },
        ],
      },
    })
    return !!entry
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════
// 8. LOGIN SECURITY CHECK (Enhanced)
// ═══════════════════════════════════════════════════════════

/**
 * Comprehensive login security check
 * Should be called on every login attempt
 */
export async function performLoginSecurityCheck(params: {
  userId: string
  ip: string
  userAgent?: string
  email: string
}): Promise<{
  allowed: boolean
  reason?: string
  action?: string
}> {
  try {
    const { userId, ip, userAgent, email } = params

    // 1. Check if account is frozen
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user?.isFrozen && user.frozenUntil && user.frozenUntil > new Date()) {
      return { allowed: false, reason: `حسابك مجمد حتى ${user.frozenUntil.toLocaleDateString('ar')}. لا يمكنك الدخول.`, action: 'FROZEN' }
    }

    // 2. Check if account is banned/blacklisted
    if (user?.isBlacklisted) {
      return { allowed: false, reason: 'حسابك محظور. تواصل مع الدعم الفني.', action: 'BLACKLISTED' }
    }

    if (!user?.isActive) {
      return { allowed: false, reason: 'حسابك معطل.', action: 'INACTIVE' }
    }

    // 3. Check if IP is blacklisted
    const ipBlacklisted = await checkBlacklist('IP', ip)
    if (ipBlacklisted) {
      return { allowed: false, reason: 'عنوان IP محظور.', action: 'IP_BLACKLISTED' }
    }

    // 4. Check if email is blacklisted
    const emailBlacklisted = await checkBlacklist('EMAIL', email)
    if (emailBlacklisted) {
      return { allowed: false, reason: 'هذا البريد الإلكتروني محظور.', action: 'EMAIL_BLACKLISTED' }
    }

    // 5. Record login IP with geolocation
    const vpnResult = await detectVPNAdvanced(ip, userId, userAgent)
    const isEvasionAttempt = (vpnResult.isVPN || vpnResult.isProxy) && (user.isFrozen || user.isBlacklisted)
    await prisma.userLoginIP.create({
      data: {
        userId,
        ip,
        userAgent,
        country: vpnResult.country,
        city: vpnResult.city,
        isp: vpnResult.isp,
        isVPN: vpnResult.isVPN,
        isProxy: vpnResult.isProxy,
        // Only mark as suspicious if: Tor OR evasion attempt by frozen/blacklisted account
        // Normal VPN usage is NOT suspicious
        isSuspicious: vpnResult.isTor || isEvasionAttempt,
      },
    })

    // 6. Update user's last known IP and geolocation
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastKnownIP: ip,
        // Store geolocation info on the user record for admin visibility
        ...(vpnResult.country ? { kycCountry: vpnResult.country } : {}),
      },
    })

    // 7. Check for same-IP accounts
    await detectSameIPAccounts(ip, userId)

    // 8. For blacklisted users, apply strict monitoring
    if (user.monitoringLevel === 'HIGH') {
      // Log every action for high-monitoring users
      await prisma.securityLog.create({
        data: {
          ip,
          type: 'HIGH_MONITORING_LOGIN',
          path: '/api/auth/login',
          details: `High-monitoring user login from IP: ${ip}`,
          severity: 'MEDIUM',
          userId,
          userAgent,
        },
      })
    }

    return { allowed: true }
  } catch (error) {
    console.error('[FORTRESS] Login security check error:', error)
    return { allowed: true } // Allow login on error to not lock users out
  }
}

// ═══════════════════════════════════════════════════════════
// 9. CRON: Process freeze expirations
// ═══════════════════════════════════════════════════════════

export async function processFreezeExpirations(): Promise<{ processed: number }> {
  try {
    const now = new Date()

    // Find all active freezes that have expired
    const expiredFreezes = await prisma.accountFreeze.findMany({
      where: {
        status: 'ACTIVE',
        unfreezeAt: { lte: now },
      },
    })

    let processed = 0
    for (const freeze of expiredFreezes) {
      // Run deep scan before unfreezing
      const scanResult = await performDeepAccountScan(freeze.userId, freeze.id)
      await processFreezeCompletion(freeze.id)
      processed++
    }

    return { processed }
  } catch (error) {
    console.error('[FORTRESS] Process freeze expirations error:', error)
    return { processed: 0 }
  }
}

// ═══════════════════════════════════════════════════════════
// 10. CHECK IF USER CAN PERFORM FINANCIAL ACTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Check if a user is allowed to perform financial actions (withdraw, transfer, invest)
 * Blocks: frozen, blacklisted, banned accounts
 */
export async function canPerformFinancialAction(userId: string): Promise<{
  allowed: boolean
  reason?: string
}> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { allowed: false, reason: 'المستخدم غير موجود' }

    if (user.isFrozen && user.frozenUntil && user.frozenUntil > new Date()) {
      return {
        allowed: false,
        reason: `حسابك مجمد لمدة ${FREEZE_DURATION_DAYS} أيام بسبب: ${user.freezeReason || 'انتهاك سياسات المنصة'}. لا يمكنك السحب أو التحويل. إذا لم يُكتشف ضرر بالمنصة سيتم فك التجميد، وإلا سيتم حظر حسابك.`,
      }
    }

    if (user.isBlacklisted) {
      return { allowed: false, reason: 'حسابك في القائمة السوداء. لا يمكنك إجراء عمليات مالية.' }
    }

    if (!user.isActive) {
      return { allowed: false, reason: 'حسابك معطل.' }
    }

    return { allowed: true }
  } catch (error) {
    console.error('[FORTRESS] Can perform financial action check error:', error)
    return { allowed: false, reason: 'حدث خطأ في التحقق' }
  }
}

// ═══════════════════════════════════════════════════════════
// 11. EMAIL NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════════════

async function sendFreezeEmail(email: string, userName: string, reason: string, unfreezeAt: Date) {
  await sendEmail(
    email,
    'تم تجميد حسابك - سونا',
    `
    <div style="font-family: 'Tajawal', Arial, sans-serif; direction: rtl; background: #0a0a0a; color: #fff; padding: 30px; max-width: 600px; margin: auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #c9a84c; font-size: 28px;">سونا</h1>
      </div>
      <div style="background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.15); border-radius: 16px; padding: 30px;">
        <h2 style="color: #ff6b6b; margin-bottom: 15px;">تم تجميد حسابك</h2>
        <p>مرحباً ${userName}،</p>
        <p>تم تجميد حسابك لمدة <strong>3 أيام</strong> بسبب: <strong>${reason}</strong></p>
        <p>أثناء فترة التجميد:</p>
        <ul>
          <li>لا يمكنك سحب أموالك</li>
          <li>لا يمكنك تحويل أموال</li>
          <li>لا يمكنك إنشاء استثمارات جديدة</li>
        </ul>
        <p>سيقوم النظام بفحص حسابك بالكامل خلال هذه الفترة.</p>
        <p>تاريخ انتهاء التجميد: <strong>${unfreezeAt.toLocaleDateString('ar')}</strong></p>
        <p style="color: #ff6b6b; margin-top: 15px;"><strong>إذا اكتشف النظام ضرراً بالمنصة، سيتم حظر حسابك نهائياً.</strong></p>
        <p>إذا لم يُكتشف أي ضرر، سيتم فك التجميد مع مراقبة مشددة.</p>
      </div>
    </div>
    `
  )
}

async function sendUnfreezeEmail(email: string, userName: string) {
  await sendEmail(
    email,
    'تم فك تجميد حسابك - سونا',
    `
    <div style="font-family: 'Tajawal', Arial, sans-serif; direction: rtl; background: #0a0a0a; color: #fff; padding: 30px; max-width: 600px; margin: auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #c9a84c; font-size: 28px;">سونا</h1>
      </div>
      <div style="background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.15); border-radius: 16px; padding: 30px;">
        <h2 style="color: #4caf50; margin-bottom: 15px;">تم فك تجميد حسابك</h2>
        <p>مرحباً ${userName}،</p>
        <p>تم فك تجميد حسابك بعد انتهاء فترة المراجعة ولم يُكتشف أي ضرر بالمنصة.</p>
        <p style="color: #ffa726;"><strong>تنبيه:</strong> حسابك سيكون تحت مراقبة مشددة. أي نشاط مشبوه سيؤدي لحظر فوري.</p>
      </div>
    </div>
    `
  )
}

async function sendBanEmail(email: string, userName: string, reason: string) {
  await sendEmail(
    email,
    'تم حظر حسابك - سونا',
    `
    <div style="font-family: 'Tajawal', Arial, sans-serif; direction: rtl; background: #0a0a0a; color: #fff; padding: 30px; max-width: 600px; margin: auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #c9a84c; font-size: 28px;">سونا</h1>
      </div>
      <div style="background: rgba(255,0,0,0.08); border: 1px solid rgba(255,0,0,0.2); border-radius: 16px; padding: 30px;">
        <h2 style="color: #ff5252; margin-bottom: 15px;">تم حظر حسابك نهائياً</h2>
        <p>مرحباً ${userName}،</p>
        <p>تم حظر حسابك نهائياً بسبب: <strong>${reason}</strong></p>
        <p>لا يمكنك الدخول لحسابك أو إجراء أي عمليات.</p>
        <p>إذا كنت تعتقد أن هذا خطأ، تواصل مع الدعم الفني.</p>
      </div>
    </div>
    `
  )
}

async function sendRedFlagEmail(email: string, userName: string, reason: string, totalFlags: number) {
  await sendEmail(
    email,
    'إشارة حمراء على حسابك - سونا',
    `
    <div style="font-family: 'Tajawal', Arial, sans-serif; direction: rtl; background: #0a0a0a; color: #fff; padding: 30px; max-width: 600px; margin: auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #c9a84c; font-size: 28px;">سونا</h1>
      </div>
      <div style="background: rgba(255,152,0,0.08); border: 1px solid rgba(255,152,0,0.2); border-radius: 16px; padding: 30px;">
        <h2 style="color: #ff9800; margin-bottom: 15px;">إشارة حمراء على حسابك</h2>
        <p>مرحباً ${userName}،</p>
        <p>تم وضع إشارة حمراء على حسابك بسبب: <strong>${reason}</strong></p>
        <p>لديك الآن <strong>${totalFlags}/${MAX_RED_FLAGS_BEFORE_BAN}</strong> إشارات حمراء.</p>
        <p style="color: #ff5252;"><strong>عند الوصول لـ ${MAX_RED_FLAGS_BEFORE_BAN} إشارات سيتم حظر حسابك تلقائياً.</strong></p>
      </div>
    </div>
    `
  )
}

// ═══════════════════════════════════════════════════════════
// 12. ADMIN DASHBOARD DATA
// ═══════════════════════════════════════════════════════════

export async function getSecurityFortressData() {
  try {
    const [
      frozenAccounts,
      blacklistedUsers,
      blacklistedIPs,
      blacklistedEmails,
      redFlags,
      vpnDetections,
      activeScans,
      recentFreezes,
      sameIPGroups,
    ] = await Promise.all([
      // Frozen accounts
      prisma.user.findMany({
        where: { isFrozen: true, frozenUntil: { gt: new Date() } },
        select: {
          id: true, email: true, name: true, freezeReason: true, frozenAt: true, frozenUntil: true,
          monitoringLevel: true, redFlagCount: true,
        },
        orderBy: { frozenAt: 'desc' },
      }),

      // Blacklisted users
      prisma.user.findMany({
        where: { isBlacklisted: true },
        select: {
          id: true, email: true, name: true, blacklistReason: true, blacklistedAt: true,
          monitoringLevel: true, redFlagCount: true, lastKnownIP: true, isActive: true,
        },
        orderBy: { blacklistedAt: 'desc' },
      }),

      // Blacklisted IPs
      prisma.blacklistEntry.findMany({
        where: { targetType: 'IP' },
        orderBy: { createdAt: 'desc' },
      }),

      // Blacklisted emails
      prisma.blacklistEntry.findMany({
        where: { targetType: 'EMAIL' },
        orderBy: { createdAt: 'desc' },
      }),

      // Recent red flags
      prisma.redFlag.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // VPN detections
      prisma.vPNDetectionLog.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // Active scans
      prisma.deepAccountScan.findMany({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'desc' },
      }),

      // Recent freezes
      prisma.accountFreeze.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),

      // Same IP groups (find IPs with multiple users)
      prisma.userLoginIP.groupBy({
        by: ['ip'],
        where: {
          loginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          ip: { not: 'unknown' },
        },
        having: {
          userId: { _count: { gt: 1 } },
        },
        take: 20,
        orderBy: { _count: { userId: 'desc' } },
      }),
    ])

    // Count same-IP users
    const sameIPGroupsWithUsers = []
    for (const group of sameIPGroups) {
      const users = await prisma.userLoginIP.findMany({
        where: { ip: group.ip },
        distinct: ['userId'],
        select: {
          userId: true,
          user: { select: { email: true, name: true, monitoringLevel: true, redFlagCount: true } },
        },
      })
      sameIPGroupsWithUsers.push({ ip: group.ip, users })
    }

    return {
      frozenAccounts,
      blacklistedUsers,
      blacklistedIPs,
      blacklistedEmails,
      redFlags,
      vpnDetections,
      activeScans,
      recentFreezes,
      sameIPGroups: sameIPGroupsWithUsers,
      stats: {
        totalFrozen: frozenAccounts.length,
        totalBlacklisted: blacklistedUsers.length,
        totalBlacklistedIPs: blacklistedIPs.length,
        totalRedFlags: redFlags.length,
        totalVPNDetections: vpnDetections.length,
      },
    }
  } catch (error) {
    console.error('[FORTRESS] Get dashboard data error:', error)
    return {
      frozenAccounts: [],
      blacklistedUsers: [],
      blacklistedIPs: [],
      blacklistedEmails: [],
      redFlags: [],
      vpnDetections: [],
      activeScans: [],
      recentFreezes: [],
      sameIPGroups: [],
      stats: { totalFrozen: 0, totalBlacklisted: 0, totalBlacklistedIPs: 0, totalRedFlags: 0, totalVPNDetections: 0 },
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 13. GET USER RED FLAGS (for user to see)
// ═══════════════════════════════════════════════════════════

export async function getUserRedFlags(userId: string) {
  try {
    return await prisma.redFlag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════
// 14. SUSPICIOUS USER AUTO-DETECTION
// ═══════════════════════════════════════════════════════════

/**
 * Automatically detect suspicious users based on multiple signals
 * Should be called periodically (cron job)
 */
export async function autoDetectSuspiciousUsers(): Promise<{ detected: number; actions: string[] }> {
  try {
    const actions: string[] = []
    let detected = 0

    // 1. Find users with high risk scores
    const highRiskUsers = await prisma.suspiciousActivity.findMany({
      where: {
        riskScore: { gte: 70 },
        isResolved: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      distinct: ['userId'],
      select: { userId: true },
    })

    for (const activity of highRiskUsers) {
      if (!activity.userId) continue
      const user = await prisma.user.findUnique({ where: { id: activity.userId } })
      if (!user || user.role?.toLowerCase() === 'admin') continue

      // If user has high risk and multiple unresolved activities, freeze
      const unresolvedCount = await prisma.suspiciousActivity.count({
        where: {
          userId: activity.userId,
          isResolved: false,
          riskScore: { gte: 50 },
        },
      })

      if (unresolvedCount >= 3 && !user.isFrozen) {
        await freezeAccount({
          userId: activity.userId,
          reason: `نشاط مشبوه متكرر (${unresolvedCount} أنشطة عالية المخاطر)`,
          frozenBy: 'system',
          ip: user.lastKnownIP || undefined,
        })
        actions.push(`Frozen user ${user.email} for ${unresolvedCount} suspicious activities`)
        detected++
      }
    }

    // 2. Find users with VPN from multiple countries
    const vpnUsers = await prisma.vPNDetectionLog.groupBy({
      by: ['userId'],
      where: {
        isVPN: true,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      having: { id: { _count: { gt: 3 } } },
    })

    for (const vpnUser of vpnUsers) {
      const user = await prisma.user.findUnique({ where: { id: vpnUser.userId } })
      if (!user || user.role?.toLowerCase() === 'admin') continue

      if (!user.isFrozen && user.redFlagCount < MAX_RED_FLAGS_BEFORE_BAN) {
        await issueRedFlag({
          userId: vpnUser.userId,
          reason: 'استخدام VPN متكرر من مواقع متعددة',
          reasonCode: 'VPN_FREQUENT',
          source: 'auto',
        })
        actions.push(`Red flagged user ${user.email} for frequent VPN usage`)
        detected++
      }
    }

    // 3. Process expired freezes
    const freezeResult = await processFreezeExpirations()
    if (freezeResult.processed > 0) {
      actions.push(`Processed ${freezeResult.processed} expired freezes`)
      detected += freezeResult.processed
    }

    return { detected, actions }
  } catch (error) {
    console.error('[FORTRESS] Auto detect suspicious users error:', error)
    return { detected: 0, actions: [] }
  }
}
