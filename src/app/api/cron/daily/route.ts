import { db } from '@/lib/db'
import { createNotification, notifyDailyMotivation, notifyMilestone, notifyAccountCreatedReminder, notifyWelcomeBack } from '@/lib/notifications'
import { sendReEngagementEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

// Safety cap: Maximum daily return percentage to prevent financial exploitation
const MAX_DAILY_RETURN_PERCENT = 20

/**
 * POST /api/cron/daily
 * Run all daily tasks:
 * 1. Process daily profits (SONA)
 * 2. Process weekly transfers
 * 3. Send inactive user notifications
 * 4. Send motivational notifications
 * 5. Check and process withdrawal status updates
 */
export async function POST(request: NextRequest) {
  try {
    // Allow admin or internal cron call
    const admin = await requireAdmin()
    const authHeader = request.headers.get('authorization')
    // SECURITY: CRON_SECRET is MANDATORY - no fallback allowed
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[FATAL SECURITY] CRON_SECRET is not set!')
      return NextResponse.json({ error: 'إعدادات الأمان غير مكتملة' }, { status: 500 })
    }
    const isCron = authHeader === `Bearer ${cronSecret}`

    if (!admin && !isCron) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const now = new Date()
    const results: Record<string, unknown> = {}

    // =====================================================
    // 1. Process daily profits (SONA)
    // =====================================================
    try {
      const settings = await db.platformSetting.findMany()
      const settingsMap = new Map(settings.map((s) => [s.key, s.value]))
      const platformCommissionPercent = parseFloat(settingsMap.get('platform_commission_percent') || '1')
      const weeklyTransferDay = parseInt(settingsMap.get('weekly_transfer_day') || '7', 10)

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const profitResults = {
        dailyProfits: { profitsCredited: 0, weeklyTransfers: 0, totalProfit: 0, totalTransferred: 0 },
        sona: { tradesProcessed: 0, totalProfit: 0, totalLoss: 0, totalCommission: 0 },
      }

      // --- Daily Profit Calculation ---
      // IMPORTANT: Skip TRADING mode investments - they are containers for manual
      // trading positions only and should NOT receive daily profit credits.
      // Daily profits are only for SONA (package investment) mode.
      const activeInvestments = await db.investment.findMany({
        where: { status: 'ACTIVE', mode: { not: 'TRADING' } },
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

          if (lastDaily && lastDaily.getTime() >= today.getTime()) {
            continue
          }

          let dailyProfit = investment.amount * (investment.package.monthlyReturn / 100)

          // Safety cap: Ensure daily profit doesn't exceed the maximum allowed percentage
          const maxDailyProfit = investment.amount * (MAX_DAILY_RETURN_PERCENT / 100)
          if (dailyProfit > maxDailyProfit) {
            console.warn(`[CRON] Investment ${investment.id}: Daily profit ${(dailyProfit ?? 0).toFixed(2)} USDT exceeds ${MAX_DAILY_RETURN_PERCENT}% cap, capping to ${(maxDailyProfit ?? 0).toFixed(2)} USDT`)
            dailyProfit = maxDailyProfit
          }

          // Check if investment duration has ended - release capital
          const startDate = new Date(investment.startDate)
          const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const isDurationEnded = daysElapsed >= investment.package.durationDays

          await db.$transaction(async (tx) => {
            if (isDurationEnded && investment.status === 'ACTIVE') {
              // Duration ended: release capital + remaining profits
              await tx.investment.update({
                where: { id: investment.id },
                data: {
                  status: 'COMPLETED',
                  endDate: now,
                  withdrawableProfit: { increment: investment.nonWithdrawableProfit + dailyProfit },
                  nonWithdrawableProfit: 0,
                  lastDailyProfitDate: now,
                  totalProfit: { increment: dailyProfit },
                },
              })

              // Release locked capital back to user balance
              await tx.user.update({
                where: { id: investment.userId },
                data: {
                  withdrawableBalance: { increment: investment.nonWithdrawableProfit + dailyProfit },
                  nonWithdrawableProfit: { decrement: investment.nonWithdrawableProfit },
                  totalProfit: { increment: dailyProfit },
                  lockedCapital: { decrement: investment.amount },
                  balance: { increment: investment.amount },
                },
              })

              await tx.transaction.create({
                data: {
                  userId: investment.userId,
                  type: 'PROFIT',
                  amount: dailyProfit,
                  status: 'COMPLETED',
                  method: 'sona_daily',
                  description: `أرباح يومية أخيرة من باقة ${investment.package.name} (اكتملت المدة)`,
                  reference: investment.id,
                },
              })

              await tx.transaction.create({
                data: {
                  userId: investment.userId,
                  type: 'CAPITAL_RELEASE',
                  amount: investment.amount,
                  status: 'COMPLETED',
                  method: 'capital_unlock',
                  description: `تحرير رأس المال من باقة ${investment.package.name} (انتهت المدة)`,
                  reference: investment.id,
                },
              })

              // Mark trading session as completed
              try {
                await tx.tradingSession.updateMany({
                  where: { investmentId: investment.id, status: 'ACTIVE' },
                  data: { status: 'COMPLETED' },
                })
              } catch (e) {
                // Non-critical: trading session update failed
              }
            } else {
              // Active investment: credit daily profit to BOTH balance AND withdrawable balance
              await tx.investment.update({
                where: { id: investment.id },
                data: {
                  withdrawableProfit: { increment: dailyProfit },
                  lastDailyProfitDate: now,
                  totalProfit: { increment: dailyProfit },
                },
              })

              // FIXED: Credit daily profit to BOTH balance AND withdrawableBalance
              // This ensures withdrawableBalance never exceeds balance
              await tx.user.update({
                where: { id: investment.userId },
                data: {
                  balance: { increment: dailyProfit },
                  withdrawableBalance: { increment: dailyProfit },
                  totalProfit: { increment: dailyProfit },
                },
              })

              await tx.transaction.create({
                data: {
                  userId: investment.userId,
                  type: 'PROFIT',
                  amount: dailyProfit,
                  status: 'COMPLETED',
                  method: 'sona_daily',
                  description: `أرباح يومية من باقة ${investment.package.name} (قابلة للسحب فوراً)`,
                  reference: investment.id,
                },
              })
            }
          })

          await createNotification({
            userId: investment.userId,
            title: 'أرباح يومية',
            message: `تم إضافة أرباح اليوم ${(dailyProfit ?? 0).toFixed(2)} USDT إلى رصيد أرباحك`,
            type: 'PROFIT',
            data: { amount: dailyProfit, investmentId: investment.id, mode: 'SONA' },
          })

          profitResults.dailyProfits.profitsCredited++
          profitResults.dailyProfits.totalProfit += dailyProfit

          // Weekly transfer check
          const lastWeekly = investment.lastWeeklyTransfer
            ? new Date(investment.lastWeeklyTransfer)
            : investment.startDate
          const daysSinceLastTransfer = Math.floor(
            (now.getTime() - new Date(lastWeekly).getTime()) / (1000 * 60 * 60 * 24)
          )

          if (daysSinceLastTransfer >= weeklyTransferDay && investment.nonWithdrawableProfit + dailyProfit > 0) {
            const transferAmount = investment.nonWithdrawableProfit + dailyProfit

            await db.$transaction(async (tx) => {
              await tx.investment.update({
                where: { id: investment.id },
                data: {
                  withdrawableProfit: { increment: transferAmount },
                  nonWithdrawableProfit: 0,
                  lastWeeklyTransfer: now,
                },
              })

              // FIXED: Weekly transfer should also add to balance
              // to keep withdrawableBalance <= balance
              await tx.user.update({
                where: { id: investment.userId },
                data: {
                  balance: { increment: transferAmount },
                  withdrawableBalance: { increment: transferAmount },
                  nonWithdrawableProfit: { decrement: transferAmount },
                },
              })

              await tx.transaction.create({
                data: {
                  userId: investment.userId,
                  type: 'WEEKLY_TRANSFER',
                  amount: transferAmount,
                  status: 'COMPLETED',
                  method: 'sona_weekly',
                  description: `تحويل أرباح أسبوعية (${(transferAmount ?? 0).toFixed(2)} USDT) إلى الرصيد القابل للسحب`,
                  reference: investment.id,
                },
              })
            })

            await createNotification({
              userId: investment.userId,
              title: 'تحويل أرباح أسبوعية',
              message: `تم تحويل أرباح الأسبوع (${(transferAmount ?? 0).toFixed(2)} USDT) إلى رصيدك القابل للسحب`,
              type: 'PROFIT',
              data: { amount: transferAmount, investmentId: investment.id, mode: 'SONA' },
            })

            profitResults.dailyProfits.weeklyTransfers++
            profitResults.dailyProfits.totalTransferred += transferAmount
          }
        } catch (err) {
          console.error(`[CRON] Error processing investment ${investment.id}:`, err)
        }
      }

      // --- SONA Pool Trading ---
      let pool = await db.pool.findFirst({ where: { status: 'ACTIVE' } })
      if (!pool) {
        pool = await db.pool.create({
          data: { status: 'ACTIVE', totalFunds: 0, totalProfit: 0, totalLoss: 0, platformCommission: 0, activeTrades: 0 },
        })
      }

      const activeSignals = await db.signalRecord.findMany({
        where: { status: 'ACTIVE', confidence: { gte: 70 }, type: { in: ['LONG', 'SHORT'] } },
        orderBy: { confidence: 'desc' },
      })

      for (const signal of activeSignals) {
        try {
          const existingTrade = await db.poolTrade.findFirst({
            where: { signalId: signal.id, status: 'OPEN' },
          })
          if (existingTrade) continue

          const contributions = await db.poolContribution.findMany({
            where: { poolId: pool.id, status: 'ACTIVE' },
          })
          if (contributions.length === 0) continue

          const tradeDirection = signal.type
          const tradeAmount = pool.totalFunds * 0.1
          if (tradeAmount <= 0) continue

          const winProbability = signal.confidence / 100
          const isWin = Math.random() < winProbability
          const priceMovePercent = (Math.random() * 3 + 0.5) / 100
          const tradeProfitLoss = isWin
            ? tradeAmount * priceMovePercent
            : -tradeAmount * priceMovePercent * 0.5
          const commission = tradeProfitLoss > 0 ? tradeProfitLoss * (platformCommissionPercent / 100) : 0
          const netProfitLoss = tradeProfitLoss - commission

          await db.$transaction(async (tx) => {
            const newTrade = await tx.poolTrade.create({
              data: {
                poolId: pool!.id, symbol: signal.symbol, direction: tradeDirection,
                entryPrice: signal.entryPrice, exitPrice: signal.targetPrice,
                amount: tradeAmount, profitLoss: netProfitLoss, commission,
                signalId: signal.id, status: 'CLOSED', openedAt: now, closedAt: now,
              },
            })

            await tx.pool.update({
              where: { id: pool!.id },
              data: {
                totalFunds: { increment: netProfitLoss },
                totalProfit: netProfitLoss > 0 ? { increment: netProfitLoss } : undefined,
                totalLoss: netProfitLoss < 0 ? { increment: Math.abs(netProfitLoss) } : undefined,
                platformCommission: { increment: commission },
                lastTradeDate: now,
              },
            })

            await tx.signalRecord.update({
              where: { id: signal.id },
              data: { status: 'CLOSED', closedAt: now, result: isWin ? 'WIN' : 'LOSS' },
            })

            for (const contribution of contributions) {
              const sharePercent = contribution.sharePercent / 100
              const userShare = netProfitLoss * sharePercent

              if (userShare > 0) {
                await tx.investment.update({
                  where: { id: contribution.investmentId },
                  data: { withdrawableProfit: { increment: userShare }, totalProfit: { increment: userShare } },
                })
                // FIXED: Pool profits should also add to balance
                await tx.user.update({
                  where: { id: contribution.userId },
                  data: { balance: { increment: userShare }, withdrawableBalance: { increment: userShare }, totalProfit: { increment: userShare } },
                })
                await tx.poolContribution.update({
                  where: { id: contribution.id },
                  data: { profitShare: { increment: userShare } },
                })
              } else {
                await tx.investment.update({
                  where: { id: contribution.investmentId },
                  data: { nonWithdrawableProfit: { decrement: Math.abs(userShare) }, totalProfit: { increment: userShare } },
                })
                await tx.user.update({
                  where: { id: contribution.userId },
                  data: { nonWithdrawableProfit: { decrement: Math.abs(userShare) }, totalProfit: { increment: userShare } },
                })
                await tx.poolContribution.update({
                  where: { id: contribution.id },
                  data: { lossShare: { increment: Math.abs(userShare) } },
                })
              }

              await tx.transaction.create({
                data: {
                  userId: contribution.userId,
                  type: userShare > 0 ? 'PROFIT' : 'LOSS',
                  amount: Math.abs(userShare),
                  status: 'COMPLETED',
                  method: 'sona_pool_trade',
                  description: `${isWin ? 'ربح' : 'خسارة'} من تداول SONA على ${signal.symbol} (${tradeDirection})`,
                  reference: newTrade.id,
                },
              })
            }
          })

          for (const contribution of contributions) {
            const sharePercent = contribution.sharePercent / 100
            const userShare = netProfitLoss * sharePercent
            await createNotification({
              userId: contribution.userId,
              title: isWin ? 'ربح من تداول SONA' : 'خسارة من تداول SONA',
              message: isWin
                ? `تم تحقيق ربح ${(userShare ?? 0).toFixed(2)} USDT من تداول ${signal.symbol} (${tradeDirection})`
                : `تم تسجيل خسارة ${(Math.abs(userShare) ?? 0).toFixed(2)} USDT من تداول ${signal.symbol} (${tradeDirection})`,
              type: isWin ? 'PROFIT' : 'WARNING',
              data: { symbol: signal.symbol, direction: tradeDirection, amount: userShare },
            })
          }

          profitResults.sona.tradesProcessed++
          if (netProfitLoss > 0) profitResults.sona.totalProfit += netProfitLoss
          else profitResults.sona.totalLoss += Math.abs(netProfitLoss)
          profitResults.sona.totalCommission += commission
        } catch (err) {
          console.error(`[CRON-SONA] Error processing signal ${signal.id}:`, err)
        }
      }

      results.profits = profitResults
    } catch (err) {
      console.error('[CRON] Error processing daily profits:', err)
      results.profits = { error: 'Failed to process daily profits' }
    }

    // =====================================================
    // 2. Process weekly transfers (already handled above)
    // =====================================================
    results.weeklyTransfers = 'Integrated with profit calculation'

    // =====================================================
    // 3. Send inactive user notifications
    // =====================================================
    try {
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const inactiveUsers = await db.user.findMany({
        where: {
          isActive: true,
          withdrawableBalance: { gt: 0 },
          transactions: {
            none: {
              createdAt: { gte: sevenDaysAgo },
            },
          },
        },
        select: { id: true, name: true, withdrawableBalance: true, email: true },
      })

      let inactiveNotified = 0
      for (const user of inactiveUsers) {
        const recentNotification = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'INACTIVITY_REMINDER',
            createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
          },
        })

        if (!recentNotification) {
          await createNotification({
            userId: user.id,
            title: 'رصيدك القابل للسحب ينتظرك!',
            message: `لديك رصيد قابل للسحب بقيمة ${(user.withdrawableBalance ?? 0).toFixed(2)} USDT. يمكنك سحبه أو إعادة استثماره مع مكافأة 5% إضافية!`,
            type: 'INACTIVITY_REMINDER',
            data: { withdrawableBalance: user.withdrawableBalance },
          })
          inactiveNotified++
        }
      }

      results.inactiveUsersNotified = inactiveNotified
    } catch (err) {
      console.error('[CRON] Error sending inactive user notifications:', err)
      results.inactiveUsersNotified = { error: 'Failed' }
    }

    // =====================================================
    // Enhanced inactive user handling
    // =====================================================
    try {
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const sevenDaysAgoForInactive = new Date(now)
      sevenDaysAgoForInactive.setDate(sevenDaysAgoForInactive.getDate() - 7)

      // Users inactive 7+ days: Send in-app notification + email
      const usersInactive7Days = await db.user.findMany({
        where: {
          isActive: true,
          emailVerified: true,
          updatedAt: { lt: sevenDaysAgoForInactive },
        },
        select: { id: true, name: true, email: true, withdrawableBalance: true, updatedAt: true },
      })

      let reEngaged7Days = 0
      for (const user of usersInactive7Days) {
        // Check if already sent a welcome back notification recently
        const recentWelcomeBack = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'PLATFORM',
            data: { contains: 'welcome_back' },
            createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
        })

        if (!recentWelcomeBack) {
          const daysAbsent = Math.floor((now.getTime() - new Date(user.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
          await notifyWelcomeBack(user.id, user.name, daysAbsent)

          // Send re-engagement email if function is available
          try {
            if (sendReEngagementEmail) {
              await sendReEngagementEmail(user.email, user.name, daysAbsent, user.withdrawableBalance)
            }
          } catch (emailErr) {
            console.error(`[CRON] Failed to send re-engagement email to ${user.email}:`, emailErr)
          }

          reEngaged7Days++
        }
      }

      // Users inactive 30+ days: Send email only
      const usersInactive30Days = await db.user.findMany({
        where: {
          isActive: true,
          emailVerified: true,
          updatedAt: { lt: thirtyDaysAgo },
        },
        select: { id: true, name: true, email: true, withdrawableBalance: true, updatedAt: true },
      })

      let reEngaged30Days = 0
      for (const user of usersInactive30Days) {
        // Check if already sent a re-engagement email recently (14 days)
        const recentEmailNotification = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'PLATFORM',
            data: { contains: 'welcome_back' },
            createdAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
          },
        })

        if (!recentEmailNotification) {
          const daysAbsent = Math.floor((now.getTime() - new Date(user.updatedAt).getTime()) / (1000 * 60 * 60 * 24))

          // Email only for 30+ days inactive
          try {
            if (sendReEngagementEmail) {
              await sendReEngagementEmail(user.email, user.name, daysAbsent, user.withdrawableBalance)
            }
          } catch (emailErr) {
            console.error(`[CRON] Failed to send re-engagement email to ${user.email}:`, emailErr)
          }

          reEngaged30Days++
        }
      }

      // Users who registered but never verified (24h+ after registration)
      const twentyFourHoursAgo = new Date(now)
      twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1)

      const unverifiedUsers = await db.user.findMany({
        where: {
          emailVerified: false,
          createdAt: { lt: twentyFourHoursAgo },
          isActive: true,
        },
        select: { id: true, name: true, email: true, createdAt: true },
      })

      let verificationReminders = 0
      for (const user of unverifiedUsers) {
        // Check if already sent a verification reminder recently
        const recentVerifyReminder = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'PLATFORM',
            data: { contains: 'verify_reminder' },
            createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
          },
        })

        if (!recentVerifyReminder) {
          await notifyAccountCreatedReminder(user.id, user.name, user.email)
          verificationReminders++
        }
      }

      results.enhancedInactiveHandling = {
        reEngaged7Days,
        reEngaged30Days,
        verificationReminders,
      }
    } catch (err) {
      console.error('[CRON] Error in enhanced inactive user handling:', err)
      results.enhancedInactiveHandling = { error: 'Failed' }
    }

    // =====================================================
    // 4. Send motivational notifications
    // =====================================================
    try {
      const packages = await db.package.findMany({
        where: { isActive: true },
        orderBy: { minAmount: 'asc' },
      })

      let motivationalNotified = 0
      for (const pkg of packages) {
        const threshold = pkg.minAmount * 0.8
        const usersNearTier = await db.user.findMany({
          where: { isActive: true, lockedCapital: { gte: threshold, lt: pkg.minAmount } },
          select: { id: true, name: true, lockedCapital: true },
        })

        for (const user of usersNearTier) {
          const recentNotification = await db.notification.findFirst({
            where: {
              userId: user.id,
              type: 'MOTIVATIONAL',
              createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            },
          })

          if (!recentNotification) {
            const remaining = pkg.minAmount - user.lockedCapital
            await createNotification({
              userId: user.id,
              title: 'أنت قريب من الباقة التالية!',
              message: `أنت على بعد ${(remaining ?? 0).toFixed(2)} USDT فقط من الوصول لباقة ${pkg.name}! أضف استثماراً جديداً للاستفادة من عوائد أعلى.`,
              type: 'MOTIVATIONAL',
              data: { packageName: pkg.name, remaining, currentCapital: user.lockedCapital },
            })
            motivationalNotified++
          }
        }
      }

      results.motivationalNotified = motivationalNotified
    } catch (err) {
      console.error('[CRON] Error sending motivational notifications:', err)
      results.motivationalNotified = { error: 'Failed' }
    }

    // =====================================================
    // 5. Check and process withdrawal status updates
    // =====================================================
    try {
      const pendingWithdrawals = await db.transaction.findMany({
        where: { type: 'WITHDRAWAL', status: 'PENDING' },
      })

      let autoProcessed = 0
      for (const withdrawal of pendingWithdrawals) {
        let processingHours = 24
        try {
          const details = JSON.parse(withdrawal.details || '{}')
          if (details.processingTime) {
            const match = details.processingTime.match(/(\d+)-(\d+)/)
            if (match) {
              processingHours = parseInt(match[2], 10)
            }
          }
        } catch {
          // Use default
        }

        const hoursSinceCreation = (now.getTime() - new Date(withdrawal.createdAt).getTime()) / (1000 * 60 * 60)

        if (hoursSinceCreation > processingHours * 0.5 && withdrawal.status === 'PENDING') {
          await db.transaction.update({
            where: { id: withdrawal.id },
            data: { status: 'PROCESSING' },
          })
          autoProcessed++
        }
      }

      results.withdrawalsAutoProcessed = autoProcessed
    } catch (err) {
      console.error('[CRON] Error processing withdrawal status updates:', err)
      results.withdrawalsAutoProcessed = { error: 'Failed' }
    }

    // =====================================================
    // 6. Process Investment Bot Trades
    // =====================================================
    try {
      // Get bot control settings
      let botControl = await db.botControl.findFirst()
      if (!botControl) {
        botControl = await db.botControl.create({
          data: { isActive: true, tradesPerMinute: 2.0, winRate: 0.72, maxTradeAmount: 500, minTradeAmount: 10, volatilityFactor: 1.0, symbols: 'BTC/USDT,ETH/USDT' }
        })
      }

      if (botControl.isActive) {
        // Get all active trading sessions
        const activeSessions = await db.tradingSession.findMany({
          where: { status: 'ACTIVE' },
          include: { investment: { include: { package: true } }, trades: { where: { status: 'OPEN' } } }
        })

        let botTradesProcessed = 0
        let botProfit = 0
        let botLoss = 0
        let profitThreshold = 0

        for (const session of activeSessions) {
          // Only process if no open trades
          if (session.trades.length > 0) continue

          // Daily return calculation
          // If daily return < 50% of 100 = LOSS, if > 50% = PROFIT
          const investmentAmount = session.investment.amount
          const dailyReturnTarget = investmentAmount * (session.investment.package.monthlyReturn / 100) / 30
          profitThreshold = dailyReturnTarget * 0.5 // 50% threshold

          // Determine trade outcome based on bot win rate
          const isWin = Math.random() < botControl.winRate

          // Generate trade
          const symbols = botControl.symbols.split(',')
          const symbol = symbols[Math.floor(Math.random() * symbols.length)] || 'BTC/USDT'
          const tradeAmount = Math.min(
            Math.max(botControl.minTradeAmount, investmentAmount * 0.05),
            botControl.maxTradeAmount
          )

          const priceMovePercent = (Math.random() * 2 + 0.3) / 100 * botControl.volatilityFactor
          const entryPrice = session.currentPrice || session.startPrice
          const exitPrice = isWin
            ? entryPrice * (1 + priceMovePercent)
            : entryPrice * (1 - priceMovePercent * 0.6) // Losses smaller than wins

          const profitLoss = isWin ? tradeAmount * priceMovePercent : -tradeAmount * priceMovePercent * 0.6

          await db.$transaction(async (tx) => {
            await tx.botTrade.create({
              data: {
                sessionId: session.id,
                type: isWin ? 'BUY' : 'SELL',
                symbol,
                entryPrice,
                exitPrice,
                amount: tradeAmount,
                profitLoss,
                status: 'CLOSED',
                confidence: botControl.winRate * 100,
                openedAt: now,
                closedAt: now,
              }
            })

            await tx.tradingSession.update({
              where: { id: session.id },
              data: {
                totalProfit: { increment: profitLoss },
                totalTrades: { increment: 1 },
                winTrades: isWin ? { increment: 1 } : undefined,
                lossTrades: isWin ? undefined : { increment: 1 },
                currentPrice: exitPrice,
              }
            })
          })

          if (isWin) botProfit += profitLoss
          else botLoss += Math.abs(profitLoss)
          botTradesProcessed++
        }

        // Determine overall daily status based on profit threshold
        const dailyBotProfit = botProfit - botLoss
        const isDailyProfit = dailyBotProfit >= profitThreshold

        results.investmentBot = {
          tradesProcessed: botTradesProcessed,
          profit: botProfit,
          loss: botLoss,
          netProfit: dailyBotProfit,
          dailyStatus: isDailyProfit ? 'PROFIT' : 'LOSS',
          profitThreshold,
        }
      } else {
        results.investmentBot = { status: 'PAUSED', tradesProcessed: 0 }
      }
    } catch (err) {
      console.error('[CRON] Error processing investment bot trades:', err)
      results.investmentBot = { error: 'Failed' }
    }

    // =====================================================
    // 7. Send daily motivational notifications
    // =====================================================
    try {
      const sevenDaysAgoForActive = new Date(now)
      sevenDaysAgoForActive.setDate(sevenDaysAgoForActive.getDate() - 7)
      const threeDaysAgoForMotivation = new Date(now)
      threeDaysAgoForMotivation.setDate(threeDaysAgoForMotivation.getDate() - 3)

      // Get active users (updated in last 7 days)
      const activeUsers = await db.user.findMany({
        where: {
          isActive: true,
          emailVerified: true,
          updatedAt: { gte: sevenDaysAgoForActive },
        },
        select: {
          id: true,
          name: true,
          totalProfit: true,
          investments: {
            where: { status: 'ACTIVE' },
            select: { id: true },
          },
        },
      })

      let dailyMotivationalSent = 0
      for (const user of activeUsers) {
        // Check last MOTIVATIONAL notification - max 1 per user per 3 days
        const recentMotivational = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'MOTIVATIONAL',
            createdAt: { gte: threeDaysAgoForMotivation },
          },
        })

        if (!recentMotivational) {
          await notifyDailyMotivation(
            user.id,
            user.name,
            user.totalProfit,
            user.investments.length
          )
          dailyMotivationalSent++
        }
      }

      results.dailyMotivationalSent = dailyMotivationalSent
    } catch (err) {
      console.error('[CRON] Error sending daily motivational notifications:', err)
      results.dailyMotivationalSent = { error: 'Failed' }
    }

    // =====================================================
    // 8. Check and notify milestones
    // =====================================================
    try {
      const profitMilestones = [
        { milestone: 'profit_100', threshold: 100 },
        { milestone: 'profit_500', threshold: 500 },
        { milestone: 'profit_1000', threshold: 1000 },
        { milestone: 'profit_5000', threshold: 5000 },
        { milestone: 'profit_10000', threshold: 10000 },
      ]

      let milestonesNotified = 0

      // Check profit milestones
      for (const { milestone, threshold } of profitMilestones) {
        // Find users who crossed this profit threshold
        const usersAboveThreshold = await db.user.findMany({
          where: {
            isActive: true,
            totalProfit: { gte: threshold },
          },
          select: { id: true, name: true, totalProfit: true },
        })

        for (const user of usersAboveThreshold) {
          // Check if we already sent this specific milestone notification
          const existingMilestone = await db.notification.findFirst({
            where: {
              userId: user.id,
              type: 'MILESTONE',
              data: { contains: milestone },
            },
          })

          if (!existingMilestone) {
            await notifyMilestone(user.id, milestone, user.totalProfit)
            milestonesNotified++
          }
        }
      }

      // Check first investment milestone
      const usersWithFirstInvestment = await db.user.findMany({
        where: {
          isActive: true,
          investments: { some: { status: { in: ['ACTIVE', 'COMPLETED'] } } },
        },
        select: { id: true, name: true },
      })

      for (const user of usersWithFirstInvestment) {
        const existingMilestone = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'MILESTONE',
            data: { contains: 'first_investment' },
          },
        })

        if (!existingMilestone) {
          await notifyMilestone(user.id, 'first_investment', 0)
          milestonesNotified++
        }
      }

      // Check first profit milestone
      const usersWithProfit = await db.user.findMany({
        where: {
          isActive: true,
          totalProfit: { gt: 0 },
        },
        select: { id: true, name: true, totalProfit: true },
      })

      for (const user of usersWithProfit) {
        const existingMilestone = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'MILESTONE',
            data: { contains: 'first_profit' },
          },
        })

        if (!existingMilestone) {
          await notifyMilestone(user.id, 'first_profit', user.totalProfit)
          milestonesNotified++
        }
      }

      results.milestonesNotified = milestonesNotified
    } catch (err) {
      console.error('[CRON] Error checking milestones:', err)
      results.milestonesNotified = { error: 'Failed' }
    }

    // Log cron execution
    await db.platformLog.create({
      data: {
        action: 'CRON_DAILY_EXECUTED',
        details: JSON.stringify(results),
      },
    })

    console.log(`[CRON] Daily tasks completed at ${now.toISOString()}`)

    return NextResponse.json({
      message: 'تم تنفيذ المهام اليومية بنجاح',
      executedAt: now.toISOString(),
      results,
    }, { status: 200 })
  } catch (error) {
    console.error('Cron daily error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تنفيذ المهام اليومية' },
      { status: 500 }
    )
  }
}
