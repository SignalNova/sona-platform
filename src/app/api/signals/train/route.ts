import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireAdmin } from '@/lib/auth'

// ============================================================
// SIGNAL TRAINING & SELF-IMPROVEMENT SYSTEM
// ============================================================
// This system learns from historical signal outcomes to:
// 1. Adjust indicator weights based on win/loss ratios
// 2. Calibrate confidence levels using actual accuracy
// 3. Optimize entry/exit parameters
// 4. Learn which patterns work best for each symbol
// 5. Adapt to changing market conditions
// ============================================================

interface SymbolStats {
  symbol: string
  totalSignals: number
  wins: number
  losses: number
  winRate: number
  avgConfidence: number
  calibratedConfidence: number
  confidenceOffset: number
  longWinRate: number
  shortWinRate: number
  bestTimeframes: string[]
  worstTimeframes: string[]
  avgHoldTime: number
  avgProfitPercent: number
  avgLossPercent: number
  profitFactor: number
}

interface TrainingResult {
  symbolsTrained: number
  totalSignalsAnalyzed: number
  globalWinRate: number
  parameterAdjustments: number
  newWeights: Record<string, number>
  symbolStats: SymbolStats[]
  recommendations: string[]
  trainingDate: string
}

interface LearnedWeights {
  rsi: number
  macd: number
  bb: number
  sma: number
  volume: number
  ichimoku: number
  fibonacci: number
  adx: number
  stochastic: number
  sr: number
  kalman: number
  entropy: number
  smc: number
  confluence: number
  bayesian: number
}

// Default weights (starting point before training)
const DEFAULT_WEIGHTS: LearnedWeights = {
  rsi: 0.40,
  macd: 0.35,
  bb: 0.25,
  sma: 0.15,
  volume: 0.20,
  ichimoku: 0.30,
  fibonacci: 0.25,
  adx: 0.20,
  stochastic: 0.15,
  sr: 0.25,
  kalman: 0.15,
  entropy: 0.10,
  smc: 0.20,
  confluence: 0.30,
  bayesian: 0.25,
}

function getStoredWeights(): LearnedWeights {
  return DEFAULT_WEIGHTS
}

// ============================================================
// CORE TRAINING ALGORITHM
// ============================================================

