import { db } from '@/lib/db'
import { createNotification, notifyEmailVerified, notifyReferralBonus } from '@/lib/notifications'
import { sendAccountCreatedEmail, sendWelcomeEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// SECURITY: Rate limiting for verification attempts
const verifyAttempts = new Map<string, { count: number; lockedUntil: number }>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of verifyAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil < now) verifyAttempts.delete(key)
  }
}, 5 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'رمز التحقق يجب أن يكون 6 أرقام' },
        { status: 400 }
      )
    }

    // SECURITY: Rate limiting - max 5 attempts, then lock for 15 minutes
    const attempts = verifyAttempts.get(email)
    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000)
      return NextResponse.json(
        { error: `تم تجاوز عدد المحاولات المسموحة. حاول مرة أخرى بعد ${remainingMinutes} دقيقة` },
        { status: 429 }
      )
    }

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // SECURITY FIX: Return generic message to prevent user enumeration
      // Previously returned 404 with 'المستخدم غير موجود' which revealed the email doesn't exist
      return NextResponse.json(
        { error: 'رمز التحقق غير صالح أو منتهي الصلاحية' },
        { status: 400 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'البريد الإلكتروني مفعل بالفعل' },
        { status: 200 }
      )
    }

    // Check if verification code exists
    if (!user.verifyCode || !user.verifyCodeExpiry) {
      return NextResponse.json(
        { error: 'لم يتم إرسال رمز تحقق. يرجى طلب رمز جديد' },
        { status: 400 }
      )
    }

    // SECURITY FIX: Use timing-safe comparison to prevent timing attacks on verification codes
    // Previously used !== which could leak information about the code via response timing
    let codeMatch = false
    try {
      const storedBuf = Buffer.from(String(user.verifyCode), 'utf8')
      const inputBuf = Buffer.from(String(code), 'utf8')
      if (storedBuf.length === inputBuf.length) {
        codeMatch = crypto.timingSafeEqual(storedBuf, inputBuf)
      }
    } catch {
      codeMatch = false
    }

    if (!codeMatch) {
      // SECURITY: Record failed attempt
      const current = verifyAttempts.get(email) || { count: 0, lockedUntil: 0 }
      current.count += 1
      if (current.count >= 5) {
        current.lockedUntil = Date.now() + 15 * 60 * 1000 // Lock for 15 minutes
      }
      verifyAttempts.set(email, current)

      // SECURITY: After 5 failed attempts, invalidate the code
      if (current.count >= 5) {
        await db.user.update({
          where: { id: user.id },
          data: { verifyCode: null, verifyCodeExpiry: null },
        })
        return NextResponse.json(
          { error: 'تم تجاوز عدد المحاولات. يرجى طلب رمز تحقق جديد' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: 'رمز التحقق غير صحيح' },
        { status: 400 }
      )
    }

    // Check if code has expired
    if (new Date() > user.verifyCodeExpiry) {
      return NextResponse.json(
        { error: 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد' },
        { status: 400 }
      )
    }

    // Clear rate limit on success
    verifyAttempts.delete(email)

    // Verify the user and clear the code
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyCode: null,
        verifyCodeExpiry: null,
      },
    })

    // SECURITY: Credit referral bonus ONLY after email verification
    // This prevents fake account farming for referral bonuses
    if (user.referredByCode) {
      try {
        const referrer = await db.user.findUnique({
          where: { referralCode: user.referredByCode },
        })
        if (referrer) {
          // Check if referrer has already been credited for this referral (prevent duplicate)
          const existingReferral = await db.referral.findFirst({
            where: {
              referrerId: referrer.id,
              referredId: user.id,
              status: 'CREDITED',
            },
          })

          if (!existingReferral) {
            // Get reward amount from platform settings or use default
            let rewardAmount = 5 // default $5
            try {
              const setting = await db.platformSetting.findUnique({
                where: { key: 'commission_direct_bonus' },
              })
              if (setting) {
                const parsed = parseFloat(setting.value)
                if (!isNaN(parsed) && parsed > 0) {
                  rewardAmount = parsed
                }
              }
            } catch {
              // Use default if settings unavailable
            }

            // Credit the referral bonus to the referrer
            await db.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: referrer.id },
                data: {
                  balance: { increment: rewardAmount },
                  withdrawableBalance: { increment: rewardAmount },
                  totalProfit: { increment: rewardAmount },
                },
              })
              await tx.referral.create({
                data: {
                  referrerId: referrer.id,
                  referredId: user.id,
                  reward: rewardAmount,
                  status: 'CREDITED',
                },
              })
              await tx.transaction.create({
                data: {
                  userId: referrer.id,
                  type: 'REFERRAL_BONUS',
                  amount: rewardAmount,
                  status: 'COMPLETED',
                  description: `مكافأة إحالة - مستخدم جديد (${user.name || user.email})`,
                },
              })
            })
            console.log(`[VERIFY-EMAIL] Referral bonus credited: $${rewardAmount} to referrer ${referrer.id}`)

            // Send notification to referrer about the bonus (Syrian dialect)
            await notifyReferralBonus(referrer.id, rewardAmount, user.name || user.email)

            // Send email verified notification to the user (Syrian dialect)
            await notifyEmailVerified(user.id)
          } else {
            console.log(`[VERIFY-EMAIL] Referral already credited for referrer ${referrer.id} and referred ${user.id}`)
          }
        }
      } catch (refErr) {
        console.error('[VERIFY-EMAIL] Error crediting referral:', refErr)
      }
    } else {
      // No referral - still send email verified notification
      await notifyEmailVerified(user.id)
    }

    // Send welcome emails AFTER verification (not during registration - avoids spam triggers)
    const userName = user.name || email.split('@')[0]
    sendAccountCreatedEmail(email, userName).catch((err) =>
      console.error('[VERIFY-EMAIL] Failed to send account created email:', err)
    )
    sendWelcomeEmail(email, userName).catch((err) =>
      console.error('[VERIFY-EMAIL] Failed to send welcome email:', err)
    )

    const { password: _, verifyCode: _vc, verifyCodeExpiry: _ve, twoFactorSecret: _2fs,
      kycDocumentImage: _kdi, kycSelfieImage: _ksi, kycFrontImage: _kfi, kycBackImage: _kbi,
      kycVideoUrl: _kvu, kycAiResult: _kar, kycAiStatus: _kas,
      emailChangeCode: _ecc, emailChangeExpiry: _ece, newEmail: _ne,
      ...userWithoutSensitive } = updatedUser

    return NextResponse.json(
      {
        message: 'تم تأكيد البريد الإلكتروني بنجاح',
        user: userWithoutSensitive,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحقق من البريد الإلكتروني' },
      { status: 500 }
    )
  }
}
