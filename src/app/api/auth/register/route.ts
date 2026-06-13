import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail, sendWelcomeEmail, sendAccountCreatedEmail } from '@/lib/email'
import { createNotification, notifyWelcomeNewUser, notifyCommissionCredited } from '@/lib/notifications'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// SECURITY: Rate limiting to prevent duplicate verification code sends
const registerCooldown = new Map<string, number>()
const REGISTER_COOLDOWN_MS = 60 * 1000 // 60 seconds

// SECURITY: Use crypto.randomInt instead of Math.random for cryptographically secure codes
function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, referralCode } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    // SECURITY: Rate limit registration attempts per email to prevent duplicate code sends
    const now = Date.now()
    const lastRegisterTime = registerCooldown.get(email)
    if (lastRegisterTime && (now - lastRegisterTime) < REGISTER_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((REGISTER_COOLDOWN_MS - (now - lastRegisterTime)) / 1000)
      return NextResponse.json(
        { error: `يرجى الانتظار ${remainingSeconds} ثانية قبل المحاولة مرة أخرى` },
        { status: 429 }
      )
    }
    registerCooldown.set(email, now)

    // Clean up old cooldown entries every 5 minutes
    if (registerCooldown.size > 100) {
      for (const [key, timestamp] of registerCooldown) {
        if (now - timestamp > 5 * 60 * 1000) registerCooldown.delete(key)
      }
    }

    // SECURITY: Stronger password requirements for financial platform
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز خاص' },
        { status: 400 }
      )
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص' },
        { status: 400 }
      )
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مستخدم بالفعل' },
        { status: 409 }
      )
    }

    // SECURITY FORTRESS: Check if email or IP is blacklisted
    try {
      const { checkBlacklist } = await import('@/lib/security-fortress')
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || 'unknown'

      const emailBlacklisted = await checkBlacklist('EMAIL', email)
      if (emailBlacklisted) {
        return NextResponse.json({ error: 'هذا البريد الإلكتروني محظور من التسجيل' }, { status: 403 })
      }

      if (clientIp && clientIp !== 'unknown') {
        const ipBlacklisted = await checkBlacklist('IP', clientIp)
        if (ipBlacklisted) {
          return NextResponse.json({ error: 'تم حظر التسجيل من هذا العنوان' }, { status: 403 })
        }
      }
    } catch (fortressError) {
      console.error('[FORTRESS] Register blacklist check error:', fortressError)
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Find referrer if referral code provided
    let referrerId: string | null = null
    if (referralCode) {
      const referrer = await db.user.findUnique({
        where: { referralCode },
      })
      if (referrer) {
        referrerId = referrer.id
      }
    }

    // Generate a unique referral code for the new user
    // SECURITY: Use crypto for cryptographically secure referral codes
    const generateReferralCode = () => {
      const bytes = crypto.randomBytes(4)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars[bytes[i % 4] % chars.length]
      }
      return code
    }

    let referralCodeNew = generateReferralCode()
    // Ensure uniqueness
    while (await db.user.findUnique({ where: { referralCode: referralCodeNew } })) {
      referralCodeNew = generateReferralCode()
    }

    // Generate verification code
    const verifyCode = generateCode()
    const verifyCodeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const user = await db.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
        balance: 0,
        totalProfit: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        emailVerified: false,
        isActive: true,
        role: 'USER',
        referralCode: referralCodeNew,
        referredByCode: referralCode || null,
        verifyCode,
        verifyCodeExpiry,
      },
    })

    // Referral bonus will be credited AFTER email verification (security: prevent fake account farming)
    // See verify-email endpoint for referral bonus logic
    // We store the referredByCode so the verify-email endpoint can credit the referrer

    // Send welcome notification to new user (Syrian dialect)
    await notifyWelcomeNewUser(user.id, user.name || email.split('@')[0], email)

    // Notify referrer about the new referral (bonus will be credited after email verification)
    if (referrerId) {
      await createNotification({
        userId: referrerId,
        title: 'إحالة جديدة!',
        message: `سجّل شخص جديد من خلال رابطك! رح يتم إضافة عمولة 15% بعد ما يستثمر في أي باقة.`,
        type: 'REFERRAL',
        data: { commission: 15 },
      })
    }

    // Send verification email with OTP code (this is the ONLY email sent immediately)
    const userName = user.name || email.split('@')[0]
    const emailResult = await sendVerificationEmail(email, verifyCode, userName)

    // DELAYED: Send account created + welcome emails AFTER verification
    // Sending 3 emails at once triggers Gmail spam filters
    // These will be sent by the verify-email endpoint after successful verification

    // Notify admin about new registration
    const adminUser = await db.user.findFirst({ where: { role: 'ADMIN' } })
    if (adminUser) {
      await createNotification({
        userId: adminUser.id,
        title: 'مستخدم جديد',
        message: `سجّل مستخدم جديد: ${user.name} (${user.email})${referrerId ? ' عبر إحالة' : ''}`,
        type: 'SYSTEM',
        data: { newUserId: user.id, email: user.email, hasReferral: !!referrerId },
      })
    }

    // Auto-verify admin account
    if (email === process.env.ADMIN_EMAIL) {
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          role: 'ADMIN',
          verifyCode: null,
          verifyCodeExpiry: null,
        },
      })
    }

    // Email verification handling
    if (!emailResult.success && email !== process.env.ADMIN_EMAIL) {
      console.error(`[REGISTER] Failed to send verification email to ${email}: ${emailResult.error}`)
      // TEMPORARY: If email fails, return the verification code in the response
      // This allows users to verify even when email delivery is not working
      // TODO: Remove this once domain verification is complete and emails work reliably
      console.warn(`[REGISTER] TEMPORARY: Returning verification code in response for ${email}`)
      return NextResponse.json(
        {
          message: 'تم إنشاء الحساب. استخدم رمز التحقق أدناه (لم يتم إرسال البريد الإلكتروني)',
          needVerification: true,
          userEmail: email,
          tempVerifyCode: verifyCode, // TEMPORARY: Remove after email is working
        },
        { status: 201 }
      )
    }

    // Do NOT return a token - user must verify email first
    // Return needVerification flag so frontend shows OTP input
    return NextResponse.json(
      {
        message: 'تم إنشاء الحساب بنجاح. تم إرسال رمز التحقق إلى بريدك الإلكتروني',
        needVerification: true,
        userEmail: email,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 500 }
    )
  }
}
