'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Briefcase,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  UserCircle,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Bell,
  Users,
  Headphones,
  Settings,
  Shield,
  Search,
  BarChart3,
  FileText,
  ChevronLeft,
  Zap,
  ShieldCheck,
  Wallet,
  Info,
  Scale,
  TrendingUp,
  ArrowDownToLine as DepositIcon,
  ArrowUpFromLine as WithdrawIcon,
  Gift,
  Newspaper,
  Megaphone,
  Wrench,
  AlertCircle,
  CheckCheck,
  Trash2,
  Clock,
  Globe,
  ArrowLeftRight,
} from 'lucide-react';
import { useAppStore, type PageName } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';
import DashboardHome from './DashboardHome';
import PackagesPage from './PackagesPage';
import MyInvestments from './MyInvestments';
import DepositPage from './DepositPage';
import WithdrawPage from './WithdrawPage';
import TransactionsPage from './TransactionsPage';
import ProfilePage from './ProfilePage';
import ReferralPage from './ReferralPage';
import SignalsPage from './SignalsPage';
import VerificationPage from './VerificationPage';
import NotificationsPage from './NotificationsPage';
import AboutPage from './AboutPage';
import WalletPage from './WalletPage';
import TermsPage from './TermsPage';
import PrivacyPage from './PrivacyPage';
import { SupportPage } from './SupportPage';
import AdminPanel from './AdminPanel';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminTransactions from './AdminTransactions';
import AdminInvestments from './AdminInvestments';
import AdminSupport from './AdminSupport';
import AdminSettings from './AdminSettings';
import AdminActivityLog from './AdminActivityLog';
import AdminEngineerAgent from './AdminEngineerAgent';
import AdminAdvancedPanel from './AdminAdvancedPanel';
import TradingPage from './TradingPage';
import P2PTransferPage from './P2PTransferPage';



// Navigation labels and page titles are now dynamic via useI18n()
// Static arrays removed - labels are computed in the component

const notificationTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  PROFIT: { icon: TrendingUp, color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)' },
  DEPOSIT: { icon: DepositIcon, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)' },
  WITHDRAWAL: { icon: WithdrawIcon, color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)' },
  SIGNAL: { icon: Zap, color: '#409eff', bgColor: 'rgba(201,168,76,0.08)' },
  NEWS: { icon: Newspaper, color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.08)' },
  PLATFORM: { icon: Megaphone, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.08)' },
  MAINTENANCE: { icon: Wrench, color: '#6b7280', bgColor: 'rgba(107,114,128,0.08)' },
  IMPORTANT: { icon: AlertCircle, color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)' },
  REFERRAL: { icon: Gift, color: '#409eff', bgColor: 'rgba(64,158,255,0.08)' },
  SECURITY: { icon: Shield, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)' },
  SYSTEM: { icon: Info, color: '#6b7280', bgColor: 'rgba(107,114,128,0.08)' },
};

function formatTimeAgo(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return t('common.now');
  if (minutes < 60) return t('common.minutesAgo', { count: minutes });
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  return t('common.daysAgo', { count: Math.floor(diff / 86400000) });
}

