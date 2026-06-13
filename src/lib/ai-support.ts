import ZAI from 'z-ai-web-dev-sdk'
import prompts from '@/data/prompts.json'

const SYSTEM_PROMPT = prompts.systemPrompt
const REJECTION_REASONS: Record<string, string> = prompts.rejectionReasons
const FALLBACK_RESPONSES: string[] = (prompts as any).fallbackResponses || [
  'سامحني، واجهت ضغط تقني شوية. بس ما تخاف، جرب ترسل رسالتك مرة تانية ورح أساعدك',
]

// User context interface for personalized responses
export interface UserContext {
  name: string
  email?: string
  balance?: number
  withdrawableBalance?: number
  totalDeposited?: number
  totalWithdrawn?: number
  totalProfit?: number
  kycStatus?: string
  emailVerified?: boolean
  referralCode?: string
  isFrozen?: boolean
  freezeReason?: string
  activeInvestments?: Array<{
    packageName: string
    amount: number
    dailyReturn?: number
    daysRemaining?: number
  }>
  recentTransactions?: Array<{
    type: string
    amount: number
    status: string
    date?: string
    txId?: string
  }>
  pendingDeposits?: Array<{
    amount: number
    status: string
    date: string
    txId?: string
  }>
  pendingWithdrawals?: Array<{
    amount: number
    status: string
    date: string
    txId?: string
  }>
  ticketCategory?: string
  ticketPriority?: string
}

// Build a rich user context prompt with DETAILED transaction data
export function buildUserContextPrompt(ctx: UserContext): string {
  const parts: string[] = [
    '═══ بيانات العميل الحالي (بيانات حقيقية من قاعدة البيانات) ═══',
    `- الاسم: ${ctx.name}`,
    `- البريد: ${ctx.email || 'غير متوفر'}`,
    `- الرصيد المتاح: $${(ctx.balance ?? 0).toFixed(2)}`,
    `- الرصيد القابل للسحب: $${(ctx.withdrawableBalance ?? 0).toFixed(2)}`,
    `- إجمالي ما أودعه: $${(ctx.totalDeposited ?? 0).toFixed(2)}`,
    `- إجمالي ما سحبه: $${(ctx.totalWithdrawn ?? 0).toFixed(2)}`,
    `- إجمالي أرباحه: $${(ctx.totalProfit ?? 0).toFixed(2)}`,
    `- حالة التحقق KYC: ${formatKycStatus(ctx.kycStatus)}`,
    `- البريد مفعل: ${ctx.emailVerified ? 'نعم' : 'لا'}`,
    `- كود الإحالة: ${ctx.referralCode || 'غير متوفر'}`,
    `- حالة الحساب: ${ctx.isFrozen ? `مجمد - السبب: ${ctx.freezeReason || 'غير محدد'}` : 'نشط'}`,
  ]

  if (ctx.activeInvestments && ctx.activeInvestments.length > 0) {
    parts.push('', '═══ استثمارات العميل النشطة ═══')
    ctx.activeInvestments.forEach((inv, i) => {
      parts.push(`${i + 1}. باقة "${inv.packageName}": $${(inv.amount ?? 0).toFixed(2)}${inv.dailyReturn ? ` | عائد يومي ${inv.dailyReturn}%` : ''}${inv.daysRemaining !== undefined ? ` | متبقي ${inv.daysRemaining} يوم` : ''}`)
    })
  } else {
    parts.push('', '═══ استثمارات العميل ═══', 'لا توجد استثمارات نشطة حالياً')
  }

  // PENDING DEPOSITS - critical for "my deposit didn't arrive"
  if (ctx.pendingDeposits && ctx.pendingDeposits.length > 0) {
    parts.push('', '═══ إيداعات معلقة (مهم جداً للرد على شكاوى الإيداع) ═══')
    ctx.pendingDeposits.forEach((tx, i) => {
      parts.push(`${i + 1}. إيداع $${(tx.amount ?? 0).toFixed(2)} — الحالة: ${tx.status === 'PENDING' ? 'قيد الانتظار ⏳' : tx.status === 'COMPLETED' ? 'مكتمل ✓' : tx.status === 'FAILED' ? 'فشل ✗' : tx.status} — التاريخ: ${tx.date}${tx.txId ? ` — رقم العملية: ${tx.txId}` : ''}`)
    })
  }

  // PENDING WITHDRAWALS - critical for "withdrawal stuck"
  if (ctx.pendingWithdrawals && ctx.pendingWithdrawals.length > 0) {
    parts.push('', '═══ سحوبات معلقة (مهم جداً للرد على شكاوى السحب) ═══')
    ctx.pendingWithdrawals.forEach((tx, i) => {
      parts.push(`${i + 1}. سحب $${(tx.amount ?? 0).toFixed(2)} — الحالة: ${tx.status === 'PENDING' ? 'قيد المعالجة ⏳' : tx.status === 'COMPLETED' ? 'مكتمل ✓' : tx.status === 'FAILED' ? 'فشل ✗' : tx.status} — التاريخ: ${tx.date}${tx.txId ? ` — رقم العملية: ${tx.txId}` : ''}`)
    })
  }

  if (ctx.recentTransactions && ctx.recentTransactions.length > 0) {
    parts.push('', '═══ آخر المعاملات ═══')
    ctx.recentTransactions.forEach((tx) => {
      const statusLabel = tx.status === 'COMPLETED' ? 'مكتملة ✓' : tx.status === 'PENDING' ? 'قيد الانتظار ⏳' : tx.status === 'FAILED' ? 'فشلت ✗' : tx.status
      parts.push(`- ${formatTxType(tx.type)}: $${(tx.amount ?? 0).toFixed(2)} (${statusLabel})${tx.date ? ` — ${tx.date}` : ''}${tx.txId ? ` — #${tx.txId.substring(0, 8)}` : ''}`)
    })
  }

  parts.push(
    '',
    '═══ توجيهات إلزامية لاستخدام البيانات ═══',
    '⚠️ يجب أن تستخدم البيانات الحقيقية أعلاه في كل رد تعطيه!',
    '- إذا اشتكى من إيداع لم يصل: تحقق من "إيداعات معلقة" أعلاه. إذا وجدت إيداع قيد الانتظار، أخبره بالمبلغ والتاريخ والحالة بالتحديد.',
    '- إذا اشتكى من سحب معلق: تحقق من "سحوبات معلقة" أعلاه. إذا وجدت سحب قيد المعالجة، أخبره بالمبلغ والحالة.',
    '- إذا سأل عن رصيده: أعطه الرقم الحقيقي من البيانات أعلاه.',
    '- إذا سأل عن الأرباح: أعطه رقم أرباحه الحقيقي واذكر استثماراته النشطة.',
    '- إذا سأل عن السحب: أخبره برصيده القابل للسحب الحقيقي.',
    '- إذا لم يكن موثقاً وسأل عن سحب أكثر من $1,000: أخبره بضرورة التوثيق أولاً.',
    '- إذا قال حسابي مخترق: أخبره أنك راجعت حسابه وطلبت تجميد الحساب مؤقتاً للحماية + نصائح أمنية فورية.',
    '- لا تعطي ردود عامة مثل "يمكنك الإيداع من صفحة الإيداع" — بدلاً من ذلك أعط تفاصيل محددة من بياناته.',
  )

  return parts.join('\n')
}

function formatKycStatus(status?: string): string {
  if (!status) return 'غير مكتمل'
  switch (status) {
    case 'APPROVED': return 'موثق ✓'
    case 'PENDING': return 'قيد المراجعة ⏳'
    case 'REJECTED': return 'مرفوض ✗'
    default: return 'غير مكتمل'
  }
}

function formatTxType(type: string): string {
  const map: Record<string, string> = {
    DEPOSIT: 'إيداع',
    WITHDRAWAL: 'سحب',
    PROFIT: 'أرباح',
    REFERRAL: 'عمولة إحالة',
    INVESTMENT: 'استثمار',
  }
  return map[type] || type
}

// Get a random fallback response
export function getFallbackResponse(): string {
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)]
}

