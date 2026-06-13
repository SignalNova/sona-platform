import { NextRequest, NextResponse } from 'next/server'

/**
 * DISABLED: Tron deposit verification uses deterministic addresses without private keys.
 * Use NOWPayments for all deposits.
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'تم تعطيل هذا النظام. يرجى استخدام NOWPayments للإيداع.', useNowpayments: true },
    { status: 410 }
  )
}
