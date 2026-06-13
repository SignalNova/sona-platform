import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const role = searchParams.get('role') || ''
    const kycStatus = searchParams.get('kycStatus') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ]
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    if (role) {
      where.role = role.toUpperCase()
    }

    if (kycStatus) {
      where.kycStatus = kycStatus.toUpperCase()
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          balance: true,
          totalDeposited: true,
          totalWithdrawn: true,
          totalProfit: true,
          emailVerified: true,
          isActive: true,
          role: true,
          createdAt: true,
          kycStatus: true,
          kycDocumentType: true,
          kycIdNumber: true,
          _count: {
            select: {
              investments: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      balance: user.balance,
      totalDeposit: user.totalDeposited,
      totalWithdraw: user.totalWithdrawn,
      totalProfit: user.totalProfit,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      role: user.role,
      createdAt: user.createdAt,
      kycStatus: user.kycStatus,
      kycDocumentType: user.kycDocumentType,
      kycIdNumber: user.kycIdNumber,
      activeInvestments: user._count.investments,
    }))

    return NextResponse.json({
      users: formattedUsers,
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
    console.error('Admin users list error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب المستخدمين' },
      { status: 500 }
    )
  }
}
