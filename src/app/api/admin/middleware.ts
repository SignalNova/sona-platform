import { db } from '@/lib/db'
import { verifyToken, isAdminRole } from '@/lib/auth'

// SECURITY FIX: Removed hardcoded admin email fallback - ADMIN_EMAIL must be explicitly configured
// Previously: process.env.ADMIN_EMAIL || 'help@sona.support' (allowed admin bypass via registration)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL

if (!ADMIN_EMAIL) {
  console.error('[CRITICAL SECURITY] ADMIN_EMAIL environment variable is not set! Admin access will be role-based only.')
}

// SECURITY: Use the centralized auth module's verifyToken instead of local JWT verification
// This ensures consistent secret handling and removes the insecure fallback

/**
 * Verify admin access using userId directly (call after reading body)
 * Role-based access only (role='ADMIN')
 */
export async function verifyAdmin(userId: string) {
  if (!userId) {
    throw new Error('معرف المستخدم مطلوب')
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('المستخدم غير موجود')
  }

  // SECURITY FIX: Only allow admin by ROLE - email-based bypass removed to prevent admin escalation
  if (!isAdminRole(user.role)) {
    throw new Error('غير مصرح: صلاحيات المشرف مطلوبة')
  }

  if (!user.isActive) {
    throw new Error('حساب المشرف معطل')
  }

  return user
}

/**
 * Unified admin verification that works with:
 * 1. JWT token from Authorization header (PRIMARY)
 * 2. Cookie-based auth (fallback)
 * 
 * SECURITY: No body-based userId fallback allowed
 */
export async function getAdminFromRequest(request: Request) {
  // Try JWT token from Authorization header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const payload = verifyToken(token) as { userId: string; email: string; role: string } | null
    if (payload) {
      return verifyAdmin(payload.userId)
    }
  }

  // Try cookie-based auth as fallback
  try {
    const { getAuthUser } = await import('@/lib/auth')
    const req = request as any
    const user = await getAuthUser(req)
    if (user) {
      return verifyAdmin(String(user.id))
    }
  } catch {
    // Cookie auth failed
  }

  throw new Error('مطلوب تسجيل دخول المشرف للوصول')
}

/**
 * Get admin from request ONLY via JWT/Cookie auth.
 * SECURITY: Body-based userId is NO LONGER accepted for authentication.
 */
export async function getAdminFromRequestOrUserId(request: Request, _userId?: string | null) {
  // SECURITY: Ignore userId parameter - only use request-based auth
  // This prevents IDOR attacks where an attacker passes an admin's userId in the body
  return getAdminFromRequest(request)
}
