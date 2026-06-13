import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getKycRejectionReason } from '@/lib/ai-support'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    return NextResponse.json({
      kycStatus: user.kycStatus,
      kycFullName: user.kycFullName,
      kycIdNumber: user.kycIdNumber,
      kycDocumentType: user.kycDocumentType,
      kycSubmittedAt: user.kycSubmittedAt,
      kycVerifiedAt: user.kycVerifiedAt,
      kycRejectReason: user.kycRejectReason ? getKycRejectionReason(user.kycRejectReason) : null,
      kycRejectCode: user.kycRejectReason,
    })
  } catch (error) {
    console.error('KYC error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    if (user.kycStatus === 'VERIFIED') {
      return NextResponse.json({ error: 'تم التحقق من هويتك بالفعل' }, { status: 400 })
    }

    const contentType = req.headers.get('content-type') || ''

    let fullName: string, idNumber: string, documentType: string, documentImage: string | null = null, selfieImage: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with actual file upload
      const formData = await req.formData()
      fullName = formData.get('fullName') as string
      idNumber = formData.get('idNumber') as string
      documentType = formData.get('documentType') as string
      const docFile = formData.get('documentImage') as File | null
      const selfieFile = formData.get('selfieImage') as File | null

      if (!fullName || !idNumber || !documentType) {
        return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
      }

      // Convert file to base64 for storage
      if (docFile) {
        const arrayBuffer = await docFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        documentImage = `data:${docFile.type};base64,${buffer.toString('base64')}`
      }

      if (selfieFile) {
        const arrayBuffer = await selfieFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        selfieImage = `data:${selfieFile.type};base64,${buffer.toString('base64')}`
      }
    } else {
      // Handle JSON (for backwards compatibility)
      const body = await req.json()
      fullName = body.fullName
      idNumber = body.idNumber
      documentType = body.documentType
      documentImage = body.documentImage
      selfieImage = body.selfieImage || null
    }

    if (!fullName || !idNumber || !documentType) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!documentImage) {
      return NextResponse.json({ error: 'يرجى رفع صورة الهوية' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        kycFullName: fullName,
        kycIdNumber: idNumber,
        kycDocumentType: documentType,
        kycDocumentImage: documentImage,
        kycSelfieImage: selfieImage || null,
        kycStatus: 'PENDING',
        kycSubmittedAt: new Date(),
        kycRejectReason: null,
      }
    })

    return NextResponse.json({ message: 'تم إرسال طلب التحقق بنجاح. سيتم مراجعته خلال 24 ساعة.' })
  } catch (error) {
    console.error('KYC submit error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
