import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/notifications
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Always use authenticated user's ID - no query param fallback
    const authUser = await getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const userId = authUser.id

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST /api/notifications - Create notification (admin or system)
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Only admin users can create/broadcast notifications
    const authUser = await getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (authUser.role !== 'ADMIN' && authUser.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح - يتطلب صلاحيات المدير' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, type, title, message, data, broadcast, target } = body

    if (broadcast) {
      // Build filter based on target group
      let whereClause: Record<string, unknown> = {}

      switch (target) {
        case 'active':
          whereClause = { isActive: true }
          break
        case 'inactive':
          whereClause = { isActive: false }
          break
        case 'verified':
          whereClause = { emailVerified: true }
          break
        case 'unverified':
          whereClause = { emailVerified: false }
          break
        default:
          // 'all' - send to all active users (default behavior)
          whereClause = { isActive: true }
          break
      }

      const users = await db.user.findMany({
        where: whereClause,
        select: { id: true },
      })

      // SECURITY: Batch notifications in chunks to prevent OOM/timeout
      const BATCH_SIZE = 500
      let totalCreated = 0
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE)
        const result = await db.$transaction(
          batch.map(u =>
            db.notification.create({
              data: {
                userId: u.id,
                type: type || 'PLATFORM',
                title: title || 'إشعار من المنصة',
                message: message || '',
                data: data ? JSON.stringify(data) : null,
              },
            })
          )
        )
        totalCreated += result.length
      }

      return NextResponse.json({ message: `تم إرسال إشعار إلى ${users.length} مستخدم`, count: totalCreated }, { status: 201 })
    }

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const notification = await db.notification.create({
      data: {
        userId,
        type: type || 'PLATFORM',
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// PATCH /api/notifications - Mark as read
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId, markAllRead } = body

    if (markAllRead) {
      await db.notification.updateMany({
        where: { userId: authUser.id, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ message: 'تم تعليم الكل كمقروء' })
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'معرف الإشعار مطلوب' }, { status: 400 })
    }

    // SECURITY: Only allow marking own notifications as read
    const notification = await db.notification.findUnique({ where: { id: notificationId } })
    if (!notification || notification.userId !== authUser.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })

    return NextResponse.json({ message: 'تم التعليم كمقروء' })
  } catch (error) {
    console.error('Notifications PATCH error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// DELETE /api/notifications
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')

    if (!notificationId) {
      return NextResponse.json({ error: 'معرف الإشعار مطلوب' }, { status: 400 })
    }

    // SECURITY: Only allow deleting own notifications
    const notification = await db.notification.findUnique({ where: { id: notificationId } })
    if (!notification || notification.userId !== authUser.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    await db.notification.delete({ where: { id: notificationId } })
    return NextResponse.json({ message: 'تم حذف الإشعار' })
  } catch (error) {
    console.error('Notifications DELETE error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
