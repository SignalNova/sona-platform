import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'
import { addToBlacklist, checkBlacklist } from '@/lib/security-fortress'
import { db } from '@/lib/db'

/**
 * GET /api/security/blacklist - Get all blacklist entries
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // USER, IP, EMAIL, or null for all

    const where: any = {}
    if (type && ['USER', 'IP', 'EMAIL'].includes(type)) {
      where.targetType = type
    }

    const entries = await db.blacklistEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Get blacklist API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/**
 * POST /api/security/blacklist - Add entry to blacklist
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { targetType, targetValue, reason, isPermanent } = body

    if (!targetType || !targetValue || !reason) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!['USER', 'IP', 'EMAIL'].includes(targetType)) {
      return NextResponse.json({ error: 'نوع الهدف غير صالح' }, { status: 400 })
    }

    await addToBlacklist(targetType, targetValue, reason, 'admin', isPermanent !== false)

    // If blacklisting a user, also update their account
    if (targetType === 'USER') {
      const user = await db.user.findUnique({ where: { id: targetValue } })
      if (user && user.role?.toLowerCase() !== 'admin') {
        await db.user.update({
          where: { id: targetValue },
          data: {
            isBlacklisted: true,
            blacklistReason: reason,
            blacklistedAt: new Date(),
            monitoringLevel: 'HIGH',
          },
        })
      }
    }

    // Admin audit log
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'ADD_TO_BLACKLIST',
        targetId: targetValue,
        targetType,
        details: reason,
        ipAddress: ip,
      },
    })

    return NextResponse.json({ success: true, message: 'تمت الإضافة للقائمة السوداء' })
  } catch (error) {
    console.error('Add to blacklist API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/**
 * DELETE /api/security/blacklist - Remove from blacklist
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
      return NextResponse.json({ error: 'معرف الإدخال مطلوب' }, { status: 400 })
    }

    await db.blacklistEntry.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'تم الحذف من القائمة السوداء' })
  } catch (error) {
    console.error('Remove from blacklist API error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
