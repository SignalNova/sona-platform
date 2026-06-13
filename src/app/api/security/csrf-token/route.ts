import { NextRequest, NextResponse } from 'next/server'
import { csrfProtection } from '@/lib/csrf-protection'
import { getAuthUser } from '@/lib/auth'

/**
 * GET /api/security/csrf-token
 * Generate a new CSRF token for the authenticated user's session.
 * The token should be included in the x-csrf-token header for state-changing requests (POST/PUT/DELETE).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const sessionId = String(user.id)
    const token = csrfProtection.generateToken(sessionId)

    return NextResponse.json({
      csrfToken: token,
      expiresIn: 3600, // 1 hour in seconds
    })
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

/**
 * POST /api/security/csrf-token
 * Validate a CSRF token.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { csrfToken } = await request.json()
    if (!csrfToken) {
      return NextResponse.json(
        { valid: false, error: 'رمز CSRF مطلوب' },
        { status: 400 }
      )
    }

    const sessionId = String(user.id)
    const isValid = csrfProtection.validateToken(sessionId, csrfToken)

    return NextResponse.json({ valid: isValid })
  } catch (error) {
    console.error('CSRF token validation error:', error)
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
