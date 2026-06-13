import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { id } = await params

    // SECURITY: Only allow users to view their own investments, or admins
    if (authUser.id !== id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const investments = await db.investment.findMany({
      where: { userId: id },
      include: {
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate derived fields for each investment
    const now = new Date()
    const enrichedInvestments = investments.map((inv) => {
      const startDate = new Date(inv.startDate)
      const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      // FIX: monthlyReturn is MONTHLY rate. Daily rate = monthlyReturn / 30
      const dailyReturn = (inv.package?.monthlyReturn || 0) / 30
      const dailyProfit = inv.amount * (dailyReturn / 100)

      return {
        id: inv.id,
        amount: inv.amount,
        monthlyProfit: inv.monthlyProfit,
        totalProfit: inv.totalProfit || 0,
        daysElapsed,
        status: inv.status,
        startDate: inv.startDate,
        mode: inv.mode,
        dailyProfit,
        dailyReturn,
        package: {
          id: inv.package?.id,
          name: inv.package?.name || '',
          nameEn: inv.package?.nameEn || '',
          durationDays: inv.package?.durationDays || 30,
          color: inv.package?.color || '#409eff',
          dailyReturn: (inv.package?.monthlyReturn || 0) / 30,
        },
      }
    })

    return NextResponse.json(
      { investments: enrichedInvestments },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get user investments error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الاستثمارات' },
      { status: 500 }
    )
  }
}
