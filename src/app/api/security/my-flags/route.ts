import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getUserRedFlags } from '@/lib/security-fortress'
import { db } from '@/lib/db'

/**
 * GET /api/security/my-flags - Get current user's red flags and freeze status
 * User can see their own red flags with reasons
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول' }, { status: 401 })
    }

    const [redFlags, freezeStatus] = await Promise.all([
      getUserRedFlags(user.id),
      db.user.findUnique({
        where: { id: user.id },
        select: {
          isFrozen: true,
          frozenUntil: true,
          freezeReason: true,
          isBlacklisted: true,
          redFlagCount: true,
          monitoringLevel: true,
          vpnDetected: true,
        },
      }),
    ])

    return NextResponse.json({
      redFlags,
      status: freezeStatus,
      maxFlagsBeforeBan: 3,
    })
  } catch (error) {
    console.error('Get my flags API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
