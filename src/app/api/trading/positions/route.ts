import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET: Get open positions for the user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const sessions = await db.tradingSession.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        trades: {
          where: { status: 'OPEN' },
          orderBy: { openedAt: 'desc' },
        },
        investment: { include: { package: true } },
      },
    })

    // Flatten all open trades from all active sessions
    const openPositions = sessions.flatMap(s =>
      s.trades.map(t => ({
        ...t,
        sessionSymbol: s.symbol,
        investmentAmount: s.investment.amount,
      }))
    )

    // Also get recently closed manual trades (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const closedPositions = await db.botTrade.findMany({
      where: {
        session: { userId },
        status: 'CLOSED',
        isManual: true,
        closedAt: { gte: yesterday },
      },
      orderBy: { closedAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ openPositions, closedPositions })
  } catch (error) {
    console.error('Positions GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Open a new manual position with optional SL/TP
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const body = await request.json()
    const { symbol, type, amount, stopLoss, takeProfit, takeProfit2, takeProfit3, leverage: rawLeverage, marginType: rawMarginType } = body

    // Validate
    if (!type || !['BUY', 'SELL'].includes(type)) {
      return NextResponse.json({ error: 'نوع الصفقة غير صالح' }, { status: 400 })
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
    }
    if (!symbol) {
      return NextResponse.json({ error: 'رمز التداول مطلوب' }, { status: 400 })
    }

    // Validate leverage (1-125)
    const leverage = Math.min(125, Math.max(1, Math.floor(Number(rawLeverage) || 1)))
    const marginType = rawMarginType === 'isolated' ? 'isolated' : 'cross'

    const tradeAmount = Number(amount)
    // Only deduct the margin required (tradeAmount / leverage) from user balance
    const requiredMargin = tradeAmount / leverage

    // Check user balance against the required margin, not the full amount
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || user.balance < requiredMargin) {
      return NextResponse.json({ error: 'رصيدك غير كافي لفتح هذه الصفقة' }, { status: 400 })
    }

    // SECURITY: Check if user is frozen or can perform financial actions
    if (user.isFrozen) {
      return NextResponse.json({ error: 'حسابك مجمد مؤقتاً. لا يمكنك فتح صفقات جديدة.' }, { status: 403 })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'حسابك غير نشط. يرجى التواصل مع الدعم.' }, { status: 403 })
    }

    // SECURITY FORTRESS: Check if user can perform financial actions
    try {
      const { canPerformFinancialAction } = await import('@/lib/security-fortress')
      const finCheck = await canPerformFinancialAction(userId)
      if (!finCheck.allowed) {
        return NextResponse.json({ error: finCheck.reason || 'لا يمكنك إجراء عمليات مالية حالياً' }, { status: 403 })
      }
    } catch (fortressError) {
      console.error('[FORTRESS] Financial action check error:', fortressError)
      // Continue - don't block on error
    }

    // Get current price from Binance
    let currentPrice = 0
    try {
      const symbolMap: Record<string, string> = {
        'BTC/USDT': 'BTCUSDT',
        'ETH/USDT': 'ETHUSDT',
        'BNB/USDT': 'BNBUSDT',
        'SOL/USDT': 'SOLUSDT',
        'XRP/USDT': 'XRPUSDT',
        'DOGE/USDT': 'DOGEUSDT',
        'ADA/USDT': 'ADAUSDT',
        'AVAX/USDT': 'AVAXUSDT',
        'DOT/USDT': 'DOTUSDT',
        'LINK/USDT': 'LINKUSDT',
      }
      const binanceSymbol = symbolMap[symbol] || symbol.replace('/', '')
      const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`)
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        currentPrice = parseFloat(priceData.price)
      }
    } catch {
      // CRITICAL: Do NOT use hardcoded fallback prices - they allow arbitrage
      // If Binance API is unavailable, reject the trade
      return NextResponse.json({ error: 'بيانات السوق غير متاحة حالياً، يرجى المحاولة مرة أخرى' }, { status: 503 })
    }

    if (currentPrice <= 0) {
      return NextResponse.json({ error: 'لم يتم الحصول على سعر السوق' }, { status: 400 })
    }

    // Validate SL/TP
    const sl = stopLoss ? Number(stopLoss) : null
    const tp = takeProfit ? Number(takeProfit) : null
    const tp2 = takeProfit2 ? Number(takeProfit2) : null
    const tp3 = takeProfit3 ? Number(takeProfit3) : null

    if (sl) {
      if (type === 'BUY' && sl >= currentPrice) {
        return NextResponse.json({ error: 'وقف الخسارة يجب أن يكون أقل من سعر الدخول للشراء' }, { status: 400 })
      }
      if (type === 'SELL' && sl <= currentPrice) {
        return NextResponse.json({ error: 'وقف الخسارة يجب أن يكون أعلى من سعر الدخول للبيع' }, { status: 400 })
      }
    }
    if (tp) {
      if (type === 'BUY' && tp <= currentPrice) {
        return NextResponse.json({ error: 'هدف الربح يجب أن يكون أعلى من سعر الدخول للشراء' }, { status: 400 })
      }
      if (type === 'SELL' && tp >= currentPrice) {
        return NextResponse.json({ error: 'هدف الربح يجب أن يكون أقل من سعر الدخول للبيع' }, { status: 400 })
      }
    }

    // Find or create active session
    const sonaPackage = await db.package.findFirst({ where: { nameEn: 'SONA' } })
    if (!sonaPackage) {
      return NextResponse.json({ error: 'باقة SONA غير موجودة' }, { status: 404 })
    }

    let investment = await db.investment.findFirst({
      where: { userId, packageId: sonaPackage.id, status: 'ACTIVE' },
    })

    if (!investment) {
      // Create investment with mode 'TRADING' so the daily cron does NOT credit
      // daily profits to it. Manual trading positions earn P&L from closing,
      // not from daily profit distribution. This prevents balance doubling.
      investment = await db.investment.create({
        data: {
          userId,
          packageId: sonaPackage.id,
          amount: 0, // Amount is 0 so no capital release on completion
          monthlyProfit: 0,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Long duration
          mode: 'TRADING',
        },
      })
    }

    // Find or create session for this symbol
    let session = await db.tradingSession.findFirst({
      where: { userId, investmentId: investment.id, symbol, status: 'ACTIVE' },
    })

    if (!session) {
      session = await db.tradingSession.create({
        data: {
          userId,
          investmentId: investment.id,
          symbol,
          status: 'ACTIVE',
          startPrice: currentPrice,
          currentPrice,
          totalProfit: 0,
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
        },
        include: { investment: { include: { package: true } } },
      })
    }

    // Calculate quantity based on LEVERAGED position size
    // CRITICAL FIX: quantity must include leverage for correct P&L
    // e.g., $500 trade with 10x leverage = $5000 position = 0.05 BTC at $100k
    const quantity = (tradeAmount * leverage) / currentPrice

    // Use transaction for atomicity - prevents race conditions
    const openResult = await db.$transaction(async (tx) => {
      // Re-check balance within transaction to prevent race conditions
      const freshUser = await tx.user.findUnique({ where: { id: userId } })
      if (!freshUser || freshUser.balance < requiredMargin) {
        throw new Error('رصيدك غير كافي لفتح هذه الصفقة')
      }

      // Deduct only the margin required (tradeAmount / leverage) from user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: requiredMargin },
          withdrawableBalance: { decrement: requiredMargin },
        },
      })

      // Create the OPEN trade
      const trade = await tx.botTrade.create({
        data: {
          sessionId: session!.id,
          type,
          symbol,
          entryPrice: currentPrice,
          amount: tradeAmount,
          profitLoss: 0,
          status: 'OPEN',
          confidence: 100,
          stopLoss: sl,
          takeProfit: tp,
          takeProfit2: tp2,
          takeProfit3: tp3,
          quantity,
          isManual: true,
          leverage,
          marginType,
          openedAt: new Date(),
        },
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'INVESTMENT',
          amount: requiredMargin,
          status: 'COMPLETED',
          method: 'BALANCE',
          description: `فتح صفقة ${type === 'BUY' ? 'شراء' : 'بيع'} ${symbol} - ${tradeAmount.toFixed(2)} USDT ×${leverage} (هامش: ${requiredMargin.toFixed(2)} USDT) @ ${currentPrice.toFixed(2)}`,
        },
      })

      // Get updated balance after deduction
      const updatedUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } })

      return { trade, newBalance: updatedUser?.balance || 0 }
    })

    return NextResponse.json({
      position: openResult.trade,
      currentPrice,
      quantity,
      leverage,
      marginType,
      requiredMargin,
      newBalance: openResult.newBalance,
      message: type === 'BUY'
        ? `تم فتح صفقة شراء ${symbol} بنجاح ×${leverage}`
        : `تم فتح صفقة بيع ${symbol} بنجاح ×${leverage}`,
    }, { status: 201 })
  } catch (error) {
    console.error('Position open POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
