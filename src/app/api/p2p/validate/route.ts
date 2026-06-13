import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/p2p/validate?email=xxx
 * Validates if a user exists for P2P transfer (by email)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 })
    }

    // Don't allow transferring to yourself (case-insensitive)
    if (email === user.email?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'لا يمكنك التحويل لنفسك' }, { status: 400 })
    }

    const targetUser = await db.user.findUnique({
      where: { email },
      select: {
        name: true,
        email: true,
        isActive: true,
        avatar: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ valid: false, error: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (!targetUser.isActive) {
      return NextResponse.json({ valid: false, error: 'حساب المستخدم معطل' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      user: {
        name: targetUser.name,
        email: targetUser.email,
        avatar: targetUser.avatar,
      },
    })
  } catch (error) {
    console.error('P2P validate error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
