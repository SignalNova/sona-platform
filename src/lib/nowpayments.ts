import crypto from 'crypto'

const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1'
const API_KEY = process.env.NOWPAYMENTS_API_KEY || ''
const PROJECT_ID = process.env.NOWPAYMENTS_PROJECT_ID || ''
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || ''

// Create a payment invoice via NowPayments
export async function createPayment(amount: number, currency: string = 'usdtbsc') {
  try {
    const res = await fetch(`${NOWPAYMENTS_API}/payment`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: currency,
        ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/nowpayments/ipn`,
        order_id: `SONA-${Date.now()}`,
        order_description: `SONA Deposit - ${amount} USDT`,
        is_fee_paid_by_user: false,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('NowPayments create error:', err)
      return null
    }

    return await res.json()
  } catch (error) {
    console.error('NowPayments create error:', error)
    return null
  }
}

// Get payment status from NowPayments
export async function getPaymentStatus(paymentId: string) {
  try {
    const res = await fetch(`${NOWPAYMENTS_API}/payment/${paymentId}`, {
      headers: { 'x-api-key': API_KEY },
    })

    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error('NowPayments status error:', error)
    return null
  }
}

// Check payment status - alias for clarity
export async function checkPaymentStatus(paymentId: string) {
  return getPaymentStatus(paymentId)
}

// Get minimum payment amount for a currency
export async function getMinimumPayment(currency: string = 'usdtbsc') {
  try {
    const res = await fetch(`${NOWPAYMENTS_API}/min-amount?currency_from=usd&currency_to=${currency}`, {
      headers: { 'x-api-key': API_KEY },
    })

    if (!res.ok) return 10
    const data = await res.json()
    return data.min_amount || 10
  } catch {
    return 10
  }
}

// Get available currencies for payment
export async function getAvailableCurrencies() {
  try {
    const res = await fetch(`${NOWPAYMENTS_API}/currencies`, {
      headers: { 'x-api-key': API_KEY },
    })

    if (!res.ok) return []
    const data = await res.json()
    return data.currencies || []
  } catch {
    return []
  }
}

// Get available currencies (alias)
export async function getCurrencies() {
  return getAvailableCurrencies()
}

// Verify IPN callback signature (HMAC-SHA512 validation)
// ALWAYS mandatory - no development bypass
export function verifyIPN(ipnData: Record<string, unknown>, signature: string): boolean {
  try {
    if (!IPN_SECRET) {
      console.error('IPN verification: IPN_SECRET not configured - REJECTING')
      return false
    }

    if (!signature) {
      console.error('IPN verification: No signature provided - REJECTING')
      return false
    }

    // Sort the IPN data keys alphabetically and create the sorted string
    const sortedKeys = Object.keys(ipnData).sort()
    const sortedString = sortedKeys.map(key => {
      const value = typeof ipnData[key] === 'object' ? JSON.stringify(ipnData[key]) : String(ipnData[key])
      return `${key}${value}`
    }).join('')

    // Create HMAC-SHA512 signature
    const computedSignature = crypto
      .createHmac('sha512', IPN_SECRET)
      .update(sortedString)
      .digest('hex')

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    const computedBuf = Buffer.from(computedSignature, 'hex')
    const signatureBuf = Buffer.from(signature, 'hex')
    if (computedBuf.length !== signatureBuf.length) return false
    return crypto.timingSafeEqual(computedBuf, signatureBuf)
  } catch (error) {
    console.error('IPN verification error:', error)
    return false
  }
}

// Payment statuses mapping to Arabic
export const PAYMENT_STATUSES: Record<string, string> = {
  waiting: 'في انتظار الدفع',
  confirming: 'جاري التأكيد',
  confirmed: 'تم التأكيد',
  sending: 'جاري الإرسال',
  partially_paid: 'مدفوع جزئياً',
  finished: 'مكتمل',
  failed: 'فاشل',
  refunded: 'مسترد',
  expired: 'منتهي الصلاحية',
}

// Check if a payment status means it's completed/successful
// SECURITY FIX: Only 'finished' and 'confirmed' are truly successful.
// 'sending' means the payment is still in transit - NOT yet confirmed on blockchain.
// Crediting on 'sending' was causing phantom deposits (credited without actual blockchain confirmation).
export function isPaymentSuccessful(status: string): boolean {
  return ['finished', 'confirmed'].includes(status)
}

// Check if a payment is still pending
// 'sending' is now treated as pending since funds are still in transit
export function isPaymentPending(status: string): boolean {
  return ['waiting', 'confirming', 'partially_paid', 'sending'].includes(status)
}
