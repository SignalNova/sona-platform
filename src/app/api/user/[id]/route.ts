import { db } from '@/lib/db'
import { getAuthUser, invalidateUserTokens } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { id } = await params

    // SECURITY: Only allow users to view their own profile, or admins to view any profile
    if (authUser.id !== id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        investments: {
          include: {
            package: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const { password: _, verifyCode: __, verifyCodeExpiry: __vce, twoFactorSecret: __tfs,
      kycDocumentImage: __kdi, kycSelfieImage: __ksi, kycFrontImage: __kfi, kycBackImage: __kbi,
      kycVideoUrl: __kvu, kycAiResult: __kar, kycAiStatus: __kas,
      emailChangeCode: __ecc, emailChangeExpiry: __ece, newEmail: __ne,
      ...userWithoutPassword } = user

    // Map Prisma field names to frontend field names
    const frontendUser = {
      ...userWithoutPassword,
      totalDeposit: user.totalDeposited,
      totalWithdraw: user.totalWithdrawn,
    }

    // Enrich investments with calculated fields
    const now = new Date()
    if (frontendUser.investments) {
      frontendUser.investments = frontendUser.investments.map((inv: any) => {
        const startDate = new Date(inv.startDate)
        const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
        // FIX: monthlyReturn is MONTHLY rate. Daily rate = monthlyReturn / 30
        const dailyReturn = (inv.package?.monthlyReturn || 0) / 30
        const dailyProfit = (inv.amount || 0) * (dailyReturn / 100)
        return {
          ...inv,
          daysElapsed,
          dailyProfit,
          dailyReturn,
          package: {
            ...inv.package,
            dailyReturn: (inv.package?.monthlyReturn || 0) / 30,
          },
        }
      })
    }

    return NextResponse.json(
      { user: frontendUser },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get user error:', error)
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
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { id } = await params

    // SECURITY: Only allow users to update their own profile, or admins to update any profile
    if (authUser.id !== id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, currentPassword, newPassword } = body

    // Verify user exists
    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    // Update profile fields
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone

    // Handle password change - require current password for security
    if (currentPassword && newPassword) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 })
      }
      // Password strength validation
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }
      if (!/[A-Z]/.test(newPassword)) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على حرف كبير' }, { status: 400 })
      }
      if (!/[a-z]/.test(newPassword)) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على حرف صغير' }, { status: 400 })
      }
      if (!/[0-9]/.test(newPassword)) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على رقم' }, { status: 400 })
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};'"\\|,.<>\/?]/.test(newPassword)) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على رمز خاص' }, { status: 400 })
      }
      const hashedPassword = await bcrypt.hash(newPassword, 12)
      updateData.password = hashedPassword
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات للتحديث' }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
    })

    // Invalidate all tokens if password was changed
    if (currentPassword && newPassword) {
      await invalidateUserTokens(id)
    }

    // Send security notification if password was changed
    if (currentPassword && newPassword) {
      await createNotification({
        userId: id,
        title: 'تغيير كلمة المرور',
        message: 'تم تغيير كلمة مرور حسابك بنجاح. إذا لم تكن أنت من قام بهذا التغيير، تواصل مع الدعم فوراً.',
        type: 'SECURITY',
        data: { action: 'password_change' },
      })
    }

    const { password: _, ...userWithoutPassword } = updatedUser

    return NextResponse.json({ user: userWithoutPassword, message: 'تم التحديث بنجاح' }, { status: 200 })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث البيانات' },
      { status: 500 }
    )
  }
}
