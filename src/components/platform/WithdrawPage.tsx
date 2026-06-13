'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpFromLine,
  Wallet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  Clock,
  Shield,
  Link2,
  Receipt,
  Minus,
  Wrench,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

const CRYPTO_METHODS = [
  {
    id: 'usdt_bep20' as const,
    label: 'USDT (BEP20)',
    icon: '₮',
    color: '#f0b90b',
    network: 'BEP20 (BNB Smart Chain)',
    fee: 0.5,
    feeLabel: '$0.50',
    minWithdraw: 10,
    bgColor: 'rgba(240, 185, 11, 0.06)',
    borderColor: 'rgba(240, 185, 11, 0.15)',
    placeholderKey: 'withdraw.walletPlaceholder',
    networkIcon: 'BNB',
  },
  {
    id: 'usdt_trc20' as const,
    label: 'USDT (TRC20)',
    icon: '₮',
    color: '#26a17b',
    network: 'TRC20 (Tron)',
    fee: 1,
    feeLabel: '$1.00',
    minWithdraw: 10,
    bgColor: 'rgba(38, 161, 123, 0.06)',
    borderColor: 'rgba(38, 161, 123, 0.15)',
    placeholderKey: 'withdraw.walletPlaceholder',
    networkIcon: 'TRX',
  },
  {
    id: 'btc' as const,
    label: 'Bitcoin (BTC)',
    icon: '₿',
    color: '#f7931a',
    network: 'Bitcoin Network',
    fee: 5,
    feeLabel: '~$5.00',
    minWithdraw: 10,
    bgColor: 'rgba(247, 147, 26, 0.06)',
    borderColor: 'rgba(247, 147, 26, 0.15)',
    placeholderKey: 'withdraw.walletPlaceholder',
    networkIcon: 'BTC',
  },
  {
    id: 'eth' as const,
    label: 'Ethereum (ETH)',
    icon: 'Ξ',
    color: '#627eea',
    network: 'ERC20 (Ethereum)',
    fee: 3,
    feeLabel: '~$3.00',
    minWithdraw: 10,
    bgColor: 'rgba(98, 126, 234, 0.06)',
    borderColor: 'rgba(98, 126, 234, 0.15)',
    placeholderKey: 'withdraw.walletPlaceholder',
    networkIcon: 'ETH',
  },
];

