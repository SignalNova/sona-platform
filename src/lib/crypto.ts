import { createHmac, createHash } from 'crypto'

// ===== Configuration =====
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || ''
const BSCSCAN_API_URL = 'https://api.bscscan.com/v2/api'
const BSC_CHAIN_ID = '56'
const USDT_BEP20_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'
// SECURITY: Owner wallet from environment variable only - never hardcoded
const OWNER_WALLET = process.env.OWNER_WALLET_ADDRESS || ''

const TRONSCAN_API_KEY = process.env.TRONSCAN_API_KEY || ''
const TRONSCAN_API_URL = 'https://apilist.tronscanapi.com/api'

// SECURITY: Address salt is MANDATORY in production - no fallback
const ADDRESS_SALT = (() => {
  const salt = process.env.ADDRESS_SALT || ''
  if (!salt && process.env.NODE_ENV === 'production') {
    throw new Error('ADDRESS_SALT environment variable is required in production. Deposit address generation cannot operate securely without it.')
  }
  if (!salt) {
    console.warn('[SECURITY WARNING] ADDRESS_SALT not set! Using insecure mode. NEVER use in production!')
  }
  return salt
})()

// ===== Types =====
export interface BSCScanTokenTx {
  blockNumber: string
  timeStamp: string
  hash: string
  nonce: string
  blockHash: string
  from: string
  to: string
  value: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  transactionIndex: string
  gas: string
  gasPrice: string
  gasUsed: string
  cumulativeGasUsed: string
  input: string
  confirmations: string
  contractAddress: string
}

export interface TronScanTokenTx {
  transaction_id: string
  block_timestamp: number
  from: string
  to: string
  value: number
  token_info: {
    symbol: string
    address: string
    decimals: number
  }
  finalized: boolean
}

export interface VerificationResult {
  verified: boolean
  amount: number
  txHash: string
  from: string
  confirmations: number
  blockNumber: number
  timestamp: number
}

// ===== Deterministic Address Generation =====

/**
 * Generate a deterministic BEP20 deposit address for a user.
 * Uses HMAC-SHA256 with userId + salt to produce a valid-looking 0x address.
 * The same userId will always produce the same address.
 */
export function generateBEP20Address(userId: string): string {
  const hmac = createHmac('sha256', ADDRESS_SALT)
  hmac.update(`bep20:${userId}`)
  const hash = hmac.digest('hex')
  // Take first 40 hex chars to form a valid BEP20 address
  return '0x' + hash.substring(0, 40).toLowerCase()
}

/**
 * Generate a deterministic TRC20 deposit address for a user.
 * TRC20 addresses start with 'T' and are Base58 encoded (34 chars).
 */
export function generateTRC20Address(userId: string): string {
  const hmac = createHmac('sha256', ADDRESS_SALT)
  hmac.update(`trc20:${userId}`)
  const hash = hmac.digest('hex')

  // Convert to Base58Check format starting with 'T'
  const bytes = Buffer.from(hash.substring(0, 40), 'hex')
  // Simple Base58 encoding for Tron-style address
  const base58 = base58Encode(bytes)
  // Ensure it starts with 'T' and is 34 characters
  return 'T' + base58.substring(0, 33)
}

/**
 * Simple Base58 encoding (Tron address style)
 */
function base58Encode(buffer: Buffer): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let num = BigInt('0x' + buffer.toString('hex'))
  let result = ''

  while (num > 0n) {
    const remainder = num % 58n
    num = num / 58n
    result = alphabet[Number(remainder)] + result
  }

  // Add '1' for each leading zero byte
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) {
      result = '1' + result
    } else {
      break
    }
  }

  return result
}

/**
 * Generate a deposit address based on network type
 */
export function generateDepositAddress(userId: string, network: string): string {
  switch (network) {
    case 'bep20':
    case 'usdt_bep20':
      return generateBEP20Address(userId)
    case 'trc20':
    case 'usdt_trc20':
      return generateTRC20Address(userId)
    default:
      throw new Error(`Unsupported network: ${network}`)
  }
}

// ===== BSCScan API Integration =====

/**
 * Fetch USDT BEP20 token transfers for a given address from BSCScan
 */
