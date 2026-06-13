import { db } from '@/lib/db'
import { detectXSS, detectSQLInjection, validateInput, sanitizeInput } from '@/lib/security'

// ═══════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════

export interface AdminTool {
  name: string
  description: string
  category: string
  parameters: Array<{
    name: string
    type: 'string' | 'number' | 'boolean'
    description: string
    required: boolean
  }>
  execute: (params: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
  requiresConfirmation?: boolean
}

// ─── USER MANAGEMENT TOOLS ────────────────────────────────

const listUsersTool: AdminTool = {
  name: 'list_users',
  description: 'قائمة المستخدمين مع فلاتر وباجيناشن',
  category: 'إدارة المستخدمين',
  parameters: [
    { name: 'search', type: 'string', description: 'بحث بالاسم أو البريد', required: false },
    { name: 'status', type: 'string', description: 'فلتر: active/inactive/all', required: false },
    { name: 'limit', type: 'number', description: 'عدد النتائج (افتراضي 20)', required: false },
  ],
  execute: async (params) => {
    const limit = Math.min(params.limit || 20, 100)
    const where: any = {}
    if (params.status === 'active') where.isActive = true
    if (params.status === 'inactive') where.isActive = false
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { email: { contains: params.search } },
      ]
    }
    const users = await db.user.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, balance: true, withdrawableBalance: true, totalProfit: true, kycStatus: true, isActive: true, role: true, createdAt: true } })
    return { success: true, data: { count: users.length, users } }
  },
}

const getUserTool: AdminTool = {
  name: 'get_user',
  description: 'تفاصيل مستخدم كاملة',
  category: 'إدارة المستخدمين',
  parameters: [{ name: 'userId', type: 'string', description: 'معرف المستخدم', required: true }],
  execute: async (params) => {
    const user = await db.user.findUnique({ where: { id: params.userId }, include: { investments: { include: { package: true } }, referralsMade: true } })
    if (!user) return { success: false, error: 'المستخدم غير موجود' }
    const { password, verifyCode, verifyCodeExpiry, ...safe } = user
    return { success: true, data: safe }
  },
}

const adjustBalanceTool: AdminTool = {
  name: 'adjust_balance',
  description: 'تعديل رصيد مستخدم (إضافة أو خصم)',
  category: 'إدارة المستخدمين',
  parameters: [
    { name: 'userId', type: 'string', description: 'معرف المستخدم', required: true },
    { name: 'amount', type: 'number', description: 'المبلغ (موجب للإضافة، سالب للخصم)', required: true },
    { name: 'field', type: 'string', description: 'الحقل: balance/withdrawableBalance', required: false },
  ],
  execute: async (params) => {
    const field = params.field || 'balance'
    if (!['balance', 'withdrawableBalance'].includes(field)) return { success: false, error: 'حقل غير صالح' }
    const user = await db.user.update({ where: { id: params.userId }, data: { [field]: { increment: params.amount } } })
    await db.transaction.create({ data: { userId: params.userId, type: 'ADMIN_ADJUST', amount: Math.abs(params.amount), status: 'COMPLETED', description: `تعديل يدوي ${params.amount > 0 ? '+' : ''}${params.amount} USDT على ${field}` } })
    return { success: true, data: { newBalance: (user as any)[field] } }
  },
  requiresConfirmation: true,
}

const toggleUserActiveTool: AdminTool = {
  name: 'toggle_user_active',
  description: 'تفعيل أو تعطيل مستخدم',
  category: 'إدارة المستخدمين',
  parameters: [
    { name: 'userId', type: 'string', description: 'معرف المستخدم', required: true },
    { name: 'active', type: 'boolean', description: 'true للتفعيل، false للتعطيل', required: true },
  ],
  execute: async (params) => {
    await db.user.update({ where: { id: params.userId }, data: { isActive: params.active } })
    return { success: true, data: { userId: params.userId, isActive: params.active } }
  },
  requiresConfirmation: true,
}

const verifyKycTool: AdminTool = {
  name: 'verify_kyc',
  description: 'توثيق أو رفض هوية مستخدم',
  category: 'إدارة المستخدمين',
  parameters: [
    { name: 'userId', type: 'string', description: 'معرف المستخدم', required: true },
    { name: 'status', type: 'string', description: 'VERIFIED أو REJECTED', required: true },
    { name: 'reason', type: 'string', description: 'سبب الرفض (اختياري)', required: false },
  ],
  execute: async (params) => {
    if (!['VERIFIED', 'REJECTED'].includes(params.status)) return { success: false, error: 'حالة غير صالحة' }
    await db.user.update({ where: { id: params.userId }, data: { kycStatus: params.status } })
    return { success: true, data: { userId: params.userId, kycStatus: params.status } }
  },
  requiresConfirmation: true,
}

// ─── TRANSACTION TOOLS ────────────────────────────────────

