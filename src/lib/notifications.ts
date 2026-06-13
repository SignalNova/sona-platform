import { db } from '@/lib/db'

/**
 * Create a notification for a user
 */
export async function createNotification(params: {
  userId: string
  title: string
  message: string
  type: string
  data?: Record<string, unknown>
}) {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        data: params.data ? JSON.stringify(params.data) : null,
      },
    })
  } catch (error) {
    console.error('Create notification error:', error)
  }
}

/**
 * Create welcome notification when a new user registers
 * Sent in Syrian dialect
 */
export async function notifyWelcomeNewUser(userId: string, userName: string, email: string) {
  await createNotification({
    userId,
    title: 'أهلاً فيك بسونا!',
    message: `مرحباً ${userName}! تم إنشاء حسابك بنجاح وبريدك الإلكتروني (${email}) مسجل عندنا. بتفعيل بريدك رح تقدر تبدأ رحلتك الاستثمارية. عندنا باقات استثمارية مميزة بعوائد يومية تصل لـ 2.5%، ونظام إحالات بيعطيك عمولة 15% عندما يستثمر صديقك!`,
    type: 'PLATFORM',
    data: { action: 'welcome', email },
  })
}

/**
 * Create deposit notification when deposit is confirmed
 */
export async function notifyDepositConfirmed(userId: string, amount: number, currency: string) {
  await createNotification({
    userId,
    title: 'تم تأكيد الإيداع',
    message: `تم إيداع ${(amount ?? 0).toFixed(2)} USDT (${currency}) في حسابك بنجاح. رصيدك هلأ جاهز للاستثمار!`,
    type: 'DEPOSIT',
    data: { amount, currency },
  })
}

/**
 * Create deposit pending notification
 */
export async function notifyDepositCreated(userId: string, amount: number, currency: string) {
  await createNotification({
    userId,
    title: 'طلب إيداع جديد',
    message: `تم إنشاء طلب إيداع بقيمة ${(amount ?? 0).toFixed(2)} USDT (${currency}). بانتظار الدفع - بعد ما ترسل المبلغ للعنوان المحدد رح يتأكد تلقائياً خلال 5-30 دقيقة.`,
    type: 'DEPOSIT',
    data: { amount, currency },
  })
}

/**
 * Create withdrawal notification
 */
export async function notifyWithdrawalCreated(userId: string, amount: number, method: string) {
  await createNotification({
    userId,
    title: 'طلب سحب جديد',
    message: `تم إنشاء طلب سحب بقيمة ${(amount ?? 0).toFixed(2)} USDT عبر ${method}. رح يتم مراجعته خلال 24 ساعة والعاملة التلقائية بتنفذ أسرع.`,
    type: 'WITHDRAWAL',
    data: { amount, method },
  })
}

/**
 * Create withdrawal completed notification
 */
export async function notifyWithdrawalCompleted(userId: string, amount: number, method: string) {
  await createNotification({
    userId,
    title: 'تم السحب بنجاح',
    message: `تم إرسال ${(amount ?? 0).toFixed(2)} USDT إلى محفظتك عبر ${method}. راجع محفظتك خلال دقائق.`,
    type: 'WITHDRAWAL',
    data: { amount, method },
  })
}

/**
 * Create investment notification
 */
export async function notifyInvestmentCreated(userId: string, amount: number, packageName: string, dailyProfit: number) {
  await createNotification({
    userId,
    title: 'استثمار جديد',
    message: `تم استثمار ${(amount ?? 0).toFixed(2)} USDT في باقة ${packageName}. ربحك اليومي: ${(dailyProfit ?? 0).toFixed(2)} USDT - رح يضاف لرصيدك كل يوم!`,
    type: 'PROFIT',
    data: { amount, packageName, dailyProfit },
  })
}

/**
 * Create profit credited notification
 */
export async function notifyProfitCredited(userId: string, amount: number, investmentId: string) {
  await createNotification({
    userId,
    title: 'ربح يومي',
    message: `تم إضافة ${(amount ?? 0).toFixed(2)} USDT إلى رصيدك كأرباح يومية. رصيدك القابل للسحب هلأ متحدث!`,
    type: 'PROFIT',
    data: { amount, investmentId },
  })
}

/**
 * Create investment completed notification (duration ended)
 */
export async function notifyInvestmentCompleted(userId: string, packageName: string, totalProfit: number, returnedAmount: number) {
  await createNotification({
    userId,
    title: 'اكتمل الاستثمار',
    message: `اكتمل استثمارك في باقة ${packageName}. إجمالي الأرباح اللي حققتها: ${(totalProfit ?? 0).toFixed(2)} USDT. وتم إرجاع رأس المال: ${(returnedAmount ?? 0).toFixed(2)} USDT. بقدر تعيد استثمارها باقة جديدة أو تسحبها!`,
    type: 'PROFIT',
    data: { packageName, totalProfit, returnedAmount },
  })
}

/**
 * Create investment renewal/reinvest notification
 */
