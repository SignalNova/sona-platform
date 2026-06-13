import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyToken, isAdminRole } from '@/lib/auth';
import { logIntrusionEvent } from '@/lib/security';

// SECURITY: This endpoint now requires existing admin authentication
// No unauthenticated access allowed
export async function POST(request: NextRequest) {
  try {
    // ── AUTHENTICATION REQUIRED ──
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
      logIntrusionEvent(ip, 'UNAUTHORIZED_ADMIN_ACCESS', '/api/admin/ensure', 'Attempted to ensure admin without authentication')
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // ADMIN_PASSWORD env var is MANDATORY
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'لم يتم تعيين ADMIN_PASSWORD. لا يمكن إنشاء حساب مشرف.' },
        { status: 500 }
      )
    }

    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      return NextResponse.json(
        { error: 'لم يتم تعيين ADMIN_EMAIL في متغيرات البيئة. لا يمكن إنشاء حساب مشرف.' },
        { status: 500 }
      )
    }

    const existingAdmin = await db.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      // Ensure role is ADMIN
      if (existingAdmin.role !== 'ADMIN' && existingAdmin.role !== 'admin') {
        await db.user.update({
          where: { email: adminEmail },
          data: { role: 'ADMIN', isActive: true },
        });
      }
      return NextResponse.json({ message: 'حساب المدير موجود بالفعل' });
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = await db.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'المدير',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
        kycStatus: 'VERIFIED',
        kycVerifiedAt: new Date(),
        referralCode: 'SONA' + require('crypto').randomBytes(4).toString('hex').toUpperCase(),
      },
    });

    // Log admin creation
    await db.platformLog.create({
      data: {
        action: 'ADMIN_ACCOUNT_ENSURED',
        details: JSON.stringify({ createdBy: authUser.email, newAdminEmail: adminEmail }),
      },
    });

    return NextResponse.json({ message: 'تم إنشاء حساب المدير' });
  } catch (error) {
    console.error('Ensure admin error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
