import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser, isAdmin } from '@/lib/auth'
import { submitBinanceWithdrawal, verifyBinanceConnection, mapNetworkToBinance } from '@/lib/binance'

export async function GET() {
  try {
    const admin = await isAdmin()
    if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const [
      totalUsers,
      totalInvestments,
      totalDeposits,
      totalWithdrawals,
      pendingDeposits,
      pendingWithdrawals,
      pendingKyc,
      activeInvestments,
      users,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.investment.count(),
      prisma.transaction.count({ where: { type: 'DEPOSIT', status: 'COMPLETED' } }),
      prisma.transaction.count({ where: { type: 'WITHDRAWAL' } }),
      prisma.transaction.findMany({ where: { type: 'DEPOSIT', status: 'PENDING' }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.transaction.findMany({ where: { type: 'WITHDRAWAL', status: { in: ['PENDING', 'PROCESSING'] } }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.user.findMany({ where: { kycStatus: 'PENDING' }, select: { id: true, name: true, email: true, kycFullName: true, kycIdNumber: true, kycDocumentType: true, kycSubmittedAt: true } }),
      prisma.investment.findMany({ where: { status: 'ACTIVE' }, include: { user: { select: { name: true, email: true } }, package: true } }),
      prisma.user.findMany({ select: { id: true, name: true, email: true, balance: true, totalProfit: true, kycStatus: true, isActive: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ])

    const totalBalance = users.reduce((sum, u) => sum + u.balance, 0)
    const totalProfitAmount = users.reduce((sum, u) => sum + u.totalProfit, 0)

    return NextResponse.json({
      stats: { totalUsers, totalInvestments, totalDeposits, totalWithdrawals, totalBalance, totalProfitAmount },
      pendingDeposits,
      pendingWithdrawals,
      pendingKyc,
      activeInvestments,
      users,
    })
  } catch (error) {
    console.error('Admin error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await isAdmin()
    if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await req.json()
    const { action } = body

    if (action === 'approveDeposit') {
      const { transactionId } = body
      const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
      if (!tx) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })

      await prisma.$transaction([
        prisma.transaction.update({ where: { id: transactionId }, data: { status: 'COMPLETED' } }),
        prisma.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount }, totalDeposited: { increment: tx.amount } } }),
      ])
      return NextResponse.json({ message: 'تم قبول الإيداع بنجاح' })
    }

    if (action === 'rejectDeposit') {
      const { transactionId, reason } = body
      await prisma.transaction.update({ where: { id: transactionId }, data: { status: 'REJECTED', adminNote: reason || 'مرفوض' } })
      return NextResponse.json({ message: 'تم رفض الإيداع' })
    }

    if (action === 'approveWithdrawal') {
      const { transactionId } = body
      const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
      if (!tx) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })

      // Try automatic Binance withdrawal
      const binanceNetwork = mapNetworkToBinance(tx.cryptoNetwork || 'BEP20')
      const withdrawalResult = await submitBinanceWithdrawal({
        coin: 'USDT',
        network: binanceNetwork,
        address: tx.walletAddress || '',
        amount: tx.amount,
        orderId: `SONA-${tx.id}`,
      })

      if (withdrawalResult.success) {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'COMPLETED',
              txHash: withdrawalResult.txId || tx.txHash,
              description: `${tx.description} | سحب تلقائي عبر Binance - ID: ${withdrawalResult.id}`,
            },
          }),
          prisma.user.update({
            where: { id: tx.userId },
            data: { totalWithdrawn: { increment: tx.amount } },
          }),
        ])
        return NextResponse.json({ message: 'تم قبول السحب ومعالجته تلقائياً عبر Binance', autoProcessed: true })
      } else {
        // If Binance fails, mark as completed but manual
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transactionId },
            data: { status: 'COMPLETED' },
          }),
          prisma.user.update({
            where: { id: tx.userId },
            data: { totalWithdrawn: { increment: tx.amount } },
          }),
        ])
        return NextResponse.json({ message: `تم قبول السحب (يدوي). Binance: ${withdrawalResult.message}`, autoProcessed: false })
      }
    }

    if (action === 'rejectWithdrawal') {
      const { transactionId, reason } = body
      const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
      if (!tx) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })
      await prisma.transaction.update({ where: { id: transactionId }, data: { status: 'REJECTED', adminNote: reason || 'مرفوض' } })
      await prisma.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount } } })
      return NextResponse.json({ message: 'تم رفض السحب وإعادة المبلغ' })
    }

    if (action === 'approveKyc') {
      const { userId } = body
      await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'VERIFIED', kycVerifiedAt: new Date(), kycRejectReason: null } })
      return NextResponse.json({ message: 'تم التحقق من الهوية بنجاح' })
    }

    if (action === 'rejectKyc') {
      const { userId, reason } = body
      const validReasons = ['BLURRY', 'EXPIRED', 'MISMATCH', 'INCOMPLETE', 'SELFIE_MISMATCH', 'INVALID_DOC', 'DUPLICATE']
      const rejectReason = validReasons.includes(reason) ? reason : 'INCOMPLETE'
      await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'REJECTED', kycRejectReason: rejectReason } })
      return NextResponse.json({ message: 'تم رفض التحقق مع إرسال السبب للمستخدم' })
    }

    if (action === 'toggleUser') {
      const { userId } = body
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
      await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } })
      return NextResponse.json({ message: user.isActive ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم' })
    }

    if (action === 'processDailyProfits') {
      // Process DAILY profits for all active investments
      const investments = await prisma.investment.findMany({
        where: { status: 'ACTIVE' },
        include: { package: true }
      })

      let processed = 0
      const now = Date.now()

      for (const inv of investments) {
        // Check if at least 1 day has passed since last profit
        const lastProfit = inv.lastProfitDate ? new Date(inv.lastProfitDate).getTime() : new Date(inv.startDate).getTime()
        const hoursSinceLastProfit = (now - lastProfit) / (1000 * 60 * 60)

        if (hoursSinceLastProfit >= 24) {
          // Calculate days to process (cap at 1 day to prevent abuse)
          const daysToProcess = Math.min(Math.floor(hoursSinceLastProfit / 24), 1)

          // Daily profit = amount * (dailyReturn / 100)
          // monthlyReturn in DB is actually daily return percentage (1.5, 2.0, 2.5, 3.0, 3.5)
          const dailyProfitAmount = inv.amount * (inv.package.monthlyReturn / 100)
          const profitAmount = dailyProfitAmount * daysToProcess

          // Check if investment duration is complete
          const totalDaysElapsed = Math.floor((now - new Date(inv.startDate).getTime()) / (1000 * 60 * 60 * 24))
          if (totalDaysElapsed >= inv.package.durationDays) {
            // Investment period complete - release capital + last profit
            await prisma.investment.update({
              where: { id: inv.id },
              data: {
                totalProfit: { increment: profitAmount },
                releasedAmount: { increment: profitAmount },
                monthsElapsed: { increment: daysToProcess },
                lastProfitDate: new Date(),
                status: 'COMPLETED',
                endDate: new Date(),
              },
            })

            // Return the investment amount to user balance
            await prisma.user.update({
              where: { id: inv.userId },
              data: {
                balance: { increment: profitAmount + inv.amount },
                totalProfit: { increment: profitAmount },
              },
            })

            await prisma.transaction.create({
              data: {
                userId: inv.userId,
                type: 'PROFIT',
                amount: profitAmount,
                status: 'COMPLETED',
                description: `أرباح يومية نهائية - ${inv.package.name} (${daysToProcess} يوم) + إعادة رأس المال ${inv.amount} USDT`,
              }
            })
          } else {
            // Investment still active - release daily profit only
            await prisma.investment.update({
              where: { id: inv.id },
              data: {
                totalProfit: { increment: profitAmount },
                releasedAmount: { increment: profitAmount },
                monthsElapsed: { increment: daysToProcess },
                lastProfitDate: new Date(),
              },
            })

            await prisma.user.update({
              where: { id: inv.userId },
              data: {
                balance: { increment: profitAmount },
                totalProfit: { increment: profitAmount },
              },
            })

            await prisma.transaction.create({
              data: {
                userId: inv.userId,
                type: 'PROFIT',
                amount: profitAmount,
                status: 'COMPLETED',
                description: `أرباح يومية - ${inv.package.name} (${daysToProcess} يوم) - ${inv.package.monthlyReturn}% يومياً`,
              }
            })
          }

          processed++
        }
      }

      return NextResponse.json({ message: `تم معالجة أرباح ${processed} استثمار يومياً`, processed })
    }

    if (action === 'checkBinanceConnection') {
      const result = await verifyBinanceConnection()
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
  } catch (error) {
    console.error('Admin POST error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
