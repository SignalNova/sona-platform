import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
// Engine imports done dynamically below

// GET: Get chart data for a trading session (simulated candlestick data)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
    }

    const session = await db.tradingSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        trades: { orderBy: { openedAt: 'desc' }, take: 200 },
        investment: { include: { package: true } },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    // Generate simulated candlestick data based on session
    let candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> = []
    const trades = session.trades.reverse()
    let basePrice = session.startPrice
    const now = new Date()

    // Generate 60 candles (1 hour of 1-minute candles)
    for (let i = 59; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000)
      const volatility = 0.0005 + Math.random() * 0.002
      const change = basePrice * volatility * (Math.random() > 0.4 ? 1 : -1)
      const open = basePrice
      const close = open + change
      const high = Math.max(open, close) + Math.abs(change) * Math.random()
      const low = Math.min(open, close) - Math.abs(change) * Math.random()

      candles.push({
        time: time.toISOString(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Number((100 + Math.random() * 500).toFixed(0)),
      })

      basePrice = close
    }

    // Apply market mover manipulation if enabled
    try {
      const { marketMover: mm } = await import('@/server/engine/market-mover')
      if (mm.getStatus().config.enabled) {
        // Calculate volume imbalance from recent transactions
        const buyVolume = await db.transaction.aggregate({
          where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          _sum: { amount: true }
        })
        const sellVolume = await db.transaction.aggregate({
          where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          _sum: { amount: true }
        })

        mm.calculateVolumeImbalance(buyVolume._sum.amount || 0, sellVolume._sum.amount || 0)
        candles = mm.processCandles(candles)
      }
    } catch (engineError) {
      // If engine import fails (e.g., in dev), just use raw candles
      console.log('[CHART] Market mover engine not available, using raw data')
    }

    // Get spoof orders from liquidity locker if enabled
    let spoofOrders: any[] = []
    try {
      const { liquidityLocker } = await import('@/server/engine/liquidity-locker')
      if (liquidityLocker.getStatus().config.enabled) {
        spoofOrders = liquidityLocker.generateSpoofOrders(basePrice, session.symbol)
      }
    } catch (e) {
      // Engine not available
    }

    // Map bot trades to chart points
    const tradePoints = trades.map(t => ({
      time: t.openedAt.toISOString(),
      type: t.type,
      price: t.entryPrice,
      profitLoss: t.profitLoss,
      confidence: t.confidence,
    }))

    return NextResponse.json({
      candles,
      tradePoints,
      spoofOrders,
      session: {
        id: session.id,
        symbol: session.symbol,
        startPrice: session.startPrice,
        currentPrice: session.currentPrice || basePrice,
        totalProfit: session.totalProfit,
        totalTrades: session.totalTrades,
        winTrades: session.winTrades,
        lossTrades: session.lossTrades,
        investment: {
          amount: session.investment.amount,
          package: session.investment.package,
          status: session.investment.status,
          startDate: session.investment.startDate,
        },
      },
    })
  } catch (error) {
    console.error('Chart data error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
