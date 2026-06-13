'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Award,
  Star,
  Zap,
  Gem,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  TrendingUp,
  Clock,
  DollarSign,
  Percent,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface Pkg {
  id: string;
  name: string;
  nameEn: string;
  minAmount: number;
  maxAmount: number | null;
  dailyReturn: number;
  durationDays: number;
  description: string;
  color: string;
  icon: string;
}

interface UserInvestment {
  id: string;
  amount: number;
  daysElapsed: number;
  status: string;
  package: { id: string; name: string; durationDays: number; color: string };
}

const iconMap: Record<string, React.ReactNode> = {
  shield: <Shield size={32} />,
  award: <Award size={32} />,
  star: <Star size={32} />,
  zap: <Zap size={32} />,
  gem: <Gem size={32} />,
};


export default function PackagesPage() {
  const { user, refreshUser, setDashboardPage } = useAppStore();
  const { t } = useI18n();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [userInvestments, setUserInvestments] = useState<UserInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    if (user) loadUserInvestments();
  }, [user]);

  async function loadPackages() {
    try {
      let res = await fetch('/api/packages');
      let data = await res.json();
      if (!data.packages || data.packages.length === 0) {
        await fetch('/api/packages/seed', { method: 'POST' });
        res = await fetch('/api/packages');
        data = await res.json();
      }
      setPackages(data.packages || []);
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }

  async function loadUserInvestments() {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/${user.id}/investments`);
      if (res.ok) {
        const data = await res.json();
        setUserInvestments(data.investments || []);
      }
    } catch {
      // ignore
    }
  }

  const openInvestModal = (pkg: Pkg) => {
    setSelectedPkg(pkg);
    setInvestAmount(pkg.minAmount.toString());
    setMessage(null);
  };

  const handleInvest = async () => {
    if (!selectedPkg || !user) return;
    const amount = parseFloat(investAmount);

    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: t('packages.invalidAmount') });
      return;
    }

    if (amount < selectedPkg.minAmount) {
      setMessage({ type: 'error', text: `${t('packages.minInvestment')} ${selectedPkg.minAmount.toLocaleString()}` });
      return;
    }

    if (selectedPkg.maxAmount && amount > selectedPkg.maxAmount) {
      setMessage({ type: 'error', text: `${t('packages.maxInvestment')} ${selectedPkg.maxAmount.toLocaleString()}` });
      return;
    }

    if (amount > (user.balance || 0)) {
      setMessage({ type: 'error', text: t('packages.insufficientBalance') });
      return;
    }

    setInvesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, packageId: selectedPkg.id, amount }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || t('packages.investmentFailed') });
        return;
      }

      const isSonaPkg = selectedPkg.nameEn === 'SONA';
      if (isSonaPkg) {
        setMessage({
          type: 'success',
          text: `${t('packages.sonaTradingSuccess')} ${t('packages.sonaTradingStarted')} ${t('packages.dailyProfit')}: ${safeFixed(amount * (selectedPkg.dailyReturn ?? 0) / 100)}`
        });
      } else {
        setMessage({ type: 'success', text: `${t('packages.investmentSuccess')} ${safeFixed(amount * (selectedPkg.dailyReturn ?? 0) / 100)} ${t('packages.dailyToAccount')}` });
      }
      await refreshUser();
      await loadUserInvestments();

      setTimeout(() => {
        setSelectedPkg(null);
        setMessage(null);
      }, 3000);
    } catch {
      setMessage({ type: 'error', text: t('common.serverError') });
    } finally {
      setInvesting(false);
    }
  };

  // Get active investments for a specific package
  const getActiveInvestmentsForPackage = (pkgId: string) => {
    return userInvestments.filter(inv => inv.package.id === pkgId && inv.status === 'ACTIVE');
  };

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
        <h2 className="text-2xl font-bold text-white mb-2">{t('packages.title')}</h2>
        <p className="text-white/40 text-sm">{t('packages.subtitle')}</p>
      </div>

      {/* Balance Info */}
      <div className="flex items-center gap-3 p-4 rounded-xl glass-gold">
        <DollarSign size={20} className="text-[#409eff]" />
        <span className="text-white/50 text-sm">{t('packages.currentBalance')}</span>
        <span className="text-[#409eff] font-bold text-lg">${safeFixed(user?.balance)}</span>
      </div>

      {/* Package Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg, i) => {
          const isFeatured = pkg.nameEn === 'SONA';
          const monthlyReturn = safeFixed((pkg.dailyReturn ?? 0) * 30, 1);
          const totalReturn = safeFixed((pkg.dailyReturn ?? 0) * (pkg.durationDays || 30), 1);
          const activeInvestments = getActiveInvestmentsForPackage(pkg.id);

          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 transition-all duration-500 ${
                isFeatured
                  ? 'bg-gradient-to-b from-[#409eff]/10 to-[#1f2634] border border-[#409eff]/30 gold-glow'
                  : 'bg-[#1f2634] border border-white/5 hover:border-[#409eff]/20'
              }`}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-l from-[#409eff] to-[#337ecc] rounded-full text-white text-xs font-bold">
                  {t('packages.mostPopular')}
                </div>
              )}

              <div className="flex items-center gap-3 mb-5">
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${pkg.color}15`, color: pkg.color }}>
                  {iconMap[pkg.icon] || <Star size={32} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold" style={{ color: pkg.color }}>{pkg.name}</h3>
                    {isFeatured && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <Zap size={9} /> إشارات حصرية
                      </span>
                    )}
                  </div>
                  <p className="text-white/30 text-xs">{pkg.nameEn} Package</p>
                </div>
              </div>

              <p className="text-white/50 text-sm mb-5 leading-relaxed">{pkg.description}</p>

              {/* SONA Package Exclusive Features */}
              {isFeatured && (
                <div className="mb-5 p-3 rounded-xl bg-gradient-to-l from-amber-500/[0.08] to-[#1a1f2e] border border-amber-500/15">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-amber-400" />
                    <span className="text-amber-300 text-xs font-bold">مميزات حصرية</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Zap size={11} className="text-amber-400/60" />
                      <span className="text-white/50 text-[11px]">إشارات حصرية متقدمة مع 3 أهداف</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={11} className="text-amber-400/60" />
                      <span className="text-white/50 text-[11px]">تحليل أعمق بـ 6 عملات رقمية</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Percent size={11} className="text-amber-400/60" />
                      <span className="text-white/50 text-[11px]">عمولة إحالة 15% عند استثمار الشخص</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 text-sm flex items-center gap-1">
                    <Percent size={12} /> {t('packages.dailyReturn')}
                  </span>
                  <span className="font-bold text-lg" style={{ color: pkg.color }}>{pkg.dailyReturn}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 text-sm flex items-center gap-1">
                    <TrendingUp size={12} /> {t('packages.monthlyReturn')}
                  </span>
                  <span className="text-green-400 font-bold">{monthlyReturn}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 text-sm flex items-center gap-1">
                    <Clock size={12} /> {t('packages.duration')}
                  </span>
                  <span className="text-white/80 font-medium">{pkg.durationDays} {t('common.days')}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/40 text-sm flex items-center gap-1">
                    <DollarSign size={12} /> {t('packages.amountRange')}
                  </span>
                  <span className="text-white/80 font-medium text-sm">
                    {pkg.minAmount.toLocaleString()} - {pkg.maxAmount ? `${pkg.maxAmount.toLocaleString()}` : t('common.noLimit')}
                  </span>
                </div>
              </div>

              {/* Expected Total Return */}
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 mb-5">
                <div className="text-center">
                  <span className="text-green-400/60 text-xs">{t('packages.totalExpectedReturn')}</span>
                  <div className="text-green-400 font-bold text-lg">{totalReturn}%</div>
                </div>
              </div>

              {/* Active Investment Progress for this package */}
              {activeInvestments.length > 0 && (
                <div className="mb-5 space-y-2">
                  {activeInvestments.map(inv => {
                    const progress = Math.min((inv.daysElapsed / inv.package.durationDays) * 100, 100);
                    return (
                      <div key={inv.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/50 text-xs">{t('packages.activeInvestment', { amount: safeFixed(inv.amount) })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: inv.package.color }}
                            />
                          </div>
                          <span className="text-white/25 text-[10px] shrink-0" dir="ltr">
                            {t('packages.investmentDurationShort', { elapsed: inv.daysElapsed, total: inv.package.durationDays })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => openInvestModal(pkg)}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                  isFeatured
                    ? 'bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white hover:shadow-lg hover:shadow-[#409eff]/20 btn-shine'
                    : 'border border-[#409eff]/30 text-[#409eff] hover:bg-[#409eff]/10'
                }`}
              >
                {t('packages.investNow')}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Investment Modal */}
      <AnimatePresence>
        {selectedPkg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPkg(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[#1f2634] border border-[#409eff]/20 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{t('packages.investIn')} {selectedPkg.name}</h3>
                <button onClick={() => setSelectedPkg(null)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Package Info */}
              <div className="p-4 rounded-xl bg-white/5 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t('packages.dailyReturn')}</span>
                  <span style={{ color: selectedPkg.color }} className="font-bold">{selectedPkg.dailyReturn}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t('packages.monthlyReturn')}</span>
                  <span className="text-green-400 font-bold">{safeFixed((selectedPkg.dailyReturn ?? 0) * 30, 1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t('packages.duration')}</span>
                  <span className="text-white/80">{selectedPkg.durationDays} {t('common.days')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t('packages.minimum')}</span>
                  <span className="text-white/80">${selectedPkg.minAmount.toLocaleString()}</span>
                </div>
                {selectedPkg.maxAmount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">{t('packages.maximum')}</span>
                    <span className="text-white/80">${selectedPkg.maxAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Duration Progress Indicator */}
              <div className="p-3 rounded-lg border mb-4" style={{ backgroundColor: `${selectedPkg.color}08`, borderColor: `${selectedPkg.color}18` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: selectedPkg.color }}>{t('packages.investmentDuration', { days: selectedPkg.durationDays })}</span>
                  <span className="text-[10px]" style={{ color: `${selectedPkg.color}80` }}>0% → 100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '0%', backgroundColor: selectedPkg.color }} />
                  </div>
                  <span className="text-white/25 text-[10px] shrink-0" dir="ltr">
                    {t('packages.investmentDurationShort', { elapsed: 0, total: selectedPkg.durationDays })}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="text-white/50 text-sm mb-2 block">{t('packages.investmentAmount')}</label>
                <input
                  type="number"
                  value={investAmount}
                  onChange={(e) => { setInvestAmount(e.target.value); setMessage(null); }}
                  min={selectedPkg.minAmount}
                  max={selectedPkg.maxAmount || undefined}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-lg font-bold"
                  dir="ltr"
                  placeholder={t('packages.enterAmount')}
                />
                <div className="flex justify-between mt-2 text-xs text-white/30">
                  <span>{t('packages.minimum')}: ${selectedPkg.minAmount.toLocaleString()}</span>
                  <span>{t('packages.yourBalance')}: ${safeFixed(user?.balance)}</span>
                </div>
              </div>

              {/* Expected Profit */}
              {investAmount && !isNaN(parseFloat(investAmount)) && parseFloat(investAmount) > 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 mb-4 space-y-2">
                  <div className="text-green-400 text-sm font-medium text-center">
                    {t('packages.dailyProfit')}: ${safeFixed((parseFloat(investAmount) * (selectedPkg.dailyReturn ?? 0)) / 100)}
                  </div>
                  <div className="text-green-400/60 text-xs text-center">
                    {t('packages.monthlyProfit')}: ${safeFixed((parseFloat(investAmount) * (selectedPkg.dailyReturn ?? 0) * 30) / 100)}
                  </div>
                  <div className="text-green-400/60 text-xs text-center">
                    {t('packages.totalExpectedProfit')}: ${safeFixed((parseFloat(investAmount) * (selectedPkg.dailyReturn ?? 0) * (selectedPkg.durationDays || 30)) / 100)}
                  </div>
                </div>
              )}

              {/* Message */}
              {message && message.type === 'error' && (
                <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle size={16} />
                  {message.text}
                </div>
              )}

              {/* Success Confirmation with Progress Bar */}
              {message && message.type === 'success' && (
                <div className="p-4 rounded-xl bg-green-500/[0.06] border border-green-500/15 mb-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <CheckCircle size={18} />
                    {message.text}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '0%' }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: selectedPkg.color }}
                      />
                    </div>
                    <span className="text-white/25 text-[10px] shrink-0" dir="ltr">
                      {t('packages.investmentDurationShort', { elapsed: 0, total: selectedPkg.durationDays })}
                    </span>
                  </div>
                  <div className="text-white/30 text-xs text-center">
                    {t('packages.investmentDetails', { days: selectedPkg.durationDays, returnRate: selectedPkg.dailyReturn })}
                  </div>
                  {selectedPkg.nameEn === 'SONA' && (
                    <button
                      onClick={() => { setSelectedPkg(null); setMessage(null); setDashboardPage('trading'); }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#409eff]/20 transition-all flex items-center justify-center gap-2"
                    >
                      <TrendingUp size={16} />
                      {t('packages.openTradingInterface')}
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              {!(message?.type === 'success') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedPkg(null)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 font-medium hover:bg-white/5 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleInvest}
                    disabled={investing}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {investing ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={16} />}
                    {t('packages.confirmInvestment')}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
