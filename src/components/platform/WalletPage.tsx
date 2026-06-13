'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  RefreshCw,
  Copy,
  CheckCircle,
  Clock,
  Loader2,
  CreditCard,
  History,
  ChevronLeft,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  createdAt: string;
}

export default function WalletPage() {
  const { user, setDashboardPage, refreshUser } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const typeLabels: Record<string, string> = {
    deposit: t('wallet.depositLabel'),
    withdrawal: t('wallet.withdrawalLabel'),
    investment: t('wallet.investmentLabel'),
    profit: t('wallet.profitLabel'),
    referral: t('wallet.referralLabel'),
  };

  const statusLabels: Record<string, string> = {
    COMPLETED: t('wallet.completedStatus'),
    PENDING: t('wallet.pendingStatus'),
    FAILED: t('wallet.failedStatus'),
    APPROVED: t('wallet.approvedStatus'),
    REJECTED: t('wallet.rejectedStatus'),
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/${user.id}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      await loadData();
    } catch {
      // ignore
    }
    setTimeout(() => setRefreshing(false), 600);
  };

  const walletAddress = '0x23b1f4812089c7dd471104fd17686765598d005f';

  const copyWalletAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const recentTransactions = filteredTransactions.slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#409eff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-bl from-[#409eff]/10 via-[#1f2634] to-[#1f2634] border border-[#409eff]/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-[#409eff]" />
            <span className="text-white/40 text-sm">{t('wallet.mainWallet')}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg text-white/20 hover:text-[#409eff] transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="text-3xl sm:text-4xl font-bold text-[#409eff] mb-1" dir="ltr">
          ${safeFixed(user?.balance)}
        </div>
        <p className="text-white/25 text-xs mb-5">{t('wallet.availableBalance')}</p>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
            <div className="text-green-400 font-bold text-sm" dir="ltr">${safeFixed(user?.totalProfit)}</div>
            <div className="text-white/25 text-[10px] mt-0.5">{t('wallet.totalProfits')}</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
            <div className="text-blue-400 font-bold text-sm" dir="ltr">${safeFixed(user?.totalDeposit)}</div>
            <div className="text-white/25 text-[10px] mt-0.5">{t('wallet.totalDeposited')}</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
            <div className="text-red-400 font-bold text-sm" dir="ltr">${safeFixed(user?.totalWithdraw)}</div>
            <div className="text-white/25 text-[10px] mt-0.5">{t('wallet.totalWithdrawn')}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDashboardPage('deposit')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-semibold text-sm hover:bg-green-500/15 transition-all"
          >
            <ArrowDownToLine size={16} />
            {t('wallet.deposit')}
          </button>
          <button
            onClick={() => setDashboardPage('withdraw')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm hover:bg-red-500/15 transition-all"
          >
            <ArrowUpFromLine size={16} />
            {t('wallet.withdraw')}
          </button>
        </div>
      </motion.div>

      {/* Deposit Address */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 rounded-xl bg-[#1f2634] border border-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-white/30" />
            <span className="text-white/40 text-xs">{t('wallet.defaultDepositAddress')}</span>
          </div>
          <button
            onClick={copyWalletAddress}
            className="flex items-center gap-1 text-[#409eff] text-xs hover:text-[#337ecc] transition-colors"
          >
            {copiedAddress ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copiedAddress ? t('common.copied') : t('common.copy')}
          </button>
        </div>
        <div className="mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-xs font-mono" dir="ltr">
          {walletAddress}
        </div>
      </motion.div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <History size={16} className="text-[#409eff]" />
            {t('wallet.transactionHistory')}
          </h3>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-3">
          {(['all', 'deposit', 'withdrawal'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20'
                  : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60'
              }`}
            >
              {f === 'all' ? t('common.all') : f === 'deposit' ? t('wallet.depositLabel') : t('wallet.withdrawalLabel')}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((txn, i) => (
              <motion.div
                key={txn.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 rounded-lg bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    txn.type === 'deposit' || txn.type === 'profit' || txn.type === 'referral'
                      ? 'bg-green-500/10'
                      : txn.type === 'withdrawal'
                        ? 'bg-red-500/10'
                        : 'bg-[#409eff]/10'
                  }`}>
                    {txn.type === 'deposit' ? <ArrowDownToLine size={14} className="text-green-400" /> :
                     txn.type === 'withdrawal' ? <ArrowUpFromLine size={14} className="text-red-400" /> :
                     txn.type === 'profit' ? <TrendingUp size={14} className="text-emerald-400" /> :
                     <CreditCard size={14} className="text-[#409eff]" />}
                  </div>
                  <div>
                    <span className="text-white/70 text-xs font-medium">{typeLabels[txn.type] || txn.type}</span>
                    <div className="flex items-center gap-1 text-white/15 text-[10px] mt-0.5">
                      <Clock size={8} />
                      {new Date(txn.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-sm font-bold ${
                    txn.type === 'deposit' || txn.type === 'profit' || txn.type === 'referral'
                      ? 'text-green-400'
                      : txn.type === 'withdrawal'
                        ? 'text-red-400'
                        : 'text-[#409eff]'
                  }`} dir="ltr">
                    {txn.type === 'deposit' || txn.type === 'profit' || txn.type === 'referral' ? '+' : '-'}${safeFixed(txn.amount)}
                  </div>
                  <div className={`text-[10px] text-center ${
                    txn.status === 'COMPLETED' || txn.status === 'APPROVED' ? 'text-green-400/50' :
                    txn.status === 'PENDING' ? 'text-amber-400/50' : 'text-red-400/50'
                  }`}>
                    {statusLabels[txn.status] || txn.status}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12">
              <History size={32} className="text-white/8 mx-auto mb-3" />
              <p className="text-white/20 text-sm">{t('wallet.noTransactions')}</p>
            </div>
          )}
        </div>

        {transactions.length > 10 && (
          <button
            onClick={() => setDashboardPage('transactions')}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/30 text-xs hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
          >
            {t('wallet.viewAllTransactions')}
            <ChevronLeft size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
