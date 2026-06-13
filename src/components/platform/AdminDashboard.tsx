'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect } from 'react';
import {
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Briefcase,
  Clock,
  DollarSign,
  Activity,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  UserPlus,
  Receipt,
  Megaphone,
  Newspaper,
  Server,
  Wifi,
  Zap,
  BarChart3,
  Globe,
  UserCheck,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalProfitsDistributed: number;
  activeInvestments: number;
  totalInvestmentsAmount: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalBalance: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  depositsToday: number;
  withdrawalsToday: number;
  revenue: number;
}

interface RecentUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

export default function AdminDashboard({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!user) return;
    try {
      const token = useAppStore.getState().getToken();
      const authHeaders = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const [statsRes, usersRes, txRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders }),
        fetch('/api/admin/users?limit=5', { headers: authHeaders }),
        fetch('/api/admin/transactions?limit=10', { headers: authHeaders }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setRecentUsers(data.users || []);
      }
      if (txRes.ok) {
        const data = await txRes.json();
        setRecentTransactions(data.transactions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    if (!user) return;
    setActionLoading(action);
    setActionResult(null);
    try {
      const token = useAppStore.getState().getToken();
      const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      let res: Response;
      if (action === 'checkDeposits') {
        res = await fetch('/api/admin/deposits/check', {
          method: 'POST',
          headers: authHeaders,
        });
      } else if (action === 'ensureAdmin') {
        res = await fetch('/api/admin/ensure-admin', {
          method: 'POST',
          headers: authHeaders,
        });
      } else if (action === 'fetchNews') {
        res = await fetch('/api/news?fetch=true', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json();
        if (res.ok) {
          setActionResult({ type: 'success', message: `${t('admin.fetchNews')}: ${data.articles?.length || 0}` });
          setActionLoading(null);
          setTimeout(() => setActionResult(null), 5000);
          return;
        }
      } else if (action === 'sendNotification') {
        res = await fetch('/api/notifications', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            broadcast: true,
            type: 'PLATFORM',
            title: t('common.appName'),
            message: t('common.appName'),
          }),
        });
      } else if (action === 'runCron') {
        res = await fetch('/api/cron/daily', {
          method: 'POST',
          headers: authHeaders,
        });
      } else {
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setActionResult({ type: 'success', message: data.message || t('common.success') });
        await loadData();
      } else {
        setActionResult({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setActionResult({ type: 'error', message: t('common.connectionError') });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionResult(null), 5000);
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={36} className="animate-spin text-[#F0B90B]" />
      </div>
    );
  }

  // ─── Key Metrics ───────────────────────────────────────
  const metrics = [
    { label: t('admin.totalUsers'), value: stats?.totalUsers || 0, icon: Users, color: '#F0B90B', bg: 'rgba(240,185,11,0.08)', sub: `+${stats?.newUsersToday || 0} ${t('admin.today')}` },
    { label: t('admin.totalDeposits'), value: `$${safeFixed(stats?.totalDeposits)}`, icon: ArrowDownCircle, color: '#0ECB81', bg: 'rgba(14,203,129,0.08)', sub: `+$${safeFixed(stats?.depositsToday)} ${t('admin.today')}` },
    { label: t('admin.totalWithdrawals'), value: `$${safeFixed(stats?.totalWithdrawals)}`, icon: ArrowUpCircle, color: '#F6465D', bg: 'rgba(246,70,93,0.08)', sub: `-$${safeFixed(stats?.withdrawalsToday)} ${t('admin.today')}` },
    { label: t('admin.platformRevenue'), value: `$${safeFixed(stats?.revenue)}`, icon: DollarSign, color: '#F0B90B', bg: 'rgba(240,185,11,0.08)', sub: '' },
    { label: t('admin.activeInvestments'), value: stats?.activeInvestments || 0, icon: Briefcase, color: '#2563EB', bg: 'rgba(37,99,235,0.08)', sub: `$${safeFixed(stats?.totalInvestmentsAmount)}` },
    { label: t('admin.profitsDistributed'), value: `$${safeFixed(stats?.totalProfitsDistributed)}`, icon: TrendingUp, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', sub: '' },
  ];

  // ─── Pending Alerts ───────────────────────────────────
  const pendingItems = [
    { label: t('admin.pendingDeposits'), value: stats?.pendingDeposits || 0, color: '#F59E0B', icon: ArrowDownToLine },
    { label: t('admin.pendingWithdrawals'), value: stats?.pendingWithdrawals || 0, color: '#F97316', icon: ArrowUpFromLine },
  ];

  const statusColors: Record<string, string> = {
    PENDING: '#F59E0B',
    COMPLETED: '#0ECB81',
    FAILED: '#F6465D',
    PROCESSING: '#2563EB',
    APPROVED: '#0ECB81',
    REJECTED: '#F6465D',
  };

  const statusLabels: Record<string, string> = {
    PENDING: t('common.pending'),
    COMPLETED: t('common.completed'),
    FAILED: t('common.failed'),
    PROCESSING: t('common.loading'),
    APPROVED: t('common.approved'),
    REJECTED: t('common.rejected'),
  };

  const typeLabels: Record<string, string> = {
    deposit: t('transactions.deposit'),
    withdrawal: t('transactions.withdrawal'),
    investment: t('transactions.investment'),
    profit: t('transactions.profit'),
    referral_bonus: t('transactions.referralBonus'),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black text-[#EAECEF] flex items-center gap-3">
            <BarChart3 size={24} className="text-[#F0B90B]" />
            {t('admin.dashboard')}
          </h2>
          <p className="text-[#848E9C] text-sm mt-1">{t('admin.platformStats')}</p>
        </div>
        <button
          onClick={() => loadData()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all"
          style={{ background: 'rgba(240,185,11,0.10)', color: '#F0B90B', border: '1px solid rgba(240,185,11,0.15)' }}
        >
          <RefreshCw size={14} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Action Result Toast */}
      {actionResult && (
        <div
          className="flex items-center gap-3 px-5 py-3.5 rounded-xl text-[14px] font-bold"
          style={{
            background: actionResult.type === 'success' ? 'rgba(14,203,129,0.10)' : 'rgba(246,70,93,0.10)',
            border: actionResult.type === 'success' ? '1px solid rgba(14,203,129,0.20)' : '1px solid rgba(246,70,93,0.20)',
            color: actionResult.type === 'success' ? '#0ECB81' : '#F6465D',
          }}
        >
          {actionResult.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {actionResult.message}
        </div>
      )}

      {/* ─── Key Metrics Grid ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={i}
              className="p-5 rounded-2xl transition-all duration-200 hover:scale-[1.02]"
              style={{ background: '#181A20', border: '1px solid #2B3139' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: m.bg }}>
                  <Icon size={18} style={{ color: m.color }} />
                </div>
                {m.sub && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: m.bg, color: m.color }}>
                    {m.sub}
                  </span>
                )}
              </div>
              <div className="text-[20px] font-black text-[#EAECEF] truncate" dir="ltr">{m.value}</div>
              <div className="text-[#848E9C] text-[12px] font-bold mt-1 truncate">{m.label}</div>
            </div>
          );
        })}
      </div>

      {/* ─── Row: Pending Alerts + Volume Chart + User Stats ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Alerts */}
        <div className="p-6 rounded-2xl" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <h3 className="text-[#EAECEF] text-[16px] font-black mb-5 flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-[#F59E0B]" />
            {t('admin.pendingItems')}
          </h3>
          <div className="space-y-4">
            {pendingItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15` }}>
                      <Icon size={16} style={{ color: item.color }} />
                    </div>
                    <span className="text-[#B7BDC6] text-[14px] font-bold">{item.label}</span>
                  </div>
                  <span className="text-[24px] font-black" style={{ color: item.color }}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume Overview - Pure CSS bars */}
        <div className="p-6 rounded-2xl" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <h3 className="text-[#EAECEF] text-[16px] font-black mb-5 flex items-center gap-2.5">
            <BarChart3 size={18} className="text-[#F0B90B]" />
            {t('admin.volumeChart')}
          </h3>
          <div className="space-y-5">
            {/* Deposits bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#B7BDC6] text-[13px] font-bold">{t('admin.deposits')}</span>
                <span className="text-[#0ECB81] text-[14px] font-black" dir="ltr">${safeFixed(stats?.totalDeposits)}</span>
              </div>
              <div className="w-full h-3 rounded-full" style={{ background: '#1E2329' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ((stats?.totalDeposits || 0) / Math.max(stats?.totalDeposits || 1, stats?.totalWithdrawals || 1)) * 100)}%`, background: 'linear-gradient(90deg, #0ECB81, #0ECB81cc)' }} />
              </div>
              <div className="text-[#848E9C] text-[11px] mt-1" dir="ltr">Today: ${safeFixed(stats?.depositsToday)}</div>
            </div>
            {/* Withdrawals bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#B7BDC6] text-[13px] font-bold">{t('admin.withdrawals')}</span>
                <span className="text-[#F6465D] text-[14px] font-black" dir="ltr">${safeFixed(stats?.totalWithdrawals)}</span>
              </div>
              <div className="w-full h-3 rounded-full" style={{ background: '#1E2329' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ((stats?.totalWithdrawals || 0) / Math.max(stats?.totalDeposits || 1, stats?.totalWithdrawals || 1)) * 100)}%`, background: 'linear-gradient(90deg, #F6465D, #F6465Dcc)' }} />
              </div>
              <div className="text-[#848E9C] text-[11px] mt-1" dir="ltr">Today: ${safeFixed(stats?.withdrawalsToday)}</div>
            </div>
            {/* Net Flow */}
            <div className="mt-4 p-3.5 rounded-xl" style={{ background: 'rgba(240,185,11,0.06)', border: '1px solid rgba(240,185,11,0.10)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[#B7BDC6] text-[13px] font-bold">Net Flow</span>
                <span className="text-[#F0B90B] text-[16px] font-black" dir="ltr">${safeFixed((stats?.totalDeposits || 0) - (stats?.totalWithdrawals || 0))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Stats */}
        <div className="p-6 rounded-2xl" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <h3 className="text-[#EAECEF] text-[16px] font-black mb-5 flex items-center gap-2.5">
            <Users size={18} className="text-[#2563EB]" />
            {t('admin.userGrowth')}
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.10)' }}>
              <div className="text-[#0ECB81] text-[22px] font-black">{stats?.newUsersToday || 0}</div>
              <div className="text-[#848E9C] text-[11px] font-bold mt-1">{t('admin.today')}</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.10)' }}>
              <div className="text-[#2563EB] text-[22px] font-black">{stats?.newUsersThisWeek || 0}</div>
              <div className="text-[#848E9C] text-[11px] font-bold mt-1">{t('admin.thisWeek')}</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.10)' }}>
              <div className="text-[#8B5CF6] text-[22px] font-black">{stats?.newUsersThisMonth || 0}</div>
              <div className="text-[#848E9C] text-[11px] font-bold mt-1">{t('admin.thisMonth')}</div>
            </div>
          </div>
          {/* User Distribution */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0ECB81]" />
                <span className="text-[#B7BDC6] text-[13px] font-bold">{t('common.active')}</span>
              </div>
              <span className="text-[#EAECEF] text-[14px] font-black">{stats?.activeUsers || 0}</span>
            </div>
            <div className="w-full h-2.5 rounded-full" style={{ background: '#1E2329' }}>
              <div className="h-full rounded-full bg-[#0ECB81] transition-all duration-700" style={{ width: `${stats?.totalUsers ? ((stats.activeUsers / stats.totalUsers) * 100) : 0}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#F6465D]" />
                <span className="text-[#B7BDC6] text-[13px] font-bold">{t('common.disabled')}</span>
              </div>
              <span className="text-[#EAECEF] text-[14px] font-black">{stats?.inactiveUsers || 0}</span>
            </div>
            <div className="w-full h-2.5 rounded-full" style={{ background: '#1E2329' }}>
              <div className="h-full rounded-full bg-[#F6465D] transition-all duration-700" style={{ width: `${stats?.totalUsers ? ((stats.inactiveUsers / stats.totalUsers) * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── System Health ─────────────────────────────── */}
      <div className="p-6 rounded-2xl" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
        <h3 className="text-[#EAECEF] text-[16px] font-black mb-5 flex items-center gap-2.5">
          <Server size={18} className="text-[#0ECB81]" />
          {t('admin.systemHealth')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Wifi, label: t('admin.server'), value: t('admin.connected'), color: '#0ECB81' },
            { icon: Activity, label: t('admin.database'), value: t('admin.activeDb'), color: '#0ECB81' },
            { icon: Zap, label: t('admin.automation'), value: t('admin.runsEvery5Min'), color: '#2563EB' },
            { icon: Globe, label: t('admin.activeUsersCount'), value: `${stats?.activeUsers || 0} / ${stats?.totalUsers || 0}`, color: '#848E9C' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: `${item.color}08`, border: `1px solid ${item.color}15` }}>
                <Icon size={18} style={{ color: item.color }} />
                <div>
                  <div className="text-[#848E9C] text-[12px] font-bold">{item.label}</div>
                  <div className="text-[14px] font-black" style={{ color: item.color }}>{item.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Quick Actions ─────────────────────────────── */}
      <div className="p-6 rounded-2xl" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
        <h3 className="text-[#EAECEF] text-[16px] font-black mb-5 flex items-center gap-2.5">
          <Zap size={18} className="text-[#F0B90B]" />
          {t('admin.quickActions')}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'checkDeposits', label: t('admin.checkDeposits'), icon: CheckCircle, color: '#0ECB81' },
            { key: 'ensureAdmin', label: t('admin.ensureAdmin'), icon: Shield, color: '#2563EB' },
            { key: 'fetchNews', label: t('admin.fetchNews'), icon: Newspaper, color: '#8B5CF6' },
            { key: 'sendNotification', label: t('admin.sendNotification'), icon: Megaphone, color: '#06B6D4' },
            { key: 'runCron', label: t('admin.runCron'), icon: Zap, color: '#F0B90B' },
            { key: 'admin_users', label: t('admin.manageUsersShort'), icon: UserPlus, color: '#2563EB', nav: true },
          ].map((action) => {
            const ActionIcon = action.icon;
            const isNav = 'nav' in action;
            return (
              <button
                key={action.key}
                onClick={() => isNav ? (onNavigate ? onNavigate('users') : null) : handleAction(action.key)}
                disabled={!isNav && actionLoading === action.key}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 disabled:opacity-50 hover:scale-[1.03]"
                style={{ background: `${action.color}08`, border: `1px solid ${action.color}15` }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${action.color}15` }}>
                  {actionLoading === action.key ? <Loader2 size={18} className="animate-spin" style={{ color: action.color }} /> : <ActionIcon size={18} style={{ color: action.color }} />}
                </div>
                <span className="text-[12px] font-bold text-center leading-tight" style={{ color: `${action.color}CC` }}>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Recent Users & Transactions ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2B3139' }}>
            <h3 className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
              <Users size={16} className="text-[#2563EB]" />
              {t('admin.recentUsers')}
            </h3>
            <button onClick={() => onNavigate ? onNavigate('users') : null} className="text-[#F0B90B] text-[13px] font-bold hover:underline">
              {t('dashboard.viewAll')} →
            </button>
          </div>
          <div className="p-4">
            {recentUsers.length > 0 ? (
              <div className="space-y-2">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3.5 rounded-xl transition-colors" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2563EB] text-[13px] font-black" style={{ background: 'rgba(37,99,235,0.10)' }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[#EAECEF] text-[14px] font-bold">{u.name}</div>
                        <div className="text-[#848E9C] text-[12px]" dir="ltr">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#F0B90B] text-[14px] font-black" dir="ltr">${safeFixed(u.balance)}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${u.isActive ? 'bg-[#0ECB81]' : 'bg-[#F6465D]'}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Users size={32} className="text-[#2B3139] mx-auto mb-3" />
                <p className="text-[#5E6673] text-[14px] font-bold">{t('admin.noUsers')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2B3139' }}>
            <h3 className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
              <Receipt size={16} className="text-[#F0B90B]" />
              {t('admin.recentTransactions')}
            </h3>
            <button onClick={() => onNavigate ? onNavigate('transactions') : null} className="text-[#F0B90B] text-[13px] font-bold hover:underline">
              {t('dashboard.viewAll')} →
            </button>
          </div>
          <div className="p-4">
            {recentTransactions.length > 0 ? (
              <div className="space-y-2">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{
                        background: tx.type === 'deposit' ? 'rgba(14,203,129,0.10)' : tx.type === 'withdrawal' ? 'rgba(246,70,93,0.10)' : 'rgba(37,99,235,0.10)',
                      }}>
                        {tx.type === 'deposit' ? <ArrowDownToLine size={14} className="text-[#0ECB81]" /> :
                         tx.type === 'withdrawal' ? <ArrowUpFromLine size={14} className="text-[#F6465D]" /> :
                         tx.type === 'profit' ? <TrendingUp size={14} className="text-[#8B5CF6]" /> :
                         <Briefcase size={14} className="text-[#2563EB]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#EAECEF] text-[14px] font-bold truncate">{tx.user.name}</span>
                          <span className="text-[#848E9C] text-[11px]">({typeLabels[tx.type] || tx.type})</span>
                        </div>
                        <div className="text-[#5E6673] text-[12px]">{formatDate(tx.createdAt)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[14px] font-black" style={{ color: tx.type === 'deposit' || tx.type === 'profit' ? '#0ECB81' : '#F6465D' }} dir="ltr">
                        ${safeFixed(tx.amount)}
                      </span>
                      <span className="text-[10px] px-2 py-1 rounded-md font-bold" style={{ background: `${statusColors[tx.status] || '#848E9C'}15`, color: statusColors[tx.status] || '#848E9C' }}>
                        {statusLabels[tx.status] || tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Receipt size={32} className="text-[#2B3139] mx-auto mb-3" />
                <p className="text-[#5E6673] text-[14px] font-bold">{t('admin.noTransactions')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Activity Feed ─────────────────────────────── */}
      <div className="p-6 rounded-2xl" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
        <h3 className="text-[#EAECEF] text-[16px] font-black mb-5 flex items-center gap-2.5">
          <Activity size={18} className="text-[#0ECB81]" />
          {t('admin.recentActivity')}
        </h3>
        <div className="space-y-3">
          {recentTransactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="flex items-center gap-4 text-[13px]">
              <span className={`w-2 h-2 rounded-full shrink-0 ${tx.type === 'deposit' ? 'bg-[#0ECB81]' : tx.type === 'withdrawal' ? 'bg-[#F6465D]' : 'bg-[#2563EB]'}`} />
              <span className="text-[#848E9C]">
                <span className="text-[#EAECEF] font-bold">{tx.user.name}</span>
                {' '}{tx.type === 'deposit' ? t('admin.userDeposited') : tx.type === 'withdrawal' ? t('admin.userWithdrew') : tx.type === 'profit' ? t('admin.userProfited') : t('admin.userInvested')}
                {' '}<span className="text-[#F0B90B] font-bold" dir="ltr">${safeFixed(tx.amount)}</span>
              </span>
              <span className="text-[#5E6673] text-[12px] mr-auto">{formatDate(tx.createdAt)}</span>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <p className="text-[#5E6673] text-[14px] text-center py-6">{t('admin.noRecentActivity')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
