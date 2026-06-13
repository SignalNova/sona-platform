import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { createPayment, getMinimumPayment } from '@/lib/nowpayments'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, type: 'DEPOSIT' },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Deposits error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { amount, currency } = await req.json()

    if (!amount || amount < 10) {
      return NextResponse.json({ error: 'الحد الأدنى للإيداع هو 10$' }, { status: 400 })
    }

    if (amount > 100000) {
      return NextResponse.json({ error: 'الحد الأقصى للإيداع هو 100,000$' }, { status: 400 })
    }

    // NOWPayments is the ONLY deposit method
    const payCurrency = currency || 'usdtbsc'
    const minAmount = await getMinimumPayment(payCurrency)
    if (amount < minAmount) {
      return NextResponse.json({ error: `الحد الأدنى للإيداع عبر NowPayments هو ${minAmount} USDT` }, { status: 400 })
    }

    const payment = await createPayment(amount, payCurrency)
    if (!payment) {
      return NextResponse.json({ error: 'فشل إنشاء طلب الدفع. يرجى المحاولة لاحقاً.' }, { status: 500 })
    }

    // Create a pending transaction with NowPayments ID
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        cryptoCurrency: (payment.pay_currency || 'USDT').toUpperCase(),
        cryptoNetwork: payCurrency.includes('trc20') ? 'TRC20' : payCurrency.includes('bsc') ? 'BEP20' : 'BEP20',
        depositAddress: payment.pay_address || '',
        nowpaymentsId: String(payment.payment_id),
        nowpaymentsStatus: payment.payment_status || 'waiting',
        description: `إيداع عبر NowPayments - ${amount} USDT (${payment.pay_currency || payCurrency})`,
      }
    })

    return NextResponse.json({
      transaction,
      payment: {
        paymentId: payment.payment_id,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        expiration: payment.expiration_estimate_date,
        status: payment.payment_status,
      }
    })
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
