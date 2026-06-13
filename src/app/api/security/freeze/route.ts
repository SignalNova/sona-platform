import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'
import { freezeAccount, processFreezeCompletion, banAccount } from '@/lib/security-fortress'
import { db } from '@/lib/db'

/**
 * POST /api/security/freeze - Freeze a user account for 3 days
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, reason } = body

    if (!userId || !reason) {
      return NextResponse.json({ error: 'معرف المستخدم والسبب مطلوبان' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown'

    const result = await freezeAccount({
      userId,
      reason,
      frozenBy: admin.id,
      ip,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    // Admin audit log
    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'FREEZE_ACCOUNT',
        targetId: userId,
        targetType: 'USER',
        details: `Frozen account for 3 days: ${reason}`,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ success: true, message: result.message, freezeId: result.freezeId })
  } catch (error) {
    console.error('Freeze account API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/**
 * POST with action=unfreeze - Manually unfreeze an account
 * POST with action=complete - Process freeze completion (auto scan)
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { action, freezeId, userId } = body

    if (action === 'complete' && freezeId) {
      const result = await processFreezeCompletion(freezeId)
      return NextResponse.json({ success: true, action: result.action, message: result.message })
    }

    if (action === 'unfreeze' && userId) {
      // Manual unfreeze by admin - still add to blacklist
      await db.user.update({
        where: { id: userId },
        data: {
          isFrozen: false,
          frozenUntil: null,
          freezeReason: null,
          isBlacklisted: true,
          blacklistReason: 'تم تجميد مسبقاً وفك يدوياً',
          blacklistedAt: new Date(),
          monitoringLevel: 'HIGH',
          tokenVersion: { increment: 1 },
        },
      })

      return NextResponse.json({ success: true, message: 'تم فك التجميد مع مراقبة مشددة' })
    }

    if (action === 'ban' && userId) {
      const result = await banAccount(userId, 'حظر يدوي من المشرف بعد التجميد', admin.id)
      return NextResponse.json({ success: result.success, message: result.success ? 'تم حظر الحساب' : 'فشل حظر الحساب' })
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
  } catch (error) {
    console.error('Freeze action API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
