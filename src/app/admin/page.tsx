'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { useI18n } from '@/hooks/useI18n'
import AdminDashboard from '@/components/platform/AdminDashboard'
import AdminUsers from '@/components/platform/AdminUsers'
import AdminTransactions from '@/components/platform/AdminTransactions'
import AdminInvestments from '@/components/platform/AdminInvestments'
import AdminSupport from '@/components/platform/AdminSupport'
import AdminSettings from '@/components/platform/AdminSettings'
import AdminActivityLog from '@/components/platform/AdminActivityLog'
import AdminEngineerAgent from '@/components/platform/AdminEngineerAgent'
import AdminAdvancedPanel from '@/components/platform/AdminAdvancedPanel'
import AdminSecurityFortress from '@/components/platform/AdminSecurityFortress'
import {
  LayoutDashboard, Users, ArrowDownToLine, ArrowUpFromLine, Briefcase,
  ShieldCheck, Menu, X, CheckCircle, XCircle,
  RefreshCw, Loader2, Activity, ChevronRight, LogOut,
  Clock, Zap, UserCheck, Send, DollarSign, BarChart3, Globe, Filter,
  ArrowDownCircle, ArrowUpCircle, FileCheck, Box, Cog,
  DownloadCloud, ClipboardList, Bot, ShieldAlert, LifeBuoy,
  Shield, ShieldX,
} from 'lucide-react'

// ─── Tab definitions ──────────────────────────────────────────────
type TabId = 'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'transactions' | 'investments' | 'kyc' | 'packages' | 'settings' | 'notifications' | 'export' | 'activity' | 'engineer' | 'engine' | 'blacklist' | 'advanced' | 'security' | 'support'

interface SidebarTab {
  id: TabId
  labelAr: string
  labelEn: string
  icon: React.ElementType
  badge?: string
}

