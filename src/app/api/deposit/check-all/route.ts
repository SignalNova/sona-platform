import { NextRequest, NextResponse } from 'next/server'

/**
 * DISABLED: Direct blockchain deposit checking uses deterministic addresses without private keys.
 * Use NOWPayments for all deposits. Check NOWPayments status via /api/deposit/check-nowpayments.
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'تم تعطيل هذا النظام. يرجى استخدام NOWPayments للإيداع.', useNowpayments: true },
    { status: 410 }
  )
}
