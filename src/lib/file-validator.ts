// ═══════════════════════════════════════════════════════════════════════════════
// FILE VALIDATOR - Magic Byte File Validation & Malicious Content Detection
// ═══════════════════════════════════════════════════════════════════════════════
// This system provides:
// 1. Magic byte signature validation for common file types
// 2. Detection of embedded malicious content (polyglots, steganography indicators)
// 3. File size validation
// 4. Filename sanitization to prevent path traversal and injection
// ═══════════════════════════════════════════════════════════════════════════════

export interface FileValidationResult {
  isValid: boolean
  detectedType: string | null
  errors: string[]
  warnings: string[]
}

export interface MaliciousContentResult {
  isMalicious: boolean
  threats: string[]
  riskScore: number // 0-100
}

class FileValidator {
  // Magic byte signatures for common file types
  private static SIGNATURES: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header - further check for WEBP
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  }

  // WEBP files start with RIFF....WEBP
  private static WEBP_MARKER = [0x57, 0x45, 0x42, 0x50] // "WEBP" at offset 8-11

  // Dangerous file signatures that should NEVER be uploaded
  private static DANGEROUS_SIGNATURES: Record<string, number[][]> = {
    'executable/exe': [[0x4D, 0x5A]], // MZ header (Windows PE)
    'executable/elf': [[0x7F, 0x45, 0x4C, 0x46]], // ELF header
    'script/bat': [[0x40, 0x65, 0x63, 0x68, 0x6F]], // @echo
    'script/ps1': [[0x23, 0x50, 0x6F, 0x77, 0x65, 0x72]], // #Power
    'archive/zip': [[0x50, 0x4B, 0x03, 0x04]], // ZIP
    'archive/rar': [[0x52, 0x61, 0x72, 0x21]], // Rar!
    'archive/7z': [[0x37, 0x7A, 0xBC, 0xAF]], // 7z
    'script/js_in_html': [[0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]], // <script
    'html': [[0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45], [0x3C, 0x68, 0x74, 0x6D, 0x6C]], // <!DOCTYPE or <html
  }

  // Patterns that indicate embedded malicious content within files
  private static MALICIOUS_PATTERNS: { pattern: Buffer; name: string }[] = [
    { pattern: Buffer.from('<script', 'ascii'), name: 'EMBEDDED_SCRIPT_TAG' },
    { pattern: Buffer.from('javascript:', 'ascii'), name: 'EMBEDDED_JS_PROTOCOL' },
    { pattern: Buffer.from('onerror=', 'ascii'), name: 'EMBEDDED_ONERROR_HANDLER' },
    { pattern: Buffer.from('onload=', 'ascii'), name: 'EMBEDDED_ONLOAD_HANDLER' },
    { pattern: Buffer.from('<?php', 'ascii'), name: 'EMBEDDED_PHP_CODE' },
    { pattern: Buffer.from('<%=','ascii'), name: 'EMBEDDED_EJS_CODE' },
    { pattern: Buffer.from('${', 'ascii'), name: 'EMBEDDED_TEMPLATE_INJECTION' },
    { pattern: Buffer.from('eval(', 'ascii'), name: 'EMBEDDED_EVAL_CALL' },
  ]

  /**
   * Validate file by checking magic bytes against allowed types
   */
  static validateFile(buffer: Buffer, allowedTypes: string[]): FileValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!buffer || buffer.length === 0) {
      return {
        isValid: false,
        detectedType: null,
        errors: ['Empty file buffer'],
        warnings: [],
      }
    }

    // First check for dangerous file types
    for (const [dangerType, signatures] of Object.entries(FileValidator.DANGEROUS_SIGNATURES)) {
      for (const sig of signatures) {
        if (FileValidator.matchesSignature(buffer, sig)) {
          // Special case: ZIP can be inside DOCX/XLSX, but we don't allow those anyway
          // Special case: RIFF could be WEBP, check further
          if (dangerType === 'archive/zip') {
            warnings.push('File appears to be a ZIP archive')
          } else {
            errors.push(`Dangerous file type detected: ${dangerType}`)
            return {
              isValid: false,
              detectedType: dangerType,
              errors,
              warnings,
            }
          }
        }
      }
    }

    // Check against allowed types
    let detectedType: string | null = null
    let typeMatched = false

    for (const allowedType of allowedTypes) {
      const signatures = FileValidator.SIGNATURES[allowedType]
      if (!signatures) {
        warnings.push(`Unknown allowed type: ${allowedType}`)
        continue
      }

      for (const sig of signatures) {
        if (FileValidator.matchesSignature(buffer, sig)) {
          detectedType = allowedType
          typeMatched = true
          break
        }
      }

      if (typeMatched) break
    }

    // Special WEBP validation: RIFF header + WEBP marker at offset 8
    if (typeMatched && detectedType === 'image/webp') {
      if (buffer.length > 11) {
        const webpMarker = FileValidator.WEBP_MARKER
        let hasWebpMarker = true
        for (let i = 0; i < webpMarker.length; i++) {
          if (buffer[8 + i] !== webpMarker[i]) {
            hasWebpMarker = false
            break
          }
        }
        if (!hasWebpMarker) {
          detectedType = 'image/riff-unknown'
          typeMatched = false
          errors.push('File has RIFF header but is not a valid WEBP image')
        }
      } else {
        typeMatched = false
        errors.push('WEBP file too small to validate')
      }
    }

    if (!typeMatched) {
      // Try to detect what type it actually is
      if (!detectedType) {
        detectedType = FileValidator.detectAnyType(buffer)
      }
      if (detectedType) {
        errors.push(`File type mismatch: detected ${detectedType} but expected one of: ${allowedTypes.join(', ')}`)
      } else {
        errors.push('File type could not be identified. Upload rejected for security.')
      }
    }

    // Check for content-type mismatch with file extension
    // (This would be done at the route level where we have access to the filename)

    return {
      isValid: typeMatched && errors.length === 0,
      detectedType,
      errors,
      warnings,
    }
  }

  /**
   * Check for embedded malicious content within a file
   * This catches polyglot files that pass magic byte checks but contain malicious payloads
   */
  static detectMaliciousContent(buffer: Buffer): MaliciousContentResult {
    const threats: string[] = []
    let riskScore = 0

    if (!buffer || buffer.length === 0) {
      return { isMalicious: false, threats: [], riskScore: 0 }
    }

    // Check for malicious patterns embedded in the file
    for (const { pattern, name } of FileValidator.MALICIOUS_PATTERNS) {
      if (FileValidator.bufferContains(buffer, pattern)) {
        threats.push(name)
        riskScore += 25
      }
    }

    // Check for null bytes (common in binary exploits)
    let nullByteCount = 0
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      if (buffer[i] === 0x00) nullByteCount++
    }
    if (nullByteCount > 50) {
      threats.push('EXCESSIVE_NULL_BYTES')
      riskScore += 15
    }

    // Check for suspiciously high entropy (possible encryption/packing)
    if (buffer.length >= 256) {
      const entropy = FileValidator.calculateEntropy(buffer, Math.min(buffer.length, 4096))
      if (entropy > 7.8) {
        threats.push('HIGH_ENTROPY_CONTENT')
        riskScore += 10
      }
    }

    // Check for double extensions in content (e.g., image.exe.jpg trick)
    // This is done at the filename level, not buffer level

    // Check for SVG with embedded scripts (if it's an image type)
    const svgPattern = Buffer.from('<svg', 'ascii')
    if (FileValidator.bufferContains(buffer, svgPattern)) {
      const scriptPattern = Buffer.from('<script', 'ascii')
      if (FileValidator.bufferContains(buffer, scriptPattern)) {
        threats.push('SVG_WITH_EMBEDDED_SCRIPT')
        riskScore += 40
      }
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore)

    return {
      isMalicious: threats.length > 0 && riskScore >= 25,
      threats,
      riskScore,
    }
  }

  /**
   * Validate file size
   */
  static validateSize(size: number, maxSizeMB: number): boolean {
    const maxBytes = maxSizeMB * 1024 * 1024
    return size > 0 && size <= maxBytes
  }

  /**
   * Sanitize filename to prevent path traversal and injection attacks
   */
  static sanitizeFilename(filename: string): string {
    if (!filename) return ''

    // Remove path separators and traversal attempts
    let sanitized = filename
      .replace(/\.\./g, '')           // Remove ..
      .replace(/[\/\\]/g, '')          // Remove path separators
      .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Remove control characters
      .replace(/[<>:"|?*]/g, '')       // Remove invalid filename characters
      .replace(/\s+/g, '_')            // Replace spaces with underscores
      .replace(/\.+/g, '.')            // Collapse multiple dots
      .replace(/^\.+/, '')             // Remove leading dots (hidden files)

    // Limit filename length
    const maxLen = 255
    if (sanitized.length > maxLen) {
      const ext = sanitized.lastIndexOf('.')
      if (ext > 0) {
        const extPart = sanitized.substring(ext)
        sanitized = sanitized.substring(0, maxLen - extPart.length) + extPart
      } else {
        sanitized = sanitized.substring(0, maxLen)
      }
    }

    // Ensure filename is not empty after sanitization
    if (!sanitized) {
      sanitized = `file_${Date.now()}`
    }

    return sanitized
  }

  // ── Private helper methods ──

  /**
   * Check if buffer starts with a given magic byte signature
   */
  private static matchesSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false
    }
    return true
  }

  /**
   * Check if buffer contains a given byte pattern
   */
  private static bufferContains(buffer: Buffer, pattern: Buffer): boolean {
    if (pattern.length > buffer.length) return false
    const searchLen = buffer.length - pattern.length
    for (let i = 0; i <= searchLen; i++) {
      let found = true
      for (let j = 0; j < pattern.length; j++) {
        // Case-insensitive comparison for ASCII
        const bufByte = buffer[i + j]
        const patByte = pattern[j]
        // Simple case: exact match
        if (bufByte === patByte) continue
        // Case-insensitive for ASCII letters
        if (patByte >= 0x41 && patByte <= 0x5A && bufByte === patByte + 0x20) continue
        if (patByte >= 0x61 && patByte <= 0x7A && bufByte === patByte - 0x20) continue
        found = false
        break
      }
      if (found) return true
    }
    return false
  }

  /**
   * Attempt to detect the file type from magic bytes
   */
  private static detectAnyType(buffer: Buffer): string | null {
    for (const [type, signatures] of Object.entries(FileValidator.SIGNATURES)) {
      for (const sig of signatures) {
        if (FileValidator.matchesSignature(buffer, sig)) {
          return type
        }
      }
    }
    for (const [type, signatures] of Object.entries(FileValidator.DANGEROUS_SIGNATURES)) {
      for (const sig of signatures) {
        if (FileValidator.matchesSignature(buffer, sig)) {
          return type
        }
      }
    }
    return null
  }

  /**
   * Calculate Shannon entropy of a buffer (first N bytes)
   */
  private static calculateEntropy(buffer: Buffer, length: number): number {
    const freq = new Map<number, number>()
    const len = Math.min(buffer.length, length)

    for (let i = 0; i < len; i++) {
      const byte = buffer[i]
      freq.set(byte, (freq.get(byte) || 0) + 1)
    }

    let entropy = 0
    for (const count of freq.values()) {
      const p = count / len
      if (p > 0) {
        entropy -= p * Math.log2(p)
      }
    }

    return entropy
  }
}

export { FileValidator }
