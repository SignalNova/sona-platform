import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const fullUser = await db.user.findUnique({
      where: { id: String(user.id) },
      select: {
        kycStatus: true,
        kycFullName: true,
        kycIdNumber: true,
        kycDocumentType: true,
        kycCountry: true,
        kycFrontImage: true,
        kycBackImage: true,
        kycSelfieImage: true,
        kycSubmittedAt: true,
        kycVerifiedAt: true,
        kycRejectReason: true,
        kycAiStatus: true,
      },
    });

    return NextResponse.json({ kyc: fullUser });
  } catch (error) {
    console.error('KYC status error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
