import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone } = body;

    // SECURITY: Email is NOT allowed to be changed via this endpoint
    // Use /api/user/change-email which requires password confirmation
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    const updatedUser = await db.user.update({
      where: { id: String(user.id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        balance: true,
        kycStatus: true,
        totalProfit: true,
        totalDeposited: true,
        referralCode: true,
        twoFactorEnabled: true,
        isActive: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