// Main AI response function with enhanced context
export async function getAIResponse(
  message: string,
  agentName: string,
  conversationHistory: Array<{role: string, content: string}>,
  imageUrl?: string,
  userContext?: UserContext,
): Promise<string> {
  try {
    const zai = await ZAI.create()

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    // Add user context if provided
    if (userContext) {
      messages.push({ role: 'system', content: buildUserContextPrompt(userContext) })
    }

    // Add conversation history (last 12 messages for better context)
    for (const msg of conversationHistory.slice(-12)) {
      messages.push({ role: msg.role === 'USER' ? 'user' : 'assistant', content: msg.content })
    }

    // Add current user message
    if (imageUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      })
    } else {
      messages.push({ role: 'user', content: message })
    }

    const response = await zai.chat.completions.create({
      messages,
      temperature: 0.75,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content || content.trim().length === 0) {
      return getFallbackResponse()
    }

    return content
  } catch (error) {
    console.error('AI Support error:', error)
    return getFallbackResponse()
  }
}

// Quick response generator for simple acknowledgments
export async function getQuickAcknowledgment(): Promise<string> {
  const acknowledgments = [
    'تمام، خليني أشوفلك',
    'أكيد، شوية وأردك',
    'فهمت عليك، بدور لك على الإجابة',
    'طبعاً، لحظات وبكون معك',
  ]
  return acknowledgments[Math.floor(Math.random() * acknowledgments.length)]
}

export function getKycRejectionReason(code: string): string {
  return REJECTION_REASONS[code] || prompts.defaultRejection
}

export { REJECTION_REASONS }
