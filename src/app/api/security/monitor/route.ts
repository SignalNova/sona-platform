import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Use centralized auth module - no fallback secrets
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'مطلوب مصادقة' }, { status: 401 })
    }

    if (authUser.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات المشرف مطلوبة' }, { status: 403 })
    }

    // Get real security data from database
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsersToday,
      recentTransactions,
      pendingDeposits,
      pendingWithdrawals,
      failedLogins,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { updatedAt: { gte: oneDayAgo } } }),
      db.transaction.count({ where: { createdAt: { gte: oneHourAgo } } }),
      db.transaction.count({ where: { type: 'DEPOSIT', status: 'PENDING' } }),
      db.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
      db.transaction.count({ where: { status: 'FAILED', createdAt: { gte: oneDayAgo } } }),
    ])

    // Calculate threat level
    let threatLevel = 'low'
    let threatScore = 0
    if (failedLogins > 10) { threatScore += 30 }
    if (pendingWithdrawals > 5) { threatScore += 20 }
    if (recentTransactions > 100) { threatScore += 15 }
    if (threatScore > 50) threatLevel = 'high'
    else if (threatScore > 25) threatLevel = 'medium'

    return NextResponse.json({
      status: 'operational',
      threatLevel,
      threatScore,
      stats: {
        totalUsers,
        activeUsersToday,
        recentTransactions,
        pendingDeposits,
        pendingWithdrawals,
        failedLogins,
      },
      alerts: [],
      lastChecked: now.toISOString(),
    })
  } catch (error) {
    console.error('Security monitor error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في مراقبة الأمان' },
      { status: 500 }
    )
  }
}
