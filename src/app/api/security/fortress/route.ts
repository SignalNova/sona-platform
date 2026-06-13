import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'
import { getSecurityFortressData } from '@/lib/security-fortress'

/**
 * GET /api/security/fortress - Get complete security fortress dashboard data
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const data = await getSecurityFortressData()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Get fortress data API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
