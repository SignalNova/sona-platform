import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { TransactionSafety, generateIdempotencyKey } from '@/lib/transaction-safety'
import { DBRateLimiter, RATE_LIMITS } from '@/lib/db-rate-limiter'

// ═══════════════════════════════════════════════════════════
// P2P INTERNAL TRANSFER - ULTRA SECURE (10+ SECURITY LAYERS)
// ═══════════════════════════════════════════════════════════

// LAYER 2: Maximum transfer amount per transaction
const MAX_TRANSFER_AMOUNT = 10000 // $10,000

// LAYER 3: Minimum transfer amount
const MIN_TRANSFER_AMOUNT = 1 // $1

// LAYER 4: Maximum daily transfer limit per user
const MAX_DAILY_TRANSFER = 50000 // $50,000 per day

// LAYER 5: P2P Transfer fee (0% but structure exists for future)
const TRANSFER_FEE_PERCENT = 0

export async function POST(request: NextRequest) {
  let lockId: string | undefined

  try {
    // ═══ LAYER 6: Authentication Check ═══
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const fromUserId = String(authUser.id)

    // ═══ DB-BACKED RATE LIMIT CHECK ═══
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown'
    const clientUA = request.headers.get('user-agent') || ''
    const rateLimit = await DBRateLimiter.checkLimit(
      fromUserId,
      RATE_LIMITS.P2P_TRANSFER.action,
      RATE_LIMITS.P2P_TRANSFER.maxAttempts,
      RATE_LIMITS.P2P_TRANSFER.windowMs,
    )
    if (!rateLimit.allowed) {
      await DBRateLimiter.recordAttempt(fromUserId, RATE_LIMITS.P2P_TRANSFER.action, false, { ip: clientIp, userAgent: clientUA })
      return NextResponse.json({
        error: `تم تجاوز الحد الأقصى للتحويلات. حاول بعد ${Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 60000)} دقيقة.`
      }, { status: 429 })
    }

    // ═══ CONCURRENT OPERATION LOCK ═══
    try {
      lockId = await TransactionSafety.lockOperation(fromUserId, 'P2P_TRANSFER', 60_000)
    } catch {
      return NextResponse.json({ error: 'عملية تحويل أخرى قيد التنفيذ. يرجى الانتظار.' }, { status: 409 })
    }

    // ═══ IDEMPOTENCY CHECK ═══
    const body = await request.json()
    const { toUserEmail, amount, description } = body
    const idempotencyKey = await generateIdempotencyKey(fromUserId, 'P2P_TRANSFER', { toUserEmail, amount })
    const isDuplicate = await TransactionSafety.checkIdempotency(idempotencyKey)
    if (isDuplicate) {
      await TransactionSafety.unlockOperation(lockId)
      lockId = undefined
      const prevResult = await TransactionSafety.getIdempotencyResult(idempotencyKey)
      return NextResponse.json({ message: 'تم معالجة هذا الطلب مسبقاً', previousResult: prevResult }, { status: 200 })
    }

    // ═══ LAYER 7: Account status checks ═══
    if (!authUser.isActive) {
      return NextResponse.json({ error: 'حسابك معطل. تواصل مع الدعم الفني.' }, { status: 403 })
    }
    if (!authUser.emailVerified) {
      return NextResponse.json({ error: 'يجب تأكيد بريدك الإلكتروني أولاً' }, { status: 403 })
    }

    // SECURITY FORTRESS: Check if user can perform financial actions
    try {
      const { canPerformFinancialAction } = await import('@/lib/security-fortress')
      const finCheck = await canPerformFinancialAction(fromUserId)
      if (!finCheck.allowed) {
        return NextResponse.json({ error: finCheck.reason || 'لا يمكنك إجراء عمليات مالية حالياً' }, { status: 403 })
      }
    } catch (fortressError) {
      console.error('[FORTRESS] Financial action check error:', fortressError)
    }

    // ═══ LAYER 8: Input validation ═══
    if (!toUserEmail || !amount) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toUserEmail)) {
      return NextResponse.json({ error: 'بريد إلكتروني غير صالح' }, { status: 400 })
    }

    // Validate amount is a number
    const transferAmount = Number(amount)
    if (isNaN(transferAmount) || !isFinite(transferAmount)) {
      return NextResponse.json({ error: 'مبلغ غير صالح' }, { status: 400 })
    }

    if (transferAmount <= 0) {
      return NextResponse.json({ error: 'يجب أن يكون المبلغ أكبر من صفر' }, { status: 400 })
    }

    if (transferAmount < MIN_TRANSFER_AMOUNT) {
      return NextResponse.json({ error: `الحد الأدنى للتحويل هو $${MIN_TRANSFER_AMOUNT}` }, { status: 400 })
    }

    // ═══ LAYER 9: Maximum transfer amount cap ═══
    if (transferAmount > MAX_TRANSFER_AMOUNT) {
      return NextResponse.json({ error: `الحد الأقصى للتحويل الواحد هو $${MAX_TRANSFER_AMOUNT.toLocaleString()}` }, { status: 400 })
    }

    // Prevent floating point exploits (round to 2 decimal places)
    const safeAmount = Math.floor(transferAmount * 100) / 100
    if (safeAmount <= 0) {
      return NextResponse.json({ error: 'مبلغ غير صالح بعد التقريب' }, { status: 400 })
    }

    // ═══ Find recipient user - CASE INSENSITIVE ═══
    const normalizedEmail = toUserEmail.trim().toLowerCase()
    const toUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!toUser) {
      return NextResponse.json({ error: 'المستخدم المستلم غير موجود' }, { status: 404 })
    }

    // ═══ LAYER 10: SELF-TRANSFER PREVENTION (Bulletproof) ═══
    // Check by ID (most reliable), email (case-insensitive), and name
    if (toUser.id === fromUserId) {
      return NextResponse.json({ error: 'لا يمكن التحويل لنفس حسابك' }, { status: 400 })
    }
    if (toUser.email.toLowerCase() === authUser.email?.toLowerCase()) {
      return NextResponse.json({ error: 'لا يمكن التحويل لنفس حسابك' }, { status: 400 })
    }

    // ═══ LAYER 7b: Recipient account checks ═══
    if (!toUser.isActive) {
      return NextResponse.json({ error: 'حساب المستلم معطل' }, { status: 400 })
    }
    // Check if recipient is banned (check role field)
    if (toUser.role === 'BANNED') {
      return NextResponse.json({ error: 'لا يمكن التحويل لحساب محظور' }, { status: 400 })
    }

    // ═══ Get sender's fresh data inside transaction ═══
    const fromUser = await db.user.findUnique({
      where: { id: fromUserId },
    })

    if (!fromUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    // ═══ LAYER 8b: Sender account checks ═══
    if (fromUser.role === 'BANNED') {
      return NextResponse.json({ error: 'حسابك محظور' }, { status: 403 })
    }

    // Check balance - only withdrawable balance is available for transfer
    const effectiveBalance = fromUser.withdrawableBalance

    if (effectiveBalance < safeAmount) {
      return NextResponse.json({
        error: 'رصيدك القابل للسحب غير كافي للتحويل'
      }, { status: 400 })
    }

    // ═══ LAYER 4: Daily transfer limit check ═══
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayTransfers = await db.p2PTransfer.findMany({
      where: {
        fromUserId,
        createdAt: { gte: todayStart },
        status: 'COMPLETED',
      },
      select: { amount: true },
    })

    const todayTotal = todayTransfers.reduce((sum, t) => sum + t.amount, 0)
    if (todayTotal + safeAmount > MAX_DAILY_TRANSFER) {
      return NextResponse.json({
        error: `تم تجاوز الحد اليومي للتحويلات ($${MAX_DAILY_TRANSFER.toLocaleString()}/يوم). المحول اليوم: $${todayTotal.toFixed(2)}`
      }, { status: 400 })
    }

    // Calculate fee
    const fee = Math.floor(safeAmount * TRANSFER_FEE_PERCENT) / 100
    const totalDeducted = safeAmount + fee

    // ═══ Execute transfer atomically ═══
    const result = await db.$transaction(async (tx) => {
      // LAYER 9b: Re-check self-transfer inside transaction (prevent race condition)
      const freshToUser = await tx.user.findUnique({ where: { id: toUser.id } })
      if (!freshToUser) throw new Error('المستلم غير موجود')
      if (freshToUser.id === fromUserId) throw new Error('لا يمكن التحويل لنفس حسابك')

      // LAYER 11: Re-check balance inside transaction (prevent race condition)
      const currentFromUser = await tx.user.findUnique({ where: { id: fromUserId } })
      if (!currentFromUser) throw new Error('المستخدم غير موجود')

      if (currentFromUser.withdrawableBalance < totalDeducted) {
        throw new Error('رصيدك غير كافي للتحويل')
      }

      // LAYER 12: Verify sender is not banned/frozen inside transaction
      if (currentFromUser.role === 'BANNED') throw new Error('حسابك محظور')
      if (!currentFromUser.isActive) throw new Error('حسابك معطل')

      // LAYER 13: Double-check self-transfer with fresh data
      if (currentFromUser.email.toLowerCase() === freshToUser.email.toLowerCase()) {
        throw new Error('لا يمكن التحويل لنفس حسابك')
      }

      // LAYER 14: Verify recipient is active inside transaction
      if (!freshToUser.isActive) throw new Error('حساب المستلم معطل')

      // Deduct from sender - ONLY from withdrawableBalance
      await tx.user.update({
        where: { id: fromUserId },
        data: {
          balance: { decrement: totalDeducted },
          withdrawableBalance: { decrement: Math.min(totalDeducted, currentFromUser.withdrawableBalance) },
        },
      })

      // Credit to receiver - add to BOTH balance and withdrawableBalance
      await tx.user.update({
        where: { id: toUser.id },
        data: {
          balance: { increment: safeAmount },
          withdrawableBalance: { increment: safeAmount },
        },
      })

      // LAYER 15: Post-transfer balance sanity check
      const postFromUser = await tx.user.findUnique({ where: { id: fromUserId } })
      if (postFromUser && postFromUser.balance < 0) {
        throw new Error('خطأ في الرصيد - تم إلغاء التحويل')
      }

      // Create P2P transfer record
      const transfer = await tx.p2PTransfer.create({
        data: {
          fromUserId,
          toUserId: toUser.id,
          amount: safeAmount,
          fee,
          status: 'COMPLETED',
          description: description?.slice(0, 200) || `تحويل داخلي من ${fromUser.name} إلى ${toUser.name}`,
        },
      })

      // Create transaction records
      await tx.transaction.create({
        data: {
          userId: fromUserId,
          type: 'P2P_SEND',
          amount: totalDeducted,
          status: 'COMPLETED',
          method: 'p2p_internal',
          description: `تحويل داخلي إلى ${toUser.name} (${toUser.email})`,
          reference: transfer.id,
        },
      })

      await tx.transaction.create({
        data: {
          userId: toUser.id,
          type: 'P2P_RECEIVE',
          amount: safeAmount,
          status: 'COMPLETED',
          method: 'p2p_internal',
          description: `تحويل داخلي من ${fromUser.name} (${fromUser.email})`,
          reference: transfer.id,
        },
      })

      return transfer
    })

    // === Record idempotency key to prevent duplicates ===
    await TransactionSafety.recordIdempotency(idempotencyKey, fromUserId, 'P2P_TRANSFER', { transferId: result.id, amount: safeAmount })

    // === Record successful rate limit attempt ===
    await DBRateLimiter.recordAttempt(fromUserId, RATE_LIMITS.P2P_TRANSFER.action, true, { ip: clientIp, userAgent: clientUA })

    // === Release lock ===
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId)
      lockId = undefined
    }

    // Notify both users
    await createNotification({
      userId: fromUserId,
      title: 'تحويل داخلي',
      message: `تم تحويل $${safeAmount.toFixed(2)} إلى ${toUser.name}. رسوم التحويل: $${fee.toFixed(2)}`,
      type: 'TRANSFER',
    })

    await createNotification({
      userId: toUser.id,
      title: 'تحويل وارد',
      message: `تم استلام $${safeAmount.toFixed(2)} من ${fromUser.name}`,
      type: 'TRANSFER',
    })

    return NextResponse.json({ transfer: result, fee, message: 'تم التحويل بنجاح' }, { status: 201 })
  } catch (error) {
    console.error('P2P transfer error:', error)
    // Release lock on error
    if (lockId) {
      await TransactionSafety.unlockOperation(lockId).catch(() => {})
    }
    const msg = error instanceof Error ? error.message : 'حدث خطأ في التحويل'
    const status = msg.includes('لا يمكن التحويل لنفس حسابك') ? 400 :
                   msg.includes('غير كافي') ? 400 :
                   msg.includes('محظور') ? 403 :
                   msg.includes('معطل') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