export default function Dashboard() {
  const { user, dashboardPage, setDashboardPage, logout, refreshUser } = useAppStore();
  const { t, lang, toggleLang, isRTL, dir } = useI18n();

  // Dynamic nav items with i18n
  const navItems: { id: PageName; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'trading', label: t('nav.trade'), icon: TrendingUp },
    { id: 'p2p', label: t('nav.p2p'), icon: ArrowLeftRight },
    { id: 'wallet', label: t('nav.wallet'), icon: Wallet },
    { id: 'packages', label: t('nav.packages'), icon: Package },
    { id: 'investments', label: t('nav.investments'), icon: Briefcase },
    { id: 'deposit', label: t('nav.deposit'), icon: ArrowDownToLine },
    { id: 'withdraw', label: t('nav.withdraw'), icon: ArrowUpFromLine },
    { id: 'signals', label: t('nav.signals'), icon: Zap },
    { id: 'verification', label: t('nav.verification'), icon: ShieldCheck },
    { id: 'referral', label: t('nav.referral'), icon: Users, badge: '15%' },
    { id: 'notifications', label: t('nav.notifications'), icon: Bell },
    { id: 'support', label: t('nav.support'), icon: Headphones },
    { id: 'transactions', label: t('nav.transactions'), icon: Receipt },
    { id: 'about', label: t('nav.about'), icon: Info },
    { id: 'profile', label: t('nav.profile'), icon: UserCircle },
  ];

  const footerNavItems: { id: PageName; label: string; icon: React.ElementType }[] = [
    { id: 'terms', label: t('nav.terms'), icon: Scale },
    { id: 'privacy', label: t('nav.privacy'), icon: Shield },
  ];

  const adminNavItems: { id: PageName; label: string; icon: React.ElementType }[] = [
    { id: 'admin', label: t('nav.admin'), icon: Shield },
  ];

  const pageTitles: Record<PageName, string> = {
    landing: t('nav.dashboard'),
    login: t('auth.login'),
    register: t('auth.register'),
    dashboard: t('nav.dashboard'),
    wallet: t('nav.wallet'),
    packages: t('nav.packages'),
    deposit: t('nav.deposit'),
    withdraw: t('nav.withdraw'),
    investments: t('nav.investments'),
    transactions: t('nav.transactions'),
    profile: t('nav.profile'),
    referral: t('nav.referral'),
    signals: t('nav.signals'),
    verification: t('nav.verification'),
    notifications: t('nav.notifications'),
    about: t('nav.about'),
    support: t('nav.support'),
    trading: t('nav.trade'),
    p2p: t('nav.p2p'),
    terms: t('nav.terms'),
    privacy: t('nav.privacy'),
    admin: t('nav.admin'),
    admin_dashboard: t('nav.admin'),
    admin_users: t('nav.adminUsers'),
    admin_transactions: t('nav.adminTransactions'),
    admin_investments: t('nav.adminInvestments'),
    admin_support: t('nav.adminSupport'),
    admin_settings: t('nav.adminSettings'),
    admin_activity_log: t('nav.adminActivityLog'),
    admin_advanced: 'لوحة التحكم المتقدمة',
    admin_engineer: t('nav.adminEngineer'),
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  useEffect(() => {
    refreshUser();
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
          setRecentNotifications((data.notifications || []).slice(0, 5));
        }
      } catch { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/profits/calculate', { method: 'POST' });
      await refreshUser();
    } catch {
      // ignore
    }
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleNav = (page: PageName) => {
    setDashboardPage(page);
    setSidebarOpen(false);
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setRecentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch { /* ignore */ }
  };

  const renderContent = () => {
    switch (dashboardPage) {
      case 'dashboard': return <DashboardHome />;
      case 'wallet': return <WalletPage />;
      case 'packages': return <PackagesPage />;
      case 'investments': return <MyInvestments />;
      case 'deposit': return <DepositPage />;
      case 'withdraw': return <WithdrawPage />;
      case 'signals': return <SignalsPage />;
      case 'verification': return <VerificationPage />;
      case 'referral': return <ReferralPage />;
      case 'notifications': return <NotificationsPage />;
      case 'transactions': return <TransactionsPage />;
      case 'about': return <AboutPage />;
      case 'support': return <SupportPage />;
      case 'trading': return <TradingPage user={user} lang={lang} onNavigate={(p) => setDashboardPage(p as any)} />;
      case 'p2p': return <P2PTransferPage />;
      case 'terms': return <TermsPage />;
      case 'privacy': return <PrivacyPage />;
      case 'profile': return <ProfilePage />;
      case 'admin': return isAdmin ? <AdminPanel navigate={(page) => setDashboardPage(page as PageName)} isAr={lang === 'ar'} /> : <DashboardHome />;
      case 'admin_dashboard': return isAdmin ? <AdminDashboard /> : <DashboardHome />;
      case 'admin_users': return isAdmin ? <AdminUsers /> : <DashboardHome />;
      case 'admin_transactions': return isAdmin ? <AdminTransactions /> : <DashboardHome />;
      case 'admin_investments': return isAdmin ? <AdminInvestments /> : <DashboardHome />;
      case 'admin_support': return isAdmin ? <AdminSupport isAr={lang === 'ar'} getAuthHeaders={() => { const token = useAppStore.getState().getToken(); return token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {} as Record<string, string>; }} /> : <DashboardHome />;
      case 'admin_settings': return isAdmin ? <AdminSettings /> : <DashboardHome />;
      case 'admin_activity_log': return isAdmin ? <AdminActivityLog isAr={lang === 'ar'} getAuthHeaders={() => { const token = useAppStore.getState().getToken(); return token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {} as Record<string, string>; }} /> : <DashboardHome />;
      case 'admin_advanced': return isAdmin ? <AdminAdvancedPanel isAr={lang === 'ar'} getAuthHeaders={() => { const token = useAppStore.getState().getToken(); return token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {} as Record<string, string>; }} /> : <DashboardHome />;
      case 'admin_engineer': return isAdmin ? <AdminEngineerAgent isAr={lang === 'ar'} getAuthHeaders={() => { const token = useAppStore.getState().getToken(); return token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {} as Record<string, string>; }} /> : <DashboardHome />;
      default: return <DashboardHome />;
    }
  };

  const NavItem = ({ item, isActive }: { item: { id: PageName; label: string; icon: React.ElementType; badge?: string }; isActive: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={() => handleNav(item.id)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 relative group ${
          isActive
            ? 'text-[#409eff] bg-[#409eff]/5'
            : 'text-white/40 hover:text-white/80 hover:bg-white/[0.03]'
        } ${collapsed ? 'justify-center px-2' : ''}`}
      >
        {isActive && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#409eff] rounded-l-full" />
        )}
        <Icon size={20} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-right">{item.label}</span>
            {item.badge && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#409eff]/15 text-[#409eff] font-bold">
                {item.badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  // When on admin page, render AdminPanel standalone (it has its own sidebar)
  if (dashboardPage === 'admin' && isAdmin) {
    return (
      <div className="min-h-screen bg-[#030708]" dir={dir}>
        <AdminPanel navigate={(page) => setDashboardPage(page as PageName)} isAr={lang === 'ar'} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030708] flex" dir={dir}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 bg-[#030708] border-l border-white/[0.06] flex flex-col transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}
      >
        {/* Logo area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06] shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <img src="/sona-icon.png" alt="SONA" className="w-8 h-8 rounded-lg object-contain" style={{filter:"drop-shadow(0 2px 8px rgba(64,158,255,0.3))"}} />
              <span className="gold-shimmer text-lg font-bold">{t('nav.dashboard') === 'Dashboard' ? 'SONA' : 'سونا'}</span>
            </div>
          )}
          {collapsed && (
            <img src="/sona-icon.png" alt="SONA" className="w-8 h-8 rounded-lg object-contain mx-auto" style={{filter:"drop-shadow(0 2px 8px rgba(64,158,255,0.3))"}} />
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/40 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.id} item={item} isActive={dashboardPage === item.id} />
          ))}

          {/* Footer links */}
          <div className="my-3 mx-2 h-px bg-white/[0.06]" />
          {footerNavItems.map((item) => (
            <NavItem key={item.id} item={item} isActive={dashboardPage === item.id} />
          ))}

          {/* Admin Section */}
          {isAdmin && (
            <>
              <div className="my-3 mx-2 h-px bg-white/[0.06]" />
              {!collapsed && (
                <div className="flex items-center gap-2 px-4 py-2 mb-1">
                  <Shield size={12} className="text-[#409eff]/60" />
                  <span className="text-[#409eff]/60 text-[11px] font-semibold tracking-wider">
                    {t('nav.adminSection')}
                  </span>
                </div>
              )}
              {collapsed && (
                <div className="flex justify-center py-2">
                  <div className="w-6 h-px bg-white/[0.06]" />
                </div>
              )}
              {adminNavItems.map((item) => (
                <NavItem key={item.id} item={item} isActive={dashboardPage === item.id} />
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-white/[0.06] p-3 shrink-0">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 px-2 py-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#409eff] to-[#1e6fbb] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                  {(user as any)?.avatar ? (
                    <img src={(user as any).avatar} alt={user?.name} className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.charAt(0) || (isRTL ? 'م' : 'U')
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-sm font-medium truncate">{user?.name}</div>
                  <div className="text-white/25 text-xs truncate" dir="ltr">{user?.email}</div>
                </div>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#409eff]/15 text-[#409eff] font-bold shrink-0">
                    {t('dashboard.admin')}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/5 text-sm font-medium transition-all"
              >
                <LogOut size={18} />
                <span>{t('nav.logout')}</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#409eff] to-[#1e6fbb] flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0) || (isRTL ? 'م' : 'U')}
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all"
                title={t('nav.logout')}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 bg-[#030708]/90 backdrop-blur-xl sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-white/40 hover:text-white transition-colors"
            >
              <Menu size={22} />
            </button>
            <div>
              <h1 className="text-white font-semibold text-base">
                {pageTitles[dashboardPage] || t('dashboard.controlPanel')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Balance Badge */}
            {dashboardPage !== 'admin' && !dashboardPage.startsWith('admin_') && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#409eff]/[0.07] border border-[#409eff]/10">
                <span className="text-white/30 text-xs">{t('common.balance')}</span>
                <span className="text-[#409eff] font-bold text-sm">${safeFixed(user?.balance)}</span>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/5 transition-all"
              title={t('nav.refreshProfits')}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {/* Notifications Bell with dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="p-2 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/5 transition-all relative"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              <AnimatePresence>
                {showNotifPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-[#1f2634] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
                  >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-[#409eff]" />
                        <span className="text-white font-semibold text-sm">{t('nav.notifications')}</span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">{unreadCount}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="p-1.5 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/5 transition-all"
                            title={t('dashboard.readAll')}
                          >
                            <CheckCheck size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => { handleNav('notifications'); setShowNotifPanel(false); }}
                          className="text-[#409eff] text-[11px] hover:underline"
                        >
                          {t('dashboard.viewAll')}
                        </button>
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto">
                      {recentNotifications.length > 0 ? (
                        recentNotifications.map((notif) => {
                          const config = notificationTypeConfig[notif.type] || notificationTypeConfig.PLATFORM;
                          const Icon = config.icon;
                          return (
                            <div
                              key={notif.id}
                              className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer ${
                                !notif.isRead ? 'bg-[#409eff]/[0.02]' : ''
                              }`}
                              onClick={() => { handleNav('notifications'); setShowNotifPanel(false); }}
                            >
                              <div className="p-1.5 rounded-lg shrink-0 mt-0.5" style={{ backgroundColor: config.bgColor }}>
                                <Icon size={12} style={{ color: config.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-medium truncate ${notif.isRead ? 'text-white/50' : 'text-white'}`}>
                                    {notif.title}
                                  </span>
                                  {!notif.isRead && <div className="w-1.5 h-1.5 rounded-full bg-[#409eff] shrink-0" />}
                                </div>
                                <p className="text-white/25 text-[10px] leading-relaxed mt-0.5 line-clamp-2">{notif.message}</p>
                                <span className="text-white/15 text-[9px] mt-1 flex items-center gap-1">
                                  <Clock size={8} />
                                  {formatTimeAgo(notif.createdAt, t)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center">
                          <Bell size={24} className="text-white/8 mx-auto mb-2" />
                          <p className="text-white/20 text-xs">{t('dashboard.noNotifications')}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Collapse toggle - desktop only */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all"
              title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            >
              <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              className="p-2 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/5 transition-all flex items-center gap-1.5"
              title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
              <Globe size={16} />
              <span className="text-[10px] font-bold">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#409eff] to-[#1e6fbb] flex items-center justify-center text-white font-bold text-xs overflow-hidden">
              {(user as any)?.avatar ? (
                <img src={(user as any).avatar} alt={user?.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) || (isRTL ? 'م' : 'U')
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

    </div>
  );
}
