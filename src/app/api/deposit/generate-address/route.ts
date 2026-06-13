import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DISABLED: Direct blockchain deposit address generation
 *
 * This endpoint previously generated deterministic deposit addresses (via HMAC-SHA256)
 * that LOOKED like real blockchain addresses but had NO corresponding private keys.
 * Any crypto sent to these addresses would be PERMANENTLY LOST.
 *
 * The ONLY safe deposit method is NOWPayments, where NOWPayments controls
 * the receiving address and forwards funds to the platform wallet.
 *
 * Use /api/deposit (NOWPayments) for all deposits instead.
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'تم تعطيل نظام العناوين المباشرة. يرجى استخدام NOWPayments للإيداع.',
      useNowpayments: true,
    },
    { status: 410 } // 410 Gone - resource is permanently gone
  )
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'تم تعطيل نظام العناوين المباشرة. يرجى استخدام NOWPayments للإيداع.',
      useNowpayments: true,
    },
    { status: 410 }
  )
}
