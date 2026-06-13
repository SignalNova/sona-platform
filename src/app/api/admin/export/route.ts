import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../middleware'

/**
 * GET /api/admin/export?type=users|transactions|investments
 * Export data as CSV file.
 */
export async function GET(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type || !['users', 'transactions', 'investments', 'kyc'].includes(type)) {
      return NextResponse.json(
        { error: 'نوع التصدير غير صالح. الأنواع المتاحة: users, transactions, investments' },
        { status: 400 }
      )
    }

    let csvContent: string
    let filename: string

    switch (type) {
      case 'users': {
        const users = await db.user.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            email: true,
            name: true,
            phone: true,
            balance: true,
            totalDeposited: true,
            totalWithdrawn: true,
            totalProfit: true,
            isActive: true,
            createdAt: true,
            withdrawableBalance: true,
            nonWithdrawableProfit: true,
            lockedCapital: true,
            kycStatus: true,
            role: true,
          },
        })

        const headers = [
          'email', 'name', 'phone', 'balance', 'withdrawableBalance',
          'nonWithdrawableProfit', 'lockedCapital', 'totalDeposited',
          'totalWithdrawn', 'totalProfit', 'isActive', 'kycStatus',
          'role', 'createdAt'
        ]

        const rows = users.map((u) => [
          u.email,
          u.name,
          u.phone || '',
          (u.balance ?? 0).toFixed(2),
          (u.withdrawableBalance ?? 0).toFixed(2),
          (u.nonWithdrawableProfit ?? 0).toFixed(2),
          (u.lockedCapital ?? 0).toFixed(2),
          (u.totalDeposited ?? 0).toFixed(2),
          (u.totalWithdrawn ?? 0).toFixed(2),
          (u.totalProfit ?? 0).toFixed(2),
          u.isActive ? '1' : '0',
          u.kycStatus,
          u.role,
          u.createdAt.toISOString(),
        ])

        csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
        filename = `users_export_${formatDate(new Date())}.csv`
        break
      }

      case 'transactions': {
        const transactions = await db.transaction.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            type: true,
            amount: true,
            status: true,
            method: true,
            cryptoCurrency: true,
            walletAddress: true,
            txHash: true,
            description: true,
            createdAt: true,
            user: { select: { email: true, name: true } },
          },
        })

        const headers = [
          'id', 'userEmail', 'userName', 'type', 'amount', 'status',
          'method', 'cryptoCurrency', 'walletAddress', 'txHash',
          'description', 'createdAt'
        ]

        const rows = transactions.map((t) => [
          t.id,
          t.user?.email || '',
          t.user?.name || '',
          t.type,
          (t.amount ?? 0).toFixed(2),
          t.status,
          t.method || '',
          t.cryptoCurrency || '',
          t.walletAddress || '',
          t.txHash || '',
          t.description || '',
          t.createdAt.toISOString(),
        ])

        csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
        filename = `transactions_export_${formatDate(new Date())}.csv`
        break
      }

      case 'investments': {
        const investments = await db.investment.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            amount: true,
            monthlyProfit: true,
            totalProfit: true,
            status: true,
            mode: true,
            reinvested: true,
            reinvestBonus: true,
            lockEndDate: true,
            nonWithdrawableProfit: true,
            withdrawableProfit: true,
            poolShare: true,
            startDate: true,
            createdAt: true,
            user: { select: { email: true, name: true } },
            package: { select: { name: true } },
          },
        })

        const headers = [
          'id', 'userEmail', 'userName', 'packageName', 'amount',
          'monthlyProfit', 'totalProfit', 'status', 'mode',
          'reinvested', 'reinvestBonus', 'lockEndDate',
          'nonWithdrawableProfit', 'withdrawableProfit', 'poolShare',
          'startDate', 'createdAt'
        ]

        const rows = investments.map((i) => [
          i.id,
          i.user?.email || '',
          i.user?.name || '',
          i.package?.name || '',
          (i.amount ?? 0).toFixed(2),
          (i.monthlyProfit ?? 0).toFixed(2),
          (i.totalProfit ?? 0).toFixed(2),
          i.status,
          i.mode,
          i.reinvested ? '1' : '0',
          (i.reinvestBonus ?? 0).toFixed(2),
          i.lockEndDate ? i.lockEndDate.toISOString() : '',
          (i.nonWithdrawableProfit ?? 0).toFixed(2),
          (i.withdrawableProfit ?? 0).toFixed(2),
          (i.poolShare ?? 0).toFixed(2),
          i.startDate.toISOString(),
          i.createdAt.toISOString(),
        ])

        csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
        filename = `investments_export_${formatDate(new Date())}.csv`
        break
      }

      case 'kyc': {
        const users = await db.user.findMany({
          where: { kycStatus: { not: 'NONE' } },
          orderBy: { kycSubmittedAt: 'desc' },
          select: {
            email: true,
            name: true,
            kycStatus: true,
            kycFullName: true,
            kycIdNumber: true,
            kycDocumentType: true,
            kycCountry: true,
            kycSubmittedAt: true,
            kycVerifiedAt: true,
            kycRejectReason: true,
            kycRejectCode: true,
            isActive: true,
          },
        })

        const headers = [
          'email', 'name', 'kycStatus', 'kycFullName', 'kycIdNumber',
          'kycDocumentType', 'kycCountry', 'kycSubmittedAt', 'kycVerifiedAt',
          'kycRejectReason', 'kycRejectCode', 'isActive'
        ]

        const rows = users.map((u) => [
          u.email,
          u.name,
          u.kycStatus,
          u.kycFullName || '',
          u.kycIdNumber || '',
          u.kycDocumentType || '',
          u.kycCountry || '',
          u.kycSubmittedAt ? u.kycSubmittedAt.toISOString() : '',
          u.kycVerifiedAt ? u.kycVerifiedAt.toISOString() : '',
          u.kycRejectReason || '',
          u.kycRejectCode || '',
          u.isActive ? '1' : '0',
        ])

        csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
        filename = `kyc_export_${formatDate(new Date())}.csv`
        break
      }

      default:
        return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 })
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تصدير البيانات' },
      { status: 500 }
    )
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}
