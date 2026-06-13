import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { runAIVerificationPipeline } from '@/lib/kyc-verify'

/**
 * POST /api/kyc/ai-verify
 * Process KYC verification using AI analysis of ID document images.
 *
 * Can be called:
 * 1. Directly by the user (authenticated) to re-trigger verification
 * 2. Internally with a userId in the body (from the KYC submission route)
 */
export async function POST(request: NextRequest) {
  let authenticatedUserId: string | null = null

  try {
    // Always authenticate - no body.userId bypass
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    authenticatedUserId = String(user.id)

    // Verify user exists and has the required images
    const fullUser = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
      select: {
        id: true,
        kycStatus: true,
        kycFrontImage: true,
        kycBackImage: true,
      },
    })

    if (!fullUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (fullUser.kycStatus === 'VERIFIED') {
      return NextResponse.json({ error: 'تم التحقق من هويتك بالفعل' }, { status: 400 })
    }

    if (!fullUser.kycFrontImage || !fullUser.kycBackImage) {
      return NextResponse.json(
        { error: 'صور الوثيقة غير متوفرة. يرجى إعادة تقديم طلب التحقق.' },
        { status: 400 }
      )
    }

    // Run the full AI verification pipeline
    const aiResult = await runAIVerificationPipeline(authenticatedUserId)

    const isApproved = aiResult.confidence >= 70

    return NextResponse.json({
      success: true,
      approved: isApproved,
      confidence: aiResult.confidence,
      reasons: aiResult.reasons,
      kycStatus: isApproved ? 'VERIFIED' : 'REJECTED',
      kycAiStatus: isApproved ? 'APPROVED' : 'REJECTED',
    })
  } catch (error) {
    console.error('[KYC AI Verify] Error:', error)

    // Attempt to mark the AI status as failed using the authenticated user's ID
    try {
      if (authenticatedUserId) {
        await prisma.user.update({
          where: { id: authenticatedUserId },
          data: {
            kycAiStatus: 'REJECTED',
            kycAiResult: JSON.stringify({
              approved: false,
              confidence: 0,
              reasons: ['حدث خطأ أثناء التحقق الآلي. يرجى إعادة المحاولة.'],
            }),
          },
        })
      }
    } catch {
      // Silently fail — we already logged the main error
    }

    return NextResponse.json({ error: 'حدث خطأ أثناء التحقق الآلي' }, { status: 500 })
  }
}
