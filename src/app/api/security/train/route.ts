import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// ============================================================
// SECURITY INTELLIGENCE TRAINING SYSTEM
// ============================================================
// This system learns from security events to:
// 1. Identify attack patterns and trends
// 2. Improve detection accuracy
// 3. Adapt rate limiting thresholds
// 4. Learn from false positives
// 5. Optimize VPN/proxy detection
// ============================================================

interface SecurityTrainingResult {
  totalEvents: number
  threatDistribution: { type: string; count: number; severity: string }[]
  topAttackIPs: { ip: string; eventCount: number; types: string[] }[]
  attackTrends: { period: string; count: number; topType: string }[]
  vpnDetectionStats: { totalChecks: number; vpnDetected: number; proxyDetected: number; detectionRate: number }
  falsePositiveRate: number
  recommendations: string[]
  adaptedThresholds: {
    rateLimitLogin: number
    rateLimitAPI: number
    rateLimitDeposit: number
    rateLimitWithdraw: number
    suspiciousIPThreshold: number
    vpnRiskThreshold: number
  }
  trainingDate: string
}

async function trainSecurity(): Promise<SecurityTrainingResult> {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const recommendations: string[] = []

  // 1. Fetch security events
  const securityLogs = await prisma.securityLog.findMany({
    where: { createdAt: { gte: last7d } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })

  const suspiciousActivities = await prisma.suspiciousActivity.findMany({
    where: { createdAt: { gte: last7d } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  // 2. Calculate threat distribution
  const threatTypes: Record<string, { count: number; severity: string }> = {}
  for (const log of securityLogs) {
    const type = log.type || 'UNKNOWN'
    if (!threatTypes[type]) threatTypes[type] = { count: 0, severity: log.severity || 'LOW' }
    threatTypes[type].count++
  }
  const threatDistribution = Object.entries(threatTypes)
    .map(([type, data]) => ({ type, count: data.count, severity: data.severity }))
    .sort((a, b) => b.count - a.count)

  // 3. Top attacking IPs
  const ipEvents: Record<string, { count: number; types: Set<string> }> = {}
  for (const log of securityLogs) {
    if (!ipEvents[log.ip]) ipEvents[log.ip] = { count: 0, types: new Set() }
    ipEvents[log.ip].count++
    ipEvents[log.ip].types.add(log.type)
  }
  const topAttackIPs = Object.entries(ipEvents)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)
    .map(([ip, data]) => ({ ip, eventCount: data.count, types: [...data.types] }))

  // 4. Attack trends (by day)
  const dayEvents: Record<string, { count: number; types: Record<string, number> }> = {}
  for (const log of securityLogs) {
    const day = new Date(log.createdAt).toISOString().slice(0, 10)
    if (!dayEvents[day]) dayEvents[day] = { count: 0, types: {} }
    dayEvents[day].count++
    const type = log.type || 'UNKNOWN'
    dayEvents[day].types[type] = (dayEvents[day].types[type] || 0) + 1
  }
  const attackTrends = Object.entries(dayEvents)
    .map(([period, data]) => ({
      period,
      count: data.count,
      topType: Object.entries(data.types).sort(([, a], [, b]) => b - a)[0]?.[0] || 'NONE',
    }))
    .sort((a, b) => a.period.localeCompare(b.period))

  // 5. VPN Detection statistics
  const vpnLogs = await prisma.vPNDetectionLog.findMany({
    where: { createdAt: { gte: last7d } },
    take: 500,
  })
  const vpnDetected = vpnLogs.filter(v => v.isVPN).length
  const proxyDetected = vpnLogs.filter(v => v.isProxy).length
  const vpnDetectionStats = {
    totalChecks: vpnLogs.length,
    vpnDetected,
    proxyDetected,
    detectionRate: vpnLogs.length > 0 ? (vpnDetected / vpnLogs.length) * 100 : 0,
  }

  // 6. False positive rate (resolved suspicious activities that were false alarms)
  const resolvedActivities = suspiciousActivities.filter(a => a.isResolved)
  const falsePositives = resolvedActivities.filter(a => a.riskScore < 30).length
  const falsePositiveRate = resolvedActivities.length > 0
    ? (falsePositives / resolvedActivities.length) * 100
    : 0

  // 7. Adaptive thresholds based on attack patterns
  const loginAttempts = securityLogs.filter(l => l.type === 'RATE_LIMIT_EXCEEDED' && l.path?.includes('login')).length
  const apiAbuse = securityLogs.filter(l => l.type === 'RATE_LIMIT_EXCEEDED' && !l.path?.includes('login')).length
  const xssAttempts = securityLogs.filter(l => l.type === 'XSS_DETECTED').length
  const sqlInjection = securityLogs.filter(l => l.type === 'SQL_INJECTION').length

  // Adapt thresholds based on attack volume
  const adaptedThresholds = {
    rateLimitLogin: loginAttempts > 100 ? 3 : loginAttempts > 50 ? 5 : 10, // requests per minute
    rateLimitAPI: apiAbuse > 200 ? 30 : apiAbuse > 100 ? 50 : 100,
    rateLimitDeposit: 5, // Keep strict for financial endpoints
    rateLimitWithdraw: 3,
    suspiciousIPThreshold: xssAttempts + sqlInjection > 20 ? 2 : 5, // events before flagging
    vpnRiskThreshold: vpnDetected > 10 ? 30 : 50, // risk score threshold
  }

  // 8. Generate recommendations
  if (xssAttempts > 10) {
    recommendations.push(`🛡️ ${xssAttempts} محاولة XSS في آخر 7 أيام — يجب تعزيز فلترة المدخلات`)
  }
  if (sqlInjection > 5) {
    recommendations.push(`🔒 ${sqlInjection} محاولة حقن SQL — تحقق من استعلامات قاعدة البيانات`)
  }
  if (vpnDetectionStats.detectionRate > 20) {
    recommendations.push(`🌐 نسبة VPN مرتفعة (${vpnDetectionStats.detectionRate.toFixed(1)}%) — فكر في تشديد إجراءات التحقق`)
  }
  if (falsePositiveRate > 30) {
    recommendations.push(`⚠️ نسبة الإيجابيات الكاذبة مرتفعة (${falsePositiveRate.toFixed(1)}%) — يجب ضبط حساسية الكشف`)
  }
  if (topAttackIPs.length > 0 && topAttackIPs[0].eventCount > 20) {
    recommendations.push(`🚫 IP ${topAttackIPs[0].ip} لديه ${topAttackIPs[0].eventCount} حدث — يُنصح بحظره`)
  }
  if (recommendations.length === 0) {
    recommendations.push('✅ الأمان العام جيد — استمر في المراقبة')
  }

  // 9. Auto-block highly suspicious IPs
  let autoBlocked = 0
  for (const ipData of topAttackIPs) {
    if (ipData.eventCount > 30) {
      try {
        await prisma.iPBlocklist.upsert({
          where: { ip: ipData.ip },
          create: {
            ip: ipData.ip,
            reason: `Auto-blocked: ${ipData.eventCount} security events in 7 days (${ipData.types.join(', ')})`,
            isAutoBlock: true,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 day block
          },
          update: {
            reason: `Auto-blocked: ${ipData.eventCount} security events in 7 days`,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        autoBlocked++
      } catch {}
    }
  }
  if (autoBlocked > 0) {
    recommendations.unshift(`🤖 تم حظر ${autoBlocked} عنوان IP تلقائياً بسبب نشاط مشبوه`)
  }

  // 10. Store training results
  try {
    await prisma.platformSetting.upsert({
      where: { key: 'security_training_stats' },
      create: { key: 'security_training_stats', value: JSON.stringify({ threatDistribution, vpnDetectionStats, falsePositiveRate, adaptedThresholds }) },
      update: { value: JSON.stringify({ threatDistribution, vpnDetectionStats, falsePositiveRate, adaptedThresholds }) },
    })
    await prisma.platformSetting.upsert({
      where: { key: 'security_last_training' },
      create: { key: 'security_last_training', value: now.toISOString() },
      update: { value: now.toISOString() },
    })
    await prisma.platformSetting.upsert({
      where: { key: 'security_adapted_thresholds' },
      create: { key: 'security_adapted_thresholds', value: JSON.stringify(adaptedThresholds) },
      update: { value: JSON.stringify(adaptedThresholds) },
    })
  } catch {}

  // 11. Log
  try {
    await prisma.platformLog.create({
      data: {
        action: 'SECURITY_TRAINING_COMPLETED',
        details: JSON.stringify({
          eventsAnalyzed: securityLogs.length,
          suspiciousActivities: suspiciousActivities.length,
          autoBlocked,
          topThreat: threatDistribution[0]?.type || 'NONE',
        }),
      },
    })
  } catch {}

  return {
    totalEvents: securityLogs.length,
    threatDistribution,
    topAttackIPs,
    attackTrends,
    vpnDetectionStats: {
      ...vpnDetectionStats,
      detectionRate: Math.round(vpnDetectionStats.detectionRate * 100) / 100,
    },
    falsePositiveRate: Math.round(falsePositiveRate * 100) / 100,
    recommendations,
    adaptedThresholds,
    trainingDate: now.toISOString(),
  }
}

// GET: View security training status
export async function GET(req: NextRequest) {
  try {
    const statsSetting = await prisma.platformSetting.findUnique({ where: { key: 'security_training_stats' } })
    const lastTrainingSetting = await prisma.platformSetting.findUnique({ where: { key: 'security_last_training' } })
    const thresholdsSetting = await prisma.platformSetting.findUnique({ where: { key: 'security_adapted_thresholds' } })

    const securityLogsCount = await prisma.securityLog.count()
    const suspiciousCount = await prisma.suspiciousActivity.count()
    const blockedIPs = await prisma.iPBlocklist.count()
    const blacklistedUsers = await prisma.blacklistEntry.count({ where: { targetType: 'USER' } })

    return NextResponse.json({
      trainingStatus: {
        lastTrainingDate: lastTrainingSetting?.value || null,
        stats: statsSetting ? JSON.parse(statsSetting.value) : null,
        adaptedThresholds: thresholdsSetting ? JSON.parse(thresholdsSetting.value) : null,
        counts: {
          securityLogs: securityLogsCount,
          suspiciousActivities: suspiciousCount,
          blockedIPs,
          blacklistedUsers,
        },
      },
    })
  } catch (error) {
    console.error('Security training GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST: Run security training
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!admin && !isCron) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const result = await trainSecurity()

    return NextResponse.json({
      message: 'تم تدريب الأمان بنجاح',
      result,
    })
  } catch (error) {
    console.error('Security training POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التدريب' }, { status: 500 })
  }
}
