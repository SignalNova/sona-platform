import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken, invalidateUserTokens } from '@/lib/auth'
import { validateLoginSecurity, handleFailedLogin, handleSuccessfulLogin } from '@/lib/security-monitor'

// SECURITY FIX: Removed duplicate JWT_SECRET - now uses centralized signToken from @/lib/auth
// This prevents secret divergence and eliminates the insecure dev fallback duplication

// Brute force protection: in-memory rate limiting by email AND IP
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()
const ipAttempts = new Map<string, { count: number; lockedUntil: number }>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of loginAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) loginAttempts.delete(key)
  }
  for (const [key, val] of ipAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) ipAttempts.delete(key)
  }
}, 5 * 60 * 1000)

// Password complexity validation
function validatePasswordStrength(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    // Get client IP for IP-based rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || 'unknown'

    // Check IP-based brute force protection (20 attempts per 15 min per IP)
    const ipAttempt = ipAttempts.get(clientIp)
    if (ipAttempt && ipAttempt.lockedUntil && Date.now() < ipAttempt.lockedUntil) {
      const remainingMinutes = Math.ceil((ipAttempt.lockedUntil - Date.now()) / 60000)
      return NextResponse.json(
        { error: `تم حظر هذا الجهاز مؤقتاً بسبب محاولات متكررة. حاول مرة أخرى بعد ${remainingMinutes} دقيقة` },
        { status: 429 }
      )
    }

    // Check email-based brute force protection
    const attempts = loginAttempts.get(email)
    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000)
      return NextResponse.json(
        { error: `تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول مرة أخرى بعد ${remainingMinutes} دقيقة` },
        { status: 429 }
      )
    }

    // SECURITY: Also check database-backed account lockout (persists across restarts)
    const loginSecurity = await validateLoginSecurity(email, clientIp)
    if (!loginSecurity.allowed) {
      return NextResponse.json(
        { error: loginSecurity.message || 'تم قفل الحساب. حاول لاحقاً.' },
        { status: 429 }
      )
    }

    // SECURITY: Always run bcrypt compare even if user doesn't exist (prevents timing attacks)
    const dummyHash = '$2a$12$invalidhashthatwillnevermatch1234567890abcdefghij'
    const user = await db.user.findUnique({ where: { email } })

    let valid = false
    if (user) {
      // SECURITY: Only bcrypt is supported - no Base64 fallback
      if (user.password.startsWith('$2')) {
        valid = await bcrypt.compare(password, user.password)
      } else {
        console.warn(`[SECURITY] User ${user.email} has non-bcrypt password - forcing reset`)
        recordFailedAttempt(email, clientIp)
        return NextResponse.json(
          { error: 'يرجى إعادة تعيين كلمة المرور الخاصة بك لأسباب أمنية' },
          { status: 401 }
        )
      }
    } else {
      // Run dummy comparison to prevent timing attack
      await bcrypt.compare(password, dummyHash)
    }

    if (!valid) {
      recordFailedAttempt(email, clientIp)
      // SECURITY: Also log to database (persists across restarts)
      await handleFailedLogin(email, clientIp, request.headers.get('user-agent') || undefined)
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    if (!user!.isActive) {
      return NextResponse.json(
        { error: 'الحساب معطل. يرجى التواصل مع الدعم' },
        { status: 403 }
      )
    }

    // SECURITY FORTRESS: Check if account is frozen
    if (user!.isFrozen && user!.frozenUntil && new Date() < new Date(user!.frozenUntil)) {
      return NextResponse.json(
        { error: `حسابك مجمد لمدة 3 أيام بسبب: ${user!.freezeReason || 'انتهاك سياسات المنصة'}. لا يمكنك الدخول حالياً.` },
        { status: 403 }
      )
    }

    // SECURITY FORTRESS: Check if account is blacklisted (banned)
    if (user!.isBlacklisted && !user!.isActive) {
      return NextResponse.json(
        { error: 'حسابك محظور نهائياً. تواصل مع الدعم الفني.' },
        { status: 403 }
      )
    }

    if (!user!.emailVerified) {
      return NextResponse.json(
        { error: 'يرجى تأكيد بريدك الإلكتروني أولاً.', needVerification: true },
        { status: 403 }
      )
    }

    // SECURITY: Check if 2FA is required for admin users
    if (user!.twoFactorEnabled) {
      // Return a flag indicating 2FA verification is needed
      // The frontend should then prompt for 2FA code
      const tempToken = signToken(
        { userId: user!.id, email: user!.email, purpose: '2fa-pending', tokenVersion: user!.tokenVersion || 0 },
        '5m' // Short-lived token for 2FA step
      )
      return NextResponse.json(
        { requires2FA: true, tempToken, message: 'يرجى إدخال رمز المصادقة الثنائية' },
        { status: 200 }
      )
    }

    // Successful login - clear attempts
    loginAttempts.delete(email)
    ipAttempts.delete(clientIp)
    // SECURITY: Also reset DB-backed lockout and log successful login
    await handleSuccessfulLogin(email, clientIp, request.headers.get('user-agent') || undefined, user!.id)

    // SECURITY FORTRESS: Comprehensive login security check (VPN detection, same-IP, blacklist, etc.)
    try {
      const { performLoginSecurityCheck } = await import('@/lib/security-fortress')
      await performLoginSecurityCheck({
        userId: user!.id,
        ip: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
        email: user!.email,
      })
    } catch (fortressError) {
      console.error('[FORTRESS] Login security check error (non-blocking):', fortressError)
      // Non-blocking - don't prevent login if fortress check fails
    }

    // SECURITY FIX: Use centralized signToken from @/lib/auth instead of local JWT_SECRET
    const tokenVersion = user!.tokenVersion || 0
    const token = signToken({ userId: user!.id, email: user!.email, role: user!.role, tokenVersion }, '24h')

    const { password: _, verifyCode: _vc, verifyCodeExpiry: _ve, twoFactorSecret: _2fs, kycDocumentImage: _kdi, kycSelfieImage: _ksi, kycFrontImage: _kfi, kycBackImage: _kbi, kycVideoUrl: _kvu, kycAiResult: _kar, kycAiStatus: _kas, emailChangeCode: _ecc, emailChangeExpiry: _ece, newEmail: _ne, ...userWithoutSensitive } = user!

    // Map Prisma field names to frontend field names
    const frontendUser = {
      ...userWithoutSensitive,
      totalDeposit: user!.totalDeposited,
      totalWithdraw: user!.totalWithdrawn,
      referredBy: user!.referredByCode,
      withdrawableBalance: user!.withdrawableBalance,
    }

    const response = NextResponse.json(
      {
        message: 'تم تسجيل الدخول بنجاح',
        user: frontendUser,
        token,
      },
      { status: 200 }
    )

    // Set HTTP-only cookie with strict SameSite for financial platform
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Changed from 'lax' to 'strict' for financial platform
      maxAge: 60 * 60 * 24, // 24 hours (reduced from 7 days)
      path: '/',
    })

    // Log successful login
    console.log(`[LOGIN] User ${user!.email} logged in from IP: ${clientIp}`)

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    )
  }
}

function recordFailedAttempt(email: string, ip: string) {
  // Email-based: progressive lockout (5 → 15min, 10 → 1hr, 15 → 24hr)
  const current = loginAttempts.get(email) || { count: 0, lockedUntil: 0 }
  current.count += 1

  if (current.count >= 15) {
    current.lockedUntil = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  } else if (current.count >= 10) {
    current.lockedUntil = Date.now() + 60 * 60 * 1000 // 1 hour
  } else if (current.count >= 5) {
    current.lockedUntil = Date.now() + 15 * 60 * 1000 // 15 minutes
  }

  loginAttempts.set(email, current)

  // IP-based: 20 attempts per 15 minutes
  const ipCurrent = ipAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  ipCurrent.count += 1

  if (ipCurrent.count >= 20) {
    ipCurrent.lockedUntil = Date.now() + 15 * 60 * 1000 // 15 minutes
  }

  ipAttempts.set(ip, ipCurrent)
}
