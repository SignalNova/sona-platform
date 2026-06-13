import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { logAdminAction } from '@/lib/staged-withdrawal'
import crypto from 'crypto'

// Standard TOTP 2FA using RFC 6238 with Base32-encoded secrets
// Compatible with Google Authenticator, Authy, etc.

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function generateSecret(): string {
  const bytes = crypto.randomBytes(20)
  let secret = ''
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_CHARS[(bytes[i] >> 3) & 0x1f]
    secret += BASE32_CHARS[((bytes[i] << 2) | ((bytes[i + 1] || 0) >> 6)) & 0x1f]
  }
  return secret.substring(0, 32) // Standard 32-char Base32 secret
}

function base32Decode(secret: string): Buffer {
  const cleaned = secret.replace(/[=]+$/, '').toUpperCase()
  const bytes: number[] = []
  let buffer = 0
  let bitsLeft = 0
  for (const char of cleaned) {
    const val = BASE32_CHARS.indexOf(char)
    if (val === -1) continue
    buffer = (buffer << 5) | val
    bitsLeft += 5
    if (bitsLeft >= 8) {
      bitsLeft -= 8
      bytes.push((buffer >> bitsLeft) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

function generateTOTP(secret: string, time: number = Date.now()): string {
  const counter = Math.floor(time / 30000) // 30-second window
  const key = base32Decode(secret)
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  counterBuf.writeUInt32BE(counter & 0xffffffff, 4)
  const hmac = crypto.createHmac('sha1', key)
  hmac.update(counterBuf)
  const digest = hmac.digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code = ((digest[offset] & 0x7f) << 24 | (digest[offset + 1] & 0xff) << 16 | (digest[offset + 2] & 0xff) << 8 | (digest[offset + 3] & 0xff)) % 1000000
  return String(code).padStart(6, '0')
}

function verifyTOTP(secret: string, code: string): boolean {
  const now = Date.now()
  // Check current and adjacent windows (±1)
  for (let i = -1; i <= 1; i++) {
    const expected = generateTOTP(secret, now + i * 30000)
    if (expected === code) return true
  }
  return false
}

function generateOtpauthUri(secret: string, email: string): string {
  const issuer = encodeURIComponent('SONA Platform')
  const account = encodeURIComponent(email)
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

// GET: Get 2FA status
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    return NextResponse.json({
      enabled: admin.twoFactorEnabled,
      hasSecret: !!admin.twoFactorSecret,
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Setup/Verify/Disable 2FA
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const body = await request.json()
    const { action, code } = body
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (action === 'setup') {
      const secret = generateSecret()
      await db.user.update({ where: { id: admin.id }, data: { twoFactorSecret: secret } })
      // Generate otpauth URI for QR code scanning with authenticator apps
      const otpauthUri = generateOtpauthUri(secret, admin.email || 'admin')
      return NextResponse.json({ secret, otpauthUri, message: 'امسح رمز QR باستخدام تطبيق المصادقة الخاص بك للتحقق.' })
    }

    if (action === 'verify') {
      if (!admin.twoFactorSecret) return NextResponse.json({ error: 'لم يتم إعداد المصادقة الثنائية بعد' }, { status: 400 })
      const valid = verifyTOTP(admin.twoFactorSecret, code)
      if (valid) {
        await db.user.update({ where: { id: admin.id }, data: { twoFactorEnabled: true } })
        await logAdminAction({ adminId: admin.id, action: 'ENABLE_2FA', targetType: 'USER', details: 'Admin enabled 2FA', ipAddress, userAgent })
        return NextResponse.json({ message: 'تم تفعيل المصادقة الثنائية بنجاح', verified: true })
      }
      return NextResponse.json({ error: 'الكود غير صحيح', verified: false }, { status: 400 })
    }

    if (action === 'disable') {
      if (admin.twoFactorEnabled && admin.twoFactorSecret) {
        const valid = verifyTOTP(admin.twoFactorSecret, code)
        if (!valid) return NextResponse.json({ error: 'الكود غير صحيح' }, { status: 400 })
      }
      await db.user.update({ where: { id: admin.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } })
      await logAdminAction({ adminId: admin.id, action: 'DISABLE_2FA', targetType: 'USER', details: 'Admin disabled 2FA', ipAddress, userAgent })
      return NextResponse.json({ message: 'تم تعطيل المصادقة الثنائية' })
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