const listTransactionsTool: AdminTool = {
  name: 'list_transactions',
  description: 'قائمة المعاملات مع فلاتر',
  category: 'إدارة المعاملات',
  parameters: [
    { name: 'type', type: 'string', description: 'DEPOSIT/WITHDRAWAL/PROFIT/INVESTMENT', required: false },
    { name: 'status', type: 'string', description: 'PENDING/COMPLETED/REJECTED', required: false },
    { name: 'limit', type: 'number', description: 'عدد النتائج', required: false },
  ],
  execute: async (params) => {
    const limit = Math.min(params.limit || 20, 100)
    const where: any = {}
    if (params.type) where.type = params.type
    if (params.status) where.status = params.status
    const transactions = await db.transaction.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } })
    return { success: true, data: { count: transactions.length, transactions } }
  },
}

const approveDepositTool: AdminTool = {
  name: 'approve_deposit',
  description: 'الموافقة على إيداع',
  category: 'إدارة المعاملات',
  parameters: [{ name: 'transactionId', type: 'string', description: 'معرف المعاملة', required: true }],
  execute: async (params) => {
    const tx = await db.transaction.findUnique({ where: { id: params.transactionId } })
    if (!tx || tx.type !== 'DEPOSIT') return { success: false, error: 'معاملة الإيداع غير موجودة' }
    await db.$transaction(async (prisma) => {
      await prisma.transaction.update({ where: { id: params.transactionId }, data: { status: 'COMPLETED' } })
      await prisma.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount }, withdrawableBalance: { increment: tx.amount }, totalDeposited: { increment: tx.amount } } })
    })
    return { success: true, data: { transactionId: params.transactionId, amount: tx.amount } }
  },
  requiresConfirmation: true,
}

const rejectTransactionTool: AdminTool = {
  name: 'reject_transaction',
  description: 'رفض معاملة (إيداع أو سحب)',
  category: 'إدارة المعاملات',
  parameters: [
    { name: 'transactionId', type: 'string', description: 'معرف المعاملة', required: true },
    { name: 'reason', type: 'string', description: 'سبب الرفض', required: false },
  ],
  execute: async (params) => {
    const tx = await db.transaction.findUnique({ where: { id: params.transactionId } })
    if (!tx) return { success: false, error: 'المعاملة غير موجودة' }
    await db.transaction.update({ where: { id: params.transactionId }, data: { status: 'REJECTED', adminNote: params.reason || 'مرفوض من الإدارة' } })
    return { success: true }
  },
  requiresConfirmation: true,
}

// ─── INVESTMENT TOOLS ─────────────────────────────────────

const listInvestmentsTool: AdminTool = {
  name: 'list_investments',
  description: 'قائمة الاستثمارات',
  category: 'إدارة الاستثمارات',
  parameters: [
    { name: 'status', type: 'string', description: 'ACTIVE/COMPLETED', required: false },
    { name: 'mode', type: 'string', description: 'SONA', required: false },
    { name: 'limit', type: 'number', description: 'عدد النتائج', required: false },
  ],
  execute: async (params) => {
    const limit = Math.min(params.limit || 20, 100)
    const where: any = {}
    if (params.status) where.status = params.status
    if (params.mode) where.mode = params.mode
    const investments = await db.investment.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } }, package: true } })
    return { success: true, data: { count: investments.length, investments } }
  },
}

const cancelInvestmentTool: AdminTool = {
  name: 'cancel_investment',
  description: 'إلغاء استثمار وإرجاع رأس المال',
  category: 'إدارة الاستثمارات',
  parameters: [{ name: 'investmentId', type: 'string', description: 'معرف الاستثمار', required: true }],
  execute: async (params) => {
    const inv = await db.investment.findUnique({ where: { id: params.investmentId } })
    if (!inv || inv.status !== 'ACTIVE') return { success: false, error: 'استثمار غير موجود أو غير نشط' }
    await db.$transaction(async (prisma) => {
      await prisma.investment.update({ where: { id: params.investmentId }, data: { status: 'COMPLETED', endDate: new Date() } })
      await prisma.user.update({ where: { id: inv.userId }, data: { balance: { increment: inv.amount }, lockedCapital: { decrement: inv.amount } } })
    })
    return { success: true, data: { investmentId: params.investmentId, amount: inv.amount } }
  },
  requiresConfirmation: true,
}

const processDailyProfitsTool: AdminTool = {
  name: 'process_daily_profits',
  description: 'تشغيل حساب الأرباح اليومية يدوياً',
  category: 'إدارة الاستثمارات',
  parameters: [],
  execute: async () => {
    const activeInvestments = await db.investment.findMany({ where: { status: 'ACTIVE', mode: 'SONA' }, include: { package: true } })
    let processed = 0
    let totalProfit = 0
    for (const inv of activeInvestments) {
      const dailyProfit = inv.amount * (inv.package.monthlyReturn / 100)
      const maxDaily = inv.amount * 0.20
      const profit = Math.min(dailyProfit, maxDaily)
      await db.$transaction(async (tx) => {
        await tx.investment.update({ where: { id: inv.id }, data: { nonWithdrawableProfit: { increment: profit }, totalProfit: { increment: profit }, lastDailyProfitDate: new Date() } })
        await tx.user.update({ where: { id: inv.userId }, data: { nonWithdrawableProfit: { increment: profit }, totalProfit: { increment: profit } } })
      })
      processed++
      totalProfit += profit
    }
    return { success: true, data: { processed, totalProfit: totalProfit.toFixed(2) } }
  },
  requiresConfirmation: true,
}

