import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ===== SUPPORT RESOLVE API =====
// Allows the AI support system to actually check and resolve common user issues
// This is called by the support AI when it needs real data to help a user

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { action } = await req.json()
    const userId = String(user.id)

    switch (action) {
      case 'check_deposit': {
        // Check latest deposit status for the user
        const latestDeposit = await db.transaction.findFirst({
          where: { userId, type: 'DEPOSIT' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })
        if (!latestDeposit) {
          return NextResponse.json({ found: false, message: 'لا توجد عمليات إيداع مسجلة' })
        }
        return NextResponse.json({
          found: true,
          deposit: {
            id: latestDeposit.id,
            amount: latestDeposit.amount,
            status: latestDeposit.status,
            createdAt: latestDeposit.createdAt,
            details: latestDeposit.details,
          },
          message: getStatusMessage(latestDeposit.status, 'deposit'),
        })
      }

      case 'check_withdrawal': {
        // Check latest withdrawal status
        const latestWithdrawal = await db.transaction.findFirst({
          where: { userId, type: 'WITHDRAWAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })
        if (!latestWithdrawal) {
          return NextResponse.json({ found: false, message: 'لا توجد عمليات سحب مسجلة' })
        }
        return NextResponse.json({
          found: true,
          withdrawal: {
            id: latestWithdrawal.id,
            amount: latestWithdrawal.amount,
            status: latestWithdrawal.status,
            createdAt: latestWithdrawal.createdAt,
            details: latestWithdrawal.details,
          },
          message: getStatusMessage(latestWithdrawal.status, 'withdrawal'),
        })
      }

      case 'check_kyc': {
        const kycStatus = user.kycStatus
        let message = ''
        if (kycStatus === 'VERIFIED' || kycStatus === 'APPROVED') {
          message = 'حسابك موثق بالفامل يمكنك سحب أي مبلغ.'
        } else if (kycStatus === 'PENDING') {
          message = 'طلب التوثيق قيد المراجعة حالياً. عادةً يتم المراجعة خلال 24 ساعة.'
        } else if (kycStatus === 'REJECTED') {
          const reason = user.kycRejectReason || 'غير محدد'
          const code = user.kycRejectCode || ''
          message = `تم رفض التوثيق. السبب: ${reason}. يمكنك إعادة التقديم من صفحة التحقق.`
          if (code) message += ` (كود الخطأ: ${code})`
        } else {
          message = 'لم يتم تقديم طلب توثيق بعد. يمكنك التقديم من صفحة التحقق.'
        }
        return NextResponse.json({
          found: true,
          kyc: {
            status: kycStatus,
            rejectReason: user.kycRejectReason || null,
            rejectCode: user.kycRejectCode || null,
            submittedAt: user.kycSubmittedAt || null,
            verifiedAt: user.kycVerifiedAt || null,
          },
          message,
        })
      }

      case 'check_investments': {
        const activeInvestments = await db.investment.findMany({
          where: { userId, status: 'ACTIVE' },
          include: { package: true },
        })
        if (activeInvestments.length === 0) {
          return NextResponse.json({ found: false, message: 'لا توجد استثمارات نشطة حالياً' })
        }
        return NextResponse.json({
          found: true,
          investments: activeInvestments.map(inv => ({
            id: inv.id,
            packageName: inv.package?.name || inv.package?.nameEn || 'غير معروفة',
            amount: inv.amount,
            totalProfit: inv.totalProfit,
            releasedAmount: inv.releasedAmount,
            startDate: inv.startDate,
            status: inv.status,
            dailyReturn: inv.package?.monthlyReturn || 0,
            durationDays: inv.package?.durationDays || 0,
          })),
          message: `لديك ${activeInvestments.length} استثمار نشط`,
        })
      }

      case 'check_account': {
        return NextResponse.json({
          found: true,
          account: {
            balance: user.balance,
            withdrawableBalance: user.withdrawableBalance,
            totalDeposited: user.totalDeposited,
            totalWithdrawn: user.totalWithdrawn,
            totalProfit: user.totalProfit,
            isFrozen: user.isFrozen || false,
            frozenUntil: user.frozenUntil || null,
            freezeReason: user.freezeReason || null,
            isBlacklisted: user.isBlacklisted || false,
            kycStatus: user.kycStatus,
            emailVerified: user.emailVerified,
          },
          message: user.isFrozen
            ? `حسابك مجمد. السبب: ${user.freezeReason || 'غير محدد'}${user.frozenUntil ? ` حتى ${new Date(user.frozenUntil).toLocaleDateString('ar')}` : ''}`
            : 'حسابك نشط وطبيعي.',
        })
      }

      case 'check_recent_transactions': {
        const recentTxs = await db.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
        return NextResponse.json({
          found: recentTxs.length > 0,
          transactions: recentTxs.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            status: tx.status,
            createdAt: tx.createdAt,
            details: tx.details,
          })),
          message: recentTxs.length > 0 ? `آخر ${recentTxs.length} معاملات` : 'لا توجد معاملات',
        })
      }

      default:
        return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
    }
  } catch (error) {
    console.error('Support resolve error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

function getStatusMessage(status: string, type: 'deposit' | 'withdrawal'): string {
  const typeLabel = type === 'deposit' ? 'الإيداع' : 'السحب'
  switch (status) {
    case 'COMPLETED':
      return `${typeLabel} مكتمل بنجاح.`
    case 'PENDING':
      return `${typeLabel} قيد الانتظار. يتم المراجعة تلقائياً خلال 5-30 دقيقة.`
    case 'PROCESSING':
      return `${typeLabel} قيد المعالجة حالياً.`
    case 'APPROVED':
      return `تمت الموافقة على ${typeLabel}. سيتم التنفيذ قريباً.`
    case 'REJECTED':
    case 'FAILED':
      return `${typeLabel} مرفوض/فاشل. يرجى التواصل مع الدعم لمعرفة السبب.`
    default:
      return `حالة ${typeLabel}: ${status}`
  }
}
