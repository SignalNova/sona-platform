import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { invalidateUserTokens } from '@/lib/auth'
import crypto from 'crypto'

// Rate limiting: max 5 attempts per IP per 15 minutes
const resetAttempts = new Map<string, { count: number; lockedUntil: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of resetAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) resetAttempts.delete(key)
  }
}, 5 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown'

    // Rate limiting
    const now = Date.now()
    const attempts = resetAttempts.get(clientIp) || { count: 0, lockedUntil: 0 }
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - now) / 60000)
      return NextResponse.json(
        { error: `يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى` },
        { status: 429 }
      )
    }

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'رمز إعادة التعيين وكلمة المرور الجديدة مطلوبان' },
        { status: 400 }
      )
    }

    // Password strength validation (matching register requirements)
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز خاص' },
        { status: 400 }
      )
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص' },
        { status: 400 }
      )
    }

    // Find user with this reset token
    const user = await db.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }, // Token must not be expired
      },
    })

    if (!user) {
      // Record failed attempt
      const current = resetAttempts.get(clientIp) || { count: 0, lockedUntil: 0 }
      current.count += 1
      if (current.count >= 5) {
        current.lockedUntil = now + 15 * 60 * 1000
      }
      resetAttempts.set(clientIp, current)

      return NextResponse.json(
        { error: 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and clear reset token
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    // SECURITY: Invalidate all existing tokens for this user
    // This forces logout from all devices after password change
    await invalidateUserTokens(user.id)

    console.log('[RESET-PASSWORD] Password reset successful for:', user.email)

    return NextResponse.json({
      message: 'تم إعادة تعيين كلمة المرور بنجاح. يرجى تسجيل الدخول بكلمتك الجديدة.',
    })

  } catch (error) {
    console.error('[RESET-PASSWORD] Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' },
      { status: 500 }
    )
  }
}
