'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Users,
  Gift,
  Copy,
  CheckCircle,
  ChevronLeft,
  Clock,
  Sparkles,
  ArrowLeftRight,
  ArrowRight,
  Plus,
  RefreshCw,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import WelcomeOverlay from '@/components/platform/WelcomeOverlay';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Investment {
  id: string;
  amount: number;
  dailyProfit: number;
  totalProfit: number;
  daysElapsed: number;
  status: string;
  package: { name: string; nameEn: string; durationDays: number; color: string; dailyReturn: number };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  createdAt: string;
}

const typeLabels: Record<string, string> = {};
const statusLabels: Record<string, string> = {};

export default function DashboardHome() {
  const { user, setDashboardPage, refreshUser } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch(`/api/user/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setInvestments(data.user?.investments || []);
        setTransactions(data.user?.transactions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      // Update translation labels
      const _typeLabels: Record<string, string> = {
        deposit: t('wallet.depositLabel'),
        withdrawal: t('wallet.withdrawalLabel'),
        investment: t('wallet.investmentLabel'),
        profit: t('wallet.profitLabel'),
      };
      const _statusLabels: Record<string, string> = {
        COMPLETED: t('wallet.completedStatus'),
        PENDING: t('wallet.pendingStatus'),
        FAILED: t('wallet.failedStatus'),
        APPROVED: t('wallet.approvedStatus'),
        REJECTED: t('wallet.rejectedStatus'),
      };
      Object.assign(typeLabels, _typeLabels);
      Object.assign(statusLabels, _statusLabels);
    }
  }, [user, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    try {
      const welcomed = localStorage.getItem('sona_welcomed');
      if (welcomed) return;
      // Show for new users: balance is 0 and no investments
      const isNewUser = (user.balance === 0 || user.balance == null) && investments.length === 0;
      if (isNewUser) {
        setShowWelcome(true);
      }
    } catch {}
  }, [user, investments.length]);

  const handleRefreshProfits = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/profits/calculate', { method: 'POST' });
      await refreshUser();
      await loadData();
    } catch {
      // ignore
    }
    setTimeout(() => setRefreshing(false), 600);
  };

  const copyReferralCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const activeInvestments = investments.filter((i) => i.status === 'ACTIVE');
  const recentTransactions = transactions.slice(0, 5);

  // Get current date in Arabic
  const currentDate = new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Generate chart data with stable seed to avoid flickering
  const chartData = useMemo(() => {
    const days = isRTL
      ? ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
      : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    if (activeInvestments.length === 0) {
      return days.map((day) => ({ day, profit: 0 }));
    }
    const dailyTotal = activeInvestments.reduce((sum, i) => sum + i.dailyProfit, 0);
    // Deterministic multipliers instead of Math.random()
    const stableMultipliers = [0.88, 0.92, 0.95, 0.98, 1.02, 1.06, 1.10];
    return days.map((day, idx) => ({
      day,
      profit: Number((dailyTotal * stableMultipliers[idx] * ((idx + 1) / 7)).toFixed(2)),
    }));
  }, [activeInvestments, isRTL]);

  // Safe number formatter - prevents toFixed crash on undefined/null
  const safeFixed = (n: number | undefined | null, digits: number = 2): string => {
    if (n === undefined || n === null || isNaN(n)) return '0.' + '0'.repeat(digits);
    return Number(n).toFixed(digits);
  };

  const stats = [
    {
      label: t('wallet.availableBalance'),
      value: safeFixed(user?.balance),
      icon: Wallet,
      color: '#409eff',
      bgColor: 'rgba(201,168,76,0.08)',
      change: '',
    },
    {
      label: t('dashboard.totalDeposited'),
      value: safeFixed((user as any)?.totalDeposited ?? (user as any)?.totalDeposit),
      icon: ArrowDownToLine,
      color: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.08)',
      change: '',
    },
    {
      label: t('dashboard.totalWithdrawn'),
      value: safeFixed((user as any)?.totalWithdrawn ?? (user as any)?.totalWithdraw),
      icon: ArrowUpFromLine,
      color: '#ef4444',
      bgColor: 'rgba(239,68,68,0.08)',
      change: '',
    },
    {
      label: t('dashboard.totalProfits') || 'إجمالي أرباحي',
      value: safeFixed((user as any)?.totalProfit),
      icon: TrendingUp,
      color: '#22c55e',
      bgColor: 'rgba(34,197,94,0.08)',
      change: '',
    },
    {
      label: t('dashboard.totalInvestments') || 'إجمالي استثماراتي',
      value: safeFixed(activeInvestments.reduce((sum, i) => sum + i.amount, 0)),
      icon: Briefcase,
      color: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.08)',
      change: '',
    },
  ];

  const quickActions = [
    {
      label: t('dashboard.depositNow'),
      desc: t('dashboard.depositSafely'),
      icon: ArrowDownToLine,
      page: 'deposit' as const,
      gradient: 'from-emerald-600/20 to-emerald-900/10',
      border: 'border-emerald-500/15',
      iconColor: 'text-emerald-400',
      hoverBorder: 'hover:border-emerald-500/30',
    },
    {
      label: t('dashboard.newInvestment'),
      desc: t('dashboard.chooseAndInvest'),
      icon: Sparkles,
      page: 'packages' as const,
      gradient: 'from-[#409eff]/15 to-[#1e6fbb]/5',
      border: 'border-[#409eff]/15',
      iconColor: 'text-[#409eff]',
      hoverBorder: 'hover:border-[#409eff]/30',
    },
    {
      label: t('dashboard.withdrawProfits'),
      desc: t('dashboard.withdrawEasily'),
      icon: ArrowUpFromLine,
      page: 'withdraw' as const,
      gradient: 'from-red-600/15 to-red-900/5',
      border: 'border-red-500/15',
      iconColor: 'text-red-400',
      hoverBorder: 'hover:border-red-500/30',
    },
    {
      label: t('dashboard.p2pTransfer') || (isRTL ? 'تحويل P2P' : 'P2P Transfer'),
      desc: t('dashboard.p2pTransferDesc') || (isRTL ? 'حوّل أموالك مجاناً' : 'Transfer funds for free'),
      icon: ArrowLeftRight,
      page: 'p2p' as const,
      gradient: 'from-purple-600/15 to-purple-900/5',
      border: 'border-purple-500/15',
      iconColor: 'text-purple-400',
      hoverBorder: 'hover:border-purple-500/30',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#409eff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {showWelcome && <WelcomeOverlay onClose={() => setShowWelcome(false)} />}
      {/* Welcome Section - Professional Financial Platform Feel */}
      <div className="rounded-xl bg-gradient-to-l from-[#409eff]/[0.08] to-[#1f2634] border border-[#409eff]/10 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#409eff]/10 shrink-0">
              <Sparkles size={24} className="text-[#409eff]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {t('dashboard.welcome')}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/50 text-sm">{t('dashboard.welcomeUser')} {user?.name?.split(' ')[0]}</span>
                {user?.emailVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                    <ShieldCheck size={10} />
                    {t('dashboard.verifiedAccount')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left sm:text-right">
              <div className="text-white/30 text-xs">{t('dashboard.liveBalance')}</div>
              <div className="text-[#409eff] font-bold text-xl" dir="ltr">${safeFixed(user?.balance)}</div>
            </div>
            <button
              onClick={handleRefreshProfits}
              disabled={refreshing}
              className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-[#409eff] hover:border-[#409eff]/20 transition-all disabled:opacity-50"
              title={t('nav.refreshProfits')}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Email Verification Banner */}
      {user && !user.emailVerified && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <ShieldAlert size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-400 text-sm font-medium">{t('verification.emailNotVerified')}</p>
              <p className="text-amber-400/40 text-xs mt-0.5">{t('dashboard.verifyYourEmail')}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/send-verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: user.email }),
                });
                await refreshUser();
              } catch {
                // ignore
              }
            }}
            className="px-4 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors flex items-center gap-2 shrink-0"
          >
            {t('dashboard.verifyResend')}
            <ArrowLeft size={14} />
          </button>
        </motion.div>
      )}

      {/* Verified Badge */}
      {user?.emailVerified && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 py-2 px-3 rounded-lg bg-green-500/[0.04] border border-green-500/10"
        >
          <ShieldCheck size={14} className="text-green-400" />
          <span className="text-green-400/60 text-xs">{t('verification.emailVerified')}</span>
        </motion.div>
      )}

      {/* ===== PROMINENT TOTAL PROFITS & INVESTMENTS SECTION ===== */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Profits Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="rounded-xl bg-gradient-to-br from-green-500/[0.08] to-[#1f2634] border border-green-500/15 p-5 sm:p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-32 h-32 bg-green-500/[0.04] rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-green-500/15">
                <TrendingUp size={20} className="text-green-400" />
              </div>
              <span className="text-green-400/70 text-xs font-medium">
                {t('dashboard.totalProfits') || 'إجمالي أرباحي'}
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400/50 font-medium">
                {isRTL ? 'يومي' : 'Daily'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-green-400" dir="ltr">
              ${safeFixed((user as any)?.totalProfit)}
            </div>
            {activeInvestments.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-green-400/40 text-[10px]">
                  +${safeFixed(activeInvestments.reduce((sum, i) => sum + i.dailyProfit, 0))} {isRTL ? '/ يوم' : '/ day'}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Total Investments Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-xl bg-gradient-to-br from-[#409eff]/[0.08] to-[#1f2634] border border-[#409eff]/15 p-5 sm:p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#409eff]/[0.04] rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-[#409eff]/15">
                <Briefcase size={20} className="text-[#409eff]" />
              </div>
              <span className="text-[#409eff]/70 text-xs font-medium">
                {t('dashboard.totalInvestments') || 'إجمالي استثماراتي'}
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff]/50 font-medium">
                {isRTL ? 'نشط' : 'Active'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#409eff]" dir="ltr">
              ${safeFixed(activeInvestments.reduce((sum, i) => sum + i.amount, 0))}
            </div>
            {activeInvestments.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[#409eff]/40 text-[10px]">
                  {activeInvestments.length} {isRTL ? 'استثمار نشط' : 'active investments'}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="rounded-xl bg-[#1f2634] border border-white/5 p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/35 text-xs sm:text-sm">{s.label}</span>
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: s.bgColor, color: s.color }}
                >
                  <Icon size={18} />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-bold" style={{ color: s.color }} dir="ltr">
                ${s.value}
              </div>
              {s.change && (
                <div className="mt-1 text-xs text-green-400/60" dir="ltr">{s.change}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
              onClick={() => setDashboardPage(a.page)}
              className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-l ${a.gradient} border ${a.border} ${a.hoverBorder} transition-all duration-200 text-right`}
            >
              <div className={`p-2.5 rounded-lg bg-white/[0.04] ${a.iconColor} shrink-0`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">{a.label}</div>
                <div className="text-white/30 text-xs mt-0.5">{a.desc}</div>
              </div>
              <ChevronLeft size={16} className="text-white/15 shrink-0" />
            </motion.button>
          );
        })}
      </div>

      {/* Active Investments + Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* My Investments */}
        <div className="lg:col-span-3 rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm sm:text-base">{t('dashboard.myActiveInvestments')}</h3>
            {activeInvestments.length > 0 && (
              <button
                onClick={() => setDashboardPage('investments')}
                className="text-[#409eff] text-xs hover:underline flex items-center gap-1"
              >
                {t('dashboard.viewAll')}
                <ArrowLeft size={12} />
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5">
            {activeInvestments.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeInvestments.slice(0, 4).map((inv) => {
                  const progress = Math.min(
                    (inv.daysElapsed / inv.package.durationDays) * 100,
                    100
                  );
                  const earned = inv.totalProfit;
                  return (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: inv.package.color }}
                          />
                          <span className="text-white font-medium text-sm">
                            {inv.package.name}
                          </span>
                        </div>
                        {inv.package.nameEn === 'SONA' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff] font-medium">
                              {t('dashboard.activeTradingStrategy')}
                            </span>
                            <button
                              onClick={() => setDashboardPage('trading')}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-[#409eff]/20 text-[#409eff] font-bold hover:bg-[#409eff]/30 transition-colors"
                            >
                              {t('dashboard.openTrading')}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                            {t('common.active')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div>
                          <span className="text-white/30">{t('common.amount')}</span>
                          <div className="text-white/80 font-medium mt-0.5" dir="ltr">
                            ${inv.amount}
                          </div>
                        </div>
                        <div>
                          <span className="text-white/30">{inv.package.nameEn === 'SONA' ? t('packages.tradingProfitPotential') : t('myInvestments.dailyProfit')}</span>
                          <div className="text-green-400 font-medium mt-0.5" dir="ltr">
                            ${safeFixed(inv.dailyProfit)}
                          </div>
                        </div>
                        <div>
                          <span className="text-white/30">{t('dashboard.earned')}</span>
                          <div className="text-[#409eff] font-medium mt-0.5" dir="ltr">
                            ${safeFixed(earned)}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: inv.package.color,
                            }}
                          />
                        </div>
                        <span className="text-white/25 text-[10px] shrink-0" dir="ltr">
                          {inv.daysElapsed}/{inv.package.durationDays} {t('common.day')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-4 rounded-2xl bg-white/[0.02] mb-4">
                  <Briefcase size={32} className="text-white/10" />
                </div>
                <p className="text-white/30 text-sm mb-1">{t('dashboard.noInvestments')}</p>
                <p className="text-white/15 text-xs mb-4">{t('dashboard.startInvesting')}</p>
                <button
                  onClick={() => setDashboardPage('packages')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#409eff] text-white text-sm font-bold hover:bg-[#337ecc] transition-colors"
                >
                  <Plus size={16} />
                  {t('dashboard.newInvestment')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Profit Chart */}
        <div className="lg:col-span-2 rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm sm:text-base">{t('dashboard.profitTrend')}</h3>
            <p className="text-white/25 text-xs mt-0.5">{t('dashboard.weeklyView')}</p>
          </div>
          <div className="p-4 sm:p-5">
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#409eff" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#409eff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    dy={8}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2c313e',
                      border: '1px solid rgba(201,168,76,0.15)',
                      borderRadius: '8px',
                      color: '#409eff',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px' }}
                    formatter={(value: any) => [`${safeFixed(value)}`, t('common.profit')]}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#409eff"
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#409eff', stroke: '#030708', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/5">
          <h3 className="text-white font-semibold text-sm sm:text-base">{t('dashboard.recentTransactions')}</h3>
          {transactions.length > 5 && (
            <button
              onClick={() => setDashboardPage('transactions')}
              className="text-[#409eff] text-xs hover:underline flex items-center gap-1"
            >
              {t('dashboard.viewAll')}
              <ArrowLeft size={12} />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                        t.type === 'deposit'
                          ? 'bg-green-500/10 text-green-400'
                          : t.type === 'withdrawal'
                            ? 'bg-red-500/10 text-red-400'
                            : t.type === 'investment'
                              ? 'bg-[#409eff]/10 text-[#409eff]'
                              : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {typeLabels[t.type] || t.type}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        t.type === 'deposit'
                          ? 'text-green-400'
                          : t.type === 'withdrawal'
                            ? 'text-red-400'
                            : t.type === 'investment'
                              ? 'text-[#409eff]'
                              : 'text-emerald-400'
                      }`}
                      dir="ltr"
                    >
                      ${safeFixed(t.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        t.status === 'COMPLETED' || t.status === 'APPROVED'
                          ? 'bg-green-500/10 text-green-400'
                          : t.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {statusLabels[t.status] || t.status}
                    </span>
                    <span className="text-white/15 text-[10px] flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(t.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt size={28} className="text-white/8 mb-3" />
              <p className="text-white/20 text-sm">{t('dashboard.noTransactionsYet')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Referral Banner */}
      <div className="rounded-xl bg-gradient-to-l from-[#409eff]/[0.06] to-[#1f2634] border border-[#409eff]/10 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#409eff]/10 shrink-0">
              <Gift size={24} className="text-[#409eff]" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{t('dashboard.inviteFriends')}</h3>
              <p className="text-white/30 text-xs mt-0.5">
                {t('dashboard.inviteDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#409eff] text-sm font-mono text-center tracking-widest"
              dir="ltr"
            >
              {user?.referralCode || '--------'}
            </div>
            <button
              onClick={copyReferralCode}
              className="p-2.5 rounded-lg bg-[#409eff]/10 text-[#409eff] hover:bg-[#409eff]/20 transition-colors shrink-0"
              title={t('dashboard.copyCode')}
            >
              {copiedCode ? <CheckCircle size={18} /> : <Copy size={18} />}
            </button>
            <button
              onClick={() => setDashboardPage('referral')}
              className="px-4 py-2.5 rounded-lg bg-[#409eff] text-white text-sm font-bold hover:bg-[#337ecc] transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Users size={14} />
              {t('common.share')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