// ─── SYSTEM TOOLS ─────────────────────────────────────────

const getSystemStatsTool: AdminTool = {
  name: 'get_system_stats',
  description: 'إحصائيات النظام الشاملة',
  category: 'النظام',
  parameters: [],
  execute: async () => {
    const [users, deposits, withdrawals, investments, transactions] = await Promise.all([
      db.user.count(),
      db.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'COMPLETED' }, _sum: { amount: true }, _count: true }),
      db.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: { in: ['COMPLETED', 'PROCESSING'] } }, _sum: { amount: true }, _count: true }),
      db.investment.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true }, _count: true }),
      db.transaction.count(),
    ])
    return { success: true, data: { totalUsers: users, totalDeposits: deposits._sum.amount || 0, depositCount: deposits._count, totalWithdrawals: withdrawals._sum.amount || 0, withdrawalCount: withdrawals._count, activeInvestments: investments._count, investedAmount: investments._sum.amount || 0, totalTransactions: transactions } }
  },
}

const getPlatformSettingsTool: AdminTool = {
  name: 'get_platform_settings',
  description: 'عرض إعدادات المنصة',
  category: 'النظام',
  parameters: [],
  execute: async () => {
    const settings = await db.platformSetting.findMany()
    return { success: true, data: settings }
  },
}

const updatePlatformSettingTool: AdminTool = {
  name: 'update_platform_setting',
  description: 'تحديث إعداد في المنصة',
  category: 'النظام',
  parameters: [
    { name: 'key', type: 'string', description: 'مفتاح الإعداد', required: true },
    { name: 'value', type: 'string', description: 'القيمة الجديدة', required: true },
  ],
  execute: async (params) => {
    await db.platformSetting.upsert({ where: { key: params.key }, update: { value: params.value }, create: { key: params.key, value: params.value } })
    return { success: true, data: { key: params.key, value: params.value } }
  },
  requiresConfirmation: true,
}

// ─── NOTIFICATION TOOLS ───────────────────────────────────

const sendNotificationTool: AdminTool = {
  name: 'send_notification',
  description: 'إرسال إشعار لمستخدم',
  category: 'الإشعارات',
  parameters: [
    { name: 'userId', type: 'string', description: 'معرف المستخدم', required: true },
    { name: 'title', type: 'string', description: 'عنوان الإشعار', required: true },
    { name: 'message', type: 'string', description: 'نص الإشعار', required: true },
    { name: 'type', type: 'string', description: 'نوع الإشعار', required: false },
  ],
  execute: async (params) => {
    const { createNotification } = await import('@/lib/notifications')
    await createNotification({ userId: params.userId, title: params.title, message: params.message, type: params.type || 'SYSTEM' })
    return { success: true }
  },
}

const broadcastNotificationTool: AdminTool = {
  name: 'broadcast_notification',
  description: 'إرسال إشعار لجميع المستخدمين النشطين',
  category: 'الإشعارات',
  parameters: [
    { name: 'title', type: 'string', description: 'عنوان الإشعار', required: true },
    { name: 'message', type: 'string', description: 'نص الإشعار', required: true },
  ],
  execute: async (params) => {
    const users = await db.user.findMany({ where: { isActive: true }, select: { id: true } })
    const { createNotification } = await import('@/lib/notifications')
    let sent = 0
    for (const user of users) {
      await createNotification({ userId: user.id, title: params.title, message: params.message, type: 'SYSTEM' })
      sent++
    }
    return { success: true, data: { sent } }
  },
  requiresConfirmation: true,
}

// ─── SUPPORT TOOLS ────────────────────────────────────────

const listSupportTicketsTool: AdminTool = {
  name: 'list_support_tickets',
  description: 'قائمة تذاكر الدعم',
  category: 'الدعم',
  parameters: [
    { name: 'status', type: 'string', description: 'open/in_progress/resolved/closed', required: false },
    { name: 'limit', type: 'number', description: 'عدد النتائج', required: false },
  ],
  execute: async (params) => {
    const limit = Math.min(params.limit || 20, 100)
    const where: any = {}
    if (params.status) where.status = params.status
    const tickets = await db.supportTicket.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } })
    return { success: true, data: { count: tickets.length, tickets } }
  },
}

// ─── SECURITY TOOLS ───────────────────────────────────────

const getSecurityAuditTool: AdminTool = {
  name: 'get_security_audit',
  description: 'تقرير التدقيق الأمني',
  category: 'الأمان',
  parameters: [],
  execute: async () => {
    const { generateSecurityAudit, getBlockedIPs } = await import('@/lib/security')
    const audit = generateSecurityAudit()
    const blocked = getBlockedIPs()
    return { success: true, data: { ...audit, blockedIPs: blocked } }
  },
}

