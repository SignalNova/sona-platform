import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { runAIVerificationPipeline } from '@/lib/kyc-verify';
import { KYCVault } from '@/lib/kyc-vault';
import { FileValidator } from '@/lib/file-validator';

const KYC_ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const fullUser = await db.user.findUnique({ where: { id: String(user.id) } });
    if (!fullUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (fullUser.kycStatus === 'VERIFIED') {
      return NextResponse.json({ error: 'تم التحقق من هويتك بالفعل' }, { status: 400 });
    }

    if (fullUser.kycStatus === 'PENDING') {
      return NextResponse.json({ error: 'طلبك قيد المراجعة' }, { status: 400 });
    }

    const formData = await request.formData();
    const fullName = formData.get('fullName') as string | null;
    const idNumber = formData.get('idNumber') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const country = formData.get('country') as string | null;
    const frontImageFile = formData.get('frontImage') as File | null;
    const backImageFile = formData.get('backImage') as File | null;
    const selfieImageFile = formData.get('selfieImage') as File | null;

    if (!fullName || !idNumber || !documentType || !frontImageFile || !selfieImageFile) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    // Convert files to buffers and validate using magic bytes
    const fileToBuffer = async (file: File, fieldName: string): Promise<Buffer> => {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Validate file using magic bytes
      const validationResult = FileValidator.validateFile(buffer, KYC_ALLOWED_FILE_TYPES);
      if (!validationResult.isValid) {
        throw new Error(`فشل التحقق من ملف ${fieldName}: ${validationResult.errors.join(', ')}`);
      }

      // Check for malicious content
      const maliciousResult = FileValidator.detectMaliciousContent(buffer);
      if (maliciousResult.isMalicious) {
        console.error(`[SECURITY] Malicious content detected in KYC upload from user ${user.id}, field ${fieldName}: ${maliciousResult.threats.join(', ')}`);
        throw new Error(`تم اكتشاف محتوى ضار في ملف ${fieldName}`);
      }

      return buffer;
    };

    // Store documents encrypted using KYCVault instead of base64
    const frontBuffer = await fileToBuffer(frontImageFile, 'صورة الأمامية');
    const frontDocId = await KYCVault.storeDocument(String(user.id), 'front_image', frontBuffer);

    let backDocId: string | null = null;
    if (backImageFile) {
      const backBuffer = await fileToBuffer(backImageFile, 'صورة الخلفية');
      backDocId = await KYCVault.storeDocument(String(user.id), 'back_image', backBuffer);
    }

    const selfieBuffer = await fileToBuffer(selfieImageFile, 'صورة السيلفي');
    const selfieDocId = await KYCVault.storeDocument(String(user.id), 'selfie_image', selfieBuffer);

    await db.user.update({
      where: { id: String(user.id) },
      data: {
        kycStatus: 'PENDING',
        kycFullName: fullName,
        kycIdNumber: idNumber,
        kycDocumentType: documentType,
        kycCountry: country,
        kycFrontImage: frontDocId,    // Store doc ID instead of base64
        kycBackImage: backDocId,       // Store doc ID instead of base64
        kycSelfieImage: selfieDocId,   // Store doc ID instead of base64
        kycSubmittedAt: new Date(),
        kycRejectReason: null,
      },
    });

    // Automatically trigger AI verification pipeline (non-blocking)
    runAIVerificationPipeline(String(user.id)).catch((err) => {
      console.error('[KYC Submit] AI verification pipeline failed for user', user.id, err);
    });

    return NextResponse.json({ message: 'تم تقديم طلب التحقق بنجاح. جاري المراجعة التلقائية بالذكاء الاصطناعي...' });
  } catch (error) {
    console.error('KYC submit error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