export default function WithdrawPage() {
  const { user, setDashboardPage, refreshUser } = useAppStore();
  const { t, lang } = useI18n();
  const isAr = lang === 'ar';
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'usdt_bep20' | 'usdt_trc20' | 'btc' | 'eth'>('usdt_bep20');
  const [walletAddress, setWalletAddress] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemPaused, setSystemPaused] = useState<{ maintenance: boolean; withdrawals: boolean; message?: string }>({ maintenance: false, withdrawals: false });
  const [balanceLoading, setBalanceLoading] = useState(true);

  // CRITICAL FIX: Reconcile balance on mount to fix any drift, then refresh user
  useEffect(() => {
    const fetchFreshBalance = async () => {
      setBalanceLoading(true);
      try {
        // Reconcile balance first to fix any inconsistency
        const token = useAppStore.getState().getToken();
        await fetch('/api/balance/reconcile', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch { /* silent */ }
      await refreshUser();
      setBalanceLoading(false);
    };
    fetchFreshBalance();
  }, [refreshUser]);

  // Check system status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          setSystemPaused({
            maintenance: data.maintenanceMode === true,
            withdrawals: data.withdrawalEnabled === false,
            message: data.maintenanceMessage || undefined,
          });
        }
      } catch {}
    }
    checkStatus();
  }, []);

  const selectedCrypto = CRYPTO_METHODS.find((c) => c.id === method)!;
  // Use full balance - user's total balance is available for withdrawal
  const effectiveWithdrawable = user?.balance ?? 0;
  const maxWithdraw = effectiveWithdrawable;

  // Calculate fee and estimated received
  const amountNum = parseFloat(amount) || 0;
  const networkFee = selectedCrypto.fee;
  const estimatedReceived = Math.max(0, amountNum - networkFee);
  const withdrawPercentage = maxWithdraw > 0 ? Math.min(100, (amountNum / maxWithdraw) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!amountNum || amountNum <= 0) {
      setMessage({ type: 'error', text: t('withdraw.invalidAmount') });
      return;
    }

    if (amountNum < 10) {
      setMessage({ type: 'error', text: t('withdraw.minWithdrawAmount') });
      return;
    }

    if (amountNum > maxWithdraw) {
      setMessage({ type: 'error', text: t('withdraw.insufficientBalanceForWithdraw') });
      return;
    }

    if (!walletAddress.trim()) {
      setMessage({ type: 'error', text: t('withdraw.invalidWallet') });
      return;
    }

    // KYC warning for >$10000 (hard block)
    if (amountNum > 10000 && !['VERIFIED', 'APPROVED'].includes(user?.kycStatus || '')) {
      setMessage({ type: 'warning', text: 'يرجى إكمال التحقق من الهوية للسحب بمبالغ تتجاوز $10,000' });
      return;
    }

    setLoading(true);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user?.id, amount: amountNum, method, walletAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: t('withdraw.withdrawSuccessAuto') });
        setAmount('');
        setWalletAddress('');
        await refreshUser(); // Refresh balance after withdrawal
      } else {
        setMessage({ type: 'error', text: data.error || t('withdraw.withdrawCreateError') });
      }
    } catch {
      setMessage({ type: 'error', text: t('common.connectionError') });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <ArrowUpFromLine size={24} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{t('withdraw.title')}</h2>
          <p className="text-white/40 text-sm">{t('withdraw.subtitle')}</p>
        </div>
      </div>

      {/* System Paused Warning - Kill Switch Effect */}
      {systemPaused.maintenance && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-red-500/[0.08] border border-red-500/20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/15">
            <Wrench size={28} className="text-red-400" />
          </div>
          <h3 className="text-red-400 font-bold text-lg mb-2">النظام تحت الصيانة</h3>
          <p className="text-white/50 text-sm">{systemPaused.message || 'النظام حالياً تحت الصيانة. لا يمكن تقديم طلبات سحب جديدة حالياً. يرجى المحاولة لاحقاً.'}</p>
        </motion.div>
      )}

      {systemPaused.withdrawals && !systemPaused.maintenance && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/15">
            <Clock size={28} className="text-amber-400" />
          </div>
          <h3 className="text-amber-400 font-bold text-lg mb-2">السحوبات معطلة مؤقتاً</h3>
          <p className="text-white/50 text-sm">تم تعطيل السحوبات مؤقتاً من قبل الإدارة. يرجى المحاولة لاحقاً.</p>
        </motion.div>
      )}

      {/* Only show the full form when system is not paused */}
      {!systemPaused.maintenance && !systemPaused.withdrawals && (
        <>
      {/* Balance Card - Glassmorphism */}
      <div
        className="relative overflow-hidden rounded-2xl p-[1px]"
        style={{
          background: 'linear-gradient(135deg, rgba(4,207,153,0.3) 0%, rgba(4,207,153,0.05) 50%, rgba(255,255,255,0.05) 100%)',
        }}
      >
        <div
          className="rounded-2xl p-6 backdrop-blur-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(31,38,52,0.95) 0%, rgba(4,207,153,0.08) 50%, rgba(31,38,52,0.95) 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#04cf99] animate-pulse" />
                <span className="text-white/50 text-sm font-semibold">{t('withdraw.withdrawAvailable')}</span>
              </div>
              <div className="flex items-baseline">
                <span className="text-[#04cf99] font-bold text-2xl mr-1">$</span>
                <span className="text-[#04cf99] font-bold text-4xl" style={{ letterSpacing: -1 }}>
                  {balanceLoading ? '...' : safeFixed(maxWithdraw)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-white/30" />
                  <span className="text-white/30 text-xs">{t('withdraw.autoBalanceUpdate')}</span>
                </div>
              </div>
              {!balanceLoading && user?.balance !== undefined && (
                <div className="mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-xs font-semibold">{isAr ? 'الرصيد المتاح للسحب' : 'Available for Withdrawal'}</span>
                    <span className="text-[#04cf99] text-sm font-bold">${safeFixed(user.balance ?? 0)}</span>
                  </div>
                </div>
              )}
            </div>
            <div
              className="p-4 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(4,207,153,0.15) 0%, rgba(4,207,153,0.05) 100%)',
                border: '1px solid rgba(4,207,153,0.2)',
              }}
            >
              <Wallet size={26} className="text-[#04cf99]" />
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl bg-[#1a1f2e] border border-white/[0.04] overflow-hidden">
        {/* Amount Section */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpFromLine size={14} className="text-white/40" />
            <label className="text-white/60 text-sm font-semibold">{t('withdraw.enterAmount')}</label>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setMessage(null); }}
              min="10"
              max={maxWithdraw}
              className="w-full px-5 py-4 pl-12 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/20 focus:border-[#04cf99]/40 focus:ring-1 focus:ring-[#04cf99]/20 focus:outline-none transition-all text-2xl font-bold"
              dir="ltr"
              placeholder="0.00"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-xl">$</span>
          </div>

          {/* Progress bar showing withdrawal percentage */}
          {amountNum > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-white/30 text-[11px]">{t('withdraw.withdrawPercentage')}</span>
                <span className="text-[#04cf99] text-[11px] font-bold">{safeFixed(withdrawPercentage, 1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, withdrawPercentage)}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{
                    background: withdrawPercentage > 90
                      ? 'linear-gradient(90deg, #04cf99, #f59e0b)'
                      : 'linear-gradient(90deg, #04cf99, #04b383)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Quick amount pills */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 flex-wrap flex-1">
              {[25, 50, 100, 250, 500].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v.toString())}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                    amount === v.toString()
                      ? 'bg-[#04cf99]/15 text-[#04cf99] border border-[#04cf99]/30 shadow-[0_0_8px_rgba(4,207,153,0.15)]'
                      : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60 hover:border-white/[0.1]'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAmount(maxWithdraw.toString())}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#04cf99]/10 text-[#04cf99] border border-[#04cf99]/20 hover:bg-[#04cf99]/20 transition-all duration-200 whitespace-nowrap"
            >
              {t('withdraw.allLabel')}
            </button>
          </div>

          <p className="text-white/25 text-xs">{t('withdraw.minMaxInfo', { max: safeFixed(maxWithdraw) })}</p>
        </div>

        {/* Section Divider */}
        <div className="mx-6 border-t border-white/[0.04]" />

        {/* Crypto Method Selection */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={14} className="text-white/40" />
            <label className="text-white/60 text-sm font-semibold">{t('withdraw.selectNetwork')}</label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CRYPTO_METHODS.map((m) => {
              const isSelected = method === m.id;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  onClick={() => { setMethod(m.id); setMessage(null); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-300 overflow-hidden"
                  style={{
                    borderColor: isSelected ? m.color + '50' : 'rgba(255,255,255,0.06)',
                    backgroundColor: isSelected ? m.bgColor : 'rgba(255,255,255,0.02)',
                    boxShadow: isSelected ? `0 0 20px ${m.color}12, 0 0 40px ${m.color}08, inset 0 1px 0 ${m.color}10` : 'none',
                  }}
                >
                  {/* Glow effect on selection */}
                  {isSelected && (
                    <motion.div
                      className="absolute inset-0 opacity-30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      style={{
                        background: `radial-gradient(circle at center, ${m.color}15 0%, transparent 70%)`,
                      }}
                    />
                  )}
                  <div
                    className="relative w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{
                      backgroundColor: isSelected ? m.color + '18' : m.bgColor,
                      color: m.color,
                      border: isSelected ? `1px solid ${m.color}30` : '1px solid transparent',
                    }}
                  >
                    {m.icon}
                  </div>
                  <span className="text-xs font-bold text-center relative" style={{ color: isSelected ? m.color : 'rgba(255,255,255,0.5)' }}>
                    {m.label}
                  </span>
                  <span className="text-[10px] relative" style={{ color: isSelected ? m.color + '90' : 'rgba(255,255,255,0.25)' }}>
                    {t('withdraw.feeLabel')}: {m.feeLabel}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Section Divider */}
        <div className="mx-6 border-t border-white/[0.04]" />

        {/* Wallet Address */}
        <motion.div key={method} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-white/40" />
            <label className="text-white/60 text-sm font-semibold">
              {t('withdraw.walletLabel', { label: selectedCrypto.label })}
            </label>
          </div>
          <div className="relative">
            {/* Network badge */}
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"
              style={{
                backgroundColor: selectedCrypto.bgColor,
                color: selectedCrypto.color,
                border: `1px solid ${selectedCrypto.color}20`,
              }}
            >
              <span>{selectedCrypto.networkIcon}</span>
            </div>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full px-4 py-4 pr-20 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/20 focus:border-[#04cf99]/40 focus:ring-1 focus:ring-[#04cf99]/20 focus:outline-none transition-all font-mono text-sm"
              dir="ltr"
              placeholder={t(selectedCrypto.placeholderKey)}
            />
          </div>
          {method === 'usdt_bep20' && (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={12} className="text-[#f0b90b]/70 flex-shrink-0" />
              <span className="text-[#f0b90b]/70 text-[11px]">{t('withdraw.bep20Warning')}</span>
            </div>
          )}
          {method === 'usdt_trc20' && (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={12} className="text-[#26a17b]/70 flex-shrink-0" />
              <span className="text-[#26a17b]/70 text-[11px]">{t('withdraw.trc20Warning')}</span>
            </div>
          )}
        </motion.div>

        {/* Summary - Receipt Style */}
        {amountNum > 0 && (
          <>
            <div className="mx-6 border-t border-white/[0.04]" />
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-[#04cf99]/70" />
                <span className="text-[#04cf99] text-sm font-bold">{t('withdraw.withdrawSummary')}</span>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                {/* Receipt header */}
                <div className="px-4 py-2.5 bg-white/[0.02] border-b border-dashed border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-[11px] font-semibold">{t('withdraw.withdrawReceipt')}</span>
                    <span className="text-white/20 text-[10px]">{selectedCrypto.network}</span>
                  </div>
                </div>

                {/* Receipt body */}
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-sm">{t('withdraw.withdrawAmount')}</span>
                    <span className="text-white font-bold text-lg">${safeFixed(amountNum)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-sm">{t('common.network')}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: selectedCrypto.color }}
                      />
                      <span className="text-white/70 text-sm font-medium">{selectedCrypto.label}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-sm">{t('withdraw.fee')}</span>
                    <div className="flex items-center gap-1">
                      <Minus size={10} className="text-red-400/60" />
                      <span className="text-red-400/80 text-sm font-medium">${safeFixed(networkFee)}</span>
                    </div>
                  </div>
                </div>

                {/* Receipt footer - Estimated received */}
                <div className="px-4 py-3 border-t border-dashed border-white/[0.06]" style={{ background: 'rgba(4,207,153,0.04)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[#04cf99]/70 text-sm font-semibold">{t('withdraw.expectedReceive')}</span>
                    <span className="text-[#04cf99] font-bold text-lg">${safeFixed(estimatedReceived)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* KYC Warning for >$1000 */}
        {amountNum > 10000 && !['VERIFIED', 'APPROVED'].includes(user?.kycStatus || '') && (
          <div className="mx-6 mb-2">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 border border-amber-500/15">
                <Shield size={16} className="text-amber-400" />
              </div>
              <div>
                <span className="text-amber-400 text-sm font-bold block">{t('withdraw.kycRequiredShort')}</span>
                <span className="text-amber-400/60 text-xs">{t('withdraw.kycRequiredForLarge')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="mx-6">
            <div className={`flex items-center gap-2.5 p-4 rounded-xl text-sm ${
              message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 
              message.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
              'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : message.type === 'warning' ? <Info size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="p-6 pt-2">
          <motion.button
            type="submit"
            disabled={loading || maxWithdraw <= 0}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
            className="relative w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #04cf99 0%, #04b383 100%)',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(4,207,153,0.35), 0 0 40px rgba(4,207,153,0.15)',
            }}
          >
            {/* Animated shine effect */}
            {!loading && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                }}
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <span className="relative flex items-center gap-2.5">
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ArrowUpFromLine size={18} />
              )}
              {loading ? t('withdraw.processingLabel') : t('withdraw.submitWithdraw')}
            </span>
          </motion.button>

          {/* Processing time note */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Clock size={11} className="text-white/20" />
            <span className="text-white/20 text-[11px]">{t('withdraw.autoProcessNote')}</span>
          </div>
        </div>
      </form>
      </>
      )}
    </div>
  );
}