const getIntrusionLogTool: AdminTool = {
  name: 'get_intrusion_log',
  description: 'سجل محاولات التسلل',
  category: 'الأمان',
  parameters: [{ name: 'limit', type: 'number', description: 'عدد النتائج', required: false }],
  execute: async (params) => {
    const { getIntrusionLog } = await import('@/lib/security')
    const log = getIntrusionLog(params.limit || 50)
    return { success: true, data: { count: log.length, events: log } }
  },
}

const unblockIPTool: AdminTool = {
  name: 'unblock_ip',
  description: 'إلغاء حظر عنوان IP',
  category: 'الأمان',
  parameters: [{ name: 'ip', type: 'string', description: 'عنوان IP', required: true }],
  execute: async (params) => {
    const { unblockIP } = await import('@/lib/security')
    const result = unblockIP(params.ip)
    return { success: result, error: result ? undefined : 'IP غير موجود في قائمة الحظر' }
  },
}

// ─── POOL TOOLS ───────────────────────────────────────────

const getPoolStatusTool: AdminTool = {
  name: 'get_pool_status',
  description: 'حالة مجمع تداول SONA',
  category: 'المجمع',
  parameters: [],
  execute: async () => {
    const pool = await db.pool.findFirst({ where: { status: 'ACTIVE' }, include: { trades: { take: 10, orderBy: { openedAt: 'desc' } } } })
    if (!pool) return { success: true, data: { active: false } }
    return { success: true, data: pool }
  },
}

// ─── REFERRAL TOOLS ───────────────────────────────────────

const getReferralStatsTool: AdminTool = {
  name: 'get_referral_stats',
  description: 'إحصائيات نظام الإحالات',
  category: 'الإحالات',
  parameters: [],
  execute: async () => {
    const referrals = await db.referral.findMany({ include: { referrer: { select: { name: true, email: true } }, referred: { select: { name: true, email: true } } } })
    const totalCommission = referrals.reduce((sum, r) => sum + (r.reward || 0), 0)
    return { success: true, data: { totalReferrals: referrals.length, totalCommission, referrals } }
  },
}

// ─── MARKET TOOLS ─────────────────────────────────────────

const getMarketDataTool: AdminTool = {
  name: 'get_market_data',
  description: 'بيانات السوق الحالية',
  category: 'السوق',
  parameters: [],
  execute: async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]')
      if (res.ok) {
        const data = await res.json()
        return { success: true, data }
      }
    } catch {}
    return { success: false, error: 'فشل جلب بيانات السوق' }
  },
}

// ─── DATABASE TOOLS ───────────────────────────────────────

const TABLE_SELECT: Record<string, any> = {
  User: {
    id: true, email: true, name: true, phone: true, role: true,
    balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true,
    withdrawableBalance: true, emailVerified: true, kycStatus: true,
    referralCode: true, referredByCode: true, isActive: true,
    twoFactorEnabled: true, createdAt: true, avatar: true,
    isFrozen: true, frozenUntil: true, freezeReason: true,
    isBlacklisted: true, redFlagCount: true, monitoringLevel: true,
    lastKnownIP: true,
    // EXCLUDED: password, verifyCode, twoFactorSecret, kycDocumentImage, kycSelfieImage
  },
  Transaction: true, // No sensitive fields
  Investment: true,
  Package: true,
  SupportTicket: true,
  ChatConversation: true,
  SupportAgent: true,
}

