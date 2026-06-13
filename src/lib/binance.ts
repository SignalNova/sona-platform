import crypto from 'crypto'

const BINANCE_API = 'https://api.binance.com'

// ===== CONFIGURATION =====

function getApiKey(): string {
  return (process.env.BINANCE_API_KEY || '').trim()
}

function getSecretKey(): string {
  return (process.env.BINANCE_SECRET_KEY || process.env.BINANCE_API_SECRET || '').trim()
}

function getKeyType(): 'HMAC' | 'RSA' | 'ED25519' | 'AUTO' {
  return (process.env.BINANCE_KEY_TYPE || 'AUTO').toUpperCase() as 'HMAC' | 'RSA' | 'ED25519' | 'AUTO'
}

function getRSAPrivateKey(): string {
  return (process.env.BINANCE_RSA_PRIVATE_KEY || '').trim()
}

function getEd25519PrivateKey(): string {
  return (process.env.BINANCE_ED25519_PRIVATE_KEY || '').trim()
}

// ===== TIME SYNC =====

let timeOffset = 0 // Difference: binanceTime - localTime

async function syncTime(): Promise<void> {
  try {
    const localBefore = Date.now()
    const res = await fetch(`${BINANCE_API}/api/v3/time`)
    const localAfter = Date.now()
    const data = await res.json()
    // Estimate network latency as half the round-trip time
    const latency = Math.floor((localAfter - localBefore) / 2)
    const localMid = localBefore + latency
    timeOffset = data.serverTime - localMid
    console.log(`[BINANCE] Time sync: offset=${timeOffset}ms, latency=${latency}ms`)
  } catch (e) {
    console.warn('[BINANCE] Time sync failed, using local time')
    timeOffset = 0
  }
}

function getTimestamp(): number {
  return Date.now() + timeOffset
}

// ===== SIGNING METHODS =====

/**
 * Sign using HMAC-SHA256
 * Query string is NOT sorted - Binance requires the exact query string as sent
 */
function signHMAC(queryString: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex')
}

/**
 * Sign using RSA-SHA256 (PKCS1v15)
 * Returns URL-safe base64 encoded signature
 */
function signRSA(queryString: string, privateKeyPem: string): string {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(queryString)
  signer.end()
  const signature = signer.sign(privateKeyPem)
  return signature.toString('base64')
}

/**
 * Sign using Ed25519
 * Returns URL-safe base64 encoded signature
 */
function signEd25519(queryString: string, privateKeyB64OrPem: string): string {
  let keyObj: crypto.KeyObject
  
  // Try as PEM first, then as raw base64
  try {
    keyObj = crypto.createPrivateKey({
      key: privateKeyB64OrPem,
      format: 'pem',
    })
  } catch {
    // Try as raw Ed25519 seed (base64 encoded)
    const rawKey = Buffer.from(privateKeyB64OrPem, 'base64')
    keyObj = crypto.createPrivateKey({
      key: rawKey,
      format: 'der',
      type: 'pkcs8',
    })
  }
  
  const signature = crypto.sign(null, Buffer.from(queryString), keyObj)
  return signature.toString('base64')
}

// ===== QUERY STRING BUILDING =====

/**
 * Build query string WITHOUT sorting - parameters in the order they were added
 * This is the correct Binance way: you sign what you send
 */
function buildQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

/**
 * URL-encode a signature for use in query string
 */
function urlEncodeSignature(sig: string): string {
  return encodeURIComponent(sig)
}

// ===== SIGNED REQUEST BUILDER =====

