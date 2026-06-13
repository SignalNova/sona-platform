import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { id } = await params

    // SECURITY: Only allow users to view their own transactions, or admins
    if (authUser.id !== id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const transactions = await db.transaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      { transactions },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get user transactions error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب المعاملات' },
      { status: 500 }
    )
  }
}
