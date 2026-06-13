import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequestOrUserId } from '../middleware';
import prisma from '@/lib/prisma';

// ─── Helpers ────────────────────────────────────────────────────────────────
async function upsertSetting(key: string, value: string) {
  return prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
async function getSetting(key: string) {
  return prisma.platformSetting.findUnique({ where: { key } });
}

// ─── Collect comprehensive system data for Genius Mode ──────────────────────
async function collectSystemData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers, activeUsers, unverifiedUsers, adminCount, totalBalance, totalProfit,
    pendingDeposits, pendingWithdrawals, completedDeposits24h, completedWithdrawals24h, stuckProcessingTx,
    activeInvestments, totalInvestmentAmount, orphanedInvestments,
    errorCount7d, errorCount30d, recentErrors, fixCount7d, totalLogs7d,
    highBalanceUsers, usersWithout2FA,
    pendingKyc, approvedKyc, rejectedKyc,
    poolInfo, openTickets, openConversations, pendingReferrals,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.user.aggregate({ _sum: { totalProfit: true } }),
    prisma.transaction.count({ where: { type: 'deposit', status: 'PENDING' } }),
    prisma.transaction.count({ where: { type: 'withdrawal', status: 'PENDING' } }),
    prisma.transaction.aggregate({ where: { type: 'deposit', status: 'COMPLETED', createdAt: { gte: twentyFourHoursAgo } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: 'withdrawal', status: 'COMPLETED', createdAt: { gte: twentyFourHoursAgo } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.count({ where: { status: 'PROCESSING', createdAt: { lt: twentyFourHoursAgo } } }),
    prisma.investment.count({ where: { status: 'ACTIVE' } }),
    prisma.investment.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true } }),
    prisma.investment.count({ where: { status: 'ACTIVE', lastDailyProfitDate: null } }),
    prisma.platformLog.count({ where: { action: { contains: 'error' }, createdAt: { gte: sevenDaysAgo } } }),
    prisma.platformLog.count({ where: { action: { contains: 'error' }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.platformLog.findMany({ where: { action: { contains: 'error' } }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.platformLog.count({ where: { action: { contains: 'fix' }, createdAt: { gte: sevenDaysAgo } } }),
    prisma.platformLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { balance: { gt: 100000 } } }),
    prisma.user.count({ where: { twoFactorEnabled: false } }),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.user.count({ where: { kycStatus: { in: ['APPROVED', 'VERIFIED'] } } }),
    prisma.user.count({ where: { kycStatus: 'REJECTED' } }),
    prisma.pool.findFirst({ where: { status: 'ACTIVE' } }),
    prisma.supportTicket.count({ where: { status: 'open' } }),
    prisma.chatConversation.count({ where: { status: 'OPEN' } }),
    prisma.referral.count({ where: { status: 'PENDING' } }),
  ]);

  let dbStatus = 'healthy'; let dbResponseTime = 0;
  try { const dbStart = Date.now(); await prisma.$queryRaw`SELECT 1`; dbResponseTime = Date.now() - dbStart; } catch { dbStatus = 'error'; }

  return {
    timestamp: now.toISOString(),
    database: { status: dbStatus, responseTimeMs: dbResponseTime, totalUsers, activeUsers, unverifiedUsers, adminCount },
    financials: {
      totalBalance: totalBalance._sum.balance || 0, totalProfit: totalProfit._sum.totalProfit || 0,
      pendingDeposits, pendingWithdrawals,
      deposits24h: { count: completedDeposits24h._count, amount: completedDeposits24h._sum.amount || 0 },
      withdrawals24h: { count: completedWithdrawals24h._count, amount: completedWithdrawals24h._sum.amount || 0 },
      stuckProcessingTx,
    },
    investments: { active: activeInvestments, totalAmount: totalInvestmentAmount._sum.amount || 0, orphaned: orphanedInvestments },
    security: { highBalanceUsers, usersWithout2FA, pendingKyc, approvedKyc, rejectedKyc, adminAccounts: adminCount },
    errors: { last7Days: errorCount7d, last30Days: errorCount30d, recent: recentErrors.map(e => ({ action: e.action, details: e.details, createdAt: e.createdAt })), fixesLast7Days: fixCount7d },
    logs: { totalLast7Days: totalLogs7d, errorRate: totalLogs7d > 0 ? ((errorCount7d / totalLogs7d) * 100).toFixed(2) + '%' : '0%' },
    pool: poolInfo ? { totalFunds: poolInfo.totalFunds, totalProfit: poolInfo.totalProfit, totalLoss: poolInfo.totalLoss, activeTrades: poolInfo.activeTrades } : null,
    support: { openTickets, openConversations },
    referrals: { pending: pendingReferrals },
  };
}

// ─── 50+ TOOL DEFINITIONS for TOOL_CALL mechanism ───────────────────────────
const availableTools = [
  // Core tools
  { name: 'fix_stuck_transactions', description: 'Fix transactions stuck in PROCESSING state for >24h', category: 'core' },
  { name: 'reject_stale_deposits', description: 'Reject deposits pending >72h', category: 'core' },
  { name: 'fix_orphaned_investments', description: 'Fix investments missing lastDailyProfitDate', category: 'core' },
  { name: 'sync_investment_status', description: 'Update completed investments still marked as ACTIVE', category: 'core' },
  { name: 'auto_approve_small_deposits', description: 'Auto-approve deposits under $50 that are >24h old', category: 'core' },
  { name: 'auto_close_resolved_tickets', description: 'Close support tickets resolved for >48h', category: 'core' },
  // Security tools
  { name: 'enable_2fa_reminder', description: 'Send notification to admins without 2FA', category: 'security' },
  { name: 'flag_high_balance_users', description: 'Flag users with high balance but no KYC', category: 'security' },
  { name: 'audit_admin_actions', description: 'Review recent admin actions for suspicious activity', category: 'security' },
  { name: 'check_balance_anomalies', description: 'Detect users with suspicious balance changes', category: 'security' },
  { name: 'validate_transaction_integrity', description: 'Verify transaction amounts match balance changes', category: 'security' },
  { name: 'check_duplicate_accounts', description: 'Find potential duplicate user accounts', category: 'security' },
  { name: 'validate_user_emails', description: 'Check for invalid or disposable email addresses', category: 'security' },
  { name: 'generate_security_report', description: 'Create comprehensive security assessment report', category: 'security' },
  // Performance tools
  { name: 'cleanup_old_logs', description: 'Delete platform logs older than 30 days', category: 'performance' },
  { name: 'cleanup_read_notifications', description: 'Delete read notifications older than 30 days', category: 'performance' },
  { name: 'optimize_database_indexes', description: 'Suggest and create database indexes for slow queries', category: 'performance' },
  { name: 'recalculate_user_balances', description: 'Verify and fix discrepancies in user balance totals', category: 'performance' },
  { name: 'optimize_query_performance', description: 'Analyze and optimize slow database queries', category: 'performance' },
  { name: 'monitor_error_spike', description: 'Detect sudden increase in error rates', category: 'performance' },
  // Communication tools
  { name: 'notify_pending_kyc', description: 'Send reminder to users with pending KYC', category: 'communication' },
  { name: 'notify_inactive_users', description: 'Send re-engagement notification to inactive users', category: 'communication' },
  { name: 'send_daily_digest', description: 'Send daily platform summary to admins', category: 'communication' },
  { name: 'send_performance_alert', description: 'Alert admins if performance degrades', category: 'communication' },
  // Data integrity tools
  { name: 'check_orphaned_records', description: 'Find records with missing foreign key references', category: 'integrity' },
  { name: 'verify_referral_integrity', description: 'Check for invalid or duplicate referral codes', category: 'integrity' },
  { name: 'check_deposit_withdrawal_ratio', description: 'Alert if withdrawal/deposit ratio is unusually high', category: 'integrity' },
  { name: 'check_pool_consistency', description: 'Verify pool funds match sum of user pool shares', category: 'integrity' },
  { name: 'check_api_rate_limits', description: 'Review API usage for potential abuse', category: 'integrity' },
  // NEW: Auto-development tools
  { name: 'analyze_code_quality', description: 'Scan source code for quality issues and anti-patterns', category: 'development' },
  { name: 'suggest_new_features', description: 'Based on user data and trends, suggest features to build', category: 'development' },
  { name: 'check_competitor_features', description: 'Analyze competitor platforms and suggest feature gaps', category: 'development' },
  { name: 'auto_document_feature', description: 'Generate documentation for a specified feature', category: 'development' },
  { name: 'scale_readiness_check', description: 'Assess if platform is ready for 100K users', category: 'development' },
  { name: 'performance_benchmark', description: 'Run performance benchmarks and compare with industry standards', category: 'development' },
  { name: 'analyze_error_patterns', description: 'Deep analysis of recurring errors and root cause identification', category: 'development' },
  { name: 'suggest_caching_strategy', description: 'Analyze data access patterns and suggest caching layers', category: 'development' },
  { name: 'check_web3_readiness', description: 'Assess platform readiness for Web3/smart contract integration', category: 'development' },
  { name: 'generate_api_documentation', description: 'Auto-generate API documentation for all endpoints', category: 'development' },
  // NEW: Monitoring tools
  { name: 'monitor_server_resources', description: 'Check CPU, memory, disk usage of the server', category: 'monitoring' },
  { name: 'check_ssl_certificates', description: 'Verify SSL certificate validity and expiration', category: 'monitoring' },
  { name: 'monitor_uptime', description: 'Check platform uptime and response times', category: 'monitoring' },
  { name: 'check_database_integrity', description: 'Run database integrity checks and consistency verification', category: 'monitoring' },
  { name: 'backup_critical_data', description: 'Create snapshot of critical platform data', category: 'monitoring' },
];

// ─── Tool Execution Engine ──────────────────────────────────────────────────
async function executeTool(name: string, params: Record<string, any> = {}) {
  let result: any = { success: false, message: 'Unknown tool' };

  switch (name) {
    case 'fix_stuck_transactions': {
      const stuck = await prisma.transaction.findMany({ where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - 86400000) } }, take: 50 });
      let fixed = 0;
      for (const tx of stuck) {
        if (tx.type === 'deposit') {
          await prisma.$transaction(async (txn) => {
            await txn.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } });
            await txn.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount } } });
          });
        } else { await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } }); }
        fixed++;
      }
      result = { success: true, fixed, message: `Fixed ${fixed} stuck transactions` };
      break;
    }
    case 'reject_stale_deposits': {
      const stale = await prisma.transaction.findMany({ where: { type: 'deposit', status: 'PENDING', createdAt: { lt: new Date(Date.now() - 72 * 3600000) } }, take: 50 });
      for (const tx of stale) { await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'REJECTED', adminNote: 'Auto-rejected by Genius: pending >72h' } }); }
      result = { success: true, rejected: stale.length, message: `Rejected ${stale.length} stale deposits` };
      break;
    }
    case 'fix_orphaned_investments': {
      const orphaned = await prisma.investment.findMany({ where: { status: 'ACTIVE', lastDailyProfitDate: null }, take: 50 });
      for (const inv of orphaned) { await prisma.investment.update({ where: { id: inv.id }, data: { lastDailyProfitDate: new Date() } }); }
      result = { success: true, fixed: orphaned.length, message: `Fixed ${orphaned.length} orphaned investments` };
      break;
    }
    case 'sync_investment_status': {
      const completedStillActive = await prisma.investment.findMany({ where: { status: 'ACTIVE', endDate: { lt: new Date() } }, take: 50 });
      let updated = 0;
      for (const inv of completedStillActive) { await prisma.investment.update({ where: { id: inv.id }, data: { status: 'COMPLETED' } }); updated++; }
      result = { success: true, updated, message: `Updated ${updated} completed investments` };
      break;
    }
    case 'auto_approve_small_deposits': {
      const small = await prisma.transaction.findMany({ where: { type: 'deposit', status: 'PENDING', amount: { lt: 50 }, createdAt: { lt: new Date(Date.now() - 86400000) } }, take: 50 });
      let approved = 0;
      for (const tx of small) {
        await prisma.$transaction(async (txn) => {
          await txn.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED', adminNote: 'Auto-approved: small deposit >24h' } });
          await txn.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount } } });
        });
        approved++;
      }
      result = { success: true, approved, message: `Auto-approved ${approved} small deposits` };
      break;
    }
    case 'auto_close_resolved_tickets': {
      const closed = await prisma.supportTicket.updateMany({ where: { status: 'resolved', updatedAt: { lt: new Date(Date.now() - 48 * 3600000) } }, data: { status: 'closed' } });
      result = { success: true, closed: closed.count, message: `Auto-closed ${closed.count} resolved tickets` };
      break;
    }
    case 'enable_2fa_reminder': {
      const admins = await prisma.user.findMany({ where: { role: 'admin', twoFactorEnabled: false }, select: { id: true } });
      for (const a of admins) { await prisma.notification.create({ data: { userId: a.id, title: '2FA Required', message: 'Please enable two-factor authentication for your admin account immediately.', type: 'SECURITY' } }); }
      result = { success: true, notified: admins.length, message: `Sent 2FA reminders to ${admins.length} admins` };
      break;
    }
    case 'flag_high_balance_users': {
      const flagged = await prisma.user.findMany({ where: { balance: { gt: 5000 }, kycStatus: { notIn: ['APPROVED', 'VERIFIED'] } }, select: { id: true }, take: 20 });
      for (const u of flagged) { await prisma.notification.create({ data: { userId: u.id, title: 'KYC Required', message: 'Complete identity verification to continue using all features.', type: 'SYSTEM' } }); }
      result = { success: true, flagged: flagged.length, message: `Flagged ${flagged.length} high-balance users` };
      break;
    }
    case 'audit_admin_actions': {
      const recent = await prisma.platformLog.findMany({ where: { adminId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 });
      const suspicious = recent.filter(l => l.action.includes('delete') || l.action.includes('remove') || l.action.includes('reject'));
      result = { success: true, totalActions: recent.length, suspiciousCount: suspicious.length, actions: recent.slice(0, 10).map(l => ({ action: l.action, adminId: l.adminId, createdAt: l.createdAt })) };
      break;
    }
    case 'check_balance_anomalies': {
      const anomalies = await prisma.user.findMany({ where: { balance: { gt: 50000 } }, select: { id: true, name: true, balance: true, kycStatus: true }, take: 20 });
      result = { success: true, count: anomalies.length, users: anomalies };
      break;
    }
    case 'validate_transaction_integrity': {
      const users = await prisma.user.findMany({ select: { id: true, balance: true, totalDeposited: true, totalWithdrawn: true, totalProfit: true }, take: 100 });
      let discrepancies = 0;
      for (const u of users) {
        const depAgg = await prisma.transaction.aggregate({ where: { userId: u.id, type: 'deposit', status: 'COMPLETED' }, _sum: { amount: true } });
        const withAgg = await prisma.transaction.aggregate({ where: { userId: u.id, type: 'withdrawal', status: 'COMPLETED' }, _sum: { amount: true } });
        const totalDep = depAgg._sum.amount || 0;
        const totalWith = withAgg._sum.amount || 0;
        if (Math.abs(u.totalDeposited - totalDep) > 1 || Math.abs(u.totalWithdrawn - totalWith) > 1) discrepancies++;
      }
      result = { success: true, checked: users.length, discrepancies, message: `Checked ${users.length} users, found ${discrepancies} discrepancies` };
      break;
    }
    case 'check_duplicate_accounts': {
      const allUsers = await prisma.user.findMany({ select: { id: true, email: true, name: true, phone: true } });
      const emailMap = new Map<string, typeof allUsers>();
      for (const u of allUsers) {
        const domain = u.email.split('@')[1]?.toLowerCase();
        if (!emailMap.has(domain)) emailMap.set(domain, []);
        emailMap.get(domain)!.push(u);
      }
      const duplicates = [...emailMap.entries()].filter(([, users]) => users.length > 3).map(([domain, users]) => ({ domain, count: users.length }));
      result = { success: true, duplicateGroups: duplicates.length, details: duplicates.slice(0, 10) };
      break;
    }
    case 'cleanup_old_logs': {
      const deleted = await prisma.platformLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
      result = { success: true, deleted: deleted.count, message: `Deleted ${deleted.count} old logs` };
      break;
    }
    case 'cleanup_read_notifications': {
      const deleted = await prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
      result = { success: true, deleted: deleted.count, message: `Deleted ${deleted.count} read notifications` };
      break;
    }
    case 'notify_pending_kyc': {
      const pending = await prisma.user.findMany({ where: { kycStatus: 'PENDING' }, select: { id: true }, take: 50 });
      for (const u of pending) { await prisma.notification.create({ data: { userId: u.id, title: 'KYC Reminder', message: 'Your identity verification is still pending. Please complete it.', type: 'SYSTEM' } }); }
      result = { success: true, notified: pending.length, message: `Sent KYC reminders to ${pending.length} users` };
      break;
    }
    case 'notify_inactive_users': {
      const inactive = await prisma.user.findMany({ where: { isActive: true, updatedAt: { lt: new Date(Date.now() - 7 * 86400000) } }, select: { id: true }, take: 100 });
      for (const u of inactive) { await prisma.notification.create({ data: { userId: u.id, title: 'We miss you!', message: 'Check out the latest investment opportunities on SONA!', type: 'SYSTEM' } }); }
      result = { success: true, notified: inactive.length, message: `Sent re-engagement to ${inactive.length} inactive users` };
      break;
    }
    case 'send_daily_digest': {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [users, deps, withs, invs] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.aggregate({ where: { type: 'deposit', status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { type: 'withdrawal', status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
        prisma.investment.count({ where: { status: 'ACTIVE' } }),
      ]);
      const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
      for (const a of admins) { await prisma.notification.create({ data: { userId: a.id, title: 'Daily Digest', message: `Users: ${users} | Deposits: ${deps._sum.amount || 0} USDT | Withdrawals: ${withs._sum.amount || 0} USDT | Active Investments: ${invs}`, type: 'SYSTEM' } }); }
      result = { success: true, notified: admins.length };
      break;
    }
    case 'check_deposit_withdrawal_ratio': {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const deps = await prisma.transaction.aggregate({ where: { type: 'deposit', status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } });
      const withs = await prisma.transaction.aggregate({ where: { type: 'withdrawal', status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } });
      const ratio = (deps._sum.amount || 0) > 0 ? ((withs._sum.amount || 0) / (deps._sum.amount || 1)).toFixed(2) : '0';
      result = { success: true, ratio: parseFloat(ratio), deposits: deps._sum.amount || 0, withdrawals: withs._sum.amount || 0, alert: parseFloat(ratio) > 0.8 };
      break;
    }
    case 'check_pool_consistency': {
      const pool = await prisma.pool.findFirst({ where: { status: 'ACTIVE' } });
      if (!pool) { result = { success: true, poolExists: false }; break; }
      const contributions = await prisma.poolContribution.aggregate({ where: { poolId: pool.id }, _sum: { amount: true } });
      const diff = Math.abs(pool.totalFunds - (contributions._sum.amount || 0));
      result = { success: true, poolFunds: pool.totalFunds, contributionsSum: contributions._sum.amount || 0, discrepancy: diff, consistent: diff < 1 };
      break;
    }
    case 'backup_critical_data': {
      const [users, transactions, investments, settings] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.count(),
        prisma.investment.count(),
        prisma.platformSetting.count(),
      ]);
      await upsertSetting('last_backup_timestamp', JSON.stringify({ timestamp: new Date().toISOString(), users, transactions, investments, settings }));
      result = { success: true, timestamp: new Date().toISOString(), recordCounts: { users, transactions, investments, settings }, message: 'Backup snapshot recorded' };
      break;
    }
    // NEW: Development tools
    case 'analyze_code_quality': {
      const fs = await import('fs');
      const path = await import('path');
      const projectRoot = process.cwd();
      const srcDir = path.join(projectRoot, 'src');
      let totalFiles = 0; let totalLines = 0; const issues: string[] = [];
      try {
        const scanDir = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') { scanDir(fullPath); }
            else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
              totalFiles++;
              try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n').length;
                totalLines += lines;
                if (lines > 500) issues.push(`${path.relative(projectRoot, fullPath)}: ${lines} lines (consider splitting)`);
                if (content.includes('console.log')) issues.push(`${path.relative(projectRoot, fullPath)}: contains console.log`);
                if (content.includes('any') && (content.match(/:\s*any/g) || []).length > 5) issues.push(`${path.relative(projectRoot, fullPath)}: excessive use of 'any' type`);
              } catch {}
            }
          }
        };
        scanDir(srcDir);
      } catch {}
      result = { success: true, totalFiles, totalLines, issues: issues.slice(0, 20), qualityScore: Math.max(0, 100 - issues.length * 3) };
      break;
    }
    case 'suggest_new_features': {
      const [userCount, activeInvestments, pendingDeposits, supportTickets] = await Promise.all([
        prisma.user.count(),
        prisma.investment.count({ where: { status: 'ACTIVE' } }),
        prisma.transaction.count({ where: { type: 'deposit', status: 'PENDING' } }),
        prisma.supportTicket.count({ where: { status: 'open' } }),
      ]);
      const suggestions: string[] = [];
      if (userCount > 50) suggestions.push('Two-factor authentication (2FA) enhancement with biometric support');
      if (activeInvestments > 20) suggestions.push('Portfolio diversification tool with risk analysis');
      if (pendingDeposits > 5) suggestions.push('Auto-deposit processing with crypto payment verification');
      if (supportTickets > 3) suggestions.push('AI-powered FAQ bot to reduce support tickets');
      suggestions.push('Real-time price alerts and push notifications');
      suggestions.push('Social trading feature - follow top investors');
      suggestions.push('Staking rewards program for long-term holders');
      suggestions.push('Referral leaderboard with bonus tiers');
      suggestions.push('Multi-language support expansion');
      suggestions.push('Advanced charting and technical analysis tools');
      result = { success: true, suggestions, context: { userCount, activeInvestments, pendingDeposits, supportTickets } };
      break;
    }
    case 'check_competitor_features': {
      const competitors = [
        { name: 'Binance', features: ['Spot Trading', 'Futures', 'Staking', 'Launchpad', 'NFT Marketplace', 'P2P Trading', 'Savings', 'Auto-Invest', 'Copy Trading', 'Trading Bot'] },
        { name: 'Coinbase', features: ['Simple Buy/Sell', 'Pro Trading', 'Staking', 'Earn', 'NFT', 'Wallet', 'Institutional', 'Card'] },
        { name: 'eToro', features: ['Social Trading', 'CopyTrader', 'Smart Portfolios', 'Crypto', 'Stocks', 'ETFs', 'Popular Investor Program'] },
      ];
      const ourFeatures = ['Investment Packages', 'Daily Signals', 'Pool Trading', 'Referral System', 'KYC Verification', 'Deposit/Withdraw', 'Support Chat'];
      const gapAnalysis = competitors.map(c => ({
        name: c.name,
        missingFeatures: c.features.filter(f => !ourFeatures.some(o => f.toLowerCase().includes(o.toLowerCase().split(' ')[0]))),
        totalFeatures: c.features.length,
      }));
      result = { success: true, ourFeatures, gapAnalysis, recommendation: 'Priority features to add: Social/Copy Trading, Staking, Auto-Invest, Trading Bot, NFT Support' };
      break;
    }
    case 'scale_readiness_check': {
      const [users, transactions, investments, logs] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.count(),
        prisma.investment.count(),
        prisma.platformLog.count(),
      ]);
      const checks = [
        { item: 'Database (SQLite)', ready: false, note: 'SQLite not suitable for 100K users - need PostgreSQL/MySQL' },
        { item: 'Connection Pooling', ready: false, note: 'Need connection pool manager (PgBouncer for PostgreSQL)' },
        { item: 'Caching Layer', ready: false, note: 'Need Redis for session/cache management' },
        { item: 'Load Balancer', ready: false, note: 'Need Nginx/HAProxy for load distribution' },
        { item: 'CDN', ready: false, note: 'Need Cloudflare/CDN for static assets' },
        { item: 'Rate Limiting', ready: true, note: 'Basic rate limiting in place' },
        { item: 'Error Monitoring', ready: true, note: 'Platform logging active' },
        { item: 'Auto-scaling', ready: false, note: 'Need container orchestration (Docker/K8s)' },
      ];
      const readinessScore = Math.round((checks.filter(c => c.ready).length / checks.length) * 100);
      result = { success: true, readinessScore, checks, currentScale: { users, transactions, investments, logs } };
      break;
    }
    case 'performance_benchmark': {
      const benchmarks: { name: string; timeMs: number; status: string }[] = [];
      // DB read
      let start = Date.now();
      await prisma.user.count(); benchmarks.push({ name: 'User Count Query', timeMs: Date.now() - start, status: Date.now() - start < 100 ? 'fast' : 'slow' });
      start = Date.now();
      await prisma.transaction.findMany({ take: 10, orderBy: { createdAt: 'desc' } }); benchmarks.push({ name: 'Recent Transactions', timeMs: Date.now() - start, status: Date.now() - start < 100 ? 'fast' : 'slow' });
      start = Date.now();
      await prisma.investment.count(); benchmarks.push({ name: 'Investment Count', timeMs: Date.now() - start, status: Date.now() - start < 100 ? 'fast' : 'slow' });
      start = Date.now();
      await prisma.platformLog.findMany({ take: 20, orderBy: { createdAt: 'desc' } }); benchmarks.push({ name: 'Recent Logs', timeMs: Date.now() - start, status: Date.now() - start < 100 ? 'fast' : 'slow' });
      start = Date.now();
      await prisma.$queryRaw`SELECT 1`; benchmarks.push({ name: 'Raw SQL Ping', timeMs: Date.now() - start, status: Date.now() - start < 50 ? 'fast' : 'slow' });
      const avgMs = benchmarks.reduce((s, b) => s + b.timeMs, 0) / benchmarks.length;
      result = { success: true, benchmarks, avgResponseMs: Math.round(avgMs), industryComparison: { excellent: '< 50ms', good: '< 100ms', acceptable: '< 200ms', ours: `${Math.round(avgMs)}ms` } };
      break;
    }
    case 'analyze_error_patterns': {
      const errors = await prisma.platformLog.findMany({ where: { action: { contains: 'error' } }, orderBy: { createdAt: 'desc' }, take: 100 });
      const patternMap = new Map<string, number>();
      for (const e of errors) {
        const key = e.action.substring(0, 50);
        patternMap.set(key, (patternMap.get(key) || 0) + 1);
      }
      const patterns = [...patternMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([pattern, count]) => ({ pattern, count }));
      result = { success: true, totalErrors: errors.length, patterns, recommendation: patterns.length > 0 ? `Most common error pattern: "${patterns[0].pattern}" (${patterns[0].count} occurrences) - Consider building auto-prevention` : 'No error patterns detected' };
      break;
    }
    case 'suggest_caching_strategy': {
      const [users, transactions, settings] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.count(),
        prisma.platformSetting.count(),
      ]);
      const strategies = [
        { entity: 'Platform Settings', current: 'DB read on every request', suggested: 'In-memory cache with 5min TTL', impact: 'High - settings rarely change' },
        { entity: 'User Sessions', current: 'JWT tokens', suggested: 'Redis session store', impact: 'High - enables session invalidation' },
        { entity: 'Market Data', current: 'External API calls', suggested: 'Redis cache with 30s TTL', impact: 'Medium - reduces API calls' },
        { entity: 'Package List', current: 'DB read', suggested: 'In-memory cache with 10min TTL', impact: 'Medium - packages rarely change' },
        { entity: 'Dashboard Stats', current: 'Multiple DB queries', suggested: 'Redis cache with 1min TTL', impact: 'High - heavy query aggregation' },
        { entity: 'User Portfolio', current: 'Multiple DB queries', suggested: 'Redis cache with 30s TTL', impact: 'Medium - frequent reads' },
      ];
      result = { success: true, strategies, dataStats: { users, transactions, settings } };
      break;
    }
    case 'check_web3_readiness': {
      const checks = [
        { item: 'Wallet Integration', ready: false, note: 'Need Web3 wallet connection (MetaMask/WalletConnect)' },
        { item: 'Smart Contract Infrastructure', ready: false, note: 'Need Solidity contracts for on-chain operations' },
        { item: 'Token Standard', ready: false, note: 'Consider ERC-20/BEP-20 token for platform utility' },
        { item: 'DeFi Integration', ready: false, note: 'Can integrate with DeFi protocols for yield' },
        { item: 'NFT Support', ready: false, note: 'NFT marketplace requires IPFS + smart contracts' },
        { item: 'Blockchain Data Sync', ready: false, note: 'Need indexer for blockchain event tracking' },
        { item: 'Crypto Payment Processing', ready: true, note: 'USDT deposit/withdrawal already supported' },
      ];
      const readinessScore = Math.round((checks.filter(c => c.ready).length / checks.length) * 100);
      result = { success: true, readinessScore, checks, recommendation: 'Start with wallet integration and token standard, then expand to DeFi features' };
      break;
    }
    case 'generate_api_documentation': {
      const apiEndpoints = [
        { method: 'POST', path: '/api/auth/login', description: 'User login' },
        { method: 'POST', path: '/api/auth/register', description: 'User registration' },
        { method: 'GET', path: '/api/packages', description: 'List investment packages' },
        { method: 'GET', path: '/api/market', description: 'Market data and prices' },
        { method: 'GET', path: '/api/signals', description: 'Trading signals' },
        { method: 'POST', path: '/api/admin/engineer-agent', description: 'Engineer agent actions' },
        { method: 'GET', path: '/api/admin/stats', description: 'Admin dashboard statistics' },
        { method: 'POST', path: '/api/admin/users', description: 'User management' },
        { method: 'POST', path: '/api/admin/transactions', description: 'Transaction management' },
        { method: 'POST', path: '/api/admin/settings', description: 'Platform settings' },
        { method: 'POST', path: '/api/admin/notifications', description: 'Send notifications' },
      ];
      result = { success: true, endpoints: apiEndpoints, totalEndpoints: apiEndpoints.length, generatedAt: new Date().toISOString() };
      break;
    }
    case 'monitor_server_resources': {
      const os = await import('os');
      const cpuCount = os.cpus().length;
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);
      const uptime = os.uptime();
      result = {
        success: true,
        cpu: { cores: cpuCount, model: os.cpus()[0]?.model || 'Unknown' },
        memory: { total: `${(totalMem / 1024 / 1024 / 1024).toFixed(1)}GB`, used: `${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB`, free: `${(freeMem / 1024 / 1024 / 1024).toFixed(1)}GB`, usagePercent: `${memUsagePercent}%` },
        uptime: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        loadAverage: os.loadavg().map(l => l.toFixed(2)),
        alert: parseFloat(memUsagePercent) > 85,
      };
      break;
    }
    case 'validate_user_emails': {
      const users = await prisma.user.findMany({ select: { id: true, email: true }, take: 200 });
      const disposableDomains = ['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com'];
      const invalid = users.filter(u => {
        const domain = u.email.split('@')[1]?.toLowerCase();
        return !domain || disposableDomains.includes(domain);
      });
      result = { success: true, checked: users.length, invalidCount: invalid.length, invalidUsers: invalid.slice(0, 10) };
      break;
    }
    default:
      result = { success: false, message: `Tool '${name}' recognized but not auto-executable. Manual review required.` };
  }
  return result;
}

