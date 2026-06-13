'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  details: string | null;
  createdAt: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  deposit: <ArrowDownToLine size={16} />,
  withdrawal: <ArrowUpFromLine size={16} />,
  investment: <Briefcase size={16} />,
  profit: <TrendingUp size={16} />,
};

const typeColors: Record<string, string> = {
  deposit: 'text-green-400 bg-green-500/10',
  withdrawal: 'text-red-400 bg-red-500/10',
  investment: 'text-[#409eff] bg-[#409eff]/10',
  profit: 'text-emerald-400 bg-emerald-500/10',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
};


export default function TransactionsPage() {
  const { user } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const typeLabels: Record<string, string> = {
    deposit: t('transactions.deposit'),
    withdrawal: t('transactions.withdrawal'),
    investment: t('transactions.investment'),
    profit: t('transactions.profit'),
  };

  const statusLabels: Record<string, string> = {
    pending: t('common.pending'),
    completed: t('common.completed'),
    failed: t('common.failed'),
  };

  const filters = [
    { id: 'all', label: t('common.all') },
    { id: 'deposit', label: t('transactions.deposit') },
    { id: 'withdrawal', label: t('transactions.withdrawal') },
    { id: 'investment', label: t('transactions.investment') },
    { id: 'profit', label: t('transactions.profit') },
  ];

  useEffect(() => {
    if (user) loadTransactions();
  }, [user]);

  async function loadTransactions() {
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
  }

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <h2 className="text-2xl font-bold text-white mb-2">{t('transactions.title')}</h2>
        <p className="text-white/40 text-sm">{t('transactions.subtitle')}</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter size={16} className="text-white/30 flex-shrink-0" />
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              filter === f.id
                ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20'
                : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      {filteredTransactions.length > 0 ? (
        <div className="space-y-2">
          {filteredTransactions.map((txn, i) => (
            <motion.div
              key={txn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-4 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${typeColors[txn.type] || 'bg-white/5 text-white/40'}`}>
                  {typeIcons[txn.type] || <Receipt size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{typeLabels[txn.type] || txn.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[txn.status] || 'bg-white/5 text-white/40'}`}>
                      {statusLabels[txn.status] || txn.status}
                    </span>
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">
                    {txn.details && <span className="ml-2">{txn.details}</span>}
                    {formatDate(txn.createdAt)}
                  </div>
                </div>
              </div>

              <div className="text-left" dir="ltr">
                <span className={`font-bold ${
                  txn.type === 'deposit' || txn.type === 'profit' ? 'text-green-400' :
                  txn.type === 'withdrawal' || txn.type === 'investment' ? 'text-red-400' :
                  'text-white/60'
                }`}>
                  {txn.type === 'deposit' || txn.type === 'profit' ? '+' : '-'}${safeFixed(txn.amount)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl bg-[#1f2634] border border-white/5">
          <Receipt size={48} className="text-white/10 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('transactions.noTransactions')}</h3>
          <p className="text-white/30 text-sm">
            {filter !== 'all' ? t('transactions.noTypeTransactions') : t('transactions.noTransactionsDesc')}
          </p>
        </div>
      )}
    </div>
  );
}
