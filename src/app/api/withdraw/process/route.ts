import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Admin authentication check
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'غير مصرح - يتطلب صلاحيات المسؤول' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json(
        { error: 'معرف المعاملة مطلوب' },
        { status: 400 }
      )
    }

    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'المعاملة غير موجودة' },
        { status: 404 }
      )
    }

    if (transaction.type !== 'WITHDRAWAL') {
      return NextResponse.json(
        { error: 'هذه المعاملة ليست سحباً' },
        { status: 400 }
      )
    }

    if (transaction.status === 'COMPLETED') {
      // Already auto-completed (e.g. by check-status endpoint)
      return NextResponse.json(
        { message: 'تم إتمام هذه المعاملة بالفعل تلقائياً', transaction },
        { status: 200 }
      )
    }

    if (transaction.status !== 'PENDING' && transaction.status !== 'PROCESSING') {
      return NextResponse.json(
        { error: 'تم معالجة هذه المعاملة بالفعل' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: transaction.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // ── Submit real crypto withdrawal via BingX ──
    let bingxResult: { success: boolean; id?: string; message?: string } | null = null
    let submittedToBingX = false

    try {
      const { submitBingXWithdrawal } = await import('@/lib/bingx')

      const BINGX_API_KEY = process.env.BINGX_API_KEY || process.env.BINANCE_API_KEY
      const BINGX_SECRET_KEY = process.env.BINGX_SECRET_KEY || process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY

      if (BINGX_API_KEY && BINGX_SECRET_KEY) {
        // Parse transaction details
        const details = transaction.details ? JSON.parse(transaction.details) : {}
        const method = transaction.cryptoCurrency || details.method || 'usdt_trc20'

        // Map method to BingX coin/network
        const coinNetworkMap: Record<string, { coin: string; network: string }> = {
          'usdt_bep20': { coin: 'USDT', network: 'BEP20' },
          'usdt_trc20': { coin: 'USDT', network: 'TRC20' },
          'btc': { coin: 'BTC', network: 'BTC' },
          'eth': { coin: 'ETH', network: 'ERC20' },
        }

        const coinInfo = coinNetworkMap[method.toLowerCase()] || coinNetworkMap['usdt_trc20']
        const walletAddress = transaction.walletAddress || details.walletAddress
        const netAmount = details.submittedAmount || details.netAmount || (transaction.amount - (details.platformFee || 0))

        if (walletAddress && netAmount > 0) {
          bingxResult = await submitBingXWithdrawal({
            coin: coinInfo.coin,
            network: coinInfo.network,
            address: walletAddress,
            amount: netAmount,
            orderId: transaction.id.slice(-10),
          })

          if (bingxResult?.success) {
            submittedToBingX = true
          } else {
            console.error('[ADMIN WITHDRAW] BingX submission failed:', bingxResult?.message)
          }
        } else {
          console.error('[ADMIN WITHDRAW] Missing wallet address or invalid amount:', { walletAddress, netAmount })
        }
      }
    } catch (bingxErr) {
      console.error('[ADMIN WITHDRAW] BingX error:', bingxErr)
      bingxResult = { success: false, message: String(bingxErr) }
    }

    const updatedTransaction = await db.$transaction(async (tx) => {
      const updateData: any = {
        status: submittedToBingX ? 'PROCESSING' : 'COMPLETED',
      }

      // If submitted to BingX, store the withdrawal ID
      if (submittedToBingX && bingxResult?.id) {
        updateData.txHash = bingxResult.id
      }

      // Update details with admin processing info
      const existingDetails = transaction.details ? JSON.parse(transaction.details) : {}
      updateData.details = JSON.stringify({
        ...existingDetails,
        adminProcessed: true,
        adminProcessedBy: admin.email || admin.id,
        adminProcessedAt: new Date().toISOString(),
        submittedToBingX,
        bingxWithdrawId: bingxResult?.id || null,
        bingxMessage: bingxResult?.message || null,
      })

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: updateData,
      })

      // SECURITY FIX: Removed totalWithdrawn increment here - it's already incremented
      // when the withdrawal request is created (see /api/withdraw/route.ts)
      // Only update the transaction status

      return updated
    })

    if (submittedToBingX) {
      return NextResponse.json(
        {
          message: 'تم إرسال السحب عبر BingX بنجاح. سيتم التحقق تلقائياً عند اكتمال التحويل.',
          transaction: updatedTransaction,
          bingxSubmitted: true,
          bingxId: bingxResult?.id,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          message: 'تم تحديث حالة المعاملة. ملاحظة: لم يتم إرسال التحويل عبر BingX تلقائياً - تأكد من إرسال الكريبتو يدوياً.',
          transaction: updatedTransaction,
          bingxSubmitted: false,
          bingxError: bingxResult?.message || 'فشل الاتصال بـ BingX',
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Process withdrawal error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء معالجة السحب' },
      { status: 500 }
    )
  }
}
