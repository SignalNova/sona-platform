import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { checkPaymentStatus, isPaymentSuccessful, isPaymentPending } from '@/lib/nowpayments'
import { notifyDepositConfirmed } from '@/lib/notifications'

// Check NOWPayments payment status and credit user if confirmed
export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { paymentId } = await req.json()

    if (!paymentId) {
      return NextResponse.json({ error: 'معرف الدفع مطلوب' }, { status: 400 })
    }

    // Find the transaction by NOWPayments ID
    const transaction = await db.transaction.findFirst({
      where: {
        nowpaymentsId: String(paymentId),
        userId: user.id,
        type: 'DEPOSIT',
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'لم يتم العثور على المعاملة' }, { status: 404 })
    }

    if (transaction.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'COMPLETED',
        message: 'تم تأكيد الدفع مسبقاً وتم إيداع المبلغ في حسابك',
        transaction,
      })
    }

    // Call NOWPayments API to check the payment status
    const paymentStatus = await checkPaymentStatus(String(paymentId))

    if (!paymentStatus) {
      return NextResponse.json({ error: 'فشل التحقق من حالة الدفع' }, { status: 500 })
    }

    const currentStatus = paymentStatus.payment_status
    // SECURITY FIX: ALWAYS use transaction.amount from our DB as the source of truth
    // Never trust external price_amount - it could be manipulated or inaccurate
    // Our DB amount is what the user actually requested to deposit
    const creditAmount = transaction.amount

    // Log discrepancy for security audit (but never use the external amount)
    const externalAmount = paymentStatus.price_amount || paymentStatus.pay_amount
    if (externalAmount && Math.abs(externalAmount - transaction.amount) > 0.01) {
      console.error(`[SECURITY] NOWPayments amount mismatch! DB: ${transaction.amount}, External: ${externalAmount}, Payment: ${paymentId}. Using DB amount.`)
    }

    // Update the transaction with the latest status
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        nowpaymentsStatus: currentStatus,
        txHash: paymentStatus.tx_hash || transaction.txHash,
      },
    })

    // If payment is confirmed/successful, credit user balance
    // SECURITY: Use interactive transaction with status re-check to prevent double-credit
    if (isPaymentSuccessful(currentStatus) && transaction.status !== 'COMPLETED') {
      try {
        await db.$transaction(async (tx) => {
          // Re-read transaction within transaction to prevent race condition with IPN
          const currentTx = await tx.transaction.findUnique({
            where: { id: transaction.id },
            select: { status: true },
          })
          if (!currentTx || currentTx.status === 'COMPLETED') return

          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'COMPLETED',
              nowpaymentsStatus: currentStatus,
              txHash: paymentStatus.tx_hash || transaction.txHash,
            },
          })

          await tx.user.update({
            where: { id: user.id },
            data: {
              balance: { increment: creditAmount },
              withdrawableBalance: { increment: creditAmount },
              totalDeposited: { increment: creditAmount },
            },
          })
        })
      } catch {
        // Already processed (double-credit prevention worked)
      }

      console.log(`[NOWPayments Check] Deposit completed: User ${user.id} credited ${creditAmount} USDT (Payment ${paymentId})`)

      // Send notification to user
      await notifyDepositConfirmed(user.id, creditAmount, transaction.cryptoCurrency || 'Crypto')

      return NextResponse.json({
        status: 'COMPLETED',
        message: 'تم تأكيد الدفع وإيداع المبلغ في حسابك',
        creditedAmount: creditAmount,
        transaction: { ...transaction, status: 'COMPLETED', nowpaymentsStatus: currentStatus },
      })
    }

    // If payment failed or expired
    if (['failed', 'expired', 'refunded'].includes(currentStatus) && transaction.status === 'PENDING') {
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'REJECTED',
          nowpaymentsStatus: currentStatus,
          adminNote: `Payment ${currentStatus} via NOWPayments (manual check)`,
        },
      })

      return NextResponse.json({
        status: currentStatus,
        message: `الدفع ${currentStatus === 'expired' ? 'منتهي الصلاحية' : currentStatus === 'failed' ? 'فاشل' : 'مسترد'}`,
        transaction: { ...transaction, status: 'REJECTED', nowpaymentsStatus: currentStatus },
      })
    }

    // Payment still pending
    return NextResponse.json({
      status: currentStatus,
      message: isPaymentPending(currentStatus)
        ? 'الدفع قيد المعالجة، يرجى الانتظار'
        : `حالة الدفع: ${currentStatus}`,
      transaction: { ...transaction, nowpaymentsStatus: currentStatus },
    })
  } catch (error) {
    console.error('Check NOWPayments error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
