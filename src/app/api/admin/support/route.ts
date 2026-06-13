import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const source = searchParams.get('source') || 'all' // 'tickets', 'chats', 'all'

    const skip = (page - 1) * limit
    const results: any[] = []

    // Normalize status for consistent filtering
    const normalizedStatus = status ? status.toLowerCase() : ''

    // Get ticket-based support
    if (source === 'all' || source === 'tickets') {
      const ticketWhere: Record<string, unknown> = {}
      if (normalizedStatus) ticketWhere.status = normalizedStatus

      const tickets = await db.supportTicket.findMany({
        where: ticketWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true, isActive: true },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: source === 'tickets' ? skip : 0,
        take: source === 'tickets' ? limit : 10,
      })

      results.push(...tickets.map((t) => ({
        id: t.id,
        userId: t.userId,
        subject: t.subject,
        status: t.status.toUpperCase(), // Normalize to uppercase
        priority: t.priority,
        category: t.category,
        type: 'ticket' as const,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        user: t.user,
        messageCount: t._count.messages,
      })))
    }

    // Get chat-based support (hybrid system)
    if (source === 'all' || source === 'chats') {
      const chatWhere: Record<string, unknown> = {}
      if (normalizedStatus) chatWhere.status = normalizedStatus.toUpperCase()

      const chats = await db.chatConversation.findMany({
        where: chatWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true, isActive: true },
          },
          agent: {
            select: { id: true, name: true, title: true, specialty: true },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: source === 'chats' ? skip : 0,
        take: source === 'chats' ? limit : 10,
      })

      results.push(...chats.map((c) => ({
        id: c.id,
        userId: c.userId,
        subject: c.isAiActive ? 'محادثة مع المساعدة الذكية' : 'محادثة مع دعم SONA',
        status: c.status.toUpperCase(), // Normalize to uppercase
        priority: c.isAiActive ? 'low' : 'high',
        category: c.isAiActive ? 'ai_chat' : 'human_chat',
        type: 'chat' as const,
        isAiActive: c.isAiActive,
        handoffReason: c.handoffReason,
        agent: c.agent,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: c.user,
        messageCount: c._count.messages,
      })))
    }

    // Sort by most recent
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    const total = results.length
    const paginatedResults = results.slice(skip, skip + limit)

    return NextResponse.json({
      tickets: paginatedResults,
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
    console.error('Admin support list error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب تذاكر الدعم' },
      { status: 500 }
    )
  }
}