export async function fetchBSC20Transactions(address: string): Promise<BSCScanTokenTx[]> {
  const url = new URL(BSCSCAN_API_URL)
  url.searchParams.set('chainid', BSC_CHAIN_ID)
  url.searchParams.set('module', 'account')
  url.searchParams.set('action', 'tokentx')
  url.searchParams.set('contractaddress', USDT_BEP20_CONTRACT)
  url.searchParams.set('address', address)
  url.searchParams.set('apikey', BSCSCAN_API_KEY)
  url.searchParams.set('sort', 'desc')
  url.searchParams.set('page', '1')
  url.searchParams.set('offset', '50')

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 0 },
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('BSCScan API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()

    if (data.status === '1' && data.message === 'OK' && Array.isArray(data.result)) {
      return data.result as BSCScanTokenTx[]
    }

    // BSCScan returns "No transactions found" as a string result
    if (data.result === 'No transactions found') {
      return []
    }

    console.error('BSCScan API unexpected response:', data.message)
    return []
  } catch (error) {
    console.error('BSCScan API fetch error:', error)
    return []
  }
}

/**
 * Verify a USDT BEP20 deposit by checking BSCScan for incoming transactions
 * to the user's deposit address that match the expected amount.
 */
export async function verifyBSCDeposit(
  depositAddress: string,
  expectedAmount: number,
  tolerance: number = 0.01
): Promise<VerificationResult | null> {
  const transactions = await fetchBSC20Transactions(depositAddress)

  for (const tx of transactions) {
    // Check if the transaction is incoming (to our deposit address)
    if (tx.to.toLowerCase() !== depositAddress.toLowerCase()) continue

    // Must be USDT BEP20 contract
    if (tx.contractAddress.toLowerCase() !== USDT_BEP20_CONTRACT.toLowerCase()) continue

    // Parse the value (USDT has 18 decimals on BSC)
    const value = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))

    // Check if the amount matches (with tolerance for rounding)
    if (Math.abs(value - expectedAmount) <= tolerance) {
      return {
        verified: true,
        amount: value,
        txHash: tx.hash,
        from: tx.from,
        confirmations: parseInt(tx.confirmations) || 0,
        blockNumber: parseInt(tx.blockNumber),
        timestamp: parseInt(tx.timeStamp),
      }
    }
  }

  return null
}

/**
 * Check all incoming USDT BEP20 transactions for a deposit address
 * Returns all incoming transfers (useful for finding any unverified deposits)
 */
export async function getIncomingBSCTransfers(depositAddress: string): Promise<VerificationResult[]> {
  const transactions = await fetchBSC20Transactions(depositAddress)
  const results: VerificationResult[] = []

  for (const tx of transactions) {
    if (tx.to.toLowerCase() !== depositAddress.toLowerCase()) continue
    if (tx.contractAddress.toLowerCase() !== USDT_BEP20_CONTRACT.toLowerCase()) continue

    const value = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))

    results.push({
      verified: true,
      amount: value,
      txHash: tx.hash,
      from: tx.from,
      confirmations: parseInt(tx.confirmations) || 0,
      blockNumber: parseInt(tx.blockNumber),
      timestamp: parseInt(tx.timeStamp),
    })
  }

  return results
}

// ===== Tronscan API Integration =====

/**
 * Fetch USDT TRC20 token transfers for a given address from Tronscan
 */
export async function fetchTron20Transactions(address: string): Promise<TronScanTokenTx[]> {
  const url = new URL(`${TRONSCAN_API_URL}/token_trc20/transfers`)
  url.searchParams.set('limit', '50')
  url.searchParams.set('start', '0')
  url.searchParams.set('sort', '-timestamp')
  url.searchParams.set('count', 'true')
  url.searchParams.set('relatedAddress', address)

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 0 },
      headers: {
        'Accept': 'application/json',
        'TRON-PRO-API-KEY': TRONSCAN_API_KEY,
      },
    })

    if (!response.ok) {
      console.error('Tronscan API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()

    if (data.token_transfers && Array.isArray(data.token_transfers)) {
      // Filter for USDT TRC20 only
      const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      return data.token_transfers.filter(
        (tx: TronScanTokenTx) =>
          tx.token_info?.symbol === 'USDT' ||
          tx.token_info?.address === USDT_TRC20_CONTRACT
      )
    }

    return []
  } catch (error) {
    console.error('Tronscan API fetch error:', error)
    return []
  }
}

/**
 * Verify a USDT TRC20 deposit by checking Tronscan for incoming transactions
 */
