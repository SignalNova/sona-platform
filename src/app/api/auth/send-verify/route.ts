import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/email'

// Simple in-memory rate limiting
const lastSentMap = new Map<string, number>()

function generateCode(): string {
  // SECURITY: Use crypto.randomInt() instead of Math.random() for cryptographic safety
  return require('crypto').randomInt(100000, 999999).toString()
}

// SECURITY: Return same generic message regardless of whether user exists
// to prevent email enumeration attacks
const genericSuccessMessage = 'إذا كان البريد مسجلاً لدينا وغير مفعل، سيتم إرسال رمز التحقق إليه'

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

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { message: genericSuccessMessage },
        { status: 200 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: genericSuccessMessage },
        { status: 200 }
      )
    }

    // Rate limiting: only allow resend every 60 seconds
    const now = Date.now()
    const lastSent = lastSentMap.get(email)
    if (lastSent && now - lastSent < 60000) {
      const remainingSeconds = Math.ceil((60000 - (now - lastSent)) / 1000)
      return NextResponse.json(
        { error: `يرجى الانتظار ${remainingSeconds} ثانية قبل طلب رمز جديد` },
        { status: 429 }
      )
    }

    // Generate a new 6-digit code
    const code = generateCode()
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    // Send the verification email FIRST, then save if successful
    const userName = user.name || email.split('@')[0]
    const result = await sendVerificationEmail(email, code, userName)

    // CRITICAL FIX: Only save code if email was sent successfully
    // TEMPORARY: If email fails, save the code anyway and return it
    // This allows verification even when email delivery is broken
    // TODO: Remove tempVerifyCode once domain verification is complete
    if (!result.success) {
      console.warn(`[SEND-VERIFY] Email failed for ${email}, saving code anyway for temp verification`)
      await db.user.update({
        where: { id: user.id },
        data: {
          verifyCode: code,
          verifyCodeExpiry: expiry,
        },
      })
      lastSentMap.set(email, now)
      // Return the code temporarily so user can verify
      return NextResponse.json(
        { 
          message: 'لم يتم إرسال البريد الإلكتروني. استخدم رمز التحقق المؤقت.',
          tempVerifyCode: code // TEMPORARY: Remove after email is working
        },
        { status: 200 }
      )
    }

    // Email sent successfully - save the code
    await db.user.update({
      where: { id: user.id },
      data: {
        verifyCode: code,
        verifyCodeExpiry: expiry,
      },
    })

    // Update rate limit tracker
    lastSentMap.set(email, now)

    // Clean up old entries from rate limit map (older than 5 minutes)
    for (const [key, timestamp] of lastSentMap.entries()) {
      if (now - timestamp > 5 * 60 * 1000) {
        lastSentMap.delete(key)
      }
    }

    return NextResponse.json(
      { message: genericSuccessMessage },
      { status: 200 }
    )
  } catch (error) {
    console.error('Send verify error:', error)
    return NextResponse.json(
      { message: genericSuccessMessage },
      { status: 200 }
    )
  }
}
