'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Filter,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  TrendingUp,
  Clock,
  Download,
  Eye,
  X,
  Search,
  FileDown,
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
  reference: string | null;
  walletAddress?: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; isActive: boolean };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminTransactions() {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const typeLabels: Record<string, string> = {
    deposit: t('transactions.deposit'),
    withdrawal: t('transactions.withdrawal'),
    investment: t('transactions.investment'),
    profit: t('transactions.profit'),
    referral_bonus: t('transactions.referralBonus'),
    WEEKLY_TRANSFER: t('admin.thisWeek'),
    INVESTMENT_RETURN: t('admin.investments'),
  };

  const typeIcons: Record<string, React.ReactNode> = {
    deposit: <ArrowDownToLine size={14} />,
    withdrawal: <ArrowUpFromLine size={14} />,
    investment: <Briefcase size={14} />,
    profit: <TrendingUp size={14} />,
  };

  const typeColors: Record<string, string> = {
    deposit: 'text-green-400 bg-green-500/10',
    withdrawal: 'text-red-400 bg-red-500/10',
    investment: 'text-[#409eff] bg-[#409eff]/10',
    profit: 'text-emerald-400 bg-emerald-500/10',
  };

  const statusLabels: Record<string, string> = {
    PENDING: t('common.pending'),
    COMPLETED: t('common.completed'),
    FAILED: t('common.failed'),
    PROCESSING: t('common.loading'),
    APPROVED: t('common.approved'),
    REJECTED: t('common.rejected'),
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400',
    COMPLETED: 'bg-green-500/10 text-green-400',
    FAILED: 'bg-red-500/10 text-red-400',
    PROCESSING: 'bg-blue-500/10 text-blue-400',
    APPROVED: 'bg-green-500/10 text-green-400',
    REJECTED: 'bg-red-500/10 text-red-400',
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadTransactions = useCallback(async (page = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = useAppStore.getState().getToken();
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/transactions?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, typeFilter, statusFilter]);

  useEffect(() => {
    loadTransactions(1);
  }, [typeFilter, statusFilter, loadTransactions]);

  async function updateTransactionStatus(transactionId: string, newStatus: string) {
    if (!user) return;
    setActionLoading(transactionId);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: data.message || t('common.updatedSuccessfully') });
        await loadTransactions(pagination.page);
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    } finally {
      setActionLoading(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const exportCSV = () => {
    const headers = [t('admin.manageUserTitle'), t('transactions.type'), t('common.amount'), t('common.status'), t('common.network'), t('common.date')];
    const rows = transactions.map(tx => [
      tx.user.name, typeLabels[tx.type] || tx.type, safeFixed(tx.amount),
      statusLabels[tx.status] || tx.status, tx.method || '-', new Date(tx.createdAt).toLocaleDateString('ar-SA')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const headers = [t('admin.manageUserTitle'), t('transactions.type'), t('common.amount'), t('common.status'), t('common.network'), t('common.date')];
    const rows = transactions.map(tx => [
      tx.user.name, typeLabels[tx.type] || tx.type, safeFixed(tx.amount),
      statusLabels[tx.status] || tx.status, tx.method || '-', new Date(tx.createdAt).toLocaleDateString('ar-SA')
    ]);

    const html = `
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; color: #333; }
          h1 { color: #409eff; font-size: 18px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1f2634; color: white; padding: 8px 12px; text-align: right; }
          td { border-bottom: 1px solid #eee; padding: 6px 12px; }
          .footer { margin-top: 20px; font-size: 10px; color: #999; }
        </style>
      </head>
      <body>
        <h1>${t('admin.manageTransactions')} - ${t('common.appName')}</h1>
        <p>${new Date().toLocaleDateString('ar-SA')}</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="footer">SONA Platform - Generated ${new Date().toLocaleString('ar-SA')}</div>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const typeFilters = [
    { id: '', label: t('common.all') },
    { id: 'deposit', label: t('transactions.deposit') },
    { id: 'withdrawal', label: t('transactions.withdrawal') },
    { id: 'investment', label: t('transactions.investment') },
    { id: 'profit', label: t('transactions.profit') },
  ];

  const statusFilters = [
    { id: '', label: t('common.all') },
    { id: 'PENDING', label: t('common.pending') },
    { id: 'COMPLETED', label: t('common.completed') },
    { id: 'FAILED', label: t('common.failed') },
    { id: 'PROCESSING', label: t('common.loading') },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Receipt size={22} className="text-[#409eff]" />
              {t('admin.manageTransactions')}
            </h2>
            <p className="text-white/40 text-sm">{pagination.total} {t('admin.userCount')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all">
              <FileDown size={14} />
              {t('admin.exportPDF')}
            </button>
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all">
              <Download size={14} />
              {t('admin.exportCSV')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={14} className="text-white/30 shrink-0" />
          <span className="text-white/30 text-xs shrink-0">{t('common.status')}:</span>
          {typeFilters.map((f) => (
            <button key={`type-${f.id}`} onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${typeFilter === f.id ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Clock size={14} className="text-white/30 shrink-0" />
          <span className="text-white/30 text-xs shrink-0">{t('common.status')}:</span>
          {statusFilters.map((f) => (
            <button key={`status-${f.id}`} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${statusFilter === f.id ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Transactions */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : transactions.length > 0 ? (
        <>
          {/* Desktop Table */}
          {!isMobile && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('admin.manageUserTitle')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('common.status')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('common.amount')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 hidden sm:table-cell">{t('common.network')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('common.status')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 hidden md:table-cell">{t('common.date')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-white/80 font-medium truncate">{tx.user.name}</div>
                            <div className="text-white/30 text-xs truncate" dir="ltr">{tx.user.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${typeColors[tx.type] || 'bg-white/5 text-white/40'}`}>
                            {typeIcons[tx.type]}
                            {typeLabels[tx.type] || tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold text-sm ${tx.type === 'deposit' || tx.type === 'profit' ? 'text-green-400' : 'text-red-400'}`} dir="ltr">${safeFixed(tx.amount)}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell"><span className="text-white/40 text-xs">{tx.method || '—'}</span></td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${statusColors[tx.status] || 'bg-white/5 text-white/40'}`}>{statusLabels[tx.status] || tx.status}</span></td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className="text-white/40 text-xs">{formatDate(tx.createdAt)}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedTx(tx)} className="p-1.5 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/10 transition-all" title={t('common.details')}><Eye size={14} /></button>
                            {tx.status === 'PENDING' && (tx.type === 'deposit' || tx.type === 'withdrawal') && (
                              <>
                                <button onClick={() => updateTransactionStatus(tx.id, 'APPROVED')} disabled={actionLoading === tx.id} className="p-1.5 rounded-lg text-green-400/50 hover:text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50" title={t('common.approved')}>
                                  {actionLoading === tx.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                </button>
                                <button onClick={() => updateTransactionStatus(tx.id, 'REJECTED')} disabled={actionLoading === tx.id} className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50" title={t('common.rejected')}><XCircle size={14} /></button>
                              </>
                            )}
                            {tx.status === 'PROCESSING' && tx.type === 'withdrawal' && (
                              <button onClick={() => updateTransactionStatus(tx.id, 'APPROVED')} disabled={actionLoading === tx.id} className="p-1.5 rounded-lg text-green-400/50 hover:text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50" title={t('common.confirm')}>
                                {actionLoading === tx.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <span className="text-white/30 text-sm">{t('admin.page')} {pagination.page} {t('admin.of')} {pagination.totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadTransactions(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
                    <button onClick={() => loadTransactions(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Mobile Cards */}
          {isMobile && (
            <div className="space-y-3">
              {transactions.map((tx, i) => (
                <motion.div key={tx.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-xl bg-[#1f2634] border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${typeColors[tx.type] || 'bg-white/5 text-white/40'}`}>{typeIcons[tx.type]}{typeLabels[tx.type] || tx.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[tx.status] || 'bg-white/5 text-white/40'}`}>{statusLabels[tx.status] || tx.status}</span>
                    </div>
                    <span className={`font-bold text-sm ${tx.type === 'deposit' || tx.type === 'profit' ? 'text-green-400' : 'text-red-400'}`} dir="ltr">${safeFixed(tx.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">{tx.user.name}</span>
                    <span className="text-white/25">{formatDate(tx.createdAt)}</span>
                  </div>
                  {(tx.status === 'PENDING' || tx.status === 'PROCESSING') && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => setSelectedTx(tx)} className="flex-1 py-2 rounded-lg bg-white/[0.03] text-white/40 text-xs hover:text-[#409eff] transition-all flex items-center justify-center gap-1"><Eye size={12} /> {t('common.details')}</button>
                      {tx.status === 'PENDING' && (
                        <>
                          <button onClick={() => updateTransactionStatus(tx.id, 'APPROVED')} disabled={actionLoading === tx.id} className="flex-1 py-2 rounded-lg bg-green-500/5 text-green-400 text-xs hover:bg-green-500/10 transition-all disabled:opacity-50 flex items-center justify-center gap-1"><CheckCircle size={12} /> {t('common.approved')}</button>
                          <button onClick={() => updateTransactionStatus(tx.id, 'REJECTED')} disabled={actionLoading === tx.id} className="flex-1 py-2 rounded-lg bg-red-500/5 text-red-400 text-xs hover:bg-red-500/10 transition-all disabled:opacity-50 flex items-center justify-center gap-1"><XCircle size={12} /> {t('common.rejected')}</button>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/30 text-xs">{pagination.page} / {pagination.totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadTransactions(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={14} /></button>
                    <button onClick={() => loadTransactions(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <Receipt size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('admin.noTransactions')}</h3>
          <p className="text-white/30 text-sm">{t('common.noResults')}</p>
        </motion.div>
      )}

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTx(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[#1f2634] border border-[#409eff]/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">{t('common.details')}</h3>
                <button onClick={() => setSelectedTx(null)} className="text-white/30 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('admin.manageUserTitle')}</span>
                  <span className="text-white/70 text-sm font-medium">{selectedTx.user.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('admin.emailLabel')}</span>
                  <span className="text-white/50 text-xs" dir="ltr">{selectedTx.user.email}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('common.status')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-lg ${typeColors[selectedTx.type] || 'bg-white/5 text-white/40'}`}>{typeLabels[selectedTx.type] || selectedTx.type}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('common.amount')}</span>
                  <span className={`font-bold ${selectedTx.type === 'deposit' || selectedTx.type === 'profit' ? 'text-green-400' : 'text-red-400'}`} dir="ltr">${safeFixed(selectedTx.amount)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('common.status')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[selectedTx.status] || 'bg-white/5 text-white/40'}`}>{statusLabels[selectedTx.status] || selectedTx.status}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('common.network')}</span>
                  <span className="text-white/50 text-xs">{selectedTx.method || '—'}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 text-xs">{t('common.date')}</span>
                  <span className="text-white/50 text-xs">{formatDate(selectedTx.createdAt)}</span>
                </div>
                {selectedTx.details && (
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/40 text-xs block mb-1">{t('common.details')}</span>
                    <span className="text-white/50 text-xs leading-relaxed">{selectedTx.details}</span>
                  </div>
                )}
                {selectedTx.walletAddress && (
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/40 text-xs block mb-1">{t('withdraw.enterWallet')}</span>
                    <span className="text-white/50 text-xs font-mono break-all" dir="ltr">{selectedTx.walletAddress}</span>
                  </div>
                )}
              </div>
              {(selectedTx.status === 'PENDING' || selectedTx.status === 'PROCESSING') && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { updateTransactionStatus(selectedTx.id, 'APPROVED'); setSelectedTx(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all flex items-center justify-center gap-1">
                    <CheckCircle size={14} /> {t('common.approved')}
                  </button>
                  <button onClick={() => { updateTransactionStatus(selectedTx.id, 'REJECTED'); setSelectedTx(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-1">
                    <XCircle size={14} /> {t('common.rejected')}
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
