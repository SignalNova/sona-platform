import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getAuthUser } from '@/lib/auth'

// ============================================================
// SUPPORT TRAINING & SELF-IMPROVEMENT SYSTEM
// ============================================================
// This system learns from support conversations to:
// 1. Track resolution rates per level
// 2. Identify common issues and optimize responses
// 3. Improve escalation triggers
// 4. Track satisfaction ratings
// 5. Learn optimal response patterns
// ============================================================

interface SupportTrainingResult {
  totalConversations: number
  avgRating: number
  resolutionRate: number
  levelStats: {
    level: number
    conversations: number
    avgRating: number
    avgResponseTime: number
    escalationRate: number
    resolutionRate: number
  }[]
  topCategories: { category: string; count: number; avgRating: number; resolutionRate: number }[]
  commonIssues: { keyword: string; count: number; avgResolutionTime: number }[]
  recommendations: string[]
  trainingDate: string
}

async function trainSupport(): Promise<SupportTrainingResult> {
  const now = new Date()
  const recommendations: string[] = []

  // 1. Fetch all conversations
  const conversations = await prisma.chatConversation.findMany({
    include: { messages: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  if (conversations.length === 0) {
    return {
      totalConversations: 0,
      avgRating: 0,
      resolutionRate: 0,
      levelStats: [],
      topCategories: [],
      commonIssues: [],
      recommendations: ['لا توجد محادثات كافية للتدريب'],
      trainingDate: now.toISOString(),
    }
  }

  // 2. Calculate global metrics
  const ratedConversations = conversations.filter(c => c.rating !== null)
  const avgRating = ratedConversations.length > 0
    ? ratedConversations.reduce((sum, c) => sum + (c.rating || 0), 0) / ratedConversations.length
    : 0

  const resolvedConversations = conversations.filter(c => c.status === 'CLOSED' || c.resolvedAt !== null)
  const resolutionRate = (resolvedConversations.length / conversations.length) * 100

  // 3. Per-level statistics
  const levelGroups: Record<number, typeof conversations> = { 1: [], 2: [], 3: [] }
  for (const conv of conversations) {
    const level = conv.supportLevel || 1
    if (!levelGroups[level]) levelGroups[level] = []
    levelGroups[level].push(conv)
  }

  const levelStats = Object.entries(levelGroups).map(([level, convs]) => {
    const rated = convs.filter(c => c.rating !== null)
    const resolved = convs.filter(c => c.status === 'CLOSED' || c.resolvedAt !== null)

    // Average response time (time from first user message to first agent message)
    let totalResponseTime = 0
    let responseCount = 0
    for (const conv of convs) {
      const userMsgs = conv.messages.filter(m => m.senderType === 'USER')
      const agentMsgs = conv.messages.filter(m => m.senderType !== 'USER')
      if (userMsgs.length > 0 && agentMsgs.length > 0) {
        const firstUser = new Date(userMsgs[0].createdAt).getTime()
        const firstAgent = new Date(agentMsgs[0].createdAt).getTime()
        const responseTime = (firstAgent - firstUser) / 1000 // seconds
        if (responseTime > 0 && responseTime < 3600) {
          totalResponseTime += responseTime
          responseCount++
        }
      }
    }
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0

    // Escalation rate (how many conversations escalated from this level)
    const escalated = convs.filter(c => {
      if (!c.messages) return false
      return c.messages.some(m => {
        try {
          const meta = JSON.parse(m.metadata || '{}')
          return meta.escalation || meta.handoff
        } catch { return false }
      })
    }).length
    const escalationRate = convs.length > 0 ? (escalated / convs.length) * 100 : 0

    const levelRating = rated.length > 0
      ? rated.reduce((sum, c) => sum + (c.rating || 0), 0) / rated.length
      : 0
    const levelResolution = convs.length > 0 ? (resolved.length / convs.length) * 100 : 0

    return {
      level: parseInt(level),
      conversations: convs.length,
      avgRating: Math.round(levelRating * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      escalationRate: Math.round(escalationRate * 100) / 100,
      resolutionRate: Math.round(levelResolution * 100) / 100,
    }
  })

  // 4. Category analysis
  const categoryGroups: Record<string, typeof conversations> = {}
  for (const conv of conversations) {
    const cat = conv.category || 'general'
    if (!categoryGroups[cat]) categoryGroups[cat] = []
    categoryGroups[cat].push(conv)
  }

  const topCategories = Object.entries(categoryGroups).map(([category, convs]) => {
    const rated = convs.filter(c => c.rating !== null)
    const resolved = convs.filter(c => c.status === 'CLOSED' || c.resolvedAt !== null)
    return {
      category,
      count: convs.length,
      avgRating: rated.length > 0
        ? Math.round((rated.reduce((s, c) => s + (c.rating || 0), 0) / rated.length) * 100) / 100
        : 0,
      resolutionRate: convs.length > 0 ? Math.round((resolved.length / convs.length) * 10000) / 100 : 0,
    }
  }).sort((a, b) => b.count - a.count).slice(0, 10)

  // 5. Common issues detection
  const issueKeywords: Record<string, number> = {}
  const issueResolutionTimes: Record<string, number[]> = {}
  for (const conv of conversations) {
    const userMsgs = conv.messages.filter(m => m.senderType === 'USER')
    for (const msg of userMsgs) {
      const text = msg.message.toLowerCase()
      const keywords = ['ايداع', 'سحب', 'ربح', 'استثمار', 'باقه', 'حساب', 'مخترق', 'kyc', 'رصيد', 'سحب معلق', 'ايداع معلق']
      for (const kw of keywords) {
        if (text.includes(kw)) {
          issueKeywords[kw] = (issueKeywords[kw] || 0) + 1
          if (conv.resolvedAt) {
            const resolutionTime = (conv.resolvedAt.getTime() - conv.createdAt.getTime()) / 60000 // minutes
            if (!issueResolutionTimes[kw]) issueResolutionTimes[kw] = []
            issueResolutionTimes[kw].push(resolutionTime)
          }
        }
      }
    }
  }

  const commonIssues = Object.entries(issueKeywords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([keyword, count]) => ({
      keyword,
      count,
      avgResolutionTime: issueResolutionTimes[keyword]
        ? Math.round(issueResolutionTimes[keyword].reduce((a, b) => a + b, 0) / issueResolutionTimes[keyword].length)
        : 0,
    }))

  // 6. Generate recommendations
  if (avgRating < 3) {
    recommendations.push('⭐ متوسط التقييم منخفض — يجب تحسين جودة الردود وإضافة المزيد من التعاطف')
  }
  if (resolutionRate < 70) {
    recommendations.push('🔧 نسبة الحل منخفضة — يجب تحسين قدرة المستوى الأول على حل المشاكل')
  }
  const l1 = levelStats.find(l => l.level === 1)
  if (l1 && l1.escalationRate > 50) {
    recommendations.push('📈 نسبة التصعيد من المستوى 1 عالية جداً — يجب تحسين قدرات المستوى الأول')
  }
  const l2 = levelStats.find(l => l.level === 2)
  if (l2 && l2.avgRating < 3.5) {
    recommendations.push('📊 تقييم المستوى 2 منخفض — يحتاج تحسين في جودة الردود وسرعة الاستجابة')
  }
  for (const cat of topCategories) {
    if (cat.resolutionRate < 50 && cat.count >= 3) {
      recommendations.push(`📋 فئة "${cat.category}" لديها نسبة حل منخفضة (${cat.resolutionRate}%) — تحتاج اهتمام خاص`)
    }
  }
  if (recommendations.length === 0) {
    recommendations.push('✅ الأداء العام جيد — استمر في المراقبة والتحسين المستمر')
  }

  // 7. Store training results
  try {
    await prisma.platformSetting.upsert({
      where: { key: 'support_training_stats' },
      create: { key: 'support_training_stats', value: JSON.stringify({ avgRating, resolutionRate, levelStats, topCategories, commonIssues }) },
      update: { value: JSON.stringify({ avgRating, resolutionRate, levelStats, topCategories, commonIssues }) },
    })
    await prisma.platformSetting.upsert({
      where: { key: 'support_last_training' },
      create: { key: 'support_last_training', value: now.toISOString() },
      update: { value: now.toISOString() },
    })
  } catch (err) {
    console.error('[SUPPORT-TRAIN] Failed to store training stats:', err)
  }

  // 8. Log
  try {
    await prisma.platformLog.create({
      data: {
        action: 'SUPPORT_TRAINING_COMPLETED',
        details: JSON.stringify({
          conversationsAnalyzed: conversations.length,
          avgRating: avgRating.toFixed(2),
          resolutionRate: resolutionRate.toFixed(2),
        }),
      },
    })
  } catch (err) {
    console.error('[SUPPORT-TRAIN] Failed to log training completion:', err)
  }

  return {
    totalConversations: conversations.length,
    avgRating: Math.round(avgRating * 100) / 100,
    resolutionRate: Math.round(resolutionRate * 100) / 100,
    levelStats,
    topCategories,
    commonIssues,
    recommendations,
    trainingDate: now.toISOString(),
  }
}

// GET: View training status
export async function GET(req: NextRequest) {
  try {
    const statsSetting = await prisma.platformSetting.findUnique({ where: { key: 'support_training_stats' } })
    const lastTrainingSetting = await prisma.platformSetting.findUnique({ where: { key: 'support_last_training' } })

    const totalConversations = await prisma.chatConversation.count()
    const openConversations = await prisma.chatConversation.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })
    const ratedConversations = await prisma.chatConversation.count({ where: { rating: { not: null } } })

    return NextResponse.json({
      trainingStatus: {
        lastTrainingDate: lastTrainingSetting?.value || null,
        stats: statsSetting ? JSON.parse(statsSetting.value) : null,
        conversationCounts: {
          total: totalConversations,
          open: openConversations,
          rated: ratedConversations,
        },
      },
    })
  } catch (error) {
    console.error('Support training GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST: Run training
export async function POST(req: NextRequest) {
  try {
    // Check admin auth via cookie (requireAdmin) or Bearer token (getAuthUser)
    let admin = await requireAdmin()
    if (!admin) {
      const authUser = await getAuthUser(req)
      if (authUser && String(authUser.role).toLowerCase() === 'admin') {
        admin = authUser
      }
    }

    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!admin && !isCron) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const result = await trainSupport()

    return NextResponse.json({
      message: 'تم تدريب الدعم بنجاح',
      result,
    })
  } catch (error) {
    console.error('Support training POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التدريب' }, { status: 500 })
  }
}
