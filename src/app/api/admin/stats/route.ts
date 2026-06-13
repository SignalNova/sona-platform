import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Total users
    const totalUsers = await db.user.count()

    // Active users
    const activeUsers = await db.user.count({
      where: { isActive: true },
    })

    // Total deposits (completed)
    const depositAgg = await db.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'COMPLETED' },
      _sum: { amount: true },
    })

    // Total withdrawals (completed/processing)
    const withdrawAgg = await db.transaction.aggregate({
      where: { type: 'WITHDRAWAL', status: { in: ['COMPLETED', 'PROCESSING'] } },
      _sum: { amount: true },
    })

    // Total profits distributed
    const profitAgg = await db.investment.aggregate({
      _sum: { totalProfit: true },
    })

    // Active investments count
    const activeInvestments = await db.investment.count({
      where: { status: 'ACTIVE' },
    })

    // Pending deposits count
    const pendingDeposits = await db.transaction.count({
      where: { type: 'DEPOSIT', status: 'PENDING' },
    })

    // Pending withdrawals count
    const pendingWithdrawals = await db.transaction.count({
      where: { type: 'WITHDRAWAL', status: 'PENDING' },
    })

    // Total balance across all users
    const balanceAgg = await db.user.aggregate({
      _sum: { balance: true },
    })

    // New users today
    const newUsersToday = await db.user.count({
      where: { createdAt: { gte: todayStart } },
    })

    // New users this week
    const newUsersThisWeek = await db.user.count({
      where: { createdAt: { gte: weekStart } },
    })

    // New users this month
    const newUsersThisMonth = await db.user.count({
      where: { createdAt: { gte: monthStart } },
    })

    // Deposits today
    const depositsToday = await db.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { amount: true },
    })

    // Withdrawals today
    const withdrawalsToday = await db.transaction.aggregate({
      where: { type: 'WITHDRAWAL', status: { in: ['COMPLETED', 'PROCESSING'] }, createdAt: { gte: todayStart } },
      _sum: { amount: true },
    })

    // Total investments amount
    const investmentsAgg = await db.investment.aggregate({
      _sum: { amount: true },
    })

    // Revenue (platform profit = total deposits - total withdrawals - user balances)
    const totalDeposits = depositAgg._sum.amount || 0
    const totalWithdrawals = withdrawAgg._sum.amount || 0
    const totalBalance = balanceAgg._sum.balance || 0

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalDeposits,
        totalWithdrawals,
        totalProfitsDistributed: profitAgg._sum.totalProfit || 0,
        activeInvestments,
        totalInvestmentsAmount: investmentsAgg._sum.amount || 0,
        pendingDeposits,
        pendingWithdrawals,
        totalBalance,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        depositsToday: depositsToday._sum.amount || 0,
        withdrawalsToday: withdrawalsToday._sum.amount || 0,
        revenue: totalDeposits - totalWithdrawals - totalBalance,
        // Dual-mode stats
        sonaInvestments: await db.investment.count({ where: { mode: 'SONA', status: 'ACTIVE' } }),
        totalWithdrawableBalance: (await db.user.aggregate({ _sum: { withdrawableBalance: true } }))._sum.withdrawableBalance || 0,
        totalNonWithdrawableProfit: (await db.user.aggregate({ _sum: { nonWithdrawableProfit: true } }))._sum.nonWithdrawableProfit || 0,
        totalLockedCapital: (await db.user.aggregate({ _sum: { lockedCapital: true } }))._sum.lockedCapital || 0,
        platformCommission: (await db.pool.aggregate({ _sum: { platformCommission: true } }))._sum.platformCommission || 0,
      },
    }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات' },
      { status: 500 }
    )
  }
}
