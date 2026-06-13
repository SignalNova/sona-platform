import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH: Verify user is authenticated
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { id } = await params

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { name: true, email: true, balance: true, totalDeposited: true, totalWithdrawn: true, totalProfit: true },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'التذكرة غير موجودة' },
        { status: 404 }
      )
    }

    // AUTH: Verify user owns the ticket or is admin
    if (ticket.userId !== authUser.id && authUser.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول لهذه التذكرة' },
        { status: 403 }
      )
    }

    // Mark bot/admin messages as read when user views the ticket
    await db.supportMessage.updateMany({
      where: {
        ticketId: id,
        senderType: { in: ['admin', 'ai_bot'] },
        isRead: false,
      },
      data: { isRead: true },
    })

    return NextResponse.json({ ticket })
  } catch (error) {
    console.error('[SUPPORT] Get ticket error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب التذكرة' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH: Verify user is authenticated
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'حالة غير صالحة' },
        { status: 400 }
      )
    }

    // Verify ticket exists and user owns it or is admin
    const existingTicket = await db.supportTicket.findUnique({ where: { id } })
    if (!existingTicket) {
      return NextResponse.json(
        { error: 'التذكرة غير موجودة' },
        { status: 404 }
      )
    }

    // Only admin can change status to anything; users can only close their own tickets
    if (authUser.role?.toLowerCase() !== 'admin' && existingTicket.userId !== authUser.id) {
      return NextResponse.json(
        { error: 'غير مصرح بهذا الإجراء' },
        { status: 403 }
      )
    }

    // Regular users can only close/resolve their tickets
    if (authUser.role?.toLowerCase() !== 'admin' && !['closed', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'غير مصرح بتغيير حالة التذكرة لهذه القيمة' },
        { status: 403 }
      )
    }

    const ticket = await db.supportTicket.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({ message: 'تم تحديث التذكرة بنجاح', ticket })
  } catch (error) {
    console.error('[SUPPORT] Update ticket error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث التذكرة' },
      { status: 500 }
    )
  }
}
