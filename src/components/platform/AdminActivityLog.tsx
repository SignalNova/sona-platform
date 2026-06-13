'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Clock,
  User,
  Search,
  Activity,
  Shield,
  Zap,
  Settings,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface LogEntry {
  id: string;
  action: string;
  details: string | null;
  adminId: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const actionIcons: Record<string, React.ElementType> = {
  user_update: Users,
  deposit_check: DollarSign,
  settings_update: Settings,
  security_scan: Shield,
  diagnostics: Zap,
  daily_report: FileText,
  fix_errors: AlertTriangle,
  default: Info,
};

const actionColors: Record<string, string> = {
  user_update: '#409eff',
  deposit_check: '#22c55e',
  settings_update: '#f59e0b',
  security_scan: '#ef4444',
  diagnostics: '#8b5cf6',
  daily_report: '#06b6d4',
  fix_errors: '#f97316',
  default: '#6b7280',
};

export default function AdminActivityLog({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (actionFilter) params.set('action', actionFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/logs?${params}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [actionFilter, searchQuery, getAuthHeaders]);

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadLogs(pagination.page), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, pagination.page]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    for (const [key, Icon] of Object.entries(actionIcons)) {
      if (action.toLowerCase().includes(key.split('_')[0])) return Icon;
    }
    return actionIcons.default;
  };

  const getActionColor = (action: string) => {
    for (const [key, color] of Object.entries(actionColors)) {
      if (action.toLowerCase().includes(key.split('_')[0])) return color;
    }
    return actionColors.default;
  };

  const actionFilters = [
    { id: '', label: t('common.all') },
    { id: 'user', label: t('admin.users') },
    { id: 'deposit', label: t('admin.deposits') },
    { id: 'settings', label: t('admin.settings') },
    { id: 'security', label: t('admin.systemHealth') },
    { id: 'diagnostics', label: t('agent.engineer.runDiagnostics') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText size={22} className="text-[#409eff]" />
              {t('admin.activityLog')}
            </h2>
            <p className="text-white/40 text-sm">{pagination.total} {t('admin.userCount')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                autoRefresh
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-[#409eff]'
              }`}
            >
              <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
              {autoRefresh ? t('common.active') : t('common.refresh')}
            </button>
            <button
              onClick={() => loadLogs(pagination.page)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 rounded-xl bg-[#1f2634] border border-white/5 text-white placeholder-white/30 text-sm focus:border-[#409eff]/30 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={14} className="text-white/30 shrink-0" />
          {actionFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActionFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                actionFilter === f.id
                  ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20'
                  : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Logs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#409eff]" />
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log, i) => {
            const Icon = getActionIcon(log.action);
            const color = getActionColor(log.action);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="p-4 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2 rounded-lg shrink-0 mt-0.5"
                    style={{ backgroundColor: color + '15', color }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-medium text-sm">{log.action}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: color + '15', color }}
                      >
                        {log.action}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-white/40 text-xs leading-relaxed mb-2 line-clamp-2">{log.details}</p>
                    )}
                    <div className="flex items-center gap-3 text-white/20 text-[10px]">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(log.createdAt)}
                      </span>
                      {log.adminId && (
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {t('dashboard.admin')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-white/30 text-sm">
                {t('admin.page')} {pagination.page} {t('admin.of')} {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadLogs(Math.max(1, pagination.page - 1))}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => loadLogs(Math.min(pagination.totalPages, pagination.page + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5"
        >
          <FileText size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('admin.noRecentActivity')}</h3>
          <p className="text-white/30 text-sm">{t('common.noData')}</p>
        </motion.div>
      )}
    </div>
  );
}
