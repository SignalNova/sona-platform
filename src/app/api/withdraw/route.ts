import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { getUser, getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { evaluateWithdrawal, getPlatformSetting } from '@/lib/staged-withdrawal'
import { monitorWithdrawal } from '@/lib/security-monitor'
import { TransactionSafety, generateIdempotencyKey } from '@/lib/transaction-safety'
import { DBRateLimiter, RATE_LIMITS } from '@/lib/db-rate-limiter'

/**
 * POST /api/withdraw
 * Create withdrawal request with staged algorithm.
 * FIXED: Now checks BOTH balance AND withdrawableBalance, and deducts from BOTH.
 * - Kill switch checks: maintenance mode, withdrawal_enabled
 * - Staged algorithm: auto-approve small amounts, manual review for large
 * - Dynamic messages for delayed withdrawals
 * - DB-backed rate limiting & idempotency check
 */
export async function POST(request: NextRequest) {
  // Variables that need to be accessible in finally/catch
  let lockId: string | undefined

  try {
    // === KILL SWITCH CHECK ===
    const maintenanceMode = (await getPlatformSetting('maintenance_mode')) === 'true'
    const withdrawalEnabled = (await getPlatformSetting('withdrawal_enabled')) !== 'false'

    if (maintenanceMode) {
      return NextResponse.json(
        { error: 'النظام حالياً تحت الصيانة. لا يمكن تقديم طلبات سحب جديدة حالياً.' },
        { status: 403 }
      )
    }

    if (!withdrawalEnabled) {
      return NextResponse.json(
        { error: 'السحوبات معطلة مؤقتاً. يرجى المحاولة لاحقاً.' },
        { status: 403 }
      )
    }

    // SECURITY: Only use JWT auth for user identification, never from body
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    const userId = authUser.id

    // === DB-BACKED RATE LIMIT CHECK ===
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown'
    const clientUA = request.headers.get('user-agent') || ''
    const rateLimit = await DBRateLimiter.checkLimit(
      userId,
      RATE_LIMITS.WITHDRAWAL.action,
      RATE_LIMITS.WITHDRAWAL.maxAttempts,
      RATE_LIMITS.WITHDRAWAL.windowMs,
    )
    if (!rateLimit.allowed) {
      await DBRateLimiter.recordAttempt(userId, RATE_LIMITS.WITHDRAWAL.action, false, { ip: clientIp, userAgent: clientUA })
      return NextResponse.json(
        { error: `طلبات سحب كثيرة جداً. حاول بعد ${Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 60000)} دقيقة.` },
        { status: 429 },
      )
    }

    // === CONCURRENT OPERATION LOCK ===
    try {
      lockId = await TransactionSafety.lockOperation(userId, 'WITHDRAWAL', 60_000)
    } catch {
      return NextResponse.json(
        { error: 'عملية سحب أخرى قيد التنفيذ. يرجى الانتظار.' },
        { status: 409 },
      )
    }

    // === IDEMPOTENCY CHECK ===
    const body = await request.json()
    let { amount, method, walletAddress, details, mode: requestedMode } = body
    const idempotencyKey = await generateIdempotencyKey(userId, 'WITHDRAWAL', { amount, method, walletAddress })
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
      // Continue - don't block on error
    }

    if (!userId || !amount || !method) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'عنوان المحفظة مطلوب للسحب' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'يجب أن يكون المبلغ أكبر من صفر' },
        { status: 400 }
      )
    }

    const validMethods = ['usdt_bep20', 'usdt_trc20', 'btc', 'eth']
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: 'طريقة السحب غير صالحة' },
        { status: 400 }
      )
    }

    // Get platform settings
    const settings = await db.platformSetting.findMany()
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))
    const platformMode = settingsMap.get('platform_mode') || 'SONA'
    const withdrawalFast = settingsMap.get('withdrawal_processing_fast') || '1-24'
    const withdrawalMedium = settingsMap.get('withdrawal_processing_medium') || '24-72'
    const withdrawalSlow = settingsMap.get('withdrawal_processing_slow') || '72-168'
    const minWithdrawal = parseFloat(settingsMap.get('min_withdrawal') || '10')

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // SECURITY: Enforce KYC for very large withdrawals (>$10000 - hard block)
    // AI handles KYC checks for $1000-$10000 range
    if (amount > 10000 && !['VERIFIED', 'APPROVED'].includes(user.kycStatus)) {
      return NextResponse.json(
        { error: 'يرجى إكمال التحقق من الهوية للسحب بمبالغ تتجاوز $10,000' },
        { status: 403 }
      )
    }

    if (amount < minWithdrawal) {
      return NextResponse.json(
        { error: `الحد الأدنى للسحب هو ${minWithdrawal} USDT` },
        { status: 400 }
      )
    }

    // === STAGED WITHDRAWAL ALGORITHM ===
    const evaluation = await evaluateWithdrawal(userId, amount)

    // Determine processing time based on amount
    let processingTime: string
    let requiresKyc = false
    if (amount < 500) {
      processingTime = withdrawalFast + ' ساعة'
    } else if (amount <= 1000) {
      processingTime = withdrawalMedium + ' ساعة'
    } else {
      processingTime = withdrawalSlow + ' ساعة'
      requiresKyc = true
    }

    // KYC note for large withdrawals - no longer blocking, just recording
    const kycNote = amount > 1000 && !['VERIFIED', 'APPROVED'].includes(user.kycStatus)
      ? 'يرجى توثيق حسابك لسحب أكثر من $1000'
      : null

    // Determine withdrawal mode (always SONA)
    const withdrawalMode = 'SONA'
    const now = new Date()

    // FIX: Check withdrawableBalance (not total balance) for withdrawal eligibility
    // Total balance includes locked capital and non-withdrawable profits
    // Only withdrawableBalance is available for withdrawal
    const effectiveBalance = user.withdrawableBalance

    if (effectiveBalance < amount) {
      return NextResponse.json(
        { error: `رصيدك القابل للسحب غير كافي. رصيدك القابل للسحب: ${user.withdrawableBalance.toFixed(2)} USDT` },
        { status: 400 }
      )
    }

    const methodLabels: Record<string, string> = {
      'usdt_bep20': 'USDT BEP20',
      'usdt_trc20': 'USDT TRC20',
      'btc': 'Bitcoin',
      'eth': 'Ethereum',
    }

    // Withdrawal fee per network
    const withdrawalFees: Record<string, number> = {
      'usdt_bep20': 0.5,
      'usdt_trc20': 1.0,
      'btc': 5.0,
      'eth': 3.0,
    }
    const fee = withdrawalFees[method] || 1.0
    const netAmount = amount - fee

    if (netAmount <= 0) {
      return NextResponse.json(
        { error: `المبلغ لا يكفي لتغطية رسوم السحب (${fee.toFixed(2)} USDT)` },
        { status: 400 }
      )
    }

    // Daily withdrawal limit: max $10,000 per day per user
    const MAX_DAILY_WITHDRAWAL = 10000
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayWithdrawals = await db.transaction.aggregate({
      where: {
        userId,
        type: 'WITHDRAWAL',
        createdAt: { gte: todayStart },
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
      },
      _sum: { amount: true },
    })
    const todayTotal = todayWithdrawals._sum.amount || 0
    if (todayTotal + amount > MAX_DAILY_WITHDRAWAL) {
      return NextResponse.json(
        { error: `تجاوزت الحد الأقصى للسحب اليومي (${MAX_DAILY_WITHDRAWAL.toLocaleString()} USDT). سحبت اليوم: ${todayTotal.toFixed(2)} USDT` },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      // SECURITY: Re-check withdrawable balance inside transaction to prevent race condition
      const currentUser = await tx.user.findUnique({ where: { id: userId } })
      if (!currentUser) throw new Error('USER_NOT_FOUND')

      if (currentUser.withdrawableBalance < amount) {
        throw new Error('INSUFFICIENT_WITHDRAWABLE_BALANCE')
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount,
          status: evaluation.autoApproved ? 'PROCESSING' : 'PENDING',
          method,
          walletAddress,
          description: details || `طلب سحب ${methodLabels[method] || method} إلى ${walletAddress} (صافي: ${netAmount.toFixed(2)} USDT، رسوم: ${fee.toFixed(2)} USDT)`,
          details: JSON.stringify({
            mode: withdrawalMode,
            processingTime,
            requiresKyc,
            fee,
            netAmount,
            stagedAlgorithm: {
              stage: evaluation.stage,
              autoApproved: evaluation.autoApproved,
              reason: evaluation.reason,
            },
          }),
        },
      })

      // FIXED: Deduct from BOTH balance AND withdrawableBalance
      // This keeps both pools in sync and prevents phantom balances
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          withdrawableBalance: { decrement: Math.min(amount, currentUser.withdrawableBalance) },
          totalWithdrawn: { increment: amount },
        },
      })

      // Create withdrawal queue entry for tracking
      await tx.withdrawalQueue.create({
        data: {
          transactionId: transaction.id,
          stage: evaluation.autoApproved ? 'APPROVED' : 'PENDING_MANUAL',
          autoApproved: evaluation.autoApproved,
          dynamicMessage: evaluation.dynamicMessage || null,
          priority: evaluation.autoApproved ? 0 : 1,
        }
      })

      return transaction
    }).catch((err) => {
      if (err.message === 'INSUFFICIENT_WITHDRAWABLE_BALANCE' || err.message === 'USER_NOT_FOUND') {
        return null
      }
      throw err
    })

    if (!result) {
      return NextResponse.json(
        { error: 'رصيدك القابل للسحب غير كافي. حاول مرة أخرى.' },
        { status: 400 }
      )
    }

    // === Record idempotency key to prevent duplicates ===
    await TransactionSafety.recordIdempotency(idempotencyKey, userId, 'WITHDRAWAL', { transactionId: result.id, amount })

    // === Record successful rate limit attempt ===
    await DBRateLimiter.recordAttempt(userId, RATE_LIMITS.WITHDRAWAL.action, true, { ip: clientIp, userAgent: clientUA })

    // === Release lock ===
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId)
      lockId = undefined
    }

    // SECURITY: Monitor this withdrawal for suspicious patterns
    await monitorWithdrawal(userId, amount, clientIp)

    // Create notification
    const notifMessage = evaluation.autoApproved
      ? `تم استلام طلب السحب رقم #${result.id.slice(-6)} وتمت الموافقة عليه تلقائياً. سيتم المعالجة خلال ${processingTime}.`
      : `تم استلام طلب السحب رقم #${result.id.slice(-6)}، جاري المراجعة. الوقت المتوقع: ${processingTime}. ${evaluation.dynamicMessage || ''}`

    await createNotification({
      userId,
      title: evaluation.autoApproved ? 'تمت الموافقة على طلب السحب' : 'تم استلام طلب السحب',
      message: notifMessage,
      type: 'WITHDRAWAL',
      data: { transactionId: result.id, amount, processingTime, method: methodLabels[method] || method, autoApproved: evaluation.autoApproved },
    })

    // Auto-process withdrawal via BingX API (only for auto-approved)
    if (evaluation.autoApproved) {
      try {
        const { submitBingXWithdrawal, mapNetworkToBingX } = await import('@/lib/bingx')

        const BINGX_API_KEY = process.env.BINGX_API_KEY || process.env.BINANCE_API_KEY
        const BINGX_SECRET_KEY = process.env.BINGX_SECRET_KEY || process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY

        if (BINGX_API_KEY && BINGX_SECRET_KEY) {
          const coinNetworkMap: Record<string, { coin: string; network: string }> = {
            'usdt_bep20': { coin: 'USDT', network: 'BEP20' },
            'usdt_trc20': { coin: 'USDT', network: 'TRC20' },
            'btc': { coin: 'BTC', network: 'BTC' },
            'eth': { coin: 'ETH', network: 'ERC20' },
          }

          const coinInfo = coinNetworkMap[method]
          if (coinInfo) {
            // FIX: Send NET amount (after platform fee) to BingX
            // The platform keeps the fee as revenue
            const withdrawResult = await submitBingXWithdrawal({
              coin: coinInfo.coin,
              network: coinInfo.network,
              address: walletAddress,
              amount: netAmount,  // NET amount after fee, not gross
              orderId: result.id.slice(-10),
            })

            if (withdrawResult.success && withdrawResult.id) {
              await db.transaction.update({
                where: { id: result.id },
                data: {
                  status: 'PROCESSING',
                  txHash: withdrawResult.id,
                  details: JSON.stringify({
                    mode: withdrawalMode,
                    processingTime,
                    requiresKyc,
                    kycNote,
                    bingxWithdrawId: withdrawResult.id,
                    autoProcessed: true,
                    exchange: 'BingX',
                    stagedAlgorithm: {
                      stage: evaluation.stage,
                      autoApproved: evaluation.autoApproved,
                      reason: evaluation.reason,
                    },
                    submittedAmount: netAmount,
                    platformFee: fee,
                    grossAmount: amount,
                  }),
                },
              })
            } else {
              console.error('[BINGX WITHDRAW] Failed:', withdrawResult.message)
            }
          }
        }
      } catch (bingxErr) {
        console.error('[BINGX WITHDRAW] Error:', bingxErr)
      }
    }

    return NextResponse.json(
      {
        message: evaluation.autoApproved
          ? (kycNote || 'تم إنشاء طلب السحب وتمت الموافقة عليه تلقائياً. سيتم المعالجة قريباً.')
          : `تم إنشاء طلب السحب وهو قيد المراجعة اليدوية. ${evaluation.dynamicMessage || ''}`,
        transaction: result,
        processingTime,
        requiresKyc,
        kycNote,
        fee,
        netAmount,
        autoApproved: evaluation.autoApproved,
        stage: evaluation.stage,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Withdraw error:', error)
    // Release lock on error
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId).catch(() => {})
    }
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء طلب السحب' },
      { status: 500 }
    )
  }
}