async function buildSignedRequest(
  endpoint: string,
  params: Record<string, string>,
  method: 'GET' | 'POST' = 'GET',
  keyTypeOverride?: 'HMAC' | 'RSA' | 'ED25519'
): Promise<{ url: string; headers: Record<string, string>; body?: string; signatureMethod: string }> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    throw new Error('BINANCE_API_KEY not configured')
  }

  // Get synced timestamp
  const timestamp = getTimestamp()

  // Build params with timestamp and recvWindow
  const allParams: Record<string, string> = {
    ...params,
    timestamp: timestamp.toString(),
    recvWindow: '60000',
  }

  // Build query string - NO sorting, NO URL encoding for simple values
  // Binance requires: sign EXACTLY what you send
  const queryString = buildQueryString(allParams)

  // Determine signing method
  const keyType = keyTypeOverride || getKeyType()
  let signature = ''
  let signatureMethod = ''

  if (keyType === 'HMAC' || keyType === 'AUTO') {
    const secretKey = getSecretKey()
    if (secretKey) {
      signature = signHMAC(queryString, secretKey)
      signatureMethod = 'HMAC-SHA256'
    }
  } else if (keyType === 'RSA') {
    const rsaKey = getRSAPrivateKey()
    if (rsaKey) {
      signature = signRSA(queryString, rsaKey)
      signatureMethod = 'RSA-SHA256'
    }
  } else if (keyType === 'ED25519') {
    const edKey = getEd25519PrivateKey()
    if (edKey) {
      signature = signEd25519(queryString, edKey)
      signatureMethod = 'Ed25519'
    }
  }

  if (!signature) {
    throw new Error(`No signing key available for type: ${keyType}`)
  }

  // For HMAC: signature is hex string (no encoding needed)
  // For RSA/Ed25519: signature is base64 (needs URL encoding)
  const encodedSig = signatureMethod === 'HMAC-SHA256' ? signature : urlEncodeSignature(signature)

  const headers: Record<string, string> = {
    'X-MBX-APIKEY': apiKey,
  }

  if (method === 'GET') {
    return {
      url: `${BINANCE_API}${endpoint}?${queryString}&signature=${encodedSig}`,
      headers,
      signatureMethod,
    }
  } else {
    // POST: signature in body
    return {
      url: `${BINANCE_API}${endpoint}`,
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `${queryString}&signature=${encodedSig}`,
      signatureMethod,
    }
  }
}

// ===== AUTO-DETECTION =====

/**
 * Try all signing methods to auto-detect which one works
 */
async function detectSigningMethod(): Promise<{
  workingMethod: 'HMAC' | 'RSA' | 'ED25519' | null
  results: Array<{ method: string; errorCode: string; errorMsg: string }>
}> {
  const results: Array<{ method: string; errorCode: string; errorMsg: string }> = []
  let workingMethod: 'HMAC' | 'RSA' | 'ED25519' | null = null

  // Ensure time is synced
  await syncTime()

  // Try HMAC
  const secretKey = getSecretKey()
  if (secretKey) {
    try {
      const req = await buildSignedRequest('/api/v3/account', {}, 'GET', 'HMAC')
      const res = await fetch(req.url, { headers: req.headers })
      const data = await res.json()
      
      if (res.ok && data.accountType) {
        workingMethod = 'HMAC'
        results.push({ method: 'HMAC-SHA256', errorCode: '0', errorMsg: 'SUCCESS' })
      } else {
        results.push({ method: 'HMAC-SHA256', errorCode: data.code?.toString() || '?', errorMsg: data.msg || 'Unknown error' })
      }
    } catch (e: any) {
      results.push({ method: 'HMAC-SHA256', errorCode: 'EXCEPTION', errorMsg: e.message })
    }
  } else {
    results.push({ method: 'HMAC-SHA256', errorCode: 'N/A', errorMsg: 'No secret key configured' })
  }

  // Try RSA
  const rsaKey = getRSAPrivateKey()
  if (rsaKey) {
    try {
      const req = await buildSignedRequest('/api/v3/account', {}, 'GET', 'RSA')
      const res = await fetch(req.url, { headers: req.headers })
      const data = await res.json()
      
      if (res.ok && data.accountType) {
        workingMethod = 'RSA'
        results.push({ method: 'RSA-SHA256', errorCode: '0', errorMsg: 'SUCCESS' })
      } else {
        results.push({ method: 'RSA-SHA256', errorCode: data.code?.toString() || '?', errorMsg: data.msg || 'Unknown error' })
      }
    } catch (e: any) {
      results.push({ method: 'RSA-SHA256', errorCode: 'EXCEPTION', errorMsg: e.message })
    }
  } else {
    results.push({ method: 'RSA-SHA256', errorCode: 'N/A', errorMsg: 'No RSA private key configured' })
  }

  // Try Ed25519
  const edKey = getEd25519PrivateKey()
  if (edKey) {
    try {
      const req = await buildSignedRequest('/api/v3/account', {}, 'GET', 'ED25519')
      const res = await fetch(req.url, { headers: req.headers })
      const data = await res.json()
      
      if (res.ok && data.accountType) {
        workingMethod = 'ED25519'
        results.push({ method: 'Ed25519', errorCode: '0', errorMsg: 'SUCCESS' })
      } else {
        results.push({ method: 'Ed25519', errorCode: data.code?.toString() || '?', errorMsg: data.msg || 'Unknown error' })
      }
    } catch (e: any) {
      results.push({ method: 'Ed25519', errorCode: 'EXCEPTION', errorMsg: e.message })
    }
  } else {
    results.push({ method: 'Ed25519', errorCode: 'N/A', errorMsg: 'No Ed25519 private key configured' })
  }

  return { workingMethod, results }
}

