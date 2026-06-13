import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { AdminMFA } from '@/lib/admin-mfa'

/**
 * POST /api/admin/mfa
 * Generate an MFA challenge for a critical admin action.
 *
 * Body: { action: string }
 * Response: { challengeId: string, token: string, expiresAt: number }
 *
 * For admins with TOTP enabled, they must provide their authenticator code.
 * For admins without TOTP, a one-time code is generated and returned.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)

    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json(
        { error: 'نوع الإجراء مطلوب' },
        { status: 400 }
      )
    }

    if (!AdminMFA.requiresMFA(action)) {
      return NextResponse.json(
        { error: 'هذا الإجراء لا يتطلب تحقق MFA' },
        { status: 400 }
      )
    }

    const challenge = await AdminMFA.generateChallenge(String(admin.id), action)

    return NextResponse.json({
      challengeId: challenge.challengeId,
      token: challenge.token,
      expiresAt: challenge.expiresAt,
      action: challenge.action,
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('MFA challenge generation error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء تحقق MFA' },
      { status: 500 }
    )
  }
}
