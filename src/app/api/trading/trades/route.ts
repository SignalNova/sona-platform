import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET: Get trades for a specific session
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
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    const trades = await db.botTrade.findMany({
      where: { sessionId },
      orderBy: { openedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ trades, session })
  } catch (error) {
    console.error('Trading trades GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Generate simulated bot trades OR execute user-initiated order
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const body = await request.json()
    const { sessionId, forceType, forceAmount, forcePrice } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
    }

    const session = await db.tradingSession.findFirst({
      where: { id: sessionId, userId, status: 'ACTIVE' },
      include: { investment: { include: { package: true } } },
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة أو غير نشطة' }, { status: 404 })
    }

    // Check if investment is still active
    if (session.investment.status !== 'ACTIVE') {
      await db.tradingSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      })
      return NextResponse.json({ error: 'الاستثمار لم يعد نشطاً' }, { status: 400 })
    }

    // ===== USER-INITIATED ORDER =====
    if (forceType && forceAmount) {
      const entryPrice = forcePrice || session.currentPrice
      const amount = Math.min(Number(forceAmount), session.investment.amount)

      if (amount <= 0) {
        return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
      }

      // Simulate a realistic trade outcome
      const volatility = 0.001 + Math.random() * 0.004
      const direction = forceType === 'BUY' ? 1 : -1
      const priceChange = entryPrice * volatility * direction * (Math.random() > 0.3 ? 1 : -1)
      const exitPrice = entryPrice + priceChange
      const profitLoss = priceChange * (amount / entryPrice) * 0.01
      const confidence = 75 + Math.random() * 20

      const trade = await db.botTrade.create({
        data: {
          sessionId,
          type: forceType,
          symbol: session.symbol,
          entryPrice: Number(entryPrice.toFixed(2)),
          exitPrice: Number(exitPrice.toFixed(2)),
          amount: Number(amount.toFixed(2)),
          profitLoss: Number(profitLoss.toFixed(4)),
          status: 'CLOSED',
          confidence: Number(confidence.toFixed(1)),
          openedAt: new Date(Date.now() - Math.random() * 30000),
          closedAt: new Date(),
        },
      })

      // Update session stats
      const wins = trade.profitLoss > 0 ? 1 : 0
      const losses = trade.profitLoss <= 0 ? 1 : 0

      await db.tradingSession.update({
        where: { id: sessionId },
        data: {
          currentPrice: trade.exitPrice ?? session.currentPrice,
          totalProfit: { increment: trade.profitLoss },
          totalTrades: { increment: 1 },
          winTrades: { increment: wins },
          lossTrades: { increment: losses },
        },
      })

      return NextResponse.json({ trades: [trade], totalProfitLoss: trade.profitLoss, userInitiated: true })
    }

    // ===== AUTO BOT TRADES =====
    const tradeCount = Math.floor(Math.random() * 3) + 1
    const newTrades = []

    for (let i = 0; i < tradeCount; i++) {
      const isBuy = Math.random() > 0.45
      const volatility = 0.001 + Math.random() * 0.003
      const priceChange = session.currentPrice * volatility * (Math.random() > 0.35 ? 1 : -1)
      const entryPrice = session.currentPrice + (Math.random() - 0.5) * session.currentPrice * 0.001
      const exitPrice = entryPrice + priceChange
      const profitLoss = priceChange * (session.investment.amount / session.currentPrice) * 0.01
      const confidence = 70 + Math.random() * 25

      const trade = await db.botTrade.create({
        data: {
          sessionId,
          type: isBuy ? 'BUY' : 'SELL',
          symbol: session.symbol,
          entryPrice: Number(entryPrice.toFixed(2)),
          exitPrice: Number(exitPrice.toFixed(2)),
          amount: Number((session.investment.amount * 0.1 * (0.5 + Math.random())).toFixed(2)),
          profitLoss: Number(profitLoss.toFixed(4)),
          status: 'CLOSED',
          confidence: Number(confidence.toFixed(1)),
          openedAt: new Date(Date.now() - Math.random() * 60000),
          closedAt: new Date(),
        },
      })

      newTrades.push(trade)
    }

    // Update session stats
    const totalProfitLoss = newTrades.reduce((sum, t) => sum + t.profitLoss, 0)
    const wins = newTrades.filter(t => t.profitLoss > 0).length
    const losses = newTrades.filter(t => t.profitLoss <= 0).length
    const lastPrice = newTrades[newTrades.length - 1]?.exitPrice || session.currentPrice

    await db.tradingSession.update({
      where: { id: sessionId },
      data: {
        currentPrice: lastPrice,
        totalProfit: { increment: totalProfitLoss },
        totalTrades: { increment: tradeCount },
        winTrades: { increment: wins },
        lossTrades: { increment: losses },
      },
    })

    return NextResponse.json({ trades: newTrades, totalProfitLoss })
  } catch (error) {
    console.error('Trading trades POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