const queryDatabaseTool: AdminTool = {
  name: 'query_database',
  description: 'تنفيذ استعلام قراءة على قاعدة البيانات (SELECT فقط)',
  category: 'قاعدة البيانات',
  parameters: [{ name: 'table', type: 'string', description: 'اسم الجدول (User/Transaction/Investment/Notification/etc)', required: true }],
  execute: async (params) => {
    const allowedTables = ['User', 'Transaction', 'Investment', 'Notification', 'Package', 'Referral', 'PlatformSetting', 'PlatformLog', 'Pool', 'PoolTrade', 'SupportTicket']
    if (!allowedTables.includes(params.table)) return { success: false, error: 'جدول غير مسموح به' }
    try {
      const tableName = params.table.charAt(0).toLowerCase() + params.table.slice(1)
      const select = TABLE_SELECT[params.table]
      const results = await (db as any)[tableName].findMany({
        take: 20,
        ...(select && select !== true ? { select } : {}),
      })
      return { success: true, data: { count: results.length, results } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },
}

const getDatabaseStatsTool: AdminTool = {
  name: 'get_database_stats',
  description: 'إحصائيات جداول قاعدة البيانات',
  category: 'قاعدة البيانات',
  parameters: [],
  execute: async () => {
    const [users, transactions, investments, notifications, packages, referrals, logs, pools] = await Promise.all([
      db.user.count(), db.transaction.count(), db.investment.count(),
      db.notification.count(), db.package.count(), db.referral.count(),
      db.platformLog.count(), db.pool.count(),
    ])
    return { success: true, data: { users, transactions, investments, notifications, packages, referrals, logs, pools } }
  },
}

// ─── EXPORT TOOLS ─────────────────────────────────────────

const exportDataTool: AdminTool = {
  name: 'export_data',
  description: 'تصدير بيانات (users/transactions/investments)',
  category: 'التصدير',
  parameters: [
    { name: 'type', type: 'string', description: 'نوع البيانات: users/transactions/investments', required: true },
    { name: 'format', type: 'string', description: 'الصيغة: json/csv', required: false },
  ],
  execute: async (params) => {
    let data: any[]
    switch (params.type) {
      case 'users':
        data = await db.user.findMany({ select: { id: true, name: true, email: true, balance: true, totalProfit: true, kycStatus: true, isActive: true, createdAt: true } })
        break
      case 'transactions':
        data = await db.transaction.findMany({ take: 500, orderBy: { createdAt: 'desc' } })
        break
      case 'investments':
        data = await db.investment.findMany({ include: { user: { select: { name: true } }, package: { select: { name: true } } } })
        break
      default:
        return { success: false, error: 'نوع غير صالح' }
    }
    return { success: true, data: { type: params.type, count: data.length, records: data } }
  },
}

// ─── AUDIT LOG TOOLS ──────────────────────────────────────

const getAuditLogTool: AdminTool = {
  name: 'get_audit_log',
  description: 'سجل المراجعة والتدقيق',
  category: 'التدقيق',
  parameters: [{ name: 'limit', type: 'number', description: 'عدد النتائج', required: false }],
  execute: async (params) => {
    const logs = await db.platformLog.findMany({ take: params.limit || 50, orderBy: { createdAt: 'desc' } })
    return { success: true, data: { count: logs.length, logs } }
  },
}

// ─── NEWS TOOLS ───────────────────────────────────────────

const fetchNewsTool: AdminTool = {
  name: 'fetch_news',
  description: 'جلب أخبار الكريبتو',
  category: 'الأخبار',
  parameters: [],
  execute: async () => {
    try {
      const apiKey = process.env.NEWS_API_KEY
      if (!apiKey) return { success: false, error: 'مفتاح API غير متوفر' }
      const res = await fetch(`https://newsapi.org/v2/everything?q=bitcoin+OR+ethereum+OR+crypto&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`)
      const data = await res.json()
      return { success: true, data: data.articles?.slice(0, 10) || [] }
    } catch {
      return { success: false, error: 'فشل جلب الأخبار' }
    }
  },
}

// ─── PACKAGE TOOLS ────────────────────────────────────────

const listPackagesTool: AdminTool = {
  name: 'list_packages',
  description: 'قائمة باقات الاستثمار',
  category: 'الباقات',
  parameters: [],
  execute: async () => {
    const packages = await db.package.findMany({ orderBy: { order: 'asc' } })
    return { success: true, data: packages }
  },
}

// ─── CHAT CONVERSATION TOOLS ──────────────────────────────

const listChatsTool: AdminTool = {
  name: 'list_chats',
  description: 'قائمة محادثات الدعم',
  category: 'الدعم',
  parameters: [{ name: 'limit', type: 'number', description: 'عدد النتائج', required: false }],
  execute: async (params) => {
    const conversations = await db.chatConversation.findMany({ take: params.limit || 20, orderBy: { updatedAt: 'desc' }, include: { user: { select: { name: true, email: true } } } })
    return { success: true, data: { count: conversations.length, conversations } }
  },
}

// ─── DELETE USER TOOL ────────────────────────────────────

const deleteUserTool: AdminTool = {
  name: 'delete_user',
  description: 'حذف حساب مستخدم نهائياً',
  category: 'إدارة المستخدمين',
  parameters: [
    { name: 'userId', type: 'string', description: 'معرف المستخدم', required: true },
  ],
  execute: async (params) => {
    const user = await db.user.findUnique({ where: { id: params.userId } })
    if (!user) return { success: false, error: 'المستخدم غير موجود' }
    if (user.role === 'admin') return { success: false, error: 'لا يمكن حذف حساب مدير' }
    // Delete related records first
    await db.notification.deleteMany({ where: { userId: params.userId } })
    await db.referral.deleteMany({ where: { OR: [{ referrerId: params.userId }, { referredId: params.userId }] } })
    await db.supportTicket.deleteMany({ where: { userId: params.userId } })
    await db.chatMessage.deleteMany({ where: { senderId: params.userId } })
    await db.transaction.deleteMany({ where: { userId: params.userId } })
    await db.investment.deleteMany({ where: { userId: params.userId } })
    await db.user.delete({ where: { id: params.userId } })
    return { success: true, data: { deletedUserId: params.userId, deletedUser: user.email } }
  },
  requiresConfirmation: true,
}

// ─── FINANCIAL REPORT TOOL ────────────────────────────────

const financialReportTool: AdminTool = {
  name: 'financial_report',
  description: 'تقرير مالي شامل للمنصة',
  category: 'التقارير',
  parameters: [
    { name: 'period', type: 'string', description: 'الفترة: 7d/30d/90d/all', required: false },
  ],
  execute: async (params) => {
    const period = params.period || '30d'
    const now = new Date()
    let startDate = new Date(0)
    if (period === '7d') startDate = new Date(now.getTime() - 7 * 86400000)
    else if (period === '30d') startDate = new Date(now.getTime() - 30 * 86400000)
    else if (period === '90d') startDate = new Date(now.getTime() - 90 * 86400000)

    const [deposits, withdrawals, profits, investments, totalBalance] = await Promise.all([
      db.transaction.aggregate({ where: { type: 'deposit', status: 'COMPLETED', createdAt: { gte: startDate } }, _sum: { amount: true }, _count: true }),
      db.transaction.aggregate({ where: { type: 'withdrawal', status: { in: ['COMPLETED', 'PROCESSING'] }, createdAt: { gte: startDate } }, _sum: { amount: true }, _count: true }),
      db.transaction.aggregate({ where: { type: 'profit', status: 'COMPLETED', createdAt: { gte: startDate } }, _sum: { amount: true }, _count: true }),
      db.investment.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true }, _count: true }),
      db.user.aggregate({ _sum: { balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true } }),
    ])

    return {
      success: true,
      data: {
        period,
        deposits: { total: deposits._sum.amount || 0, count: deposits._count },
        withdrawals: { total: withdrawals._sum.amount || 0, count: withdrawals._count },
        profits: { total: profits._sum.amount || 0, count: profits._count },
        activeInvestments: { total: investments._sum.amount || 0, count: investments._count },
        platformTotals: {
          totalBalance: totalBalance._sum.balance || 0,
          totalProfit: totalBalance._sum.totalProfit || 0,
          totalDeposited: totalBalance._sum.totalDeposited || 0,
          totalWithdrawn: totalBalance._sum.totalWithdrawn || 0,
        },
        netFlow: (deposits._sum.amount || 0) - (withdrawals._sum.amount || 0),
      },
    }
  },
}

