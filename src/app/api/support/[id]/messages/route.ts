import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { message, status } = body;

    if (!message && !status) {
      return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });
    }

    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: 'التذكرة غير موجودة' }, { status: 404 });
    }

    if (String(user.role) !== 'ADMIN' && ticket.userId !== String(user.id)) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    if (message) {
      await db.supportMessage.create({
        data: {
          ticketId: id,
          userId: String(user.id),
          senderType: String(user.role) === 'ADMIN' ? 'admin' : 'user',
          content: message,
        },
      });
    }

    if (status) {
      await db.supportTicket.update({
        where: { id },
        data: { status },
      });
    }

    return NextResponse.json({ message: 'تم إرسال الرسالة بنجاح' });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
