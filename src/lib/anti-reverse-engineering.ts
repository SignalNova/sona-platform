// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-REVERSE ENGINEERING - Code Protection & Integrity Verification System
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. Server-Side Code Fingerprinting - Detect tampering of critical source files
// 2. Anti-Cloning System - Prevent platform replication & unauthorized deployment
// 3. Obfuscation Helpers - Runtime string encryption & anti-debugging
// 4. API Fingerprint Protection - Prevent API pattern analysis
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SERVER-SIDE CODE FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════════════════

export interface CodeFingerprintResult {
  hash: string
  timestamp: number
  filesChecked: number
  status: 'VALID' | 'TAMPERED' | 'UNKNOWN'
}

export interface IntegrityCheckResult {
  isIntact: boolean
  tamperedFiles: string[]
  timestamp: number
  overallHash: string
  alertLevel: 'NONE' | 'WARNING' | 'CRITICAL'
}

class CodeFingerprint {
  private baselineFingerprints = new Map<string, string>()
  private lastCheckTimestamp: number = 0
  private integritySecret: string

  // Critical source files to fingerprint
  private static readonly CRITICAL_FILES = [
    'src/middleware.ts',
    'src/lib/auth.ts',
    'src/lib/fortress-v2.ts',
    'src/lib/security-fortress.ts',
    'src/lib/vault-encryption.ts',
    'src/lib/anti-reverse-engineering.ts',
    'src/lib/stealth-infrastructure.ts',
    'src/lib/security-monitor.ts',
    'src/lib/zero-trust-shield.ts',
    'src/lib/sentinel-ids.ts',
  ]

  constructor() {
    this.integritySecret = process.env.CODE_INTEGRITY_SECRET || crypto.randomBytes(64).toString('hex')
    this.generateFingerprint()
  }

  /**
   * Generate fingerprints for all critical source files
   * Reads actual file contents and hashes them for tamper detection
   */
  generateFingerprint(): CodeFingerprintResult {
    const envBinding = [
      process.env.JWT_SECRET || '',
      process.env.ENCRYPTION_MASTER_KEY || '',
      process.env.ADDRESS_SALT || '',
      process.env.CRON_SECRET || '',
    ].join(':')

    let filesChecked = 0
    const fileHashes: string[] = []

    for (const filePath of CodeFingerprint.CRITICAL_FILES) {
      const fullPath = path.join(process.cwd(), filePath)

      try {
        // Read actual file content and hash it
        const fileContent = fs.readFileSync(fullPath, 'utf8')
        const hash = crypto
          .createHmac('sha256', this.integritySecret)
          .update(`${filePath}:${fileContent}:${envBinding}`)
          .digest('hex')

        this.baselineFingerprints.set(filePath, hash)
        fileHashes.push(hash)
        filesChecked++
      } catch {
        // File may not exist - hash the path + env binding as fallback
        const hash = crypto
          .createHmac('sha256', this.integritySecret)
          .update(`${filePath}:MISSING:${envBinding}`)
          .digest('hex')

        this.baselineFingerprints.set(filePath, hash)
        fileHashes.push(hash)
        filesChecked++
      }
    }

    const overallHash = crypto
      .createHash('sha512')
      .update(fileHashes.join(':'))
      .digest('hex')

    this.lastCheckTimestamp = Date.now()

    return {
      hash: overallHash.substring(0, 32),
      timestamp: this.lastCheckTimestamp,
      filesChecked,
      status: 'VALID',
    }
  }