// ─── RISK ANALYSIS TOOL ───────────────────────────────────

const riskAnalysisTool: AdminTool = {
  name: 'risk_analysis',
  description: 'تحليل مخاطر المنصة المالية والتشغيلية',
  category: 'التقارير',
  parameters: [],
  execute: async () => {
    const [totalBalance, pendingWithdrawals, activeInvestments, unverifiedWithBalance] = await Promise.all([
      db.user.aggregate({ _sum: { balance: true, withdrawableBalance: true } }),
      db.transaction.aggregate({ where: { type: 'withdrawal', status: 'PENDING' }, _sum: { amount: true }, _count: true }),
      db.investment.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true } }),
      db.user.count({ where: { balance: { gt: 5000 }, kycStatus: { notIn: ['APPROVED', 'VERIFIED'] } } }),
    ])

    const totalBal = totalBalance._sum.balance || 0
    const withdrawable = totalBalance._sum.withdrawableBalance || 0
    const pendingWith = pendingWithdrawals._sum.amount || 0
    const investmentAmount = activeInvestments._sum.amount || 0

    const liquidityRatio = totalBal > 0 ? withdrawable / totalBal : 0
    const withdrawalRisk = withdrawable > 0 ? (pendingWith / withdrawable) * 100 : 0

    let riskLevel = 'low'
    const risks: string[] = []
    if (liquidityRatio < 0.2) { riskLevel = 'high'; risks.push('نسبة السيولة منخفضة جداً - أقل من 20%') }
    else if (liquidityRatio < 0.4) { riskLevel = 'medium'; risks.push('نسبة السيولة منخفضة - أقل من 40%') }
    if (withdrawalRisk > 50) { riskLevel = 'high'; risks.push('طلبات السحب المعلقة تتجاوز 50% من الرصيد المتاح') }
    if (unverifiedWithBalance > 5) risks.push(`${unverifiedWithBalance} مستخدمين بأرصدة عالية بدون توثيق KYC`)

    return {
      success: true,
      data: {
        riskLevel,
        liquidityRatio: (liquidityRatio * 100).toFixed(1) + '%',
        withdrawalRisk: withdrawalRisk.toFixed(1) + '%',
        risks,
        metrics: {
          totalBalance: totalBal,
          withdrawableBalance: withdrawable,
          pendingWithdrawals: pendingWith,
          pendingWithdrawalCount: pendingWithdrawals._count,
          activeInvestmentAmount: investmentAmount,
          unverifiedHighBalanceUsers: unverifiedWithBalance,
        },
      },
    }
  },
}

// ─── PROCESS WITHDRAWAL TOOL ──────────────────────────────

