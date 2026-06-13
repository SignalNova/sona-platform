import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyIPN, isPaymentSuccessful, isPaymentPending } from '@/lib/nowpayments'
import { notifyDepositConfirmed, createNotification } from '@/lib/notifications'

// NowPayments IPN Callback - Called by NowPayments servers when payment status changes
// Signature verification is ALWAYS mandatory - no bypasses
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Get the signature header from NowPayments - MANDATORY
    const signature = req.headers.get('x-nowpayments-sig') || ''

    console.log('NowPayments IPN received:', JSON.stringify(body))

    // Verify IPN signature - ALWAYS REQUIRED, NO EXCEPTIONS
    const isValid = verifyIPN(body, signature)
    if (!isValid) {
      console.error('IPN verification FAILED - REJECTED:', JSON.stringify(body))
      return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 403 })
    }

    const {
      payment_id,
      payment_status,
      pay_amount,
      pay_currency,
      price_amount,
      order_id,
      outcome_amount,
      outcome_currency,
      pay_address,
      purchase_id,
    } = body

    if (!payment_id || !payment_status) {
      return NextResponse.json({ error: 'Invalid IPN data' }, { status: 400 })
    }

    // Find the transaction by NowPayments ID
    const transaction = await db.transaction.findFirst({
      where: { nowpaymentsId: String(payment_id) },
    })

    if (!transaction) {
      console.warn(`No transaction found for NowPayments ID: ${payment_id}`)
      return NextResponse.json({ received: true })
    }

    // If payment is successful, credit the user's account
    // SECURITY: Status check and credit happen inside a transaction to prevent double-credit
    if (isPaymentSuccessful(payment_status)) {
      // SECURITY: Use the ORIGINAL transaction amount from our DB as the source of truth
      // Never trust amounts from the IPN body - they could be manipulated
      const creditAmount = transaction.amount

      // Log if there's a discrepancy (potential manipulation attempt)
      const ipnAmount = price_amount || pay_amount
      if (ipnAmount && Math.abs(ipnAmount - transaction.amount) > 0.01) {
        console.error(`[SECURITY] NOWPayments IPN amount mismatch! DB: ${transaction.amount}, IPN: ${ipnAmount}, Payment: ${payment_id}`)
      }

      try {
        await db.$transaction(async (tx) => {
          // Re-read transaction within transaction to prevent double-credit race condition
          const currentTx = await tx.transaction.findUnique({
            where: { id: transaction.id },
            select: { status: true },
          })

          if (!currentTx || currentTx.status === 'COMPLETED') {
            // Already credited - skip
            return
          }

          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'COMPLETED',
              nowpaymentsStatus: payment_status,
              txHash: body.tx_hash || transaction.txHash,
            },
          })

          await tx.user.update({
            where: { id: transaction.userId },
            data: {
              balance: { increment: creditAmount },
              withdrawableBalance: { increment: creditAmount },
              totalDeposited: { increment: creditAmount },
            },
          })
        })

        // Send deposit confirmed notification to user
        await notifyDepositConfirmed(
          transaction.userId,
          creditAmount,
          pay_currency || transaction.cryptoCurrency || 'USD'
        )

        console.log(`[NOWPayments IPN] Deposit completed: User ${transaction.userId} credited ${creditAmount} USDT (Payment ${payment_id})`)
      } catch (txErr) {
        console.error('[NOWPayments IPN] Transaction error (possible duplicate):', txErr)
      }
    } else {
      // Update the transaction with the latest status (for non-successful statuses)
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          nowpaymentsStatus: payment_status,
          txHash: body.tx_hash || transaction.txHash,
        },
      })
    }

    // If payment failed or expired, mark as rejected
    if (['failed', 'expired', 'refunded'].includes(payment_status) && (transaction.status === 'PENDING' || transaction.status === 'pending')) {
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'REJECTED',
          nowpaymentsStatus: payment_status,
          adminNote: `Payment ${payment_status} via NowPayments (IPN verified)`,
        },
      })

      // Notify user about failed/expired deposit
      await createNotification({
        userId: transaction.userId,
        title: 'فشل الإيداع',
        message: `فشل إيداع بمبلغ ${(transaction.amount ?? 0).toFixed(2)} USDT. السبب: الدفعة ${payment_status === 'expired' ? 'انتهت صلاحيتها' : 'فشلت'}. يمكنك إنشاء طلب إيداع جديد.`,
        type: 'DEPOSIT',
        data: { amount: transaction.amount, status: payment_status },
      })

      console.log(`[NOWPayments IPN] Deposit ${payment_status}: Transaction ${transaction.id}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('NowPayments IPN error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
