import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { getPlatformSetting, setPlatformSetting, logAdminAction } from '@/lib/staged-withdrawal'

// GET: Get real wallet balance
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const balance = await getPlatformSetting('real_wallet_balance')
    const lastUpdated = await getPlatformSetting('real_wallet_balance_updated')
    return NextResponse.json({ balance: parseFloat(balance || '0'), lastUpdated })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Update real wallet balance
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const { balance } = await request.json()
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (balance === undefined || balance < 0) {
      return NextResponse.json({ error: 'مبلغ غير صالح' }, { status: 400 })
    }

    await setPlatformSetting('real_wallet_balance', String(balance))
    await setPlatformSetting('real_wallet_balance_updated', new Date().toISOString())

    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_WALLET_BALANCE',
      targetType: 'SYSTEM',
      details: JSON.stringify({ newBalance: balance }),
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ message: 'تم تحديث رصيد المحفظة الحقيقي', balance })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
