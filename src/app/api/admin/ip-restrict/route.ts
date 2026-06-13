import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { getPlatformSetting, setPlatformSetting, logAdminAction } from '@/lib/staged-withdrawal'

// GET: Get allowed IPs
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const ipList = await getPlatformSetting('admin_allowed_ips')
    const ips = ipList ? ipList.split(',').filter(Boolean) : []
    const restricted = (await getPlatformSetting('admin_ip_restriction_enabled')) === 'true'
    return NextResponse.json({ ips, restricted })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Update IP restrictions
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const { ips, restricted } = await request.json()
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (ips !== undefined) {
      await setPlatformSetting('admin_allowed_ips', Array.isArray(ips) ? ips.join(',') : ips)
    }
    if (restricted !== undefined) {
      await setPlatformSetting('admin_ip_restriction_enabled', restricted ? 'true' : 'false')
    }

    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_IP_RESTRICTION',
      targetType: 'SYSTEM',
      details: JSON.stringify({ ips, restricted }),
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ message: 'تم تحديث قيود IP بنجاح' })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
