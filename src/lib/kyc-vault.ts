// ═══════════════════════════════════════════════════════════════════════════════
// KYC VAULT - Encrypted KYC Document Storage
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. AES-256-GCM encryption for KYC documents at rest
// 2. Per-document encryption keys derived from master key using HKDF
// 3. Secure file storage on disk with encrypted content
// 4. Secure deletion of documents
// 5. Document integrity verification
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

// Use the vault-encryption module for key derivation consistency
import { getCurrentKeyId } from './vault-encryption'

interface EncryptedDocument {
  encrypted: Buffer
  iv: string
  tag: string
  keyId: string
}

interface DocumentMetadata {
  docId: string
  userId: string
  documentType: string
  encryptedAt: number
  keyId: string
  originalSize: number
  algorithm: string
  integrityHash: string
  iv: string
  tag: string
}

const KYC_BASE_DIR = path.join(process.cwd(), 'data', 'kyc')
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Master key for KYC encryption - ENCRYPTION_MASTER_KEY is MANDATORY
const MASTER_KEY = (() => {
  const key = process.env.ENCRYPTION_MASTER_KEY
  if (!key) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required for KYC vault. Set it before starting the application.')
  }
  return key
})()

// Key cache
const keyCache = new Map<string, Buffer>()

/**
 * Derive a per-document encryption key from master key
 * Uses HKDF for proper key derivation
 */
function deriveDocumentKey(userId: string, docId: string, keyId: number): Buffer {
  const cacheKey = `kyc:${userId}:${docId}:${keyId}`
  const cached = keyCache.get(cacheKey)
  if (cached) return cached

  const info = Buffer.from(`kyc-vault:${userId}:${docId}:v${keyId}`)
  const salt = crypto.createHash('sha256').update(MASTER_KEY).digest()

  const key = Buffer.from(crypto.hkdfSync('sha256', MASTER_KEY, salt, info, 32))
  keyCache.set(cacheKey, key)
  return key
}

