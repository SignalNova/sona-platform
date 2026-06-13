import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../../admin/middleware'

// ═══════════════════════════════════════════════════════════
// ADVANCED SECURITY SHIELD API
// Provides: Zero-Trust, Anti-Clone, Infrastructure Cloak, Sentinel IDS
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'overview'

    switch (section) {
      case 'overview': {
        const { getSecurityMetrics } = await import('@/lib/sentinel-ids')
        const { performInfrastructureCheck } = await import('@/lib/infrastructure-cloak')
        const { verifyPlatformIntegrity } = await import('@/lib/anti-clone-shield')

        const metrics = getSecurityMetrics()
        const infraCheck = performInfrastructureCheck()
        const integrity = verifyPlatformIntegrity()

        return NextResponse.json({
          metrics,
          infrastructure: infraCheck,
          platformIntegrity: integrity,
          systems: {
            zeroTrustShield: 'ACTIVE',
            antiCloneShield: 'ACTIVE',
            infrastructureCloak: 'ACTIVE',
            sentinelIDS: 'ACTIVE',
            vaultEncryption: 'ACTIVE',
          },
        })
      }

      case 'metrics': {
        const { getSecurityMetrics } = await import('@/lib/sentinel-ids')
        const metrics = getSecurityMetrics()
        return NextResponse.json({ metrics })
      }

      case 'infrastructure': {
        const { performInfrastructureCheck } = await import('@/lib/infrastructure-cloak')
        const infraCheck = performInfrastructureCheck()
        return NextResponse.json({ infrastructure: infraCheck })
      }

      case 'attack-chains': {
        const ip = searchParams.get('ip')
        if (!ip) {
          return NextResponse.json({ error: 'IP parameter required' }, { status: 400 })
        }
        const { reconstructAttackChain } = await import('@/lib/sentinel-ids')
        const chain = reconstructAttackChain(ip)
        return NextResponse.json({ chain })
      }

      case 'dns-protection': {
        const { validateDNSProtection } = await import('@/lib/infrastructure-cloak')
        const dnsCheck = validateDNSProtection()
        return NextResponse.json({ dnsProtection: dnsCheck })
      }

      default:
        return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }
  } catch (error) {
    console.error('Security shield error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'rotate-keys': {
        const { rotateKeys } = await import('@/lib/vault-encryption')
        const result = rotateKeys()
        return NextResponse.json({
          message: 'تم تدوير مفاتيح التشفير بنجاح',
          ...result,
        })
      }

      case 'block-ip': {
        const { ip, reason } = body
        if (!ip || !reason) {
          return NextResponse.json({ error: 'IP and reason are required' }, { status: 400 })
        }
        const { addToBlacklist } = await import('@/lib/security-fortress')
        await addToBlacklist('IP', ip, reason, 'admin', true)
        return NextResponse.json({ message: `تم حظر IP: ${ip}` })
      }

      case 'add-threat-indicator': {
        const { type, value, severity, source } = body
        if (!type || !value || !severity) {
          return NextResponse.json({ error: 'All fields required' }, { status: 400 })
        }
        const { addThreatIndicator } = await import('@/lib/zero-trust-shield')
        addThreatIndicator({
          type,
          value,
          severity,
          source: source || 'admin',
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        })
        return NextResponse.json({ message: 'تم إضافة مؤشر التهديد' })
      }

      case 'contain-user': {
        const { userId, reason, severity } = body
        if (!userId || !reason) {
          return NextResponse.json({ error: 'userId and reason are required' }, { status: 400 })
        }
        const { autoContain } = await import('@/lib/zero-trust-shield')
        const result = await autoContain(userId, reason, severity || 'HIGH')
        return NextResponse.json({ message: 'تم تنفيذ الإجراء الأمني', result })
      }

      case 'invalidate-session': {
        const { userId } = body
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 })
        }
        const { invalidateSession } = await import('@/lib/zero-trust-shield')
        invalidateSession(userId)
        const { invalidateUserTokens } = await import('@/lib/auth')
        await invalidateUserTokens(userId)
        return NextResponse.json({ message: 'تم إلغاء جميع الجلسات للمستخدم' })
      }

      case 'generate-encryption-key': {
        const { generateSecureToken } = await import('@/lib/vault-encryption')
        const key = generateSecureToken('encryption-key', 64)
        return NextResponse.json({ key, message: 'تم إنشاء مفتاح تشفير جديد' })
      }

      default:
        return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
    }
  } catch (error) {
    console.error('Security shield action error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
