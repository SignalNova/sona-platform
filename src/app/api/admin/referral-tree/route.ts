import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

// GET: Get referral tree
export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || ''
    const depth = parseInt(searchParams.get('depth') || '5')

    async function buildTree(uid: string, currentDepth: number): Promise<any> {
      if (currentDepth > depth) return null

      const user = await db.user.findUnique({
        where: { id: uid },
        select: { id: true, name: true, email: true, balance: true, totalDeposited: true, referralCode: true, createdAt: true }
      })
      if (!user) return null

      const referrals = await db.referral.findMany({
        where: { referrerId: uid },
        include: { referred: { select: { id: true, name: true, email: true, balance: true, totalDeposited: true, createdAt: true } } }
      })

      const children = []
      for (const ref of referrals) {
        const child = await buildTree(ref.referredId, currentDepth + 1)
        if (child) {
          child.reward = ref.reward
          child.rewardStatus = ref.status
          child.referredAt = ref.createdAt
          children.push(child)
        }
      }

      return { ...user, children, referralCount: referrals.length, totalReferralDeposits: referrals.reduce((sum, r) => sum + (r.referred.totalDeposited || 0), 0) }
    }

    // If userId specified, build tree from that user; otherwise get top referrers
    if (userId) {
      const tree = await buildTree(userId, 0)
      return NextResponse.json({ tree })
    }

    // Get top referrers
    const topReferrers = await db.referral.groupBy({
      by: ['referrerId'],
      _count: { id: true },
      _sum: { reward: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    })

    const referrerDetails = await Promise.all(
      topReferrers.map(async (r) => {
        const user = await db.user.findUnique({ where: { id: r.referrerId }, select: { id: true, name: true, email: true, balance: true, referralCode: true } })
        return { ...user, referralCount: r._count.id, totalRewards: r._sum.reward || 0 }
      })
    )

    return NextResponse.json({ topReferrers: referrerDetails })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
