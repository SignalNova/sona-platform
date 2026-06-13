import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { logIntrusionEvent } from '@/lib/security'

// GET: List tickets for the authenticated user only
export async function GET(request: NextRequest) {
  try {
    // ── AUTHENTICATION REQUIRED ──
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // SECURITY: Users can only see their own tickets
    // Admin can see all tickets
    const isAdmin = String(authUser.role).toLowerCase() === 'admin'
    const requestedUserId = searchParams.get('userId')

    // If non-admin tries to access another user's tickets, block it
    if (!isAdmin && requestedUserId && requestedUserId !== String(authUser.id)) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      logIntrusionEvent(ip, 'UNAUTHORIZED_ADMIN_ACCESS', '/api/support/tickets', `User ${authUser.id} attempted to access user ${requestedUserId}'s tickets`)
      return NextResponse.json({ error: 'غير مصرح بالوصول لتذاكر مستخدم آخر' }, { status: 403 })
    }

    const where: Record<string, unknown> = {}

    if (isAdmin && requestedUserId) {
      where.userId = requestedUserId
    } else {
      // Regular users always see only their own tickets
      where.userId = String(authUser.id)
    }

    if (status) {
      where.status = status
    }

    const tickets = await db.supportTicket.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Add unread count for user
    const ticketsWithUnread = tickets.map((ticket) => {
      const unreadCount = ticket.messages.filter(
        (m) => !m.isRead && m.senderType !== 'user'
      ).length
      return { ...ticket, unreadCount }
    })

    return NextResponse.json({ tickets: ticketsWithUnread })
  } catch (error) {
    console.error('Get tickets error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب التذاكر' },
      { status: 500 }
    )
  }
}

// POST: Create a ticket (authenticated users only, for their own account)
export async function POST(request: NextRequest) {
  try {
    // ── AUTHENTICATION REQUIRED ──
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, category, priority } = body

    if (!subject) {
      return NextResponse.json(
        { error: 'الموضوع مطلوب' },
        { status: 400 }
      )
    }

    // Validate subject length
    if (subject.length > 500) {
      return NextResponse.json(
        { error: 'الموضوع طويل جداً. الحد الأقصى 500 حرف.' },
        { status: 400 }
      )
    }

    // SECURITY: Always use authenticated user's ID, ignore any userId from body
    const userId = String(authUser.id)

    const validCategories = ['general', 'deposit', 'withdrawal', 'investment', 'technical', 'referral']
    const validPriorities = ['low', 'medium', 'high']

    const ticket = await db.supportTicket.create({
      data: {
        userId,
        subject,
        category: validCategories.includes(category) ? category : 'general',
        priority: validPriorities.includes(priority) ? priority : 'medium',
        status: 'open',
      },
      include: {
        messages: true,
      },
    })

    return NextResponse.json(
      { message: 'تم إنشاء التذكرة بنجاح', ticket },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create ticket error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء التذكرة' },
      { status: 500 }
    )
  }
}
