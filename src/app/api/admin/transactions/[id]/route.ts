import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequestOrUserId } from '../../middleware'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Read body first, then verify admin using userId from body
    const body = await request.json()
    const { status: newStatus, userId: adminUserId } = body

    // Verify admin access
    await getAdminFromRequestOrUserId(request, adminUserId)

    if (!newStatus || !['APPROVED', 'REJECTED', 'PROCESSING', 'approved', 'rejected', 'processing'].includes(newStatus)) {
      return NextResponse.json(
        { error: 'الحالة غير صالحة. يجب أن تكون: APPROVED, REJECTED, أو PROCESSING' },
        { status: 400 }
      )
    }

    // Normalize status to UPPERCASE
    const normalizedStatus = newStatus.toUpperCase()

    const transaction = await db.transaction.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'المعاملة غير موجودة' },
        { status: 404 }
      )
    }

    const currentStatus = transaction.status.toUpperCase()

    // If already COMPLETED (e.g. auto-completed by check-status), return gracefully
    if (currentStatus === 'COMPLETED') {
      return NextResponse.json(
        { message: 'تم إتمام هذه المعاملة بالفعل تلقائياً', transaction },
        { status: 200 }
      )
    }

    if (currentStatus !== 'PENDING' && currentStatus !== 'PROCESSING') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل معاملة تم معالجتها بالفعل' },
        { status: 400 }
      )
    }

    let updatedTransaction

    if (transaction.type === 'DEPOSIT' || transaction.type === 'deposit') {
      if (normalizedStatus === 'APPROVED') {
        // Approve deposit: add amount to user balance, update totalDeposited
        updatedTransaction = await db.$transaction(async (tx) => {
          const updated = await tx.transaction.update({
            where: { id },
            data: { status: 'COMPLETED' },
          })

          await tx.user.update({
            where: { id: transaction.userId },
            data: {
              balance: { increment: transaction.amount },
              totalDeposited: { increment: transaction.amount },
            },
          })

          return updated
        })

        // Notify user about approved deposit
        await createNotification({
          userId: transaction.userId,
          title: 'تم تأكيد الإيداع',
          message: `تم تأكيد إيداعك بمبلغ ${(transaction.amount ?? 0).toFixed(2)} USDT وإضافته إلى رصيدك بنجاح.`,
          type: 'DEPOSIT',
          data: { amount: transaction.amount, transactionId: id },
        })
      } else if (normalizedStatus === 'REJECTED') {
        // Reject deposit: mark as failed
        updatedTransaction = await db.transaction.update({
          where: { id },
          data: { status: 'REJECTED' },
        })

        // Notify user about rejected deposit
        await createNotification({
          userId: transaction.userId,
          title: 'تم رفض الإيداع',
          message: `تم رفض طلب الإيداع بمبلغ ${(transaction.amount ?? 0).toFixed(2)} USDT. يرجى التواصل مع الدعم للمزيد من التفاصيل.`,
          type: 'DEPOSIT',
          data: { amount: transaction.amount, transactionId: id },
        })
      }
    } else if (transaction.type === 'WITHDRAWAL' || transaction.type === 'withdrawal') {
      if (normalizedStatus === 'APPROVED') {
        // Approve withdrawal: deduct from user balance and mark as completed
        updatedTransaction = await db.$transaction(async (tx) => {
          // Re-check status within transaction to prevent double-deduction
          // (could have been auto-completed by check-status endpoint between our read and write)
          const currentTx = await tx.transaction.findUnique({ where: { id } })
          if (currentTx?.status === 'COMPLETED') {
            // Already auto-completed - don't deduct again
            return currentTx
          }

          // Check user has enough balance
          const currentUser = await tx.user.findUnique({
            where: { id: transaction.userId },
          })
          if (!currentUser || currentUser.balance < transaction.amount) {
            throw new Error('رصيد المستخدم غير كافي لإتمام السحب')
          }

          const updated = await tx.transaction.update({
            where: { id },
            data: { status: 'COMPLETED' },
          })

          await tx.user.update({
            where: { id: transaction.userId },
            data: {
              balance: { decrement: transaction.amount },
              totalWithdrawn: { increment: transaction.amount },
            },
          })

          return updated
        })

        // Notify user about approved withdrawal
        await createNotification({
          userId: transaction.userId,
          title: 'تمت الموافقة على السحب',
          message: `تمت الموافقة على طلب سحبك بمبلغ ${(transaction.amount ?? 0).toFixed(2)} USDT وسيتم تحويله قريباً.`,
          type: 'WITHDRAWAL',
          data: { amount: transaction.amount, transactionId: id },
        })
      } else if (normalizedStatus === 'REJECTED') {
        // Reject withdrawal: refund withdrawableBalance (was decremented when withdrawal was created)
        updatedTransaction = await db.$transaction(async (tx) => {
          const updated = await tx.transaction.update({
            where: { id },
            data: { status: 'REJECTED' },
          })
          // Refund the withdrawableBalance since the withdrawal is cancelled
          await tx.user.update({
            where: { id: transaction.userId },
            data: {
              withdrawableBalance: { increment: transaction.amount },
            },
          })
          return updated
        })

        // Notify user about rejected withdrawal
        await createNotification({
          userId: transaction.userId,
          title: 'تم رفض طلب السحب',
          message: `تم رفض طلب سحبك بمبلغ ${(transaction.amount ?? 0).toFixed(2)} USDT. يرجى التواصل مع الدعم للمزيد من التفاصيل.`,
          type: 'WITHDRAWAL',
          data: { amount: transaction.amount, transactionId: id },
        })
      } else if (normalizedStatus === 'PROCESSING') {
        // Mark as processing
        updatedTransaction = await db.transaction.update({
          where: { id },
          data: { status: 'PROCESSING' },
        })

        // Notify user about processing withdrawal
        await createNotification({
          userId: transaction.userId,
          title: 'جاري معالجة السحب',
          message: `طلب سحبك بمبلغ ${(transaction.amount ?? 0).toFixed(2)} USDT قيد المعالجة الآن وسيتم تحويله قريباً.`,
          type: 'WITHDRAWAL',
          data: { amount: transaction.amount, transactionId: id },
        })
      }
    } else {
      // For other transaction types (investment, profit, referral_bonus)
      const finalStatus = normalizedStatus === 'APPROVED' ? 'COMPLETED' : normalizedStatus === 'REJECTED' ? 'REJECTED' : normalizedStatus
      updatedTransaction = await db.transaction.update({
        where: { id },
        data: { status: finalStatus },
      })
    }

    return NextResponse.json(
      {
        message: 'تم تحديث حالة المعاملة بنجاح',
        transaction: updatedTransaction,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin update transaction error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث المعاملة' },
      { status: 500 }
    )
  }
}
