import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

// GET: Get all trading sessions for the authenticated user
// Supports ?investmentId= to filter by specific investment and return flat trades list
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)
    const { searchParams } = new URL(request.url)
    const investmentId = searchParams.get('investmentId')

    if (investmentId) {
      // Return trades for a specific investment
      const sessions = await db.tradingSession.findMany({
        where: { userId, investmentId },
        include: {
          trades: { orderBy: { openedAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      })
      const trades = sessions.flatMap(s => s.trades || [])
      return NextResponse.json({ trades })
    }

    const sessions = await db.tradingSession.findMany({
      where: { userId },
      include: {
        investment: { include: { package: true } },
        trades: { orderBy: { openedAt: 'desc' }, take: 50 },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Trading session GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Create a new trading session
// Supports two modes:
// 1. With investmentId - traditional mode (auto-triggered when investment activates)
// 2. With symbol + amount - create session on-the-fly for direct balance trading
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const body = await request.json()
    const { investmentId, symbol, amount } = body

    // ===== MODE 1: Traditional - with investmentId =====
    if (investmentId) {
      // Verify the investment belongs to this user and is active
      const investment = await db.investment.findFirst({
        where: { id: investmentId, userId, status: 'ACTIVE' },
        include: { package: true },
      })

      if (!investment) {
        return NextResponse.json({ error: 'الاستثمار غير موجود أو غير نشط' }, { status: 404 })
      }

      // Check if a trading session already exists for this investment
      const existingSession = await db.tradingSession.findFirst({
        where: { investmentId, status: 'ACTIVE' },
      })

      if (existingSession) {
        return NextResponse.json({ session: existingSession, message: 'جلسة التداول موجودة بالفعل' })
      }

      // FIX: Use real Binance prices instead of hardcoded random prices
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT']
      const sessionSymbol = symbols[Math.floor(Math.random() * symbols.length)]
      let startPrice = 0
      try {
        const symbolMap: Record<string, string> = {
          'BTC/USDT': 'BTCUSDT', 'ETH/USDT': 'ETHUSDT', 'BNB/USDT': 'BNBUSDT',
        }
        const binanceSymbol = symbolMap[sessionSymbol] || sessionSymbol.replace('/', '')
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          startPrice = parseFloat(priceData.price)
        }
      } catch {}
      if (startPrice <= 0) {
        return NextResponse.json({ error: 'بيانات السوق غير متاحة حالياً' }, { status: 503 })
      }

      const session = await db.tradingSession.create({
        data: {
          userId,
          investmentId,
          symbol: sessionSymbol,
          status: 'ACTIVE',
          startPrice,
          currentPrice: startPrice,
          totalProfit: 0,
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
        },
        include: {
          investment: { include: { package: true } },
        },
      })

      await createNotification({
        userId,
        title: 'بدأ التداول',
        message: `تم تفعيل التداول لاستثمارك في باقة ${investment.package.name}. سيتم تنفيذ الصفقات تلقائياً.`,
        type: 'TRADING',
        data: { sessionId: session.id, symbol: sessionSymbol },
      })

      return NextResponse.json({ session, message: 'تم إنشاء جلسة التداول بنجاح' }, { status: 201 })
    }

    // ===== MODE 2: On-the-fly - with symbol + amount (direct balance trading) =====
    if (symbol && amount) {
      // Find or create an active investment for this user with the SONA package
      const sonaPackage = await db.package.findFirst({ where: { nameEn: 'SONA' } })

      if (!sonaPackage) {
        return NextResponse.json({ error: 'باقة SONA غير موجودة' }, { status: 404 })
      }

      // Check if user already has an active investment with SONA
      let investment = await db.investment.findFirst({
        where: { userId, packageId: sonaPackage.id, status: 'ACTIVE' },
      })

      if (!investment) {
        // Create a new investment with the SONA package using the user's balance
        const tradeAmount = Math.min(Number(amount), authUser.balance || 0)
        if (tradeAmount < sonaPackage.minAmount) {
          return NextResponse.json({ error: `الحد الأدنى للاستثمار هو ${sonaPackage.minAmount} USDT` }, { status: 400 })
        }

        investment = await db.investment.create({
          data: {
            userId,
            packageId: sonaPackage.id,
            amount: tradeAmount,
            monthlyProfit: tradeAmount * (sonaPackage.monthlyReturn / 100),
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + sonaPackage.durationDays * 24 * 60 * 60 * 1000),
            mode: 'SONA',
          },
          include: { package: true },
        })

        // Deduct from user balance (sync all balance fields)
        await db.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: tradeAmount },
            withdrawableBalance: { decrement: tradeAmount },
            lockedCapital: { increment: tradeAmount },
          },
        })

        // Create transaction record
        await db.transaction.create({
          data: {
            userId,
            type: 'INVESTMENT',
            amount: tradeAmount,
            status: 'COMPLETED',
            method: 'BALANCE',
            description: `استثمار في باقة SONA - ${tradeAmount.toFixed(2)} USDT`,
          },
        })
      }

      // Check for existing active trading session for this investment
      const existingSession = await db.tradingSession.findFirst({
        where: { investmentId: investment.id, status: 'ACTIVE' },
      })

      if (existingSession) {
        return NextResponse.json({ session: existingSession, message: 'جلسة التداول موجودة بالفعل' })
      }

      // Create the trading session with the requested symbol
      // FIX: Use real Binance prices instead of hardcoded random prices
      const pairSymbol = symbol || 'BTC/USDT'
      let startPrice = 0
      try {
        const symbolMap: Record<string, string> = {
          'BTC/USDT': 'BTCUSDT', 'ETH/USDT': 'ETHUSDT', 'BNB/USDT': 'BNBUSDT',
          'SOL/USDT': 'SOLUSDT', 'XRP/USDT': 'XRPUSDT',
        }
        const binanceSymbol = symbolMap[pairSymbol] || pairSymbol.replace('/', '')
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          startPrice = parseFloat(priceData.price)
        }
      } catch {}
      if (startPrice <= 0) {
        return NextResponse.json({ error: 'بيانات السوق غير متاحة حالياً' }, { status: 503 })
      }

      const session = await db.tradingSession.create({
        data: {
          userId,
          investmentId: investment.id,
          symbol: pairSymbol,
          status: 'ACTIVE',
          startPrice,
          currentPrice: startPrice,
          totalProfit: 0,
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
        },
        include: {
          investment: { include: { package: true } },
        },
      })

      await createNotification({
        userId,
        title: 'بدأ التداول',
        message: `تم تفعيل التداول في ${pairSymbol}. يمكنك الآن تنفيذ صفقات الشراء والبيع.`,
        type: 'TRADING',
        data: { sessionId: session.id, symbol: pairSymbol },
      })

      return NextResponse.json({ session, message: 'تم إنشاء جلسة التداول بنجاح' }, { status: 201 })
    }

    return NextResponse.json({ error: 'معرف الاستثمار أو رمز التداول مطلوب' }, { status: 400 })
  } catch (error) {
    console.error('Trading session POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
