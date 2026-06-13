import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Always use authenticated user's ID - no query param fallback
    const authUser = await getUser()
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const userId = authUser.id

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referredByCode: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Find referrals for this user
    const referrals = await db.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          // SECURITY: Don't expose referral balance
          select: { id: true, name: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalBonus = referrals.reduce((sum, r) => sum + (r.reward || 0), 0)

    return NextResponse.json({
      referralCode: user.referralCode,
      referralBonus: totalBonus,
      totalReferrals: referrals.length,
      referrals: referrals.map(r => ({
        id: r.referred.id,
        name: r.referred.name,
        createdAt: r.referred.createdAt,
        reward: r.reward,
        status: r.status,
      })),
    })
  } catch (error) {
    console.error('Referral error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب بيانات الإحالة' },
      { status: 500 }
    )
  }
}
