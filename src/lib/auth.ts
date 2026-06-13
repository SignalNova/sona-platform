import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import prisma from './prisma'

// SECURITY: JWT_SECRET is MANDATORY - no fallback allowed in production
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL SECURITY] JWT_SECRET is not set in production! Server cannot start safely.')
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    // Dev only fallback
    console.warn('[SECURITY WARNING] JWT_SECRET not set! Using insecure dev secret. NEVER use in production!')
    return 'dev-only-insecure-secret-do-not-use-in-production'
  }
  return secret
})()

// SECURITY: Explicit token payload - no arbitrary fields allowed
export interface TokenPayload {
  userId: string
  email: string
  role?: string
  purpose?: string
  tokenVersion?: number
}

// Token expiry: 24 hours for access token (reduced from 7 days for financial platform security)
export function signToken(payload: TokenPayload, expiresIn: string = '24h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export async function getUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return null

    const payload = verifyToken(token)
    if (!payload) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true,
        withdrawableBalance: true,
        emailVerified: true,
        kycStatus: true, kycFullName: true, kycIdNumber: true,
        kycDocumentType: true, kycSubmittedAt: true, kycVerifiedAt: true,
        kycRejectReason: true, kycRejectCode: true, referralCode: true, referredByCode: true,
        isActive: true, twoFactorEnabled: true, createdAt: true, avatar: true,
        tokenVersion: true,
        isFrozen: true, frozenUntil: true, freezeReason: true,
        isBlacklisted: true, redFlagCount: true, monitoringLevel: true,
        vpnDetected: true, lastKnownIP: true,
      }
    })

    // SECURITY: Verify token version matches - invalidate tokens on password change/logout
    if (user && payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      return null // Token has been invalidated
    }

    return user
  } catch {
    return null
  }
}

export async function isAdmin() {
  const user = await getUser()
  return user?.role?.toLowerCase() === 'admin'
}

export async function getAuthUser(request?: NextRequest): Promise<any> {
  // First try: Authorization header Bearer token
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyToken(token)
      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true, email: true, name: true, phone: true, role: true,
            balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true,
            withdrawableBalance: true,
            emailVerified: true,
            kycStatus: true, kycFullName: true, kycIdNumber: true,
            kycDocumentType: true, kycSubmittedAt: true, kycVerifiedAt: true,
            kycRejectReason: true, kycRejectCode: true, referralCode: true, referredByCode: true,
            isActive: true, twoFactorEnabled: true, createdAt: true, avatar: true,
            tokenVersion: true,
            isFrozen: true, frozenUntil: true, freezeReason: true,
            isBlacklisted: true, redFlagCount: true, monitoringLevel: true,
            vpnDetected: true, lastKnownIP: true,
          }
        })

        // SECURITY: Verify token version
        if (user && payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
          return null // Token invalidated
        }

        if (user) return user
      }
    }
  }

  // Fallback: cookie-based auth
  return await getUser()
}

const userSelect = {
  id: true, email: true, name: true, phone: true, role: true,
  balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true,
  withdrawableBalance: true,
  emailVerified: true,
  kycStatus: true, kycFullName: true, kycIdNumber: true,
  kycDocumentType: true, kycSubmittedAt: true, kycVerifiedAt: true,
  kycRejectReason: true, referralCode: true, referredByCode: true,
  isActive: true, twoFactorEnabled: true, createdAt: true, avatar: true,
  tokenVersion: true,
  isFrozen: true, frozenUntil: true, freezeReason: true,
  isBlacklisted: true, redFlagCount: true, monitoringLevel: true,
  vpnDetected: true, lastKnownIP: true,
}

export type AuthUser = typeof userSelect

/**
 * Standardized admin role check helper
 * Use this everywhere admin role verification is needed to ensure consistency
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role?.toUpperCase() === 'ADMIN'
}

export async function requireAdmin() {
  const user = await getUser()
  if (!user || !isAdminRole(user.role)) return null
  return user
}

/**
 * Invalidate all tokens for a user by incrementing their tokenVersion
 * Call this on: password change, logout, email change, account lock
 */
export async function invalidateUserTokens(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } }
  })
}
