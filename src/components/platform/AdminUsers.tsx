'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserCheck,
  UserX,
  XCircle,
  CheckCircle,
  Download,
  Shield,
  Mail,
  Briefcase,
  Clock,
  TrendingUp,
  X,
  FileDown,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface UserData {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalProfit: number;
  emailVerified: boolean;
  isActive: boolean;
  role: string;
  createdAt: string;
  activeInvestments: number;
  kycStatus?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsers() {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [users, setUsers] = useState<UserData[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isMobile, setIsMobile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadUsers = useCallback(async (page = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = useAppStore.getState().getToken();
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (roleFilter) params.set('role', roleFilter);

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, search, statusFilter, roleFilter]);

  useEffect(() => {
    loadUsers(1);
  }, [search, statusFilter, roleFilter, loadUsers]);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    loadUsers(page);
  };

  async function toggleUserStatus(targetUser: UserData) {
    if (!user) return;
    setActionLoading(targetUser.id);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ isActive: !targetUser.isActive }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: data.message || t('common.updatedSuccessfully') });
        await loadUsers(pagination.page);
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

  async function bulkAction(action: 'activate' | 'deactivate') {
    if (!user || selectedUsers.size === 0) return;
    setActionLoading('bulk');
    try {
      const token = useAppStore.getState().getToken();
      let successCount = 0;
      for (const userId of selectedUsers) {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ isActive: action === 'activate' }),
        });
        if (res.ok) successCount++;
      }
      setToast({ type: 'success', message: t('admin.updatedCount', { count: successCount }) });
      setSelectedUsers(new Set());
      await loadUsers(pagination.page);
    } catch {
      setToast({ type: 'error', message: t('common.error') });
    } finally {
      setActionLoading(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const exportCSV = () => {
    const headers = [t('profile.fullName'), t('auth.email'), t('common.balance'), t('admin.totalDeposit'), t('admin.totalWithdraw'), t('admin.profitLabel'), t('common.status'), t('admin.roleLabel'), t('admin.registrationDate')];
    const rows = users.map(u => [
      u.name, u.email, safeFixed(u.balance), safeFixed(u.totalDeposit),
      safeFixed(u.totalWithdraw), safeFixed(u.totalProfit),
      u.isActive ? t('common.active') : t('common.disabled'), u.role, new Date(u.createdAt).toLocaleDateString('ar-SA')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const headers = [t('profile.fullName'), t('auth.email'), t('common.balance'), t('admin.totalDeposit'), t('admin.totalWithdraw'), t('admin.profitLabel'), t('common.status'), t('admin.roleLabel'), t('admin.registrationDate')];
    const rows = users.map(u => [
      u.name, u.email, safeFixed(u.balance), safeFixed(u.totalDeposit),
      safeFixed(u.totalWithdraw), safeFixed(u.totalProfit),
      u.isActive ? t('common.active') : t('common.disabled'), u.role, new Date(u.createdAt).toLocaleDateString('ar-SA')
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
        <h1>${t('admin.manageUserTitle')} - ${t('common.appName')}</h1>
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
    a.download = `users_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  async function deleteUser(userId: string) {
    if (!user) return;
    setActionLoading(userId);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: data.message || t('admin.userDeleted') });
        setSelectedUser(null);
        await loadUsers(pagination.page);
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const kycLabels: Record<string, string> = {
    NONE: t('kyc.noneStatusShort'),
    PENDING: t('kyc.pendingStatus'),
    APPROVED: t('kyc.approved'),
    REJECTED: t('kyc.rejectedStatus'),
  };

  const kycColors: Record<string, string> = {
    NONE: 'bg-white/5 text-white/30',
    PENDING: 'bg-yellow-500/10 text-yellow-400',
    APPROVED: 'bg-green-500/10 text-green-400',
    REJECTED: 'bg-red-500/10 text-red-400',
  };

  const filters = [
    { id: '', label: t('common.all') },
    { id: 'active', label: t('common.active') },
    { id: 'inactive', label: t('common.disabled') },
  ];

  const roleFilters = [
    { id: '', label: t('admin.allRoles') },
    { id: 'admin', label: t('admin.adminRole') },
    { id: 'user', label: t('admin.userRole') },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users size={22} className="text-[#409eff]" />
              {t('admin.manageUserTitle')}
            </h2>
            <p className="text-white/40 text-sm">{pagination.total} {t('admin.userCount')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
            >
              <FileDown size={14} />
              {t('admin.exportPDF')}
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
            >
              <Download size={14} />
              {t('admin.exportCSV')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder={t('admin.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-3 rounded-xl bg-[#1f2634] border border-white/5 text-white placeholder-white/30 text-sm focus:border-[#409eff]/30 focus:outline-none transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-white/30" />
          {filters.map((f) => (
            <button
              key={`status-${f.id}`}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === f.id
                  ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20'
                  : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-1" />
          {roleFilters.map((f) => (
            <button
              key={`role-${f.id}`}
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                roleFilter === f.id
                  ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20'
                  : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 rounded-xl bg-[#409eff]/5 border border-[#409eff]/10">
          <span className="text-[#409eff] text-sm font-medium">{selectedUsers.size} {t('admin.selectedCount')}</span>
          <div className="flex-1" />
          <button
            onClick={() => bulkAction('activate')}
            disabled={actionLoading === 'bulk'}
            className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
          >
            {t('admin.activateAll')}
          </button>
          <button
            onClick={() => bulkAction('deactivate')}
            disabled={actionLoading === 'bulk'}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
          >
            {t('admin.deactivateAll')}
          </button>
          <button
            onClick={() => setSelectedUsers(new Set())}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#409eff]" />
        </div>
      ) : users.length > 0 ? (
        <>
          {/* Desktop Table */}
          {!isMobile && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === users.length && users.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-white/20 bg-white/5 text-[#409eff] focus:ring-[#409eff]/30"
                        />
                      </th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('name')}>
                        {t('admin.manageUserTitle').replace(` ${t('admin.userCount')}`, '')} {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('balance')}>
                        {t('common.balance')} {sortField === 'balance' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 hidden sm:table-cell">{t('admin.totalDeposit')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 hidden md:table-cell">{t('admin.totalWithdraw')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 hidden lg:table-cell">{t('admin.profitLabel')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3 hidden lg:table-cell">{t('admin.kyc')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('common.status')}</th>
                      <th className="text-right text-white/40 font-medium px-4 py-3">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${selectedUsers.has(u.id) ? 'bg-[#409eff]/[0.03]' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                            className="rounded border-white/20 bg-white/5 text-[#409eff] focus:ring-[#409eff]/30"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 flex items-center justify-center text-[#409eff] font-bold text-sm shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-white/80 font-medium truncate">{u.name}</div>
                              <div className="text-white/30 text-xs truncate" dir="ltr">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-[#409eff] font-medium">${safeFixed(u.balance)}</span></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><span className="text-green-400">${safeFixed(u.totalDeposit)}</span></td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className="text-red-400">${safeFixed(u.totalWithdraw)}</span></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><span className="text-emerald-400">${safeFixed(u.totalProfit)}</span></td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${kycColors[u.kycStatus || 'NONE']}`}>
                            {kycLabels[u.kycStatus || 'NONE']}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${u.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                            {u.isActive ? t('common.active') : t('common.disabled')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedUser(u)} className="p-1.5 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/10 transition-all" title={t('admin.viewDetails')}>
                              <Eye size={16} />
                            </button>
                            <button onClick={() => toggleUserStatus(u)} disabled={actionLoading === u.id} className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${u.isActive ? 'text-red-400/50 hover:text-red-400 hover:bg-red-500/10' : 'text-green-400/50 hover:text-green-400 hover:bg-green-500/10'}`} title={u.isActive ? t('admin.deactivate') : t('admin.activate')}>
                              {actionLoading === u.id ? <Loader2 size={16} className="animate-spin" /> : u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>
                            <button onClick={() => setDeleteConfirm(u.id)} className="p-1.5 rounded-lg text-red-400/30 hover:text-red-400 hover:bg-red-500/10 transition-all" title={t('admin.deleteUser')}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <span className="text-white/30 text-sm">{t('admin.page')} {pagination.page} {t('admin.of')} {pagination.totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handlePageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Mobile Card Layout */}
          {isMobile && (
            <div className="space-y-3">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`p-4 rounded-xl bg-[#1f2634] border transition-colors ${selectedUsers.has(u.id) ? 'border-[#409eff]/30' : 'border-white/5'}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(u.id)}
                      onChange={() => toggleSelectUser(u.id)}
                      className="rounded border-white/20 bg-white/5 text-[#409eff]"
                    />
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 flex items-center justify-center text-[#409eff] font-bold text-sm">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/80 font-medium text-sm">{u.name}</div>
                      <div className="text-white/30 text-xs" dir="ltr">{u.email}</div>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                      <div className="text-[#409eff] font-bold text-xs">${safeFixed(u.balance)}</div>
                      <div className="text-white/25 text-[9px]">{t('common.balance')}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                      <div className="text-green-400 font-bold text-xs">${safeFixed(u.totalDeposit)}</div>
                      <div className="text-white/25 text-[9px]">{t('admin.totalDeposit')}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                      <div className="text-emerald-400 font-bold text-xs">${safeFixed(u.totalProfit)}</div>
                      <div className="text-white/25 text-[9px]">{t('admin.profitLabel')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedUser(u)} className="flex-1 py-2 rounded-lg bg-white/[0.03] text-white/40 text-xs hover:text-[#409eff] transition-all flex items-center justify-center gap-1">
                      <Eye size={12} /> {t('common.details')}
                    </button>
                    <button onClick={() => toggleUserStatus(u)} disabled={actionLoading === u.id} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1 ${u.isActive ? 'bg-red-500/5 text-red-400 hover:bg-red-500/10' : 'bg-green-500/5 text-green-400 hover:bg-green-500/10'}`}>
                      {actionLoading === u.id ? <Loader2 size={12} className="animate-spin" /> : u.isActive ? <><UserX size={12} /> {t('admin.deactivate')}</> : <><UserCheck size={12} /> {t('admin.activate')}</>}
                    </button>
                  </div>
                </motion.div>
              ))}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/30 text-xs">{pagination.page} / {pagination.totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handlePageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={14} /></button>
                    <button onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <Users size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('admin.noUsers')}</h3>
          <p className="text-white/30 text-sm">{t('admin.noMatchingUsers')}</p>
        </motion.div>
      )}

      {/* User Detail Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-start justify-end"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md h-full bg-[#1f2634] border-l border-[#409eff]/20 overflow-y-auto"
            >
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg">{t('admin.userDetails')}</h3>
                  <button onClick={() => setSelectedUser(null)} className="text-white/30 hover:text-white"><X size={20} /></button>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-4 pb-5 border-b border-white/5">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 flex items-center justify-center text-[#409eff] font-bold text-2xl">
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">{selectedUser.name}</div>
                    <div className="text-white/40 text-sm" dir="ltr">{selectedUser.email}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedUser.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {selectedUser.isActive ? t('common.active') : t('common.disabled')}
                      </span>
                      {selectedUser.role?.toUpperCase() === 'ADMIN' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff] flex items-center gap-1"><Shield size={10} /> {t('admin.adminRole')}</span>
                      )}
                      {selectedUser.emailVerified && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 flex items-center gap-1"><Mail size={10} /> {t('admin.verifiedLabel')}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${kycColors[selectedUser.kycStatus || 'NONE']}`}>
                        KYC: {kycLabels[selectedUser.kycStatus || 'NONE']}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div>
                  <h4 className="text-white/50 text-xs font-medium mb-3 flex items-center gap-2">
                    <TrendingUp size={12} />
                    {t('admin.financialSummary')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-white/30 text-[10px] mb-1">{t('common.balance')}</div>
                      <div className="text-[#409eff] font-bold">${safeFixed(selectedUser.balance)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-white/30 text-[10px] mb-1">{t('admin.totalDeposit')}</div>
                      <div className="text-green-400 font-bold">${safeFixed(selectedUser.totalDeposit)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-white/30 text-[10px] mb-1">{t('admin.totalWithdraw')}</div>
                      <div className="text-red-400 font-bold">${safeFixed(selectedUser.totalWithdraw)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-white/30 text-[10px] mb-1">{t('admin.profitLabel')}</div>
                      <div className="text-emerald-400 font-bold">${safeFixed(selectedUser.totalProfit)}</div>
                    </div>
                  </div>
                </div>

                {/* Investment Summary */}
                <div>
                  <h4 className="text-white/50 text-xs font-medium mb-3 flex items-center gap-2">
                    <Briefcase size={12} />
                    {t('admin.investmentsSection')}
                  </h4>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/30 text-xs">{t('admin.activeInvestmentsShort')}</span>
                      <span className="text-blue-400 font-bold">{selectedUser.activeInvestments}</span>
                    </div>
                  </div>
                </div>

                {/* Account Info */}
                <div>
                  <h4 className="text-white/50 text-xs font-medium mb-3 flex items-center gap-2">
                    <Clock size={12} />
                    {t('admin.accountInfo')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-white/30 text-xs">{t('admin.registrationDate')}</span>
                      <span className="text-white/60 text-xs font-medium">{formatDate(selectedUser.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-white/30 text-xs">{t('admin.emailLabel')}</span>
                      <span className="text-white/60 text-xs font-medium" dir="ltr">{selectedUser.email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-white/30 text-xs">{t('admin.roleLabel')}</span>
                      <span className="text-white/60 text-xs font-medium">{selectedUser.role?.toUpperCase() === 'ADMIN' ? t('admin.adminRole') : t('admin.userRole')}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => { toggleUserStatus(selectedUser); setSelectedUser(null); }}
                    disabled={actionLoading === selectedUser.id}
                    className={`w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 ${
                      selectedUser.isActive
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                    }`}
                  >
                    {actionLoading === selectedUser.id ? <Loader2 size={16} className="animate-spin inline" /> : selectedUser.isActive ? t('admin.deactivateUser') : t('admin.activateUser')}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(selectedUser.id)}
                    className="w-full py-3 rounded-xl font-medium text-sm transition-all bg-red-500/5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 border border-red-500/10"
                  >
                    <Trash2 size={14} className="inline mr-1" />
                    {t('admin.deleteUser')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#1f2634] border border-red-500/20 p-6 space-y-4">
            <h3 className="text-white font-bold text-lg">{t('profile.confirmPermanentDeletion')}</h3>
            <p className="text-white/50 text-sm">{t('admin.deleteUserConfirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => deleteUser(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all">
                {t('common.delete')}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 transition-all">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
