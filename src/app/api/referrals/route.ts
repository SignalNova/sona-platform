import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const referrals = await prisma.referral.findMany({
      where: { referrerId: user.id },
      include: { referred: { select: { name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const totalReferrals = referrals.length
    const totalReward = referrals.reduce((sum, r) => sum + r.reward, 0)

    // Count ALL referral-related transactions for accurate total
    const referralTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        OR: [
          { type: 'REFERRAL_BONUS' },
          { type: 'PROFIT', description: { contains: 'إحالة' } },
          { type: 'PROFIT', description: { contains: 'referral' } },
        ]
      },
    })
    const totalEarnedFromReferrals = referralTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)

    return NextResponse.json({ 
      referrals, 
      totalReferrals, 
      totalReward: Math.max(totalReward, totalEarnedFromReferrals), 
      referralCode: user.referralCode,
      commissionRate: 15, // 15% commission on investment
    })
  } catch (error) {
    console.error('Referrals error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
