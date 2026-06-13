import { db } from '@/lib/db'
import { createNotification, notifyInvestmentReinvested } from '@/lib/notifications'
import { getUser, getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { TransactionSafety, generateIdempotencyKey } from '@/lib/transaction-safety'
import { DBRateLimiter, RATE_LIMITS } from '@/lib/db-rate-limiter'

/**
 * POST /api/invest/reinvest
 * Reinvest withdrawable balance with a 5% bonus in SONA mode.
 * Now includes idempotency check and concurrent operation lock.
 */
export async function POST(request: NextRequest) {
  let lockId: string | undefined

  try {
    // SECURITY: Always derive userId from authenticated token, never from request body
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
      RATE_LIMITS.REINVEST.action,
      RATE_LIMITS.REINVEST.maxAttempts,
      RATE_LIMITS.REINVEST.windowMs,
    )
    if (!rateLimit.allowed) {
      await DBRateLimiter.recordAttempt(userId, RATE_LIMITS.REINVEST.action, false, { ip: clientIp, userAgent: clientUA })
      return NextResponse.json(
        { error: `طلبات إعادة استثمار كثيرة جداً. حاول بعد ${Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 60000)} دقيقة.` },
        { status: 429 },
      )
    }

    // === CONCURRENT OPERATION LOCK ===
    try {
      lockId = await TransactionSafety.lockOperation(userId, 'REINVEST', 60_000)
    } catch {
      return NextResponse.json(
        { error: 'عملية إعادة استثمار أخرى قيد التنفيذ. يرجى الانتظار.' },
        { status: 409 },
      )
    }

    const body = await request.json()
    const { packageId, amount } = body

    // === IDEMPOTENCY CHECK ===
    const idempotencyKey = await generateIdempotencyKey(userId, 'REINVEST', { packageId, amount })
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

    if (!userId || !packageId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // SECURITY: Validate amount is a finite positive number
    const amountNum = Number(amount)
    if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'مبلغ غير صالح' },
        { status: 400 }
      )
    }
    const safeAmount = Math.floor(amountNum * 100) / 100
    if (safeAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ غير صالح بعد التقريب' },
        { status: 400 }
      )
    }

    // Get platform settings
    const settings = await db.platformSetting.findMany()
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))
    const reinvestBonusPercent = parseFloat(settingsMap.get('reinvest_bonus_percent') || '5')

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // SECURITY: Validate reinvest amount against withdrawableBalance
    // Only withdrawable balance can be reinvested - not locked capital
    if (safeAmount > user.withdrawableBalance) {
      return NextResponse.json(
        { error: 'رصيدك القابل للسحب غير كافي' },
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

    // Calculate bonus and total investment amount
    const bonus = safeAmount * (reinvestBonusPercent / 100)
    const totalAmount = safeAmount + bonus

    // Calculate monthly profit (daily rate)
    const monthlyProfit = totalAmount * (pkg.monthlyReturn / 100)

    const now = new Date()

    const investment = await db.$transaction(async (tx) => {
      // SECURITY FIX: Re-check balance inside transaction to prevent race condition
      // Previously: No balance check inside transaction - could exploit with concurrent requests
      const currentUser = await tx.user.findUnique({ where: { id: userId } })
      if (!currentUser) throw new Error('المستخدم غير موجود')
      if (currentUser.balance < safeAmount) {
        throw new Error('رصيدك غير كافي')
      }
      if (currentUser.withdrawableBalance < safeAmount) {
        throw new Error('رصيدك القابل للسحب غير كافي')
      }

      // Deduct from both balance and withdrawableBalance (keep in sync)
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: safeAmount },
          withdrawableBalance: { decrement: safeAmount },
          lockedCapital: { increment: totalAmount },
        },
      })

      const inv = await tx.investment.create({
        data: {
          userId,
          packageId,
          amount: totalAmount,
          monthlyProfit,
          totalProfit: 0,
          monthsElapsed: 0,
          status: 'ACTIVE',
          mode: 'SONA',
          startDate: now,
          lockEndDate: null,
          lastWeeklyTransfer: now,
          lastDailyProfitDate: null,
          lastProfitDate: null,
          reinvested: true,
          reinvestBonus: bonus,
        },
        include: {
          package: true,
        },
      })

      // Create REINVEST transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'REINVEST',
          amount: totalAmount,
          status: 'COMPLETED',
          method: 'balance_reinvest',
          description: `إعادة استثمار ${(safeAmount ?? 0).toFixed(2)} USDT مع مكافأة ${reinvestBonusPercent}% (${(bonus ?? 0).toFixed(2)} USDT)`,
          reference: inv.id,
          details: JSON.stringify({ originalAmount: safeAmount, bonus, bonusPercent: reinvestBonusPercent, totalAmount }),
        },
      })

      return inv
    })

    // === Record idempotency key to prevent duplicates ===
    await TransactionSafety.recordIdempotency(idempotencyKey, userId, 'REINVEST', { investmentId: investment.id, amount: totalAmount })

    // === Record successful rate limit attempt ===
    await DBRateLimiter.recordAttempt(userId, RATE_LIMITS.REINVEST.action, true, { ip: clientIp, userAgent: clientUA })

    // === Release lock ===
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId)
      lockId = undefined
    }

    // Create notification (Syrian dialect)
    await notifyInvestmentReinvested(userId, totalAmount, pkg.name, monthlyProfit)

    return NextResponse.json(
      {
        message: `تم إعادة الاستثمار بنجاح مع مكافأة ${reinvestBonusPercent}%`,
        investment,
        bonus,
        totalAmount,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Reinvest error:', error)
    // Release lock on error
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId).catch(() => {})
    }
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إعادة الاستثمار' },
      { status: 500 }
    )
  }
}
