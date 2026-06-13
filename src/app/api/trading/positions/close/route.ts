import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

// POST: Close an open position and settle P&L to balance
// The P&L is calculated from the stored quantity (which includes leverage effect).
// On OPEN: margin (tradeAmount / leverage) was deducted from balance.
// On CLOSE: we return margin + P&L to balance.
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }
    const userId = String(authUser.id)

    const body = await request.json()
    const { positionId } = body

    if (!positionId) {
      return NextResponse.json({ error: 'معرف الصفقة مطلوب' }, { status: 400 })
    }

    // Use a transaction for atomicity - prevents race conditions and double-closing
    const result = await db.$transaction(async (tx) => {
      // Find the open position - checking it's still OPEN prevents double-closing
      const trade = await tx.botTrade.findFirst({
        where: { id: positionId, status: 'OPEN', isManual: true },
        include: {
          session: {
            include: { investment: true },
          },
        },
      })

      if (!trade) {
        throw new Error('الصفقة غير موجودة أو مغلقة بالفعل')
      }

      // Verify ownership
      if (trade.session.userId !== userId) {
        throw new Error('غير مصرح')
      }

      // Get current market price from Binance
      let exitPrice = 0
      try {
        const symbolMap: Record<string, string> = {
          'BTC/USDT': 'BTCUSDT',
          'ETH/USDT': 'ETHUSDT',
          'BNB/USDT': 'BNBUSDT',
          'SOL/USDT': 'SOLUSDT',
          'XRP/USDT': 'XRPUSDT',
          'DOGE/USDT': 'DOGEUSDT',
          'ADA/USDT': 'ADAUSDT',
          'AVAX/USDT': 'AVAXUSDT',
          'DOT/USDT': 'DOTUSDT',
          'LINK/USDT': 'LINKUSDT',
        }
        const binanceSymbol = symbolMap[trade.symbol] || trade.symbol.replace('/', '')
        const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          exitPrice = parseFloat(priceData.price)
        }
      } catch {
        // CRITICAL: Do NOT use random or fabricated prices - reject the close
        throw new Error('بيانات السوق غير متاحة حالياً، يرجى المحاولة مرة أخرى')
      }

      if (exitPrice <= 0) {
        exitPrice = trade.entryPrice
      }

      if (exitPrice <= 0) {
        throw new Error('بيانات السوق غير متاحة حالياً، يرجى المحاولة مرة أخرى')
      }

      // ═══════════════════════════════════════════════════════════════
      // P&L CALCULATION
      // ═══════════════════════════════════════════════════════════════
      // Calculate P&L based on the stored quantity (which already includes
      // leverage effect from when the position was opened).
      // This is the most accurate method because it uses the actual
      // quantity of the asset that was bought/sold.
      //
      // Example: User enters $500 with 10x leverage on BTC at $100,000
      //   - margin deducted = $500 / 10 = $50
      //   - quantity = $500 * 10 / $100,000 = 0.05 BTC
      //   - If BTC goes up 1% to $101,000:
      //     profitLoss = 0.05 * ($101,000 - $100,000) = $50
      //   - settlement = $50 (margin) + $50 (profit) = $100
      //   - Net: -$50 + $100 = +$50 (100% return on margin)
      //
      // For 1x leverage on $500 at BTC $100,000:
      //   - margin deducted = $500
      //   - quantity = $500 / $100,000 = 0.005 BTC
      //   - If BTC goes up 1%: profitLoss = 0.005 * $1,000 = $5
      //   - settlement = $500 + $5 = $505
      //   - Net: -$500 + $505 = +$5 (1% return)
      // ═══════════════════════════════════════════════════════════════

      const leverage = trade.leverage || 1
      const marginDeducted = trade.amount / leverage // What was deducted from balance on open
      const quantity = trade.quantity || (trade.amount / trade.entryPrice) // Fallback if quantity is 0

      // P&L based on quantity (most accurate - includes leverage effect)
      let profitLoss: number
      if (trade.type === 'BUY') {
        profitLoss = quantity * (exitPrice - trade.entryPrice)
      } else {
        profitLoss = quantity * (trade.entryPrice - exitPrice)
      }

      // Round to avoid floating point issues
      profitLoss = Number(profitLoss.toFixed(4))

      // P&L percentage for display (based on margin)
      const pnlPct = marginDeducted > 0 ? (profitLoss / marginDeducted) * 100 : 0

      // Update the trade to CLOSED
      await tx.botTrade.update({
        where: { id: positionId },
        data: {
          exitPrice,
          profitLoss,
          status: 'CLOSED',
          closedAt: new Date(),
        },
      })

      // Settle to user balance:
      // Return the margin + profit/loss. Can't lose more than margin.
      const settlementAmount = marginDeducted + profitLoss
      const finalSettlement = Math.max(0, Number(settlementAmount.toFixed(4)))

      // Get current user balance
      const currentUser = await tx.user.findUnique({ where: { id: userId } })
      if (!currentUser) {
        throw new Error('المستخدم غير موجود')
      }

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: finalSettlement },
          withdrawableBalance: { increment: finalSettlement },
          totalProfit: { increment: profitLoss },
        },
      })

      // Update session stats
      const wins = profitLoss > 0 ? 1 : 0
      const losses = profitLoss <= 0 ? 1 : 0

      await tx.tradingSession.update({
        where: { id: trade.sessionId },
        data: {
          currentPrice: exitPrice,
          totalProfit: { increment: profitLoss },
          totalTrades: { increment: 1 },
          winTrades: { increment: wins },
          lossTrades: { increment: losses },
        },
      })

      // ─── FIX: Cancel the associated investment to prevent double-crediting ───
      // When a position is opened, an investment is created with amount = tradeAmount.
      // When closed, we return the margin + P&L to balance.
      // If the investment stays ACTIVE, the daily cron will:
      //   1. Add daily profits based on investment.amount (unearned)
      //   2. When investment completes, add investment.amount to balance AGAIN
      // This causes balance doubling. Fix: mark investment as COMPLETED and
      // set its amount to 0 so no further capital release happens.
      try {
        const investment = trade.session.investment
        if (investment && investment.status === 'ACTIVE') {
          // Check if there are any other open trades in this session
          const otherOpenTrades = await tx.botTrade.count({
            where: {
              sessionId: trade.sessionId,
              status: 'OPEN',
              id: { not: positionId },
            },
          })

          // Only complete the investment if no other positions are open
          if (otherOpenTrades === 0) {
            await tx.investment.update({
              where: { id: investment.id },
              data: {
                status: 'COMPLETED',
                endDate: new Date(),
              },
            })

            // Also complete the trading session
            await tx.tradingSession.update({
              where: { id: trade.sessionId },
              data: { status: 'COMPLETED' },
            })
          }
        }
      } catch (e) {
        // Non-critical: investment cleanup failed, but trade is still closed
        console.warn('[CLOSE] Investment cleanup warning:', e)
      }

      // Create transaction record
      const txType = profitLoss >= 0 ? 'PROFIT' : 'INVESTMENT'
      await tx.transaction.create({
        data: {
          userId,
          type: txType,
          amount: Math.abs(profitLoss),
          status: 'COMPLETED',
          method: 'TRADE',
          description: profitLoss >= 0
            ? `إغلاق صفقة ${trade.type === 'BUY' ? 'شراء' : 'بيع'} ${trade.symbol} - ربح ${profitLoss.toFixed(2)} $ (${pnlPct.toFixed(2)}%)`
            : `إغلاق صفقة ${trade.type === 'BUY' ? 'شراء' : 'بيع'} ${trade.symbol} - خسارة ${Math.abs(profitLoss).toFixed(2)} $ (${pnlPct.toFixed(2)}%)`,
        },
      })

      // Get final balance after settlement
      const finalUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } })

      return {
        exitPrice,
        profitLoss,
        pnlPct,
        settlementAmount: finalSettlement,
        marginDeducted,
        quantity,
        newBalance: finalUser?.balance || 0,
      }
    })

    // Send notification (outside transaction)
    try {
      await createNotification({
        userId,
        title: result.profitLoss >= 0 ? 'صفقة رابحة!' : 'صفقة خاسرة',
        message: result.profitLoss >= 0
          ? `تم إغلاق صفقة بربح ${result.profitLoss.toFixed(2)} $ (${result.pnlPct.toFixed(2)}%)`
          : `تم إغلاق صفقة بخسارة ${Math.abs(result.profitLoss).toFixed(2)} $ (${result.pnlPct.toFixed(2)}%)`,
        type: result.profitLoss >= 0 ? 'PROFIT' : 'PLATFORM',
      })
    } catch {}

    return NextResponse.json({
      position: {
        id: positionId,
        exitPrice: result.exitPrice,
        profitLoss: result.profitLoss,
        status: 'CLOSED',
        closedAt: new Date(),
      },
      settlementAmount: result.settlementAmount,
      profitLoss: result.profitLoss,
      pnlPct: result.pnlPct,
      marginDeducted: result.marginDeducted,
      newBalance: result.newBalance,
      message: result.profitLoss >= 0
        ? `تم إغلاق الصفقة بربح ${result.profitLoss.toFixed(2)} $`
        : `تم إغلاق الصفقة بخسارة ${Math.abs(result.profitLoss).toFixed(2)} $`,
    })
  } catch (error: any) {
    console.error('Position close POST error:', error)
    if (error.message === 'الصفقة غير موجودة أو مغلقة بالفعل') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'غير مصرح') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
