import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// Rate limiting: max 30 messages per minute per user
const messageRateLimit = new Map<string, { count: number; resetAt: number }>()

export async function POST(request: NextRequest) {
  try {
    // AUTH: Verify user is authenticated
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ticketId, content, imageUrl } = body

    // Use authenticated user's ID, not from body
    const userId = authUser.id

    if (!ticketId || !content) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // Message length validation
    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'الرسالة طويلة جداً (الحد الأقصى 5000 حرف)' },
        { status: 400 }
      )
    }

    // Rate limiting check
    const now = Date.now()
    const userRate = messageRateLimit.get(userId)
    if (userRate && userRate.resetAt > now && userRate.count >= 30) {
      return NextResponse.json(
        { error: 'ترسل رسائل بسرعة كبيرة، انتظر قليلاً' },
        { status: 429 }
      )
    }
    if (!userRate || userRate.resetAt <= now) {
      messageRateLimit.set(userId, { count: 1, resetAt: now + 60000 })
    } else {
      userRate.count++
    }

    // Verify ticket exists and belongs to authenticated user
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'التذكرة غير موجودة' },
        { status: 404 }
      )
    }

    if (ticket.userId !== userId) {
      return NextResponse.json(
        { error: 'غير مصرح بهذا الإجراء' },
        { status: 403 }
      )
    }

    // XSS check on content
    const xssPatterns = /<script|javascript:|on\w+\s*=|<iframe|<img[^>]+onerror/i
    if (xssPatterns.test(content)) {
      return NextResponse.json(
        { error: 'محتوى غير مسموح به' },
        { status: 400 }
      )
    }

    // Create user message
    const message = await db.supportMessage.create({
      data: {
        ticketId,
        userId,
        senderType: 'user',
        content,
        imageUrl: imageUrl || null,
        isRead: true,
      },
    })

    // Update ticket status to in_progress if it was open or resolved
    if (ticket.status === 'open' || ticket.status === 'resolved') {
      await db.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'in_progress' },
      })
    }

    return NextResponse.json(
      { message: 'تم إرسال الرسالة بنجاح', sentMessage: message },
      { status: 201 }
    )
  } catch (error) {
    console.error('[SUPPORT] Send message error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إرسال الرسالة' },
      { status: 500 }
    )
  }
}
