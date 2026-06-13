import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { getBotControl, logAdminAction } from '@/lib/staged-withdrawal'

// GET: Get current bot settings
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const control = await getBotControl()
    return NextResponse.json({ control })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// PATCH: Update bot settings
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const body = await request.json()
    const { isActive, tradesPerMinute, winRate, maxTradeAmount, minTradeAmount, volatilityFactor, symbols } = body
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    let control = await getBotControl()

    const updateData: any = {}
    if (isActive !== undefined) {
      updateData.isActive = isActive
      updateData.pausedAt = isActive ? null : new Date()
    }
    if (tradesPerMinute !== undefined) updateData.tradesPerMinute = tradesPerMinute
    if (winRate !== undefined) updateData.winRate = winRate
    if (maxTradeAmount !== undefined) updateData.maxTradeAmount = maxTradeAmount
    if (minTradeAmount !== undefined) updateData.minTradeAmount = minTradeAmount
    if (volatilityFactor !== undefined) updateData.volatilityFactor = volatilityFactor
    if (symbols !== undefined) updateData.symbols = symbols

    control = await db.botControl.update({ where: { id: control.id }, data: updateData })

    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_BOT_CONTROLS',
      targetType: 'BOT',
      details: JSON.stringify(updateData),
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ message: 'تم تحديث إعدادات البوت', control })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
