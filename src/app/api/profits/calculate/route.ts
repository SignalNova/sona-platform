import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getUser } from '@/lib/auth'

/**
 * POST /api/profits/calculate
 * Calculate daily profits for all active investments.
 * Can be called by any authenticated user, admin, or cron.
 * Uses package monthlyReturn as the daily profit rate.
 */
export async function POST(request: NextRequest) {
  try {
    // Allow any authenticated user or admin or cron
    const admin = await requireAdmin()
    const authUser = await getUser()
    const authHeader = request.headers.get('authorization')
    // SECURITY FIX: CRON_SECRET is MANDATORY - no insecure fallback
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[SECURITY] CRON_SECRET not set! Rejecting request.')
    }
    const isCron = cronSecret ? authHeader === `Bearer ${cronSecret}` : false

    if (!admin && !authUser && !isCron) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const results = {
      profitsCredited: 0,
      totalProfit: 0,
    }

    // Get all active investments
    // NOTE: TRADING mode investments (SONA) are now included in profit calculation
    // because trading P&L is handled separately by the positions/close endpoint.
    // The daily profit here represents the base package return rate.
    const activeInvestments = await db.investment.findMany({
      where: { status: 'ACTIVE' },
      include: { package: true, user: true },
    })

    for (const investment of activeInvestments) {
      try {
        const lastDaily = investment.lastDailyProfitDate
          ? new Date(
              investment.lastDailyProfitDate.getFullYear(),
              investment.lastDailyProfitDate.getMonth(),
              investment.lastDailyProfitDate.getDate()
            )
          : null

        // Skip if already credited today
        if (lastDaily && lastDaily.getTime() >= today.getTime()) {
          continue
        }

        // FIX: monthlyReturn is the MONTHLY percentage rate
        // Daily rate = monthlyReturn / 30
        const dailyProfit = investment.amount * (investment.package.monthlyReturn / 100 / 30)

        await db.$transaction(async (tx) => {
          // Add profit to investment's nonWithdrawableProfit (becomes withdrawable after weekly transfer)
          await tx.investment.update({
            where: { id: investment.id },
            data: {
              nonWithdrawableProfit: { increment: dailyProfit },
              lastDailyProfitDate: now,
              totalProfit: { increment: dailyProfit },
            },
          })

          // Add profit to user's balance AND nonWithdrawableProfit
          // Balance includes all funds; withdrawableBalance only includes funds available for withdrawal
          // The weekly transfer cron moves from nonWithdrawableProfit to withdrawableBalance
          await tx.user.update({
            where: { id: investment.userId },
            data: {
              nonWithdrawableProfit: { increment: dailyProfit },
              totalProfit: { increment: dailyProfit },
            },
          })

          // Create PROFIT transaction
          await tx.transaction.create({
            data: {
              userId: investment.userId,
              type: 'PROFIT',
              amount: dailyProfit,
              status: 'COMPLETED',
              method: 'daily_profit',
              description: `أرباح يومية من باقة ${investment.package.name}`,
              reference: investment.id,
            },
          })
        })

        // Create notification
        await createNotification({
          userId: investment.userId,
          title: 'أرباح يومية',
          message: `تم إضافة أرباح اليوم ${(dailyProfit ?? 0).toFixed(2)} USDT إلى رصيدك القابل للسحب`,
          type: 'PROFIT',
          data: { amount: dailyProfit, investmentId: investment.id },
        })

        results.profitsCredited++
        results.totalProfit += dailyProfit

        console.log(`[PROFIT] Investment ${investment.id}: User ${investment.userId} daily profit ${(dailyProfit ?? 0).toFixed(2)} USDT`)
      } catch (err) {
        console.error(`[PROFIT] Error processing investment ${investment.id}:`, err)
      }
    }

    console.log(`[PROFIT] Summary: profits credited=${results.profitsCredited}, total profit=${(results.totalProfit ?? 0).toFixed(2)} USDT`)

    return NextResponse.json({
      message: 'تم حساب الأرباح بنجاح',
      results,
    }, { status: 200 })
  } catch (error) {
    console.error('Calculate profits error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حساب الأرباح' },
      { status: 500 }
    )
  }
}
