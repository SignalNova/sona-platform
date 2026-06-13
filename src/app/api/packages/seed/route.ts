import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'

const packagesData = [
  {
    name: 'باقة SONA',
    nameEn: 'SONA',
    minAmount: 80,
    maxAmount: null,
    monthlyReturn: 1.5,
    durationDays: 60,
    description: 'باقة استثمارية بعائد يومي 1.5% لمدة 60 يوم - الحد الأدنى 80$ بلا حد أقصى',
    descriptionEn: 'Investment package with 1.5% daily return for 60 days - Minimum $80, no maximum limit',
    color: '#f0b90b',
    icon: 'gem',
    isActive: true,
    order: 1,
  },
]

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    try {
      await getAdminFromRequest(request)
    } catch {
      return NextResponse.json({ error: 'غير مصرح - مطلوب صلاحيات المدير' }, { status: 403 })
    }

    // Check if there are any investments referencing packages
    const activeInvestments = await db.investment.count({ where: { status: 'ACTIVE' } })

    if (activeInvestments > 0) {
      // Migrate all investments to SONA package, then delete others
      const sonaPkg = await db.package.findFirst({ where: { nameEn: 'SONA' } })

      if (sonaPkg) {
        // Migrate all investments to SONA
        const oldPackages = await db.package.findMany({ where: { nameEn: { not: 'SONA' } } })
        for (const oldPkg of oldPackages) {
          await db.investment.updateMany({ where: { packageId: oldPkg.id }, data: { packageId: sonaPkg.id } })
          await db.package.delete({ where: { id: oldPkg.id } })
        }
      }

      // Upsert SONA package
      const results = []
      for (const pkg of packagesData) {
        const existing = await db.package.findFirst({ where: { nameEn: pkg.nameEn } })
        if (!existing) {
          const created = await db.package.create({ data: pkg })
          results.push({ action: 'created', package: created })
        } else {
          const updated = await db.package.update({
            where: { id: existing.id },
            data: {
              name: pkg.name,
              nameEn: pkg.nameEn,
              minAmount: pkg.minAmount,
              maxAmount: pkg.maxAmount,
              monthlyReturn: pkg.monthlyReturn,
              durationDays: pkg.durationDays,
              description: pkg.description,
              descriptionEn: pkg.descriptionEn,
              color: pkg.color,
              icon: pkg.icon,
              isActive: pkg.isActive,
              order: pkg.order,
            },
          })
          results.push({ action: 'updated', package: updated })
        }
      }
      return NextResponse.json(
        { message: 'تم تحديث الباقات بنجاح - باقة SONA فقط', results },
        { status: 200 }
      )
    }

    // No active investments - safe to delete all and re-seed with only SONA
    await db.package.deleteMany({})

    const results = []
    for (const pkg of packagesData) {
      const created = await db.package.create({ data: pkg })
      results.push({ action: 'created', package: created })
    }

    return NextResponse.json(
      { message: 'تم تهيئة باقة SONA بنجاح', results },
      { status: 200 }
    )
  } catch (error) {
    console.error('Seed packages error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تهيئة الباقات' },
      { status: 500 }
    )
  }
}
