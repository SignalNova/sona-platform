import crypto from 'crypto'

export function generateReferralCode(): string {
  // SECURITY: Use crypto.randomInt() instead of Math.random() for cryptographic safety
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'SONA-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length))
  }
  return code
}

export function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]) {
  return inputs.map(input => {
    if (!input || typeof input === 'string') return input
    if (typeof input === 'object') {
      return Object.entries(input).filter(([, v]) => v).map(([k]) => k).join(' ')
    }
    return ''
  }).filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Safely format a number with fixed decimal places.
 * Returns '0.00' (or equivalent) for undefined, null, or NaN values.
 */
export function safeFixed(n: number | undefined | null, digits: number = 2): string {
  if (n === undefined || n === null || isNaN(n)) return '0.' + '0'.repeat(digits)
  return Number(n).toFixed(digits)
}
