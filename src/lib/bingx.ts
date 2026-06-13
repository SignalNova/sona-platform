import crypto from 'crypto'

const BINGX_API = 'https://open-api.bingx.com'

// ===== CONFIGURATION =====

function getApiKey(): string {
  return (process.env.BINGX_API_KEY || process.env.BINANCE_API_KEY || '').trim()
}

function getSecretKey(): string {
  return (process.env.BINGX_SECRET_KEY || process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY || '').trim()
}

// ===== SIGNING =====

/**
 * Sign a query string using HMAC-SHA256
 * BingX requires sorted parameters and HMAC-SHA256 signature
 */
function signQuery(queryString: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex')
}

/**
 * Build a signed request for BingX API
 * 
 * Signing process (per BingX docs):
 * 1. Add timestamp to all parameters
 * 2. Sort all parameters alphabetically by key
 * 3. Build query string: key1=value1&key2=value2
 * 4. Sign with HMAC-SHA256 using secret key
 * 5. Append &signature=xxx to URL
 * 6. Add X-BX-APIKEY header with API key
 */
async function buildSignedRequest(
  endpoint: string,
  params: Record<string, string> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<{ url: string; headers: Record<string, string>; body?: string }> {
  const apiKey = getApiKey()
  const secretKey = getSecretKey()

  if (!apiKey || !secretKey) {
    throw new Error('BingX API key or secret not configured. Set BINGX_API_KEY and BINGX_SECRET_KEY in .env')
  }

  // Add timestamp
  const allParams: Record<string, string> = {
    ...params,
    timestamp: Date.now().toString(),
  }

  // Sort parameters alphabetically (BingX requirement)
  const sortedKeys = Object.keys(allParams).sort()
  const queryString = sortedKeys.map(key => `${key}=${allParams[key]}`).join('&')

  // Sign
  const signature = signQuery(queryString, secretKey)

  // Build URL
  const url = `${BINGX_API}${endpoint}?${queryString}&signature=${signature}`

  const headers: Record<string, string> = {
    'X-BX-APIKEY': apiKey,
  }

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  return { url, headers }
}

// ===== ACCOUNT & BALANCE =====

/**
 * Get spot account balance from BingX
 */
export async function getSpotBalance(): Promise<{
  success: boolean
  balances?: Array<{ asset: string; free: string; locked: string }>
  message: string
}> {
  try {
    const { url, headers } = await buildSignedRequest('/openApi/spot/v1/account/balance')
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (data.code === 0 && data.data?.balances) {
      return {
        success: true,
        balances: data.data.balances.map((b: any) => ({
          asset: b.asset,
          free: b.free,
          locked: b.locked,
        })),
        message: 'Balance retrieved successfully',
      }
    }

    return { success: false, message: data.msg || `Error code: ${data.code}` }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

/**
 * Get swap (perpetual) account balance
 */
export async function getSwapBalance(): Promise<{
  success: boolean
  balance?: any
  message: string
}> {
  try {
    const { url, headers } = await buildSignedRequest('/openApi/swap/v2/user/balance')
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (data.code === 0) {
      return {
        success: true,
        balance: data.data?.balance,
        message: 'Swap balance retrieved successfully',
      }
    }

    return { success: false, message: data.msg || `Error code: ${data.code}` }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

// ===== WALLET & COIN INFO =====

/**
 * Get all coin information including networks, fees, limits
 */
export async function getAllCoinInfo(): Promise<{
  success: boolean
  coins?: any[]
  message: string
}> {
  try {
    const { url, headers } = await buildSignedRequest('/openApi/wallets/v1/capital/config/getall')
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (data.code === 0 && data.data) {
      return {
        success: true,
        coins: data.data,
        message: 'Coin info retrieved successfully',
      }
    }

    return { success: false, message: data.msg || `Error code: ${data.code}` }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

/**
 * Get deposit address for a coin
 */
export async function getDepositAddress(coin: string, network?: string): Promise<{
  success: boolean
  addresses?: any[]
  message: string
}> {
  try {
    const params: Record<string, string> = { coin }
    if (network) params.network = network

    const { url, headers } = await buildSignedRequest('/openApi/wallets/v1/capital/deposit/address', params)
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (data.code === 0 && data.data?.data) {
      return {
        success: true,
        addresses: data.data.data,
        message: 'Deposit address retrieved successfully',
      }
    }

    return { success: false, message: data.msg || `Error code: ${data.code}` }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

// ===== WITHDRAWAL =====

/**
 * Submit a withdrawal request to BingX
 * 
 * Endpoint: POST /openApi/wallets/v1/capital/withdraw/apply
 * 
 * Required params:
 * - coin: e.g., "USDT", "BTC"
 * - network: e.g., "BSC", "TRC20", "ERC20"
 * - address: destination wallet address
 * - amount: withdrawal amount (string)
 * 
 * Optional params:
 * - addressTag: memo/tag for certain networks
 * - withdrawOrderId: custom order ID
 */
export async function submitBingXWithdrawal(params: {
  coin: string
  network: string
  address: string
  amount: number
  orderId?: string
  addressTag?: string
}): Promise<{ success: boolean; id?: string; message: string; txId?: string; errorCode?: string }> {
  try {
    const { coin, network, address, amount, orderId, addressTag } = params

    const apiParams: Record<string, string> = {
      coin,
      network,
      address,
      amount: amount.toString(),
    }

    if (orderId) apiParams.withdrawOrderId = orderId
    if (addressTag) apiParams.addressTag = addressTag

    const { url, headers } = await buildSignedRequest(
      '/openApi/wallets/v1/capital/withdraw/apply',
      apiParams,
      'POST'
    )

    console.log(`[BINGX WITHDRAW] Submitting: coin=${coin} network=${network} amount=${amount} address=${address.substring(0, 10)}...`)

    const res = await fetch(url, { method: 'POST', headers })
    const data = await res.json()

    if (data.code === 0 && data.data?.id) {
      console.log(`[BINGX WITHDRAW] Success: id=${data.data.id}`)
      return {
        success: true,
        id: data.data.id,
        message: 'Withdrawal submitted successfully',
        txId: data.data.txId || undefined,
      }
    } else {
      const errorCode = data.code?.toString()
      const errorMsg = data.msg || `BingX error: ${res.status}`
      console.error(`[BINGX WITHDRAW] Failed: code=${errorCode} msg=${errorMsg}`)

      // Provide user-friendly error messages
      if (errorCode === '100400') {
        return {
          success: false,
          message: `خطأ في معاملات BingX: ${errorMsg}`,
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
    console.error('BingX withdrawal exception:', error)
    return { success: false, message: `Error: ${error.message}` }
  }
}

/**
 * Get withdrawal history
 */
export async function getWithdrawalHistory(coin?: string): Promise<{
  success: boolean
  withdrawals?: any[]
  message: string
}> {
  try {
    const params: Record<string, string> = {}
    if (coin) params.coin = coin

    const { url, headers } = await buildSignedRequest('/openApi/api/v3/capital/withdraw/history', params)
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (Array.isArray(data)) {
      return {
        success: true,
        withdrawals: data,
        message: 'Withdrawal history retrieved successfully',
      }
    }

    return { success: false, message: 'Unexpected response format' }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

/**
 * Get deposit history
 */
export async function getDepositHistory(coin?: string): Promise<{
  success: boolean
  deposits?: any[]
  message: string
}> {
  try {
    const params: Record<string, string> = {}
    if (coin) params.coin = coin

    const { url, headers } = await buildSignedRequest('/openApi/api/v3/capital/deposit/hisrec', params)
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (Array.isArray(data)) {
      return {
        success: true,
        deposits: data,
        message: 'Deposit history retrieved successfully',
      }
    }

    return { success: false, message: 'Unexpected response format' }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

// ===== TRANSFER =====

/**
 * Transfer assets between accounts (e.g., fund to spot)
 */
export async function transferAsset(params: {
  fromAccountType: string
  toAccountType: string
  asset: string
  amount: string
}): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { url, headers } = await buildSignedRequest(
      '/openApi/api/v3/post/asset/transfer',
      {
        fromAccountType: params.fromAccountType,
        toAccountType: params.toAccountType,
        asset: params.asset,
        amount: params.amount,
      },
      'POST'
    )

    const res = await fetch(url, { method: 'POST', headers })
    const data = await res.json()

    if (data.code === 0) {
      return { success: true, message: 'Transfer successful', data: data.data }
    }

    return { success: false, message: data.msg || `Error code: ${data.code}` }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}

// ===== VERIFICATION =====

/**
 * Verify BingX API connectivity with comprehensive diagnostics
 */
export async function verifyBingXConnection(): Promise<{
  success: boolean
  message: string
  details?: string
  diagnosis?: any
}> {
  try {
    const apiKey = getApiKey()
    const secretKey = getSecretKey()

    if (!apiKey) {
      return { success: false, message: 'API key not configured', details: 'BINGX_API_KEY is not set' }
    }
    if (!secretKey) {
      return { success: false, message: 'Secret key not configured', details: 'BINGX_SECRET_KEY is not set' }
    }

    // Check server IP
    let serverIp = 'unknown'
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipRes.json()
      serverIp = ipData.ip
    } catch {}

    // Test 1: Spot balance
    const balResult = await getSpotBalance()
    
    // Test 2: Coin info
    const coinResult = await getAllCoinInfo()

    if (balResult.success) {
      const usdtBalance = balResult.balances?.find(b => b.asset === 'USDT')
      return {
        success: true,
        message: `متصل بـ BingX بنجاح! رصيد USDT: ${usdtBalance ? usdtBalance.free : '0'}`,
        details: `IP: ${serverIp} | USDT: ${usdtBalance ? usdtBalance.free : '0'} (free) | Coins available: ${coinResult.success ? (coinResult.coins?.length || 0) : 'N/A'}`,
        diagnosis: {
          serverIp,
          spotBalance: balResult.success,
          coinInfo: coinResult.success,
          usdtFree: usdtBalance?.free || '0',
          usdtLocked: usdtBalance?.locked || '0',
          coinCount: coinResult.coins?.length || 0,
        },
      }
    }

    return {
      success: false,
      message: 'فشل الاتصال بـ BingX',
      details: `IP: ${serverIp} | Spot balance error: ${balResult.message} | Coin info: ${coinResult.success ? 'OK' : coinResult.message}`,
    }
  } catch (error: any) {
    console.error('BingX verification error:', error)
    return { success: false, message: `خطأ: ${error.message}` }
  }
}

// ===== NETWORK MAPPING =====

/**
 * Map common network names to BingX network codes
 */
export function mapNetworkToBingX(network: string): string {
  const networkMap: Record<string, string> = {
    'BEP20': 'BEP20',
    'ERC20': 'ERC20',
    'TRC20': 'TRC20',
    'BTC': 'BTC',
    'ETH': 'ETH',
    'BSC': 'BEP20',      // Our app uses BSC but BingX uses BEP20
    'TON': 'TON',
    'SOL': 'SOL',
    'MATIC': 'POLYGON',
    'POLYGON': 'POLYGON',
    'AVAXC': 'AVAXC',
    'ARBITRUM': 'ARBITRUM',
    'OPTIMISM': 'OPTIMISM',
    'BASE': 'BASE',
    'APT': 'APT',
    'OPBNB': 'OPBNB',
  }
  return networkMap[network.toUpperCase()] || network
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

  if (!['VERIFIED', 'APPROVED'].includes(params.kycStatus)) {
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

// ===== EXTERNAL WITHDRAWAL VERIFICATION =====

/**
 * Verify a specific withdrawal on BingX by checking its status
 * 
 * This function queries the BingX withdrawal history to find a specific
 * withdrawal and check if it was completed on-chain. Used for external
 * verification of withdrawal status.
 * 
 * @param withdrawOrderId - The custom order ID we submitted to BingX
 * @param bingxWithdrawId - The BingX withdrawal ID
 * @returns Verification result with on-chain status
 */
export async function verifyBingXWithdrawal(params: {
  withdrawOrderId?: string
  bingxWithdrawId?: string
  coin?: string
}): Promise<{
  verified: boolean
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN'
  txId?: string
  amount?: number
  fee?: number
  reason: string
  raw?: any
}> {
  try {
    const { coin } = params
    const historyResult = await getWithdrawalHistory(coin || 'USDT')

    if (!historyResult.success || !historyResult.withdrawals) {
      return {
        verified: false,
        status: 'UNKNOWN',
        reason: 'فشل في الحصول على سجل السحوبات من BingX',
      }
    }

    // Find the matching withdrawal
    for (const w of historyResult.withdrawals) {
      const matchesOrderId = params.withdrawOrderId && w.withdrawOrderId === params.withdrawOrderId
      const matchesBingxId = params.bingxWithdrawId && w.id === params.bingxWithdrawId

      if (matchesOrderId || matchesBingxId) {
        // BingX withdrawal status mapping
        // 0: Email sent / Pending, 1: Cancelled, 2: Awaiting approval
        // 3: Rejected, 4: Processing, 5: Payout, 6: Completed
        const statusMap: Record<number, 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'> = {
          0: 'PENDING',
          1: 'FAILED',
          2: 'PENDING',
          3: 'FAILED',
          4: 'PROCESSING',
          5: 'PROCESSING',
          6: 'COMPLETED',
        }

        const withdrawalStatus = statusMap[w.status] || 'UNKNOWN'
        const isCompleted = withdrawalStatus === 'COMPLETED'

        return {
          verified: isCompleted,
          status: withdrawalStatus,
          txId: w.txId || w.transactionId || undefined,
          amount: parseFloat(w.amount || '0'),
          fee: parseFloat(w.transactionFee || '0'),
          reason: isCompleted
            ? `سحب مكتمل على BingX - txId: ${w.txId || 'N/A'}`
            : `حالة السحب: ${withdrawalStatus} (كود BingX: ${w.status})`,
          raw: w,
        }
      }
    }

    return {
      verified: false,
      status: 'UNKNOWN',
      reason: 'لم يتم العثور على السحب في سجل BingX',
    }
  } catch (error: any) {
    console.error('[BingX Verify] Withdrawal verification error:', error)
    return {
      verified: false,
      status: 'UNKNOWN',
      reason: `خطأ في التحقق: ${error.message}`,
    }
  }
}

/**
 * Batch verify all pending withdrawals against BingX
 * 
 * Used by the cron job to automatically update withdrawal statuses
 * based on external verification from BingX.
 */
export async function batchVerifyWithdrawals(pendingWithdrawals: Array<{
  id: string
  txHash?: string | null
  details?: any
}>): Promise<{
  verified: number
  updated: number
  results: Array<{ id: string; status: string; txId?: string }>
}> {
  let verified = 0
  let updated = 0
  const results: Array<{ id: string; status: string; txId?: string }> = []

  for (const withdrawal of pendingWithdrawals) {
    try {
      const details = withdrawal.details
        ? (typeof withdrawal.details === 'string' ? JSON.parse(withdrawal.details) : withdrawal.details)
        : {}

      const verifyResult = await verifyBingXWithdrawal({
        bingxWithdrawId: details.bingxWithdrawId || withdrawal.txHash || undefined,
        withdrawOrderId: withdrawal.id.slice(-10),
        coin: 'USDT',
      })

      results.push({
        id: withdrawal.id,
        status: verifyResult.status,
        txId: verifyResult.txId,
      })

      if (verifyResult.verified) {
        verified++
      }

      if (verifyResult.status !== 'UNKNOWN') {
        updated++
      }
    } catch {
      // Skip failed verifications
    }
  }

  return { verified, updated, results }
}

// Backward compatibility - these functions match the old binance.ts API
export const submitBinanceWithdrawal = submitBingXWithdrawal
export const verifyBinanceConnection = verifyBingXConnection
export const getWithdrawalStatus = getWithdrawalHistory
export const mapNetworkToBinance = mapNetworkToBingX
