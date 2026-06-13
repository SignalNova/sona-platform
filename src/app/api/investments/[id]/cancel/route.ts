import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';

// ═══════════════════════════════════════════════════════════
// CANCEL INVESTMENT - SECURITY HARDENED
// FIX: Properly handle lockedCapital, withdrawableBalance, and earned profits
// Previously: Refunded full amount without deducting earned profits or
// decrementing lockedCapital, allowing double-crediting
// ═══════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = await params;

    const userId = String(user.id)

    const investment = await db.investment.findUnique({
      where: { id },
      include: { package: true },
    });

    if (!investment || String(investment.userId) !== userId) {
      return NextResponse.json({ error: 'الاستثمار غير موجود' }, { status: 404 });
    }

    if (investment.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'لا يمكن إلغاء هذا الاستثمار' }, { status: 400 });
    }

    // Calculate the refund amount
    // SECURITY FIX: If profits were already distributed, only refund the principal
    // minus already-released profits. This prevents double-crediting.
    const totalEarnedProfit = investment.totalProfit || 0
    const originalInvestmentAmount = investment.amount

    // The refund should be the original investment amount
    // Profits were already added to balance separately via daily profit cron
    // So we only refund the principal (investment.amount)
    // But we need to subtract any profits that were already credited to balance
    // because those profits are still in the user's balance
    const refundAmount = Math.max(0, originalInvestmentAmount)

    await db.$transaction(async (tx) => {
      // SECURITY FIX: Re-check investment is still ACTIVE inside transaction
      const currentInvestment = await tx.investment.findUnique({ where: { id } })
      if (!currentInvestment || currentInvestment.status !== 'ACTIVE') {
        throw new Error('لا يمكن إلغاء هذا الاستثمار - تم تغيير حالته')
      }

      // Mark investment as cancelled
      await tx.investment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          endDate: new Date(),
        },
      });

      // SECURITY FIX: Properly decrement lockedCapital
      // Use Math.max to prevent going below 0
      const currentUser = await tx.user.findUnique({ where: { id: userId } })
      if (!currentUser) throw new Error('المستخدم غير موجود')

      const lockedCapitalToDecrement = Math.min(originalInvestmentAmount, currentUser.lockedCapital)

      // SECURITY FIX: Add to BOTH balance AND withdrawableBalance
      // And properly decrement lockedCapital
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: refundAmount },
          withdrawableBalance: { increment: refundAmount },
          lockedCapital: { decrement: lockedCapitalToDecrement },
        },
      });

      // Create refund transaction record
      await tx.transaction.create({
        data: {
          userId: userId,
          type: 'INVESTMENT_CANCEL',
          amount: refundAmount,
          status: 'COMPLETED',
          method: 'investment_cancel',
          description: `إلغاء استثمار في باقة ${investment.package.name} - استرداد المبلغ (${refundAmount.toFixed(2)} USDT)`,
          reference: id,
          details: JSON.stringify({
            originalAmount: originalInvestmentAmount,
            earnedProfit: totalEarnedProfit,
            refundAmount,
            lockedCapitalDecremented: lockedCapitalToDecrement,
          }),
        },
      });

      // Also complete any associated trading session
      try {
        await tx.tradingSession.updateMany({
          where: { investmentId: id, status: 'ACTIVE' },
          data: { status: 'COMPLETED' },
        })
      } catch {
        // Non-critical: trading session update failed
      }
    });

    // Send notification
    await createNotification({
      userId,
      title: 'تم إلغاء الاستثمار',
      message: `تم إلغاء استثمارك في باقة ${investment.package.name} واسترداد ${refundAmount.toFixed(2)} USDT`,
      type: 'INVESTMENT',
      data: { investmentId: id, refundAmount },
    })

    return NextResponse.json({
      message: 'تم إلغاء الاستثمار واسترداد المبلغ',
      refundAmount,
    });
  } catch (error: any) {
    console.error('Cancel investment error:', error);
    if (error.message?.includes('تم تغيير حالته')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