const processWithdrawalTool: AdminTool = {
  name: 'process_withdrawal',
  description: 'معالجة طلب سحب (موافقة أو رفض)',
  category: 'إدارة المعاملات',
  parameters: [
    { name: 'transactionId', type: 'string', description: 'معرف المعاملة', required: true },
    { name: 'approve', type: 'boolean', description: 'true للموافقة، false للرفض', required: true },
    { name: 'reason', type: 'string', description: 'سبب الرفض (اختياري)', required: false },
  ],
  execute: async (params) => {
    const tx = await db.transaction.findUnique({ where: { id: params.transactionId } })
    if (!tx || tx.type !== 'withdrawal') return { success: false, error: 'معاملة السحب غير موجودة' }
    if (tx.status !== 'PENDING' && tx.status !== 'PROCESSING') return { success: false, error: 'المعاملة ليست قيد الانتظار' }

    if (params.approve) {
      await db.$transaction(async (prisma) => {
        await prisma.transaction.update({ where: { id: params.transactionId }, data: { status: 'COMPLETED' } })
        await prisma.user.update({ where: { id: tx.userId }, data: { totalWithdrawn: { increment: tx.amount } } })
      })
      return { success: true, data: { transactionId: params.transactionId, amount: tx.amount, status: 'approved' } }
    } else {
      await db.$transaction(async (prisma) => {
        await prisma.transaction.update({ where: { id: params.transactionId }, data: { status: 'REJECTED', adminNote: params.reason || 'مرفوض من الإدارة' } })
        await prisma.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount }, withdrawableBalance: { increment: tx.amount } } })
      })
      return { success: true, data: { transactionId: params.transactionId, amount: tx.amount, status: 'rejected', refunded: true } }
    }
  },
  requiresConfirmation: true,
}

// ─── CREATE PACKAGE TOOL ──────────────────────────────────

const createPackageTool: AdminTool = {
  name: 'create_package',
  description: 'إنشاء باقة استثمار جديدة',
  category: 'الباقات',
  parameters: [
    { name: 'name', type: 'string', description: 'اسم الباقة', required: true },
    { name: 'minAmount', type: 'number', description: 'الحد الأدنى للاستثمار', required: true },
    { name: 'maxAmount', type: 'number', description: 'الحد الأقصى للاستثمار', required: true },
    { name: 'monthlyReturn', type: 'number', description: 'نسبة العائد الشهري (%)', required: true },
    { name: 'duration', type: 'number', description: 'مدة الباقة (بالأيام)', required: true },
  ],
  execute: async (params) => {
    const lastPkg = await db.package.findFirst({ orderBy: { order: 'desc' } })
    const order = (lastPkg?.order || 0) + 1
    const pkg = await db.package.create({
      data: {
        name: params.name,
        nameEn: params.nameEn || params.name,
        minAmount: params.minAmount,
        maxAmount: params.maxAmount,
        monthlyReturn: params.monthlyReturn,
        durationDays: params.duration,
        description: params.description || '',
        descriptionEn: params.descriptionEn || params.description || '',
        color: params.color || '#409eff',
        icon: params.icon || 'package',
        order,
      },
    })
    return { success: true, data: pkg }
  },
  requiresConfirmation: true,
}

// ─── UPDATE PACKAGE TOOL ──────────────────────────────────

const updatePackageTool: AdminTool = {
  name: 'update_package',
  description: 'تحديث باقة استثمار',
  category: 'الباقات',
  parameters: [
    { name: 'packageId', type: 'string', description: 'معرف الباقة', required: true },
    { name: 'name', type: 'string', description: 'اسم الباقة الجديد', required: false },
    { name: 'minAmount', type: 'number', description: 'الحد الأدنى الجديد', required: false },
    { name: 'maxAmount', type: 'number', description: 'الحد الأقصى الجديد', required: false },
    { name: 'monthlyReturn', type: 'number', description: 'نسبة العائد الجديدة', required: false },
  ],
  execute: async (params) => {
    const { packageId, ...updateData } = params
    const data: any = {}
    if (updateData.name) data.name = updateData.name
    if (updateData.minAmount) data.minAmount = updateData.minAmount
    if (updateData.maxAmount) data.maxAmount = updateData.maxAmount
    if (updateData.monthlyReturn) data.monthlyReturn = updateData.monthlyReturn
    if (Object.keys(data).length === 0) return { success: false, error: 'لا توجد بيانات للتحديث' }

    const pkg = await db.package.update({ where: { id: packageId }, data })
    return { success: true, data: pkg }
  },
  requiresConfirmation: true,
}

// ─── SEND EMAIL TOOL ─────────────────────────────────────

