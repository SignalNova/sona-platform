import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    steps: {},
  }

  // Step 1: Check DATABASE_URL
  const dbUrl = process.env.DATABASE_URL
  results.steps.databaseUrl = {
    set: !!dbUrl,
    prefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT SET',
    isPostgres: dbUrl?.startsWith('postgresql://') || dbUrl?.startsWith('postgres://') || false,
  }

  // Step 2: Test DB connection
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    results.steps.dbConnection = { status: 'ok', timeMs: Date.now() - start }
  } catch (error: any) {
    results.steps.dbConnection = {
      status: 'error',
      error: error.message,
      code: error.code,
      meta: error.meta ? JSON.stringify(error.meta).substring(0, 200) : undefined,
    }
  }

  // Step 3: Test User model access
  try {
    const userCount = await db.user.count()
    results.steps.userModel = { status: 'ok', count: userCount }
  } catch (error: any) {
    results.steps.userModel = {
      status: 'error',
      error: error.message,
      code: error.code,
    }
  }

  // Step 4: Test security-fortress import
  try {
    const { checkBlacklist } = await import('@/lib/security-fortress')
    results.steps.securityFortress = { status: 'ok', hasCheckBlacklist: typeof checkBlacklist === 'function' }
  } catch (error: any) {
    results.steps.securityFortress = {
      status: 'error',
      error: error.message,
    }
  }

  // Step 5: Test notifications import
  try {
    const { createNotification, notifyWelcomeNewUser } = await import('@/lib/notifications')
    results.steps.notifications = {
      status: 'ok',
      hasCreateNotification: typeof createNotification === 'function',
      hasNotifyWelcomeNewUser: typeof notifyWelcomeNewUser === 'function',
    }
  } catch (error: any) {
    results.steps.notifications = {
      status: 'error',
      error: error.message,
    }
  }

  // Step 6: Test email import
  try {
    const { sendVerificationEmail, isEmailDeliveryReliable } = await import('@/lib/email')
    results.steps.emailModule = {
      status: 'ok',
      hasSendVerificationEmail: typeof sendVerificationEmail === 'function',
      hasIsEmailDeliveryReliable: typeof isEmailDeliveryReliable === 'function',
    }
  } catch (error: any) {
    results.steps.emailModule = {
      status: 'error',
      error: error.message,
    }
  }

  // Step 7: Test bcrypt
  try {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('test', 4)
    const match = await bcrypt.compare('test', hash)
    results.steps.bcrypt = { status: 'ok', hashWorks: match }
  } catch (error: any) {
    results.steps.bcrypt = {
      status: 'error',
      error: error.message,
    }
  }

  // Step 8: Check all required env vars
  results.steps.envVars = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASS: !!process.env.SMTP_PASS,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET',
  }

  return NextResponse.json(results, { status: 200 })
}
