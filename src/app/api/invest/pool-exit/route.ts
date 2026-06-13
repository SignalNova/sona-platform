import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { getUser, getAuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/invest/pool-exit
 * Allow SONA mode investors to exit the pool.
 * Calculates share value based on current pool performance.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Always derive userId from authenticated token, never from request body
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    const userId = String(authUser.id)

    const body = await request.json()
    const { investmentId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Find user's SONA investments
    const whereClause: { userId: string; mode: string; status: string; id?: string } = {
      userId,
      mode: 'SONA',
      status: 'ACTIVE',
    }

    if (investmentId) {
      whereClause.id = investmentId
    }

    const sonaInvestments = await db.investment.findMany({
      where: whereClause,
      include: { package: true },
    })

    if (sonaInvestments.length === 0) {
      return NextResponse.json(
        { error: 'لا توجد استثمارات SONA نشطة' },
        { status: 404 }
      )
    }

    // Get active pool
    const pool = await db.pool.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!pool) {
      return NextResponse.json(
        { error: 'لا يوجد مجمع نشط' },
        { status: 404 }
      )
    }

    const results: Array<{
      investmentId: string
      originalAmount: number
      shareValue: number
      profit: number
      loss: number
    }> = []

    for (const investment of sonaInvestments) {
      try {
        // Find the pool contribution for this investment
        const contribution = await db.poolContribution.findFirst({
          where: {
            investmentId: investment.id,
            poolId: pool.id,
            status: 'ACTIVE',
          },
        })

        if (!contribution) {
          continue
        }

        // Calculate share value based on current pool performance
        // shareValue = contribution.amount + (pool.netPerformance * contribution.sharePercent / 100)
        const poolNetPerformance = pool.totalProfit - pool.totalLoss
        const shareValue = contribution.amount + (poolNetPerformance * contribution.sharePercent / 100)
        const profit = Math.max(0, shareValue - contribution.amount)
        const loss = Math.max(0, contribution.amount - shareValue)

        await db.$transaction(async (tx) => {
          // Mark PoolContribution as WITHDRAWN
          await tx.poolContribution.update({
            where: { id: contribution.id },
            data: { status: 'WITHDRAWN' },
          })

          // Update Pool.totalFunds
          await tx.pool.update({
            where: { id: pool.id },
            data: {
              totalFunds: { decrement: contribution.amount },
            },
          })

          // Transfer value to both balance and withdrawableBalance (keep in sync)
          // SECURITY FIX: Use Math.min for lockedCapital to prevent going below 0
          // This can happen with reinvested amounts where investment.amount includes bonus
          const lockedCapitalToDecrement = Math.min(investment.amount, (await tx.user.findUnique({ where: { id: userId } }))?.lockedCapital || 0)

          await tx.user.update({
            where: { id: userId },
            data: {
              balance: { increment: shareValue },
              withdrawableBalance: { increment: shareValue },
              lockedCapital: { decrement: lockedCapitalToDecrement },
            },
          })

          // Mark investment as COMPLETED
          await tx.investment.update({
            where: { id: investment.id },
            data: {
              status: 'COMPLETED',
              endDate: new Date(),
              withdrawableProfit: { increment: profit },
              totalProfit: profit > 0 ? { increment: profit } : undefined,
            },
          })

          // Create transaction
          await tx.transaction.create({
            data: {
              userId,
              type: 'POOL_EXIT',
              amount: shareValue,
              status: 'COMPLETED',
              method: 'sona_pool_exit',
              description: `خروج من مجمع SONA - باقة ${investment.package.name}. القيمة: ${(shareValue ?? 0).toFixed(2)} USDT (ربح: ${(profit ?? 0).toFixed(2)} USDT, خسارة: ${(loss ?? 0).toFixed(2)} USDT)`,
              reference: investment.id,
              details: JSON.stringify({
                originalAmount: contribution.amount,
                shareValue,
                profit,
                loss,
                sharePercent: contribution.sharePercent,
              }),
            },
          })
        })

        // Create notification
        await createNotification({
          userId,
          title: 'خروج من مجمع SONA',
          message: profit > 0
            ? `تم خروجك من مجمع SONA بنجاح. قيمة حصتك: ${(shareValue ?? 0).toFixed(2)} USDT (ربح: ${(profit ?? 0).toFixed(2)} USDT). تم تحويل المبلغ إلى رصيدك القابل للسحب.`
            : `تم خروجك من مجمع SONA. قيمة حصتك: ${(shareValue ?? 0).toFixed(2)} USDT (خسارة: ${(loss ?? 0).toFixed(2)} USDT). تم تحويل المبلغ إلى رصيدك القابل للسحب.`,
          type: profit > 0 ? 'PROFIT' : 'WARNING',
          data: { investmentId: investment.id, shareValue, profit, loss },
        })

        results.push({
          investmentId: investment.id,
          originalAmount: contribution.amount,
          shareValue,
          profit,
          loss,
        })
      } catch (err) {
        console.error(`[POOL-EXIT] Error exiting investment ${investment.id}:`, err)
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'لم يتم العثور على مساهمات نشطة في المجمع' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `تم الخروج من ${results.length} استثمار SONA بنجاح`,
      results,
      totalShareValue: results.reduce((sum, r) => sum + r.shareValue, 0),
    }, { status: 200 })
  } catch (error) {
    console.error('Pool exit error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الخروج من المجمع' },
      { status: 500 }
    )
  }
}