const sendEmailTool: AdminTool = {
  name: 'send_email',
  description: 'إرسال بريد إلكتروني لمستخدم',
  category: 'الإشعارات',
  parameters: [
    { name: 'userId', type: 'string', description: 'معرف المستخدم', required: true },
    { name: 'subject', type: 'string', description: 'عنوان البريد', required: true },
    { name: 'message', type: 'string', description: 'نص البريد', required: true },
  ],
  execute: async (params) => {
    const user = await db.user.findUnique({ where: { id: params.userId }, select: { email: true, name: true } })
    if (!user) return { success: false, error: 'المستخدم غير موجود' }

    try {
      const resendModule = await import('resend')
      const Resend = (resendModule as any).default || resendModule.Resend
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'SONA Platform <noreply@sona.platform>',
        to: user.email,
        subject: params.subject,
        html: `<div dir="rtl" style="font-family:Arial;padding:20px;"><h2>${params.subject}</h2><p>${params.message}</p></div>`,
      })
      return { success: true, data: { sentTo: user.email } }
    } catch (err: any) {
      return { success: false, error: `فشل إرسال البريد: ${err.message}` }
    }
  },
}

// ─── SYSTEM HEALTH TOOL ───────────────────────────────────

const systemHealthTool: AdminTool = {
  name: 'system_health',
  description: 'فحص سريع لحالة النظام',
  category: 'النظام',
  parameters: [],
  execute: async () => {
    const startTime = Date.now()
    let dbStatus = 'healthy'
    try {
      await db.$queryRaw`SELECT 1`
    } catch { dbStatus = 'error' }
    const dbResponseTime = Date.now() - startTime

    const [userCount, pendingDeposits, pendingWithdrawals, activeInvestments, errorCount24h] = await Promise.all([
      db.user.count(),
      db.transaction.count({ where: { type: 'deposit', status: 'PENDING' } }),
      db.transaction.count({ where: { type: 'withdrawal', status: 'PENDING' } }),
      db.investment.count({ where: { status: 'ACTIVE' } }),
      db.platformLog.count({ where: { action: { contains: 'error' }, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    ])

    const mem = process.memoryUsage()
    const healthScore = Math.max(0, 100 - (dbStatus === 'error' ? 50 : 0) - (errorCount24h > 10 ? 20 : 0) - (dbResponseTime > 200 ? 15 : 0))

    return {
      success: true,
      data: {
        healthScore,
        database: { status: dbStatus, responseTimeMs: dbResponseTime },
        memory: { usedMB: Math.round(mem.heapUsed / 1024 / 1024), totalMB: Math.round(mem.heapTotal / 1024 / 1024) },
        uptime: Math.floor(process.uptime()) + 's',
        stats: { users: userCount, pendingDeposits, pendingWithdrawals, activeInvestments, errors24h: errorCount24h },
      },
    }
  },
}

// ═══════════════════════════════════════════════════════════
// TOOL REGISTRY
// ═══════════════════════════════════════════════════════════

export const ALL_TOOLS: AdminTool[] = [
  // User Management
  listUsersTool, getUserTool, adjustBalanceTool, toggleUserActiveTool, verifyKycTool, deleteUserTool,
  // Transactions
  listTransactionsTool, approveDepositTool, rejectTransactionTool, processWithdrawalTool,
  // Investments
  listInvestmentsTool, cancelInvestmentTool, processDailyProfitsTool,
  // System
  getSystemStatsTool, getPlatformSettingsTool, updatePlatformSettingTool, systemHealthTool,
  // Notifications
  sendNotificationTool, broadcastNotificationTool, sendEmailTool,
  // Support
  listSupportTicketsTool, listChatsTool,
  // Security
  getSecurityAuditTool, getIntrusionLogTool, unblockIPTool,
  // Pool
  getPoolStatusTool,
  // Referrals
  getReferralStatsTool,
  // Market
  getMarketDataTool,
  // Database
  queryDatabaseTool, getDatabaseStatsTool,
  // Export
  exportDataTool,
  // Audit
  getAuditLogTool,
  // News
  fetchNewsTool,
  // Packages
  listPackagesTool, createPackageTool, updatePackageTool,
  // Reports
  financialReportTool, riskAnalysisTool,
]

export const TOOL_MAP = new Map(ALL_TOOLS.map(t => [t.name, t]))

export function getToolsByCategory(): Record<string, AdminTool[]> {
  const categories: Record<string, AdminTool[]> = {}
  for (const tool of ALL_TOOLS) {
    if (!categories[tool.category]) categories[tool.category] = []
    categories[tool.category].push(tool)
  }
  return categories
}

export async function executeTool(name: string, params: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string }> {
  const tool = TOOL_MAP.get(name)
  if (!tool) return { success: false, error: `أداة غير معروفة: ${name}` }

  // Validate parameters for XSS/SQL injection
  for (const param of tool.parameters) {
    if (params[param.name] && typeof params[param.name] === 'string') {
      const xssCheck = detectXSS(params[param.name])
      if (xssCheck.isXSS) return { success: false, error: `تم اكتشاف محتوى خطير في المعامل ${param.name}` }

      const sqlCheck = detectSQLInjection(params[param.name])
      if (sqlCheck.detected) return { success: false, error: `تم اكتشاف محتوى خطير في المعامل ${param.name}` }
    }
  }

  try {
    return await tool.execute(params)
  } catch (error: any) {
    console.error(`[AGENT-TOOL] Error executing ${name}:`, error)
    return { success: false, error: error.message || 'خطأ في تنفيذ الأداة' }
  }
}
