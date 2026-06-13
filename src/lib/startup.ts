/**
 * Startup initialization for SONA Platform
 * Ensures the admin account exists and is properly configured
 */

import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

/**
 * Ensures the admin account exists in the database.
 * Called once on server startup via instrumentation.ts
 *
 * This solves the chicken-and-egg problem where the first admin
 * can't be created through the UI because no admin exists yet.
 */
export async function ensureAdminAccount(): Promise<void> {
  if (!ADMIN_EMAIL) {
    console.warn('[STARTUP] ADMIN_EMAIL not set - skipping admin account creation')
    return
  }

  if (!ADMIN_PASSWORD) {
    console.warn('[STARTUP] ADMIN_PASSWORD not set - skipping admin account creation')
    return
  }

  try {
    // Check if admin user already exists
    const existingAdmin = await db.user.findFirst({
      where: {
        OR: [
          { role: 'ADMIN' },
          { role: 'admin' },
          { email: ADMIN_EMAIL },
        ]
      }
    })

    if (existingAdmin) {
      // Ensure the existing admin has correct role and is active
      const updates: Record<string, any> = {}

      if (existingAdmin.role !== 'ADMIN') {
        updates.role = 'ADMIN'
      }
      if (!existingAdmin.emailVerified) {
        updates.emailVerified = true
      }
      if (!existingAdmin.isActive) {
        updates.isActive = true
      }

      // Verify password matches ADMIN_PASSWORD - if not, update it
      if (existingAdmin.password.startsWith('$2')) {
        const passwordMatch = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.password)
        if (!passwordMatch) {
          updates.password = await bcrypt.hash(ADMIN_PASSWORD, 12)
          console.log('[STARTUP] Admin password updated to match ADMIN_PASSWORD env var')
        }
      } else {
        // Non-bcrypt password - force update
        updates.password = await bcrypt.hash(ADMIN_PASSWORD, 12)
        console.log('[STARTUP] Admin password updated to bcrypt format')
      }

      if (Object.keys(updates).length > 0) {
        await db.user.update({
          where: { id: existingAdmin.id },
          data: updates,
        })
        console.log(`[STARTUP] Admin account updated: ${ADMIN_EMAIL} (fields: ${Object.keys(updates).join(', ')})`)
      } else {
        console.log(`[STARTUP] Admin account verified: ${ADMIN_EMAIL}`)
      }
      return
    }

    // No admin exists - create one
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

    // Generate unique referral code
    const crypto = await import('crypto')
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = 'SONA'
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(crypto.randomInt(0, chars.length))
      }
      return code
    }

    let referralCode = generateReferralCode()
    let attempts = 0
    while (await db.user.findUnique({ where: { referralCode } }) && attempts < 20) {
      referralCode = generateReferralCode()
      attempts++
    }

    await db.user.create({
      data: {
        name: 'Admin',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        balance: 0,
        totalProfit: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        emailVerified: true,
        isActive: true,
        role: 'ADMIN',
        referralCode,
        tokenVersion: 1,
      },
    })

    console.log(`[STARTUP] Admin account created: ${ADMIN_EMAIL}`)

    // Log creation
    try {
      await db.platformLog.create({
        data: {
          action: 'ADMIN_ACCOUNT_AUTO_CREATED',
          details: JSON.stringify({
            email: ADMIN_EMAIL,
            source: 'startup_instrumentation',
            timestamp: new Date().toISOString(),
          }),
        },
      })
    } catch {
      // platformLog table might not exist yet
    }
  } catch (error) {
    console.error('[STARTUP] Error ensuring admin account:', error)
    // Don't throw - startup should continue even if DB isn't ready
  }
}
