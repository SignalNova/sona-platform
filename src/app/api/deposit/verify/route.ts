import { NextRequest, NextResponse } from 'next/server'

/**
 * DISABLED: Direct blockchain deposit verification
 *
 * This endpoint verified deposits by checking BSCScan/TronScan for transfers
 * to deterministic addresses that had NO private keys. These addresses are
 * unsafe - any crypto sent to them is permanently lost.
 *
 * The ONLY safe deposit method is NOWPayments.
 * Use /api/deposit/check-nowpayments to check NOWPayments deposit status.
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'تم تعطيل نظام التحقق المباشر. يرجى استخدام NOWPayments للإيداع.',
      useNowpayments: true,
    },
    { status: 410 }
  )
}