// ===== PUBLIC API =====

// Verify Binance API connectivity with comprehensive diagnostics
export async function verifyBinanceConnection(): Promise<{
  success: boolean
  message: string
  details?: string
  keyType?: string
  diagnosis?: any
}> {
  try {
    const apiKey = getApiKey()
    const secretKey = getSecretKey()
    const keyType = getKeyType()

    if (!apiKey) {
      return { success: false, message: 'API key not configured', details: 'BINANCE_API_KEY is not set' }
    }

    // Check server IP
    let serverIp = 'unknown'
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipRes.json()
      serverIp = ipData.ip
    } catch {}

    // Sync time
    await syncTime()
    const localTime = Date.now()
    const binanceTime = getTimestamp()
    const timeDiff = Math.abs(timeOffset)

    // Auto-detect or use specified key type
    if (keyType === 'AUTO') {
      const detection = await detectSigningMethod()
      const working = detection.results.find(r => r.errorCode === '0')
      
      if (working) {
        return {
          success: true,
          message: `Connected using ${working.method}`,
          details: `IP: ${serverIp} | Time diff: ${timeDiff}ms | Method: ${working.method}`,
          keyType: working.method,
          diagnosis: detection.results,
        }
      }

      // Nothing worked - provide detailed diagnosis
      const hmacResult = detection.results.find(r => r.method === 'HMAC-SHA256')
      const isHmac1022 = hmacResult?.errorCode === '-1022'
      
      let detailedMessage = ''
      if (isHmac1022) {
        detailedMessage = `فشل التوقيع HMAC-SHA256 (-1022). المفتاح معروف عند بينانس لكن التوقيع خاطئ. `
          + `الأسباب المحتملة:\n`
          + `1. المفتاح من نوع RSA أو Ed25519 (وليس HMAC) - تحقق من نوع المفتاح في لوحة تحكم بينانس\n`
          + `2. المفتاح السري لا يطابق مفتاح API - تأكد من النسخة الصحيحة\n`
          + `3. تم تغيير المفتاح السري على بينانس وأنت تستخدم النسخة القديمة\n\n`
          + `الحل: اذهب إلى بينانس > API Management وتحقق من عمود "Key Type".\n`
          + `إذا كان RSA: أضف BINANCE_RSA_PRIVATE_KEY في .env\n`
          + `إذا كان Ed25519: أضف BINANCE_ED25519_PRIVATE_KEY في .env\n`
          + `أو أنشئ مفتاح HMAC جديد (الأسهل).`
      } else {
        detailedMessage = `فشل الاتصال. النتائج: ${detection.results.map(r => `${r.method}: ${r.errorCode}`).join(', ')}`
      }

      return {
        success: false,
        message: 'فشل التحقق من اتصال Binance',
        details: `IP: ${serverIp} | Time diff: ${timeDiff}ms`,
        diagnosis: {
          results: detection.results,
          serverIp,
          timeDiff,
          timeOffset,
          apiKeyPrefix: apiKey.substring(0, 8) + '...',
          secretKeyConfigured: !!secretKey,
          rsaKeyConfigured: !!getRSAPrivateKey(),
          ed25519KeyConfigured: !!getEd25519PrivateKey(),
        },
      }
    }

    // Use specified key type
    try {
      const req = await buildSignedRequest('/api/v3/account', {}, 'GET', keyType as 'HMAC' | 'RSA' | 'ED25519')
      const res = await fetch(req.url, { headers: req.headers })
      const responseText = await res.text()

      if (res.ok) {
        const data = JSON.parse(responseText)
        const usdtBalance = data.balances?.find((b: any) => b.asset === 'USDT')
        return {
          success: true,
          message: `Connected - Account: ${data.accountType || 'Spot'}`,
          details: `IP: ${serverIp} | Time diff: ${timeDiff}ms | Method: ${req.signatureMethod} | USDT: ${usdtBalance ? usdtBalance.free : '0'} (free) | Can withdraw: ${data.canWithdraw}`,
          keyType: req.signatureMethod,
        }
      } else {
        let errCode = ''
        let errMsg = responseText
        try {
          const errJson = JSON.parse(responseText)
          errCode = errJson.code?.toString() || ''
          errMsg = errJson.msg || ''
        } catch {}

        if (errCode === '-1022') {
          return {
            success: false,
            message: 'فشل التوقيع (-1022) - المفتاح معروف لكن التوقيع خاطئ',
            details: `IP: ${serverIp} | Time diff: ${timeDiff}ms | Method: ${req.signatureMethod} | قد يكون المفتاح من نوع RSA/Ed25519 وليس HMAC. تحقق من نوع المفتاح في بينانس.`,
            keyType: req.signatureMethod,
          }
        }

        if (errCode === '-2015') {
          return {
            success: false,
            message: 'صلاحيات API أو IP غير مسموح (-2015)',
            details: `IP: ${serverIp} | تأكد أن هذا IP مسموح وأن المفتاح لديه صلاحيات Spot Trading و Withdrawals`,
          }
        }

        return { success: false, message: `خطأ: ${errCode} - ${errMsg}`, details: `IP: ${serverIp}` }
      }
    } catch (e: any) {
      return { success: false, message: `خطأ: ${e.message}` }
    }
  } catch (error: any) {
    console.error('Binance verification error:', error)
    return { success: false, message: `خطأ: ${error.message}` }
  }
}

