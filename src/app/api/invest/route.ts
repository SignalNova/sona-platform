import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { processInvestmentCommission } from '@/lib/commission'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { TransactionSafety, generateIdempotencyKey } from '@/lib/transaction-safety'
import { DBRateLimiter, RATE_LIMITS } from '@/lib/db-rate-limiter'

export async function POST(request: NextRequest) {
  let lockId: string | undefined

  try {
    // SECURITY: Always derive userId from authenticated token, never from request body
    // This prevents users from investing on behalf of other users (IDOR vulnerability)
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    const userId = String(authUser.id)

    // === DB-BACKED RATE LIMIT CHECK ===
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown'
    const clientUA = request.headers.get('user-agent') || ''
    const rateLimit = await DBRateLimiter.checkLimit(
      userId,
      RATE_LIMITS.INVEST.action,
      RATE_LIMITS.INVEST.maxAttempts,
      RATE_LIMITS.INVEST.windowMs,
    )
    if (!rateLimit.allowed) {
      await DBRateLimiter.recordAttempt(userId, RATE_LIMITS.INVEST.action, false, { ip: clientIp, userAgent: clientUA })
      return NextResponse.json(
        { error: `طلبات استثمار كثيرة جداً. حاول بعد ${Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 60000)} دقيقة.` },
        { status: 429 },
      )
    }

    // === CONCURRENT OPERATION LOCK ===
    try {
      lockId = await TransactionSafety.lockOperation(userId, 'INVESTMENT', 60_000)
    } catch {
      return NextResponse.json(
        { error: 'عملية استثمار أخرى قيد التنفيذ. يرجى الانتظار.' },
        { status: 409 },
      )
    }

    // SECURITY FORTRESS: Check if user can perform financial actions
    try {
      const { canPerformFinancialAction } = await import('@/lib/security-fortress')
      const finCheck = await canPerformFinancialAction(userId)
      if (!finCheck.allowed) {
        return NextResponse.json(
          { error: finCheck.reason || 'لا يمكنك إجراء عمليات مالية حالياً' },
          { status: 403 }
        )
      }
    } catch (fortressError) {
      console.error('[FORTRESS] Financial action check error:', fortressError)
    }

    const body = await request.json()
    const { packageId, amount } = body

    // === IDEMPOTENCY CHECK ===
    const idempotencyKey = await generateIdempotencyKey(userId, 'INVESTMENT', { packageId, amount })
    const isDuplicate = await TransactionSafety.checkIdempotency(idempotencyKey)
    if (isDuplicate) {
      await TransactionSafety.unlockOperation(lockId)
      lockId = undefined
      const prevResult = await TransactionSafety.getIdempotencyResult(idempotencyKey)
      return NextResponse.json(
        { message: 'تم معالجة هذا الطلب مسبقاً', previousResult: prevResult },
        { status: 200 },
      )
    }

    if (!packageId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // SECURITY: Validate amount is a finite positive number (prevent Infinity, NaN, -0)
    const amountNum = Number(amount)
    if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'مبلغ غير صالح' },
        { status: 400 }
      )
    }
    // SECURITY: Round to 2 decimal places to prevent floating point exploits
    const safeAmount = Math.floor(amountNum * 100) / 100
    if (safeAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ غير صالح بعد التقريب' },
        { status: 400 }
      )
    }

    const pkg = await db.package.findUnique({
      where: { id: packageId },
    })

    if (!pkg || !pkg.isActive) {
      return NextResponse.json(
        { error: 'الباقة غير موجودة أو غير متاحة' },
        { status: 404 }
      )
    }

    if (safeAmount < pkg.minAmount) {
      return NextResponse.json(
        { error: `الحد الأدنى للاستثمار في هذه الباقة هو ${pkg.minAmount}` },
        { status: 400 }
      )
    }

    if (pkg.maxAmount && safeAmount > pkg.maxAmount) {
      return NextResponse.json(
        { error: `الحد الأقصى للاستثمار في هذه الباقة هو ${pkg.maxAmount}` },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    if (user.balance < safeAmount) {
      return NextResponse.json(
        { error: 'رصيدك غير كافي للاستثمار' },
        { status: 400 }
      )
    }

    // Calculate monthly profit based on monthlyReturn
    const monthlyProfit = safeAmount * (pkg.monthlyReturn / 100)

    const now = new Date()

    // SONA investment flow - unified simple investment
    const investment = await db.$transaction(async (tx) => {
      // Re-check balance inside transaction to prevent race condition
      const currentUser = await tx.user.findUnique({ where: { id: userId } })
      if (!currentUser || currentUser.balance < safeAmount) {
        throw new Error('رصيدك غير كافي للاستثمار. يرجى الإيداع أولاً.')
      }

      // Deduct from user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: safeAmount },
          withdrawableBalance: { decrement: safeAmount },
          lockedCapital: { increment: safeAmount },
        },
      })

      const inv = await tx.investment.create({
        data: {
          userId,
          packageId,
          amount: safeAmount,
          monthlyProfit,
          totalProfit: 0,
          monthsElapsed: 0,
          status: 'ACTIVE',
          mode: 'SONA',
          startDate: now,
          lastDailyProfitDate: null,
          lastProfitDate: null,
        },
        include: {
          package: true,
        },
      })

      await tx.transaction.create({
        data: {
          userId,
          type: 'INVESTMENT',
          amount: safeAmount,
          status: 'COMPLETED',
          method: 'balance',
          description: `استثمار في باقة ${pkg.name}`,
          reference: inv.id,
        },
      })

      return inv
    })

    // === Record idempotency key to prevent duplicates ===
    await TransactionSafety.recordIdempotency(idempotencyKey, userId, 'INVESTMENT', { investmentId: investment.id, amount: safeAmount })

    // === Record successful rate limit attempt ===
    await DBRateLimiter.recordAttempt(userId, RATE_LIMITS.INVEST.action, true, { ip: clientIp, userAgent: clientUA })

    // === Release lock ===
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId)
      lockId = undefined
    }

    // Process multi-level investment commission for referrer chain
    // This runs after the investment is created and handles level 1/2/3 commissions
    await processInvestmentCommission(userId, safeAmount).catch(err =>
      console.error('[COMMISSION] Failed to process investment commission:', err)
    )

    // Send notification
    // FIX: dailyProfit should be monthlyProfit / 30, not monthlyProfit itself
    const dailyProfit = monthlyProfit / 30
    await createNotification({
      userId,
      title: 'استثمار جديد',
      message: `تم استثمار ${(safeAmount ?? 0).toFixed(2)} USDT في باقة ${pkg.name}. ربحك اليومي: ${(dailyProfit ?? 0).toFixed(2)} USDT`,
      type: 'INVESTMENT',
      data: { amount: safeAmount, packageName: pkg.name, dailyProfit, mode: 'SONA' },
    })

    // Auto-create trading session for this investment
    // FIX: Use real Binance prices instead of hardcoded random prices
    try {
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT']
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]
      
      // Get real price from Binance
      let startPrice = 0
      try {
        const symbolMap: Record<string, string> = {
          'BTC/USDT': 'BTCUSDT',
          'ETH/USDT': 'ETHUSDT',
          'BNB/USDT': 'BNBUSDT',
        }
        const binanceSymbol = symbolMap[symbol] || symbol.replace('/', '')
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          startPrice = parseFloat(priceData.price)
        }
      } catch {}
      
      if (startPrice > 0) {
        await db.tradingSession.create({
          data: {
            userId,
            investmentId: investment.id,
            symbol,
            status: 'ACTIVE',
            startPrice,
            currentPrice: startPrice,
            totalProfit: 0,
            totalTrades: 0,
            winTrades: 0,
            lossTrades: 0,
          },
        })
      }
    } catch (e) {
      console.error('Auto-create trading session failed (non-critical):', e)
    }

    return NextResponse.json(
      { message: 'تم الاستثمار بنجاح', investment, mode: 'SONA' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Invest error:', error)
    // Release lock on error
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId).catch(() => {})
    }
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستثمار' },
      { status: 500 }
    )
  }
}
