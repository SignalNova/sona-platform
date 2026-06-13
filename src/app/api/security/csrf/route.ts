import { NextRequest, NextResponse } from 'next/server'
import { generateCsrfToken, validateCsrfToken } from '@/lib/security'
import { getUser } from '@/lib/auth'

// GET: Generate a new CSRF token for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const sessionId = user.id
    const token = generateCsrfToken(sessionId)

    return NextResponse.json({ csrfToken: token })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Validate a CSRF token
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { csrfToken } = await request.json()
    if (!csrfToken) return NextResponse.json({ valid: false, error: 'رمز CSRF مطلوب' }, { status: 400 })

    const isValid = validateCsrfToken(user.id, csrfToken)
    return NextResponse.json({ valid: isValid })
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