const MAIN_TABS: SidebarTab[] = [
  { id: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', labelAr: 'المستخدمين', labelEn: 'Users', icon: Users },
  { id: 'deposits', labelAr: 'الإيداعات', labelEn: 'Deposits', icon: ArrowDownCircle },
  { id: 'withdrawals', labelAr: 'السحوبات', labelEn: 'Withdrawals', icon: ArrowUpCircle },
  { id: 'transactions', labelAr: 'المعاملات', labelEn: 'Transactions', icon: FileCheck },
  { id: 'investments', labelAr: 'الاستثمارات', labelEn: 'Investments', icon: Briefcase },
  { id: 'kyc', labelAr: 'التحقق KYC', labelEn: 'KYC', icon: UserCheck },
  { id: 'packages', labelAr: 'الباقات', labelEn: 'Packages', icon: Box },
]

const SYSTEM_TABS: SidebarTab[] = [
  { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Cog },
  { id: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: Send },
  { id: 'export', labelAr: 'التصدير', labelEn: 'Export', icon: DownloadCloud },
  { id: 'activity', labelAr: 'سجل النشاط', labelEn: 'Activity Log', icon: ClipboardList },
  { id: 'engineer', labelAr: 'وكيل المهندس', labelEn: 'Engineer Agent', icon: Bot },
  { id: 'advanced', labelAr: 'لوحة متقدمة', labelEn: 'Advanced', icon: ShieldAlert },
  { id: 'security', labelAr: 'قلعة الأمن', labelEn: 'Security Fortress', icon: ShieldX },
  { id: 'blacklist', labelAr: 'القائمة السوداء', labelEn: 'Blacklist', icon: Shield },
  { id: 'engine', labelAr: 'محرك السوق', labelEn: 'Engine Controls', icon: Zap },
  { id: 'support', labelAr: 'الدعم الفني', labelEn: 'Support', icon: LifeBuoy },
]

// ─── Helpers ──────────────────────────────────────────────────────
function formatUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateAr(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTimeShort(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Status Badge Component ───────────────────────────────────────
function StatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const config: Record<string, { bg: string; text: string; label: string; labelEn: string; dot: string }> = {
    PENDING: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', dot: '#F59E0B', label: 'معلق', labelEn: 'Pending' },
    COMPLETED: { bg: 'rgba(14,203,129,0.12)', text: '#0ECB81', dot: '#0ECB81', label: 'مكتمل', labelEn: 'Completed' },
    APPROVED: { bg: 'rgba(14,203,129,0.12)', text: '#0ECB81', dot: '#0ECB81', label: 'مقبول', labelEn: 'Approved' },
    REJECTED: { bg: 'rgba(246,70,93,0.12)', text: '#F6465D', dot: '#F6465D', label: 'مرفوض', labelEn: 'Rejected' },
    PROCESSING: { bg: 'rgba(37,99,235,0.12)', text: '#2563EB', dot: '#2563EB', label: 'قيد المعالجة', labelEn: 'Processing' },
    FAILED: { bg: 'rgba(246,70,93,0.12)', text: '#F6465D', dot: '#F6465D', label: 'فاشل', labelEn: 'Failed' },
    ACTIVE: { bg: 'rgba(14,203,129,0.12)', text: '#0ECB81', dot: '#0ECB81', label: 'نشط', labelEn: 'Active' },
    COMPLETED_INVESTMENT: { bg: 'rgba(37,99,235,0.12)', text: '#2563EB', dot: '#2563EB', label: 'مكتمل', labelEn: 'Completed' },
  }
  const c = config[status] || { bg: 'rgba(255,255,255,0.06)', text: '#848E9C', dot: '#848E9C', label: status, labelEn: status }
  return (
    <span
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap tracking-wide"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
      {isAr ? c.label : c.labelEn}
    </span>
  )
}

// ─── Section Header Component ─────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, actions }: { icon: React.ElementType; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F0B90B 0%, #D4A200 100%)', boxShadow: '0 4px 16px rgba(240,185,11,0.20)' }}>
          <Icon size={22} className="text-[#0B0E11]" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-[#EAECEF] tracking-tight">{title}</h2>
          {subtitle && <p className="text-[#9CA3AF] text-sm mt-1 font-bold">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}

// ─── Filter Bar Component ─────────────────────────────────────────
function FilterBar({ filters, active, onChange, isAr }: { filters: { key: string; label: string }[]; active: string; onChange: (key: string) => void; isAr: boolean }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 p-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2B3139' }}>
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className="px-6 py-3 rounded-lg text-[14px] font-bold transition-all duration-200 whitespace-nowrap"
          style={active === f.key ? {
            background: '#F0B90B',
            color: '#0B0E11',
            boxShadow: '0 4px 12px rgba(240,185,11,0.25)',
          } : {
            background: 'transparent',
            color: '#9CA3AF',
            border: 'none',
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

// ─── Toast Component ──────────────────────────────────────────────
function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold shadow-2xl"
      style={{
        background: type === 'success' ? '#0ECB81' : '#F6465D',
        color: '#fff',
        boxShadow: type === 'success' ? '0 8px 32px rgba(14,203,129,0.35)' : '0 8px 32px rgba(246,70,93,0.35)',
      }}
    >
      {type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
      {message}
    </motion.div>
  )
}

// ─── Data Table Wrapper ───────────────────────────────────────────
function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
      {children}
    </div>
  )
}

// ─── Empty State Component ────────────────────────────────────────
function EmptyState({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2B3139' }}>
        <Icon size={36} className="text-[#2B3139]" />
      </div>
      <h3 className="text-[#5E6673] font-bold text-lg">{title}</h3>
    </div>
  )
}

// ─── Pagination Component ─────────────────────────────────────────
function Pagination({ page, totalPages, onPageChange, isAr }: { page: number; totalPages: number; onPageChange: (p: number) => void; isAr: boolean }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 mt-8">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-6 py-3 rounded-xl text-[14px] font-bold transition-all disabled:opacity-30"
        style={{ background: '#1E2329', color: '#EAECEF', border: '1px solid #2B3139' }}
      >
        {isAr ? 'السابق' : 'Prev'}
      </button>
      <span className="text-[#848E9C] text-sm font-bold px-3">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-6 py-3 rounded-xl text-[14px] font-bold transition-all disabled:opacity-30"
        style={{ background: '#1E2329', color: '#EAECEF', border: '1px solid #2B3139' }}
      >
        {isAr ? 'التالي' : 'Next'}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN ADMIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const router = useRouter()
  const { user } = useAppStore()
  const { lang } = useI18n()
  const isAr = lang === 'ar'
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        await useAppStore.getState().refreshUser()
      }
      setAuthChecked(true)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (!authChecked) return
    if (!user) {
      router.replace('/dashboard')
    } else if (user.role !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [user, authChecked, router])

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    if (isMobile) setSidebarOpen(false)
  }

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = useAppStore.getState().getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  // ─── Sidebar rendering ──────────────────────────────────────
  const renderSidebarItem = (tab: SidebarTab) => {
    const Icon = tab.icon
    const isActive = activeTab === tab.id
    return (
      <button
        key={tab.id}
        onClick={() => handleTabChange(tab.id)}
        className="group relative flex items-center gap-4 w-full px-5 py-3.5 text-[15px] font-bold transition-all duration-200 rounded-xl"
        style={{
          color: isActive ? '#0B0E11' : '#B7BDC6',
          background: isActive ? '#F0B90B' : 'transparent',
          boxShadow: isActive ? '0 4px 16px rgba(240,185,11,0.20)' : 'none',
        }}
        onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
        onMouseLeave={(e) => { if (!isActive) (e.currentTarget.style.background = 'transparent') }}
      >
        <Icon size={20} className={isActive ? 'text-[#0B0E11]' : 'text-[#848E9C] group-hover:text-[#EAECEF]'} />
        <span className="flex-1 text-right">{isAr ? tab.labelAr : tab.labelEn}</span>
        {isActive && <ChevronRight size={16} className="text-[#0B0E11] opacity-60" style={{ transform: isAr ? 'scaleX(-1)' : 'none' }} />}
      </button>
    )
  }

  // ─── Content rendering ──────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard onNavigate={(tab) => setActiveTab(tab as TabId)} />
      case 'users':
        return <AdminUsers />
      case 'deposits':
        return <AdminDeposits isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'withdrawals':
        return <AdminWithdrawals isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'transactions':
        return <AdminTransactions />
      case 'investments':
        return <AdminInvestments />
      case 'kyc':
        return <AdminKYC isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'packages':
        return <AdminPackages isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'settings':
        return <AdminSettings />
      case 'notifications':
        return <AdminNotifications isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'export':
        return <AdminExport isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'activity':
        return <AdminActivityLog isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'engineer':
        return <AdminEngineerAgent isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'engine':
        return <AdminEngineControls isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'blacklist':
        return <AdminBlacklist isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'advanced':
        return <AdminAdvancedPanel isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'security':
        return <AdminSecurityFortress isAr={isAr} getAuthHeaders={getAuthHeaders} />
      case 'support':
        return <AdminSupport isAr={isAr} getAuthHeaders={getAuthHeaders} />
      default:
        return <AdminDashboard />
    }
  }

  // Show loading while checking auth
  if (!authChecked || !user) {
    return (
      <div className="flex h-screen items-center justify-center" dir={isAr ? 'rtl' : 'ltr'} style={{ background: '#0B0E11' }}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(240,185,11,0.12)' }}>
            <Loader2 size={28} className="animate-spin text-[#F0B90B]" />
          </div>
          <span className="text-[#848E9C] text-base font-bold">{isAr ? 'جاري التحقق...' : 'Verifying...'}</span>
        </div>
      </div>
    )
  }

  const currentTabLabel = (() => {
    const allTabs = [...MAIN_TABS, ...SYSTEM_TABS]
    const tab = allTabs.find(t => t.id === activeTab)
    return tab ? (isAr ? tab.labelAr : tab.labelEn) : ''
  })()

  return (
    <div className="flex h-screen overflow-hidden" dir={isAr ? 'rtl' : 'ltr'} style={{ background: '#0B0E11' }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`${
          isMobile
            ? `fixed top-0 ${isAr ? 'right-0' : 'left-0'} z-50 h-full transition-transform duration-300 ease-out ${
                sidebarOpen ? 'translate-x-0' : isAr ? 'translate-x-full' : '-translate-x-full'
              }`
            : 'relative'
        } flex flex-col shrink-0 overflow-hidden`}
        style={{
          width: '320px',
          background: '#12121A',
          borderRight: isAr ? 'none' : '1px solid #1E1E2E',
          borderLeft: isAr ? '1px solid #1E1E2E' : 'none',
        }}
      >
        {/* Sidebar Header - Brand */}
        <div className="px-6 py-6" style={{ borderBottom: '1px solid #1E1E2E' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, #F0B90B 0%, #D4A200 100%)',
                boxShadow: '0 4px 16px rgba(240,185,11,0.30)',
              }}>
                <Zap size={22} className="text-[#0B0E11]" />
              </div>
              <div>
                <h2 className="text-[#F0B90B] font-black text-xl tracking-wider">
                  SONA
                </h2>
                <span className="text-[#6B7280] text-[12px] font-bold tracking-[0.2em] uppercase">
                  {isAr ? 'لوحة الإدارة' : 'Admin Panel'}
                </span>
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)}
                className="p-2.5 rounded-xl text-[#848E9C] hover:text-[#EAECEF] transition-colors duration-200"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2B3139' }}>
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5">
          <div className="px-5 py-2 text-[#6B7280] text-[12px] font-black uppercase tracking-[0.15em]">
            {isAr ? 'القائمة الرئيسية' : 'Main Menu'}
          </div>
          {MAIN_TABS.map(renderSidebarItem)}

          <div className="px-5 py-2 mt-6 text-[#6B7280] text-[12px] font-black uppercase tracking-[0.15em]">
            {isAr ? 'النظام والأدوات' : 'System & Tools'}
          </div>
          {SYSTEM_TABS.map(renderSidebarItem)}
        </div>

        {/* Sidebar Footer */}
        <div className="p-5" style={{ borderTop: '1px solid #1E1E2E' }}>
          {/* User card */}
          <div className="mb-4 px-5 py-4 rounded-2xl" style={{ background: 'rgba(240,185,11,0.04)', border: '1px solid rgba(240,185,11,0.08)' }}>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[#0B0E11] font-black text-base" style={{
                background: 'linear-gradient(135deg, #F0B90B 0%, #D4A200 100%)',
                boxShadow: '0 4px 12px rgba(240,185,11,0.20)',
              }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[#EAECEF] text-sm font-bold truncate">{user?.name || 'Admin'}</div>
                <div className="text-[#0ECB81] text-[12px] flex items-center gap-2 font-bold mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ECB81] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0ECB81]" />
                  </span>
                  {isAr ? 'مدير النظام' : 'System Admin'}
                </div>
              </div>
            </div>
          </div>
          {/* Exit button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl text-[#F6465D] text-sm font-bold transition-all duration-200"
            style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.10)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(246,70,93,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(246,70,93,0.06)' }}
          >
            <LogOut size={16} />
            <span>{isAr ? 'العودة للمنصة' : 'Back to Platform'}</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <header className="h-[72px] flex items-center justify-between px-8 shrink-0" style={{
          background: '#12121A',
          borderBottom: '1px solid #1E1E2E',
        }}>
          <div className="flex items-center gap-5">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2.5 rounded-xl text-[#848E9C] hover:text-[#EAECEF] transition-colors duration-200"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2B3139' }}
              >
                <Menu size={20} />
              </button>
            )}
            {/* Breadcrumb */}
            <div className="flex items-center gap-3">
              <span className="text-[#F0B90B] font-black text-[16px] tracking-wider">SONA</span>
              <ChevronRight size={18} className="text-[#3B3B3B]" style={{ transform: isAr ? 'scaleX(-1)' : 'none' }} />
              <span className="text-[#EAECEF] font-bold text-[20px]">{currentTabLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live clock */}
            <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 rounded-xl" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid #2B3139',
            }}>
              <Clock size={15} className="text-[#848E9C]" />
              <span className="text-[#B7BDC6] text-[14px] font-mono font-bold" dir="ltr">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Online status */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{
              background: 'rgba(14,203,129,0.06)',
              border: '1px solid rgba(14,203,129,0.10)',
            }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ECB81] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0ECB81]" />
              </span>
              <span className="text-[#0ECB81] text-[13px] font-black tracking-wider">{isAr ? 'متصل' : 'LIVE'}</span>
            </div>

            {/* Admin avatar */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#0B0E11] font-black text-sm" style={{
              background: 'linear-gradient(135deg, #F0B90B 0%, #D4A200 100%)',
              boxShadow: '0 4px 12px rgba(240,185,11,0.25)',
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* ─── Content Area ───────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8 xl:p-12" style={{
          background: '#0B0E11',
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   INLINE ADMIN COMPONENTS (Deposits, Withdrawals, KYC, Packages, Notifications, Export)
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── Engine Controls Sub-components ──────────────────────────────
function EngineToggleSwitch({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 disabled:opacity-40"
      style={{
        background: enabled ? '#F0B90B' : '#2B3139',
        boxShadow: enabled ? '0 0 12px rgba(240,185,11,0.30)' : 'none',
      }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full transition-all duration-300"
        style={{
          background: enabled ? '#0B0E11' : '#848E9C',
          transform: enabled ? 'translateX(22px)' : 'translateX(4px)',
        }}
      />
    </button>
  )
}

function EngineSliderControl({ label, value, min, max, step, onChange, unit, displayValue }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string; displayValue?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#B7BDC6] text-[13px] font-bold">{label}</span>
        <span className="text-[#F0B90B] text-[13px] font-black" dir="ltr">{displayValue ?? value}{unit ?? ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="engine-slider w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #F0B90B ${((value - min) / (max - min)) * 100}%, #2B3139 ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .engine-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #F0B90B;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(240,185,11,0.40);
        }
        .engine-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #F0B90B;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(240,185,11,0.40);
        }
      ` }} />
    </div>
  )
}

// ─── Admin Engine Controls ────────────────────────────────────────
function AdminEngineControls({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [botStatus, setBotStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Market Mover state
  const [moverEnabled, setMoverEnabled] = useState(false)
  const [moverSpeed, setMoverSpeed] = useState(1000)
  const [moverIntensity, setMoverIntensity] = useState(0.1)
  const [moverMaxDeviation, setMoverMaxDeviation] = useState(1.0)
  const [moverSmoothing, setMoverSmoothing] = useState(0.1)
  const [moverNoiseScale, setMoverNoiseScale] = useState(0.1)

  // Liquidity Locker state
  const [lockerEnabled, setLockerEnabled] = useState(false)
  const [lockerOrderSize, setLockerOrderSize] = useState(1000)
  const [lockerDistance, setLockerDistance] = useState(0.1)
  const [lockerMaxOrders, setLockerMaxOrders] = useState(3)
  const [lockerRefreshInterval, setLockerRefreshInterval] = useState(5)
  const [lockerAutoCancel, setLockerAutoCancel] = useState(0.05)

  // Bot state
  const [botEnabled, setBotEnabled] = useState(false)
  const [botWinRate, setBotWinRate] = useState(60)
  const [botTradesPerMin, setBotTradesPerMin] = useState(1)
  const [botMaxTradeAmount, setBotMaxTradeAmount] = useState(100)

  const [reloadCounter, setReloadCounter] = useState(0)
  const triggerReload = useCallback(() => setReloadCounter(c => c + 1), [])

  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      try {
        const [engineRes, botRes] = await Promise.all([
          fetch('/api/admin/engine-controls', { headers: getAuthHeaders() }),
          fetch('/api/admin/bot-controls', { headers: getAuthHeaders() }),
        ])
        if (cancelled) return
        if (engineRes.ok) {
          const data = await engineRes.json()
          setEngineStatus(data)
          if (data.mover) {
            setMoverEnabled(data.mover.enabled ?? false)
            setMoverSpeed(data.mover.speed ?? 1000)
            setMoverIntensity(data.mover.intensity ?? 0.1)
            setMoverMaxDeviation(data.mover.maxDeviation ?? 1.0)
            setMoverSmoothing(data.mover.smoothing ?? 0.1)
            setMoverNoiseScale(data.mover.noiseScale ?? 0.1)
          }
          if (data.locker) {
            setLockerEnabled(data.locker.enabled ?? false)
            setLockerOrderSize(data.locker.orderSize ?? 1000)
            setLockerDistance(data.locker.distance ?? 0.1)
            setLockerMaxOrders(data.locker.maxOrders ?? 3)
            setLockerRefreshInterval(data.locker.refreshInterval ?? 5)
            setLockerAutoCancel(data.locker.autoCancelThreshold ?? 0.05)
          }
        }
        if (botRes.ok) {
          const data = await botRes.json()
          if (!cancelled) {
            setBotStatus(data)
            if (data.bot) {
              setBotEnabled(data.bot.enabled ?? false)
              setBotWinRate(data.bot.winRate ?? 60)
              setBotTradesPerMin(data.bot.tradesPerMinute ?? 1)
              setBotMaxTradeAmount(data.bot.maxTradeAmount ?? 100)
            }
          }
        }
      } catch {
        if (!cancelled) {
          setToast({ type: 'error', message: isAr ? 'خطأ في تحميل البيانات' : 'Error loading data' })
          setTimeout(() => setToast(null), 3000)
        }
      }
      if (!cancelled) setLoading(false)
    }
    doLoad()
    return () => { cancelled = true }
  }, [getAuthHeaders, reloadCounter])

  async function saveEngineSetting(section: string, updates: Record<string, any>) {
    setSaving(true)
    try {
      // Map frontend section names to API-expected format:
      // Frontend sends: { section: 'mover', enabled: true, speed: 1000 }
      // API expects: { marketMover: { enabled: true, speed: 1000 } } or { liquidityLocker: { ... } }
      const bodyPayload: Record<string, any> = {}
      if (section === 'mover') {
        bodyPayload.marketMover = updates
      } else if (section === 'locker') {
        bodyPayload.liquidityLocker = updates
      } else {
        // Fallback: wrap in section name as-is
        bodyPayload[section] = updates
      }
      const res = await fetch('/api/admin/engine-controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(bodyPayload),
      })
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم الحفظ بنجاح' : 'Saved successfully' })
        triggerReload()
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setSaving(false)
    setTimeout(() => setToast(null), 3000)
  }

  async function saveBotSetting(updates: Record<string, any>) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/bot-controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم الحفظ بنجاح' : 'Saved successfully' })
        triggerReload()
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setSaving(false)
    setTimeout(() => setToast(null), 3000)
  }

  // Volume imbalance derived from engine status
  const buyVolume = engineStatus?.volumeImbalance?.buyVolume ?? 0
  const sellVolume = engineStatus?.volumeImbalance?.sellVolume ?? 0
  const totalVolume = buyVolume + sellVolume
  const imbalanceRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5
  const imbalanceDirection = buyVolume > sellVolume ? (isAr ? 'شراء' : 'Buy') : buyVolume < sellVolume ? (isAr ? 'بيع' : 'Sell') : (isAr ? 'متوازن' : 'Balanced')

  // Bot daily return calculation
  const botDailyReturn = botStatus?.bot?.dailyReturn ?? 0
  const botDailyStatus = botDailyReturn >= 50 ? 'profit' : 'loss'

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={Zap}
        title={isAr ? 'محرك السوق' : 'Engine Controls'}
        subtitle={isAr ? 'التحكم في خوارزميات السوق والبوت' : 'Market algorithms & bot controls'}
        actions={
          <button
            onClick={triggerReload}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
            style={{ background: 'rgba(240,185,11,0.10)', color: '#F0B90B', border: '1px solid rgba(240,185,11,0.15)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-[#F0B90B]" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ═══ Section 1: Market Mover Controls ═══ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(240,185,11,0.10)' }}>
                  <Activity size={18} className="text-[#F0B90B]" />
                </div>
                <h3 className="text-[#EAECEF] text-[16px] font-bold">{isAr ? 'تحريك السوق' : 'Market Mover'}</h3>
              </div>
              <EngineToggleSwitch enabled={moverEnabled} onToggle={() => saveEngineSetting('mover', { enabled: !moverEnabled })} disabled={saving} />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <EngineSliderControl
                  label={isAr ? 'السرعة' : 'Speed'}
                  value={moverSpeed}
                  min={100} max={5000} step={100}
                  onChange={(v) => setMoverSpeed(v)}
                  unit="ms"
                />
                <EngineSliderControl
                  label={isAr ? 'الشدة' : 'Intensity'}
                  value={moverIntensity}
                  min={0.01} max={1.0} step={0.01}
                  onChange={(v) => setMoverIntensity(v)}
                  displayValue={`${(moverIntensity * 100).toFixed(0)}%`}
                />
                <EngineSliderControl
                  label={isAr ? 'أقصى انحراف' : 'Max Deviation'}
                  value={moverMaxDeviation}
                  min={0.5} max={5.0} step={0.1}
                  onChange={(v) => setMoverMaxDeviation(v)}
                  unit="%"
                />
                <EngineSliderControl
                  label={isAr ? 'عامل التنعيم' : 'Smoothing Factor'}
                  value={moverSmoothing}
                  min={0.01} max={0.5} step={0.01}
                  onChange={(v) => setMoverSmoothing(v)}
                />
                <EngineSliderControl
                  label={isAr ? 'مقياس الضوضاء' : 'Noise Scale'}
                  value={moverNoiseScale}
                  min={0.01} max={1.0} step={0.01}
                  onChange={(v) => setMoverNoiseScale(v)}
                />
              </div>
              <button
                onClick={() => saveEngineSetting('mover', {
                  speed: moverSpeed, intensity: moverIntensity, maxDeviation: moverMaxDeviation,
                  smoothing: moverSmoothing, noiseScale: moverNoiseScale,
                })}
                disabled={saving}
                className="mt-4 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
                style={{ background: '#F0B90B', color: '#0B0E11' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
                {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>
              {/* Status display */}
              {engineStatus?.mover && (
                <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2B3139' }}>
                  <h4 className="text-[#848E9C] text-[12px] font-black uppercase tracking-[0.15em] mb-3">{isAr ? 'الحالة الحالية' : 'Current Status'}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'المرحلة' : 'Phase'}</span>
                      <div className="text-[#EAECEF] text-sm font-bold mt-1">{engineStatus.mover.phase ?? '-'}</div>
                    </div>
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'الإزاحة التراكمية' : 'Cumulative Offset'}</span>
                      <div className="text-[#EAECEF] text-sm font-bold mt-1" dir="ltr">{engineStatus.mover.cumulativeOffset ?? '0.00'}</div>
                    </div>
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'EMA' : 'EMA'}</span>
                      <div className="text-[#EAECEF] text-sm font-bold mt-1" dir="ltr">{engineStatus.mover.ema ?? '0.00'}</div>
                    </div>
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'إجمالي التعديلات' : 'Total Adjustments'}</span>
                      <div className="text-[#EAECEF] text-sm font-bold mt-1" dir="ltr">{engineStatus.mover.totalAdjustments ?? '0'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Section 2: Liquidity Locker Controls ═══ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,203,129,0.10)' }}>
                  <DollarSign size={18} className="text-[#0ECB81]" />
                </div>
                <h3 className="text-[#EAECEF] text-[16px] font-bold">{isAr ? 'قفل السيولة' : 'Liquidity Locker'}</h3>
              </div>
              <EngineToggleSwitch enabled={lockerEnabled} onToggle={() => saveEngineSetting('locker', { enabled: !lockerEnabled })} disabled={saving} />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <EngineSliderControl
                  label={isAr ? 'حجم الأمر' : 'Order Size'}
                  value={lockerOrderSize}
                  min={100} max={100000} step={100}
                  onChange={(v) => setLockerOrderSize(v)}
                  unit="$"
                />
                <EngineSliderControl
                  label={isAr ? 'المسافة عن السعر' : 'Distance from Price'}
                  value={lockerDistance}
                  min={0.05} max={2.0} step={0.05}
                  onChange={(v) => setLockerDistance(v)}
                  unit="%"
                />
                <EngineSliderControl
                  label={isAr ? 'أقصى أوامر لكل جانب' : 'Max Orders per Side'}
                  value={lockerMaxOrders}
                  min={1} max={10} step={1}
                  onChange={(v) => setLockerMaxOrders(v)}
                />
                <EngineSliderControl
                  label={isAr ? 'فترة التحديث' : 'Refresh Interval'}
                  value={lockerRefreshInterval}
                  min={1} max={30} step={1}
                  onChange={(v) => setLockerRefreshInterval(v)}
                  unit={isAr ? 'ث' : 's'}
                />
                <EngineSliderControl
                  label={isAr ? 'عتبة الإلغاء التلقائي' : 'Auto-cancel Threshold'}
                  value={lockerAutoCancel}
                  min={0.01} max={0.5} step={0.01}
                  onChange={(v) => setLockerAutoCancel(v)}
                  unit="%"
                />
              </div>
              <button
                onClick={() => saveEngineSetting('locker', {
                  orderSize: lockerOrderSize, distance: lockerDistance, maxOrders: lockerMaxOrders,
                  refreshInterval: lockerRefreshInterval, autoCancelThreshold: lockerAutoCancel,
                })}
                disabled={saving}
                className="mt-4 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
                style={{ background: '#F0B90B', color: '#0B0E11' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
                {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>
              {/* Status display */}
              {engineStatus?.locker && (
                <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2B3139' }}>
                  <h4 className="text-[#848E9C] text-[12px] font-black uppercase tracking-[0.15em] mb-3">{isAr ? 'الحالة الحالية' : 'Current Status'}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'أوامر نشطة' : 'Active Orders'}</span>
                      <div className="text-[#0ECB81] text-sm font-bold mt-1">{engineStatus.locker.activeOrders ?? 0}</div>
                    </div>
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'إجمالي المنشأة' : 'Total Created'}</span>
                      <div className="text-[#EAECEF] text-sm font-bold mt-1">{engineStatus.locker.totalCreated ?? 0}</div>
                    </div>
                    <div>
                      <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'إجمالي الملغاة' : 'Total Cancelled'}</span>
                      <div className="text-[#F6465D] text-sm font-bold mt-1">{engineStatus.locker.totalCancelled ?? 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Section 3: Volume Imbalance Monitor ═══ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <div className="px-6 py-4" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)' }}>
                  <BarChart3 size={18} className="text-[#2563EB]" />
                </div>
                <h3 className="text-[#EAECEF] text-[16px] font-bold">{isAr ? 'مراقب عدم توازن الحجم' : 'Volume Imbalance Monitor'}</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="rounded-xl p-4" style={{ background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.10)' }}>
                  <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'حجم الشراء (إيداعات) 24س' : 'Buy Volume (Deposits) 24h'}</span>
                  <div className="text-[#0ECB81] text-xl font-black mt-2" dir="ltr">{formatUSD(buyVolume)}</div>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.10)' }}>
                  <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'حجم البيع (سحوبات) 24س' : 'Sell Volume (Withdrawals) 24h'}</span>
                  <div className="text-[#F6465D] text-xl font-black mt-2" dir="ltr">{formatUSD(sellVolume)}</div>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(240,185,11,0.06)', border: '1px solid rgba(240,185,11,0.10)' }}>
                  <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'نسبة عدم التوازن' : 'Imbalance Ratio'}</span>
                  <div className="text-[#F0B90B] text-xl font-black mt-2" dir="ltr">{(imbalanceRatio * 100).toFixed(1)}%</div>
                  <span className="text-[#B7BDC6] text-[12px] font-bold mt-1">{isAr ? 'الاتجاه: ' : 'Direction: '}{imbalanceDirection}</span>
                </div>
              </div>
              {/* Visual bar */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2B3139' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#0ECB81] text-[12px] font-bold">{isAr ? 'شراء' : 'Buy'}</span>
                  <span className="text-[#F6465D] text-[12px] font-bold">{isAr ? 'بيع' : 'Sell'}</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: '#2B3139' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${imbalanceRatio * 100}%`,
                      background: 'linear-gradient(to right, #0ECB81, #F0B90B)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[#5E6673] text-[11px] font-bold" dir="ltr">{(imbalanceRatio * 100).toFixed(1)}%</span>
                  <span className="text-[#5E6673] text-[11px] font-bold" dir="ltr">{((1 - imbalanceRatio) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Section 4: Investment Bot Controls ═══ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(240,185,11,0.10)' }}>
                  <Bot size={18} className="text-[#F0B90B]" />
                </div>
                <h3 className="text-[#EAECEF] text-[16px] font-bold">{isAr ? 'بوت الاستثمار' : 'Investment Bot'}</h3>
              </div>
              <EngineToggleSwitch enabled={botEnabled} onToggle={() => saveBotSetting({ enabled: !botEnabled })} disabled={saving} />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <EngineSliderControl
                  label={isAr ? 'نسبة الفوز' : 'Win Rate'}
                  value={botWinRate}
                  min={10} max={100} step={1}
                  onChange={(v) => setBotWinRate(v)}
                  unit="%"
                />
                <EngineSliderControl
                  label={isAr ? 'صفقات في الدقيقة' : 'Trades Per Minute'}
                  value={botTradesPerMin}
                  min={0.1} max={10} step={0.1}
                  onChange={(v) => setBotTradesPerMin(v)}
                />
                <EngineSliderControl
                  label={isAr ? 'أقصى مبلغ للصفقة' : 'Max Trade Amount'}
                  value={botMaxTradeAmount}
                  min={10} max={10000} step={10}
                  onChange={(v) => setBotMaxTradeAmount(v)}
                  unit="$"
                />
              </div>
              <button
                onClick={() => saveBotSetting({
                  winRate: botWinRate, tradesPerMinute: botTradesPerMin, maxTradeAmount: botMaxTradeAmount,
                })}
                disabled={saving}
                className="mt-4 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
                style={{ background: '#F0B90B', color: '#0B0E11' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
                {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>
              {/* Daily return & bot status */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2B3139' }}>
                  <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'العائد اليومي' : 'Daily Return'}</span>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className="text-2xl font-black"
                      style={{ color: botDailyStatus === 'profit' ? '#0ECB81' : '#F6465D' }}
                      dir="ltr"
                    >
                      {botDailyReturn.toFixed(2)}%
                    </span>
                    <span
                      className="px-3 py-1 rounded-lg text-[12px] font-bold"
                      style={{
                        background: botDailyStatus === 'profit' ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.12)',
                        color: botDailyStatus === 'profit' ? '#0ECB81' : '#F6465D',
                      }}
                    >
                      {botDailyStatus === 'profit' ? (isAr ? 'ربح' : 'Profit') : (isAr ? 'خسارة' : 'Loss')}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2B3139' }}>
                  <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'حالة البوت' : 'Bot Status'}</span>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      {botEnabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ECB81] opacity-75" />}
                      <span
                        className="relative inline-flex rounded-full h-3 w-3"
                        style={{ background: botEnabled ? '#0ECB81' : '#F6465D' }}
                      />
                    </span>
                    <span className="text-lg font-bold" style={{ color: botEnabled ? '#0ECB81' : '#F6465D' }}>
                      {botEnabled ? (isAr ? 'نشط' : 'Active') : (isAr ? 'متوقف' : 'Stopped')}
                    </span>
                  </div>
                  {botStatus?.bot && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'الصفقات اليوم' : 'Trades Today'}</span>
                        <div className="text-[#EAECEF] text-sm font-bold">{botStatus.bot.tradesToday ?? 0}</div>
                      </div>
                      <div>
                        <span className="text-[#5E6673] text-[11px] font-bold">{isAr ? 'صافي الربح' : 'Net P&L'}</span>
                        <div className="text-sm font-bold" style={{ color: (botStatus.bot.netPnL ?? 0) >= 0 ? '#0ECB81' : '#F6465D' }} dir="ltr">
                          {formatUSD(botStatus.bot.netPnL ?? 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin Blacklist ───────────────────────────────────────────────
function AdminBlacklist({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newEntry, setNewEntry] = useState({ targetType: 'IP', targetValue: '', reason: '', isPermanent: true })
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/security/blacklist?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [typeFilter, getAuthHeaders])

  useEffect(() => { loadEntries() }, [loadEntries])

  async function addEntry() {
    if (!newEntry.targetValue || !newEntry.reason) {
      setToast({ type: 'error', message: isAr ? 'جميع الحقول مطلوبة' : 'All fields required' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/security/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newEntry),
      })
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تمت الإضافة بنجاح' : 'Added successfully' })
        setShowAddDialog(false)
        setNewEntry({ targetType: 'IP', targetValue: '', reason: '', isPermanent: true })
        loadEntries()
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setAdding(false)
    setTimeout(() => setToast(null), 3000)
  }

  async function removeEntry(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/security/blacklist?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم الحذف بنجاح' : 'Removed successfully' })
        loadEntries()
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setDeletingId(null)
    setTimeout(() => setToast(null), 3000)
  }

  const typeConfig: Record<string, { bg: string; text: string; label: string; labelEn: string }> = {
    USER: { bg: 'rgba(246,70,93,0.12)', text: '#F6465D', label: 'مستخدم', labelEn: 'User' },
    IP: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', label: 'عنوان IP', labelEn: 'IP Address' },
    EMAIL: { bg: 'rgba(37,99,235,0.12)', text: '#2563EB', label: 'بريد إلكتروني', labelEn: 'Email' },
  }

  const filters = [
    { key: '', label: isAr ? 'الكل' : 'All' },
    { key: 'IP', label: isAr ? 'عناوين IP' : 'IP Addresses' },
    { key: 'EMAIL', label: isAr ? 'البريد الإلكتروني' : 'Emails' },
    { key: 'USER', label: isAr ? 'المستخدمين' : 'Users' },
  ]

  const ipCount = entries.filter(e => e.targetType === 'IP').length
  const emailCount = entries.filter(e => e.targetType === 'EMAIL').length
  const userCount = entries.filter(e => e.targetType === 'USER').length

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={Shield}
        title={isAr ? 'القائمة السوداء' : 'Blacklist'}
        subtitle={`${entries.length} ${isAr ? 'إدخال' : 'entries'}`}
        actions={
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
            style={{ background: '#F0B90B', color: '#0B0E11' }}
          >
            <Shield size={14} />
            {isAr ? 'إضافة' : 'Add Entry'}
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(246,70,93,0.10)' }}>
              <Shield size={18} className="text-[#F6465D]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'الإجمالي' : 'Total'}</span>
          </div>
          <div className="text-[#F6465D] text-2xl font-black">{entries.length}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)' }}>
              <Globe size={18} className="text-[#F59E0B]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'عناوين IP' : 'IPs'}</span>
          </div>
          <div className="text-[#F59E0B] text-2xl font-black">{ipCount}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)' }}>
              <Send size={18} className="text-[#2563EB]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'البريد الإلكتروني' : 'Emails'}</span>
          </div>
          <div className="text-[#2563EB] text-2xl font-black">{emailCount}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(246,70,93,0.10)' }}>
              <Users size={18} className="text-[#F6465D]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'المستخدمين' : 'Users'}</span>
          </div>
          <div className="text-[#F6465D] text-2xl font-black">{userCount}</div>
        </div>
      </div>

      <FilterBar filters={filters} active={typeFilter} onChange={setTypeFilter} isAr={isAr} />

      {/* Add Entry Dialog */}
      {showAddDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAddDialog(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md p-6 rounded-2xl"
            style={{ background: '#181A20', border: '1px solid #2B3139' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-[#EAECEF] mb-6">{isAr ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-[#848E9C] text-[13px] font-bold mb-2 block">{isAr ? 'النوع' : 'Type'}</label>
                <div className="flex gap-3">
                  {(['IP', 'EMAIL', 'USER'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewEntry({ ...newEntry, targetType: type })}
                      className="flex-1 py-3 rounded-xl text-[13px] font-bold transition-all"
                      style={newEntry.targetType === type ? {
                        background: '#F0B90B', color: '#0B0E11'
                      } : {
                        background: 'rgba(255,255,255,0.04)', color: '#848E9C', border: '1px solid #2B3139'
                      }}
                    >
                      {typeConfig[type]?.label || type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[#848E9C] text-[13px] font-bold mb-2 block">
                  {newEntry.targetType === 'IP' ? (isAr ? 'عنوان IP' : 'IP Address') :
                   newEntry.targetType === 'EMAIL' ? (isAr ? 'البريد الإلكتروني' : 'Email') :
                   (isAr ? 'معرف المستخدم' : 'User ID')}
                </label>
                <input
                  type="text"
                  value={newEntry.targetValue}
                  onChange={(e) => setNewEntry({ ...newEntry, targetValue: e.target.value })}
                  placeholder={newEntry.targetType === 'IP' ? '192.168.1.1' : newEntry.targetType === 'EMAIL' ? 'user@example.com' : 'userId'}
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-bold text-[#EAECEF] placeholder-[#3B3B3B]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2B3139' }}
                />
              </div>

              <div>
                <label className="text-[#848E9C] text-[13px] font-bold mb-2 block">{isAr ? 'السبب' : 'Reason'}</label>
                <textarea
                  value={newEntry.reason}
                  onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                  placeholder={isAr ? 'أدخل سبب الحظر...' : 'Enter reason for blacklisting...'}
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-bold text-[#EAECEF] placeholder-[#3B3B3B] resize-none h-20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2B3139' }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#B7BDC6] text-[13px] font-bold">{isAr ? 'حظر دائم' : 'Permanent ban'}</span>
                <button
                  onClick={() => setNewEntry({ ...newEntry, isPermanent: !newEntry.isPermanent })}
                  className="relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300"
                  style={{ background: newEntry.isPermanent ? '#F6465D' : '#2B3139' }}
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full transition-all duration-300"
                    style={{
                      background: newEntry.isPermanent ? '#fff' : '#848E9C',
                      transform: newEntry.isPermanent ? 'translateX(22px)' : 'translateX(4px)',
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addEntry}
                disabled={adding}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#F6465D', color: '#fff' }}
              >
                {adding ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                {isAr ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}
              </button>
              <button
                onClick={() => setShowAddDialog(false)}
                className="px-6 py-3 rounded-xl text-[14px] font-bold"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#848E9C', border: '1px solid #2B3139' }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-[#F0B90B]" />
        </div>
      ) : entries.length > 0 ? (
        <DataTable>
          <div className="grid grid-cols-12 gap-4 px-6 py-4" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'النوع' : 'Type'}</div>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'القيمة' : 'Value'}</div>
            <div className="col-span-4 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'السبب' : 'Reason'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'التاريخ' : 'Date'}</div>
            <div className="col-span-1 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em] text-center">{isAr ? 'حذف' : 'Del'}</div>
          </div>
          {entries.map((entry, i) => {
            const tc = typeConfig[entry.targetType] || { bg: 'rgba(255,255,255,0.06)', text: '#848E9C', label: entry.targetType, labelEn: entry.targetType }
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors duration-150"
                style={{ borderBottom: '1px solid #1E1E2E' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div className="col-span-2">
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold"
                    style={{ background: tc.bg, color: tc.text }}
                  >
                    {isAr ? tc.label : tc.labelEn}
                  </span>
                </div>
                <div className="col-span-3">
                  <div className="text-[#F0F0F0] text-[14px] font-bold truncate" dir="ltr">{entry.targetValue}</div>
                </div>
                <div className="col-span-4">
                  <div className="text-[#B7BDC6] text-[13px] font-medium truncate">{entry.reason}</div>
                  <div className="text-[#5E6673] text-[11px] mt-0.5">
                    {entry.isPermanent ? (isAr ? 'حظر دائم' : 'Permanent') : (isAr ? 'مؤقت' : 'Temporary')}
                    {entry.source && ` · ${entry.source}`}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[#CFD4DA] text-[14px] font-medium">{formatDateShort(entry.createdAt)}</div>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <button
                    onClick={() => removeEntry(entry.id)}
                    disabled={deletingId === entry.id}
                    className="p-2 rounded-lg transition-all disabled:opacity-40"
                    style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.12)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(246,70,93,0.18)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(246,70,93,0.08)' }}
                  >
                    {deletingId === entry.id ? <Loader2 size={14} className="animate-spin text-[#F6465D]" /> : <XCircle size={14} className="text-[#F6465D]" />}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </DataTable>
      ) : (
        <EmptyState icon={Shield} title={isAr ? 'لا توجد إدخالات في القائمة السوداء' : 'No blacklist entries found'} />
      )}
    </div>
  )
}

// ─── Admin Deposits ───────────────────────────────────────────────
function AdminDeposits({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [deposits, setDeposits] = useState<any[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadDeposits = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/deposits?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setDeposits(data.transactions || [])
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [statusFilter, getAuthHeaders])

  useEffect(() => { loadDeposits(1) }, [statusFilter, loadDeposits])

  async function updateTransactionStatus(id: string, status: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم التحديث بنجاح' : 'Updated successfully' })
        loadDeposits(pagination.page)
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setActionLoading(null)
    setTimeout(() => setToast(null), 3000)
  }

  const filters = [
    { key: '', label: isAr ? 'الكل' : 'All' },
    { key: 'PENDING', label: isAr ? 'معلق' : 'Pending' },
    { key: 'COMPLETED', label: isAr ? 'مكتمل' : 'Completed' },
    { key: 'REJECTED', label: isAr ? 'مرفوض' : 'Rejected' },
  ]

  // Calculate summary stats
  const totalAmount = deposits.reduce((sum, d) => sum + (d.amount || 0), 0)
  const pendingCount = deposits.filter(d => d.status === 'PENDING').length

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={ArrowDownCircle}
        title={isAr ? 'إدارة الإيداعات' : 'Manage Deposits'}
        subtitle={`${pagination.total} ${isAr ? 'إيداع' : 'deposits'}`}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,203,129,0.10)' }}>
              <DollarSign size={18} className="text-[#0ECB81]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'إجمالي الإيداعات' : 'Total Deposits'}</span>
          </div>
          <div className="text-[#0ECB81] text-2xl font-black" dir="ltr">{formatUSD(totalAmount)}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)' }}>
              <Clock size={18} className="text-[#F59E0B]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'معلقة' : 'Pending'}</span>
          </div>
          <div className="text-[#F59E0B] text-2xl font-black">{pendingCount}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)' }}>
              <BarChart3 size={18} className="text-[#2563EB]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'عدد الإيداعات' : 'Total Count'}</span>
          </div>
          <div className="text-[#2563EB] text-2xl font-black">{pagination.total}</div>
        </div>
      </div>

      <FilterBar filters={filters} active={statusFilter} onChange={setStatusFilter} isAr={isAr} />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-[#F0B90B]" />
        </div>
      ) : deposits.length > 0 ? (
        <DataTable>
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'المستخدم' : 'User'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'المبلغ' : 'Amount'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'الحالة' : 'Status'}</div>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'التاريخ' : 'Date'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em] text-center">{isAr ? 'إجراء' : 'Action'}</div>
          </div>
          {/* Table Rows */}
          {deposits.map((dep, i) => (
            <motion.div
              key={dep.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors duration-150"
              style={{ borderBottom: '1px solid #1E1E2E' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div className="col-span-3 flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#0ECB81] text-sm font-black shrink-0" style={{ background: 'rgba(14,203,129,0.10)' }}>
                  {(dep.user?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[#F0F0F0] text-[15px] font-bold truncate">{dep.user?.name || '-'}</div>
                  <div className="text-[#848E9C] text-[13px] font-medium truncate">{dep.user?.email || ''}</div>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[#0ECB81] font-black text-[16px]" dir="ltr">{formatUSD(dep.amount)}</span>
              </div>
              <div className="col-span-2">
                <StatusBadge status={dep.status} isAr={isAr} />
              </div>
              <div className="col-span-3">
                <div className="text-[#CFD4DA] text-[14px] font-medium">{formatDateShort(dep.createdAt)}</div>
                <div className="text-[#5E6673] text-[12px]">{formatTimeShort(dep.createdAt)}</div>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2">
                {dep.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => updateTransactionStatus(dep.id, 'APPROVED')}
                      disabled={actionLoading === dep.id}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14,203,129,0.20)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(14,203,129,0.10)' }}
                    >
                      {actionLoading === dep.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      {isAr ? 'قبول' : 'Approve'}
                    </button>
                    <button
                      onClick={() => updateTransactionStatus(dep.id, 'REJECTED')}
                      disabled={actionLoading === dep.id}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.15)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(246,70,93,0.20)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(246,70,93,0.10)' }}
                    >
                      <XCircle size={13} />
                      {isAr ? 'رفض' : 'Reject'}
                    </button>
                  </>
                ) : (
                  <span className="text-[#3B3B3B] text-[13px] font-bold">—</span>
                )}
              </div>
            </motion.div>
          ))}
        </DataTable>
      ) : (
        <EmptyState icon={ArrowDownCircle} title={isAr ? 'لا توجد إيداعات' : 'No deposits found'} />
      )}
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={loadDeposits} isAr={isAr} />
    </div>
  )
}

// ─── Admin Withdrawals ────────────────────────────────────────────
function AdminWithdrawals({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [liquidity, setLiquidity] = useState<any>(null)

  const loadWithdrawals = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/withdrawals?${params}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setWithdrawals(data.transactions || [])
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
        setLiquidity(data.liquidity || null)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [statusFilter, getAuthHeaders])

  useEffect(() => { loadWithdrawals(1) }, [statusFilter, loadWithdrawals])

  async function handleWithdrawalAction(transactionId: string, action: 'approve' | 'reject') {
    setActionLoading(transactionId)
    try {
      const res = await fetch(`/api/admin/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action, transactionId }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: data.message || (isAr ? 'تم التحديث بنجاح' : 'Updated successfully') })
        loadWithdrawals(pagination.page)
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setActionLoading(null)
    setTimeout(() => setToast(null), 3000)
  }

  const filters = [
    { key: '', label: isAr ? 'الكل' : 'All' },
    { key: 'PENDING', label: isAr ? 'معلق' : 'Pending' },
    { key: 'COMPLETED', label: isAr ? 'مكتمل' : 'Completed' },
    { key: 'REJECTED', label: isAr ? 'مرفوض' : 'Rejected' },
    { key: 'PROCESSING', label: isAr ? 'قيد المعالجة' : 'Processing' },
  ]

  const totalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0)
  const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={ArrowUpCircle}
        title={isAr ? 'إدارة السحوبات' : 'Manage Withdrawals'}
        subtitle={`${pagination.total} ${isAr ? 'سحب' : 'withdrawals'}`}
      />

      {/* Liquidity Overview */}
      {liquidity && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl p-4" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'رصيد المحفظة الحقيقي' : 'Real Wallet Balance'}</span>
            <div className="text-[#0ECB81] text-lg font-black mt-1" dir="ltr">{formatUSD(liquidity.realWalletBalance || 0)}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'صافي المركز' : 'Net Position'}</span>
            <div className="text-[#F0B90B] text-lg font-black mt-1" dir="ltr">{formatUSD(liquidity.netPosition || 0)}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'رأس المال المقفل' : 'Locked Capital'}</span>
            <div className="text-[#F6465D] text-lg font-black mt-1" dir="ltr">{formatUSD(liquidity.totalLockedCapital || 0)}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <span className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'قابل للسحب' : 'Withdrawable'}</span>
            <div className="text-[#2563EB] text-lg font-black mt-1" dir="ltr">{formatUSD(liquidity.totalWithdrawable || 0)}</div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(246,70,93,0.10)' }}>
              <DollarSign size={18} className="text-[#F6465D]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'إجمالي السحوبات' : 'Total Withdrawals'}</span>
          </div>
          <div className="text-[#F6465D] text-2xl font-black" dir="ltr">{formatUSD(totalAmount)}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)' }}>
              <Clock size={18} className="text-[#F59E0B]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'معلقة' : 'Pending'}</span>
          </div>
          <div className="text-[#F59E0B] text-2xl font-black">{pendingCount}</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)' }}>
              <BarChart3 size={18} className="text-[#2563EB]" />
            </div>
            <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'عدد السحوبات' : 'Total Count'}</span>
          </div>
          <div className="text-[#2563EB] text-2xl font-black">{pagination.total}</div>
        </div>
      </div>

      <FilterBar filters={filters} active={statusFilter} onChange={setStatusFilter} isAr={isAr} />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-[#F0B90B]" />
        </div>
      ) : withdrawals.length > 0 ? (
        <DataTable>
          <div className="grid grid-cols-12 gap-4 px-6 py-4" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'المستخدم' : 'User'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'المبلغ' : 'Amount'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'الحالة' : 'Status'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'الشبكة' : 'Network'}</div>
            <div className="col-span-1 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'التاريخ' : 'Date'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em] text-center">{isAr ? 'إجراء' : 'Action'}</div>
          </div>
          {withdrawals.map((wd, i) => (
            <motion.div
              key={wd.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors duration-150"
              style={{ borderBottom: '1px solid #1E1E2E' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div className="col-span-3 flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#F6465D] text-sm font-black shrink-0" style={{ background: 'rgba(246,70,93,0.10)' }}>
                  {(wd.user?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[#F0F0F0] text-[15px] font-bold truncate">{wd.user?.name || '-'}</div>
                  <div className="text-[#848E9C] text-[13px] font-medium truncate">{wd.user?.email || ''}</div>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[#F6465D] font-black text-[16px]" dir="ltr">{formatUSD(wd.amount)}</span>
              </div>
              <div className="col-span-2">
                <StatusBadge status={wd.status} isAr={isAr} />
                {wd.dynamicMessage && (
                  <div className="text-[#F59E0B] text-[11px] font-bold mt-1.5 leading-tight">{wd.dynamicMessage}</div>
                )}
                {wd.queueStage && (
                  <div className="text-[#848E9C] text-[10px] mt-1">{isAr ? 'المرحلة' : 'Stage'}: {wd.queueStage}</div>
                )}
              </div>
              <div className="col-span-2">
                {wd.cryptoNetwork ? (
                  <span className="text-[#CFD4DA] text-[14px] px-3 py-1.5 rounded-lg font-bold" style={{ background: 'rgba(255,255,255,0.04)' }}>{wd.cryptoNetwork}</span>
                ) : (
                  <span className="text-[#3B3B3B] text-[13px] font-bold">—</span>
                )}
              </div>
              <div className="col-span-1">
                <div className="text-[#CFD4DA] text-[13px] font-medium">{formatDateShort(wd.createdAt)}</div>
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2">
                {wd.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleWithdrawalAction(wd.id, 'approve')}
                      disabled={actionLoading === wd.id}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
                    >
                      {actionLoading === wd.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      {isAr ? 'قبول' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleWithdrawalAction(wd.id, 'reject')}
                      disabled={actionLoading === wd.id}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.15)' }}
                    >
                      <XCircle size={13} />
                      {isAr ? 'رفض' : 'Reject'}
                    </button>
                  </>
                ) : wd.status === 'PROCESSING' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleWithdrawalAction(wd.id, 'approve')}
                      disabled={actionLoading === wd.id}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
                    >
                      {actionLoading === wd.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      {isAr ? 'إتمام' : 'Complete'}
                    </button>
                    <button
                      onClick={() => handleWithdrawalAction(wd.id, 'reject')}
                      disabled={actionLoading === wd.id}
                      className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.15)' }}
                    >
                      <XCircle size={13} />
                      {isAr ? 'رفض' : 'Reject'}
                    </button>
                  </div>
                ) : (
                  <span className="text-[#3B3B3B] text-[13px] font-bold">—</span>
                )}
              </div>
            </motion.div>
          ))}
        </DataTable>
      ) : (
        <EmptyState icon={ArrowUpCircle} title={isAr ? 'لا توجد سحوبات' : 'No withdrawals found'} />
      )}
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={loadWithdrawals} isAr={isAr} />
    </div>
  )
}

// ─── Admin KYC ────────────────────────────────────────────────────
function AdminKYC({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [kycUsers, setKycUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadKYC = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?kycStatus=PENDING&limit=50`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setKycUsers(data.users || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [getAuthHeaders])

  useEffect(() => { loadKYC() }, [loadKYC])

  async function handleKYCAction(userId: string, action: 'approve' | 'reject', rejectCode?: string) {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          kycStatus: action === 'approve' ? 'VERIFIED' : 'REJECTED',
          ...(action === 'reject' && rejectCode ? { kycRejectCode: rejectCode } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم التحديث بنجاح' : 'Updated successfully' })
        loadKYC()
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setActionLoading(null)
    setTimeout(() => setToast(null), 3000)
  }

  const REJECT_REASONS = [
    { code: 'BLURRY', label: isAr ? 'صورة غير واضحة' : 'Blurry image' },
    { code: 'EXPIRED', label: isAr ? 'هوية منتهية' : 'Expired ID' },
    { code: 'MISMATCH', label: isAr ? 'عدم تطابق الاسم' : 'Name mismatch' },
    { code: 'INCOMPLETE', label: isAr ? 'مستند غير مكتمل' : 'Incomplete document' },
    { code: 'SELFIE_MISMATCH', label: isAr ? 'سيلفي غير متطابق' : 'Selfie mismatch' },
    { code: 'INVALID_DOC', label: isAr ? 'مستند غير صالح' : 'Invalid document' },
    { code: 'DUPLICATE', label: isAr ? 'مستند مكرر' : 'Duplicate document' },
  ]

  const docTypeLabels: Record<string, string> = {
    PASSPORT: isAr ? 'جواز سفر' : 'Passport',
    ID_CARD: isAr ? 'بطاقة هوية' : 'ID Card',
    DRIVER_LICENSE: isAr ? 'رخصة قيادة' : 'Driver License',
  }

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={UserCheck}
        title={isAr ? 'التحقق من الهوية' : 'KYC Verification'}
        subtitle={`${kycUsers.length} ${isAr ? 'طلب معلق' : 'pending requests'}`}
        actions={
          <button onClick={() => loadKYC()} className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[#F0B90B] text-[13px] font-bold transition-all duration-200"
            style={{ background: 'rgba(240,185,11,0.08)', border: '1px solid rgba(240,185,11,0.15)' }}>
            <RefreshCw size={15} />{isAr ? 'تحديث' : 'Refresh'}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={32} className="animate-spin text-[#F0B90B]" /></div>
      ) : kycUsers.length > 0 ? (
        <DataTable>
          <div className="grid grid-cols-12 gap-4 px-6 py-4" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'المستخدم' : 'User'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'نوع المستند' : 'Doc Type'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'رقم الهوية' : 'ID Number'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'الحالة' : 'Status'}</div>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em] text-center">{isAr ? 'إجراء' : 'Action'}</div>
          </div>
          {kycUsers.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors duration-150"
              style={{ borderBottom: '1px solid #1E1E2E' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div className="col-span-3 flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#F59E0B] text-sm font-black shrink-0" style={{ background: 'rgba(245,158,11,0.10)' }}>
                  {u.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-[#F0F0F0] text-[15px] font-bold truncate">{u.name}</div>
                  <div className="text-[#848E9C] text-[13px] font-medium truncate">{u.email}</div>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[#B7BDC6] text-[13px] font-bold">
                  {u.kycDocumentType ? (docTypeLabels[u.kycDocumentType] || u.kycDocumentType) : (isAr ? 'غير محدد' : 'N/A')}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[#B7BDC6] text-[14px] font-mono font-bold" dir="ltr">
                  {u.kycIdNumber ? `#${u.kycIdNumber}` : (isAr ? 'غير محدد' : 'N/A')}
                </span>
              </div>
              <div className="col-span-2">
                <StatusBadge status="PENDING" isAr={isAr} />
              </div>
              <div className="col-span-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => handleKYCAction(u.id, 'approve')}
                  disabled={actionLoading === u.id}
                  className="px-5 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                  style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
                >
                  {actionLoading === u.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                  {isAr ? 'قبول' : 'Approve'}
                </button>
                <div className="relative group">
                  <button
                    className="px-5 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-1.5"
                    style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.15)' }}
                  >
                    <XCircle size={13} />{isAr ? 'رفض' : 'Reject'}
                  </button>
                  <div className="absolute top-full mt-2 end-0 z-20 hidden group-hover:block rounded-2xl p-2 min-w-[220px] shadow-2xl"
                    style={{ background: '#1E2329', border: '1px solid #2B3139' }}>
                    {REJECT_REASONS.map((r) => (
                      <button key={r.code} onClick={() => handleKYCAction(u.id, 'reject', r.code)}
                        className="w-full text-right px-4 py-3 rounded-xl text-[#848E9C] text-[13px] font-medium hover:bg-[#2B3139] hover:text-[#F6465D] transition-all">
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </DataTable>
      ) : (
        <EmptyState icon={UserCheck} title={isAr ? 'لا يوجد طلبات تحقق معلقة' : 'No pending KYC requests'} />
      )}
    </div>
  )
}

// ─── Admin Packages ───────────────────────────────────────────────
function AdminPackages({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadPackages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/packages', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setPackages(data.packages || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [getAuthHeaders])

  useEffect(() => { loadPackages() }, [loadPackages])

  async function seedDefaults() {
    setSeeding(true)
    try {
      const res = await fetch('/api/packages/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم إنشاء الباقات الافتراضية' : 'Default packages created' })
        loadPackages()
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setSeeding(false)
    setTimeout(() => setToast(null), 3000)
  }

  function startEditing(pkg: any) {
    setEditingId(pkg.id)
    setEditForm({
      name: pkg.name,
      nameEn: pkg.nameEn,
      monthlyReturn: pkg.monthlyReturn || pkg.dailyReturn,
      durationDays: pkg.durationDays,
      minAmount: pkg.minAmount,
      maxAmount: pkg.maxAmount,
    })
  }

  async function savePackage() {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch('/api/packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: editingId, monthlyReturn: editForm.monthlyReturn, name: editForm.name, nameEn: editForm.nameEn, durationDays: editForm.durationDays, minAmount: editForm.minAmount, maxAmount: editForm.maxAmount }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم حفظ التعديلات' : 'Changes saved' })
        setEditingId(null)
        loadPackages()
      } else {
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setSaving(false)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={Box}
        title={isAr ? 'إدارة الباقات' : 'Manage Packages'}
        subtitle={`${packages.length} ${isAr ? 'باقة' : 'packages'}`}
        actions={
          <button onClick={seedDefaults} disabled={seeding}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[#0B0E11] text-[13px] font-black transition-all duration-200 disabled:opacity-40"
            style={{ background: '#F0B90B', boxShadow: '0 4px 12px rgba(240,185,11,0.25)' }}>
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Box size={15} />}
            {isAr ? 'إنشاء الباقات الافتراضية' : 'Seed Defaults'}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={32} className="animate-spin text-[#F0B90B]" /></div>
      ) : packages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {packages.map((pkg, i) => (
            <motion.div key={pkg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl overflow-hidden" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
              {editingId === pkg.id ? (
                <div className="p-6 space-y-4">
                  <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all" style={{ background: '#0B0E11', border: '1px solid #2B3139' }} placeholder={isAr ? 'الاسم' : 'Name'} />
                  <input value={editForm.nameEn || ''} onChange={e => setEditForm({ ...editForm, nameEn: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all" style={{ background: '#0B0E11', border: '1px solid #2B3139' }} placeholder="Name (EN)" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={editForm.monthlyReturn || ''} onChange={e => setEditForm({ ...editForm, monthlyReturn: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all" style={{ background: '#0B0E11', border: '1px solid #2B3139' }} placeholder={isAr ? 'العائد %' : 'Return %'} type="number" />
                    <input value={editForm.durationDays || ''} onChange={e => setEditForm({ ...editForm, durationDays: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all" style={{ background: '#0B0E11', border: '1px solid #2B3139' }} placeholder={isAr ? 'المدة' : 'Days'} type="number" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={editForm.minAmount || ''} onChange={e => setEditForm({ ...editForm, minAmount: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all" style={{ background: '#0B0E11', border: '1px solid #2B3139' }} placeholder={isAr ? 'الحد الأدنى' : 'Min $'} type="number" />
                    <input value={editForm.maxAmount || ''} onChange={e => setEditForm({ ...editForm, maxAmount: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all" style={{ background: '#0B0E11', border: '1px solid #2B3139' }} placeholder={isAr ? 'الحد الأقصى' : 'Max $'} type="number" />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={savePackage} disabled={saving}
                      className="flex-1 px-5 py-3 rounded-xl text-[#0B0E11] text-[13px] font-black transition-all disabled:opacity-40"
                      style={{ background: '#F0B90B' }}>
                      {saving ? <Loader2 size={15} className="animate-spin" /> : isAr ? 'حفظ' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-5 py-3 rounded-xl text-[#848E9C] text-[13px] font-bold transition-all"
                      style={{ background: '#1E2329', border: '1px solid #2B3139' }}>
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Package header */}
                  <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #2B3139' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(240,185,11,0.10)' }}>
                        <Box size={16} className="text-[#F0B90B]" />
                      </div>
                      <h3 className="text-[#EAECEF] font-black text-[16px]">{pkg.name}</h3>
                    </div>
                    <button onClick={() => startEditing(pkg)} className="p-2.5 rounded-xl text-[#5E6673] hover:text-[#F0B90B] transition-all hover:bg-[rgba(240,185,11,0.08)]">
                      <Cog size={15} />
                    </button>
                  </div>
                  {/* Package details */}
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'العائد اليومي' : 'Daily Return'}</span>
                      <span className="text-[#0ECB81] text-[16px] font-black">{pkg.monthlyReturn || pkg.dailyReturn}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'المدة' : 'Duration'}</span>
                      <span className="text-[#B7BDC6] text-[14px] font-bold">{pkg.durationDays} {isAr ? 'يوم' : 'days'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'الحد الأدنى' : 'Min Amount'}</span>
                      <span className="text-[#B7BDC6] text-[14px] font-bold">{formatUSD(pkg.minAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'الحد الأقصى' : 'Max Amount'}</span>
                      <span className="text-[#B7BDC6] text-[14px] font-bold">{pkg.maxAmount ? formatUSD(pkg.maxAmount) : (isAr ? 'بدون حد' : 'Unlimited')}</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 px-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2B3139' }}>
            <Box size={36} className="text-[#2B3139]" />
          </div>
          <h3 className="text-[#5E6673] font-bold text-lg mb-2">{isAr ? 'لا توجد باقات' : 'No packages found'}</h3>
          <p className="text-[#5E6673] text-sm mb-6">{isAr ? 'اضغط على زر إنشاء الباقات الافتراضية' : 'Click Seed Defaults to create packages'}</p>
          <button onClick={seedDefaults} disabled={seeding}
            className="px-8 py-3 rounded-xl text-[#0B0E11] text-sm font-black transition-all disabled:opacity-40"
            style={{ background: '#F0B90B', boxShadow: '0 4px 12px rgba(240,185,11,0.25)' }}>
            {seeding ? <Loader2 size={15} className="animate-spin" /> : isAr ? 'إنشاء الباقات' : 'Seed Packages'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Admin Notifications ──────────────────────────────────────────
function AdminNotifications({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [sentHistory, setSentHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setSentHistory(data.notifications || [])
      }
    } catch { /* ignore */ }
    setLoadingHistory(false)
  }, [getAuthHeaders])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function sendNotification() {
    if (!title || !message) {
      setToast({ type: 'error', message: isAr ? 'يرجى ملء العنوان والرسالة' : 'Fill title and message' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          broadcast: !targetUserId,
          userId: targetUserId || undefined,
          type: 'PLATFORM',
          title,
          message,
        }),
      })
      if (res.ok) {
        setToast({ type: 'success', message: isAr ? 'تم إرسال الإشعار' : 'Notification sent' })
        setTitle('')
        setMessage('')
        setTargetUserId('')
        loadHistory()
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || (isAr ? 'حدث خطأ' : 'Error') })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setSending(false)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={Send}
        title={isAr ? 'إرسال إشعارات' : 'Send Notifications'}
      />

      <div className="max-w-2xl mb-10">
        <div className="rounded-2xl p-8 space-y-6" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
          <div>
            <label className="block text-[#848E9C] text-[13px] font-bold mb-3">{isAr ? 'عنوان الإشعار' : 'Notification Title'}</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-5 py-3.5 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all"
              style={{ background: '#0B0E11', border: '1px solid #2B3139' }}
              placeholder={isAr ? 'أدخل عنوان الإشعار' : 'Enter notification title'} />
          </div>
          <div>
            <label className="block text-[#848E9C] text-[13px] font-bold mb-3">{isAr ? 'محتوى الإشعار' : 'Notification Body'}</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              className="w-full px-5 py-3.5 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all resize-none"
              style={{ background: '#0B0E11', border: '1px solid #2B3139' }}
              placeholder={isAr ? 'أدخل محتوى الإشعار' : 'Enter notification body'} />
          </div>
          <div>
            <label className="block text-[#848E9C] text-[13px] font-bold mb-3">{isAr ? 'معرف المستخدم (اختياري - اتركه فارغاً للإرسال للجميع)' : 'User ID (optional - leave empty for broadcast)'}</label>
            <input value={targetUserId} onChange={e => setTargetUserId(e.target.value)}
              className="w-full px-5 py-3.5 rounded-xl text-[#EAECEF] text-sm font-medium focus:outline-none transition-all"
              style={{ background: '#0B0E11', border: '1px solid #2B3139' }}
              placeholder={isAr ? 'معرف المستخدم أو اتركه فارغاً' : 'User ID or leave empty'} />
          </div>
          <button onClick={sendNotification} disabled={sending}
            className="w-full px-6 py-4 rounded-xl text-[#0B0E11] text-sm font-black transition-all disabled:opacity-40 flex items-center justify-center gap-2.5"
            style={{ background: '#F0B90B', boxShadow: '0 4px 12px rgba(240,185,11,0.25)' }}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {targetUserId ? (isAr ? 'إرسال لمستخدم' : 'Send to User') : (isAr ? 'إرسال للجميع' : 'Broadcast')}
          </button>
        </div>
      </div>

      {/* Sent History */}
      <SectionHeader
        icon={Activity}
        title={isAr ? 'سجل الإشعارات المرسلة' : 'Sent Notification History'}
        subtitle={`${sentHistory.length} ${isAr ? 'إشعار' : 'notifications'}`}
      />

      {loadingHistory ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#F0B90B]" />
        </div>
      ) : sentHistory.length > 0 ? (
        <DataTable>
          <div className="grid grid-cols-12 gap-4 px-6 py-4" style={{ background: '#1E2329', borderBottom: '1px solid #2B3139' }}>
            <div className="col-span-3 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'العنوان' : 'Title'}</div>
            <div className="col-span-4 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'الرسالة' : 'Message'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'المستخدم' : 'User'}</div>
            <div className="col-span-1 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'النوع' : 'Type'}</div>
            <div className="col-span-2 text-[#9CA3AF] text-[13px] font-black uppercase tracking-[0.1em]">{isAr ? 'التاريخ' : 'Date'}</div>
          </div>
          {sentHistory.slice(0, 20).map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors duration-150"
              style={{ borderBottom: '1px solid #1E1E2E' }}
            >
              <div className="col-span-3 text-[#EAECEF] text-[14px] font-bold truncate">{notif.title}</div>
              <div className="col-span-4 text-[#B7BDC6] text-[13px] font-medium truncate">{notif.message}</div>
              <div className="col-span-2 text-[#848E9C] text-[13px] truncate">{notif.user?.name || (isAr ? 'بث عام' : 'Broadcast')}</div>
              <div className="col-span-1">
                <span className="text-[12px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(240,185,11,0.10)', color: '#F0B90B' }}>{notif.type}</span>
              </div>
              <div className="col-span-2 text-[#CFD4DA] text-[13px] font-medium">{formatDateShort(notif.createdAt)}</div>
            </motion.div>
          ))}
        </DataTable>
      ) : (
        <EmptyState icon={Send} title={isAr ? 'لا توجد إشعارات مرسلة' : 'No sent notifications'} />
      )}
    </div>
  )
}

// ─── Admin Export ──────────────────────────────────────────────────
function AdminExport({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [exporting, setExporting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function exportData(type: string) {
    setExporting(type)
    try {
      const res = await fetch(`/api/admin/export?type=${type}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
        setToast({ type: 'success', message: isAr ? 'تم تصدير البيانات' : 'Data exported' })
      } else {
        setToast({ type: 'error', message: isAr ? 'فشل التصدير' : 'Export failed' })
      }
    } catch {
      setToast({ type: 'error', message: isAr ? 'خطأ في الاتصال' : 'Connection error' })
    }
    setExporting(null)
    setTimeout(() => setToast(null), 3000)
  }

  const exportOptions = [
    { type: 'users', label: isAr ? 'المستخدمين' : 'Users', icon: Users, color: '#F0B90B', desc: isAr ? 'تصدير بيانات المستخدمين' : 'Export user data' },
    { type: 'transactions', label: isAr ? 'المعاملات' : 'Transactions', icon: FileCheck, color: '#0ECB81', desc: isAr ? 'تصدير سجل المعاملات' : 'Export transaction history' },
    { type: 'investments', label: isAr ? 'الاستثمارات' : 'Investments', icon: Briefcase, color: '#2563EB', desc: isAr ? 'تصدير بيانات الاستثمارات' : 'Export investment data' },
    { type: 'kyc', label: isAr ? 'بيانات التحقق' : 'KYC Data', icon: UserCheck, color: '#8b5cf6', desc: isAr ? 'تصدير بيانات التحقق' : 'Export KYC data' },
  ]

  return (
    <div>
      {toast && <Toast type={toast.type} message={toast.message} />}
      <SectionHeader
        icon={DownloadCloud}
        title={isAr ? 'تصدير البيانات' : 'Export Data'}
        subtitle={isAr ? 'تصدير البيانات بتنسيق CSV' : 'Export data in CSV format'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {exportOptions.map((opt, i) => {
          const Icon = opt.icon
          return (
            <motion.div key={opt.type} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-6 transition-all duration-200"
              style={{ background: '#181A20', border: '1px solid #2B3139' }}>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: opt.color + '14', color: opt.color }}>
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="text-[#EAECEF] font-black text-[15px]">{opt.label}</h3>
                  <p className="text-[#6B7280] text-[12px] font-medium mt-0.5">{opt.desc}</p>
                </div>
              </div>
              <button onClick={() => exportData(opt.type)} disabled={exporting === opt.type}
                className="w-full px-5 py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'rgba(240,185,11,0.08)', color: '#F0B90B', border: '1px solid rgba(240,185,11,0.15)' }}>
                {exporting === opt.type ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
                {isAr ? 'تصدير CSV' : 'Export CSV'}
              </button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
