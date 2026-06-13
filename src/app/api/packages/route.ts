import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAdminFromRequest } from '@/app/api/admin/middleware'

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    })
    // Map monthlyReturn → dailyReturn for frontend compatibility
    // FIX: dailyReturn should be monthlyReturn / 30 (not the same value)
    const mapped = packages.map(p => ({
      ...p,
      dailyReturn: p.monthlyReturn / 30,
    }))
    return NextResponse.json({ packages: mapped })
  } catch (error) {
    console.error('Packages error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin access
    await getAdminFromRequest(request)

    const body = await request.json()
    const { id, name, nameEn, monthlyReturn, durationDays, minAmount, maxAmount } = body

    if (!id) {
      return NextResponse.json({ error: 'معرف الباقة مطلوب' }, { status: 400 })
    }

    const existing = await prisma.package.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (nameEn !== undefined) updateData.nameEn = nameEn
    if (monthlyReturn !== undefined) updateData.monthlyReturn = parseFloat(String(monthlyReturn))
    if (durationDays !== undefined) updateData.durationDays = parseInt(String(durationDays))
    if (minAmount !== undefined) updateData.minAmount = parseFloat(String(minAmount))
    if (maxAmount !== undefined) updateData.maxAmount = maxAmount ? parseFloat(String(maxAmount)) : null

    const updated = await prisma.package.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ package: updated, message: 'تم تحديث الباقة بنجاح' })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Packages PUT error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الباقة' }, { status: 500 })
  }
}