// Submit a withdrawal request to Binance
export async function submitBinanceWithdrawal(params: {
  coin: string
  network: string
  address: string
  amount: number
  orderId: string
}): Promise<{ success: boolean; id?: string; message: string; txId?: string; errorCode?: string }> {
  try {
    const { coin, network, address, amount, orderId } = params

    // Ensure time is synced before withdrawal
    await syncTime()

    const apiParams: Record<string, string> = {
      coin,
      network,
      address,
      amount: amount.toString(),
      withdrawOrderId: orderId,
    }

    const keyType = getKeyType()
    const effectiveKeyType = keyType === 'AUTO' ? 'HMAC' : keyType

    const req = await buildSignedRequest(
      '/sapi/v1/capital/withdraw/apply',
      apiParams,
      'POST',
      effectiveKeyType as 'HMAC' | 'RSA' | 'ED25519'
    )

    console.log(`[BINANCE WITHDRAW] Submitting: coin=${coin} network=${network} amount=${amount} method=${req.signatureMethod}`)

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: req.headers,
    }
    if (req.body) {
      fetchOptions.body = req.body
    }

    const res = await fetch(req.url, fetchOptions)
    const data = await res.json()

    if (res.ok && data.id) {
      console.log(`[BINANCE WITHDRAW] Success: id=${data.id} txId=${data.txId || 'pending'}`)
      return {
        success: true,
        id: data.id,
        message: 'Withdrawal submitted successfully',
        txId: data.txId || undefined,
      }
    } else {
      const errorCode = data.code?.toString()
      const errorMsg = data.msg || `Binance error: ${res.status}`
      console.error(`[BINANCE WITHDRAW] Failed: code=${errorCode} msg=${errorMsg}`)

      if (errorCode === '-1022') {
        return {
          success: false,
          message: 'خطأ في توقيع Binance - تأكد من صحة المفتاح ونوعه (HMAC/RSA/Ed25519)',
          errorCode,
        }
      }
      if (errorCode === '-2015') {
        return {
          success: false,
          message: 'صلاحيات API غير كافية أو IP غير مسموح',
          errorCode,
        }
      }

      return {
        success: false,
        message: errorMsg,
        errorCode,
      }
    }
  } catch (error: any) {
    console.error('Binance withdrawal exception:', error)
    return { success: false, message: `Error: ${error.message}` }
  }
}

