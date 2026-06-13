import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// This endpoint is called by the cron scheduler to execute scheduled agent tasks
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal call (simple auth check)
    const authHeader = request.headers.get('authorization');
    // SECURITY: CRON_SECRET is MANDATORY - no fallback allowed
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[FATAL SECURITY] CRON_SECRET is not set!');
      return NextResponse.json({ error: 'Security configuration error' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { task } = body;

    if (!task) {
      return NextResponse.json({ error: 'task is required' }, { status: 400 });
    }

    let result: any = { success: true, task, executedAt: new Date().toISOString() };

    switch (task) {
      case 'diagnostics': {
        // Quick diagnostics
        let dbStatus = 'healthy';
        try { await prisma.$queryRaw`SELECT 1`; } catch { dbStatus = 'error'; }

        const [userCount, pendingDeposits, pendingWithdrawals, stuckTx] = await Promise.all([
          prisma.user.count(),
          prisma.transaction.count({ where: { type: 'deposit', status: 'PENDING' } }),
          prisma.transaction.count({ where: { type: 'withdrawal', status: 'PENDING' } }),
          prisma.transaction.count({ where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - 86400000) } } }),
        ]);

        result.data = { dbStatus, userCount, pendingDeposits, pendingWithdrawals, stuckTx };

        // Auto-fix stuck transactions
        if (stuckTx > 0) {
          const stuck = await prisma.transaction.findMany({ where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - 86400000) } }, take: 20 });
          for (const tx of stuck) {
            await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'PENDING', adminNote: 'Auto-reset from stuck PROCESSING state by cron' } });
          }
          result.autoFix = { stuckTransactionsReset: stuck.length };
        }

        await prisma.platformLog.create({
          data: { action: 'cron_diagnostics', details: `Cron diagnostics: DB=${dbStatus}, Users=${userCount}, Stuck=${stuckTx}`, adminId: 'system' },
        });
        break;
      }

      case 'security_scan': {
        const [
          unverifiedCount,
          highBalanceUsers,
          adminCount,
          usersWithout2FA,
        ] = await Promise.all([
          prisma.user.count({ where: { emailVerified: false } }),
          prisma.user.count({ where: { balance: { gt: 100000 } } }),
          prisma.user.count({ where: { role: 'admin' } }),
          prisma.user.count({ where: { role: 'admin', twoFactorEnabled: false } }),
        ]);

        const issues: string[] = [];
        if (adminCount === 0) issues.push('No admin accounts found');
        if (usersWithout2FA > 0) issues.push(`${usersWithout2FA} admin(s) without 2FA`);
        if (unverifiedCount > 50) issues.push(`${unverifiedCount} unverified users`);

        result.data = { securityScore: Math.max(0, 100 - issues.length * 20), issues, unverifiedCount, highBalanceUsers, adminCount };

        await prisma.platformLog.create({
          data: { action: 'cron_security_scan', details: `Cron security scan: Score=${result.data.securityScore}, Issues=${issues.length}`, adminId: 'system' },
        });
        break;
      }

      case 'process_scheduled_posts': {
        // Marketing agent feature has been removed
        result.data = { message: 'Marketing agent feature has been removed' };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown task: ${task}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Agent executor error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
