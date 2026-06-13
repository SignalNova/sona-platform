import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import prisma from '@/lib/prisma'
import { calculateAutomationScore } from '@/lib/ai-automation'

export async function GET(request: NextRequest) {
  try {
    // Verify admin session using the project's standard admin auth middleware
    const admin = await getAdminFromRequest(request)

    // Calculate automation score
    const score = await calculateAutomationScore()

    return NextResponse.json({
      success: true,
      score: score.overallScore,
      breakdown: score.breakdown,
      details: score.details,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    // Handle auth errors with proper status codes
    if (error.message?.includes('مطلوب تسجيل دخول') || error.message?.includes('غير مصرح')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error.message?.includes('صلاحيات') || error.message?.includes('معطل')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[Automation Score API] Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حساب نقاط الأتمتة' },
      { status: 500 }
    )
  }
}
