import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { type: 'DEPOSIT' }
    if (status) where.status = status.toUpperCase()

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
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
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin deposits error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const body = await request.json()
    const { userId, amount, method, description } = body

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount,
          status: 'COMPLETED',
          method: method || 'manual',
          description: description || `إيداع يدوي بواسطة ${admin.name}`,
          adminNote: `Manual deposit by admin ${admin.email}`,
        }
      })

      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          withdrawableBalance: { increment: amount },
          totalDeposited: { increment: amount },
        }
      })

      return transaction
    })

    return NextResponse.json({ transaction: result })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin deposit create error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
