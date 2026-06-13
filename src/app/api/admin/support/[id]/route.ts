import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../../middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAdminFromRequest(request)
    const { id } = await params

    // Try ticket first
    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (ticket) {
      // Enrich messages with sender info (SupportMessage has no user relation)
      const enrichedMessages = ticket.messages.map((msg) => ({
        ...msg,
        user: msg.senderType === 'admin'
          ? { id: 'admin', name: 'المشرف', role: 'ADMIN' }
          : { id: ticket.user.id, name: ticket.user.name, role: 'USER' },
      }))
      return NextResponse.json({
        ticket: {
          ...ticket,
          status: ticket.status.toUpperCase(), // Normalize to uppercase
          messages: enrichedMessages,
        },
        type: 'ticket',
      }, { status: 200 })
    }

    // Try chat conversation
    const conversation = await db.chatConversation.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true, balance: true, totalDeposited: true, totalWithdrawn: true, totalProfit: true },
        },
        agent: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (conversation) {
      // Enrich chat messages with sender info
      const enrichedMessages = conversation.messages.map((msg) => ({
        ...msg,
        content: msg.message, // Map 'message' field to 'content' for consistency
        user: msg.senderType === 'ADMIN'
          ? { id: 'admin', name: msg.senderName || 'المشرف', role: 'ADMIN' }
          : msg.senderType === 'AI'
          ? { id: 'ai', name: msg.senderName || 'المساعدة الذكية', role: 'AI' }
          : msg.senderType === 'AGENT'
          ? { id: 'agent', name: msg.senderName || 'دعم SONA', role: 'AGENT' }
          : { id: conversation.user.id, name: conversation.user.name, role: 'USER' },
      }))
      return NextResponse.json({
        ticket: {
          ...conversation,
          status: conversation.status.toUpperCase(), // Normalize to uppercase
          messages: enrichedMessages,
        },
        type: 'chat',
      }, { status: 200 })
    }

    return NextResponse.json(
      { error: 'التذكرة غير موجودة' },
      { status: 404 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin get ticket error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب التذكرة' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    const { id } = await params

    const body = await request.json()
    const { content, imageUrl } = body

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: 'محتوى الرسالة مطلوب' },
        { status: 400 }
      )
    }

    // Try ticket first
    const ticket = await db.supportTicket.findUnique({ where: { id } })

    if (ticket) {
      const message = await db.supportMessage.create({
        data: {
          ticketId: id,
          userId: admin.id,
          senderType: 'admin',
          content: content?.trim() || '',
        },
      })

      if (ticket.status === 'open') {
        await db.supportTicket.update({
          where: { id },
          data: { status: 'in_progress' },
        })
      }

      return NextResponse.json({
        message: 'تم إرسال الرسالة بنجاح',
        msg: message,
      }, { status: 201 })
    }

    // Try chat conversation
    const conversation = await db.chatConversation.findUnique({ where: { id } })

    if (conversation) {
      const chatMsg = await db.chatMessage.create({
        data: {
          conversationId: id,
          senderType: 'ADMIN',
          senderId: admin.id,
          senderName: 'دعم SONA المباشر',
          message: content?.trim() || '',
          imageUrl: imageUrl || null,
          isRead: false,
          metadata: JSON.stringify({ level: 3 }),
        }
      })

      // Update conversation timestamp
      await db.chatConversation.update({
        where: { id },
        data: { updatedAt: new Date() }
      })

      return NextResponse.json({
        message: 'تم إرسال الرسالة بنجاح',
        msg: chatMsg,
      }, { status: 201 })
    }

    return NextResponse.json(
      { error: 'المحادثة غير موجودة' },
      { status: 404 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin send message error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إرسال الرسالة' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAdminFromRequest(request)
    const { id } = await params

    const body = await request.json()
    const { status } = body

    // Try ticket first
    const ticket = await db.supportTicket.findUnique({ where: { id } })

    if (ticket) {
      const updateData: Record<string, unknown> = {}
      if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        updateData.status = status
      }

      const updatedTicket = await db.supportTicket.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({
        message: 'تم تحديث التذكرة بنجاح',
        ticket: updatedTicket,
      }, { status: 200 })
    }

    // Try chat conversation
    const conversation = await db.chatConversation.findUnique({ where: { id } })

    if (conversation) {
      const updateData: Record<string, unknown> = {}
      if (status) {
        updateData.status = status.toUpperCase()
      }

      const updated = await db.chatConversation.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({
        message: 'تم تحديث المحادثة بنجاح',
        ticket: updated,
      }, { status: 200 })
    }

    return NextResponse.json(
      { error: 'العنصر غير موجود' },
      { status: 404 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin update ticket error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحديث' },
      { status: 500 }
    )
  }
}
