import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'
import { autoDetectSuspiciousUsers } from '@/lib/security-fortress'

/**
 * POST /api/security/auto-detect - Run automatic suspicious user detection
 * Admin only / Cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Allow cron jobs with proper auth
    const xInternal = request.headers.get('x-internal')
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (xInternal === 'true' && cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Cron job auth - proceed
    } else {
      // Admin auth
      const admin = await getAdminFromRequest(request)
      if (!admin) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
      }
    }

    const result = await autoDetectSuspiciousUsers()

    return NextResponse.json({
      success: true,
      detected: result.detected,
      actions: result.actions,
    })
  } catch (error) {
    console.error('Auto detect API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
