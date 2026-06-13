// ═══════════════════════════════════════════════════════════════════════════════
// CSRF PROTECTION - HMAC-SHA256 Based Cross-Site Request Forgery Prevention
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. HMAC-SHA256 signed CSRF tokens tied to user sessions
// 2. Timing-safe token comparison to prevent timing attacks
// 3. Automatic token expiration and cleanup
// 4. Per-session nonce for uniqueness
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

interface CSRFTokenEntry {
  token: string
  expires: number
}

class CSRFProtection {
  private static instance: CSRFProtection
  private tokenStore: Map<string, CSRFTokenEntry> = new Map()
  private readonly SECRET: string
  private readonly TOKEN_EXPIRY = 3600000 // 1 hour

  private constructor() {
    this.SECRET = (() => {
      const key = process.env.CSRF_SECRET
      if (!key) {
        throw new Error('CSRF_SECRET environment variable is required. Set it before starting the application.')
      }
      return key
    })()

    // Clean expired tokens every 10 minutes
    setInterval(() => {
      this.cleanup()
    }, 10 * 60 * 1000)
  }

  static getInstance(): CSRFProtection {
    if (!CSRFProtection.instance) {
      CSRFProtection.instance = new CSRFProtection()
    }
    return CSRFProtection.instance
  }

  /**
   * Generate a CSRF token tied to a session ID.
   * Token format: HMAC-SHA256(sessionId + nonce + timestamp, SECRET).timestamp.nonce
   * The token is deterministic for the same session+nonce+timestamp but unique per generation.
   */
  generateToken(sessionId: string): string {
    const nonce = randomBytes(16).toString('hex')
    const timestamp = Date.now().toString()

    // HMAC-SHA256(sessionId + nonce + timestamp, SECRET)
    const hmac = createHmac('sha256', this.SECRET)
    hmac.update(`${sessionId}:${nonce}:${timestamp}`)
    const signature = hmac.digest('hex')

    // Token format: signature.timestamp.nonce
    const token = `${signature}.${timestamp}.${nonce}`

    this.tokenStore.set(`${sessionId}:${nonce}`, {
      token: signature,
      expires: Date.now() + this.TOKEN_EXPIRY,
    })

    return token
  }

  /**
   * Validate a CSRF token using timing-safe comparison.
   * Reconstructs the HMAC from the token components and compares.
   */
  validateToken(sessionId: string, token: string): boolean {
    try {
      if (!token || !sessionId) return false

      const parts = token.split('.')
      if (parts.length !== 3) return false

      const [signature, timestamp, nonce] = parts
      if (!signature || !timestamp || !nonce) return false

      // Check expiration
      const tokenTime = parseInt(timestamp, 10)
      if (isNaN(tokenTime) || Date.now() - tokenTime > this.TOKEN_EXPIRY) {
        // Clean up expired entry
        this.tokenStore.delete(`${sessionId}:${nonce}`)
        return false
      }

      // Check if we have a stored entry
      const storeKey = `${sessionId}:${nonce}`
      const stored = this.tokenStore.get(storeKey)
      if (!stored) return false

      if (stored.expires < Date.now()) {
        this.tokenStore.delete(storeKey)
        return false
      }

      // Reconstruct expected HMAC
      const hmac = createHmac('sha256', this.SECRET)
      hmac.update(`${sessionId}:${nonce}:${timestamp}`)
      const expectedSignature = hmac.digest('hex')

      // Timing-safe comparison
      const sigBuf = Buffer.from(signature, 'utf8')
      const expBuf = Buffer.from(expectedSignature, 'utf8')
      if (sigBuf.length !== expBuf.length) return false

      const isValid = timingSafeEqual(sigBuf, expBuf)

      // Invalidate token after use (one-time use)
      if (isValid) {
        this.tokenStore.delete(storeKey)
      }

      return isValid
    } catch {
      return false
    }
  }

  /**
   * Clean expired tokens from the store
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.tokenStore.entries()) {
      if (entry.expires < now) {
        this.tokenStore.delete(key)
      }
    }
  }

  /**
   * Get the number of active tokens (for monitoring)
   */
  getActiveTokenCount(): number {
    return this.tokenStore.size
  }
}

export const csrfProtection = CSRFProtection.getInstance()
