import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyToken, isAdminRole } from '@/lib/auth'
import { logIntrusionEvent } from '@/lib/security'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// SECURITY: This endpoint is now PROTECTED - requires existing admin JWT token
// No default password allowed - ADMIN_PASSWORD env var is MANDATORY
export async function POST(request: NextRequest) {
  try {
    // ── AUTHENTICATION REQUIRED ──
    // Only an existing admin can create another admin account
    let authUser: any = null

    // Try Bearer token
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const payload = verifyToken(token)
      if (payload) {
        const user = await db.user.findUnique({ where: { id: payload.userId } })
        if (user && isAdminRole(user.role) && user.isActive) {
          authUser = user
        }
      }
    }

    // Try cookie auth
    if (!authUser) {
      try {
        const { getAuthUser } = await import('@/lib/auth')
        const user = await getAuthUser(request)
        if (user && isAdminRole(user.role) && user.isActive) {
          authUser = user
        }
      } catch {
        // Cookie auth failed
      }
    }

    if (!authUser) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      logIntrusionEvent(ip, 'UNAUTHORIZED_ADMIN_ACCESS', '/api/admin/ensure-admin', 'Attempted to create admin without authentication')
      return NextResponse.json({ error: 'غير مصرح. يتطلب تسجيل دخول مشرف موجود.' }, { status: 401 })
    }

    // SECURITY: ADMIN_PASSWORD env var is MANDATORY
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'لم يتم تعيين ADMIN_PASSWORD في متغيرات البيئة. لا يمكن إنشاء حساب مشرف.' },
        { status: 500 }
      )
    }

    // SECURITY: ADMIN_EMAIL env var is MANDATORY
    if (!ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'لم يتم تعيين ADMIN_EMAIL في متغيرات البيئة. لا يمكن إنشاء حساب مشرف.' },
        { status: 500 }
      )
    }

    // Check if admin account already exists
    const existingAdmin = await db.user.findUnique({
      where: { email: ADMIN_EMAIL },
    })

    if (existingAdmin) {
      // Ensure the existing account has admin role
      if (existingAdmin.role !== 'admin' && existingAdmin.role !== 'ADMIN') {
        await db.user.update({
          where: { email: ADMIN_EMAIL },
          data: { role: 'ADMIN', emailVerified: true, isActive: true },
        })
      }

      return NextResponse.json({
        message: 'حساب المشرف موجود بالفعل',
        created: false,
      }, { status: 200 })
    }

    // Create admin account with bcrypt hashing
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

    // Generate unique referral code
    const cryptoModule = await import('crypto')
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = 'SONA'
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(cryptoModule.randomInt(0, chars.length))
      }
      return code
    }

    let referralCode = generateReferralCode()
    while (await db.user.findUnique({ where: { referralCode } })) {
      referralCode = generateReferralCode()
    }

    await db.user.create({
      data: {
        name: 'Admin',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        balance: 0,
        totalProfit: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        emailVerified: true,
        isActive: true,
        role: 'ADMIN',
        referralCode,
      },
    })

    // Log admin creation
    await db.platformLog.create({
      data: {
        action: 'ADMIN_ACCOUNT_CREATED',
        details: JSON.stringify({ createdBy: authUser.email, newAdminEmail: ADMIN_EMAIL }),
      },
    })

    return NextResponse.json({
      message: 'تم إنشاء حساب المشرف بنجاح',
      created: true,
    }, { status: 201 })
  } catch (error) {
    console.error('Ensure admin error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء حساب المشرف' },
      { status: 500 }
    )
  }
}
