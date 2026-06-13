import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/balance/reconcile
 * SECURITY FIX: Reconcile balance based on ACTUAL transaction history, not just balance.
 * This prevents exploiters from inflating their withdrawable balance.
 * 
 * Formula: balance = totalDeposited + totalProfits + totalP2PReceived - totalWithdrawn - totalP2PSent - totalInvested
 *          withdrawableBalance = balance - lockedCapital
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    // SECURITY: Calculate TRUE balance from transaction history
    // This is the source of truth, NOT the stored balance field
    
    // Total deposits (COMPLETED only)
    const depositResult = await db.transaction.aggregate({
      where: { userId, type: 'DEPOSIT', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalDeposited = depositResult._sum.amount || 0

    // Total profits distributed (COMPLETED only)
    const profitResult = await db.transaction.aggregate({
      where: { userId, type: 'PROFIT', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalProfits = profitResult._sum.amount || 0

    // Total P2P received (COMPLETED only)
    const p2pReceivedResult = await db.transaction.aggregate({
      where: { userId, type: 'P2P_RECEIVE', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalP2PReceived = p2pReceivedResult._sum.amount || 0

    // Total P2P sent (COMPLETED only)
    const p2pSentResult = await db.transaction.aggregate({
      where: { userId, type: 'P2P_SEND', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalP2PSent = p2pSentResult._sum.amount || 0

    // Total withdrawals (all non-failed states)
    const withdrawnResult = await db.transaction.aggregate({
      where: {
        userId,
        type: 'WITHDRAWAL',
        status: { in: ['COMPLETED', 'PROCESSING', 'PENDING'] },
      },
      _sum: { amount: true },
    })
    const totalWithdrawn = withdrawnResult._sum.amount || 0

    // Total invested (COMPLETED investments)
    const investedResult = await db.transaction.aggregate({
      where: { userId, type: 'INVESTMENT', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalInvested = investedResult._sum.amount || 0

    // Total reinvested
    const reinvestResult = await db.transaction.aggregate({
      where: { userId, type: 'REINVEST', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalReinvested = reinvestResult._sum.amount || 0

    // Referral rewards
    const referralResult = await db.transaction.aggregate({
      where: { userId, type: 'REFERRAL', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalReferral = referralResult._sum.amount || 0

    // Admin adjustments
    const adminAdjResult = await db.transaction.aggregate({
      where: { userId, type: 'ADMIN_CREDIT', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const totalAdminCredit = adminAdjResult._sum.amount || 0

    // SECURITY: Calculate TRUE balance from transaction history
    const calculatedBalance = 
      totalDeposited + 
      totalProfits + 
      totalP2PReceived + 
      totalReferral + 
      totalAdminCredit - 
      totalWithdrawn - 
      totalP2PSent - 
      totalInvested - 
      totalReinvested

    // The correct balance should NEVER exceed what transaction history shows
    // If stored balance > calculated, someone exploited a bug
    const correctBalance = Math.max(0, calculatedBalance)
    const correctWithdrawableBalance = Math.max(0, correctBalance - user.lockedCapital)

    // SECURITY: Detect balance inflation (stored > calculated)
    const balanceInflated = user.balance > calculatedBalance + 1 // tolerance of $1 for floating point
    
    if (balanceInflated) {
      console.warn(`[RECONCILE SECURITY] User ${userId} has INFLATED balance! Stored: ${user.balance}, Calculated: ${calculatedBalance}. Correcting...`)
    }

    const oldWithdrawable = user.withdrawableBalance
    const oldBalance = user.balance

    // SECURITY: Always correct to the TRUE calculated balance
    await db.user.update({
      where: { id: userId },
      data: {
        balance: correctBalance,
        withdrawableBalance: correctWithdrawableBalance,
        totalDeposited: Math.max(user.totalDeposited, totalDeposited),
        totalWithdrawn: Math.max(user.totalWithdrawn, totalWithdrawn),
        totalProfit: Math.max(user.totalProfit, totalProfits),
      },
    })

    console.log(`[RECONCILE] User ${userId}: balance ${oldBalance} -> ${correctBalance}, withdrawable ${oldWithdrawable} -> ${correctWithdrawableBalance}, inflated=${balanceInflated}`)

    return NextResponse.json({
      message: balanceInflated 
        ? 'تم تصحيح الرصيد بنجاح (تم اكتشاف و إصلاح تضخم في الرصيد)' 
        : 'تم تسوية الرصيد بنجاح',
      before: {
        balance: oldBalance,
        withdrawableBalance: oldWithdrawable,
      },
      after: {
        balance: correctBalance,
        withdrawableBalance: correctWithdrawableBalance,
      },
      breakdown: {
        totalDeposited,
        totalProfits,
        totalP2PReceived,
        totalReferral,
        totalAdminCredit,
        totalWithdrawn,
        totalP2PSent,
        totalInvested,
        totalReinvested,
        calculatedBalance,
        wasInflated: balanceInflated,
      },
    })
  } catch (error) {
    console.error('Balance reconcile error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسوية الرصيد' }, { status: 500 })
  }
}

/**
 * GET /api/balance/reconcile
 * Returns the current balance breakdown without making any changes.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Calculate from transactions
    const [depositResult, profitResult, p2pReceivedResult, p2pSentResult, withdrawnResult, investedResult] = await Promise.all([
      db.transaction.aggregate({ where: { userId, type: 'DEPOSIT', status: 'COMPLETED' }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { userId, type: 'PROFIT', status: 'COMPLETED' }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { userId, type: 'P2P_RECEIVE', status: 'COMPLETED' }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { userId, type: 'P2P_SEND', status: 'COMPLETED' }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { userId, type: 'WITHDRAWAL', status: { in: ['COMPLETED', 'PROCESSING', 'PENDING'] } }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { userId, type: 'INVESTMENT', status: 'COMPLETED' }, _sum: { amount: true } }),
    ])

    const totalDeposited = depositResult._sum.amount || 0
    const totalProfits = profitResult._sum.amount || 0
    const totalP2PReceived = p2pReceivedResult._sum.amount || 0
    const totalP2PSent = p2pSentResult._sum.amount || 0
    const totalWithdrawn = withdrawnResult._sum.amount || 0
    const totalInvested = investedResult._sum.amount || 0

    const calculatedBalance = totalDeposited + totalProfits + totalP2PReceived - totalWithdrawn - totalP2PSent - totalInvested

    return NextResponse.json({
      current: {
        balance: user.balance,
        withdrawableBalance: user.withdrawableBalance,
        lockedCapital: user.lockedCapital,
        totalProfit: user.totalProfit,
        totalDeposited: user.totalDeposited,
        totalWithdrawn: user.totalWithdrawn,
      },
      calculated: {
        totalDeposited,
        totalProfits,
        totalP2PReceived,
        totalP2PSent,
        totalWithdrawn,
        totalInvested,
        expectedBalance: calculatedBalance,
      },
      isConsistent: Math.abs(user.balance - calculatedBalance) < 1,
    })
  } catch (error) {
    console.error('Balance check error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