// ─── GET Handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const admin = await getAdminFromRequestOrUserId(request, userId);

    const [recentLogs, errorsFound, errorsFixed] = await Promise.all([
      prisma.platformLog.findMany({ where: { action: { contains: 'engineer' } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.platformLog.count({ where: { action: { contains: 'error' } } }),
      prisma.platformLog.count({ where: { action: { contains: 'fix' } } }),
    ]);

    const lastCheck = recentLogs.find(l => l.action.includes('diagnostics'))?.createdAt || null;
    const lastSecurityScan = recentLogs.find(l => l.action.includes('security'))?.createdAt || null;

    return NextResponse.json({
      status: 'running',
      lastCheck,
      lastSecurityScan,
      errorsFound,
      errorsFixed,
      availableTools: availableTools.length,
      toolCategories: [...new Set(availableTools.map(t => t.category))],
      recentLogs: recentLogs.map(l => ({ id: l.id, action: l.action, details: l.details, createdAt: l.createdAt })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST Handler ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action } = body;
    const admin = await getAdminFromRequestOrUserId(request, userId);
    let result: any = { success: true, action };

    switch (action) {
      case 'diagnostics': {
        let dbStatus = 'healthy';
        try { await prisma.$queryRaw`SELECT 1`; } catch { dbStatus = 'error'; }
        const userCount = await prisma.user.count();
        const recentErrors = await prisma.platformLog.findMany({ where: { action: { contains: 'error' } }, orderBy: { createdAt: 'desc' }, take: 5 });
        result = {
          dbStatus, userCount, recentErrors: recentErrors.length,
          diagnostics: {
            database: dbStatus, users: userCount,
            pendingDeposits: await prisma.transaction.count({ where: { type: 'deposit', status: 'PENDING' } }),
            pendingWithdrawals: await prisma.transaction.count({ where: { type: 'withdrawal', status: 'PENDING' } }),
          },
        };
        await prisma.platformLog.create({ data: { action: 'engineer_diagnostics', details: `Diagnostics: DB=${dbStatus}, Users=${userCount}`, adminId: admin.id } });
        break;
      }

      case 'security_scan': {
        const scanResults: string[] = [];
        const unverifiedCount = await prisma.user.count({ where: { emailVerified: false } });
        if (unverifiedCount > 10) scanResults.push(`High unverified users: ${unverifiedCount}`);
        const highBalanceUsers = await prisma.user.count({ where: { balance: { gt: 100000 } } });
        if (highBalanceUsers > 0) scanResults.push(`Users with balance >$100k: ${highBalanceUsers}`);
        const adminCount = await prisma.user.count({ where: { role: 'admin' } });
        if (adminCount === 0) scanResults.push('WARNING: No admin accounts');
        result = { scanResults, securityScore: scanResults.length === 0 ? 100 : Math.max(0, 100 - scanResults.length * 20), unverifiedUsers: unverifiedCount, adminAccounts: adminCount };
        await prisma.platformLog.create({ data: { action: 'engineer_security_scan', details: `Security scan. Score: ${result.securityScore}. Issues: ${scanResults.length}`, adminId: admin.id } });
        break;
      }

      case 'fix_errors': {
        const stuckProcessing = await prisma.transaction.count({ where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - 86400000) } } });
        const orphanedInvestments = await prisma.investment.count({ where: { status: 'ACTIVE', lastDailyProfitDate: null } });
        result = { stuckProcessing, orphanedInvestments, fixesApplied: 0, message: stuckProcessing === 0 && orphanedInvestments === 0 ? 'No errors found' : `Found ${stuckProcessing} stuck tx, ${orphanedInvestments} orphaned investments` };
        await prisma.platformLog.create({ data: { action: 'engineer_fix_errors', details: `Fix scan: ${stuckProcessing} stuck, ${orphanedInvestments} orphaned`, adminId: admin.id } });
        break;
      }

      case 'daily_report': {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [totalUsers, activeUsers, todayDeposits, todayWithdrawals, activeInvestments, totalBalance] = await Promise.all([
          prisma.user.count(), prisma.user.count({ where: { isActive: true } }),
          prisma.transaction.aggregate({ where: { type: 'deposit', status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
          prisma.transaction.aggregate({ where: { type: 'withdrawal', status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
          prisma.investment.count({ where: { status: 'ACTIVE' } }),
          prisma.user.aggregate({ _sum: { balance: true } }),
        ]);
        result = { date: today.toISOString(), totalUsers, activeUsers, todayDeposits: todayDeposits._sum.amount || 0, todayWithdrawals: todayWithdrawals._sum.amount || 0, activeInvestments, totalBalance: totalBalance._sum.balance || 0 };
        await prisma.platformLog.create({ data: { action: 'engineer_daily_report', details: `Daily: Users=${totalUsers}, Deposits=${todayDeposits._sum.amount || 0} USDT`, adminId: admin.id } });
        break;
      }

      case 'genius_mode': {
        const systemData = await collectSystemData();
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const toolList = availableTools.map(t => `- ${t.name} [${t.category}]: ${t.description}`).join('\n');

        const systemPrompt = `You are an EXPERT platform engineer and DevOps architect for the SONA Trading Platform. You have legendary-level expertise in:
- Database performance optimization, query analysis, and scaling strategies
- Financial platform security, compliance, and risk management
- System reliability engineering, incident prediction, and auto-healing
- Trading platform architecture, microservices, and event-driven design
- Web3 integration, smart contracts, and DeFi protocol design
- Load testing, performance benchmarking, and capacity planning
- Code quality analysis, technical debt assessment, and refactoring strategies
- Competitor analysis and feature gap identification

You can TAKE ACTIONS using TOOL_CALL. Format: TOOL_CALL:{"name":"tool_name","params":{}}

Available tools (${availableTools.length} tools):
${toolList}

Analyze the system data comprehensively:

1. **System Health Overview** (score 0-100)
2. **Critical Issues** (prioritized, with severity)
3. **Pattern Analysis** (errors, transactions, user behavior trends)
4. **Predictive Insights** (predict issues before they happen)
5. **Performance Optimization** (specific, actionable recommendations)
6. **Security Hardening** (prioritized security recommendations)
7. **Financial Health** (revenue, risk, growth metrics)
8. **Scaling Readiness** (assessment for 100K user capacity)
9. **Competitor Gap Analysis** (features competitors have that we don't)
10. **Auto-Development Plan** (what features to build next, in priority order)
11. **Action Items** (numbered, ordered by priority)

Be specific, data-driven, and actionable. Use TOOL_CALL for any auto-fixable issues.`;

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `SONA Platform system data:\n\n${JSON.stringify(systemData, null, 2)}\n\nProvide comprehensive analysis with TOOL_CALL for auto-fixable issues.` },
          ],
          temperature: 0.3,
          max_tokens: 6000,
        });

        const aiAnalysis: string = completion.choices?.[0]?.message?.content || 'No analysis generated';

        // Parse and execute TOOL_CALLs
        const toolCallRegex = /TOOL_CALL:\s*(\{[^}]+\})/g;
        const toolCalls: Array<{ name: string; params: Record<string, any>; result: any }> = [];
        let match;
        while ((match = toolCallRegex.exec(aiAnalysis)) !== null) {
          try {
            const toolCall = JSON.parse(match[1]);
            const toolResult = await executeTool(toolCall.name, toolCall.params || {});
            toolCalls.push({ name: toolCall.name, params: toolCall.params || {}, result: toolResult });
          } catch {}
        }

        const cleanAnalysis = aiAnalysis.replace(/TOOL_CALL:\s*\{[^}]+\}/g, '').replace(/\n{3,}/g, '\n\n').trim();

        result = {
          success: true, action: 'genius_mode', systemData, aiAnalysis: cleanAnalysis,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolsExecuted: toolCalls.length,
          model: completion.model || 'deepseek-chat',
          generatedAt: new Date().toISOString(),
        };

        await prisma.platformLog.create({
          data: { action: 'engineer_genius_mode', details: `Genius Mode: DB=${systemData.database.status}, Users=${systemData.database.totalUsers}, ToolCalls=${toolCalls.length}`, adminId: admin.id },
        });
        break;
      }

      // ──── NEW: LEGENDARY ENGINEER ACTIONS ────────────────────────────────

      case 'auto_develop': {
        // AI analyzes what the platform needs and suggests/implements features
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const [userCount, investmentCount, transactionCount, supportTickets] = await Promise.all([
          prisma.user.count(),
          prisma.investment.count(),
          prisma.transaction.count(),
          prisma.supportTicket.count({ where: { status: 'open' } }),
        ]);

        const recentUserFeedback = await prisma.supportTicket.findMany({
          where: { status: 'open', category: { in: ['feature', 'general', 'bug'] } },
          orderBy: { createdAt: 'desc' }, take: 10,
        });

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are a legendary software architect for SONA Trading Platform. Analyze the current platform state and user feedback, then:
1. Identify the TOP 5 features that would have the most impact
2. For each feature, provide: name, description, estimated complexity (1-10), business value (1-10), and implementation outline
3. Rank them by ROI (business value / complexity)
4. Suggest which one to implement FIRST with detailed implementation plan
5. Consider competitor features from Binance, Coinbase, eToro

Be specific and actionable. Think like a CTO of a $100M trading platform.`,
            },
            {
              role: 'user',
              content: `Platform stats: Users=${userCount}, Investments=${investmentCount}, Transactions=${transactionCount}, Open tickets=${supportTickets}
User feedback: ${JSON.stringify(recentUserFeedback.map(t => ({ subject: t.subject, category: t.category })))}
Platform has: Investment packages, daily signals, pool trading, referral system, KYC, deposit/withdraw, support chat.
What should we build next?`,
            },
          ],
          temperature: 0.4,
          max_tokens: 4000,
        });

        result = {
          success: true,
          action: 'auto_develop',
          analysis: completion.choices?.[0]?.message?.content || 'No analysis generated',
          platformStats: { userCount, investmentCount, transactionCount, supportTickets },
          generatedAt: new Date().toISOString(),
        };

        await prisma.platformLog.create({ data: { action: 'engineer_auto_develop', details: `Auto-development analysis: Users=${userCount}, Investments=${investmentCount}`, adminId: admin.id } });
        break;
      }

      case 'competitor_analysis': {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are a competitive intelligence analyst for SONA Trading Platform. Analyze major competitors and provide:
1. Feature comparison table (Binance, Coinbase, eToro, Kraken vs SONA)
2. Key differentiators SONA should build
3. Market positioning strategy for the Arab world
4. Feature priority matrix (impact vs effort)
5. Quick wins (high impact, low effort features)
6. Long-term strategic features (Web3, DeFi, etc.)

Be thorough and strategic. Think like a product strategy consultant.`,
            },
            {
              role: 'user',
              content: 'Analyze competitors for SONA Trading Platform and provide a comprehensive feature gap analysis with prioritized recommendations.',
            },
          ],
          temperature: 0.4,
          max_tokens: 5000,
        });

        result = {
          success: true,
          action: 'competitor_analysis',
          analysis: completion.choices?.[0]?.message?.content || 'No analysis generated',
          generatedAt: new Date().toISOString(),
        };

        await prisma.platformLog.create({ data: { action: 'engineer_competitor_analysis', details: 'Competitor analysis completed', adminId: admin.id } });
        break;
      }

      case 'learn_from_errors': {
        // Deep analysis of error patterns to build prevention systems
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const errors = await prisma.platformLog.findMany({
          where: { action: { contains: 'error' } },
          orderBy: { createdAt: 'desc' }, take: 50,
        });

        const fixes = await prisma.platformLog.findMany({
          where: { action: { contains: 'fix' } },
          orderBy: { createdAt: 'desc' }, take: 50,
        });

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are a reliability engineer for SONA Trading Platform. Analyze error patterns and:
1. Categorize all errors by type and frequency
2. Identify root causes for recurring errors
3. For each recurring error, design a PREVENTION system (not just a fix)
4. Suggest code guards, validation layers, and automated tests
5. Provide specific implementation instructions for each prevention system
6. Estimate the impact of implementing each prevention

The goal is to make these errors IMPOSSIBLE to recur.`,
            },
            {
              role: 'user',
              content: `Error logs (${errors.length}):\n${JSON.stringify(errors.map(e => ({ action: e.action, details: e.details, time: e.createdAt })), null, 2)}\n\nFix logs (${fixes.length}):\n${JSON.stringify(fixes.map(f => ({ action: f.action, details: f.details })), null, 2)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        });

        result = {
          success: true,
          action: 'learn_from_errors',
          totalErrors: errors.length,
          totalFixes: fixes.length,
          analysis: completion.choices?.[0]?.message?.content || 'No analysis generated',
          generatedAt: new Date().toISOString(),
        };

        await prisma.platformLog.create({ data: { action: 'engineer_learn_from_errors', details: `Error learning: ${errors.length} errors analyzed`, adminId: admin.id } });
        break;
      }

      case 'deep_code_review': {
        // AI-powered deep code review of the entire project
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const fs = await import('fs');
        const path = await import('path');
        const projectRoot = process.cwd();
        const srcDir = path.join(projectRoot, 'src');
        const codeSnippets: string[] = [];

        try {
          const scanDir = (dir: string, depth = 0) => {
            if (depth > 2) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') { scanDir(fullPath, depth + 1); }
              else if (entry.isFile() && entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
                try {
                  const content = fs.readFileSync(fullPath, 'utf8');
                  if (content.length < 50000) {
                    codeSnippets.push(`\n=== ${path.relative(projectRoot, fullPath)} (${content.split('\n').length} lines) ===\n${content.substring(0, 2000)}`);
                  }
                } catch {}
              }
            }
          };
          scanDir(srcDir);
        } catch {}

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are a senior code reviewer for the SONA Trading Platform. Review the provided code and identify:
1. **Security vulnerabilities** (SQL injection, XSS, auth bypass, etc.)
2. **Performance bottlenecks** (N+1 queries, missing indexes, heavy computations)
3. **Code quality issues** (anti-patterns, type safety, error handling)
4. **Scalability concerns** (state management, memory leaks, connection pooling)
5. **Architecture improvements** (component splitting, state management patterns)
6. **Specific fixes** for each issue found

