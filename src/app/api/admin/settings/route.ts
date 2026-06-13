import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

const DEFAULT_SETTINGS = [
  { key: 'maintenance_mode', value: 'false' },
  { key: 'maintenance_message', value: '' },
  { key: 'min_deposit', value: '10' },
  { key: 'min_withdrawal', value: '10' },
  { key: 'registration_enabled', value: 'true' },
  { key: 'deposit_enabled', value: 'true' },
  { key: 'withdrawal_enabled', value: 'true' },
  { key: 'investment_enabled', value: 'true' },
  { key: 'referral_bonus', value: '15' },
  { key: 'support_enabled', value: 'true' },
  { key: 'platform_name', value: 'سونا' },
  { key: 'platform_currency', value: 'USDT' },
  { key: 'notification_email', value: '' },
  // SONA mode settings
  { key: 'platform_mode', value: 'SONA' },
  { key: 'fake_hack_mode', value: 'false' },
  { key: 'fake_hack_message', value: '' },
  { key: 'sona_enabled', value: 'true' },
  { key: 'weekly_transfer_day', value: '7' },
  { key: 'daily_profit_time', value: '00:00' },
  { key: 'reinvest_bonus_percent', value: '5' },
  { key: 'platform_commission_percent', value: '1' },
  { key: 'withdrawal_processing_fast', value: '1-24' },
  { key: 'withdrawal_processing_medium', value: '24-72' },
  { key: 'withdrawal_processing_slow', value: '72-168' },
]