export async function verifyTronDeposit(
  depositAddress: string,
  expectedAmount: number,
  tolerance: number = 0.01
): Promise<VerificationResult | null> {
  const transactions = await fetchTron20Transactions(depositAddress)

  for (const tx of transactions) {
    // Check if the transaction is incoming
    if (tx.to.toLowerCase() !== depositAddress.toLowerCase()) continue

    // Value in USDT (6 decimals for TRC20)
    const value = tx.value / Math.pow(10, tx.token_info?.decimals || 6)

    if (Math.abs(value - expectedAmount) <= tolerance) {
      return {
        verified: true,
        amount: value,
        txHash: tx.transaction_id,
        from: tx.from,
        confirmations: tx.finalized ? 20 : 1,
        blockNumber: 0,
        timestamp: tx.block_timestamp,
      }
    }
  }

  return null
}

/**
 * Get all incoming USDT TRC20 transfers for a deposit address
 */
export async function getIncomingTronTransfers(depositAddress: string): Promise<VerificationResult[]> {
  const transactions = await fetchTron20Transactions(depositAddress)
  const results: VerificationResult[] = []

  for (const tx of transactions) {
    if (tx.to.toLowerCase() !== depositAddress.toLowerCase()) continue

    const value = tx.value / Math.pow(10, tx.token_info?.decimals || 6)

    results.push({
      verified: true,
      amount: value,
      txHash: tx.transaction_id,
      from: tx.from,
      confirmations: tx.finalized ? 20 : 1,
      blockNumber: 0,
      timestamp: tx.block_timestamp,
    })
  }

  return results
}

// ===== Transaction Hash Verification =====

/**
 * Verify a specific BSC transaction by its hash
 */
export async function verifyBSCTxByHash(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  tolerance: number = 0.01
): Promise<VerificationResult | null> {
  const url = new URL(BSCSCAN_API_URL)
  url.searchParams.set('chainid', BSC_CHAIN_ID)
  url.searchParams.set('module', 'proxy')
  url.searchParams.set('action', 'eth_getTransactionByHash')
  url.searchParams.set('txhash', txHash)
  url.searchParams.set('apikey', BSCSCAN_API_KEY)

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 0 },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.result) return null

    // For token transfers, we need to check the internal transaction
    // Use tokentx endpoint with specific hash
    const tokenTxUrl = new URL(BSCSCAN_API_URL)
    tokenTxUrl.searchParams.set('chainid', BSC_CHAIN_ID)
    tokenTxUrl.searchParams.set('module', 'account')
    tokenTxUrl.searchParams.set('action', 'tokentx')
    tokenTxUrl.searchParams.set('txhash', txHash)
    tokenTxUrl.searchParams.set('apikey', BSCSCAN_API_KEY)

    const tokenResponse = await fetch(tokenTxUrl.toString(), {
      next: { revalidate: 0 },
    })

    if (!tokenResponse.ok) return null

    const tokenData = await tokenResponse.json()

    if (tokenData.status === '1' && Array.isArray(tokenData.result)) {
      for (const tx of tokenData.result as BSCScanTokenTx[]) {
        if (tx.to.toLowerCase() !== expectedTo.toLowerCase()) continue
        if (tx.contractAddress.toLowerCase() !== USDT_BEP20_CONTRACT.toLowerCase()) continue

        const value = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))

        if (Math.abs(value - expectedAmount) <= tolerance) {
          return {
            verified: true,
            amount: value,
            txHash: tx.hash,
            from: tx.from,
            confirmations: parseInt(tx.confirmations) || 0,
            blockNumber: parseInt(tx.blockNumber),
            timestamp: parseInt(tx.timeStamp),
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('BSC tx hash verification error:', error)
    return null
  }
}

// ===== Helpers =====

/**
 * Create a deterministic hash for a transaction to prevent double-counting
 */
export function createTxReference(txHash: string, toAddress: string, amount: number): string {
  const hash = createHash('sha256')
  hash.update(`${txHash}:${toAddress}:${amount}`)
  return hash.digest('hex')
}

/**
 * Check if a transaction has already been processed
 */
export async function isTxAlreadyProcessed(txHash: string): Promise<boolean> {
  const { db } = await import('@/lib/db')
  const existing = await db.transaction.findFirst({
    where: {
      reference: txHash,
      status: { in: ['COMPLETED', 'completed', 'APPROVED', 'approved'] },
    },
  })
  return !!existing
}

/**
 * Get the owner's wallet address
 */
export function getOwnerWallet(): string {
  return OWNER_WALLET
}

/**
 * Get the USDT BEP20 contract address
 */
export function getUSDTBEP20Contract(): string {
  return USDT_BEP20_CONTRACT
}