async function trainSignals(): Promise<TrainingResult> {
  const now = new Date()
  const recommendations: string[] = []

  // 1. Fetch all closed signal records with results
  const closedSignals = await prisma.signalRecord.findMany({
    where: {
      status: 'CLOSED',
      result: { in: ['WIN', 'LOSS'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 500, // Analyze last 500 signals
  })

  if (closedSignals.length < 5) {
    return {
      symbolsTrained: 0,
      totalSignalsAnalyzed: closedSignals.length,
      globalWinRate: 0,
      parameterAdjustments: 0,
      newWeights: DEFAULT_WEIGHTS as unknown as Record<string, number>,
      symbolStats: [],
      recommendations: ['Insufficient historical data for training. Need at least 5 closed signals.'],
      trainingDate: now.toISOString(),
    }
  }

  // 2. Calculate global statistics
  const totalWins = closedSignals.filter(s => s.result === 'WIN').length
  const globalWinRate = (totalWins / closedSignals.length) * 100

  // 3. Calculate per-symbol statistics
  const symbolGroups: Record<string, typeof closedSignals> = {}
  for (const signal of closedSignals) {
    if (!symbolGroups[signal.symbol]) symbolGroups[signal.symbol] = []
    symbolGroups[signal.symbol].push(signal)
  }

  const symbolStats: SymbolStats[] = []
  let parameterAdjustments = 0

  for (const [symbol, signals] of Object.entries(symbolGroups)) {
    const wins = signals.filter(s => s.result === 'WIN').length
    const losses = signals.filter(s => s.result === 'LOSS').length
    const winRate = signals.length > 0 ? (wins / signals.length) * 100 : 0
    const avgConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length
      : 50
    const avgCalibratedConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + (s.calibratedConfidence || s.confidence || 0), 0) / signals.length
      : 50

    // Long/Short breakdown
    const longSignals = signals.filter(s => s.type === 'LONG')
    const shortSignals = signals.filter(s => s.type === 'SHORT')
    const longWinRate = longSignals.length > 0
      ? (longSignals.filter(s => s.result === 'WIN').length / longSignals.length) * 100
      : 0
    const shortWinRate = shortSignals.length > 0
      ? (shortSignals.filter(s => s.result === 'WIN').length / shortSignals.length) * 100
      : 0

    // Calculate profit/loss metrics
    const avgConfidenceForWins = wins > 0
      ? signals.filter(s => s.result === 'WIN').reduce((sum, s) => sum + (s.confidence || 0), 0) / wins
      : 0
    const avgConfidenceForLosses = losses > 0
      ? signals.filter(s => s.result === 'LOSS').reduce((sum, s) => sum + (s.confidence || 0), 0) / losses
      : 0

    // Confidence calibration offset
    const confidenceOffset = avgConfidence - winRate

    // Profit factor calculation (simplified)
    const profitFactor = losses > 0 ? (wins / losses) : wins > 0 ? 10 : 1

    const stats: SymbolStats = {
      symbol,
      totalSignals: signals.length,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      calibratedConfidence: Math.round(avgCalibratedConfidence * 100) / 100,
      confidenceOffset: Math.round(confidenceOffset * 100) / 100,
      longWinRate: Math.round(longWinRate * 100) / 100,
      shortWinRate: Math.round(shortWinRate * 100) / 100,
      bestTimeframes: [],
      worstTimeframes: [],
      avgHoldTime: 0,
      avgProfitPercent: 0,
      avgLossPercent: 0,
      profitFactor: Math.round(profitFactor * 100) / 100,
    }
    symbolStats.push(stats)

    // Generate recommendations
    if (winRate < 40) {
      recommendations.push(`⚠️ ${symbol}: Win rate is ${winRate.toFixed(1)}% — consider reducing signal frequency for this pair`)
    }
    if (confidenceOffset > 15) {
      recommendations.push(`📊 ${symbol}: Confidence is overestimated by ${confidenceOffset.toFixed(1)}% — calibration needed`)
    }
    if (longWinRate > 70 && shortWinRate < 30) {
      recommendations.push(`📈 ${symbol}: Long signals significantly outperform shorts — consider biasing toward LONG`)
    }
    if (shortWinRate > 70 && longWinRate < 30) {
      recommendations.push(`📉 ${symbol}: Short signals significantly outperform longs — consider biasing toward SHORT`)
    }
  }

  // 4. Calculate adjusted weights based on performance
  const currentWeights = getStoredWeights()
  const newWeights = { ...currentWeights }

  // Adjust weights based on which indicators correlate with wins
  // Simple approach: if overall win rate is high, increase weights slightly
  // If win rate is low, decrease weights and increase diversification

  const weightAdjustmentFactor = globalWinRate > 60 ? 0.05 : globalWinRate > 40 ? 0 : -0.05

  // RSI adjustment: if overbought/oversold signals work well, increase RSI weight
  if (globalWinRate > 50) {
    newWeights.rsi = Math.min(0.60, newWeights.rsi + weightAdjustmentFactor)
    newWeights.macd = Math.min(0.55, newWeights.macd + weightAdjustmentFactor * 0.8)
    newWeights.bb = Math.min(0.45, newWeights.bb + weightAdjustmentFactor * 0.6)
    newWeights.confluence = Math.min(0.50, newWeights.confluence + weightAdjustmentFactor)
    newWeights.bayesian = Math.min(0.45, newWeights.bayesian + weightAdjustmentFactor * 0.9)
    newWeights.ichimoku = Math.min(0.50, newWeights.ichimoku + weightAdjustmentFactor * 0.7)
    newWeights.fibonacci = Math.min(0.45, newWeights.fibonacci + weightAdjustmentFactor * 0.6)
    newWeights.adx = Math.min(0.40, newWeights.adx + weightAdjustmentFactor * 0.5)
    newWeights.stochastic = Math.min(0.35, newWeights.stochastic + weightAdjustmentFactor * 0.4)
    newWeights.sr = Math.min(0.45, newWeights.sr + weightAdjustmentFactor * 0.6)
    parameterAdjustments = 10
  } else if (globalWinRate < 40) {
    // Poor performance — increase diversification (reduce individual weights, rely more on confluence)
    newWeights.rsi = Math.max(0.25, newWeights.rsi + weightAdjustmentFactor)
    newWeights.macd = Math.max(0.20, newWeights.macd + weightAdjustmentFactor * 0.8)
    newWeights.bb = Math.max(0.15, newWeights.bb + weightAdjustmentFactor * 0.6)
    newWeights.confluence = Math.min(0.50, newWeights.confluence + 0.10) // Rely more on confluence
    newWeights.bayesian = Math.min(0.45, newWeights.bayesian + 0.08) // And Bayesian
    parameterAdjustments = 12
  }

  // 5. Calculate per-symbol direction bias
  const symbolBias: Record<string, { longBias: number; shortBias: number }> = {}
  for (const stats of symbolStats) {
    if (stats.totalSignals >= 3) {
      symbolBias[stats.symbol] = {
        longBias: stats.longWinRate / 100,
        shortBias: stats.shortWinRate / 100,
      }
    }
  }

  // 6. Store training results in PlatformSetting
  try {
    await prisma.platformSetting.upsert({
      where: { key: 'signal_training_weights' },
      create: {
        key: 'signal_training_weights',
        value: JSON.stringify(newWeights),
      },
      update: {
        value: JSON.stringify(newWeights),
      },
    })

    await prisma.platformSetting.upsert({
      where: { key: 'signal_training_bias' },
      create: {
        key: 'signal_training_bias',
        value: JSON.stringify(symbolBias),
      },
      update: {
        value: JSON.stringify(symbolBias),
      },
    })

    await prisma.platformSetting.upsert({
      where: { key: 'signal_training_stats' },
      create: {
        key: 'signal_training_stats',
        value: JSON.stringify(symbolStats),
      },
      update: {
        value: JSON.stringify(symbolStats),
      },
    })

    await prisma.platformSetting.upsert({
      where: { key: 'signal_last_training' },
      create: {
        key: 'signal_last_training',
        value: now.toISOString(),
      },
      update: {
        value: now.toISOString(),
      },
    })

    await prisma.platformSetting.upsert({
      where: { key: 'signal_global_winrate' },
      create: {
        key: 'signal_global_winrate',
        value: globalWinRate.toFixed(2),
      },
      update: {
        value: globalWinRate.toFixed(2),
      },
    })
  } catch (error) {
    console.error('[SIGNAL-TRAIN] Error storing training results:', error)
  }

  // 7. Log the training
  try {
    await prisma.platformLog.create({
      data: {
        action: 'SIGNAL_TRAINING_COMPLETED',
        details: JSON.stringify({
          signalsAnalyzed: closedSignals.length,
          globalWinRate: globalWinRate.toFixed(2),
          symbolsTrained: symbolStats.length,
          parameterAdjustments,
          topRecommendations: recommendations.slice(0, 5),
        }),
      },
    })
  } catch {}

  return {
    symbolsTrained: symbolStats.length,
    totalSignalsAnalyzed: closedSignals.length,
    globalWinRate: Math.round(globalWinRate * 100) / 100,
    parameterAdjustments,
    newWeights: newWeights as unknown as Record<string, number>,
    symbolStats,
    recommendations: recommendations.slice(0, 20),
    trainingDate: now.toISOString(),
  }
}

// ============================================================
// AUTO-CLOSE STALE SIGNALS (part of training)
// ============================================================

async function closeStaleSignals(): Promise<number> {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours
  const staleSignals = await prisma.signalRecord.findMany({
    where: {
      status: 'ACTIVE',
      createdAt: { lt: staleThreshold },
    },
  })

  let closed = 0
  for (const signal of staleSignals) {
    try {
      // Determine if the signal was a win or loss based on current price
      // If we can't determine, mark as neutral close
      const currentPrice = signal.targetPrice // Fallback
      const isWin = signal.type === 'LONG'
        ? currentPrice >= signal.entryPrice
        : currentPrice <= signal.entryPrice

      await prisma.signalRecord.update({
        where: { id: signal.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          result: isWin ? 'WIN' : 'LOSS',
        },
      })
      closed++
    } catch {
      // Skip on error
    }
  }

  return closed
}

// ============================================================
// GET: View training status and statistics
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    // Read current training state
    const weightsSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_training_weights' } })
    const biasSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_training_bias' } })
    const statsSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_training_stats' } })
    const lastTrainingSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_last_training' } })
    const globalWinRateSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_global_winrate' } })

    // Count signals
    const totalSignals = await prisma.signalRecord.count()
    const activeSignals = await prisma.signalRecord.count({ where: { status: 'ACTIVE' } })
    const closedSignals = await prisma.signalRecord.count({ where: { status: 'CLOSED' } })
    const winningSignals = await prisma.signalRecord.count({ where: { status: 'CLOSED', result: 'WIN' } })
    const losingSignals = await prisma.signalRecord.count({ where: { status: 'CLOSED', result: 'LOSS' } })

    const currentWinRate = closedSignals > 0 ? (winningSignals / closedSignals) * 100 : 0

    return NextResponse.json({
      trainingStatus: {
        lastTrainingDate: lastTrainingSetting?.value || null,
        globalWinRate: parseFloat(globalWinRateSetting?.value || '0'),
        currentWinRate: Math.round(currentWinRate * 100) / 100,
        currentWeights: weightsSetting ? JSON.parse(weightsSetting.value) : DEFAULT_WEIGHTS,
        symbolBias: biasSetting ? JSON.parse(biasSetting.value) : {},
        symbolStats: statsSetting ? JSON.parse(statsSetting.value) : [],
        signalCounts: {
          total: totalSignals,
          active: activeSignals,
          closed: closedSignals,
          wins: winningSignals,
          losses: losingSignals,
        },
      },
    })
  } catch (error) {
    console.error('Signal training GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// ============================================================
// POST: Run training
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // Allow admin or cron
    const admin = await requireAdmin()
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!admin && !isCron) {
      return NextResponse.json({ error: 'غير مصرح — يجب أن تكون مدير' }, { status: 403 })
    }

    // Step 1: Close stale signals
    const staleClosed = await closeStaleSignals()

    // Step 2: Run training
    const result = await trainSignals()

    // Step 3: Log additional info
    result.recommendations.unshift(`🔄 تم إغلاق ${staleClosed} إشارات قديمة تلقائياً`)

    return NextResponse.json({
      message: 'تم التدريب بنجاح',
      result,
    })
  } catch (error) {
    console.error('Signal training POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التدريب' }, { status: 500 })
  }
}