  /**
   * Verify integrity of critical source files
   * Re-reads file contents and compares against stored baseline hashes
   */
  verifyIntegrity(): IntegrityCheckResult {
    const envBinding = [
      process.env.JWT_SECRET || '',
      process.env.ENCRYPTION_MASTER_KEY || '',
      process.env.ADDRESS_SALT || '',
      process.env.CRON_SECRET || '',
    ].join(':')

    const tamperedFiles: string[] = []

    // Re-read and hash each file, compare against baseline
    for (const [filePath, baselineHash] of this.baselineFingerprints.entries()) {
      const fullPath = path.join(process.cwd(), filePath)

      try {
        const fileContent = fs.readFileSync(fullPath, 'utf8')
        const currentHash = crypto
          .createHmac('sha256', this.integritySecret)
          .update(`${filePath}:${fileContent}:${envBinding}`)
          .digest('hex')

        if (currentHash !== baselineHash) {
          tamperedFiles.push(filePath)
        }
      } catch {
        // File was deleted or is unreadable - check against MISSING hash
        const currentHash = crypto
          .createHmac('sha256', this.integritySecret)
          .update(`${filePath}:MISSING:${envBinding}`)
          .digest('hex')

        if (currentHash !== baselineHash) {
          tamperedFiles.push(filePath)
        }
      }
    }

    const alertLevel: IntegrityCheckResult['alertLevel'] =
      tamperedFiles.length > 0 ? 'CRITICAL' : 'NONE'

    if (tamperedFiles.length > 0) {
      console.error(`[ANTI-RE] CRITICAL: ${tamperedFiles.length} files have been tampered with!`)
      console.error(`[ANTI-RE] Tampered files: ${tamperedFiles.join(', ')}`)
    }

    // Calculate current overall hash
    const currentHashes: string[] = []
    for (const filePath of CodeFingerprint.CRITICAL_FILES) {
      const hash = this.baselineFingerprints.get(filePath)
      if (hash) currentHashes.push(hash)
    }
    const currentOverallHash = crypto
      .createHash('sha512')
      .update(currentHashes.join(':'))
      .digest('hex')

    return {
      isIntact: tamperedFiles.length === 0,
      tamperedFiles,
      timestamp: Date.now(),
      overallHash: currentOverallHash.substring(0, 32),
      alertLevel,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ANTI-CLONING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnvironmentVerification {
  isValid: boolean
  environmentId: string
  checks: {
    name: string
    passed: boolean
    details: string
  }[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface DomainVerification {
  isAuthorized: boolean
  domain: string
  reason?: string
  action: 'ALLOW' | 'REDIRECT' | 'BLOCK'
}

export interface KillSwitchStatus {
  isActive: boolean
  checkedAt: number
  reason?: string
}

class AntiCloningSystem {
  private authorizedDomains: Set<string>
  private authorizedEnvHash: string
  private killSwitchUrl: string | null
  private platformId: string

  constructor() {
    // Authorized domains from environment
    const domainStr = process.env.AUTHORIZED_DOMAINS || 'localhost,127.0.0.1'
    this.authorizedDomains = new Set(domainStr.split(',').map(d => d.trim().toLowerCase()))

    // Environment hash - binds the code to specific environment variables
    const envComponents = [
      process.env.JWT_SECRET || '',
      process.env.ENCRYPTION_MASTER_KEY || '',
      process.env.DATABASE_URL || '',
      process.env.ADDRESS_SALT || '',
    ]
    this.authorizedEnvHash = crypto
      .createHash('sha256')
      .update(envComponents.join(':'))
      .digest('hex')

    // Kill switch URL for remote deactivation
    this.killSwitchUrl = process.env.KILL_SWITCH_URL || null

    // Platform unique identifier
    this.platformId = process.env.PLATFORM_ID || crypto.randomBytes(32).toString('hex')
  }

  /**
   * Verify the current environment matches the authorized deployment
   */
  verifyEnvironment(): EnvironmentVerification {
    const checks: EnvironmentVerification['checks'] = []

    // Check 1: Environment variables integrity
    const currentEnvHash = crypto
      .createHash('sha256')
      .update([
        process.env.JWT_SECRET || '',
        process.env.ENCRYPTION_MASTER_KEY || '',
        process.env.DATABASE_URL || '',
        process.env.ADDRESS_SALT || '',
      ].join(':'))
      .digest('hex')

    const envIntact = currentEnvHash === this.authorizedEnvHash
    checks.push({
      name: 'Environment Integrity',
      passed: envIntact,
      details: envIntact ? 'Environment variables match authorized configuration' : 'Environment variables have been modified',
    })

    // Check 2: Required secrets are present
    const requiredSecrets = ['JWT_SECRET', 'DATABASE_URL']
    if (process.env.NODE_ENV === 'production') {
      requiredSecrets.push('ENCRYPTION_MASTER_KEY', 'ADDRESS_SALT')
    }

    const missingSecrets = requiredSecrets.filter(s => !process.env[s])
    const secretsIntact = missingSecrets.length === 0
    checks.push({
      name: 'Required Secrets',
      passed: secretsIntact,
      details: secretsIntact
        ? 'All required secrets are configured'
        : `Missing secrets: ${missingSecrets.join(', ')}`,
    })

    // Check 3: Node environment
    const isProduction = process.env.NODE_ENV === 'production'
    checks.push({
      name: 'Production Mode',
      passed: true, // Info only, not a failure
      details: isProduction ? 'Running in production mode' : 'Running in development mode',
    })

    // Check 4: Platform ID verification
    const hasPlatformId = !!process.env.PLATFORM_ID
    checks.push({
      name: 'Platform Identity',
      passed: hasPlatformId,
      details: hasPlatformId ? 'Platform ID is configured' : 'No platform ID set - using ephemeral identity',
    })

    // Calculate risk level
    const failedChecks = checks.filter(c => !c.passed).length
    let riskLevel: EnvironmentVerification['riskLevel'] = 'LOW'
    if (!envIntact) riskLevel = 'CRITICAL'
    else if (failedChecks >= 2) riskLevel = 'HIGH'
    else if (failedChecks >= 1) riskLevel = 'MEDIUM'

    return {
      isValid: envIntact && secretsIntact,
      environmentId: this.platformId.substring(0, 12) + '...',
      checks,
      riskLevel,
    }
  }

  /**
   * Verify that the request is coming from an authorized domain
   */
  verifyDomain(request: NextRequest): DomainVerification {
    const host = request.headers.get('host') || ''
    const origin = request.headers.get('origin') || ''
    const referer = request.headers.get('referer') || ''

    // Extract domain from various headers
    const requestDomain = host.split(':')[0].toLowerCase() ||
      origin.replace(/^https?:\/\//, '').split('/')[0].toLowerCase() ||
      referer.replace(/^https?:\/\//, '').split('/')[0].toLowerCase()

    // Check against authorized domains
    const isAuthorized = this.authorizedDomains.has(requestDomain) ||
      this.authorizedDomains.has('localhost') && (requestDomain === 'localhost' || requestDomain === '127.0.0.1')

    if (isAuthorized) {
      return {
        isAuthorized: true,
        domain: requestDomain,
        action: 'ALLOW',
      }
    }

    // Check for common unauthorized domain patterns
    const suspiciousPatterns = [
      /\.test$/i, /\.local$/i, /ngrok/i, /\.eu\.org$/i,
      /freenom/i, /\.tk$/i, /\.ml$/i, /\.ga$/i, /\.cf$/i,
    ]

    const isSuspicious = suspiciousPatterns.some(p => p.test(requestDomain))

    return {
      isAuthorized: false,
      domain: requestDomain,
      reason: isSuspicious
        ? `Domain ${requestDomain} is suspicious and not authorized`
        : `Domain ${requestDomain} is not in the authorized domains list`,
      action: isSuspicious ? 'BLOCK' : 'REDIRECT',
    }
  }

  /**
   * Check remote kill switch
   * In production, this would make a request to a remote endpoint
   * to check if the platform should be deactivated
   */
  async checkKillSwitch(): Promise<KillSwitchStatus> {
    if (!this.killSwitchUrl) {
      return {
        isActive: false,
        checkedAt: Date.now(),
      }
    }

    try {
      const response = await fetch(this.killSwitchUrl, {
        method: 'GET',
        headers: { 'X-Platform-ID': this.platformId },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        // If kill switch is unreachable, assume safe but log warning
        console.warn('[ANTI-RE] Kill switch endpoint unreachable')
        return {
          isActive: false,
          checkedAt: Date.now(),
          reason: 'Kill switch unreachable - assuming active',
        }
      }

      const data = await response.json()
      return {
        isActive: data.active === false,
        checkedAt: Date.now(),
        reason: data.reason,
      }
    } catch {
      return {
        isActive: false,
        checkedAt: Date.now(),
        reason: 'Kill switch check failed - assuming active',
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. OBFUSCATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

class ObfuscationHelper {
  private encryptionKey: Buffer
  private algorithm = 'aes-256-gcm'

  // Dynamic function name rotation state
  private functionNameMap = new Map<string, string>()
  private rotationCounter = 0

  constructor() {
    // Derive key from environment or generate ephemeral key
    const keySource = process.env.OBFUSCATION_KEY || 'default-obfuscation-key-change-in-production'
    this.encryptionKey = crypto.createHash('sha256').update(keySource).digest()
  }

  /**
   * Encrypt a string for storage in memory
   * Returns base64-encoded encrypted string
   */
  encryptString(str: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv) as crypto.CipherGCM

    let encrypted = cipher.update(str, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const tag = cipher.getAuthTag()

    // Format: iv:tag:encrypted
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
  }

  /**
   * Decrypt a string that was encrypted with encryptString
   */
  decryptString(encrypted: string): string {
    try {
      const parts = encrypted.split(':')
      if (parts.length !== 3) return ''

      const iv = Buffer.from(parts[0], 'base64')
      const tag = Buffer.from(parts[1], 'base64')
      const ciphertext = parts[2]

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv) as crypto.DecipherGCM
      decipher.setAuthTag(tag)

      let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch {
      return ''
    }
  }

  /**
   * Detect if a debugger is attached (server-side)
   * Checks for debugging-related environment indicators
   */
  detectDebugger(): boolean {
    // Check for Node.js inspector
    if (process.env.NODE_INSPECTOR || process.env.DEBUG) {
      return true
    }

    // Check for debugging-related process flags
    const execArgv = process.execArgv || []
    if (execArgv.some(arg => arg.includes('--inspect') || arg.includes('--debug'))) {
      return true
    }

    return false
  }

  /**
   * Get a rotated function name to make reverse engineering harder
   * Returns a different name for the same logical function each time
   */
  getRotatedFunctionName(originalName: string): string {
    this.rotationCounter++
    const key = `${originalName}:${this.rotationCounter}`

    if (this.functionNameMap.has(key)) {
      return this.functionNameMap.get(key)!
    }

    // Generate a deterministic but opaque name
    const hash = crypto
      .createHash('sha256')
      .update(`${originalName}:${this.encryptionKey.toString('hex')}:${this.rotationCounter}`)
      .digest('hex')

    const rotatedName = `_f${hash.substring(0, 12)}`
    this.functionNameMap.set(key, rotatedName)
    return rotatedName
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. API FINGERPRINT PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

class APIFingerprintProtection {
  private static readonly JITTER_MIN_MS = 50
  private static readonly JITTER_MAX_MS = 200
  private static readonly DECOY_FIELD_PREFIX = '_meta'

  // Decoy field names that look like real data
  private static readonly DECOY_FIELDS = [
    'session_token', 'request_id', 'server_version',
    'cache_key', 'correlation_id', 'trace_id',
    'deployment_id', 'instance_id', 'region',
  ]

  /**
   * Add random jitter to response timing to prevent timing attacks
   */
  async addJitter<T>(response: T, baseTime: number = 0): Promise<T> {
    const jitterMs = crypto.randomInt(
      APIFingerprintProtection.JITTER_MIN_MS,
      APIFingerprintProtection.JITTER_MAX_MS
    )

    const totalDelay = baseTime + jitterMs
    if (totalDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, totalDelay))
    }

    return response
  }

  /**
   * Add decoy fields to response data
   * These fields look like real metadata but contain random values
   * Makes it harder to identify the actual response structure
   */
  addDecoyFields<T extends Record<string, any>>(data: T): T & Record<string, any> {
    const numDecoys = crypto.randomInt(1, 4) // 1-3 decoy fields
    const result: Record<string, any> = { ...data }

    for (let i = 0; i < numDecoys; i++) {
      const fieldName = APIFingerprintProtection.DECOY_FIELDS[
        crypto.randomInt(0, APIFingerprintProtection.DECOY_FIELDS.length)
      ]
      const decoyKey = `${APIFingerprintProtection.DECOY_FIELD_PREFIX}_${fieldName}`

      // Generate realistic-looking decoy values
      const valueTypes = ['uuid', 'timestamp', 'hash', 'version']
      const valueType = valueTypes[crypto.randomInt(0, valueTypes.length)]

      switch (valueType) {
        case 'uuid':
          result[decoyKey] = crypto.randomUUID()
          break
        case 'timestamp':
          result[decoyKey] = Date.now() - crypto.randomInt(0, 86400000)
          break
        case 'hash':
          result[decoyKey] = crypto.randomBytes(16).toString('hex')
          break
        case 'version':
          result[decoyKey] = `${crypto.randomInt(1, 5)}.${crypto.randomInt(0, 20)}.${crypto.randomInt(0, 100)}`
          break
      }
    }

    return result as T & Record<string, any>
  }

  /**
   * Randomize error response format to prevent API pattern analysis
   * Same error can produce slightly different responses each time
   */
  randomizeErrorResponse(error: { message: string; code?: number }): {
    message: string
    code?: number
    error?: string
    status?: string
    detail?: string
    [key: string]: any
  } {
    const formats = [
      // Format 1: { message, code }
      { message: error.message, code: error.code },
      // Format 2: { error, status }
      { error: error.message, status: error.code ? String(error.code) : 'error' },
      // Format 3: { detail, message }
      { detail: error.message, message: 'Operation failed' },
      // Format 4: { message, code, error }
      { message: error.message, code: error.code, error: 'API_ERROR' },
    ]

    const chosenFormat = formats[crypto.randomInt(0, formats.length)]

    // Add random metadata
    const withMeta: Record<string, any> = {
      ...chosenFormat,
      _ts: Date.now() + crypto.randomInt(-5000, 5000), // Slightly off timestamp
    }

    // Sometimes add a request ID
    if (crypto.randomInt(0, 2) === 0) {
      withMeta.request_id = crypto.randomBytes(8).toString('hex')
    }

    return withMeta as { message: string; code?: number; error?: string; status?: string; detail?: string; [key: string]: any }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const codeFingerprint = new CodeFingerprint()
export const antiCloningSystem = new AntiCloningSystem()
export const obfuscationHelper = new ObfuscationHelper()
export const apiFingerprintProtection = new APIFingerprintProtection()
