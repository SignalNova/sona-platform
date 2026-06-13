import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { logAdminAction, getDynamicMessage, getPlatformSetting } from '@/lib/staged-withdrawal'
import { createNotification } from '@/lib/notifications'

// GET: List all withdrawal requests with queue status + real liquidity
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = { type: 'WITHDRAWAL' }
    if (status) where.status = status

    const [transactions, total, queueItems] = await Promise.all([
      db.transaction.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, withdrawableBalance: true, lockedCapital: true } }, withdrawalQueue: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transaction.count({ where }),
      db.withdrawalQueue.findMany({ where: { stage: { in: ['AUTO_REVIEW', 'PENDING_MANUAL'] } }, orderBy: { priority: 'desc' } }),
    ])

    // Calculate real platform liquidity
    const totalWithdrawable = (await db.user.aggregate({ _sum: { withdrawableBalance: true } }))._sum.withdrawableBalance || 0
    const totalLockedCapital = (await db.user.aggregate({ _sum: { lockedCapital: true } }))._sum.lockedCapital || 0
    const totalDeposited = (await db.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'COMPLETED' }, _sum: { amount: true } }))._sum.amount || 0
    const totalWithdrawn = (await db.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: { in: ['COMPLETED', 'PROCESSING'] } }, _sum: { amount: true } }))._sum.amount || 0

    // Real wallet balance from platform settings (admin can update this)
    const realWalletBalance = parseFloat(await getPlatformSetting('real_wallet_balance') || '0')

    // Add dynamic messages to pending transactions
    const enrichedTransactions = transactions.map(tx => {
      const queue = tx.withdrawalQueue[0]
      let dynamicMsg = null
      if (tx.status === 'PENDING' || tx.status === 'PROCESSING') {
        const hoursElapsed = (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60)
        dynamicMsg = getDynamicMessage(hoursElapsed)
      }
      return { ...tx, dynamicMessage: dynamicMsg, queueStage: queue?.stage || null }
    })

    return NextResponse.json({
      transactions: enrichedTransactions,
      queueItems,
      liquidity: {
        realWalletBalance,
        totalWithdrawable,
        totalLockedCapital,
        totalDeposited,
        totalWithdrawn,
        netPosition: totalDeposited - totalWithdrawn,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin withdrawals error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Approve/Reject withdrawals
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const body = await request.json()
    const { action, transactionId, reason } = body
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const tx = await db.transaction.findUnique({ where: { id: transactionId }, include: { user: true } })
    if (!tx) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })

    if (action === 'approve') {
      // SECURITY: Use interactive transaction with status re-check to prevent double-processing
      await db.$transaction(async (tx) => {
        const currentTx = await tx.transaction.findUnique({ where: { id: transactionId } })
        if (!currentTx) throw new Error('Transaction not found')
        if (currentTx.status === 'COMPLETED') return // Already processed - prevent double-spend
        
        await tx.transaction.update({ where: { id: transactionId }, data: { status: 'COMPLETED', adminNote: reason || 'تمت الموافقة' } })
        await tx.user.update({ where: { id: currentTx.userId }, data: { totalWithdrawn: { increment: currentTx.amount } } })
        await tx.withdrawalQueue.updateMany({ where: { transactionId }, data: { stage: 'APPROVED', reviewedBy: admin.id, reviewedAt: new Date() } })
      })

      await logAdminAction({ adminId: admin.id, action: 'APPROVE_WITHDRAWAL', targetId: transactionId, targetType: 'TRANSACTION', details: `Approved withdrawal ${tx.amount} USDT for ${tx.user.email}`, ipAddress, userAgent })
      await createNotification({ userId: tx.userId, title: 'تمت الموافقة على السحب', message: `تمت الموافقة على طلب سحبك بقيمة ${tx.amount} USDT وسيتم التحويل قريباً`, type: 'WITHDRAWAL', data: { transactionId, amount: tx.amount } })

      return NextResponse.json({ message: 'تمت الموافقة على السحب' })
    }

    if (action === 'reject') {
      // SECURITY: Use interactive transaction with status re-check
      await db.$transaction(async (tx) => {
        const currentTx = await tx.transaction.findUnique({ where: { id: transactionId } })
        if (!currentTx) throw new Error('Transaction not found')
        if (currentTx.status === 'REJECTED' || currentTx.status === 'COMPLETED') return // Already processed
        
        await tx.transaction.update({ where: { id: transactionId }, data: { status: 'REJECTED', adminNote: reason || 'مرفوض' } })
        await tx.user.update({ where: { id: currentTx.userId }, data: { withdrawableBalance: { increment: currentTx.amount } } })
        await tx.withdrawalQueue.updateMany({ where: { transactionId }, data: { stage: 'REJECTED', reviewedBy: admin.id, reviewedAt: new Date() } })
      })

      await logAdminAction({ adminId: admin.id, action: 'REJECT_WITHDRAWAL', targetId: transactionId, targetType: 'TRANSACTION', details: `Rejected withdrawal ${tx.amount} USDT for ${tx.user.email}. Reason: ${reason}`, ipAddress, userAgent })
      await createNotification({ userId: tx.userId, title: 'تم رفض طلب السحب', message: `تم رفض طلب سحبك بقيمة ${tx.amount} USDT. السبب: ${reason || 'لم يتم تحديد سبب'}`, type: 'WITHDRAWAL', data: { transactionId, amount: tx.amount, reason } })

      return NextResponse.json({ message: 'تم رفض السحب وإعادة المبلغ' })
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin withdrawal action error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
