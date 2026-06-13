import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const userId = searchParams.get('userId') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    if (startDate || endDate) {
      (where as any).createdAt = {}
      if (startDate) {
        (where as any).createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        (where as any).createdAt.lte = new Date(endDate)
      }
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin transactions list error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب المعاملات' },
      { status: 500 }
    )
  }
}
