import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { signToken, verifyToken, getUser, invalidateUserTokens, isAdminRole } from '@/lib/auth'
import { generateReferralCode } from '@/lib/utils'
import { validateLoginSecurity, handleFailedLogin, handleSuccessfulLogin } from '@/lib/security-monitor'
import crypto from 'crypto'

// Rate limiting for forgot-password to prevent email flooding
const forgotPasswordCooldown = new Map<string, number>()
const FORGOT_PASSWORD_COOLDOWN_MS = 60 * 1000 // 60 seconds

export async function POST(req: NextRequest) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch (jsonErr) {
      console.warn('[AUTH] Invalid JSON body received:', jsonErr)
      return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
    }
    const { action } = body

    if (action === 'register') {
      const { email, password, name, phone, referralCode } = body
      if (!email || !password || !name) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      // SECURITY: Stronger password requirements
      if (password.length < 8) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز خاص' }, { status: 400 })
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص' }, { status: 400 })
      }
      // Validate input length to prevent abuse
      if (email.length > 254 || name.length > 100 || password.length > 128) {
        return NextResponse.json({ error: 'بيانات الإدخال طويلة جداً' }, { status: 400 })
      }
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
      }
      const hashedPassword = await bcrypt.hash(password, 12)
      let userCode = ''
      let codeExists = true
      while (codeExists) {
        userCode = generateReferralCode()
        codeExists = !!(await prisma.user.findUnique({ where: { referralCode: userCode } }))
      }
      let referrerUser = null
      if (referralCode) {
        referrerUser = await prisma.user.findUnique({ where: { referralCode } })
      }

      // Generate email verification code
      const verifyCode = crypto.randomInt(100000, 999999).toString()
      const verifyCodeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name, phone, referralCode: userCode, referredByCode: referralCode || null, verifyCode, verifyCodeExpiry }
      })
      // Referral bonus will be credited AFTER email verification (security: prevent fake account farming)
      // See verify-email endpoint for referral bonus logic

      // Auto-verify admin account
      if (email === process.env.ADMIN_EMAIL) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, role: 'ADMIN', verifyCode: null, verifyCodeExpiry: null }
        })
      } else {
        // Send verification email to regular users using the professional template
        try {
          const { sendVerificationEmail } = await import('@/lib/email')
          const userName = name || email.split('@')[0]
          const result = await sendVerificationEmail(email, verifyCode, userName)
          if (result.success) {
            console.log(`[REGISTER] Verification email sent to ${email}`)
          } else {
            console.error(`[REGISTER] Failed to send verification email to ${email}: ${result.error}`)
          }
        } catch (emailErr) {
          console.error('[REGISTER] Failed to send verification email:', emailErr)
        }
      }

      // Do NOT return a token or set cookie - user must verify email first
      // Return user info without token so frontend knows to show verification screen
      return NextResponse.json({
        message: 'تم إنشاء الحساب بنجاح. تم إرسال رمز التحقق إلى بريدك الإلكتروني',
        needVerification: true,
        userEmail: email,
      }, { status: 201 })
    }

    if (action === 'login') {
      const { email, password } = body
      if (!email || !password) {
        return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 })
      }

      // SECURITY: Check database-backed account lockout before attempting
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip') || 'unknown'
      const loginSecurity = await validateLoginSecurity(email, clientIp)
      if (!loginSecurity.allowed) {
        return NextResponse.json({ error: loginSecurity.message || 'تم قفل الحساب. حاول لاحقاً.' }, { status: 429 })
      }

      // SECURITY FIX: Always run bcrypt compare even if user doesn't exist (prevents timing attacks)
      const dummyHash = '$2a$12$invalidhashthatwillnevermatch1234567890abcdefghij'
      const user = await prisma.user.findUnique({ where: { email } })

      let valid = false
      if (user) {
        // SECURITY: Only bcrypt is supported - no Base64 fallback
        if (user.password.startsWith('$2')) {
          valid = await bcrypt.compare(password, user.password)
        } else {
          console.warn(`[SECURITY] User ${user.email} has non-bcrypt password - forcing reset`)
          await handleFailedLogin(email, clientIp, req.headers.get('user-agent') || undefined)
          return NextResponse.json({ error: 'يرجى إعادة تعيين كلمة المرور الخاصة بك لأسباب أمنية' }, { status: 401 })
        }
      } else {
        // Run dummy comparison to prevent timing attack
        await bcrypt.compare(password, dummyHash)
      }

      if (!valid) {
        // SECURITY: Log failed login to database
        await handleFailedLogin(email, clientIp, req.headers.get('user-agent') || undefined)
        return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 })
      }
      if (!user!.isActive) return NextResponse.json({ error: 'الحساب معطل. تواصل مع الدعم الفني.' }, { status: 403 })

      // SECURITY FIX: Check if account is frozen
      if (user!.isFrozen && user!.frozenUntil && new Date() < new Date(user!.frozenUntil)) {
        return NextResponse.json(
          { error: `حسابك مجمد لمدة 3 أيام بسبب: ${user!.freezeReason || 'انتهاك سياسات المنصة'}. لا يمكنك الدخول حالياً.` },
          { status: 403 }
        )
      }

      // SECURITY FIX: Check if account is blacklisted (banned)
      if (user!.isBlacklisted && !user!.isActive) {
        return NextResponse.json(
          { error: 'حسابك محظور نهائياً. تواصل مع الدعم الفني.' },
          { status: 403 }
        )
      }

      if (!user!.emailVerified) return NextResponse.json({ error: 'يرجى تأكيد بريدك الإلكتروني أولاً', needVerification: true }, { status: 403 })

      // SECURITY FIX: Log successful login to database (includes VPN detection)
      await handleSuccessfulLogin(email, clientIp, req.headers.get('user-agent') || undefined, user!.id)

      // SECURITY FIX: Run fortress login security check
      try {
        const { performLoginSecurityCheck } = await import('@/lib/security-fortress')
        await performLoginSecurityCheck({
          userId: user!.id,
          ip: clientIp,
          userAgent: req.headers.get('user-agent') || undefined,
          email: user!.email,
        })
      } catch (fortressError) {
        console.error('[FORTRESS] Login security check error (non-blocking):', fortressError)
      }

      const token = signToken({ userId: user!.id, email: user!.email, role: user!.role, tokenVersion: user!.tokenVersion })
      const { password: _, verifyCode: _vc, verifyCodeExpiry: _ve, twoFactorSecret: _2fs, kycDocumentImage: _kdi, kycSelfieImage: _ksi, kycFrontImage: _kfi, kycBackImage: _kbi, kycVideoUrl: _kvu, kycAiResult: _kar, kycAiStatus: _kas, emailChangeCode: _ecc, emailChangeExpiry: _ece, newEmail: _ne, ...safeUser } = user!
      const response = NextResponse.json({
        user: { ...safeUser, totalDeposit: safeUser.totalDeposited, totalWithdraw: safeUser.totalWithdrawn, referredBy: safeUser.referredByCode },
        token
      })
      response.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 60 * 60 * 24, path: '/' })
      return response
    }

    if (action === 'logout') {
      // SECURITY: Invalidate server-side tokens before clearing cookie
      try {
        const token = req.cookies.get('token')?.value || (req.headers.get('authorization')?.startsWith('Bearer ') ? req.headers.get('authorization')!.slice(7) : null)
        if (token) {
          const decoded = verifyToken(token) as any
          if (decoded?.userId) {
            await invalidateUserTokens(decoded.userId)
          }
        }
      } catch {
        // Token may be invalid - still clear the cookie
      }
      const response = NextResponse.json({ message: 'تم تسجيل الخروج' })
      response.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 0, path: '/' })
      return response
    }

    if (action === 'forgot-password') {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 })

      // Rate limit forgot-password to prevent email flooding from double-clicks
      const now = Date.now()
      const lastForgotTime = forgotPasswordCooldown.get(email)
      if (lastForgotTime && (now - lastForgotTime) < FORGOT_PASSWORD_COOLDOWN_MS) {
        // Silently return success to prevent email enumeration
        return NextResponse.json({ message: 'إذا كان البريد مسجلاً لدينا، ستصلك رسالة لإعادة التعيين' })
      }
      forgotPasswordCooldown.set(email, now)

      // Clean up old cooldown entries
      if (forgotPasswordCooldown.size > 100) {
        for (const [key, timestamp] of forgotPasswordCooldown) {
          if (now - timestamp > 5 * 60 * 1000) forgotPasswordCooldown.delete(key)
        }
      }

      const user = await prisma.user.findUnique({ where: { email } })
      // Always return success to prevent email enumeration
      if (user) {
        const resetToken = signToken({ userId: user.id, email: user.email, purpose: 'reset' }, '15m')
        // SECURITY: Only use NEXT_PUBLIC_APP_URL env var for base URL
        // Never trust x-forwarded-host or other client-controlled headers
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const resetUrl = `${baseUrl}?reset=${resetToken}`
        try {
          const { sendEmail, generateResetPasswordHTML } = await import('@/lib/email')
          const userName = user.name || email.split('@')[0]
          await sendEmail(
            email,
            'Reset Your SONA Password',
            generateResetPasswordHTML(userName, resetUrl)
          )
        } catch (e) {
          console.error('Email send error:', e)
        }
      }
      return NextResponse.json({ message: 'إذا كان البريد مسجلاً لدينا، ستصلك رسالة لإعادة التعيين' })
    }

    if (action === 'reset-password') {
      const { token, newPassword } = body
      if (!token || !newPassword) return NextResponse.json({ error: 'البيانات مطلوبة' }, { status: 400 })
      // SECURITY: Stronger password requirements
      if (newPassword.length < 8) return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز خاص' }, { status: 400 })
      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص' }, { status: 400 })
      }
      try {
        const decoded = verifyToken(token) as any
        if (!decoded || decoded.purpose !== 'reset') return NextResponse.json({ error: 'رمز غير صالح' }, { status: 400 })
        const hashedPassword = await bcrypt.hash(newPassword, 12)
        await prisma.user.update({ where: { id: decoded.userId }, data: { password: hashedPassword } })
        // SECURITY: Invalidate all existing tokens after password reset
        await invalidateUserTokens(decoded.userId)
        return NextResponse.json({ message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' })
      } catch {
        return NextResponse.json({ error: 'الرمز منتهي الصلاحية أو غير صالح. اطلب رابط جديد.' }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
  } catch (error: any) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
}
