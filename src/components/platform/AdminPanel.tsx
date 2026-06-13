'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  ShieldCheck,
  Package,
  Settings,
  Bell,
  Download,
  FileText,
  Wrench,
  Shield,
  ShieldAlert,
  ShieldX,
  Headphones,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Eye,
  X,
  Megaphone,
  Save,
  Plus,
  Trash2,
  Edit3,
  Menu,
  Globe,
  MapPin,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminTransactions from './AdminTransactions';
import AdminInvestments from './AdminInvestments';
import AdminSupport from './AdminSupport';
import AdminSettings from './AdminSettings';
import AdminActivityLog from './AdminActivityLog';
import AdminEngineerAgent from './AdminEngineerAgent';
import AdminAdvancedPanel from './AdminAdvancedPanel';
import AdminSecurityFortress from './AdminSecurityFortress';

// ─── Helpers ──────────────────────────────────────────────────────
function formatUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateAr(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Tab definitions ──────────────────────────────────────────────
type TabId = 'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'transactions' | 'investments' | 'kyc' | 'packages' | 'settings' | 'notifications' | 'export' | 'activity' | 'engineer' | 'advanced' | 'security' | 'blacklist' | 'support';

interface SidebarTab {
  id: TabId;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
}

const MAIN_TABS: SidebarTab[] = [
  { id: 'dashboard', labelAr: 'الرئيسية', labelEn: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', labelAr: 'المستخدمين', labelEn: 'Users', icon: Users },
  { id: 'deposits', labelAr: 'الإيداعات', labelEn: 'Deposits', icon: ArrowDownToLine },
  { id: 'withdrawals', labelAr: 'السحوبات', labelEn: 'Withdrawals', icon: ArrowUpFromLine },
  { id: 'transactions', labelAr: 'المعاملات', labelEn: 'Transactions', icon: FileText },
  { id: 'investments', labelAr: 'الاستثمارات', labelEn: 'Investments', icon: Briefcase },
  { id: 'kyc', labelAr: 'التحقق', labelEn: 'KYC', icon: ShieldCheck },
  { id: 'packages', labelAr: 'الباقات', labelEn: 'Packages', icon: Package },
];

const SYSTEM_TABS: SidebarTab[] = [
  { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Settings },
  { id: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: Bell },
  { id: 'export', labelAr: 'التصدير', labelEn: 'Export', icon: Download },
  { id: 'activity', labelAr: 'سجل النشاط', labelEn: 'Activity', icon: FileText },
  { id: 'engineer', labelAr: 'وكيل المهندس', labelEn: 'Engineer', icon: Wrench },
  { id: 'security', labelAr: 'قلعة الأمن', labelEn: 'Security Fortress', icon: ShieldAlert },
  { id: 'blacklist', labelAr: 'القائمة السوداء', labelEn: 'Blacklist', icon: ShieldX },
  { id: 'advanced', labelAr: 'لوحة متقدمة', labelEn: 'Advanced', icon: Shield },
  { id: 'support', labelAr: 'الدعم', labelEn: 'Support', icon: Headphones },
];

// ─── Main Component ───────────────────────────────────────────────
export default function AdminPanel({ navigate, isAr }: { navigate: (page: string) => void; isAr: boolean }) {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on tab change (mobile)
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (isMobile) setSidebarOpen(false);
  };

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = useAppStore.getState().getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // ─── Sidebar rendering ──────────────────────────────────────
  const renderSidebarItem = (tab: SidebarTab) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => handleTabChange(tab.id)}
        className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20'
            : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70 border border-transparent'
        }`}
      >
        <Icon size={16} className={isActive ? 'text-[#409eff]' : 'text-white/30'} />
        <span>{isAr ? tab.labelAr : tab.labelEn}</span>
      </button>
    );
  };

  // ─── Content rendering ──────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard onNavigate={(tab) => setActiveTab(tab as TabId)} />;
      case 'users':
        return <AdminUsers />;
      case 'deposits':
        return <AdminDeposits isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'withdrawals':
        return <AdminWithdrawals isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'transactions':
        return <AdminTransactions />;
      case 'investments':
        return <AdminInvestments />;
      case 'kyc':
        return <AdminKYC isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'packages':
        return <AdminPackages isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'settings':
        return <AdminSettings />;
      case 'notifications':
        return <AdminNotifications isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'export':
        return <AdminExport isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'activity':
        return <AdminActivityLog isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'engineer':
        return <AdminEngineerAgent isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'security':
        return <AdminSecurityFortress isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'blacklist':
        return <AdminBlacklistPanel isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'advanced':
        return <AdminAdvancedPanel isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      case 'support':
        return <AdminSupport isAr={isAr} getAuthHeaders={getAuthHeaders} />;
      default:
        return <AdminDashboard onNavigate={(tab) => setActiveTab(tab as TabId)} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#030708]" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`${
          isMobile
            ? `fixed top-0 ${isAr ? 'right-0' : 'left-0'} z-50 h-full transition-transform duration-300 ${
                sidebarOpen ? 'translate-x-0' : isAr ? 'translate-x-full' : '-translate-x-full'
              }`
            : 'relative'
        } w-60 bg-[#0d1117] ${isAr ? 'border-l' : 'border-r'} border-white/[0.06] flex flex-col shrink-0 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 flex items-center justify-center">
              <LayoutDashboard size={18} className="text-[#409eff]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-sm truncate">
                {isAr ? 'لوحة الإدارة' : 'Admin Panel'}
              </h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-white/30 text-[10px]">
                  {isAr ? 'مركز التحكم' : 'Control Center'}
                </span>
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Main Menu Label */}
          <div className="px-4 py-2 text-white/20 text-[10px] font-bold uppercase tracking-wider">
            {isAr ? 'القائمة الرئيسية' : 'Main Menu'}
          </div>
          {MAIN_TABS.map(renderSidebarItem)}

          {/* System & Tools Label */}
          <div className="px-4 py-2 mt-4 text-white/20 text-[10px] font-bold uppercase tracking-wider">
            {isAr ? 'النظام والأدوات' : 'System & Tools'}
          </div>
          {SYSTEM_TABS.map(renderSidebarItem)}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/5 text-sm font-medium transition-all"
          >
            <ArrowUpFromLine size={16} className="rotate-180" />
            <span>{isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-[#0d1117]/80 border-b border-white/[0.06] flex items-center justify-between px-4 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <Menu size={20} />
              </button>
            )}
            <h1 className="text-white font-bold text-sm">
              {(() => {
                const allTabs = [...MAIN_TABS, ...SYSTEM_TABS];
                const tab = allTabs.find(t => t.id === activeTab);
                return tab ? (isAr ? tab.labelAr : tab.labelEn) : '';
              })()}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[#22c55e] text-[10px] font-medium">{isAr ? 'متصل' : 'Online'}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 flex items-center justify-center text-[#409eff] font-bold text-xs">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   INLINE ADMIN COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── Admin Deposits ───────────────────────────────────────────────
function AdminDeposits({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDeposits = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/deposits?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.transactions || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, getAuthHeaders]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadDeposits(1); }, [statusFilter, loadDeposits]);

  async function updateTransactionStatus(id: string, status: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم التحديث بنجاح' : 'Updated successfully' });
        loadDeposits(pagination.page);
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setActionLoading(null);
    setTimeout(() => setToast(null), 4000);
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400',
    COMPLETED: 'bg-green-500/10 text-green-400',
    REJECTED: 'bg-red-500/10 text-red-400',
    FAILED: 'bg-red-500/10 text-red-400',
  };

  const statusLabels: Record<string, string> = {
    PENDING: isAr ? 'معلق' : 'Pending',
    COMPLETED: isAr ? 'مكتمل' : 'Completed',
    REJECTED: isAr ? 'مرفوض' : 'Rejected',
    FAILED: isAr ? 'فاشل' : 'Failed',
  };

  return (
    <div className="space-y-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowDownToLine size={22} className="text-[#409eff]" />
          {isAr ? 'إدارة الإيداعات' : 'Manage Deposits'}
        </h2>
        <p className="text-white/40 text-sm">{pagination.total} {isAr ? 'إيداع' : 'deposits'}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-white/30 shrink-0" />
        {['', 'PENDING', 'COMPLETED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusFilter === s ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            {s === '' ? (isAr ? 'الكل' : 'All') : statusLabels[s] || s}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : deposits.length > 0 ? (
        <div className="space-y-3">
          {deposits.map((dep, i) => (
            <motion.div key={dep.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center shrink-0">
                    <ArrowDownToLine size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm truncate">{dep.user?.name || '-'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[dep.status] || 'bg-white/5 text-white/40'}`}>
                        {statusLabels[dep.status] || dep.status}
                      </span>
                    </div>
                    <div className="text-white/30 text-xs">{dep.user?.email || ''} • {formatDateAr(dep.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#22c55e] font-bold text-sm" dir="ltr">{formatUSD(dep.amount)}</span>
                  {dep.status === 'PENDING' && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateTransactionStatus(dep.id, 'COMPLETED')} disabled={actionLoading === dep.id}
                        className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                        {actionLoading === dep.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      </button>
                      <button onClick={() => updateTransactionStatus(dep.id, 'REJECTED')} disabled={actionLoading === dep.id}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-white/30 text-sm">{isAr ? 'صفحة' : 'Page'} {pagination.page} {isAr ? 'من' : 'of'} {pagination.totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => loadDeposits(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
                <button onClick={() => loadDeposits(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <ArrowDownToLine size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{isAr ? 'لا توجد إيداعات' : 'No deposits found'}</h3>
        </motion.div>
      )}
    </div>
  );
}

// ─── Admin Withdrawals ────────────────────────────────────────────
function AdminWithdrawals({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadWithdrawals = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'WITHDRAWAL', page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/transactions?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.transactions || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, getAuthHeaders]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadWithdrawals(1); }, [statusFilter, loadWithdrawals]);

  async function updateTransactionStatus(id: string, status: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم التحديث بنجاح' : 'Updated successfully' });
        loadWithdrawals(pagination.page);
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setActionLoading(null);
    setTimeout(() => setToast(null), 4000);
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400',
    COMPLETED: 'bg-green-500/10 text-green-400',
    REJECTED: 'bg-red-500/10 text-red-400',
    PROCESSING: 'bg-blue-500/10 text-blue-400',
    FAILED: 'bg-red-500/10 text-red-400',
  };

  const statusLabels: Record<string, string> = {
    PENDING: isAr ? 'معلق' : 'Pending',
    COMPLETED: isAr ? 'مكتمل' : 'Completed',
    REJECTED: isAr ? 'مرفوض' : 'Rejected',
    PROCESSING: isAr ? 'قيد المعالجة' : 'Processing',
    FAILED: isAr ? 'فاشل' : 'Failed',
  };

  return (
    <div className="space-y-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowUpFromLine size={22} className="text-[#409eff]" />
          {isAr ? 'إدارة السحوبات' : 'Manage Withdrawals'}
        </h2>
        <p className="text-white/40 text-sm">{pagination.total} {isAr ? 'سحب' : 'withdrawals'}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-white/30 shrink-0" />
        {['', 'PENDING', 'COMPLETED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusFilter === s ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            {s === '' ? (isAr ? 'الكل' : 'All') : statusLabels[s] || s}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : withdrawals.length > 0 ? (
        <div className="space-y-3">
          {withdrawals.map((wd, i) => (
            <motion.div key={wd.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center shrink-0">
                    <ArrowUpFromLine size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm truncate">{wd.user?.name || '-'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[wd.status] || 'bg-white/5 text-white/40'}`}>
                        {statusLabels[wd.status] || wd.status}
                      </span>
                    </div>
                    <div className="text-white/30 text-xs">
                      {wd.user?.email || ''}
                      {wd.cryptoNetwork && <span className="mr-2 px-1.5 py-0.5 rounded bg-white/5 text-white/40 text-[10px]">{wd.cryptoNetwork}</span>}
                    </div>
                    {wd.walletAddress && (
                      <div className="text-white/20 text-[10px] font-mono truncate max-w-[250px]" dir="ltr">{wd.walletAddress}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#ef4444] font-bold text-sm" dir="ltr">{formatUSD(wd.amount)}</span>
                  {wd.status === 'PENDING' && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateTransactionStatus(wd.id, 'COMPLETED')} disabled={actionLoading === wd.id}
                        className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                        {actionLoading === wd.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      </button>
                      <button onClick={() => updateTransactionStatus(wd.id, 'REJECTED')} disabled={actionLoading === wd.id}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-white/30 text-sm">{isAr ? 'صفحة' : 'Page'} {pagination.page} {isAr ? 'من' : 'of'} {pagination.totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => loadWithdrawals(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
                <button onClick={() => loadWithdrawals(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}
                  className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <ArrowUpFromLine size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{isAr ? 'لا توجد سحوبات' : 'No withdrawals found'}</h3>
        </motion.div>
      )}
    </div>
  );
}

// ─── Admin KYC ────────────────────────────────────────────────────
function AdminKYC({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [kycUsers, setKycUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const loadKYC = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?kycStatus=PENDING&limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKycUsers(data.users || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [getAuthHeaders]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadKYC(); }, [loadKYC]);

  async function handleKYCAction(userId: string, action: 'approve' | 'reject', rejectCode?: string) {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          kycStatus: action === 'approve' ? 'VERIFIED' : 'REJECTED',
          ...(action === 'reject' && rejectCode ? { kycRejectCode: rejectCode } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم التحديث بنجاح' : 'Updated successfully' });
        loadKYC();
        setSelectedUser(null);
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setActionLoading(null);
    setTimeout(() => setToast(null), 4000);
  }

  const REJECT_REASONS = [
    { code: 'BLURRY', label: isAr ? 'صورة غير واضحة' : 'Blurry image' },
    { code: 'EXPIRED', label: isAr ? 'هوية منتهية' : 'Expired ID' },
    { code: 'MISMATCH', label: isAr ? 'عدم تطابق الاسم' : 'Name mismatch' },
    { code: 'INCOMPLETE', label: isAr ? 'مستند غير مكتمل' : 'Incomplete document' },
    { code: 'SELFIE_MISMATCH', label: isAr ? 'سيلفي غير متطابق' : 'Selfie mismatch' },
    { code: 'INVALID_DOC', label: isAr ? 'مستند غير صالح' : 'Invalid document' },
    { code: 'DUPLICATE', label: isAr ? 'مستند مكرر' : 'Duplicate document' },
  ];

  const docTypeLabels: Record<string, string> = {
    PASSPORT: isAr ? 'جواز سفر' : 'Passport',
    ID_CARD: isAr ? 'بطاقة هوية' : 'ID Card',
    DRIVER_LICENSE: isAr ? 'رخصة قيادة' : 'Driver License',
  };

  return (
    <div className="space-y-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldCheck size={22} className="text-[#409eff]" />
              {isAr ? 'التحقق من الهوية' : 'KYC Verification'}
            </h2>
            <p className="text-white/40 text-sm">{kycUsers.length} {isAr ? 'طلب معلق' : 'pending requests'}</p>
          </div>
          <button onClick={() => loadKYC()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[#409eff] text-sm font-medium hover:bg-[#409eff]/10 transition-all">
            <RefreshCw size={14} />{isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : kycUsers.length > 0 ? (
        <div className="space-y-3">
          {kycUsers.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{u.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{isAr ? 'معلق' : 'Pending'}</span>
                    </div>
                    <div className="text-white/30 text-xs">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {u.kycDocumentType && <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/40">{docTypeLabels[u.kycDocumentType] || u.kycDocumentType}</span>}
                      {u.kycIdNumber && <span className="text-[10px] text-white/30 font-mono" dir="ltr">#{u.kycIdNumber}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleKYCAction(u.id, 'approve')} disabled={actionLoading === u.id}
                    className="px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                    {actionLoading === u.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    {isAr ? 'قبول' : 'Approve'}
                  </button>
                  <div className="relative group">
                    <button className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                      <XCircle size={12} />{isAr ? 'رفض' : 'Reject'}
                    </button>
                    <div className="absolute top-full mt-1 end-0 z-20 hidden group-hover:block bg-[#1f2634] border border-white/10 rounded-xl p-2 min-w-[180px] shadow-xl">
                      {REJECT_REASONS.map((r) => (
                        <button key={r.code} onClick={() => handleKYCAction(u.id, 'reject', r.code)}
                          className="w-full text-right px-3 py-2 rounded-lg text-white/50 text-xs hover:bg-white/5 hover:text-red-400 transition-all">
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <ShieldCheck size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{isAr ? 'لا يوجد طلبات تحقق معلقة' : 'No pending KYC requests'}</h3>
        </motion.div>
      )}
    </div>
  );
}

// ─── Admin Packages ───────────────────────────────────────────────
function AdminPackages({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/packages', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [getAuthHeaders]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPackages(); }, [loadPackages]);

  async function seedDefaults() {
    setSeeding(true);
    try {
      const res = await fetch('/api/packages/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم إنشاء الباقات الافتراضية' : 'Default packages created' });
        loadPackages();
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setSeeding(false);
    setTimeout(() => setToast(null), 4000);
  }

  function startEditing(pkg: any) {
    setEditingId(pkg.id);
    setEditForm({
      name: pkg.name,
      nameEn: pkg.nameEn,
      monthlyReturn: pkg.monthlyReturn || pkg.dailyReturn,
      durationDays: pkg.durationDays,
      minAmount: pkg.minAmount,
      maxAmount: pkg.maxAmount,
    });
  }

  async function savePackage() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم حفظ التعديلات' : 'Changes saved' });
        setEditingId(null);
        loadPackages();
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="space-y-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Package size={22} className="text-[#409eff]" />
              {isAr ? 'باقات الاستثمار' : 'Investment Packages'}
            </h2>
            <p className="text-white/40 text-sm">{packages.length} {isAr ? 'باقة' : 'packages'}</p>
          </div>
          <button onClick={seedDefaults} disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#409eff]/10 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all disabled:opacity-50">
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {isAr ? 'إنشاء الباقات الافتراضية' : 'Seed Defaults'}
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : packages.length > 0 ? (
        <div className="space-y-3">
          {packages.map((pkg, i) => (
            <motion.div key={pkg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
              {editingId === pkg.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
                      <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
                      <input type="text" value={editForm.nameEn || ''} onChange={(e) => setEditForm(prev => ({ ...prev, nameEn: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-all" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'العائد اليومي %' : 'Daily Rate %'}</label>
                      <input type="number" step="0.01" value={editForm.monthlyReturn || ''} onChange={(e) => setEditForm(prev => ({ ...prev, monthlyReturn: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-all" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'المدة (أيام)' : 'Duration (days)'}</label>
                      <input type="number" value={editForm.durationDays || ''} onChange={(e) => setEditForm(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-all" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الحد الأدنى' : 'Min Amount'}</label>
                      <input type="number" step="0.01" value={editForm.minAmount || ''} onChange={(e) => setEditForm(prev => ({ ...prev, minAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-all" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الحد الأقصى' : 'Max Amount'}</label>
                      <input type="number" step="0.01" value={editForm.maxAmount || ''} onChange={(e) => setEditForm(prev => ({ ...prev, maxAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-all" dir="ltr" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={savePackage} disabled={saving}
                      className="px-4 py-2 rounded-xl bg-[#409eff]/10 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {isAr ? 'حفظ' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-xl bg-white/5 text-white/40 text-sm font-medium hover:bg-white/10 transition-all">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (pkg.color || '#409eff') + '15' }}>
                      <Package size={18} style={{ color: pkg.color || '#409eff' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{pkg.name}</span>
                        <span className="text-white/30 text-xs">({pkg.nameEn})</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[#22c55e] text-xs font-medium">{safeFixed(pkg.monthlyReturn || pkg.dailyReturn)}% {isAr ? 'يومياً' : 'daily'}</span>
                        <span className="text-white/30 text-xs">{pkg.durationDays} {isAr ? 'يوم' : 'days'}</span>
                        <span className="text-white/30 text-xs" dir="ltr">${safeFixed(pkg.minAmount)} - ${safeFixed(pkg.maxAmount)}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => startEditing(pkg)}
                    className="p-2 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/10 transition-all shrink-0">
                    <Edit3 size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <Package size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{isAr ? 'لا توجد باقات' : 'No packages found'}</h3>
          <p className="text-white/30 text-sm mb-4">{isAr ? 'أنشئ الباقات الافتراضية للبدء' : 'Create default packages to get started'}</p>
          <button onClick={seedDefaults} className="px-6 py-2.5 rounded-xl bg-[#409eff]/10 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all">
            {isAr ? 'إنشاء الباقات الافتراضية' : 'Seed Defaults'}
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Admin Notifications ──────────────────────────────────────────
function AdminNotifications({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('PLATFORM');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function sendNotification() {
    if (!title.trim() || !message.trim()) {
      setToast({ type: 'error', message: isAr ? 'يرجى إدخال العنوان والرسالة' : 'Please enter title and message' });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ broadcast: true, type, title: title.trim(), message: message.trim(), target }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم إرسال الإشعار بنجاح' : 'Notification sent successfully' });
        setTitle('');
        setMessage('');
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setSending(false);
    setTimeout(() => setToast(null), 4000);
  }

  const typeOptions = [
    { value: 'PLATFORM', label: isAr ? 'المنصة' : 'Platform', color: '#06b6d4' },
    { value: 'IMPORTANT', label: isAr ? 'مهم' : 'Important', color: '#ef4444' },
    { value: 'NEWS', label: isAr ? 'أخبار' : 'News', color: '#8b5cf6' },
    { value: 'PROFIT', label: isAr ? 'أرباح' : 'Profit', color: '#22c55e' },
    { value: 'MAINTENANCE', label: isAr ? 'صيانة' : 'Maintenance', color: '#6b7280' },
    { value: 'SECURITY', label: isAr ? 'أمان' : 'Security', color: '#f59e0b' },
  ];

  const targetOptions = [
    { value: 'all', label: isAr ? 'الجميع' : 'All', color: '#409eff' },
    { value: 'active', label: isAr ? 'النشطين' : 'Active', color: '#22c55e' },
    { value: 'inactive', label: isAr ? 'غير النشطين' : 'Inactive', color: '#ef4444' },
    { value: 'verified', label: isAr ? 'الموثقين' : 'Verified', color: '#06b6d4' },
    { value: 'unverified', label: isAr ? 'غير الموثقين' : 'Unverified', color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell size={22} className="text-[#409eff]" />
          {isAr ? 'إرسال إشعارات' : 'Send Notifications'}
        </h2>
        <p className="text-white/40 text-sm">{isAr ? 'إرسال إشعارات للمستخدمين' : 'Send notifications to users'}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5 space-y-5">
        {/* Target */}
        <div>
          <label className="text-white/40 text-xs block mb-2">{isAr ? 'إرسال إلى' : 'Send to'}</label>
          <div className="flex flex-wrap gap-2">
            {targetOptions.map((opt) => (
              <button key={opt.value} onClick={() => setTarget(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${target === opt.value ? 'border-opacity-30 bg-opacity-10' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'}`}
                style={target === opt.value ? { borderColor: opt.color + '40', backgroundColor: opt.color + '10', color: opt.color } : {}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="text-white/40 text-xs block mb-2">{isAr ? 'نوع الإشعار' : 'Notification type'}</label>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((opt) => (
              <button key={opt.value} onClick={() => setType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${type === opt.value ? 'border-opacity-30 bg-opacity-10' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'}`}
                style={type === opt.value ? { borderColor: opt.color + '40', backgroundColor: opt.color + '10', color: opt.color } : {}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'عنوان الإشعار' : 'Notification title'}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={isAr ? 'أدخل عنوان الإشعار...' : 'Enter notification title...'}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:border-[#409eff]/30 focus:outline-none transition-all text-sm" />
        </div>

        {/* Message */}
        <div>
          <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'محتوى الإشعار' : 'Notification body'}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={isAr ? 'أدخل محتوى الإشعار...' : 'Enter notification body...'} rows={4}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:border-[#409eff]/30 focus:outline-none transition-all text-sm resize-none" />
        </div>

        {/* Send Button */}
        <button onClick={sendNotification} disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-sm hover:shadow-lg hover:shadow-[#409eff]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
          {isAr ? 'إرسال الإشعار' : 'Send Notification'}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Admin Export ─────────────────────────────────────────────────
function AdminExport({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function exportData(type: string) {
    setExporting(type);
    try {
      const res = await fetch(`/api/admin/export?type=${type}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setToast({ type: 'success', message: isAr ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setExporting(null);
    setTimeout(() => setToast(null), 4000);
  }

  const exportOptions = [
    { type: 'users', label: isAr ? 'المستخدمين' : 'Users', icon: Users, color: '#409eff', desc: isAr ? 'بيانات جميع المستخدمين' : 'All user data' },
    { type: 'transactions', label: isAr ? 'المعاملات' : 'Transactions', icon: ArrowDownToLine, color: '#22c55e', desc: isAr ? 'سجل جميع المعاملات' : 'All transaction records' },
    { type: 'investments', label: isAr ? 'الاستثمارات' : 'Investments', icon: Briefcase, color: '#f59e0b', desc: isAr ? 'بيانات الاستثمارات' : 'Investment data' },
    { type: 'kyc', label: 'KYC', icon: ShieldCheck, color: '#8b5cf6', desc: isAr ? 'بيانات التحقق' : 'KYC verification data' },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Download size={22} className="text-[#409eff]" />
          {isAr ? 'تصدير البيانات' : 'Export Data'}
        </h2>
        <p className="text-white/40 text-sm">{isAr ? 'تصدير بيانات المنصة بصيغة CSV' : 'Export platform data as CSV'}</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {exportOptions.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.div key={opt.type} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: opt.color + '15', color: opt.color }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">{opt.label}</h3>
                  <p className="text-white/30 text-xs">{opt.desc}</p>
                </div>
              </div>
              <button onClick={() => exportData(opt.type)} disabled={exporting === opt.type}
                className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {exporting === opt.type ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {isAr ? 'تصدير CSV' : 'Export CSV'}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin Blacklist Panel ─────────────────────────────────────────
type BlacklistType = 'USER' | 'IP' | 'EMAIL';
type BlacklistFilter = 'ALL' | BlacklistType;

interface BlacklistEntry {
  id: string;
  type: BlacklistType;
  targetValue: string;
  value: string; // alias - some API responses use value
  reason: string;
  permanent: boolean;
  isPermanent: boolean; // alias
  createdAt: string;
  expiresAt?: string | null;
}

interface IpLookupResult {
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
  isVpn?: boolean;
  isProxy?: boolean;
}

function AdminBlacklistPanel({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<BlacklistFilter>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState<{ targetType: BlacklistType; targetValue: string; reason: string; isPermanent: boolean }>({
    targetType: 'IP',
    targetValue: '',
    reason: '',
    isPermanent: true,
  });
  const [adding, setAdding] = useState(false);

  // IP Lookup state
  const [ipLookupInput, setIpLookupInput] = useState('');
  const [ipLookupLoading, setIpLookupLoading] = useState(false);
  const [ipLookupResult, setIpLookupResult] = useState<IpLookupResult | null>(null);

  const loadBlacklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/blacklist', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [getAuthHeaders]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBlacklist(); }, [loadBlacklist]);

  async function addEntry() {
    if (!addForm.targetValue.trim() || !addForm.reason.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/security/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تمت الإضافة بنجاح' : 'Entry added successfully' });
        setShowAddDialog(false);
        setAddForm({ targetType: 'IP', targetValue: '', reason: '', isPermanent: true });
        loadBlacklist();
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setAdding(false);
    setTimeout(() => setToast(null), 4000);
  }

  async function deleteEntry(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/security/blacklist?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم الحذف بنجاح' : 'Entry removed successfully' });
        loadBlacklist();
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setActionLoading(null);
    setTimeout(() => setToast(null), 4000);
  }

  async function lookupIp() {
    if (!ipLookupInput.trim()) return;
    setIpLookupLoading(true);
    setIpLookupResult(null);
    try {
      const res = await fetch(`/api/admin/ip-lookup?ip=${encodeURIComponent(ipLookupInput.trim())}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIpLookupResult(data);
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || (isAr ? 'فشل البحث' : 'Lookup failed') });
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' });
    }
    setIpLookupLoading(false);
    setTimeout(() => setToast(null), 4000);
  }

  const filteredEntries = typeFilter === 'ALL' ? entries : entries.filter((e) => (e.type || (e as any).targetType) === typeFilter);

  const typeLabels: Record<string, string> = {
    USER: isAr ? 'مستخدم' : 'User',
    IP: isAr ? 'عنوان IP' : 'IP Address',
    EMAIL: isAr ? 'بريد إلكتروني' : 'Email',
  };

  const typeColors: Record<string, string> = {
    USER: 'bg-purple-500/10 text-purple-400',
    IP: 'bg-orange-500/10 text-orange-400',
    EMAIL: 'bg-cyan-500/10 text-cyan-400',
  };

  const typeIcons: Record<string, React.ElementType> = {
    USER: Users,
    IP: Globe,
    EMAIL: ShieldX,
  };

  const filterOptions: { key: BlacklistFilter; label: string }[] = [
    { key: 'ALL', label: isAr ? 'الكل' : 'All' },
    { key: 'USER', label: isAr ? 'مستخدم' : 'User' },
    { key: 'IP', label: isAr ? 'IP' : 'IP' },
    { key: 'EMAIL', label: isAr ? 'بريد إلكتروني' : 'Email' },
  ];

  return (
    <div className="space-y-6">
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
              <ShieldX size={22} className="text-[#409eff]" />
              {isAr ? 'القائمة السوداء' : 'Blacklist Management'}
            </h2>
            <p className="text-white/40 text-sm">{entries.length} {isAr ? 'إدخال' : 'entries'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadBlacklist()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[#409eff] text-sm font-medium hover:bg-[#409eff]/10 transition-all">
              <RefreshCw size={14} />{isAr ? 'تحديث' : 'Refresh'}
            </button>
            <button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#409eff]/10 border border-[#409eff]/20 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all">
              <Plus size={14} />{isAr ? 'إضافة' : 'Add Entry'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filter */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-white/30 shrink-0" />
        {filterOptions.map((opt) => (
          <button key={opt.key} onClick={() => setTypeFilter(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${typeFilter === opt.key ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            {opt.label}
          </button>
        ))}
      </motion.div>

      {/* IP Lookup */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5">
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
          <Globe size={16} className="text-[#409eff]" />
          {isAr ? 'البحث عن IP' : 'IP Lookup'}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ipLookupInput}
            onChange={(e) => setIpLookupInput(e.target.value)}
            placeholder={isAr ? 'أدخل عنوان IP...' : 'Enter IP address...'}
            dir="ltr"
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#409eff]/30 focus:ring-1 focus:ring-[#409eff]/20 transition-all"
            onKeyDown={(e) => { if (e.key === 'Enter') lookupIp(); }}
          />
          <button onClick={lookupIp} disabled={ipLookupLoading}
            className="px-5 py-2.5 rounded-xl bg-[#409eff]/10 border border-[#409eff]/20 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0">
            {ipLookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {isAr ? 'بحث' : 'Check'}
          </button>
        </div>
        {ipLookupResult && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-orange-400" />
              <span className="text-white font-mono text-sm" dir="ltr">{ipLookupResult.ip}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-white/30 text-[10px] uppercase tracking-wider">{isAr ? 'الدولة' : 'Country'}</span>
                <p className="text-white text-sm font-medium mt-0.5 flex items-center gap-1">
                  <MapPin size={12} className="text-white/30" />
                  {ipLookupResult.country || (isAr ? 'غير معروف' : 'Unknown')}
                </p>
              </div>
              <div>
                <span className="text-white/30 text-[10px] uppercase tracking-wider">{isAr ? 'المدينة' : 'City'}</span>
                <p className="text-white text-sm font-medium mt-0.5">
                  {ipLookupResult.city || (isAr ? 'غير معروفة' : 'Unknown')}
                </p>
              </div>
              <div>
                <span className="text-white/30 text-[10px] uppercase tracking-wider">{isAr ? 'مزود الخدمة' : 'ISP'}</span>
                <p className="text-white text-sm font-medium mt-0.5">
                  {ipLookupResult.isp || (isAr ? 'غير معروف' : 'Unknown')}
                </p>
              </div>
              <div>
                <span className="text-white/30 text-[10px] uppercase tracking-wider">VPN / Proxy</span>
                <p className={`text-sm font-medium mt-0.5 flex items-center gap-1 ${(ipLookupResult.isVpn || ipLookupResult.isProxy) ? 'text-red-400' : 'text-green-400'}`}>
                  {(ipLookupResult.isVpn || ipLookupResult.isProxy)
                    ? (<> <ShieldAlert size={12} /> {isAr ? 'نعم - مشبوه' : 'Yes - Suspicious'} </>)
                    : (<> <CheckCircle size={12} /> {isAr ? 'لا - آمن' : 'No - Clean'} </>)
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Add Dialog */}
      {showAddDialog && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-[#409eff]/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Plus size={16} className="text-[#409eff]" />
              {isAr ? 'إضافة إدخال جديد' : 'Add New Entry'}
            </h3>
            <button onClick={() => setShowAddDialog(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-white/40 text-xs mb-1.5 block">{isAr ? 'النوع' : 'Type'}</label>
              <div className="flex items-center gap-2">
                {(['IP', 'USER', 'EMAIL'] as BlacklistType[]).map((t) => (
                  <button key={t} onClick={() => setAddForm((f) => ({ ...f, targetType: t }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${addForm.targetType === t ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1.5 block">{isAr ? 'القيمة' : 'Value'}</label>
              <input
                type="text"
                value={addForm.targetValue}
                onChange={(e) => setAddForm((f) => ({ ...f, targetValue: e.target.value }))}
                placeholder={addForm.targetType === 'IP' ? '192.168.1.1' : addForm.targetType === 'EMAIL' ? 'user@example.com' : isAr ? 'معرف المستخدم' : 'User ID'}
                dir="ltr"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#409eff]/30 focus:ring-1 focus:ring-[#409eff]/20 transition-all"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1.5 block">{isAr ? 'السبب' : 'Reason'}</label>
              <input
                type="text"
                value={addForm.reason}
                onChange={(e) => setAddForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={isAr ? 'أدخل سبب الحظر...' : 'Enter reason for blacklisting...'}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#409eff]/30 focus:ring-1 focus:ring-[#409eff]/20 transition-all"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-white/40 text-xs">{isAr ? 'حظر دائم' : 'Permanent ban'}</label>
              <button
                type="button"
                onClick={() => setAddForm((f) => ({ ...f, isPermanent: !f.isPermanent }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${addForm.isPermanent ? 'bg-[#409eff]' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 ${addForm.isPermanent ? 'start-[22px]' : 'start-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all`} />
              </button>
            </div>
            <button onClick={addEntry} disabled={adding || !addForm.targetValue.trim() || !addForm.reason.trim()}
              className="w-full py-2.5 rounded-xl bg-[#409eff]/10 border border-[#409eff]/20 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isAr ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}
            </button>
          </div>
        </motion.div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : filteredEntries.length > 0 ? (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          {filteredEntries.map((entry, i) => {
            const entryType = entry.type || (entry as any).targetType || 'IP';
            const TypeIcon = typeIcons[entryType] || ShieldX;
            return (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[entryType] || 'bg-white/5 text-white/40'}`}>
                      <TypeIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm truncate" dir="ltr">{entry.targetValue || entry.value}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[entryType] || 'bg-white/5 text-white/40'}`}>
                          {typeLabels[entryType] || entryType}
                        </span>
                        {(entry.isPermanent || entry.permanent) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                            {isAr ? 'دائم' : 'Permanent'}
                          </span>
                        )}
                      </div>
                      <div className="text-white/30 text-xs mt-0.5">{entry.reason}</div>
                      <div className="text-white/20 text-[10px] mt-0.5">{formatDateAr(entry.createdAt)}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteEntry(entry.id)} disabled={actionLoading === entry.id}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 shrink-0"
                    title={isAr ? 'حذف' : 'Delete'}>
                    {actionLoading === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <ShieldX size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{isAr ? 'لا توجد إدخالات' : 'No blacklist entries found'}</h3>
          <p className="text-white/30 text-sm">{isAr ? 'القائمة السوداء فارغة حالياً' : 'The blacklist is currently empty'}</p>
        </motion.div>
      )}
    </div>
  );
}
