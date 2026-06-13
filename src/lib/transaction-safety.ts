import { db } from '@/lib/db'

/**
 * TransactionSafety
 *
 * Financial transaction safety utilities:
 * - Idempotency key management – prevent duplicate operations
 * - Balance verification – ensure balance consistency
 * - Concurrent operation detection – prevent race conditions
 * - Transaction amount validation – sanity checks on amounts
 */

// ═══════════════════════════════════════════════════════════
// IDEMPOTENCY KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════

export class TransactionSafety {
  // ─── Idempotency ────────────────────────────────────────────
  /**
   * Check if an idempotency key has already been used.
   * Returns `true` if the key already exists (i.e. duplicate request).
   */
  static async checkIdempotency(key: string): Promise<boolean> {
    // Clean expired keys first
    await db.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }).catch(() => {})

    const existing = await db.idempotencyKey.findUnique({
      where: { key },
    })

    return !!existing
  }

  /**
   * Record an idempotency key with its result.
   * Key expires after 24 hours by default.
   */
  static async recordIdempotency(
    key: string,
    userId: string,
    action: string,
    result?: unknown,
    ttlMs: number = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    await db.idempotencyKey.create({
      data: {
        key,
        userId,
        action,
        result: result ? JSON.stringify(result) : null,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })
  }

  /**
   * Get the stored result for an idempotency key (for replaying responses).
   */
  static async getIdempotencyResult(key: string): Promise<unknown | null> {
    const record = await db.idempotencyKey.findUnique({
      where: { key },
    })
    if (!record?.result) return null
    try {
      return JSON.parse(record.result)
    } catch {
      return null
    }
  }

  // ─── Balance verification ──────────────────────────────────
  /**
   * Verify that a user's balance is consistent.
   * Checks: balance >= 0, withdrawableBalance <= balance, lockedCapital >= 0
   */
  static async verifyBalance(userId: string): Promise<BalanceVerification> {
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return {
        consistent: false,
        issues: ['USER_NOT_FOUND'],
        balance: 0,
        withdrawableBalance: 0,
        lockedCapital: 0,
      }
    }

    const issues: string[] = []

    if (user.balance < 0) issues.push('NEGATIVE_BALANCE')
    if (user.withdrawableBalance < 0) issues.push('NEGATIVE_WITHDRAWABLE')
    if (user.lockedCapital < 0) issues.push('NEGATIVE_LOCKED_CAPITAL')
    if (user.withdrawableBalance > user.balance) {
      issues.push('WITHDRAWABLE_EXCEEDS_BALANCE')
    }

    return {
      consistent: issues.length === 0,
      issues,
      balance: user.balance,
      withdrawableBalance: user.withdrawableBalance,
      lockedCapital: user.lockedCapital,
    }
  }

  // ─── Concurrent operation detection ────────────────────────
  // Uses the IdempotencyKey table as a lightweight distributed lock.
  // The "key" is `lock:{userId}:{operationType}` and the action is `LOCK`.

  /**
   * Check if a concurrent operation is already running for this user+type.
   * Returns `true` if an operation is already locked (i.e. concurrent detected).
   */
  static async checkConcurrentOperation(
    userId: string,
    operationType: string,
  ): Promise<boolean> {
    const lockKey = `lock:${userId}:${operationType}`

    // Clean expired locks
    await db.idempotencyKey.deleteMany({
      where: {
        action: 'LOCK',
        expiresAt: { lt: new Date() },
      },
    }).catch(() => {})

    const existing = await db.idempotencyKey.findUnique({
      where: { key: lockKey },
    })

    return !!existing
  }

  /**
   * Acquire a lock for a user+operation. Returns the lock ID.
   * Lock auto-expires after 30 seconds by default.
   * Throws if a lock already exists.
   */
  static async lockOperation(
    userId: string,
    operationType: string,
    ttlMs: number = 30_000,
  ): Promise<string> {
    const lockKey = `lock:${userId}:${operationType}`
    const lockId = `lock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Check existing lock
    const concurrent = await this.checkConcurrentOperation(userId, operationType)
    if (concurrent) {
      throw new Error('CONCURRENT_OPERATION_IN_PROGRESS')
    }

    // Create lock record
    await db.idempotencyKey.create({
      data: {
        key: lockKey,
        userId,
        action: 'LOCK',
        result: lockId,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })

    return lockId
  }

  /**
   * Release an operation lock.
   */
  static async unlockOperation(lockId: string): Promise<void> {
    // Find the lock by its result field
    const lock = await db.idempotencyKey.findFirst({
      where: {
        action: 'LOCK',
        result: lockId,
      },
    })

    if (lock) {
      await db.idempotencyKey.delete({
        where: { id: lock.id },
      }).catch(() => {})
    }
  }

  // ─── Transaction amount validation ─────────────────────────
  /**
   * Validate a transaction amount for a given type.
   */
  static validateAmount(amount: number, type: string): ValidationResult {
    const errors: string[] = []

    // Basic sanity checks
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push('AMOUNT_NOT_A_NUMBER')
      return { valid: false, errors }
    }

    if (!isFinite(amount)) {
      errors.push('AMOUNT_NOT_FINITE')
    }

    if (amount <= 0) {
      errors.push('AMOUNT_MUST_BE_POSITIVE')
    }

    // Precision: 2 decimal places for USDT
    const rounded = Math.floor(amount * 100) / 100
    if (Math.abs(amount - rounded) > 0.0001) {
      errors.push('AMOUNT_EXCEEDS_PRECISION')
    }

    // Maximum amounts per type
    const maxAmounts: Record<string, number> = {
      WITHDRAWAL: 100_000,
      P2P_TRANSFER: 50_000,
      INVESTMENT: 1_000_000,
      REINVEST: 1_000_000,
      DEPOSIT: 1_000_000,
    }

    const maxAmount = maxAmounts[type] ?? 1_000_000
    if (amount > maxAmount) {
      errors.push(`AMOUNT_EXCEEDS_MAX_${type}`)
    }

    // Minimum amounts per type
    const minAmounts: Record<string, number> = {
      WITHDRAWAL: 1,
      P2P_TRANSFER: 1,
      INVESTMENT: 1,
      REINVEST: 1,
      DEPOSIT: 1,
    }

    const minAmount = minAmounts[type] ?? 0.01
    if (amount < minAmount) {
      errors.push('AMOUNT_BELOW_MINIMUM')
    }

    return { valid: errors.length === 0, errors }
  }
}

// ─── Types ─────────────────────────────────────────────────────
export interface BalanceVerification {
  consistent: boolean
  issues: string[]
  balance: number
  withdrawableBalance: number
  lockedCapital: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Helper: Generate an idempotency key from request details.
 * Format: `{userId}:{action}:{hashOfPayload}`
 * This allows easy duplicate detection for the same user performing
 * the same action with the same parameters.
 */
export async function generateIdempotencyKey(
  userId: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<string> {
  // Simple hash of the payload for uniqueness
  const payloadStr = JSON.stringify(payload, Object.keys(payload).sort())
  // Use a simple hash (djb2) - this doesn't need to be cryptographic
  let hash = 5381
  for (let i = 0; i < payloadStr.length; i++) {
    hash = ((hash << 5) + hash + payloadStr.charCodeAt(i)) & 0xffffffff
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0')
  return `${userId}:${action}:${hashHex}`
}