export async function notifyInvestmentReinvested(userId: string, amount: number, packageName: string, dailyProfit: number) {
  await createNotification({
    userId,
    title: 'تم تجديد الاستثمار',
    message: `تم إعادة استثمار ${(amount ?? 0).toFixed(2)} USDT في باقة ${packageName}. ربحك اليومي الجديد: ${(dailyProfit ?? 0).toFixed(2)} USDT. استثمارك استمر!`,
    type: 'PROFIT',
    data: { amount, packageName, dailyProfit, action: 'reinvest' },
  })
}

/**
 * Create commission notification (multi-level referral commission)
 */
export async function notifyCommissionCredited(userId: string, amount: number, fromUserName: string, commissionLevel: number) {
  const levelText = commissionLevel === 1 ? 'مباشرة' : commissionLevel === 2 ? 'مستوى ثاني' : 'مستوى ثالث'
  await createNotification({
    userId,
    title: 'عمولة إحالة جديدة',
    message: `حصلت على $${(amount ?? 0).toFixed(2)} كعمولة إحالة ${levelText} من ${fromUserName}. العمولة أضيفت لرصيدك القابل للسحب!`,
    type: 'REFERRAL',
    data: { amount, fromUserName, commissionLevel },
  })
}

/**
 * Create referral bonus notification
 */
export async function notifyReferralBonus(userId: string, amount: number, referredName: string) {
  await createNotification({
    userId,
    title: 'مكافأة إحالة',
    message: `حصلت على ${(amount ?? 0).toFixed(2)} USDT كمكافأة إحالة من ${referredName}. المبلغ أضيف لرصيدك!`,
    type: 'REFERRAL',
    data: { amount, referredName },
  })
}

/**
 * Create email verified notification
 */
export async function notifyEmailVerified(userId: string) {
  await createNotification({
    userId,
    title: 'تم تفعيل البريد الإلكتروني',
    message: 'تم تفعيل بريدك الإلكتروني بنجاح! هلأ تقدر تستخدم المنصة بالكامل وتبدأ استثمرك. جرب باقاتنا الاستثمارية!',
    type: 'SECURITY',
    data: { action: 'email_verified' },
  })
}

/**
 * Create KYC approved notification
 */
export async function notifyKycApproved(userId: string) {
  await createNotification({
    userId,
    title: 'تم التوثيق بنجاح',
    message: 'تم توثيق هويتك بنجاح! هلأ تقدر تسحب أي مبلغ من أرباحك بدون قيود. مبروك!',
    type: 'SECURITY',
    data: { action: 'kyc_approved' },
  })
}

/**
 * Create KYC rejected notification
 */
export async function notifyKycRejected(userId: string, reason: string) {
  await createNotification({
    userId,
    title: 'تم رفض التوثيق',
    message: `تم رفض طلب التوثيق. السبب: ${reason}. تقدر تعيد تقديم الطلب بعد تصحيح المشكلة من صفحة التحقق.`,
    type: 'SECURITY',
    data: { action: 'kyc_rejected', reason },
  })
}

/**
 * Create account security alert notification
 */
export async function notifySecurityAlert(userId: string, alertType: string, message: string) {
  await createNotification({
    userId,
    title: 'تنبيه أمني',
    message,
    type: 'SECURITY',
    data: { action: 'security_alert', alertType },
  })
}

/**
 * Send daily motivational notification based on user's portfolio status
 * Different messages based on account status:
 * - Has investments: focus on daily profit growth
 * - No investments yet: encourage to start investing
 * - Profitable: positive reinforcement with numbers
 * - New user (< 3 days): welcome and explore packages
 */
export async function notifyDailyMotivation(
  userId: string,
  userName: string,
  totalProfit: number,
  activeInvestments: number
) {
  let title: string
  let message: string

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // Get user creation date to check if new user
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  })

  const isNewUser = user && new Date(user.createdAt) >= threeDaysAgo

  if (isNewUser) {
    title = 'اكتشف بسونا! 💰'
    message = 'مرحباً فيك! اكتشف باقاتنا الاستثمارية وابدأ حقق أرباح 💰'
  } else if (activeInvestments > 0 && totalProfit > 0) {
    const dailyProfit = totalProfit / 30 // approximate daily profit
    title = 'أرباحك بتكبر! 📈'
    message = `أرباحك اليومية بتكبر محفظتك! عندك ${dailyProfit.toFixed(2)} USDT بتجمع كل يوم 📈`
  } else if (activeInvestments > 0) {
    title = 'استثمارك شغال! 🔄'
    message = 'أرباحك اليومية بتكبر محفظتك! عندك استثمارات فعالة بتجمع أرباح كل يوم 📈'
  } else {
    title = 'السوق متحرك! 🚀'
    message = 'السوق متحرك اليوم! لا تفوت فرصة الاستثمار 🚀'
  }

  await createNotification({
    userId,
    title,
    message,
    type: 'MOTIVATIONAL',
    data: { action: 'daily_motivation', totalProfit, activeInvestments, isNewUser },
  })
}

