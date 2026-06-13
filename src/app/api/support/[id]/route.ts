import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = await params;

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'التذكرة غير موجودة' }, { status: 404 });
    }

    if (String(user.role) !== 'ADMIN' && ticket.userId !== String(user.id)) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // Enrich messages with sender info
    const enrichedMessages = ticket.messages.map((msg) => ({
      ...msg,
      isAdmin: msg.senderType === 'admin',
      user: msg.senderType === 'admin'
        ? { id: 'admin', name: 'المشرف', role: 'ADMIN' }
        : { id: ticket.user.id, name: ticket.user.name, role: 'USER' },
    }));

    return NextResponse.json({
      ticket: {
        ...ticket,
        messages: enrichedMessages,
      },
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
