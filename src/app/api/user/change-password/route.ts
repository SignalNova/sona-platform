import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { invalidateUserTokens } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Password complexity validation
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' }
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل' }
  }
  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' }, { status: 400 });
    }

    // Validate new password strength
    const strengthCheck = validatePasswordStrength(newPassword)
    if (!strengthCheck.valid) {
      return NextResponse.json({ error: strengthCheck.error }, { status: 400 });
    }

    const fullUser = await db.user.findUnique({ where: { id: String(user.id) } });
    if (!fullUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, fullUser.password);
    if (!isValid) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 });
    }

    // Don't allow reusing the same password
    const isSamePassword = await bcrypt.compare(newPassword, fullUser.password);
    if (isSamePassword) {
      return NextResponse.json({ error: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: String(user.id) },
      data: { password: hashedPassword },
    });

    // SECURITY: Invalidate all existing tokens by incrementing tokenVersion
    await invalidateUserTokens(String(user.id))

    return NextResponse.json({ message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
