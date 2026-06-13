import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { invalidateUserTokens } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { newEmail, password } = await req.json()

    // SECURITY: Remove userId from body - always use authenticated user
    if (!newEmail || !password) {
      return NextResponse.json({ error: 'البريد الجديد وكلمة المرور مطلوبان' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
    }

    // Verify password
    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

    const isValid = await bcrypt.compare(password, dbUser.password)
    if (!isValid) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 400 })
    }

    // Check if email already taken
    const existingUser = await db.user.findUnique({ where: { email: newEmail } })
    if (existingUser) {
      return NextResponse.json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
    }

    // SECURITY: Generate verification code for the new email
    const verifyCode = crypto.randomInt(100000, 999999).toString()
    const verifyCodeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Update email and set as unverified with new verification code
    await db.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        emailVerified: false,
        verifyCode,
        verifyCodeExpiry,
      },
    })

    // Send verification email to the new address using centralized email utility
    try {
      const { sendVerificationEmail } = await import('@/lib/email')
      const result = await sendVerificationEmail(newEmail, verifyCode, user.name || 'User')
      if (!result.success) {
        console.error('[CHANGE-EMAIL] Failed to send verification email:', result.error)
      }
    } catch (emailErr) {
      console.error('[CHANGE-EMAIL] Failed to send verification email:', emailErr)
    }

    // Send security notification
    await createNotification({
      userId: user.id,
      title: 'تغيير البريد الإلكتروني',
      message: `تم تغيير بريدك الإلكتروني من ${dbUser.email} إلى ${newEmail}. يرجى تأكيد بريدك الجديد.`,
      type: 'SECURITY',
      data: { oldEmail: dbUser.email, newEmail },
    })

    // SECURITY: Invalidate all existing tokens - force re-login
    await invalidateUserTokens(user.id)

    return NextResponse.json({
      message: 'تم تغيير البريد الإلكتروني. يرجى تأكيد بريدك الجديد وإعادة تسجيل الدخول.',
      needVerification: true,
      userEmail: newEmail,
    }, { status: 200 })
  } catch (error) {
    console.error('Change email error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
