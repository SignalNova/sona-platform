import { db } from '@/lib/db'
import { createPayment, getMinimumPayment } from '@/lib/nowpayments'
import { notifyDepositCreated } from '@/lib/notifications'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// Currency mapping: frontend ID → NOWPayments currency code
const CURRENCY_MAP: Record<string, string> = {
  usdtbsc: 'usdtbsc',
  usdttrc20: 'usdttrc20',
  btc: 'btc',
  eth: 'eth',
  bnb: 'bnb',
}

// Human-readable labels for currencies
const CURRENCY_LABELS: Record<string, { name: string; network: string }> = {
  usdtbsc: { name: 'USDT', network: 'BEP20 (BNB Smart Chain)' },
  usdttrc20: { name: 'USDT', network: 'TRC20 (Tron)' },
  btc: { name: 'Bitcoin', network: 'Bitcoin' },
  eth: { name: 'Ethereum', network: 'Ethereum (ERC20)' },
  bnb: { name: 'BNB', network: 'BNB Smart Chain' },
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const body = await request.json()
    const { amount, currency } = body

    if (!amount || !currency) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'يجب أن يكون المبلغ أكبر من صفر' },
        { status: 400 }
      )
    }

    // Validate currency
    const nowpayCurrency = CURRENCY_MAP[currency]
    if (!nowpayCurrency) {
      return NextResponse.json(
        { error: 'العملة غير مدعومة' },
        { status: 400 }
      )
    }

    // Check minimum amount
    const minAmount = await getMinimumPayment(nowpayCurrency)
    if (amountNum < minAmount) {
      return NextResponse.json(
        { error: `الحد الأدنى للإيداع هو ${minAmount} USDT` },
        { status: 400 }
      )
    }

    // Create NOWPayments payment
    const payment = await createPayment(amountNum, nowpayCurrency)

    if (!payment) {
      console.error('[Deposit] Failed to create NOWPayments payment')
      return NextResponse.json(
        { error: 'فشل إنشاء طلب الدفع. يرجى المحاولة لاحقاً' },
        { status: 500 }
      )
    }

    const currencyInfo = CURRENCY_LABELS[currency] || { name: currency, network: currency }

    // Create the deposit transaction record using authenticated user's ID
    const transaction = await db.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amount: amountNum,
        status: 'PENDING',
        cryptoCurrency: currencyInfo.name,
        cryptoNetwork: currencyInfo.network,
        depositAddress: payment.pay_address || null,
        nowpaymentsId: String(payment.payment_id || payment.id),
        nowpaymentsStatus: payment.payment_status || 'waiting',
        description: `NOWPayments deposit - ${currencyInfo.name} via ${currencyInfo.network}`,
      },
    })

    console.log(`[Deposit] Created payment: ${payment.payment_id || payment.id}, address: ${payment.pay_address}`)

    // Send notification to user
    await notifyDepositCreated(user.id, amountNum, currencyInfo.name)

    return NextResponse.json({
      message: 'تم إنشاء طلب الإيداع بنجاح. أرسل المبلغ إلى العنوان أدناه',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
      },
      payment: {
        id: payment.payment_id || payment.id,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        expiration: payment.expiration_estimate_date,
        network: currencyInfo.network,
        currency: currencyInfo.name,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء طلب الإيداع' },
      { status: 500 }
    )
  }
}

// GET: List user's deposit transactions
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {
      userId: user.id,
      type: 'DEPOSIT',
    }

    if (status) {
      where.status = status
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ transactions }, { status: 200 })
  } catch (error) {
    console.error('Get deposits error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء استرجاع الإيداعات' },
      { status: 500 }
    )
  }
}
