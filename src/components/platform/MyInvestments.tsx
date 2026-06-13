'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Loader2, Clock, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface Investment {
  id: string;
  amount: number;
  dailyProfit: number;
  totalProfit: number;
  daysElapsed: number;
  status: string;
  startDate: string;
  package: {
    name: string;
    nameEn: string;
    durationDays: number;
    color: string;
    dailyReturn: number;
  };
}

export default function MyInvestments() {
  const { user } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadInvestments();
  }, [user]);

  async function loadInvestments() {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/${user.id}/investments`);
      if (res.ok) {
        const data = await res.json();
        setInvestments(data.investments || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const activeInvestments = investments.filter((i) => i.status === 'ACTIVE');
  const completedInvestments = investments.filter((i) => i.status === 'COMPLETED');
  const totalProfitEarned = investments.reduce((sum, i) => sum + (i.totalProfit || 0), 0);
  const totalInvested = investments.reduce((sum, i) => sum + (i.amount || 0), 0);
  const dailyProfitTotal = activeInvestments.reduce((sum, i) => sum + (i.dailyProfit || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#409eff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('myInvestments.title')}</h2>
        <p className="text-white/40 text-sm">{t('myInvestments.subtitle')}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('myInvestments.totalInvestment'), value: `${safeFixed(totalInvested || 0)}`, color: '#409eff' },
          { label: t('myInvestments.totalProfits'), value: `${safeFixed(totalProfitEarned || 0)}`, color: '#22c55e' },
          { label: t('myInvestments.dailyProfit'), value: `${safeFixed(dailyProfitTotal || 0)}`, color: '#3b82f6' },
          { label: t('myInvestments.activeCount'), value: activeInvestments.length.toString(), color: '#93c5fd' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl bg-[#1f2634] border border-white/5 text-center"
          >
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-white/40 text-xs mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Active Investments */}
      {activeInvestments.length > 0 && (
        <div>
          <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
            <Clock size={18} className="text-green-400" />
            {t('myInvestments.activeInvestments')}
          </h3>
          <div className="space-y-3">
            {activeInvestments.map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-xl bg-[#1f2634] border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: inv.package?.color || '#409eff' }} />
                    <div>
                      <span className="text-white font-bold">{inv.package?.name || ''}</span>
                      <span className="text-white/30 text-xs mr-2">({inv.package?.nameEn || ''})</span>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 font-medium">{t('common.active')}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-white/40 text-xs">{t('common.amount')}</span>
                    <div className="text-white font-bold">${safeFixed(inv.amount || 0)}</div>
                  </div>
                  <div>
                    <span className="text-white/40 text-xs">{t('myInvestments.dailyProfit')}</span>
                    <div className="text-green-400 font-bold">${safeFixed(inv.dailyProfit || 0)}</div>
                  </div>
                  <div>
                    <span className="text-white/40 text-xs">{t('myInvestments.totalProfits')}</span>
                    <div className="text-[#409eff] font-bold">${safeFixed(inv.totalProfit || 0)}</div>
                  </div>
                  <div>
                    <span className="text-white/40 text-xs">{t('myInvestments.progress')}</span>
                    <div className="text-white/80 font-medium">{inv.daysElapsed || 0} / {inv.package?.durationDays || 30} {t('common.days')}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((inv.daysElapsed || 0) / (inv.package?.durationDays || 30)) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: inv.package?.color || '#409eff' }}
                    />
                  </div>
                  <span className="text-white/25 text-[10px] shrink-0" dir="ltr">
                    {inv.daysElapsed || 0}/{inv.package?.durationDays || 30} {t('common.days')}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Investments */}
      {completedInvestments.length > 0 && (
        <div>
          <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-[#409eff]" />
            {t('myInvestments.completedInvestments')}
          </h3>
          <div className="space-y-3">
            {completedInvestments.map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-xl bg-[#1f2634] border border-white/5 opacity-70"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: inv.package?.color || '#409eff' }} />
                    <span className="text-white font-bold">{inv.package?.name || ''}</span>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-[#409eff]/10 text-[#409eff] font-medium">{t('common.completed')}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-white/40 text-xs">{t('common.amount')}</span>
                    <div className="text-white/60 font-medium">${safeFixed(inv.amount || 0)}</div>
                  </div>
                  <div>
                    <span className="text-white/40 text-xs">{t('myInvestments.totalProfits')}</span>
                    <div className="text-[#409eff] font-bold">${safeFixed(inv.totalProfit || 0)}</div>
                  </div>
                  <div>
                    <span className="text-white/40 text-xs">{t('myInvestments.duration')}</span>
                    <div className="text-white/60 font-medium">{inv.package?.durationDays || 30} {t('common.days')}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {investments.length === 0 && (
        <div className="text-center py-16 rounded-2xl bg-[#1f2634] border border-white/5">
          <Briefcase size={48} className="text-white/10 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('myInvestments.noInvestmentsYet')}</h3>
          <p className="text-white/30 text-sm mb-6">{t('myInvestments.startJourney')}</p>
          <button
            onClick={() => useAppStore.getState().setDashboardPage('packages')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold btn-shine hover:shadow-lg hover:shadow-[#409eff]/20 transition-all"
          >
            {t('myInvestments.browsePackages')}
          </button>
        </div>
      )}
    </div>
  );
}
