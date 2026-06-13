import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'
import { performDeepAccountScan } from '@/lib/security-fortress'

/**
 * POST /api/security/scan - Perform deep scan on a user account
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, freezeId } = body

    if (!userId) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const result = await performDeepAccountScan(userId, freezeId)

    return NextResponse.json({
      success: true,
      riskScore: result.riskScore,
      platformDamage: result.platformDamage,
      recommendation: result.recommendation,
      details: result.details,
    })
  } catch (error) {
    console.error('Deep scan API error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الفحص' }, { status: 500 })
  }
}
