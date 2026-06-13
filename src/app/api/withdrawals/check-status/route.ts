import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getWithdrawalStatus } from '@/lib/binance'
import { createNotification } from '@/lib/notifications'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    // Find all PROCESSING withdrawals for this user
    const processingWithdrawals = await db.transaction.findMany({
      where: {
        userId: user.id,
        type: 'WITHDRAWAL',
        status: 'PROCESSING',
      },
      orderBy: { createdAt: 'desc' },
    })

    const updatedWithdrawals: any[] = []

    for (const withdrawal of processingWithdrawals) {
      try {
        // Check if this withdrawal has a Binance txHash/ID
        const hasBinanceId = withdrawal.txHash && withdrawal.txHash.length > 0

        if (hasBinanceId) {
          // Try to check Binance withdrawal status
          const binanceStatus = await getWithdrawalStatus(withdrawal.txHash!)

          if (binanceStatus.success) {
            // Binance status codes: 0=Email Sent, 1=Cancelled, 2=Awaiting Approval, 
            // 3=Rejected, 4=Processing, 5=Failure, 6=Completed
            const status = binanceStatus.status
            const statusNum = parseInt(status || '', 10)

            if (statusNum === 6 || status === '6' || status?.toLowerCase() === 'completed') {
              // Blockchain confirmed! Deduct balance and mark COMPLETED
              await completeWithdrawal(withdrawal)
              updatedWithdrawals.push({ ...withdrawal, status: 'COMPLETED' })
              continue
            } else if (statusNum === 5 || status === '5' || status?.toLowerCase() === 'failure' ||
                       statusNum === 3 || status === '3' || status?.toLowerCase() === 'rejected') {
              // Blockchain failed! Mark REJECTED, don't deduct balance
              await rejectWithdrawal(withdrawal)
              updatedWithdrawals.push({ ...withdrawal, status: 'REJECTED' })
              continue
            }
            // Still processing on Binance side - leave as PROCESSING
          }
        }

        // SECURITY FIX: Withdrawals without Binance ID are NOT auto-completed.
        // They must be manually approved by an admin or stay in PROCESSING status.
        // Previously, withdrawals were auto-completed after 2 minutes without
        // blockchain confirmation, which allowed fake withdrawal confirmations.
        // If Binance is unavailable, the withdrawal stays PROCESSING until
        // an admin manually reviews and approves it.
      } catch (error) {
        console.error(`Error checking withdrawal ${withdrawal.id}:`, error)
        // Don't crash the whole loop for one error - continue checking others
      }
    }

    // Return the updated list and current balance
    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
      select: { balance: true },
    })

    return NextResponse.json({
      updated: updatedWithdrawals,
      balance: updatedUser?.balance ?? user.balance,
    })
  } catch (error) {
    console.error('Check withdrawal status error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

/**
 * Complete a withdrawal: deduct balance + mark COMPLETED + notify user
 */
async function completeWithdrawal(withdrawal: { id: string; userId: string; amount: number }) {
  await db.$transaction(async (tx) => {
    // Check the withdrawal is still PROCESSING (prevent race conditions)
    const current = await tx.transaction.findUnique({
      where: { id: withdrawal.id },
    })
    if (!current || current.status !== 'PROCESSING') {
      // Already processed by another path (e.g. admin approval)
      return
    }

    // Verify user has enough balance
    const currentUser = await tx.user.findUnique({
      where: { id: withdrawal.userId },
    })
    if (!currentUser || currentUser.balance < withdrawal.amount) {
      throw new Error('رصيد المستخدم غير كافي')
    }

    // Mark as COMPLETED
    await tx.transaction.update({
      where: { id: withdrawal.id },
      data: { status: 'COMPLETED' },
    })

    // Deduct balance and increment totalWithdrawn
    await tx.user.update({
      where: { id: withdrawal.userId },
      data: {
        balance: { decrement: withdrawal.amount },
        totalWithdrawn: { increment: withdrawal.amount },
      },
    })
  })

  // Notify user about completed withdrawal
  await createNotification({
    userId: withdrawal.userId,
    title: 'تم إتمام السحب بنجاح',
    message: `تم تحويل ${(withdrawal.amount ?? 0).toFixed(2)} USDT إلى محفظتك بنجاح. تم خصم المبلغ من رصيدك.`,
    type: 'WITHDRAWAL',
    data: { amount: withdrawal.amount, transactionId: withdrawal.id },
  })
}

/**
 * Reject a withdrawal: mark REJECTED + notify user (no balance deduction)
 */
async function rejectWithdrawal(withdrawal: { id: string; userId: string; amount: number }) {
  // Mark as REJECTED (no balance deduction needed - was never deducted)
  await db.transaction.update({
    where: { id: withdrawal.id },
    data: { status: 'REJECTED' },
  })

  // Notify user about rejected withdrawal
  await createNotification({
    userId: withdrawal.userId,
    title: 'فشل طلب السحب',
    message: `فشل طلب سحبك بمبلغ ${(withdrawal.amount ?? 0).toFixed(2)} USDT. لم يتم خصم أي مبلغ من رصيدك. يرجى التواصل مع الدعم للمزيد من التفاصيل.`,
    type: 'WITHDRAWAL',
    data: { amount: withdrawal.amount, transactionId: withdrawal.id },
  })
}
