import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest } from '../middleware';

export async function POST(request: Request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const activeInvestments = await db.investment.findMany({
      where: { status: 'ACTIVE' },
      include: { package: true },
    });

    let updatedCount = 0;
    const now = new Date();

    for (const investment of activeInvestments) {
      const lastProfitDate = investment.lastProfitDate || investment.startDate;
      const diffTime = now.getTime() - new Date(lastProfitDate).getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 1) {
        const daysToCredit = Math.min(diffDays, investment.package.durationDays);
        const profitToCredit = investment.monthlyProfit * daysToCredit;
        const totalDaysElapsed = Math.floor(
          (now.getTime() - new Date(investment.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if investment should complete
        const shouldComplete = totalDaysElapsed >= investment.package.durationDays;

        await db.$transaction(async (tx) => {
          await tx.investment.update({
            where: { id: investment.id },
            data: {
              totalProfit: { increment: profitToCredit },
              lastProfitDate: now,
              monthsElapsed: { increment: 1 },
              ...(shouldComplete
                ? { status: 'COMPLETED', endDate: now }
                : {}),
            },
          });

          await tx.user.update({
            where: { id: investment.userId },
            data: {
              balance: { increment: profitToCredit },
              totalProfit: { increment: profitToCredit },
            },
          });

          await tx.transaction.create({
            data: {
              userId: investment.userId,
              type: 'PROFIT',
              amount: profitToCredit,
              status: 'COMPLETED',
              description: `أرباح من باقة ${investment.package.name} (${daysToCredit} يوم)`,
            },
          });
        });

        updatedCount++;
      }
    }

    return NextResponse.json({
      message: `تم تحديث أرباح ${updatedCount} استثمار`,
      updatedCount,
    });
  } catch (error) {
    console.error('Update profits error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
