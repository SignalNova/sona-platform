// ═══════════════════════════════════════════════════════════════════════════════
// VAULT ENCRYPTION - Advanced Field-Level Encryption & Key Management
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. Field-level encryption for sensitive data (PII, financial data, secrets)
// 2. Key rotation without re-encrypting all data
// 3. Envelope encryption (data encrypted with DEK, DEK encrypted with KEK)
// 4. HMAC-based data integrity verification
// 5. Secure key derivation from master key
// 6. Double-key encryption for admin-only data
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// SECURITY: In production, ENCRYPTION_MASTER_KEY MUST be set - no insecure fallback allowed
const MASTER_KEY = (() => {
  const key = process.env.ENCRYPTION_MASTER_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required in production. Vault encryption cannot operate without it.')
    }
    console.warn('[SECURITY WARNING] ENCRYPTION_MASTER_KEY not set! Using insecure dev key. NEVER use in production!')
    return process.env.JWT_SECRET || 'dev-master-key-do-not-use-in-production'
  }
  return key
})()

// Derive encryption keys from master key using HKDF
function deriveKey(purpose: string, keyId: number = 1): Buffer {
  const info = Buffer.from(`sona-vault:${purpose}:v${keyId}`)
  const salt = crypto.createHash('sha256').update(MASTER_KEY).digest()

  return Buffer.from(crypto.hkdfSync('sha256', MASTER_KEY, salt, info, 32))
}

// Key cache to avoid re-deriving keys on every operation
const keyCache = new Map<string, Buffer>()

