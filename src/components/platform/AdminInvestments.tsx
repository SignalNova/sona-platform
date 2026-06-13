'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Package {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  dailyReturn: number;
  durationDays: number;
  minAmount: number;
  maxAmount: number;
}

interface Investment {
  id: string;
  amount: number;
  monthlyProfit: number;
  totalProfit: number;
  monthsElapsed: number;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string; isActive: boolean };
  package: Package;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusLabelsMap: Record<string, string> = {
  ACTIVE: 'common.active',
  COMPLETED: 'common.completed',
  CANCELLED: 'common.rejected',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};


export default function AdminInvestments() {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadInvestments = useCallback(async (page = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = useAppStore.getState().getToken();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/investments?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setInvestments(data.investments || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    loadInvestments(1);
  }, [statusFilter, loadInvestments]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Metrics
  const activeInvestments = investments.filter(i => i.status === 'ACTIVE');
  const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
  const totalProfit = investments.reduce((s, i) => s + (i.totalProfit || 0), 0);
  const dailyProfitTotal = activeInvestments.reduce((s, i) => s + (i.monthlyProfit || 0), 0);
  const avgProgress = activeInvestments.length > 0
    ? activeInvestments.reduce((s, i) => s + ((i.monthsElapsed || 0) / (i.package?.durationDays || 1)), 0) / activeInvestments.length * 100
    : 0;

  // Maturity tracking data
  const maturityData = activeInvestments.slice(0, 7).map((inv) => ({
    name: inv.package?.name || 'Unknown',
    progress: Math.min(((inv.monthsElapsed || 0) / (inv.package?.durationDays || 1)) * 100, 100),
    remaining: Math.max(0, (inv.package?.durationDays || 0) - (inv.monthsElapsed || 0)),
  }));

  const filters = [
    { id: '', label: t('common.all') },
    { id: 'ACTIVE', label: t('common.active') },
    { id: 'COMPLETED', label: t('common.completed') },
    { id: 'CANCELLED', label: t('common.rejected') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <Briefcase size={16} />}
          {toast.message}
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Briefcase size={22} className="text-[#409eff]" />
          {t('admin.manageInvestments')}
        </h2>
        <p className="text-white/40 text-sm">{pagination.total} {t('admin.userCount')}</p>
      </motion.div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('admin.totalDeposits'), value: `${safeFixed(totalInvested)}`, icon: DollarSign, color: '#409eff' },
          { label: t('admin.profitsDistributed'), value: `${safeFixed(totalProfit)}`, icon: TrendingUp, color: '#22c55e' },
          { label: t('myInvestments.dailyProfit'), value: `${safeFixed(dailyProfitTotal)}`, icon: Activity, color: '#3b82f6' },
          { label: t('myInvestments.progress'), value: `${Math.round(avgProgress)}%`, icon: BarChart3, color: '#f59e0b' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-[#1f2634] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: s.color }} />
                <span className="text-white/30 text-xs">{s.label}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Maturity Tracking Chart */}
      {maturityData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
          <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
            <Clock size={16} className="text-[#409eff]" />
            {t('myInvestments.progress')}
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={maturityData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="maturityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#409eff" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#409eff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2c313e', border: '1px solid rgba(64,158,255,0.15)', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(value: any, name: string) => [name === 'progress' ? `${safeFixed(value, 0)}%` : `${value ?? 0} ${t('common.day')}`, name === 'progress' ? t('myInvestments.progress') : t('common.amount')]} />
                <Area type="monotone" dataKey="progress" stroke="#409eff" strokeWidth={2} fill="url(#maturityGrad)" dot={{ fill: '#409eff', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-white/30 shrink-0" />
        {filters.map((f) => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusFilter === f.id ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Investments */}
      {investments.length > 0 ? (
        <div className="space-y-3">
          {investments.map((inv, i) => {
            const progress = Math.min(((inv.monthsElapsed || 0) / (inv.package?.durationDays || 1)) * 100, 100);
            const dailyProfit = inv.monthlyProfit || 0;
            return (
              <motion.div key={inv.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${inv.package?.color || '#409eff'}15` }}>
                      <Briefcase size={18} style={{ color: inv.package?.color || '#409eff' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{inv.package?.name || 'Unknown'}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[inv.status] || 'bg-white/5 text-white/40'}`}>
                          {t(statusLabelsMap[inv.status] || inv.status)}
                        </span>
                      </div>
                      <div className="text-white/30 text-xs">{inv.user?.name || '-'} • {inv.package?.nameEn || ''}</div>
                    </div>
                  </div>
                  <div className="text-left" dir="ltr">
                    <div className="text-white font-bold">${safeFixed(inv.amount)}</div>
                    <div className="text-white/30 text-[10px]">{t('common.amount')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-white/30 text-[10px] mb-0.5">{t('myInvestments.dailyProfit')}</div>
                    <div className="text-green-400 text-xs font-bold">${safeFixed(dailyProfit)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-white/30 text-[10px] mb-0.5">{t('admin.profitsDistributed')}</div>
                    <div className="flex items-center gap-1"><TrendingUp size={10} className="text-emerald-400" /><span className="text-emerald-400 text-xs font-bold">${safeFixed(inv.totalProfit)}</span></div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-white/30 text-[10px] mb-0.5">{t('common.date')}</div>
                    <div className="text-[#409eff] text-xs font-bold">{inv.monthsElapsed || 0} / {inv.package?.durationDays || '-'}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-white/30 text-[10px] mb-0.5">{t('common.amount')}</div>
                    <div className="text-amber-400 text-xs font-bold">{Math.max(0, (inv.package?.durationDays || 0) - (inv.monthsElapsed || 0))} {t('common.day')}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                {inv.status === 'ACTIVE' && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: inv.package?.color || '#409eff' }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/20 text-[10px]">{formatDate(inv.createdAt)}</span>
                      <span className="text-white/20 text-[10px]">{Math.round(progress)}%</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-white/30 text-sm">{t('admin.page')} {pagination.page} {t('admin.of')} {pagination.totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => loadInvestments(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
                <button onClick={() => loadInvestments(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <Briefcase size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('admin.noTransactions')}</h3>
          <p className="text-white/30 text-sm">{t('common.noResults')}</p>
        </motion.div>
      )}
    </div>
  );
}