// Check withdrawal status on Binance
export async function getWithdrawalStatus(withdrawId: string): Promise<{
  success: boolean
  status?: string
  txId?: string
  message: string
}> {
  try {
    await syncTime()
    const keyType = getKeyType()
    const effectiveKeyType = keyType === 'AUTO' ? 'HMAC' : keyType

    const req = await buildSignedRequest(
      '/sapi/v1/capital/withdraw/history',
      {},
      'GET',
      effectiveKeyType as 'HMAC' | 'RSA' | 'ED25519'
    )

    const res = await fetch(req.url, { headers: req.headers })

    if (res.ok) {
      const data = await res.json()
      const withdrawal = data.find((w: any) => w.id === withdrawId)
      if (withdrawal) {
        return {
          success: true,
          status: withdrawal.status,
          txId: withdrawal.txId,
          message: `Status: ${withdrawal.status}`,
        }
      }
      return { success: false, message: 'Withdrawal not found in history' }
    }

    return { success: false, message: 'Failed to fetch withdrawal history' }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

// ===== FRAUD DETECTION SYSTEM =====

interface FraudCheckResult {
  isSafe: boolean
  riskScore: number
  flags: string[]
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK'
}

export async function performFraudCheck(params: {
  userId: string
  amount: number
  walletAddress: string
  userBalance: number
  totalDeposited: number
  kycStatus: string
  accountAge: number
  recentWithdrawals: number
  totalWithdrawn24h: number
  ip?: string
}): Promise<FraudCheckResult> {
  const flags: string[] = []
  let riskScore = 0

  if (params.kycStatus !== 'VERIFIED') {
    flags.push('KYC_NOT_VERIFIED')
    riskScore += 50
  }

  if (params.amount > params.userBalance) {
    flags.push('INSUFFICIENT_BALANCE')
    riskScore += 100
  }

  if (params.amount < 20) {
    flags.push('BELOW_MINIMUM')
    riskScore += 20
  }

  if (params.totalDeposited > 0 && (params.amount / params.totalDeposited) > 0.8) {
    flags.push('HIGH_WITHDRAWAL_RATIO')
    riskScore += 30
  }

  if (params.accountAge < 3) {
    flags.push('NEW_ACCOUNT')
    riskScore += 25
  }

  if (params.recentWithdrawals >= 3) {
    flags.push('FREQUENT_WITHDRAWALS')
    riskScore += 20
  }

  if (params.totalWithdrawn24h + params.amount > 10000) {
    flags.push('HIGH_DAILY_VOLUME')
    riskScore += 35
  }

  if (params.amount > 5000) {
    flags.push('LARGE_WITHDRAWAL')
    riskScore += 15
  }

  if (params.amount > 50000) {
    flags.push('EXCEEDS_MAX_LIMIT')
    riskScore += 50
  }

  if (params.walletAddress.length < 20) {
    flags.push('INVALID_ADDRESS_FORMAT')
    riskScore += 40
  }

  let recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK' = 'ALLOW'
  if (riskScore >= 60) recommendation = 'BLOCK'
  else if (riskScore >= 30) recommendation = 'REVIEW'

  return {
    isSafe: riskScore < 30,
    riskScore,
    flags,
    recommendation,
  }
}

// Map Binance network names
export function mapNetworkToBinance(network: string): string {
  const networkMap: Record<string, string> = {
    'BEP20': 'BSC',
    'ERC20': 'ETH',
    'TRC20': 'TRX',
    'BTC': 'BTC',
  }
  return networkMap[network] || network
}