Prioritize by severity: Critical > High > Medium > Low.
Provide exact file paths and line numbers where possible.`,
            },
            {
              role: 'user',
              content: `Review this codebase (${codeSnippets.length} files scanned):\n\n${codeSnippets.join('\n').substring(0, 15000)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 5000,
        });

        result = {
          success: true,
          action: 'deep_code_review',
          filesScanned: codeSnippets.length,
          review: completion.choices?.[0]?.message?.content || 'No review generated',
          generatedAt: new Date().toISOString(),
        };

        await prisma.platformLog.create({ data: { action: 'engineer_deep_code_review', details: `Code review: ${codeSnippets.length} files scanned`, adminId: admin.id } });
        break;
      }

      case 'scaling_plan': {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const systemData = await collectSystemData();

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are a cloud infrastructure architect for SONA Trading Platform. Create a detailed scaling plan:
1. **Current State Assessment**: What we have now (SQLite, single server, etc.)
2. **Phase 1 (0-1K users)**: Quick wins - caching, query optimization, connection pooling
3. **Phase 2 (1K-10K users)**: Database migration (SQLite → PostgreSQL), Redis cache, CDN setup
4. **Phase 3 (10K-50K users)**: Load balancing, horizontal scaling, read replicas
5. **Phase 4 (50K-100K users)**: Microservices, message queues, auto-scaling, K8s
6. **Cost Estimation** for each phase
7. **Timeline** for each phase
8. **Risk Mitigation** for each migration step

Be very specific with technologies, configurations, and implementation steps.`,
            },
            {
              role: 'user',
              content: `Current platform data:\n${JSON.stringify(systemData, null, 2)}\n\nTech stack: Next.js 14, Prisma ORM, SQLite, PM2, Cloudflare Tunnel\nProvide a detailed 4-phase scaling plan.`,
            },
          ],
          temperature: 0.4,
          max_tokens: 5000,
        });

        result = {
          success: true,
          action: 'scaling_plan',
          analysis: completion.choices?.[0]?.message?.content || 'No plan generated',
          currentData: systemData,
          generatedAt: new Date().toISOString(),
        };

        await prisma.platformLog.create({ data: { action: 'engineer_scaling_plan', details: 'Scaling plan generated', adminId: admin.id } });
        break;
      }

      case 'auto_document': {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const fs = await import('fs');
        const path = await import('path');
        const projectRoot = process.cwd();
        const apiDir = path.join(projectRoot, 'src/app/api');
        const endpoints: string[] = [];

        try {
          const scanDir = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) { scanDir(fullPath); }
              else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                try {
                  const content = fs.readFileSync(fullPath, 'utf8');
                  endpoints.push(`\n=== ${path.relative(projectRoot, fullPath)} ===\n${content.substring(0, 1500)}`);
                } catch {}
              }
            }
          };
          scanDir(apiDir);
        } catch {}

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Generate comprehensive API documentation for the SONA Trading Platform. Include: endpoint, method, description, request body, response format, authentication requirements, and example requests. Format in clean markdown.',
            },
            {
              role: 'user',
              content: `API route files (${endpoints.length} endpoints):\n\n${endpoints.join('\n').substring(0, 12000)}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 5000,
        });

        result = {
          success: true,
          action: 'auto_document',
          endpointsDocumented: endpoints.length,
          documentation: completion.choices?.[0]?.message?.content || 'No documentation generated',
          generatedAt: new Date().toISOString(),
        };

        await upsertSetting('engineer_auto_documentation', JSON.stringify({ generatedAt: new Date().toISOString(), endpointsCount: endpoints.length }));
        await prisma.platformLog.create({ data: { action: 'engineer_auto_document', details: `Documentation generated: ${endpoints.length} endpoints`, adminId: admin.id } });
        break;
      }

      case 'chat_with_engineer': {
        // Interactive chat with the engineer agent
        const { message, history } = body;
        if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const systemData = await collectSystemData();

        const chatHistory = Array.isArray(history) ? history.slice(-10).map((h: any) => ({ role: h.role, content: h.content })) : [];

        const completion = await zai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are the SONA Platform Engineer Agent - a legendary software architect who monitors, maintains, and develops the platform. You have full access to the system data and can:

1. Analyze any technical issue instantly
2. Suggest and explain code changes
3. Review architecture decisions
4. Debug complex problems
5. Plan feature implementations
6. Assess security and performance
7. Execute tools via TOOL_CALL when you can fix something automatically

Current system data:
${JSON.stringify(systemData, null, 2)}

Respond in ${body.lang === 'ar' ? 'Arabic' : 'English'}. Be technical but clear. If you can auto-fix something, use TOOL_CALL:{"name":"tool_name","params":{}}`,
            },
            ...chatHistory,
            { role: 'user', content: message },
          ],
          temperature: 0.4,
          max_tokens: 3000,
        });

        let response = completion.choices?.[0]?.message?.content || 'No response';

        // Execute any TOOL_CALLs
        const toolCallRegex = /TOOL_CALL:\s*(\{[^}]+\})/g;
        const toolCalls: any[] = [];
        let match;
        while ((match = toolCallRegex.exec(response)) !== null) {
          try {
            const tc = JSON.parse(match[1]);
            const tResult = await executeTool(tc.name, tc.params || {});
            toolCalls.push({ name: tc.name, result: tResult });
          } catch {}
        }
        response = response.replace(/TOOL_CALL:\s*\{[^}]+\}/g, '').replace(/\n{3,}/g, '\n\n').trim();

        result = { success: true, action: 'chat_with_engineer', response, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };

        await prisma.platformLog.create({ data: { action: 'engineer_chat', details: `Chat: "${message.substring(0, 50)}..."`, adminId: admin.id } });
        break;
      }

      // ──── EXISTING ACTIONS (preserved) ───────────────────────────────────

      case 'performance_optimization': {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        let dbResponseTime = 0;
        try { const start = Date.now(); await prisma.$queryRaw`SELECT 1`; dbResponseTime = Date.now() - start; } catch { dbResponseTime = -1; }

        const [totalUsers, totalTransactions, totalInvestments, totalLogs, totalNotifications, totalChatMessages, totalSupportTickets, totalReferrals, pendingDeposits, pendingWithdrawals, processingTransactions, recentLogsCount, oldLogsCount, unverifiedUsersCount] = await Promise.all([
          prisma.user.count(), prisma.transaction.count(), prisma.investment.count(), prisma.platformLog.count(), prisma.notification.count(),
          prisma.chatMessage.count(), prisma.supportTicket.count(), prisma.referral.count(),
          prisma.transaction.count({ where: { type: 'deposit', status: 'PENDING' } }),
          prisma.transaction.count({ where: { type: 'withdrawal', status: 'PENDING' } }),
          prisma.transaction.count({ where: { status: 'PROCESSING' } }),
          prisma.platformLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
          prisma.platformLog.count({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } }),
          prisma.user.count({ where: { emailVerified: false } }),
        ]);

        const recommendations: string[] = [];
        if (dbResponseTime > 100) recommendations.push(`DB response ${dbResponseTime}ms - optimize queries/indexes`);
        if (totalLogs > 100000) recommendations.push(`PlatformLog: ${totalLogs} records - archive old logs`);
        if (totalNotifications > 50000) recommendations.push(`Notification: ${totalNotifications} records - clean read notifications`);
        if (oldLogsCount > 10000) recommendations.push(`${oldLogsCount} logs >30 days can be deleted`);
        if (processingTransactions > 10) recommendations.push(`${processingTransactions} stuck PROCESSING transactions`);

        result = {
          success: true, action: 'performance_optimization',
          database: { responseTimeMs: dbResponseTime, status: dbResponseTime < 50 ? 'fast' : dbResponseTime < 200 ? 'normal' : 'slow' },
          tableSizes: { users: totalUsers, transactions: totalTransactions, investments: totalInvestments, logs: totalLogs, notifications: totalNotifications, chatMessages: totalChatMessages, supportTickets: totalSupportTickets, referrals: totalReferrals },
          concerns: { pendingDeposits, pendingWithdrawals, processingTransactions, oldLogsCount, unverifiedUsersCount },
          recommendations, logsLast24h: recentLogsCount,
        };
        await prisma.platformLog.create({ data: { action: 'engineer_performance_optimization', details: `Performance: DB=${dbResponseTime}ms, Recommendations=${recommendations.length}`, adminId: admin.id } });
        break;
      }

      case 'cleanup_database': {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        const [deletedLogs, deletedNotifications, deletedClosedTickets, deletedClosedConversations, deletedReferrals] = await Promise.all([
          prisma.platformLog.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
          prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: thirtyDaysAgo } } }),
          prisma.supportTicket.deleteMany({ where: { status: { in: ['closed', 'resolved'] }, updatedAt: { lt: thirtyDaysAgo } } }),
          prisma.chatConversation.deleteMany({ where: { status: 'CLOSED', updatedAt: { lt: thirtyDaysAgo } } }),
          prisma.referral.deleteMany({ where: { status: 'COMPLETED', createdAt: { lt: thirtyDaysAgo } } }),
        ]);
        const totalDeleted = deletedLogs.count + deletedNotifications.count + deletedClosedTickets.count + deletedClosedConversations.count + deletedReferrals.count;
        result = {
          success: true, action: 'cleanup_database', cutoffDate: thirtyDaysAgo.toISOString(),
          cleaned: { oldLogs: deletedLogs.count, readNotifications: deletedNotifications.count, closedSupportTickets: deletedClosedTickets.count, closedConversations: deletedClosedConversations.count, completedReferrals: deletedReferrals.count },
          totalDeleted,
          note: 'Completed transactions kept for audit.',
        };
        await prisma.platformLog.create({ data: { action: 'engineer_cleanup_database', details: `Cleanup: ${totalDeleted} records deleted`, adminId: admin.id } });
        break;
      }

      case 'monitor_api_health': {
        const apiEndpoints = [
          { name: 'Auth API', path: '/api/auth' },
          { name: 'Packages API', path: '/api/packages' },
          { name: 'Market API', path: '/api/market' },
          { name: 'Signals API', path: '/api/signals' },
          { name: 'Admin Stats API', path: '/api/admin/stats' },
          { name: 'Admin Users API', path: '/api/admin/users' },
          { name: 'Engineer Agent API', path: '/api/admin/engineer-agent' },
        ];
        const baseUrl = new URL(request.url).origin;
        const results = await Promise.allSettled(
          apiEndpoints.map(async (ep) => {
            const start = Date.now();
            try {
              const res = await fetch(`${baseUrl}${ep.path}`, { method: 'GET', signal: AbortSignal.timeout(5000) });
              return { ...ep, status: res.ok ? 'healthy' : 'degraded', statusCode: res.status, responseTime: Date.now() - start };
            } catch {
              return { ...ep, status: 'unreachable', statusCode: 0, responseTime: Date.now() - start };
            }
          })
        );
        const endpoints = results.map(r => r.status === 'fulfilled' ? r.value : { name: 'Unknown', status: 'error', statusCode: 0, responseTime: 0 });
        const summary = {
          healthy: endpoints.filter(e => e.status === 'healthy').length,
          degraded: endpoints.filter(e => e.status === 'degraded').length,
          unreachable: endpoints.filter(e => e.status === 'unreachable').length,
          avgResponseTimeMs: Math.round(endpoints.reduce((s, e) => s + (e.responseTime || 0), 0) / endpoints.length),
        };
        result = { success: true, action: 'monitor_api_health', endpoints, summary };
        await prisma.platformLog.create({ data: { action: 'engineer_api_health', details: `API Health: ${summary.healthy}/${endpoints.length} healthy, avg=${summary.avgResponseTimeMs}ms`, adminId: admin.id } });
        break;
      }

      case 'backup_report': {
        const now = new Date();
        const [totalUsers, activeUsers, inactiveUsers, adminUsers, unverifiedEmailUsers, usersWith2FA, totalBalance, totalProfit, totalDeposited, totalWithdrawn, withdrawableBalance, nonWithdrawableProfit, lockedCapital, totalInvestments, activeInvestments, completedInvestments, totalActiveInvestmentAmount, totalInvestmentProfit, totalTransactions, pendingTransactions, completedTransactions, totalDepositAmount, totalWithdrawalAmount, kycNone, kycPending, kycApproved, kycRejected, poolInfo, totalPackages, activePackages, totalReferrals, pendingReferrals, completedReferrals, totalSignalRecords, activeSignals, totalNotifications, unreadNotifications, totalSupportTickets, openTickets, closedTickets, totalChatConversations, openConversations, totalChatMessages] = await Promise.all([
          prisma.user.count(), prisma.user.count({ where: { isActive: true } }), prisma.user.count({ where: { isActive: false } }),
          prisma.user.count({ where: { role: 'admin' } }), prisma.user.count({ where: { emailVerified: false } }), prisma.user.count({ where: { twoFactorEnabled: true } }),
          prisma.user.aggregate({ _sum: { balance: true } }), prisma.user.aggregate({ _sum: { totalProfit: true } }),
          prisma.user.aggregate({ _sum: { totalDeposited: true } }), prisma.user.aggregate({ _sum: { totalWithdrawn: true } }),
          prisma.user.aggregate({ _sum: { withdrawableBalance: true } }), prisma.user.aggregate({ _sum: { nonWithdrawableProfit: true } }),
          prisma.user.aggregate({ _sum: { lockedCapital: true } }),
          prisma.investment.count(), prisma.investment.count({ where: { status: 'ACTIVE' } }), prisma.investment.count({ where: { status: 'COMPLETED' } }),
          prisma.investment.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true } }), prisma.investment.aggregate({ where: { status: 'ACTIVE' }, _sum: { totalProfit: true } }),
          prisma.transaction.count(), prisma.transaction.count({ where: { status: 'PENDING' } }), prisma.transaction.count({ where: { status: 'COMPLETED' } }),
          prisma.transaction.aggregate({ where: { type: 'deposit' }, _sum: { amount: true } }), prisma.transaction.aggregate({ where: { type: 'withdrawal' }, _sum: { amount: true } }),
          prisma.user.count({ where: { kycStatus: 'NONE' } }), prisma.user.count({ where: { kycStatus: 'PENDING' } }),
          prisma.user.count({ where: { kycStatus: { in: ['APPROVED', 'VERIFIED'] } } }), prisma.user.count({ where: { kycStatus: 'REJECTED' } }),
          prisma.pool.findFirst({ where: { status: 'ACTIVE' } }),
          prisma.package.count(), prisma.package.count({ where: { isActive: true } }),
          prisma.referral.count(), prisma.referral.count({ where: { status: 'PENDING' } }), prisma.referral.count({ where: { status: 'COMPLETED' } }),
          prisma.signalRecord.count(), prisma.signalRecord.count({ where: { type: 'active' } }),
          prisma.notification.count(), prisma.notification.count({ where: { isRead: false } }),
          prisma.supportTicket.count(), prisma.supportTicket.count({ where: { status: 'open' } }), prisma.supportTicket.count({ where: { status: 'closed' } }),
          prisma.chatConversation.count(), prisma.chatConversation.count({ where: { status: 'OPEN' } }), prisma.chatMessage.count(),
        ]);
        result = {
          success: true, action: 'backup_report', generatedAt: now.toISOString(),
          users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, admins: adminUsers, unverifiedEmail: unverifiedEmailUsers, with2FA: usersWith2FA, balances: { totalBalance: totalBalance._sum.balance || 0, totalProfit: totalProfit._sum.totalProfit || 0, totalDeposited: totalDeposited._sum.totalDeposited || 0, totalWithdrawn: totalWithdrawn._sum.totalWithdrawn || 0, withdrawableBalance: withdrawableBalance._sum.withdrawableBalance || 0, nonWithdrawableProfit: nonWithdrawableProfit._sum.nonWithdrawableProfit || 0, lockedCapital: lockedCapital._sum.lockedCapital || 0 } },
          investments: { total: totalInvestments, active: activeInvestments, completed: completedInvestments, activeAmount: totalActiveInvestmentAmount._sum.amount || 0, activeProfit: totalInvestmentProfit._sum.totalProfit || 0 },
          transactions: { total: totalTransactions, pending: pendingTransactions, completed: completedTransactions, totalDepositAmount: totalDepositAmount._sum.amount || 0, totalWithdrawalAmount: totalWithdrawalAmount._sum.amount || 0 },
          kyc: { none: kycNone, pending: kycPending, approved: kycApproved, rejected: kycRejected },
          pool: poolInfo ? { totalFunds: poolInfo.totalFunds, totalProfit: poolInfo.totalProfit, totalLoss: poolInfo.totalLoss, platformCommission: poolInfo.platformCommission, activeTrades: poolInfo.activeTrades } : null,
          support: { totalTickets: totalSupportTickets, openTickets, closedTickets, totalConversations: totalChatConversations, openConversations, totalMessages: totalChatMessages },
          packages: { total: totalPackages, active: activePackages },
          referrals: { total: totalReferrals, pending: pendingReferrals, completed: completedReferrals },
          signals: { total: totalSignalRecords, active: activeSignals },
          notifications: { total: totalNotifications, unread: unreadNotifications },
        };
        await prisma.platformLog.create({ data: { action: 'engineer_backup_report', details: `Backup: Users=${totalUsers}, Balance=${totalBalance._sum.balance || 0} USDT`, adminId: admin.id } });
        break;
      }

      case 'schedule_diagnostics': {
        const { schedule } = body;
        if (!schedule) return NextResponse.json({ error: 'schedule required' }, { status: 400 });
        await upsertSetting('schedule_diagnostics', JSON.stringify({ task: 'diagnostics', cron: schedule, enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
        result = { success: true, action: 'schedule_diagnostics', schedule, message: `Diagnostics schedule: ${schedule}` };
        await prisma.platformLog.create({ data: { action: 'engineer_schedule_diagnostics', details: `Schedule: ${schedule}`, adminId: admin.id } });
        break;
      }

      case 'schedule_security_scan': {
        const { schedule } = body;
        if (!schedule) return NextResponse.json({ error: 'schedule required' }, { status: 400 });
        await upsertSetting('schedule_security_scan', JSON.stringify({ task: 'security_scan', cron: schedule, enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
        result = { success: true, action: 'schedule_security_scan', schedule, message: `Security scan schedule: ${schedule}` };
        await prisma.platformLog.create({ data: { action: 'engineer_schedule_security_scan', details: `Schedule: ${schedule}`, adminId: admin.id } });
        break;
      }

      case 'get_schedules': {
        const [diagSetting, secSetting] = await Promise.all([getSetting('schedule_diagnostics'), getSetting('schedule_security_scan')]);
        const schedules: any[] = [];
        if (diagSetting) { try { const p = JSON.parse(diagSetting.value); schedules.push({ id: diagSetting.id, key: 'schedule_diagnostics', task: 'diagnostics', cron: p.cron, enabled: p.enabled, createdAt: p.createdAt, updatedAt: p.updatedAt }); } catch { schedules.push({ id: diagSetting.id, key: 'schedule_diagnostics', task: 'diagnostics', cron: diagSetting.value, enabled: true, raw: true }); } }
        if (secSetting) { try { const p = JSON.parse(secSetting.value); schedules.push({ id: secSetting.id, key: 'schedule_security_scan', task: 'security_scan', cron: p.cron, enabled: p.enabled, createdAt: p.createdAt, updatedAt: p.updatedAt }); } catch { schedules.push({ id: secSetting.id, key: 'schedule_security_scan', task: 'security_scan', cron: secSetting.value, enabled: true, raw: true }); } }
        result = { success: true, action: 'get_schedules', schedules };
        break;
      }

      case 'toggle_schedule': {
        const { scheduleKey, enabled } = body;
        if (!scheduleKey || typeof enabled !== 'boolean') return NextResponse.json({ error: 'scheduleKey and enabled required' }, { status: 400 });
        const validKeys = ['schedule_diagnostics', 'schedule_security_scan'];
        if (!validKeys.includes(scheduleKey)) return NextResponse.json({ error: 'Invalid scheduleKey' }, { status: 400 });
        const existing = await getSetting(scheduleKey);
        if (!existing) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        let parsed: any; try { parsed = JSON.parse(existing.value); } catch { parsed = { task: scheduleKey.replace('schedule_', ''), cron: existing.value, enabled: true }; }
        parsed.enabled = enabled; parsed.updatedAt = new Date().toISOString();
        await upsertSetting(scheduleKey, JSON.stringify(parsed));
        result = { success: true, action: 'toggle_schedule', scheduleKey, enabled };
        await prisma.platformLog.create({ data: { action: 'engineer_toggle_schedule', details: `${scheduleKey} ${enabled ? 'enabled' : 'disabled'}`, adminId: admin.id } });
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action', availableActions: ['diagnostics', 'security_scan', 'fix_errors', 'daily_report', 'genius_mode', 'performance_optimization', 'cleanup_database', 'monitor_api_health', 'backup_report', 'auto_develop', 'competitor_analysis', 'learn_from_errors', 'deep_code_review', 'scaling_plan', 'auto_document', 'chat_with_engineer', 'schedule_diagnostics', 'schedule_security_scan', 'get_schedules', 'toggle_schedule'] }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
