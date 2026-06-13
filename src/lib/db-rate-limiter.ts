import { db } from '@/lib/db'

/**
 * DBRateLimiter
 *
 * Database-backed rate limiting using SQLite / Prisma.
 * Persists across server restarts and works with multiple instances.
 *
 * USAGE (in route handlers):
 *   const result = await DBRateLimiter.checkLimit(userId, 'withdrawal', 5, 60_000)
 *   if (!result.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
 *
 *   await DBRateLimiter.recordAttempt(userId, 'withdrawal', false, { ip, userAgent })
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  totalAttempts: number
}

export interface AttemptMetadata {
  ip?: string
  userAgent?: string
}

export class DBRateLimiter {
  // ─── Check if request is within rate limit ─────────────────
  /**
   * Check whether `identifier` is still within the allowed number of
   * attempts for `action` within the rolling time window `windowMs`.
   *
   * This does **not** record an attempt – call `recordAttempt` separately
   * after you know whether the action succeeded or failed.
   */
  static async checkLimit(
    identifier: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const windowStart = new Date(Date.now() - windowMs)

    const attempts = await db.rateLimitAttempt.findMany({
      where: {
        identifier,
        action,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
      take: maxAttempts + 1, // one extra to determine overflow
    })

    const totalAttempts = attempts.length
    const allowed = totalAttempts < maxAttempts
    const remaining = Math.max(0, maxAttempts - totalAttempts)

    // The reset time is when the oldest attempt in the window expires
    const oldestInWindow = attempts[attempts.length - 1]
    const resetAt = oldestInWindow
      ? new Date(oldestInWindow.createdAt.getTime() + windowMs)
      : new Date(Date.now() + windowMs)

    return { allowed, remaining, resetAt, totalAttempts }
  }

  // ─── Record an attempt ─────────────────────────────────────
  static async recordAttempt(
    identifier: string,
    action: string,
    success: boolean,
    metadata?: AttemptMetadata,
  ): Promise<void> {
    await db.rateLimitAttempt.create({
      data: {
        identifier,
        action,
        success,
        ip: metadata?.ip ?? null,
        userAgent: metadata?.userAgent ?? null,
      },
    })
  }

  // ─── Get current attempt count ─────────────────────────────
  static async getAttemptCount(
    identifier: string,
    action: string,
    windowMs: number,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs)

    const count = await db.rateLimitAttempt.count({
      where: {
        identifier,
        action,
        createdAt: { gte: windowStart },
      },
    })

    return count
  }

  // ─── Reset rate limit for an identifier ────────────────────
  static async resetLimit(identifier: string, action: string): Promise<void> {
    await db.rateLimitAttempt.deleteMany({
      where: { identifier, action },
    })
  }

  // ─── Clean up old records (call periodically) ──────────────
  /**
   * Remove records older than 24 hours.
   * Safe to call from a cron job or on a timer.
   */
  static async cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs)

    const result = await db.rateLimitAttempt.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    return result.count
  }
}

// ─── Pre-defined rate limit configurations ────────────────────
export const RATE_LIMITS = {
  LOGIN:           { action: 'login',           maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  OTP:             { action: 'otp',             maxAttempts: 5,  windowMs: 15 * 60 * 1000 },
  P2P_TRANSFER:    { action: 'p2p_transfer',    maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  WITHDRAWAL:      { action: 'withdrawal',      maxAttempts: 5,  windowMs: 60 * 60 * 1000 },
  INVEST:          { action: 'invest',           maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  REINVEST:        { action: 'reinvest',         maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  CHANGE_PASSWORD: { action: 'change_password', maxAttempts: 3,  windowMs: 5 * 60 * 1000 },
  CHANGE_EMAIL:    { action: 'change_email',    maxAttempts: 3,  windowMs: 5 * 60 * 1000 },
  KYC:             { action: 'kyc',             maxAttempts: 5,  windowMs: 60 * 60 * 1000 },
  REGISTER:        { action: 'register',        maxAttempts: 3,  windowMs: 60 * 60 * 1000 },
} as const