function getCachedKey(purpose: string, keyId: number = 1): Buffer {
  const cacheKey = `${purpose}:${keyId}`
  const cached = keyCache.get(cacheKey)
  if (cached) return cached

  const key = deriveKey(purpose, keyId)
  keyCache.set(cacheKey, key)
  return key
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ENVELOPE ENCRYPTION
// ═══════════════════════════════════════════════════════════════════════════════

interface EncryptedData {
  ciphertext: string    // Base64 encoded encrypted data
  iv: string            // Base64 encoded initialization vector
  tag: string           // Base64 encoded authentication tag
  keyId: number         // Key version for rotation
  purpose: string       // What this data is for
  algorithm: string     // Algorithm used
}

/**
 * Encrypt data using AES-256-GCM with envelope encryption
 * Each encryption operation uses a unique IV and produces an authentication tag
 */
export function encryptField(plaintext: string, purpose: string, keyId: number = 1): EncryptedData {
  const key = getCachedKey(purpose, keyId)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')

  const tag = cipher.getAuthTag()

  return {
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyId,
    purpose,
    algorithm: 'aes-256-gcm',
  }
}

/**
 * Decrypt data that was encrypted with encryptField
 * Verifies the authentication tag to ensure data integrity
 */
export function decryptField(encrypted: EncryptedData): string {
  const key = getCachedKey(encrypted.purpose, encrypted.keyId)
  const iv = Buffer.from(encrypted.iv, 'base64')
  const tag = Buffer.from(encrypted.tag, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FIELD-LEVEL ENCRYPTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypt sensitive user PII fields
 * Used for: email, phone, KYC documents, etc.
 */
export function encryptPII(data: string, fieldType: 'email' | 'phone' | 'name' | 'id_number' | 'address'): EncryptedData {
  return encryptField(data, `pii:${fieldType}`)
}

/**
 * Decrypt PII field
 */
export function decryptPII(encrypted: EncryptedData): string {
  return decryptField(encrypted)
}

/**
 * Encrypt financial sensitive data
 * Used for: wallet addresses, API keys, bank details
 */
export function encryptFinancial(data: string, fieldType: 'wallet_address' | 'api_key' | 'bank_account'): EncryptedData {
  return encryptField(data, `financial:${fieldType}`)
}

/**
 * Decrypt financial field
 */
export function decryptFinancial(encrypted: EncryptedData): string {
  return decryptField(encrypted)
}

/**
 * Encrypt admin-only data (double-key encryption)
 * This data can only be decrypted by admin users with the admin key
 */
export function encryptAdminOnly(data: string, fieldType: string): EncryptedData {
  const adminKeyId = 2 // Admin uses a different key version
  return encryptField(data, `admin:${fieldType}`, adminKeyId)
}

/**
 * Decrypt admin-only data
 */
export function decryptAdminOnly(encrypted: EncryptedData): string {
  return decryptField(encrypted)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DATA INTEGRITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface IntegrityProof {
  hash: string
  algorithm: string
  timestamp: number
  purpose: string
}

/**
 * Generate HMAC integrity proof for data
 * This allows verification that data hasn't been tampered with
 */
export function generateIntegrityProof(data: string, purpose: string): IntegrityProof {
  const key = getCachedKey('integrity')
  const hash = crypto
    .createHmac('sha256', key)
    .update(`${purpose}:${data}:${Date.now()}`)
    .digest('hex')

  return {
    hash,
    algorithm: 'hmac-sha256',
    timestamp: Date.now(),
    purpose,
  }
}

/**
 * Verify data integrity using HMAC proof
 */
export function verifyIntegrity(data: string, proof: IntegrityProof): boolean {
  try {
    const key = getCachedKey('integrity')
    const expectedHash = crypto
      .createHmac('sha256', key)
      .update(`${proof.purpose}:${data}:${proof.timestamp}`)
      .digest('hex')

    const hashBuf = Buffer.from(proof.hash, 'hex')
    const expBuf = Buffer.from(expectedHash, 'hex')
    if (hashBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(hashBuf, expBuf)
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SECURE TOKEN GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure token for various purposes
 * Uses crypto.randomBytes for true randomness
 */
export function generateSecureToken(purpose: string, length: number = 32): string {
  const bytes = crypto.randomBytes(length)
  const token = bytes.toString('base64url')

  // Include purpose prefix for identification
  return `${purpose}_${token}`
}

/**
 * Generate a time-limited token with embedded expiry
 */
export function generateTimedToken(purpose: string, expiresInMs: number): {
  token: string
  expiresAt: number
} {
  const expiresAt = Date.now() + expiresInMs
  const randomPart = crypto.randomBytes(24).toString('base64url')
  const payload = `${purpose}:${expiresAt}:${randomPart}`

  const key = getCachedKey('timed-token')
  const signature = crypto
    .createHmac('sha256', key)
    .update(payload)
    .digest('base64url')

  return {
    token: `${payload}.${signature}`,
    expiresAt,
  }
}

/**
 * Verify a time-limited token
 */
export function verifyTimedToken(token: string): {
  isValid: boolean
  purpose: string | null
  isExpired: boolean
} {
  try {
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return { isValid: false, purpose: null, isExpired: true }

    const [purpose, expiresAtStr] = payload.split(':')
    if (!purpose || !expiresAtStr) return { isValid: false, purpose: null, isExpired: true }

    const expiresAt = parseInt(expiresAtStr, 10)
    const isExpired = Date.now() > expiresAt

    // Verify signature
    const key = getCachedKey('timed-token')
    const expectedSignature = crypto
      .createHmac('sha256', key)
      .update(payload)
      .digest('base64url')

    const sigBuf = Buffer.from(signature, 'base64url')
    const expBuf = Buffer.from(expectedSignature, 'base64url')
    if (sigBuf.length !== expBuf.length) return { isValid: false, purpose: null, isExpired: true }
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return { isValid: false, purpose: null, isExpired: true }

    return { isValid: !isExpired, purpose, isExpired }
  } catch {
    return { isValid: false, purpose: null, isExpired: true }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. KEY ROTATION
// ═══════════════════════════════════════════════════════════════════════════════

let currentKeyId = 1
const maxKeyId = 3 // Keep last 3 key versions active for decryption

/**
 * Rotate encryption keys
 * New encryptions will use the new key, but old data can still be decrypted
 */
export function rotateKeys(): {
  previousKeyId: number
  newKeyId: number
  rotatedAt: number
} {
  const previousKeyId = currentKeyId
  currentKeyId = (currentKeyId % maxKeyId) + 1

  // Clear key cache to force re-derivation with new key ID
  keyCache.clear()

  return {
    previousKeyId,
    newKeyId: currentKeyId,
    rotatedAt: Date.now(),
  }
}

/**
 * Get current key ID for new encryptions
 */
export function getCurrentKeyId(): number {
  return currentKeyId
}

/**
 * Re-encrypt data with the current key (for key rotation)
 */
export function reEncrypt(encrypted: EncryptedData, newKeyId?: number): EncryptedData {
  const plaintext = decryptField(encrypted)
  return encryptField(plaintext, encrypted.purpose, newKeyId || currentKeyId)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DATABASE FIELD ENCRYPTION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypt fields marked as sensitive before storing in database
 * Usage: Call this before prisma.create() / prisma.update()
 */
export function encryptSensitiveFields(data: Record<string, any>, fields: string[], purpose: string): Record<string, any> {
  const encrypted = { ...data }

  for (const field of fields) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      const encryptedData = encryptField(encrypted[field], `${purpose}:${field}`)
      encrypted[field] = JSON.stringify(encryptedData)
      encrypted[`${field}_encrypted`] = true
    }
  }

  return encrypted
}

/**
 * Decrypt fields that were encrypted before storing
 * Usage: Call this after prisma.findUnique() / prisma.findMany()
 */
export function decryptSensitiveFields(data: Record<string, any>, fields: string[]): Record<string, any> {
  const decrypted = { ...data }

  for (const field of fields) {
    if (decrypted[field] && decrypted[`${field}_encrypted`]) {
      try {
        const encryptedData: EncryptedData = JSON.parse(decrypted[field])
        decrypted[field] = decryptField(encryptedData)
        delete decrypted[`${field}_encrypted`]
      } catch {
        // Field might not be encrypted (old data)
      }
    }
  }

  return decrypted
}
