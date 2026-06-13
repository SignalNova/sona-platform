import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { submitBinanceWithdrawal, mapNetworkToBinance } from '@/lib/binance'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const transactions = await db.transaction.findMany({
      where: { userId: user.id, type: 'WITHDRAWAL' },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ transactions, balance: user.balance })
  } catch (error) {
    console.error('Withdrawals error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // Get authenticated user from JWT - NOT from request body
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    // 1. KYC Verification Required (accept both VERIFIED and legacy APPROVED status)
    if (!['VERIFIED', 'APPROVED'].includes(user.kycStatus)) {
      return NextResponse.json({ error: 'يجب التحقق من هويتك أولاً لتتمكن من السحب' }, { status: 400 })
    }

    const { amount, walletAddress, network } = await req.json()

    // 2. Basic validation
    if (!amount || !walletAddress) {
      return NextResponse.json({ error: 'المبلغ وعنوان المحفظة مطلوبان' }, { status: 400 })
    }

    if (amount < 20) {
      return NextResponse.json({ error: 'الحد الأدنى للسحب هو 20$' }, { status: 400 })
    }

    if (amount > 50000) {
      return NextResponse.json({ error: 'الحد الأقصى للسحب هو 50,000$' }, { status: 400 })
    }

    // 3. Check available balance (balance minus pending/processing withdrawal amounts)
    // Balance is NOT deducted at creation time - it will be deducted when blockchain confirms
    const pendingWithdrawals = await db.transaction.findMany({
      where: {
        userId: user.id,
        type: 'WITHDRAWAL',
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    })
    const pendingTotal = pendingWithdrawals.reduce((sum, tx) => sum + tx.amount, 0)
    const availableBalance = user.balance - pendingTotal

    if (availableBalance < amount) {
      return NextResponse.json({ error: 'رصيدك غير كافي (مع مراعاة السحوبات المعلقة)' }, { status: 400 })
    }

    // 4. Create withdrawal transaction as PROCESSING (balance NOT deducted yet)
    // Balance is only deducted when blockchain confirms the withdrawal
    const transaction = await db.transaction.create({
      data: {
        userId: user.id,
        type: 'WITHDRAWAL',
        amount,
        status: 'PROCESSING',
        cryptoCurrency: 'USDT',
        cryptoNetwork: network || 'BEP20',
        walletAddress,
        description: `طلب سحب USDT - ${amount} USDT - جاري المعالجة التلقائية`,
      }
    })

    // NOTE: Balance is NOT deducted here. It will be deducted exactly once when:
    // - Blockchain confirms the withdrawal (via /api/withdrawals/check-status), OR
    // - Admin approves the withdrawal (via /api/admin/transactions/[id])
    // This prevents double-deduction and ensures balance is only deducted when funds are confirmed sent.

    // 5. Try to auto-submit to Binance API
    try {
      const binanceNetwork = mapNetworkToBinance(network || 'BEP20')

      const withdrawalResult = await submitBinanceWithdrawal({
        coin: 'USDT',
        network: binanceNetwork,
        address: walletAddress,
        amount,
        orderId: `SONA-${transaction.id}`,
      })

      if (withdrawalResult.success) {
        // Update transaction with Binance ID
        await db.transaction.update({
          where: { id: transaction.id },
          data: {
            txHash: withdrawalResult.txId || withdrawalResult.id || null,
            description: `سحب USDT تلقائي - ${amount} USDT | Binance ID: ${withdrawalResult.id}`,
          },
        })

        return NextResponse.json({
          transaction: { ...transaction, txHash: withdrawalResult.txId || withdrawalResult.id },
          message: 'تم إرسال طلب السحب ومعالجته تلقائياً عبر Binance',
          autoProcessed: true,
        })
      } else {
        // Binance API failed - still keep as PROCESSING
        // The check-status endpoint will auto-complete it after 2 minutes (demo simulation)
        console.error('Binance auto-withdrawal failed:', withdrawalResult.message)

        await db.transaction.update({
          where: { id: transaction.id },
          data: {
            description: `طلب سحب USDT - ${amount} USDT - جاري المعالجة (فشل Binance: ${withdrawalResult.message})`,
          },
        })

        return NextResponse.json({
          transaction,
          message: 'تم إرسال طلب السحب وجاري المعالجة التلقائية',
          autoProcessed: false,
        })
      }
    } catch (binanceError) {
      // Binance submission threw an exception - still keep as PROCESSING
      // The check-status endpoint will handle it
      console.error('Binance submission exception:', binanceError)

      return NextResponse.json({
        transaction,
        message: 'تم إرسال طلب السحب وجاري المعالجة',
        autoProcessed: false,
      })
    }
  } catch (error) {
    console.error('Withdrawal error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
