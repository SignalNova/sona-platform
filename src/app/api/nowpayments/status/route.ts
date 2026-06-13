import { NextRequest, NextResponse } from 'next/server'
import { getPaymentStatus } from '@/lib/nowpayments'
import { getAuthUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    // SECURITY: Verify the payment belongs to the authenticated user
    const transaction = await db.transaction.findFirst({
      where: {
        reference: paymentId,
        userId: authUser.id,
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Payment not found or does not belong to your account' }, { status: 404 })
    }

    const status = await getPaymentStatus(paymentId)
    if (!status) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('NowPayments status error:', error)
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 })
  }
}
