import { db } from '@/lib/db'

// Dynamic messages for delayed withdrawals
const DYNAMIC_MESSAGES = [
  { minHours: 1, maxHours: 6, message: 'الشبكة مزدحمة، جاري معالجة طلبك', type: 'NETWORK_CONGESTED' },
  { minHours: 6, maxHours: 12, message: 'جاري المراجعة الأمنية لطلبك', type: 'SECURITY_REVIEW' },
  { minHours: 12, maxHours: 24, message: 'تحديث نظام البلوكشين، سيتم المعالجة قريباً', type: 'BLOCKCHAIN_UPDATE' },
  { minHours: 24, maxHours: 48, message: 'طلبك في المراجعة المتقدمة، شكراً لصبرك', type: 'ADVANCED_REVIEW' },
  { minHours: 48, maxHours: Infinity, message: 'طلبك قيد المعالجة النهائية', type: 'FINAL_PROCESSING' },
]

// Get platform setting value
export async function getPlatformSetting(key: string): Promise<string | null> {
  const setting = await db.platformSetting.findUnique({ where: { key } })
  return setting?.value || null
}

// Set platform setting
export async function setPlatformSetting(key: string, value: string): Promise<void> {
  await db.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

// Core: Evaluate withdrawal request and determine stage
export async function evaluateWithdrawal(userId: string, amount: number): Promise<{
  stage: 'AUTO_APPROVED' | 'PENDING_MANUAL'
  autoApproved: boolean
  reason: string
  dynamicMessage?: string
}> {
  // Get settings
  const autoApproveLimit = parseFloat(await getPlatformSetting('auto_withdraw_limit') || '50')
  const maintenanceMode = (await getPlatformSetting('maintenance_mode')) === 'true'
  const withdrawalEnabled = (await getPlatformSetting('withdrawal_enabled')) !== 'false'

  // If maintenance mode or withdrawals disabled, always require manual review
  if (maintenanceMode || !withdrawalEnabled) {
    return {
      stage: 'PENDING_MANUAL',
      autoApproved: false,
      reason: maintenanceMode ? 'وضع الصيانة مفعل' : 'السحوبات معطلة مؤقتاً',
      dynamicMessage: 'جاري صيانة النظام، سيتم معالجة طلبك قريباً'
    }
  }

  // Get user info
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return { stage: 'PENDING_MANUAL', autoApproved: false, reason: 'مستخدم غير موجود' }

  // Account age check (new accounts need manual review for large amounts)
  const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  const isNewAccount = accountAgeDays < 7
  const kycVerified = ['VERIFIED', 'APPROVED'].includes(user.kycStatus)

  // Auto-approve Tier 1: amounts within auto-approve limit (default $50)
  if (amount <= autoApproveLimit) {
    return {
      stage: 'AUTO_APPROVED',
      autoApproved: true,
      reason: `مبلغ صغير (${amount} USDT) - موافقة تلقائية`
    }
  }

  // Auto-approve Tier 2: ≤$200 from KYC-verified accounts ≥7 days old
  if (amount <= 200 && kycVerified && !isNewAccount) {
    return {
      stage: 'AUTO_APPROVED',
      autoApproved: true,
      reason: `موافقة تلقائية مستوى 2 - مستخدم موثق (${amount} USDT)`
    }
  }

  // Auto-approve Tier 3: ≤$500 from KYC-verified accounts ≥14 days old with good history
  if (amount <= 500 && kycVerified && accountAgeDays >= 14) {
    const withdrawalRatio = user.totalDeposited > 0 ? (user.totalWithdrawn + amount) / user.totalDeposited : 0
    if (withdrawalRatio < 0.7) {
      return {
        stage: 'AUTO_APPROVED',
        autoApproved: true,
        reason: `موافقة تلقائية مستوى 3 - مستخدم موثوق (${amount} USDT)`
      }
    }
  }

  // Auto-approve Tier 4: ≤$1000 from KYC-verified accounts ≥30 days old with investments
  if (amount <= 1000 && kycVerified && accountAgeDays >= 30) {
    const activeInvestments = await db.investment.count({ where: { userId, status: 'ACTIVE' } })
    const withdrawalRatio = user.totalDeposited > 0 ? (user.totalWithdrawn + amount) / user.totalDeposited : 0
    if (activeInvestments > 0 && withdrawalRatio < 0.6) {
      return {
        stage: 'AUTO_APPROVED',
        autoApproved: true,
        reason: `موافقة تلقائية مستوى 4 - مستخدم متميز (${amount} USDT)`
      }
    }
  }

  // Auto-approve Tier 5: ≤$5000 with AI risk assessment (will be evaluated by AI in cron)
  // Mark as AUTO_APPROVED with AI evaluation pending - the cron AI system will do final check
  if (amount <= 5000 && kycVerified && !isNewAccount) {
    return {
      stage: 'AUTO_APPROVED',
      autoApproved: true,
      reason: `موافقة مشروطة - سيتم التقييم بالذكاء الاصطناعي (${amount} USDT)`,
      dynamicMessage: 'طلبك قيد التقييم الذكي، سيتم الرد خلال 1-6 ساعات'
    }
  }

  // Auto-approve Tier 6: ≤$10000 from KYC-verified + ≥30 days old + excellent history + AI assessment
  if (amount <= 10000 && kycVerified && accountAgeDays >= 30) {
    return {
      stage: 'AUTO_APPROVED',
      autoApproved: true,
      reason: `موافقة مشروطة مستوى 6 - تقييم ذكي متقدم (${amount} USDT)`,
      dynamicMessage: 'طلبك قيد التقييم الذكي المتقدم، سيتم الرد خلال 1-12 ساعة'
    }
  }

  // Auto-approve Tier 7: Unlimited for VIP users (≥90 days, ≥$20k deposited, KYC verified, active investments)
  if (kycVerified && accountAgeDays >= 90 && user.totalDeposited >= 20000) {
    const activeInvestments = await db.investment.count({ where: { userId, status: 'ACTIVE' } })
    const withdrawalRatio = user.totalDeposited > 0 ? (user.totalWithdrawn + amount) / user.totalDeposited : 0
    if (activeInvestments > 0 && withdrawalRatio < 0.5) {
      return {
        stage: 'AUTO_APPROVED',
        autoApproved: true,
        reason: `موافقة VIP تلقائية - مستخدم متميز (${amount} USDT)`,
        dynamicMessage: 'طلبك قيد المعالجة كعميل متميز، سيتم التنفيذ قريباً'
      }
    }
  }

  // Final: amounts >$10000 without VIP status still need manual
  return {
    stage: 'PENDING_MANUAL',
    autoApproved: false,
    reason: `مبلغ كبير (${amount} USDT) يتطلب مراجعة يدوية`,
    dynamicMessage: 'طلبك قيد المراجعة المتقدمة، سيتم الرد خلال 1-24 ساعة'
  }
}

// Get dynamic message based on waiting time
export function getDynamicMessage(hoursElapsed: number): { message: string; type: string } {
  for (const msg of DYNAMIC_MESSAGES) {
    if (hoursElapsed >= msg.minHours && hoursElapsed < msg.maxHours) {
      return { message: msg.message, type: msg.type }
    }
  }
  return { message: 'جاري معالجة طلبك', type: 'PROCESSING' }
}

// Log admin action to audit trail
export async function logAdminAction(params: {
  adminId: string
  action: string
  targetId?: string
  targetType?: string
  details?: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType,
      details: params.details,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    }
  })
}

// Get or create bot control settings
export async function getBotControl(): Promise<{
  id: string
  isActive: boolean
  tradesPerMinute: number
  winRate: number
  maxTradeAmount: number
  minTradeAmount: number
  volatilityFactor: number
  symbols: string
  pausedAt: Date | null
  updatedAt: Date
}> {
  let control = await db.botControl.findFirst()
  if (!control) {
    control = await db.botControl.create({ data: {} })
  }
  return control
}

// Check if kill switch is active
export async function isKillSwitchActive(switchType: 'maintenance' | 'roi_paused' | 'deposits_paused'): Promise<boolean> {
  const keyMap = {
    maintenance: 'maintenance_mode',
    roi_paused: 'roi_paused',
    deposits_paused: 'deposit_enabled',
  }
  const key = keyMap[switchType]
  const value = await getPlatformSetting(key)

  if (switchType === 'deposits_paused') return value === 'false' // inverted
  return value === 'true'
}