class KYCVault {
  /**
   * Store a KYC document encrypted on disk.
   * Returns a document ID that can be used to retrieve or delete the document.
   * The document is stored at /data/kyc/{userId}/{docId}.enc
   * Metadata is stored alongside at /data/kyc/{userId}/{docId}.meta.json
   */
  static async storeDocument(
    userId: string,
    documentType: string,
    data: Buffer
  ): Promise<string> {
    // Generate unique document ID
    const docId = `doc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
    const keyId = getCurrentKeyId()

    // Ensure directory exists
    const userDir = path.join(KYC_BASE_DIR, userId)
    if (!existsSync(userDir)) {
      await fs.mkdir(userDir, { recursive: true })
    }

    // Validate paths to prevent traversal
    const resolvedUserDir = path.resolve(userDir)
    const encPath = path.resolve(path.join(userDir, `${docId}.enc`))
    const metaPath = path.resolve(path.join(userDir, `${docId}.meta.json`))

    if (!encPath.startsWith(resolvedUserDir) || !metaPath.startsWith(resolvedUserDir)) {
      throw new Error('Invalid document path: path traversal detected')
    }

    // Encrypt the document
    const encrypted = KYCVault.encrypt(data, userId, docId, keyId)

    // Calculate integrity hash of original data
    const integrityHash = crypto.createHash('sha256').update(data).digest('hex')

    // Write encrypted file
    await fs.writeFile(encPath, encrypted.encrypted)

    // Write metadata (includes iv and tag needed for decryption)
    const metadata: DocumentMetadata = {
      docId,
      userId,
      documentType,
      encryptedAt: Date.now(),
      keyId: String(keyId),
      originalSize: data.length,
      algorithm: ALGORITHM,
      integrityHash,
      iv: encrypted.iv,
      tag: encrypted.tag,
    }

    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2))

    return docId
  }

  /**
   * Retrieve and decrypt a KYC document
   */
  static async retrieveDocument(userId: string, docId: string): Promise<Buffer> {
    // Validate docId format to prevent path traversal
    if (!/^doc_\d+_[a-f0-9]+$/.test(docId)) {
      throw new Error('Invalid document ID format')
    }

    const userDir = path.join(KYC_BASE_DIR, userId)
    const encPath = path.resolve(path.join(userDir, `${docId}.enc`))
    const metaPath = path.resolve(path.join(userDir, `${docId}.meta.json`))
    const resolvedUserDir = path.resolve(userDir)

    if (!encPath.startsWith(resolvedUserDir) || !metaPath.startsWith(resolvedUserDir)) {
      throw new Error('Invalid document path: path traversal detected')
    }

    // Read metadata
    let metadata: DocumentMetadata
    try {
      const metaData = await fs.readFile(metaPath, 'utf8')
      metadata = JSON.parse(metaData)
    } catch {
      throw new Error('Document metadata not found')
    }

    // Read encrypted file
    let encryptedData: Buffer
    try {
      encryptedData = await fs.readFile(encPath)
    } catch {
      throw new Error('Encrypted document not found')
    }

    // Decrypt
    const keyId = parseInt(metadata.keyId, 10) || 1
    const decrypted = KYCVault.decrypt(
      encryptedData,
      metadata.iv,
      metadata.tag,
      userId,
      docId,
      keyId
    )

    // Verify integrity
    const integrityHash = crypto.createHash('sha256').update(decrypted).digest('hex')
    if (integrityHash !== metadata.integrityHash) {
      throw new Error('Document integrity check failed - data may be corrupted or tampered with')
    }

    return decrypted
  }

  /**
   * Securely delete a KYC document
   * Overwrites the file before deletion to prevent recovery
   */
  static async deleteDocument(userId: string, docId: string): Promise<void> {
    // Validate docId format
    if (!/^doc_\d+_[a-f0-9]+$/.test(docId)) {
      throw new Error('Invalid document ID format')
    }

    const userDir = path.join(KYC_BASE_DIR, userId)
    const encPath = path.resolve(path.join(userDir, `${docId}.enc`))
    const metaPath = path.resolve(path.join(userDir, `${docId}.meta.json`))
    const resolvedUserDir = path.resolve(userDir)

    if (!encPath.startsWith(resolvedUserDir) || !metaPath.startsWith(resolvedUserDir)) {
      throw new Error('Invalid document path: path traversal detected')
    }

    // Secure overwrite: write random data over the file before deletion
    try {
      const stat = await fs.stat(encPath).catch(() => null)
      if (stat) {
        const randomOverwrite = crypto.randomBytes(stat.size)
        await fs.writeFile(encPath, randomOverwrite)
      }
    } catch {
      // If overwrite fails, still try to delete
    }

    // Delete files
    await fs.unlink(encPath).catch(() => {})
    await fs.unlink(metaPath).catch(() => {})

    // Clear key cache for this document
    for (const key of keyCache.keys()) {
      if (key.includes(docId)) {
        keyCache.delete(key)
      }
    }
  }

  /**
   * List all document IDs for a user
   */
  static async listDocuments(userId: string): Promise<Array<{ docId: string; documentType: string; encryptedAt: number }>> {
    const userDir = path.join(KYC_BASE_DIR, userId)

    if (!existsSync(userDir)) {
      return []
    }

    const files = await fs.readdir(userDir)
    const metaFiles = files.filter(f => f.endsWith('.meta.json'))

    const documents: Array<{ docId: string; documentType: string; encryptedAt: number }> = []

    for (const metaFile of metaFiles) {
      try {
        const content = await fs.readFile(path.join(userDir, metaFile), 'utf8')
        const metadata: DocumentMetadata = JSON.parse(content)
        documents.push({
          docId: metadata.docId,
          documentType: metadata.documentType,
          encryptedAt: metadata.encryptedAt,
        })
      } catch {
        // Skip corrupt metadata files
      }
    }

    return documents
  }

  // ── Private encryption methods ──

  /**
   * Encrypt data using AES-256-GCM with per-document key derived from master key
   */
  private static encrypt(
    data: Buffer,
    userId: string,
    docId: string,
    keyId: number
  ): { encrypted: Buffer; iv: string; tag: string; keyId: string } {
    const key = deriveDocumentKey(userId, docId, keyId)
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ])

    const tag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyId: String(keyId),
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private static decrypt(
    encrypted: Buffer,
    iv: string,
    tag: string,
    userId: string,
    docId: string,
    keyId: number
  ): Buffer {
    const key = deriveDocumentKey(userId, docId, keyId)
    const ivBuf = Buffer.from(iv, 'base64')
    const tagBuf = Buffer.from(tag, 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf)
    decipher.setAuthTag(tagBuf)

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
  }
}

export { KYCVault }
export type { DocumentMetadata }
