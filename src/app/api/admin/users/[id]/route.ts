import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../../middleware'
import { AdminMFA } from '@/lib/admin-mfa'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAdminFromRequest(request)
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      select: {
        // SECURITY: Explicit field selection - never expose sensitive fields
        id: true, email: true, name: true, phone: true, role: true,
        balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true,
        withdrawableBalance: true,
        emailVerified: true,
        kycStatus: true, kycFullName: true, kycIdNumber: true,
        kycDocumentType: true, kycSubmittedAt: true, kycVerifiedAt: true,
        kycRejectReason: true, kycRejectCode: true, kycCountry: true,
        referralCode: true, referredByCode: true,
        isActive: true, twoFactorEnabled: true, createdAt: true, avatar: true,
        tokenVersion: true,
        isFrozen: true, frozenUntil: true, freezeReason: true,
        isBlacklisted: true, redFlagCount: true, monitoringLevel: true,
        vpnDetected: true, lastKnownIP: true,
        // Sensitive fields EXCLUDED: password, verifyCode, verifyCodeExpiry,
        // twoFactorSecret, kycDocumentImage, kycSelfieImage, kycFrontImage,
        // kycBackImage, kycVideoUrl, kycAiResult, kycAiStatus,
        // emailChangeCode, emailChangeExpiry, newEmail
        investments: {
          include: {
            package: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
        supportTickets: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { user },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin get user error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب بيانات المستخدم' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    const { id } = await params

    const body = await request.json()
    const { isActive, balance, role, name, emailVerified, mfaCode, mfaChallengeId } = body

    // SECURITY: MFA verification for critical operations (role changes & balance overrides)
    const requiresMFACheck =
      (role && ['admin'].includes(role)) ||   // Role elevation to admin
      (typeof balance === 'number')            // Balance override

    if (requiresMFACheck) {
      const mfaCodeHeader = request.headers.get('x-mfa-code')
      const effectiveMfaCode = mfaCode || mfaCodeHeader

      if (!effectiveMfaCode || !mfaChallengeId) {
        // Determine which action requires MFA for the error message
        let requiredAction = 'unknown'
        if (role && ['admin'].includes(role)) requiredAction = 'role_elevation'
        if (typeof balance === 'number') requiredAction = 'balance_override'

        return NextResponse.json(
          {
            error: 'يتطلب هذا الإجراء تحقق MFA',
            requiresMFA: true,
            action: requiredAction,
          },
          { status: 403 }
        )
      }

      // Verify the MFA challenge
      const mfaValid = await AdminMFA.verifyChallenge(
        String(admin.id),
        mfaChallengeId,
        effectiveMfaCode
      )

      if (!mfaValid) {
        return NextResponse.json(
          { error: 'رمز MFA غير صالح أو منتهي الصلاحية' },
          { status: 403 }
        )
      }
    }

    // Verify target user exists
    const targetUser = await db.user.findUnique({
      where: { id },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Cannot deactivate admin account
    if (targetUser.email === 'help@sona.support' && isActive === false && admin.id !== id) {
      return NextResponse.json(
        { error: 'لا يمكن تعطيل حساب المشرف الرئيسي' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive
    }

    if (typeof balance === 'number') {
      // SECURITY: Balance limits to prevent excessive or fraudulent adjustments
      const MAX_BALANCE = 10_000_000 // $10M cap
      const MAX_SINGLE_CHANGE = 1_000_000 // $1M max single change

      if (balance > MAX_BALANCE) {
        return NextResponse.json(
          { error: `لا يمكن تعيين الرصيد أعلى من $${MAX_BALANCE.toLocaleString()}` },
          { status: 400 }
        )
      }

      const changeAmount = Math.abs(balance - targetUser.balance)
      if (changeAmount > MAX_SINGLE_CHANGE) {
        return NextResponse.json(
          { error: `لا يمكن تغيير الرصيد بأكثر من $${MAX_SINGLE_CHANGE.toLocaleString()} في عملية واحدة` },
          { status: 400 }
        )
      }

      // SECURITY: Log balance changes for audit trail
      const previousBalance = targetUser.balance
      updateData.balance = balance

      // Create audit log for balance changes
      await db.platformLog.create({
        data: {
          action: 'ADMIN_BALANCE_CHANGE',
          details: JSON.stringify({
            adminEmail: admin.email,
            targetUserId: id,
            targetEmail: targetUser.email,
            previousBalance,
            newBalance: balance,
            difference: balance - previousBalance,
          }),
        },
      })
    }

    if (role && ['user', 'admin'].includes(role)) {
      updateData.role = role
    }

    if (name) {
      updateData.name = name
    }

    if (typeof emailVerified === 'boolean') {
      updateData.emailVerified = emailVerified
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        balance: true, totalProfit: true, totalDeposited: true, totalWithdrawn: true,
        withdrawableBalance: true, emailVerified: true, kycStatus: true,
        isActive: true, twoFactorEnabled: true, createdAt: true, avatar: true,
        isFrozen: true, isBlacklisted: true, redFlagCount: true,
      },
    })

    return NextResponse.json(
      { message: 'تم تحديث المستخدم بنجاح', user: updatedUser },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin update user error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث المستخدم' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAdminFromRequest(request)
    const { id } = await params

    const targetUser = await db.user.findUnique({
      where: { id },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    if (targetUser.email === 'help@sona.support') {
      return NextResponse.json(
        { error: 'لا يمكن تعطيل حساب المشرف الرئيسي' },
        { status: 400 }
      )
    }

    // Soft delete - deactivate the user
    const updatedUser = await db.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, createdAt: true,
      },
    })

    return NextResponse.json(
      { message: 'تم تعطيل المستخدم بنجاح', user: updatedUser },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin delete user error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تعطيل المستخدم' },
      { status: 500 }
    )
  }
}
