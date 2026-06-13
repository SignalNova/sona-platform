import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { logAdminAction, setPlatformSetting, getPlatformSetting } from '@/lib/staged-withdrawal'
import { createNotification } from '@/lib/notifications'

// GET: Get current kill switch statuses
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)

    const [maintenanceMode, roiPaused, depositEnabled, withdrawalEnabled] = await Promise.all([
      getPlatformSetting('maintenance_mode'),
      getPlatformSetting('roi_paused'),
      getPlatformSetting('deposit_enabled'),
      getPlatformSetting('withdrawal_enabled'),
    ])

    return NextResponse.json({
      maintenanceMode: maintenanceMode === 'true',
      roiPaused: roiPaused === 'true',
      depositsPaused: depositEnabled === 'false',
      withdrawalsPaused: withdrawalEnabled === 'false',
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Toggle kill switches
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const body = await request.json()
    const { switchType, enabled, message } = body // switchType: 'maintenance' | 'roi' | 'deposits' | 'withdrawals'
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const keyMap: Record<string, string> = {
      maintenance: 'maintenance_mode',
      roi: 'roi_paused',
      deposits: 'deposit_enabled',
      withdrawals: 'withdrawal_enabled',
    }

    const key = keyMap[switchType]
    if (!key) return NextResponse.json({ error: 'نوع المفتاح غير صالح' }, { status: 400 })

    // For deposits/withdrawals, enabled=true means "allow" so value is "true"
    // For maintenance/roi, enabled=true means "activate the block" so value is "true"
    let value: string
    if (switchType === 'maintenance' || switchType === 'roi') {
      value = enabled ? 'true' : 'false'
    } else {
      // deposits, withdrawals: enabled=true means deposits are enabled (not paused)
      value = enabled ? 'true' : 'false'
    }

    await setPlatformSetting(key, value)

    // Set maintenance message if provided
    if (switchType === 'maintenance' && message) {
      await setPlatformSetting('maintenance_message', message)
    }

    await logAdminAction({
      adminId: admin.id,
      action: `KILL_SWITCH_${switchType.toUpperCase()}`,
      targetType: 'SYSTEM',
      details: JSON.stringify({ switchType, enabled, message }),
      ipAddress,
      userAgent,
    })

    // If maintenance mode activated, notify all users
    if (switchType === 'maintenance' && enabled) {
      const users = await db.user.findMany({ where: { isActive: true }, select: { id: true } })
      for (const u of users.slice(0, 100)) { // Batch limit
        await createNotification({
          userId: u.id,
          title: 'صيانة النظام',
          message: message || 'النظام حالياً تحت الصيانة. سيتم استعادة الخدمة قريباً.',
          type: 'SYSTEM',
        })
      }
    }

    // If ROI paused, also pause the bot
    if (switchType === 'roi' && enabled) {
      const botControl = await db.botControl.findFirst()
      if (botControl) {
        await db.botControl.update({ where: { id: botControl.id }, data: { isActive: false, pausedAt: new Date() } })
      }
    }

    // If ROI resumed, reactivate the bot
    if (switchType === 'roi' && !enabled) {
      const botControl = await db.botControl.findFirst()
      if (botControl) {
        await db.botControl.update({ where: { id: botControl.id }, data: { isActive: true, pausedAt: null } })
      }
    }

    return NextResponse.json({ message: `تم ${enabled ? 'تفعيل' : 'إلغاء'} ${switchType === 'maintenance' ? 'وضع الصيانة' : switchType === 'roi' ? 'إيقاف الأرباح' : switchType === 'deposits' ? 'إيقاف الإيداعات' : 'إيقاف السحوبات'}` })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