export async function GET(request: NextRequest) {
  try {
    // Try to get admin, but allow non-admin access for public settings
    let isAdmin = false
    try {
      await getAdminFromRequest(request)
      isAdmin = true
    } catch {
      // Non-admin request - allow but return limited data
    }

    const settings = await db.platformSetting.findMany()

    // Merge with defaults for any missing settings
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

    const allSettings = DEFAULT_SETTINGS.map((defaultSetting) => ({
      key: defaultSetting.key,
      value: settingsMap.get(defaultSetting.key) || defaultSetting.value,
    }))

    // Also include any additional settings from DB not in defaults
    for (const setting of settings) {
      if (!DEFAULT_SETTINGS.some((d) => d.key === setting.key)) {
        allSettings.push({ key: setting.key, value: setting.value })
      }
    }

    // Ensure missing defaults are seeded in DB
    const missingDefaults = DEFAULT_SETTINGS.filter(
      (d) => !settingsMap.has(d.key)
    )
    if (missingDefaults.length > 0) {
      await db.$transaction(
        missingDefaults.map((d) =>
          db.platformSetting.upsert({
            where: { key: d.key },
            update: {},
            create: { key: d.key, value: d.value },
          })
        )
      )
    }

    // Build structured response
    const getSetting = (key: string, fallback: string = '') => settingsMap.get(key) || fallback
    const structured = {
      platformMode: getSetting('platform_mode', 'SONA'),
      maintenanceMode: getSetting('maintenance_mode', 'false') === 'true',
      maintenanceMessage: getSetting('maintenance_message', ''),
      minDeposit: parseFloat(getSetting('min_deposit', '10')),
      minWithdrawal: parseFloat(getSetting('min_withdrawal', '10')),
      reinvestBonusPercent: parseFloat(getSetting('reinvest_bonus_percent', '5')),
    }

    if (isAdmin) {
      return NextResponse.json({
        settings: allSettings,
        ...structured,
        // SECURITY: Only include sensitive settings for admin
        fakeHackMode: getSetting('fake_hack_mode', 'false') === 'true',
        fakeHackMessage: getSetting('fake_hack_message', ''),
      }, { status: 200 })
    }

    // SECURITY: Non-admin response does NOT include fakeHackMode, fakeHackMessage
    // or any other sensitive operational details
    return NextResponse.json(structured, { status: 200 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin get settings error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإعدادات' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const body = await request.json()

    // Support both old format ({ settings: [...] }) and new format ({ platformMode, maintenanceMode, ... })
    let settings: Array<{ key: string; value: string }> = []

    if (body.settings && Array.isArray(body.settings)) {
      settings = body.settings
    } else {
      // New format: convert structured object to settings array
      const mapping: Record<string, string> = {
        platformMode: 'platform_mode',
        maintenanceMode: 'maintenance_mode',
        maintenanceMessage: 'maintenance_message',
        fakeHackMode: 'fake_hack_mode',
        fakeHackMessage: 'fake_hack_message',
        minDeposit: 'min_deposit',
        minWithdrawal: 'min_withdrawal',
        reinvestBonusPercent: 'reinvest_bonus_percent',
        platformCommissionPercent: 'platform_commission_percent',
        sonaEnabled: 'sona_enabled',
        weeklyTransferDay: 'weekly_transfer_day',
        dailyProfitTime: 'daily_profit_time',
        registrationEnabled: 'registration_enabled',
        depositEnabled: 'deposit_enabled',
        withdrawalEnabled: 'withdrawal_enabled',
        investmentEnabled: 'investment_enabled',
        referralBonus: 'referral_bonus',
        supportEnabled: 'support_enabled',
        platformName: 'platform_name',
        platformCurrency: 'platform_currency',
        notificationEmail: 'notification_email',
        withdrawalProcessingFast: 'withdrawal_processing_fast',
        withdrawalProcessingMedium: 'withdrawal_processing_medium',
        withdrawalProcessingSlow: 'withdrawal_processing_slow',
      }
      // Boolean keys that need explicit 'true'/'false' string conversion
      const booleanKeys = new Set([
        'maintenanceMode', 'fakeHackMode', 'sonaEnabled', 'registrationEnabled',
        'depositEnabled', 'withdrawalEnabled', 'investmentEnabled', 'supportEnabled',
      ])
      for (const [key, dbKey] of Object.entries(mapping)) {
        if (body[key] !== undefined) {
          // Ensure booleans are converted to 'true'/'false' strings
          const value = booleanKeys.has(key)
            ? (body[key] ? 'true' : 'false')
            : String(body[key])
          settings.push({ key: dbKey, value })
        }
      }
    }

    if (settings.length === 0) {
      return NextResponse.json(
        { error: 'بيانات الإعدادات غير صالحة' },
        { status: 400 }
      )
    }

    // Validate platform_mode value - accept valid modes only
    const VALID_PLATFORM_MODES = ['SONA', 'BOTH', 'DUBIBO']
    const platformModeSetting = settings.find((s) => s.key === 'platform_mode')
    if (platformModeSetting) {
      if (!platformModeSetting.value || platformModeSetting.value.trim() === '') {
        return NextResponse.json(
          { error: 'قيمة وضع المنصة لا يمكن أن تكون فارغة' },
          { status: 400 }
        )
      }
      // Accept the value if it's a valid mode, or any non-empty custom value
      const modeValue = platformModeSetting.value.trim().toUpperCase()
      if (!VALID_PLATFORM_MODES.includes(modeValue) && !VALID_PLATFORM_MODES.includes(platformModeSetting.value.trim())) {
        // Still allow it - just log a warning. Don't block the save.
        console.warn(`[Settings] Unusual platform_mode value: ${platformModeSetting.value}. Valid modes: ${VALID_PLATFORM_MODES.join(', ')}`)
      }
    }

    // Upsert each setting
    for (const setting of settings) {
      if (!setting.key || setting.value === undefined) {
        continue
      }

      await db.platformSetting.upsert({
        where: { key: setting.key },
        update: { value: String(setting.value) },
        create: { key: setting.key, value: String(setting.value) },
      })
    }

    // Log the settings change
    await db.platformLog.create({
      data: {
        action: 'SETTINGS_UPDATED',
        details: JSON.stringify(settings.map((s) => ({ key: s.key, value: s.value }))),
      },
    })

    // Fetch updated settings
    const updatedSettings = await db.platformSetting.findMany()

    // Revalidate all pages so settings changes reflect immediately
    try {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/')
      revalidatePath('/dashboard')
      revalidatePath('/trading')
    } catch {
      // Ignore revalidation errors
    }

    return NextResponse.json({
      message: 'تم تحديث الإعدادات بنجاح',
      settings: updatedSettings,
    }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin update settings error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث الإعدادات' },
      { status: 500 }
    )
  }
}
