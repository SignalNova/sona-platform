import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ===== DE-ESCALATE CONVERSATION =====
// Returns the conversation to level 1 (المساعدة الذكية) from level 2 or 3
// This happens when:
// 1. The user's problem is resolved (confirmed by user)
// 2. 30 minutes of inactivity (auto de-escalation)
// 3. User explicitly requests to return to level 1

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { conversationId, reason, showRating } = await req.json()
    if (!conversationId) return NextResponse.json({ error: 'معرف المحادثة مطلوب' }, { status: 400 })

    const conversation = await db.chatConversation.findFirst({
      where: { id: conversationId, userId: String(user.id) },
    })

    if (!conversation) return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 })

    const currentLevel = conversation.supportLevel || 1
    if (currentLevel <= 1) {
      return NextResponse.json({ error: 'المحادثة بالمستوى الأول بالفعل' }, { status: 400 })
    }

    const L1_NAME = 'المساعدة الذكية'

    // De-escalation messages based on previous level
    const DE_ESCALATION_MSGS: Record<number, string[]> = {
      2: [
        'تم حل الموضوع — رجعت للمساعدة الذكية. لو بتحاج شي تاني أنا هون!',
        'خلاص، كل شي تمام — رجعت لفريق المساعدة الذكية. أي وقت بتحاج شي!',
        'الحمدلله انحلت — رجعنا للمساعدة الذكية. لو عندك شي تاني قولي!',
      ],
      3: [
        'تم حل الموضوع — رجعت للمساعدة الذكية. شكراً لصبرك!',
        'الحمدلله كل شي اضبط — رجعت للمساعدة الذكية. أي شي تحتاج أنا هون!',
        'خلاص، المشكلة انحلت — رجعنا للمستوى العادي. لو بتحاج أي شي قولي!',
      ],
    }

    const AUTO_DE_ESCALATION_MSGS: Record<number, string[]> = {
      2: [
        'ما سمعت منك فترة — بنرجعك للمساعدة الذكية. لو بتحاج شي تاني تواصل معنا!',
        'مر وقت بدون رد — رجعنا للمساعدة الذكية. أي وقت بدك تتواصل نحن هون!',
      ],
      3: [
        'مر فترة بدون رد — بنرجعك للمساعدة الذكية. لو المشكلة رجعت تواصل معنا!',
        'ما سمعنا منك — رجعنا للمساعدة الذكية. نحن هون لو بتحاج أي شي!',
      ],
    }

    const isAutoDeEscalation = reason === 'inactivity'
    const msgs = isAutoDeEscalation ? AUTO_DE_ESCALATION_MSGS : DE_ESCALATION_MSGS
    const deEscalationMsg = msgs[currentLevel]?.[Math.floor(Math.random() * (msgs[currentLevel]?.length || 1))] || 'تم العودة للمساعدة الذكية. كيف بقدر أساعدك؟'

    // Create the de-escalation message
    await db.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderType: 'AI',
        senderId: 'ai_assistant',
        senderName: L1_NAME,
        message: deEscalationMsg,
        isRead: false,
        metadata: JSON.stringify({
          level: 1,
          deEscalation: true,
          fromLevel: currentLevel,
          reason: reason || 'resolved',
        }),
      },
    })

    // Update conversation to level 1
    const updateData: any = {
      supportLevel: 1,
      isAiActive: true,
      resolutionAsked: false,
      autoCloseNotified: false,
    }

    // If this is from a resolution (not inactivity), mark as needing rating
    if (showRating && !isAutoDeEscalation) {
      updateData.resolvedAt = new Date()
    }

    // If auto-de-escalation from inactivity and still no rating, we don't close
    // The conversation stays OPEN so the user can continue chatting

    await db.chatConversation.update({
      where: { id: conversation.id },
      data: updateData,
    })

    // Get a fresh agent for level 1
    let agent = await db.supportAgent.findFirst({ where: { specialty: 'ai_assistant' } })
    if (agent) {
      await db.chatConversation.update({
        where: { id: conversation.id },
        data: { agentId: agent.id },
      })
    }

    const supportInfo = {
      level: 1,
      name: L1_NAME,
      nameAr: 'المساعدة الذكية',
      titleAr: 'المساعدة الذكية',
      avatar: '/smart-help-avatar.png',
      status: 'متصل الآن',
      statusIcon: '🟢',
      isHuman: false,
    }

    return NextResponse.json({
      success: true,
      deEscalatedFrom: currentLevel,
      supportInfo,
      showRating: showRating && !isAutoDeEscalation,
    })
  } catch (error) {
    console.error('De-escalation error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// ===== CHECK FOR AUTO DE-ESCALATION =====
// Returns whether the conversation should be auto de-escalated due to 30-minute inactivity
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const conversation = await db.chatConversation.findFirst({
      where: { userId: String(user.id), status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: { updatedAt: 'desc' },
    })

    if (!conversation || conversation.supportLevel <= 1) {
      return NextResponse.json({ shouldDeEscalate: false })
    }

    const lastUserMessageAt = conversation.lastUserMessageAt ? new Date(conversation.lastUserMessageAt) : new Date(conversation.updatedAt)
    const now = new Date()
    const minutesSinceLastMessage = (now.getTime() - lastUserMessageAt.getTime()) / (1000 * 60)

    // 30 minutes of inactivity → auto de-escalate
    const shouldDeEscalate = minutesSinceLastMessage >= 30

    return NextResponse.json({
      shouldDeEscalate,
      minutesSinceLastMessage: Math.round(minutesSinceLastMessage),
      currentLevel: conversation.supportLevel,
    })
  } catch (error) {
    console.error('Check de-escalation error:', error)
    return NextResponse.json({ shouldDeEscalate: false })
  }
}
