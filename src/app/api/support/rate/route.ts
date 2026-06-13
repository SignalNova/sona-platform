import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// POST: Rate a conversation after resolution
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { conversationId, rating, comment } = await req.json()

    if (!conversationId || !rating) {
      return NextResponse.json({ error: 'معرف المحادثة والتقييم مطلوبان' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'التقييم يجب أن يكون بين 1 و 5' }, { status: 400 })
    }

    const conversation = await db.chatConversation.findFirst({
      where: { id: conversationId, userId: String(user.id) }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 })
    }

    await db.chatConversation.update({
      where: { id: conversationId },
      data: {
        rating,
        ratingComment: comment || null,
        status: 'CLOSED',
        resolvedAt: new Date(),
      }
    })

    const ratingLabels: Record<number, string> = {
      5: 'ممتاز',
      4: 'جيد جداً',
      3: 'جيد',
      2: 'مقبول',
      1: 'سيئ',
    }

    await db.chatMessage.create({
      data: {
        conversationId,
        senderType: 'AI',
        senderId: 'system',
        senderName: 'فريق دعم SONA',
        message: `شكراً لتقييمك! تقييمك: ${ratingLabels[rating] || ''}\n\n${rating >= 4 ? 'يسعدنا أن تجربتك كانت إيجابية! لا تتردد في التواصل معنا متى احتجت مساعدة' : rating >= 3 ? 'شكراً لملاحظاتك! سنعمل على تحسين خدماتنا لتكون تجربتك القادمة أفضل' : 'نعتذر عن أي إزعاج. سنراجع محادثتك ونحسن من جودة خدمتنا'}`,
        isRead: false,
        metadata: JSON.stringify({ type: 'rating_thank_you', rating }),
      }
    })

    return NextResponse.json({ success: true, message: 'تم حفظ التقييم بنجاح' })
  } catch (error) {
    console.error('Rating error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
