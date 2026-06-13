import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { buildUserContextPrompt, getFallbackResponse } from '@/lib/ai-support'
import prompts from '@/data/prompts.json'

const SUPPORT_TEAM_NAME = 'فريق دعم SONA'
const SYSTEM_PROMPT = prompts.systemPrompt

// Keywords that indicate a simple/quick question vs complex one
const SIMPLE_KEYWORDS = ['شكراً', 'أهلاً', 'مرحباً', 'تم', 'نعم', 'لا', 'حسناً', 'طيب', '_ok', 'ok', 'حبيبي', 'ممتاز', 'رائع', 'شكرا', 'مشكور']
const COMPLEX_KEYWORDS = ['كيف', 'شرح', 'خطوات', 'تفصيل', 'مشكلة', 'إيداع', 'سحب', 'باقة', 'استثمار', 'تحويل', 'إحالة', 'وثق', 'kyc', 'حسابي', 'رصيد', 'أرباح', 'رسوم', 'عمولة', 'عنوان', 'محفظة', 'لم يصل', 'تأخر', 'فشل']

// Rate limiting for AI responses: max 20 per minute per user
const aiRateLimit = new Map<string, { count: number; resetAt: number }>()

function getSmartDelay(userMessage: string): number {
  const msgLower = userMessage.toLowerCase()
  
  const isSimple = SIMPLE_KEYWORDS.some(kw => msgLower.includes(kw)) || userMessage.length < 15
  const isComplex = COMPLEX_KEYWORDS.some(kw => msgLower.includes(kw)) || userMessage.length > 80
  
  if (isSimple && !isComplex) {
    return Math.floor(Math.random() * 2000) + 1000
  } else if (isComplex) {
    return Math.floor(Math.random() * 3000) + 3000
  } else {
    return Math.floor(Math.random() * 3000) + 2000
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  let ticketId = ''
  let userId = ''

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
    ticketId = body.ticketId || ''
    const userMessage = body.userMessage || ''
    // Use authenticated user's ID, not from body
    userId = authUser.id

    if (!ticketId || !userMessage) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول المطلوبة' },
        { status: 400 }
      )
    }

    // Rate limiting check
    const now = Date.now()
    const userRate = aiRateLimit.get(userId)
    if (userRate && userRate.resetAt > now && userRate.count >= 20) {
      return NextResponse.json(
        { error: 'ترسل رسائل بسرعة كبيرة، انتظر قليلاً' },
        { status: 429 }
      )
    }
    if (!userRate || userRate.resetAt <= now) {
      aiRateLimit.set(userId, { count: 1, resetAt: now + 60000 })
    } else {
      userRate.count++
    }

    // Verify ticket exists and belongs to authenticated user
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
        user: {
          select: {
            name: true,
            email: true,
            balance: true,
            withdrawableBalance: true,
            totalDeposited: true,
            totalWithdrawn: true,
            totalProfit: true,
            referralCode: true,
            kycStatus: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'التذكرة غير موجودة، ممكن تبدأ محادثة جديدة؟' },
        { status: 404 }
      )
    }

    if (ticket.userId !== userId) {
      return NextResponse.json(
        { error: 'غير مصرح بهذا الإجراء' },
        { status: 403 }
      )
    }

    // Smart delay: simulate natural conversation rhythm
    const readingDelay = Math.floor(Math.random() * 1200) + 500
    const typingDelay = getSmartDelay(userMessage)
    const totalDelay = readingDelay + typingDelay
    
    await sleep(totalDelay)

    // Build conversation history for context
    const conversationHistory = ticket.messages.map((msg) => ({
      role: msg.senderType === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }))

    // Build rich user context using the shared utility
    const userContext = buildUserContextPrompt({
      name: ticket.user.name,
      email: ticket.user.email,
      balance: ticket.user.balance,
      withdrawableBalance: ticket.user.withdrawableBalance,
      totalDeposited: ticket.user.totalDeposited,
      totalWithdrawn: ticket.user.totalWithdrawn,
      totalProfit: ticket.user.totalProfit,
      kycStatus: ticket.user.kycStatus,
      referralCode: ticket.user.referralCode,
      ticketCategory: ticket.category,
      ticketPriority: ticket.priority,
    })

    // Initialize ZAI SDK and generate response
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: userContext },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.75,
      max_tokens: 800,
    })

    let aiContent = completion.choices?.[0]?.message?.content

    // Validate response quality
    if (!aiContent || aiContent.trim().length < 10) {
      aiContent = getFallbackResponse()
    }

    // Save AI response to database
    const aiMessage = await db.supportMessage.create({
      data: {
        ticketId,
        userId,
        senderType: 'ai_bot',
        content: aiContent,
        isRead: false,
      },
    })

    // Update ticket timestamp
    await db.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      message: 'تم إنشاء الرد بنجاح',
      aiMessage,
      delay: totalDelay,
    })
  } catch (error) {
    console.error('[SUPPORT] AI respond error:', error)

    // Fallback: save a human-like response if we have ticketId and userId
    if (ticketId && userId) {
      try {
        const fallbackContent = getFallbackResponse()

        const fallbackMessage = await db.supportMessage.create({
          data: {
            ticketId,
            userId,
            senderType: 'ai_bot',
            content: fallbackContent,
            isRead: false,
          },
        })

        return NextResponse.json({
          message: 'تم إنشاء رد احتياطي',
          aiMessage: fallbackMessage,
        })
      } catch (fallbackErr) {
        console.error('[SUPPORT] Fallback response also failed:', fallbackErr)
      }
    }

    return NextResponse.json(
      { error: 'أعتذر، صار خلل تقني مؤقت. جرب بعد لحظات وراح نكون هنا لمساعدتك 💛' },
      { status: 500 }
    )
  }
}