/**
 * Send welcome back notification for returning users who were absent
 * Warm welcome back message with balance reminder
 */
export async function notifyWelcomeBack(userId: string, userName: string, daysAbsent: number) {
  await createNotification({
    userId,
    title: 'نورت بسونا تاني! 🎉',
    message: `غيبتك طالت! رجعت وفرحتنا 🎉 عندك رصيد بيستناك`,
    type: 'PLATFORM',
    data: { action: 'welcome_back', daysAbsent },
  })
}

/**
 * Send milestone/achievement notification when user hits milestones
 * Milestones: first_investment, first_profit, profit_100, profit_500, profit_1000, profit_5000, profit_10000, referral_5, etc.
 */
export async function notifyMilestone(userId: string, milestone: string, value: number) {
  const milestoneMessages: Record<string, { title: string; message: string }> = {
    first_investment: {
      title: 'أول استثمار! 🎉',
      message: 'مبروك! عملت أول استثمار بسونا! رحلتك بدأت 🚀',
    },
    first_profit: {
      title: 'أول ربح! 💰',
      message: 'مبروك! حصلت على أول أرباحك بسونا! البداية بس 💪',
    },
    profit_100: {
      title: 'وصلت $100! 🎯',
      message: 'مبروك! وصلت أرباحك لـ $100! 🎯 استمر بسونا',
    },
    profit_500: {
      title: 'وصلت $500! 🏆',
      message: 'مبروك! وصلت أرباحك لـ $500! 🏆 أنت محترف!',
    },
    profit_1000: {
      title: 'وصلت $1,000! 💎',
      message: 'مبروك! وصلت أرباحك لـ $1,000! 💎 أنت نجم بسونا!',
    },
    profit_5000: {
      title: 'وصلت $5,000! 👑',
      message: 'مبروك! وصلت أرباحك لـ $5,000! 👑 أنت من كبار المستثمرين!',
    },
    profit_10000: {
      title: 'وصلت $10,000! 🌟',
      message: 'مبروك! وصلت أرباحك لـ $10,000! 🌟 أنت أسطورة بسونا!',
    },
    referral_5: {
      title: '5 إحالات! 🤝',
      message: 'مبروك! جبت 5 أصدقاء بسونا! 🤝 شبكتك بتكبر!',
    },
    referral_10: {
      title: '10 إحالات! 🌐',
      message: 'مبروك! جبت 10 أصدقاء بسونا! 🌐 أنت سفير النجاح!',
    },
  }

  const milestoneData = milestoneMessages[milestone] || {
    title: 'إنجاز جديد! 🎖️',
    message: `مبروك! حققت إنجاز جديد بسونا! 🎖️`,
  }

  await createNotification({
    userId,
    title: milestoneData.title,
    message: milestoneData.message,
    type: 'MILESTONE',
    data: { action: 'milestone', milestone, value },
  })
}

/**
 * Send smart tip notification based on user behavior
 * tipTypes: 'reinvest', 'diversify', 'withdraw', 'upgrade', 'invite'
 */
export async function notifySmartTip(userId: string, tipType: string) {
  const tipMessages: Record<string, { title: string; message: string }> = {
    reinvest: {
      title: 'نصيحة سونا 💡',
      message: 'نصيحة سونا: أعِد استثمار أرباحك لتضاعفها! 💡',
    },
    diversify: {
      title: 'نصيحة سونا 💡',
      message: 'نصيحة سونا: وزّع استثماراتك على باقات مختلفة لتقلل المخاطر! 💡',
    },
    withdraw: {
      title: 'نصيحة سونا 💡',
      message: 'نصيحة سونا: عندك رصيد قابل للسحب! سحب جزء وتأمين أرباحك فكرة ذكية 💡',
    },
    upgrade: {
      title: 'نصيحة سونا 💡',
      message: 'نصيحة سونا: ارتقِ لباقة أعلى لتحصل على عوائد أكبر! 💡',
    },
    invite: {
      title: 'نصيحة سونا 💡',
      message: 'نصيحة سونا: ادعو أصدقائك واحصل على عمولة 15% من استثماراتهم! 💡',
    },
  }

  const tipData = tipMessages[tipType] || {
    title: 'نصيحة سونا 💡',
    message: 'نصيحة سونا: استثمر ذكياً واتبع خطتك! 💡',
  }

  await createNotification({
    userId,
    title: tipData.title,
    message: tipData.message,
    type: 'PLATFORM',
    data: { action: 'smart_tip', tipType },
  })
}

/**
 * Send account verification reminder for users who created account
 * but didn't verify within 24 hours
 */
export async function notifyAccountCreatedReminder(userId: string, userName: string, email: string) {
  await createNotification({
    userId,
    title: 'حسابك ناطر تفعيلك! 📧',
    message: 'حسابك بسونا ناطر تفعيلك! فعل بريدك وابدأ رحلتك 📧',
    type: 'PLATFORM',
    data: { action: 'verify_reminder', email },
  })
}
