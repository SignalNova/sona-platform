import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'
import { logAdminAction } from '@/lib/staged-withdrawal'
import { createNotification } from '@/lib/notifications'

// POST: Override user balance manually
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const body = await request.json()
    const { userId, field, amount, operation, reason } = body // operation: 'set' | 'increment' | 'decrement'
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (!userId || !field || amount === undefined || !operation) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة: userId, field, amount, operation' }, { status: 400 })
    }

    const allowedFields = ['balance', 'withdrawableBalance', 'nonWithdrawableProfit', 'lockedCapital', 'totalProfit', 'totalDeposited', 'totalWithdrawn']
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: 'حقل غير مسموح به' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

    const oldValue = (user as any)[field]
    let newValue: number

    // SECURITY FIX: Validate amount is a reasonable number
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 })
    }

    if (operation === 'set') {
      newValue = amount
    } else if (operation === 'increment') {
      newValue = oldValue + amount
    } else if (operation === 'decrement') {
      newValue = oldValue - amount
    } else {
      return NextResponse.json({ error: 'عملية غير صالحة: set, increment, decrement' }, { status: 400 })
    }

    if (newValue < 0) newValue = 0

    // SECURITY FIX: Add maximum balance limits to prevent unlimited balance creation
    // A compromised admin could set astronomical balances
    const MAX_BALANCE = 10_000_000 // $10 million maximum
    const MAX_SINGLE_CHANGE = 1_000_000 // $1 million maximum single change
    const changeAmount = Math.abs(newValue - oldValue)

    if (newValue > MAX_BALANCE) {
      return NextResponse.json({ error: `الحد الأقصى للرصيد هو $${MAX_BALANCE.toLocaleString()}` }, { status: 400 })
    }
    if (changeAmount > MAX_SINGLE_CHANGE) {
      return NextResponse.json({ error: `الحد الأقصى للتغيير في عملية واحدة هو $${MAX_SINGLE_CHANGE.toLocaleString()}` }, { status: 400 })
    }

    await db.user.update({ where: { id: userId }, data: { [field]: newValue } })

    await logAdminAction({
      adminId: admin.id,
      action: 'BALANCE_OVERRIDE',
      targetId: userId,
      targetType: 'USER',
      details: JSON.stringify({ field, operation, amount, oldValue, newValue, reason }),
      ipAddress,
      userAgent,
    })

    // Create transaction record for audit trail
    await db.transaction.create({
      data: {
        userId,
        type: 'ADMIN_ADJUSTMENT',
        amount: Math.abs(newValue - oldValue),
        status: 'COMPLETED',
        description: `تعديل يدوي: ${field} من ${oldValue.toFixed(2)} إلى ${newValue.toFixed(2)}${reason ? ` - السبب: ${reason}` : ''}`,
        adminNote: `Admin: ${admin.email} | ${operation} ${amount} | Reason: ${reason || 'N/A'}`,
      }
    })

    // Notify user
    await createNotification({
      userId,
      title: 'تحديث الرصيد',
      message: `تم تحديث رصيدك بواسطة الإدارة${reason ? `: ${reason}` : ''}`,
      type: 'SYSTEM',
      data: { field, oldValue, newValue },
    })

    return NextResponse.json({
      message: 'تم تعديل الرصيد بنجاح',
      oldValue,
      newValue,
      field,
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Balance override error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
