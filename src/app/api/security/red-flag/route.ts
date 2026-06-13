import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'
import { issueRedFlag } from '@/lib/security-fortress'
import { db } from '@/lib/db'

/**
 * GET /api/security/red-flag - Get all red flags (admin) or user's red flags
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (userId) {
      // Admin viewing specific user's red flags
      const admin = await getAdminFromRequest(request)
      if (!admin) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
      }

      const flags = await db.redFlag.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, redFlagCount: true, monitoringLevel: true },
      })

      return NextResponse.json({ flags, user })
    }

    // Get all recent red flags (admin)
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const flags = await db.redFlag.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ flags })
  } catch (error) {
    console.error('Get red flags API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/**
 * POST /api/security/red-flag - Issue a red flag to a user
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, reason, reasonCode, ip } = body

    if (!userId || !reason) {
      return NextResponse.json({ error: 'معرف المستخدم والسبب مطلوبان' }, { status: 400 })
    }

    const result = await issueRedFlag({
      userId,
      reason,
      reasonCode: reasonCode || 'ADMIN_FLAG',
      ip,
      source: 'admin',
    })

    // Admin audit log
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'ISSUE_RED_FLAG',
        targetId: userId,
        targetType: 'USER',
        details: `Red flag: ${reason} (action: ${result.action})`,
        ipAddress: clientIp,
      },
    })

    return NextResponse.json({
      success: result.flagged,
      totalFlags: result.totalFlags,
      action: result.action,
      message: result.action === 'AUTO_BANNED'
        ? 'تم حظر الحساب تلقائياً بعد 3 إشارات حمراء'
        : result.action === 'FROZEN'
          ? 'تم تجميد الحساب بعد إشارتين حمراويتين'
          : `تم وضع إشارة حمراء (${result.totalFlags}/3)`,
    })
  } catch (error) {
    console.error('Issue red flag API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/**
 * DELETE /api/security/red-flag - Remove a red flag (admin)
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف الإشارة مطلوب' }, { status: 400 })
    }

    const flag = await db.redFlag.findUnique({ where: { id } })
    if (!flag) {
      return NextResponse.json({ error: 'الإشارة غير موجودة' }, { status: 404 })
    }

    await db.redFlag.delete({ where: { id } })

    // Decrement user's red flag count
    const user = await db.user.findUnique({ where: { id: flag.userId } })
    if (user && user.redFlagCount > 0) {
      await db.user.update({
        where: { id: flag.userId },
        data: {
          redFlagCount: { decrement: 1 },
          monitoringLevel: user.redFlagCount - 1 <= 0 ? 'NORMAL' : user.redFlagCount - 1 === 1 ? 'ELEVATED' : 'HIGH',
        },
      })
    }

    return NextResponse.json({ success: true, message: 'تم حذف الإشارة الحمراء' })
  } catch (error) {
    console.error('Delete red flag API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
