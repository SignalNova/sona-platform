import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { generateResetPasswordHTML } from '@/lib/email'
import crypto from 'crypto'

// Rate limiting: max 3 requests per email per 15 minutes
const forgotPasswordCooldown = new Map<string, { count: number; lockedUntil: number }>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of forgotPasswordCooldown.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) forgotPasswordCooldown.delete(key)
  }
}, 5 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مطلوب' },
        { status: 400 }
      )
    }

    // Rate limiting
    const now = Date.now()
    const cooldown = forgotPasswordCooldown.get(email)
    if (cooldown && cooldown.lockedUntil && now < cooldown.lockedUntil) {
      const remainingMinutes = Math.ceil((cooldown.lockedUntil - now) / 60000)
      return NextResponse.json(
        { error: `يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى` },
        { status: 429 }
      )
    }

    const user = await db.user.findUnique({ where: { email } })

    // SECURITY: Always return same message to prevent email enumeration
    const successMessage = 'إذا كان البريد مسجلاً لدينا، ستصلك رسالة بإعادة التعيين'

    if (!user) {
      console.log('[FORGOT-PASSWORD] No user found for email:', email)
      // Still count towards rate limit to prevent enumeration
      const current = forgotPasswordCooldown.get(email) || { count: 0, lockedUntil: 0 }
      current.count += 1
      if (current.count >= 3) {
        current.lockedUntil = now + 15 * 60 * 1000
      }
      forgotPasswordCooldown.set(email, current)
      return NextResponse.json({ message: successMessage })
    }

    // SECURITY: Don't allow password reset for blacklisted/frozen accounts
    if (user.isBlacklisted) {
      console.log('[FORGOT-PASSWORD] Blacklisted user attempted reset:', email)
      return NextResponse.json({ message: successMessage })
    }

    // Rate limiting for existing users
    const current = forgotPasswordCooldown.get(email) || { count: 0, lockedUntil: 0 }
    current.count += 1
    if (current.count >= 3) {
      current.lockedUntil = now + 15 * 60 * 1000
    }
    forgotPasswordCooldown.set(email, current)

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Save reset token to user
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sona-platform.onrender.com'
    const resetLink = `${baseUrl}/dashboard?page=login&resetToken=${resetToken}`

    console.log('[FORGOT-PASSWORD] Sending reset email to:', email)

    // Send reset email using the professional email template
    const emailResult = await sendEmail(
      email,
      'إعادة تعيين كلمة المرور - SONA Platform',
      generateResetPasswordHTML(user.name || email.split('@')[0], resetLink)
    )

    if (emailResult.success) {
      console.log('[FORGOT-PASSWORD] Reset email sent to:', email)
    } else {
      console.log('[FORGOT-PASSWORD] Failed to send reset email to:', email, '- Error:', emailResult.error)
    }

    // Always return same message for security (prevents email enumeration)
    return NextResponse.json({ message: successMessage })

  } catch (error) {
    console.error('[FORGOT-PASSWORD] Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء معالجة الطلب' },
      { status: 500 }
    )
  }
}
