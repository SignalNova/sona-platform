import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

type NotificationType = 'custom' | 'system_update' | 'promotion' | 'warning'

/**
 * POST /api/admin/notifications
 * Send notification to specific user or broadcast to all users.
 * Support: in-app notification (email if SMTP available in future).
 *
 * Body:
 *   - userId?: string        (if provided, send to specific user)
 *   - broadcast?: boolean    (if true, send to all active users)
 *   - type: NotificationType (custom, system_update, promotion, warning)
 *   - title: string
 *   - message: string
 *   - data?: Record<string, unknown>
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح - يتطلب صلاحيات المدير' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, broadcast, type, title, message, data } = body as {
      userId?: string
      broadcast?: boolean
      type?: NotificationType
      title?: string
      message?: string
      data?: Record<string, unknown>
    }

    // Validate required fields
    if (!title || !message) {
      return NextResponse.json(
        { error: 'العنوان والرسالة مطلوبان' },
        { status: 400 }
      )
    }

    const validTypes: NotificationType[] = ['custom', 'system_update', 'promotion', 'warning']
    const notificationType: NotificationType = validTypes.includes(type as NotificationType) ? (type as NotificationType) : 'custom'

    const typeLabels: Record<NotificationType, string> = {
      'custom': 'مخصص',
      'system_update': 'تحديث النظام',
      'promotion': 'عرض ترويجي',
      'warning': 'تحذير',
    }

    if (broadcast) {
      // Send to all active users
      const users = await db.user.findMany({
        where: { isActive: true },
        select: { id: true },
      })

      // SECURITY: Batch notifications in chunks to prevent OOM/timeout
      const BATCH_SIZE = 500
      let totalCreated = 0
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE)
        const result = await db.$transaction(
          batch.map((u) =>
            db.notification.create({
              data: {
                userId: u.id,
                title,
                message,
                type: notificationType.toUpperCase(),
                data: data ? JSON.stringify(data) : null,
              },
            })
          )
        )
        totalCreated += result.length
      }

      // Log admin action
      await db.platformLog.create({
        data: {
          action: 'BROADCAST_NOTIFICATION',
          details: JSON.stringify({
            adminId: admin.id || 'unknown',
            type: notificationType,
            title,
            userCount: users.length,
          }),
        },
      })

      return NextResponse.json({
        message: `تم إرسال إشعار ${typeLabels[notificationType]} إلى ${users.length} مستخدم`,
        count: totalCreated,
        type: notificationType,
      }, { status: 201 })
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'يجب تحديد مستخدم أو تفعيل البث العام' },
        { status: 400 }
      )
    }

    // Verify user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId,
        title,
        message,
        type: notificationType.toUpperCase(),
        data: data ? JSON.stringify(data) : null,
      },
    })

    // Log admin action
    await db.platformLog.create({
      data: {
        action: 'SEND_NOTIFICATION',
        details: JSON.stringify({
          adminId: admin.id || 'unknown',
          userId,
          type: notificationType,
          title,
        }),
      },
    })

    return NextResponse.json({
      message: `تم إرسال الإشعار إلى المستخدم بنجاح`,
      notification,
      type: notificationType,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin notification error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إرسال الإشعار' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/notifications
 * Get notification history (recent admin-sent notifications).
 */
export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const type = searchParams.get('type')

    const where: { type?: string } = {}
    if (type) {
      where.type = type.toUpperCase()
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.notification.count({ where }),
    ])

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin get notifications error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإشعارات' },
      { status: 500 }
    )
  }
}
