import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// ============================================================
// DAILY TRAINING & SELF-IMPROVEMENT CRON JOB
// ============================================================
// This runs daily (via cron or admin trigger) to:
// 1. Train signals system — learn from outcomes
// 2. Train support system — learn from conversations
// 3. Train security system — learn from threats
// 4. Auto-close stale signals
// 5. Generate training report
// 6. Update all adapted parameters
// ============================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const results: Record<string, any> = {
    trainingDate: new Date().toISOString(),
    systems: {},
  }

  try {
    // Verify authorization
    const admin = await requireAdmin()
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!admin && !isCron) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    console.log('[TRAIN] Starting daily training job...')

    // =====================================================
    // 1. SIGNAL TRAINING
    // =====================================================
    try {
      console.log('[TRAIN] Training signals system...')
      const signalTrainRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/signals/train`, {
        method: 'POST',
        headers: { 'Authorization': authHeader || '' },
      })
      if (signalTrainRes.ok) {
        const signalData = await signalTrainRes.json()
        results.systems.signals = {
          status: 'SUCCESS',
          symbolsTrained: signalData.result?.symbolsTrained || 0,
          signalsAnalyzed: signalData.result?.totalSignalsAnalyzed || 0,
          globalWinRate: signalData.result?.globalWinRate || 0,
          parameterAdjustments: signalData.result?.parameterAdjustments || 0,
          recommendations: signalData.result?.recommendations?.slice(0, 3) || [],
        }
      } else {
        results.systems.signals = { status: 'FAILED', error: 'Signal training request failed' }
      }
    } catch (error: any) {
      results.systems.signals = { status: 'FAILED', error: error.message }
    }

    // =====================================================
    // 2. SUPPORT TRAINING
    // =====================================================
    try {
      console.log('[TRAIN] Training support system...')
      const supportTrainRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/support/train`, {
        method: 'POST',
        headers: { 'Authorization': authHeader || '' },
      })
      if (supportTrainRes.ok) {
        const supportData = await supportTrainRes.json()
        results.systems.support = {
          status: 'SUCCESS',
          conversationsAnalyzed: supportData.result?.totalConversations || 0,
          avgRating: supportData.result?.avgRating || 0,
          resolutionRate: supportData.result?.resolutionRate || 0,
          recommendations: supportData.result?.recommendations?.slice(0, 3) || [],
        }
      } else {
        results.systems.support = { status: 'FAILED', error: 'Support training request failed' }
      }
    } catch (error: any) {
      results.systems.support = { status: 'FAILED', error: error.message }
    }

    // =====================================================
    // 3. SECURITY TRAINING
    // =====================================================
    try {
      console.log('[TRAIN] Training security system...')
      const securityTrainRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/security/train`, {
        method: 'POST',
        headers: { 'Authorization': authHeader || '' },
      })
      if (securityTrainRes.ok) {
        const securityData = await securityTrainRes.json()
        results.systems.security = {
          status: 'SUCCESS',
          eventsAnalyzed: securityData.result?.totalEvents || 0,
          autoBlockedIPs: securityData.result?.topAttackIPs?.length || 0,
          falsePositiveRate: securityData.result?.falsePositiveRate || 0,
          recommendations: securityData.result?.recommendations?.slice(0, 3) || [],
        }
      } else {
        results.systems.security = { status: 'FAILED', error: 'Security training request failed' }
      }
    } catch (error: any) {
      results.systems.security = { status: 'FAILED', error: error.message }
    }

    // =====================================================
    // 4. STORE TRAINING METRICS
    // =====================================================
    try {
      const duration = Date.now() - startTime

      // Store overall training result
      await prisma.platformSetting.upsert({
        where: { key: 'last_full_training' },
        create: {
          key: 'last_full_training',
          value: JSON.stringify({
            ...results,
            duration: `${(duration / 1000).toFixed(1)}s`,
          }),
        },
        update: {
          value: JSON.stringify({
            ...results,
            duration: `${(duration / 1000).toFixed(1)}s`,
          }),
        },
      })

      // Update training counter
      const counterSetting = await prisma.platformSetting.findUnique({ where: { key: 'training_run_count' } })
      const runCount = counterSetting ? parseInt(counterSetting.value) + 1 : 1
      await prisma.platformSetting.upsert({
        where: { key: 'training_run_count' },
        create: { key: 'training_run_count', value: String(runCount) },
        update: { value: String(runCount) },
      })

      // Log
      await prisma.platformLog.create({
        data: {
          action: 'FULL_TRAINING_COMPLETED',
          details: JSON.stringify({
            duration: `${(duration / 1000).toFixed(1)}s`,
            signals: results.systems.signals?.status,
            support: results.systems.support?.status,
            security: results.systems.security?.status,
            runCount,
          }),
        },
      })
    } catch (error) {
      console.error('[TRAIN] Error storing training metrics:', error)
    }

    results.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    console.log(`[TRAIN] Daily training completed in ${results.duration}`)

    return NextResponse.json({
      message: 'تم التدريب الشامل بنجاح',
      results,
    })
  } catch (error: any) {
    console.error('[TRAIN] Fatal error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التدريب', details: error.message },
      { status: 500 }
    )
  }
}

// GET: View training status
export async function GET(req: NextRequest) {
  try {
    const lastTraining = await prisma.platformSetting.findUnique({ where: { key: 'last_full_training' } })
    const runCount = await prisma.platformSetting.findUnique({ where: { key: 'training_run_count' } })
    const signalLastTrain = await prisma.platformSetting.findUnique({ where: { key: 'signal_last_training' } })
    const supportLastTrain = await prisma.platformSetting.findUnique({ where: { key: 'support_last_training' } })
    const securityLastTrain = await prisma.platformSetting.findUnique({ where: { key: 'security_last_training' } })
    const globalWinRate = await prisma.platformSetting.findUnique({ where: { key: 'signal_global_winrate' } })

    return NextResponse.json({
      trainingOverview: {
        totalRuns: parseInt(runCount?.value || '0'),
        lastFullTraining: lastTraining ? JSON.parse(lastTraining.value) : null,
        systemStatus: {
          signals: { lastTraining: signalLastTrain?.value || null, globalWinRate: globalWinRate?.value || null },
          support: { lastTraining: supportLastTrain?.value || null },
          security: { lastTraining: securityLastTrain?.value || null },
        },
      },
    })
  } catch (error) {
    console.error('Training GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
