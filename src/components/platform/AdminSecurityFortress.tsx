'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Snowflake, Ban, AlertTriangle, Eye, Search, Users,
  RefreshCw, Loader2, CheckCircle, XCircle, Plus, Trash2,
  Unlock, Lock, Scan, Globe, Wifi, Server, UserX, Mail,
  MonitorSmartphone, Fingerprint, ChevronDown, ChevronUp,
  ShieldAlert, ShieldCheck, ShieldX, Activity, MapPin,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface FrozenAccount {
  id: string
  email: string
  name: string
  freezeReason: string | null
  frozenAt: string | null
  frozenUntil: string | null
  monitoringLevel: string
  redFlagCount: number
}

interface BlacklistEntry {
  id: string
  targetType: string
  targetValue: string
  reason: string
  source: string
  isPermanent: boolean
  expiresAt: string | null
  relatedUserId: string | null
  createdAt: string
}

interface RedFlag {
  id: string
  userId: string
  reason: string
  reasonCode: string
  ip: string | null
  details: string | null
  isRead: boolean
  source: string
  createdAt: string
}

interface VPNDetection {
  id: string
  userId: string
  ip: string
  isVPN: boolean
  isProxy: boolean
  isTor: boolean
  isp: string | null
  organization: string | null
  country: string | null
  city: string | null
  riskScore: number
  detectionMethod: string | null
  userAgent: string | null
  redFlagIssued: boolean
  createdAt: string
}

interface SameIPGroup {
  ip: string
  userIds: string[]
  users: { id: string; name: string; email: string; monitoringLevel: string; isActive: boolean }[]
}

interface AccountFreeze {
  id: string
  userId: string
  reason: string
  frozenBy: string | null
  frozenAt: string
  unfreezeAt: string
  status: string
  scanResult: string | null
  scanCompletedAt: string | null
  platformDamage: boolean
  damageDetails: string | null
  autoUnfroze: boolean
  escalatedToBan: boolean
}

interface DeepScanResult {
  riskScore: number
  platformDamage: boolean
  recommendation: string
  details: Record<string, any>
}

interface FortressData {
  frozenAccounts: FrozenAccount[]
  blacklistedUsers: any[]
  blacklistedIPs: BlacklistEntry[]
  blacklistedEmails: BlacklistEntry[]
  redFlags: RedFlag[]
  vpnDetections: VPNDetection[]
  activeScans: any[]
  recentFreezes: AccountFreeze[]
  sameIPGroups: SameIPGroup[]
}

// ═══════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════

function formatDate(dateStr: string | null, isAr: boolean) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(dateStr: string | null, isAr: boolean) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSeverityColor(reasonCode: string): string {
  const critical = ['TOR_DETECTED', 'ACCOUNT_BANNED', 'SAME_IP_ACCOUNTS']
  const high = ['VPN_DETECTED', 'PROXY_DETECTED', 'SUSPICIOUS_IP']
  const medium = ['ADMIN_FLAG', 'BEHAVIORAL_ANOMALY']
  if (critical.includes(reasonCode)) return '#F6465D'
  if (high.includes(reasonCode)) return '#F97316'
  if (medium.includes(reasonCode)) return '#F59E0B'
  return '#0ECB81'
}

function getRiskColor(score: number): string {
  if (score >= 60) return '#F6465D'
  if (score >= 30) return '#F97316'
  if (score >= 10) return '#F59E0B'
  return '#0ECB81'
}

function getMonitoringBadge(level: string, isAr: boolean) {
  const config: Record<string, { bg: string; color: string; labelAr: string; labelEn: string }> = {
    NORMAL: { bg: 'rgba(14,203,129,0.10)', color: '#0ECB81', labelAr: 'عادي', labelEn: 'Normal' },
    ELEVATED: { bg: 'rgba(245,158,11,0.10)', color: '#F59E0B', labelAr: 'مرتفع', labelEn: 'Elevated' },
    HIGH: { bg: 'rgba(246,70,93,0.10)', color: '#F6465D', labelAr: 'عالي', labelEn: 'High' },
  }
  const c = config[level] || config.NORMAL
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
      style={{ background: c.bg, color: c.color }}
    >
      {isAr ? c.labelAr : c.labelEn}
    </span>
  )
}

function getRecommendationBadge(rec: string, isAr: boolean) {
  const config: Record<string, { bg: string; color: string; labelAr: string; labelEn: string; icon: any }> = {
    UNFREEZE: { bg: 'rgba(14,203,129,0.10)', color: '#0ECB81', labelAr: 'فك التجميد', labelEn: 'Unfreeze', icon: Unlock },
    MONITOR: { bg: 'rgba(245,158,11,0.10)', color: '#F59E0B', labelAr: 'مراقبة', labelEn: 'Monitor', icon: Eye },
    BAN: { bg: 'rgba(246,70,93,0.10)', color: '#F6465D', labelAr: 'حظر', labelEn: 'Ban', icon: Ban },
  }
  const c = config[rec] || config.MONITOR
  const Icon = c.icon
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
      style={{ background: c.bg, color: c.color }}
    >
      <Icon size={12} />
      {isAr ? c.labelAr : c.labelEn}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export default function AdminSecurityFortress({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FortressData | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState('frozen')

  // Dialog states
  const [addBlacklistOpen, setAddBlacklistOpen] = useState(false)
  const [deepScanOpen, setDeepScanOpen] = useState(false)
  const [scanUserId, setScanUserId] = useState('')
  const [scanResult, setScanResult] = useState<DeepScanResult | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [blacklistType, setBlacklistType] = useState('ALL')
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([])
  const [blacklistLoading, setBlacklistLoading] = useState(false)

  // Add blacklist form
  const [newBLType, setNewBLType] = useState('USER')
  const [newBLValue, setNewBLValue] = useState('')
  const [newBLReason, setNewBLReason] = useState('')
  const [newBLPermanent, setNewBLPermanent] = useState(true)

  // Freeze dialog
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [freezeUserId, setFreezeUserId] = useState('')
  const [freezeReason, setFreezeReason] = useState('')

  // Red flag dialog
  const [redFlagDialogOpen, setRedFlagDialogOpen] = useState(false)
  const [redFlagUserId, setRedFlagUserId] = useState('')
  const [redFlagReason, setRedFlagReason] = useState('')
  const [redFlagCode, setRedFlagCode] = useState('ADMIN_FLAG')

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ═══════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════

  const loadFortressData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/security/fortress', { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      showToast('error', isAr ? 'فشل تحميل بيانات الحماية' : 'Failed to load security data')
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, showToast, isAr])

  const loadBlacklist = useCallback(async (type?: string) => {
    setBlacklistLoading(true)
    try {
      const url = type && type !== 'ALL'
        ? `/api/security/blacklist?type=${type}`
        : '/api/security/blacklist'
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setBlacklistEntries(d.entries || [])
      }
    } catch {
      showToast('error', isAr ? 'فشل تحميل القائمة السوداء' : 'Failed to load blacklist')
    } finally {
      setBlacklistLoading(false)
    }
  }, [getAuthHeaders, showToast, isAr])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/security/fortress', { headers: getAuthHeaders() })
        if (!cancelled && res.ok) {
          const d = await res.json()
          setData(d)
        }
      } catch {
        if (!cancelled) showToast('error', isAr ? 'فشل تحميل بيانات الحماية' : 'Failed to load security data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [getAuthHeaders, isAr, showToast])

  useEffect(() => {
    if (activeTab !== 'blacklist') return
    let cancelled = false
    ;(async () => {
      setBlacklistLoading(true)
      try {
        const url = blacklistType && blacklistType !== 'ALL'
          ? `/api/security/blacklist?type=${blacklistType}`
          : '/api/security/blacklist'
        const res = await fetch(url, { headers: getAuthHeaders() })
        if (!cancelled && res.ok) {
          const d = await res.json()
          setBlacklistEntries(d.entries || [])
        }
      } catch {
        if (!cancelled) showToast('error', isAr ? 'فشل تحميل القائمة السوداء' : 'Failed to load blacklist')
      } finally {
        if (!cancelled) setBlacklistLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeTab, blacklistType, getAuthHeaders, isAr, showToast])

  // ═══════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════

  async function handleFreezeAccount() {
    if (!freezeUserId || !freezeReason) return
    setActionLoading('freeze')
    try {
      const res = await fetch('/api/security/freeze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: freezeUserId, reason: freezeReason }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم تجميد الحساب بنجاح' : 'Account frozen successfully'))
        setFreezeDialogOpen(false)
        setFreezeUserId('')
        setFreezeReason('')
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل تجميد الحساب' : 'Failed to freeze account'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleUnfreeze(userId: string) {
    setActionLoading(`unfreeze-${userId}`)
    try {
      const res = await fetch('/api/security/freeze', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'unfreeze', userId }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم فك التجميد' : 'Account unfrozen'))
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل فك التجميد' : 'Failed to unfreeze'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBan(userId: string) {
    setActionLoading(`ban-${userId}`)
    try {
      const res = await fetch('/api/security/freeze', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'ban', userId }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم حظر الحساب' : 'Account banned'))
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل حظر الحساب' : 'Failed to ban account'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCompleteFreeze(freezeId: string) {
    setActionLoading(`complete-${freezeId}`)
    try {
      const res = await fetch('/api/security/freeze', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'complete', freezeId }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم معالجة التجميد' : 'Freeze processed'))
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل معالجة التجميد' : 'Failed to process freeze'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAddBlacklist() {
    if (!newBLType || !newBLValue || !newBLReason) return
    setActionLoading('add-blacklist')
    try {
      const res = await fetch('/api/security/blacklist', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          targetType: newBLType,
          targetValue: newBLValue,
          reason: newBLReason,
          isPermanent: newBLPermanent,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تمت الإضافة للقائمة السوداء' : 'Added to blacklist'))
        setAddBlacklistOpen(false)
        setNewBLValue('')
        setNewBLReason('')
        await loadBlacklist(blacklistType)
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشلت الإضافة' : 'Failed to add'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRemoveBlacklist(id: string) {
    setActionLoading(`rm-bl-${id}`)
    try {
      const res = await fetch(`/api/security/blacklist?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم الحذف من القائمة السوداء' : 'Removed from blacklist'))
        await loadBlacklist(blacklistType)
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل الحذف' : 'Failed to delete'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRemoveRedFlag(id: string) {
    setActionLoading(`rm-rf-${id}`)
    try {
      const res = await fetch(`/api/security/red-flag?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم حذف الإشارة الحمراء' : 'Red flag removed'))
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل حذف الإشارة' : 'Failed to remove flag'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleIssueRedFlag() {
    if (!redFlagUserId || !redFlagReason) return
    setActionLoading('issue-rf')
    try {
      const res = await fetch('/api/security/red-flag', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: redFlagUserId,
          reason: redFlagReason,
          reasonCode: redFlagCode,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', d.message || (isAr ? 'تم وضع إشارة حمراء' : 'Red flag issued'))
        setRedFlagDialogOpen(false)
        setRedFlagUserId('')
        setRedFlagReason('')
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل وضع الإشارة' : 'Failed to issue flag'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeepScan() {
    if (!scanUserId) return
    setScanLoading(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/security/scan', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: scanUserId }),
      })
      const d = await res.json()
      if (res.ok) {
        setScanResult(d)
        showToast('success', isAr ? 'تم إكمال الفحص العميق' : 'Deep scan completed')
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل الفحص' : 'Scan failed'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setScanLoading(false)
    }
  }

  async function handleAutoDetect() {
    setActionLoading('auto-detect')
    try {
      const res = await fetch('/api/security/auto-detect', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('success', isAr ? `تم اكتشاف ${d.detected || 0} حساب مشبوه` : `Detected ${d.detected || 0} suspicious accounts`)
        await loadFortressData()
      } else {
        showToast('error', d.error || (isAr ? 'فشل الكشف التلقائي' : 'Auto-detect failed'))
      }
    } catch {
      showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setActionLoading(null)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════

  const stats = [
    {
      label: isAr ? 'حسابات مجمدة' : 'Frozen Accounts',
      value: data?.frozenAccounts?.length || 0,
      icon: Snowflake,
      color: '#38BDF8',
      bg: 'rgba(56,189,248,0.08)',
    },
    {
      label: isAr ? 'إدخالات القائمة السوداء' : 'Blacklist Entries',
      value: (data?.blacklistedUsers?.length || 0) + (data?.blacklistedIPs?.length || 0) + (data?.blacklistedEmails?.length || 0),
      icon: Ban,
      color: '#F6465D',
      bg: 'rgba(246,70,93,0.08)',
    },
    {
      label: isAr ? 'إشارات حمراء (7 أيام)' : 'Red Flags (7 days)',
      value: data?.redFlags?.length || 0,
      icon: AlertTriangle,
      color: '#F97316',
      bg: 'rgba(249,115,22,0.08)',
    },
    {
      label: isAr ? 'كشف VPN (7 أيام)' : 'VPN Detections (7 days)',
      value: data?.vpnDetections?.length || 0,
      icon: Shield,
      color: '#c9a84c',
      bg: 'rgba(201,168,76,0.08)',
    },
    {
      label: isAr ? 'مجموعات نفس IP' : 'Same-IP Groups',
      value: data?.sameIPGroups?.length || 0,
      icon: Users,
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.08)',
    },
    {
      label: isAr ? 'فحوصات نشطة' : 'Active Scans',
      value: data?.activeScans?.length || 0,
      icon: Scan,
      color: '#0ECB81',
      bg: 'rgba(14,203,129,0.08)',
    },
  ]

  // ═══════════════════════════════════════════════════════════
  // Loading State
  // ═══════════════════════════════════════════════════════════

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-[#c9a84c]" />
          <p className="text-[#848E9C] text-sm font-bold">{isAr ? 'جاري تحميل لوحة الحماية...' : 'Loading security dashboard...'}</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black text-[#EAECEF] flex items-center gap-3">
            <Shield size={24} className="text-[#c9a84c]" />
            {isAr ? 'قلعة الحماية' : 'Security Fortress'}
          </h2>
          <p className="text-[#848E9C] text-sm mt-1">{isAr ? 'لوحة تحكم شاملة لأمن المنصة والحسابات' : 'Comprehensive platform & account security dashboard'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAutoDetect()}
            disabled={actionLoading === 'auto-detect'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
            style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
          >
            {actionLoading === 'auto-detect' ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />}
            {isAr ? 'كشف تلقائي' : 'Auto Detect'}
          </button>
          <button
            onClick={() => loadFortressData()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all"
            style={{ background: 'rgba(201,168,76,0.10)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.15)' }}
          >
            <RefreshCw size={14} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ─── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div
          className="flex items-center gap-3 px-5 py-3.5 rounded-xl text-[14px] font-bold"
          style={{
            background: toast.type === 'success' ? 'rgba(14,203,129,0.10)' : 'rgba(246,70,93,0.10)',
            border: toast.type === 'success' ? '1px solid rgba(14,203,129,0.20)' : '1px solid rgba(246,70,93,0.20)',
            color: toast.type === 'success' ? '#0ECB81' : '#F6465D',
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ─── Stats Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <div
              key={i}
              className="p-5 rounded-2xl transition-all duration-200 hover:scale-[1.02]"
              style={{ background: '#181A20', border: '1px solid #2B3139' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
              </div>
              <div className="text-[22px] font-black text-[#EAECEF]">{s.value}</div>
              <div className="text-[#848E9C] text-[12px] font-bold mt-1 truncate">{s.label}</div>
            </div>
          )
        })}
      </div>

      {/* ─── Tabs ───────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-2 bg-transparent h-auto p-0">
          {[
            { value: 'frozen', label: isAr ? 'الحسابات المجمدة' : 'Frozen Accounts', icon: Snowflake, color: '#38BDF8' },
            { value: 'blacklist', label: isAr ? 'القائمة السوداء' : 'Blacklist', icon: Ban, color: '#F6465D' },
            { value: 'redflags', label: isAr ? 'الإشارات الحمراء' : 'Red Flags', icon: AlertTriangle, color: '#F97316' },
            { value: 'vpn', label: isAr ? 'كشف VPN/Proxy' : 'VPN/Proxy Detection', icon: Shield, color: '#c9a84c' },
            { value: 'sameip', label: isAr ? 'حسابات نفس IP' : 'Same-IP Accounts', icon: Users, color: '#8B5CF6' },
            { value: 'scan', label: isAr ? 'الفحص العميق' : 'Deep Scan', icon: Search, color: '#0ECB81' },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all data-[state=active]:shadow-none"
                style={{
                  background: activeTab === tab.value ? `${tab.color}15` : '#181A20',
                  color: activeTab === tab.value ? tab.color : '#848E9C',
                  border: `1px solid ${activeTab === tab.value ? `${tab.color}25` : '#2B3139'}`,
                }}
              >
                <Icon size={15} />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* ═══════════════════════════════════════════════════════
            Tab 1: Frozen Accounts
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="frozen">
          <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                <Snowflake size={18} className="text-[#38BDF8]" />
                {isAr ? 'الحسابات المجمدة' : 'Frozen Accounts'}
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(56,189,248,0.10)', color: '#38BDF8' }}>
                  {data?.frozenAccounts?.length || 0}
                </span>
              </CardTitle>
              <button
                onClick={() => setFreezeDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                style={{ background: 'rgba(56,189,248,0.10)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.15)' }}
              >
                <Snowflake size={13} />
                {isAr ? 'تجميد حساب' : 'Freeze Account'}
              </button>
            </CardHeader>
            <CardContent>
              {!data?.frozenAccounts?.length ? (
                <div className="text-center py-12">
                  <Snowflake size={40} className="text-[#2B3139] mx-auto mb-3" />
                  <p className="text-[#5E6673] text-[14px] font-bold">{isAr ? 'لا توجد حسابات مجمدة حالياً' : 'No frozen accounts currently'}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {data.frozenAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-4 rounded-xl transition-all"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* User Info */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(56,189,248,0.10)' }}>
                            <Snowflake size={16} className="text-[#38BDF8]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[#EAECEF] text-[14px] font-bold">{account.name}</span>
                              {getMonitoringBadge(account.monitoringLevel, isAr)}
                            </div>
                            <div className="text-[#848E9C] text-[12px] mt-0.5" dir="ltr">{account.email}</div>
                            <div className="text-[#5E6673] text-[12px] mt-1">
                              {isAr ? 'السبب' : 'Reason'}: <span className="text-[#B7BDC6]">{account.freezeReason || '—'}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-[11px] text-[#5E6673]">
                              <span>{isAr ? 'تاريخ التجميد' : 'Frozen at'}: {formatShortDate(account.frozenAt, isAr)}</span>
                              <span>{isAr ? 'فك في' : 'Unfreeze at'}: {formatShortDate(account.frozenUntil, isAr)}</span>
                              <span className="text-[#F97316]">{isAr ? 'إشارات' : 'Flags'}: {account.redFlagCount}/3</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Find the active freeze for this user */}
                          {data.recentFreezes
                            ?.filter(f => f.userId === account.id && f.status === 'ACTIVE')
                            .map(freeze => (
                              <button
                                key={freeze.id}
                                onClick={() => handleCompleteFreeze(freeze.id)}
                                disabled={actionLoading === `complete-${freeze.id}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                                style={{ background: 'rgba(201,168,76,0.10)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.15)' }}
                              >
                                {actionLoading === `complete-${freeze.id}` ? <Loader2 size={11} className="animate-spin" /> : <Scan size={11} />}
                                {isAr ? 'معالجة' : 'Process'}
                              </button>
                            ))
                          }
                          <button
                            onClick={() => handleUnfreeze(account.id)}
                            disabled={actionLoading === `unfreeze-${account.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
                          >
                            {actionLoading === `unfreeze-${account.id}` ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
                            {isAr ? 'فك التجميد' : 'Unfreeze'}
                          </button>
                          <button
                            onClick={() => handleBan(account.id)}
                            disabled={actionLoading === `ban-${account.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.15)' }}
                          >
                            {actionLoading === `ban-${account.id}` ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
                            {isAr ? 'حظر' : 'Ban'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Freezes History */}
          {data?.recentFreezes && data.recentFreezes.length > 0 && (
            <Card className="mt-4" style={{ background: '#181A20', border: '1px solid #2B3139' }}>
              <CardHeader className="pb-4">
                <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                  <Activity size={18} className="text-[#848E9C]" />
                  {isAr ? 'سجل التجميدات الأخيرة' : 'Recent Freeze History'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {data.recentFreezes.map((freeze) => {
                    const statusConfig: Record<string, { bg: string; color: string; labelAr: string; labelEn: string }> = {
                      ACTIVE: { bg: 'rgba(56,189,248,0.10)', color: '#38BDF8', labelAr: 'نشط', labelEn: 'Active' },
                      COMPLETED: { bg: 'rgba(14,203,129,0.10)', color: '#0ECB81', labelAr: 'مكتمل', labelEn: 'Completed' },
                      ESCALATED_TO_BAN: { bg: 'rgba(246,70,93,0.10)', color: '#F6465D', labelAr: 'تم الحظر', labelEn: 'Banned' },
                    }
                    const sc = statusConfig[freeze.status] || statusConfig.ACTIVE
                    return (
                      <div
                        key={freeze.id}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: sc.bg, color: sc.color }}>
                            {isAr ? sc.labelAr : sc.labelEn}
                          </span>
                          <span className="text-[#B7BDC6] text-[13px] truncate">{freeze.reason}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {freeze.platformDamage && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D' }}>
                              {isAr ? 'ضرر' : 'Damage'}
                            </span>
                          )}
                          <span className="text-[#5E6673] text-[11px]">{formatShortDate(freeze.frozenAt, isAr)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab 2: Blacklist
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="blacklist">
          <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                <Ban size={18} className="text-[#F6465D]" />
                {isAr ? 'القائمة السوداء' : 'Blacklist'}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={blacklistType} onValueChange={setBlacklistType}>
                  <SelectTrigger className="w-[140px] h-9 text-[12px] rounded-lg" style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#181A20', border: '1px solid #2B3139' }}>
                    <SelectItem value="ALL" style={{ color: '#EAECEF' }}>{isAr ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem value="USER" style={{ color: '#EAECEF' }}>{isAr ? 'مستخدمين' : 'Users'}</SelectItem>
                    <SelectItem value="IP" style={{ color: '#EAECEF' }}>{isAr ? 'عناوين IP' : 'IP Addresses'}</SelectItem>
                    <SelectItem value="EMAIL" style={{ color: '#EAECEF' }}>{isAr ? 'بريد إلكتروني' : 'Email'}</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setAddBlacklistOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                  style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.15)' }}
                >
                  <Plus size={13} />
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {blacklistLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#F6465D]" />
                </div>
              ) : !blacklistEntries?.length ? (
                <div className="text-center py-12">
                  <Ban size={40} className="text-[#2B3139] mx-auto mb-3" />
                  <p className="text-[#5E6673] text-[14px] font-bold">{isAr ? 'لا توجد إدخالات في القائمة السوداء' : 'No blacklist entries'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {blacklistEntries.map((entry) => {
                    const typeConfig: Record<string, { icon: any; color: string; labelAr: string; labelEn: string }> = {
                      USER: { icon: UserX, color: '#F6465D', labelAr: 'مستخدم', labelEn: 'User' },
                      IP: { icon: Globe, color: '#F97316', labelAr: 'IP', labelEn: 'IP' },
                      EMAIL: { icon: Mail, color: '#38BDF8', labelAr: 'بريد', labelEn: 'Email' },
                    }
                    const tc = typeConfig[entry.targetType] || typeConfig.USER
                    const TypeIcon = tc.icon
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tc.color}10` }}>
                            <TypeIcon size={14} style={{ color: tc.color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${tc.color}10`, color: tc.color }}>
                                {isAr ? tc.labelAr : tc.labelEn}
                              </span>
                              <span className="text-[#EAECEF] text-[13px] font-bold truncate" dir="ltr">{entry.targetValue}</span>
                              {entry.isPermanent && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D' }}>
                                  {isAr ? 'دائم' : 'Permanent'}
                                </span>
                              )}
                            </div>
                            <div className="text-[#5E6673] text-[11px] mt-0.5">
                              {isAr ? 'السبب' : 'Reason'}: <span className="text-[#848E9C]">{entry.reason}</span>
                              <span className="mx-2">•</span>
                              {isAr ? 'المصدر' : 'Source'}: <span className="text-[#848E9C]">{entry.source}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[#5E6673] text-[11px]">{formatShortDate(entry.createdAt, isAr)}</span>
                          <button
                            onClick={() => handleRemoveBlacklist(entry.id)}
                            disabled={actionLoading === `rm-bl-${entry.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                            style={{ background: 'rgba(246,70,93,0.08)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.12)' }}
                          >
                            {actionLoading === `rm-bl-${entry.id}` ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            {isAr ? 'حذف' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab 3: Red Flags
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="redflags">
          <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-[#F97316]" />
                {isAr ? 'الإشارات الحمراء' : 'Red Flags'}
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(249,115,22,0.10)', color: '#F97316' }}>
                  {data?.redFlags?.length || 0}
                </span>
              </CardTitle>
              <button
                onClick={() => setRedFlagDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                style={{ background: 'rgba(249,115,22,0.10)', color: '#F97316', border: '1px solid rgba(249,115,22,0.15)' }}
              >
                <AlertTriangle size={13} />
                {isAr ? 'وضع إشارة' : 'Issue Flag'}
              </button>
            </CardHeader>
            <CardContent>
              {!data?.redFlags?.length ? (
                <div className="text-center py-12">
                  <AlertTriangle size={40} className="text-[#2B3139] mx-auto mb-3" />
                  <p className="text-[#5E6673] text-[14px] font-bold">{isAr ? 'لا توجد إشارات حمراء حديثة' : 'No recent red flags'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {/* Group by userId to show total flags */}
                  {(() => {
                    const flagCounts: Record<string, number> = {}
                    data.redFlags.forEach(f => {
                      flagCounts[f.userId] = (flagCounts[f.userId] || 0) + 1
                    })
                    return data.redFlags.map((flag) => {
                      const severityColor = getSeverityColor(flag.reasonCode)
                      return (
                        <div
                          key={flag.id}
                          className="p-3.5 rounded-xl transition-all"
                          style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${severityColor}15`,
                            borderRightWidth: '3px',
                            borderRightColor: severityColor,
                          }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${severityColor}10` }}>
                                <AlertTriangle size={14} style={{ color: severityColor }} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[#EAECEF] text-[13px] font-bold">{flag.reason}</span>
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: `${severityColor}10`, color: severityColor }}
                                  >
                                    {flag.reasonCode}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-[#5E6673]">
                                  <span>{isAr ? 'المستخدم' : 'User'}: <span className="text-[#848E9C]" dir="ltr">{flag.userId.slice(0, 12)}...</span></span>
                                  {flag.ip && <span>IP: <span className="text-[#848E9C]" dir="ltr">{flag.ip}</span></span>}
                                  <span>{isAr ? 'المصدر' : 'Source'}: <span className="text-[#848E9C]">{flag.source}</span></span>
                                  <span className="text-[#F97316]">{isAr ? 'الإجمالي' : 'Total'}: {flagCounts[flag.userId] || 1}/3</span>
                                </div>
                                <span className="text-[#5E6673] text-[11px]">{formatShortDate(flag.createdAt, isAr)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveRedFlag(flag.id)}
                              disabled={actionLoading === `rm-rf-${flag.id}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 shrink-0"
                              style={{ background: 'rgba(14,203,129,0.08)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.12)' }}
                            >
                              {actionLoading === `rm-rf-${flag.id}` ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              {isAr ? 'إيجابي كاذب' : 'False Positive'}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab 4: VPN/Proxy Detection
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="vpn">
          <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                <Shield size={18} className="text-[#c9a84c]" />
                {isAr ? 'كشف VPN/Proxy' : 'VPN/Proxy Detection'}
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(201,168,76,0.10)', color: '#c9a84c' }}>
                  {data?.vpnDetections?.length || 0}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.vpnDetections?.length ? (
                <div className="text-center py-12">
                  <Shield size={40} className="text-[#2B3139] mx-auto mb-3" />
                  <p className="text-[#5E6673] text-[14px] font-bold">{isAr ? 'لا توجد عمليات كشف VPN حديثة' : 'No recent VPN detections'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {data.vpnDetections.map((det) => {
                    const isThreat = det.isVPN || det.isProxy || det.isTor
                    return (
                      <div
                        key={det.id}
                        className="p-3.5 rounded-xl transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isThreat ? 'rgba(246,70,93,0.15)' : 'rgba(14,203,129,0.15)'}`,
                        }}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: isThreat ? 'rgba(246,70,93,0.10)' : 'rgba(14,203,129,0.10)' }}>
                              {det.isTor ? <ShieldAlert size={14} className="text-[#F6465D]" /> :
                               det.isVPN ? <ShieldX size={14} className="text-[#F97316]" /> :
                               det.isProxy ? <ShieldAlert size={14} className="text-[#F59E0B]" /> :
                               <ShieldCheck size={14} className="text-[#0ECB81]" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[#EAECEF] text-[13px] font-bold" dir="ltr">{det.ip}</span>
                                {det.isVPN && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.10)', color: '#F97316' }}>VPN</span>
                                )}
                                {det.isProxy && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.10)', color: '#F59E0B' }}>Proxy</span>
                                )}
                                {det.isTor && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D' }}>Tor</span>
                                )}
                                {det.redFlagIssued && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(246,70,93,0.10)', color: '#F6465D' }}>{isAr ? 'تم وضع إشارة' : 'Flag issued'}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-[#5E6673]">
                                {det.isp && <span>ISP: <span className="text-[#848E9C]">{det.isp}</span></span>}
                                {det.organization && <span>{isAr ? 'المنظمة' : 'Org'}: <span className="text-[#848E9C]">{det.organization}</span></span>}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#5E6673]">
                                {det.country && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={9} />
                                    {det.country}{det.city ? (isAr ? `، ${det.city}` : `, ${det.city}`) : ''}
                                  </span>
                                )}
                                <span>{isAr ? 'المستخدم' : 'User'}: <span className="text-[#848E9C]" dir="ltr">{det.userId.slice(0, 12)}...</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Risk Score */}
                            <div className="flex items-center gap-2">
                              <div className="text-left w-10" dir="ltr">
                                <div className="text-[14px] font-black" style={{ color: getRiskColor(det.riskScore) }}>{det.riskScore}%</div>
                              </div>
                              <div className="w-16 h-2 rounded-full" style={{ background: '#1E2329' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${det.riskScore}%`, background: getRiskColor(det.riskScore) }}
                                />
                              </div>
                            </div>
                            <span className="text-[#5E6673] text-[11px]">{formatShortDate(det.createdAt, isAr)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab 5: Same-IP Accounts
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="sameip">
          <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                <Users size={18} className="text-[#8B5CF6]" />
                {isAr ? 'حسابات نفس عنوان IP' : 'Same-IP Accounts'}
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.10)', color: '#8B5CF6' }}>
                  {data?.sameIPGroups?.length || 0}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.sameIPGroups?.length ? (
                <div className="text-center py-12">
                  <Users size={40} className="text-[#2B3139] mx-auto mb-3" />
                  <p className="text-[#5E6673] text-[14px] font-bold">{isAr ? 'لا توجد مجموعات IP مشتركة' : 'No shared IP groups'}</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {data.sameIPGroups.map((group, idx) => (
                    <div
                      key={group.ip || idx}
                      className="p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}
                    >
                      {/* IP Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.10)' }}>
                            <Globe size={16} className="text-[#8B5CF6]" />
                          </div>
                          <div>
                            <span className="text-[#EAECEF] text-[15px] font-black" dir="ltr">{group.ip}</span>
                            <div className="text-[11px] text-[#5E6673]">
                              {group.userIds?.length || 0} {isAr ? 'حسابات مشتركة' : 'shared accounts'}
                            </div>
                          </div>
                        </div>
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          style={{
                            background: (group.userIds?.length || 0) >= 3 ? 'rgba(246,70,93,0.10)' : 'rgba(245,158,11,0.10)',
                            color: (group.userIds?.length || 0) >= 3 ? '#F6465D' : '#F59E0B',
                          }}
                        >
                          {(group.userIds?.length || 0) >= 3 ? (isAr ? 'خطر عالي' : 'High Risk') : (isAr ? 'مشبوه' : 'Suspicious')}
                        </span>
                      </div>

                      {/* Users List */}
                      {group.users && group.users.length > 0 ? (
                        <div className="space-y-2">
                          {group.users.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-2.5 rounded-lg"
                              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1A1A2E' }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(139,92,246,0.10)', color: '#8B5CF6' }}>
                                  {user.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <span className="text-[#B7BDC6] text-[12px] font-bold">{user.name}</span>
                                  <span className="text-[#5E6673] text-[11px] mr-2" dir="ltr">{user.email}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getMonitoringBadge(user.monitoringLevel, isAr)}
                                <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-[#0ECB81]' : 'bg-[#F6465D]'}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#5E6673]">
                          {isAr ? 'معرفات المستخدمين' : 'User IDs'}: {group.userIds?.map(id => id.slice(0, 10) + '...').join(isAr ? '، ' : ', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            Tab 6: Deep Scan
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="scan">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scan Input */}
            <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
              <CardHeader className="pb-4">
                <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                  <Search size={18} className="text-[#0ECB81]" />
                  {isAr ? 'فحص عميق للحساب' : 'Deep Account Scan'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'معرف المستخدم (User ID)' : 'User ID'}</label>
                  <Input
                    value={scanUserId}
                    onChange={(e) => setScanUserId(e.target.value)}
                    placeholder={isAr ? 'أدخل معرف المستخدم...' : 'Enter user ID...'}
                    className="h-11 text-[13px] rounded-xl"
                    style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleDeepScan}
                  disabled={!scanUserId || scanLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(14,203,129,0.10)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.15)' }}
                >
                  {scanLoading ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
                  {isAr ? 'بدء الفحص العميق' : 'Start Deep Scan'}
                </button>

                {/* Active Scans */}
                {data?.activeScans && data.activeScans.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-[#848E9C] text-[12px] font-bold mb-2">{isAr ? 'فحوصات جارية' : 'Active Scans'}</h4>
                    <div className="space-y-2">
                      {data.activeScans.map((scan: any) => (
                        <div key={scan.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(14,203,129,0.05)', border: '1px solid rgba(14,203,129,0.10)' }}>
                          <Loader2 size={12} className="animate-spin text-[#0ECB81]" />
                          <span className="text-[#B7BDC6] text-[12px]" dir="ltr">{scan.userId.slice(0, 15)}...</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.10)', color: '#F59E0B' }}>
                            {scan.scanType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scan Results */}
            <Card style={{ background: '#181A20', border: '1px solid #2B3139' }}>
              <CardHeader className="pb-4">
                <CardTitle className="text-[#EAECEF] text-[16px] font-black flex items-center gap-2.5">
                  <Fingerprint size={18} className="text-[#c9a84c]" />
                  {isAr ? 'نتائج الفحص' : 'Scan Results'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scanLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 size={32} className="animate-spin text-[#c9a84c]" />
                    <p className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'جاري الفحص العميق...' : 'Running deep scan...'}</p>
                    <p className="text-[#5E6673] text-[11px]">{isAr ? 'يتم تحليل المعاملات والأرصدة وعناوين IP وسجل VPN' : 'Analyzing transactions, balances, IP addresses, and VPN history'}</p>
                  </div>
                ) : scanResult ? (
                  <div className="space-y-4">
                    {/* Risk Score */}
                    <div className="p-5 rounded-xl text-center" style={{
                      background: `${getRiskColor(scanResult.riskScore)}08`,
                      border: `1px solid ${getRiskColor(scanResult.riskScore)}15`,
                    }}>
                      <div className="text-[36px] font-black" style={{ color: getRiskColor(scanResult.riskScore) }}>
                        {scanResult.riskScore}%
                      </div>
                      <div className="text-[#848E9C] text-[13px] font-bold mt-1">{isAr ? 'درجة المخاطر' : 'Risk Score'}</div>
                      <div className="w-full h-3 rounded-full mt-3" style={{ background: '#1E2329' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${scanResult.riskScore}%`, background: getRiskColor(scanResult.riskScore) }}
                        />
                      </div>
                    </div>

                    {/* Recommendation & Damage */}
                    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}>
                      <div>
                        <div className="text-[#848E9C] text-[11px] font-bold">{isAr ? 'التوصية' : 'Recommendation'}</div>
                        {getRecommendationBadge(scanResult.recommendation, isAr)}
                      </div>
                      <div className="text-left">
                        <div className="text-[#848E9C] text-[11px] font-bold">{isAr ? 'ضرر بالمنصة' : 'Platform Damage'}</div>
                        <span className={`text-[14px] font-black ${scanResult.platformDamage ? 'text-[#F6465D]' : 'text-[#0ECB81]'}`}>
                          {scanResult.platformDamage ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}
                        </span>
                      </div>
                    </div>

                    {/* Scan Details */}
                    {scanResult.details && (
                      <div className="space-y-2">
                        <h4 className="text-[#848E9C] text-[12px] font-bold">{isAr ? 'تفاصيل الفحص' : 'Scan Details'}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(scanResult.details).map(([key, value]) => {
                            if (typeof value === 'object') return null
                            const labelMapAr: Record<string, string> = {
                              totalTransactions: 'إجمالي المعاملات',
                              suspiciousTxCount: 'معاملات مشبوهة',
                              largeDeposits: 'إيداعات كبيرة',
                              pendingDeposits: 'إيداعات معلقة',
                              failedDeposits: 'إيداعات فاشلة',
                              balanceDiscrepancy: 'تناقض الرصيد',
                              currentBalance: 'الرصيد الحالي',
                              expectedBalance: 'الرصيد المتوقع',
                              uniqueIPCount: 'عناوين IP فريدة',
                              vpnLoginCount: 'تسجيلات VPN',
                              sameIPAccountCount: 'حسابات نفس IP',
                              vpnUsageCount: 'استخدام VPN',
                              referralFraudScore: 'درجة احتيال الإحالة',
                              redFlagCount: 'عدد الإشارات',
                              highSeverityEvents: 'أحداث عالية الخطورة',
                            }
                            const labelMapEn: Record<string, string> = {
                              totalTransactions: 'Total Transactions',
                              suspiciousTxCount: 'Suspicious Transactions',
                              largeDeposits: 'Large Deposits',
                              pendingDeposits: 'Pending Deposits',
                              failedDeposits: 'Failed Deposits',
                              balanceDiscrepancy: 'Balance Discrepancy',
                              currentBalance: 'Current Balance',
                              expectedBalance: 'Expected Balance',
                              uniqueIPCount: 'Unique IPs',
                              vpnLoginCount: 'VPN Logins',
                              sameIPAccountCount: 'Same-IP Accounts',
                              vpnUsageCount: 'VPN Usage',
                              referralFraudScore: 'Referral Fraud Score',
                              redFlagCount: 'Flag Count',
                              highSeverityEvents: 'High Severity Events',
                            }
                            const label = isAr ? (labelMapAr[key] || key) : (labelMapEn[key] || key)
                            const isAnomaly = key === 'balanceAnomaly' && value === true
                            return (
                              <div
                                key={key}
                                className="p-2.5 rounded-lg"
                                style={{
                                  background: isAnomaly ? 'rgba(246,70,93,0.05)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${isAnomaly ? 'rgba(246,70,93,0.10)' : '#1E1E2E'}`,
                                }}
                              >
                                <div className="text-[#5E6673] text-[10px] font-bold">{label}</div>
                                <div className={`text-[14px] font-black ${isAnomaly ? 'text-[#F6465D]' : 'text-[#EAECEF]'}`} dir="ltr">
                                  {typeof value === 'number'
                                    ? key.includes('Balance') || key.includes('Discrepancy')
                                      ? `$${Number(value).toFixed(2)}`
                                      : String(value)
                                    : String(value)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Fingerprint size={40} className="text-[#2B3139] mx-auto mb-3" />
                    <p className="text-[#5E6673] text-[14px] font-bold">{isAr ? 'أدخل معرف المستخدم وابدأ الفحص' : 'Enter user ID and start scanning'}</p>
                    <p className="text-[#5E6673] text-[11px] mt-1">{isAr ? 'سيتم تحليل المعاملات والأرصدة وسجل الدخول و VPN والإحالات' : 'Transactions, balances, login history, VPN, and referrals will be analyzed'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════
          Dialogs
          ═══════════════════════════════════════════════════════ */}

      {/* Freeze Account Dialog */}
      <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
        <DialogContent style={{ background: '#181A20', border: '1px solid #2B3139' }} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#EAECEF] text-[18px] font-black flex items-center gap-2">
              <Snowflake size={20} className="text-[#38BDF8]" />
              {isAr ? 'تجميد حساب' : 'Freeze Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'معرف المستخدم' : 'User ID'}</label>
              <Input
                value={freezeUserId}
                onChange={(e) => setFreezeUserId(e.target.value)}
                placeholder={isAr ? 'أدخل معرف المستخدم...' : 'Enter user ID...'}
                className="h-11 text-[13px] rounded-xl"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'سبب التجميد' : 'Freeze Reason'}</label>
              <Input
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder={isAr ? 'أدخل سبب التجميد...' : 'Enter freeze reason...'}
                className="h-11 text-[13px] rounded-xl"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
              />
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.10)' }}>
              <p className="text-[#38BDF8] text-[12px] font-bold">
                {isAr ? 'سيتم تجميد الحساب لمدة 3 أيام مع إجراء فحص عميق تلقائي' : 'Account will be frozen for 3 days with automatic deep scan'}
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="ghost"
              onClick={() => setFreezeDialogOpen(false)}
              className="text-[#848E9C] hover:text-[#EAECEF]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleFreezeAccount}
              disabled={!freezeUserId || !freezeReason || actionLoading === 'freeze'}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.20)' }}
            >
              {actionLoading === 'freeze' ? <Loader2 size={14} className="animate-spin" /> : <Snowflake size={14} />}
              {isAr ? 'تجميد لمدة 3 أيام' : 'Freeze for 3 days'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Blacklist Dialog */}
      <Dialog open={addBlacklistOpen} onOpenChange={setAddBlacklistOpen}>
        <DialogContent style={{ background: '#181A20', border: '1px solid #2B3139' }} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#EAECEF] text-[18px] font-black flex items-center gap-2">
              <Ban size={20} className="text-[#F6465D]" />
              {isAr ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'نوع الهدف' : 'Target Type'}</label>
              <Select value={newBLType} onValueChange={setNewBLType}>
                <SelectTrigger className="h-11 text-[13px] rounded-xl" style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: '#181A20', border: '1px solid #2B3139' }}>
                  <SelectItem value="USER" style={{ color: '#EAECEF' }}>{isAr ? 'مستخدم (User ID)' : 'User (User ID)'}</SelectItem>
                  <SelectItem value="IP" style={{ color: '#EAECEF' }}>{isAr ? 'عنوان IP' : 'IP Address'}</SelectItem>
                  <SelectItem value="EMAIL" style={{ color: '#EAECEF' }}>{isAr ? 'بريد إلكتروني' : 'Email Address'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">
                {newBLType === 'USER' ? (isAr ? 'معرف المستخدم' : 'User ID') : newBLType === 'IP' ? (isAr ? 'عنوان IP' : 'IP Address') : (isAr ? 'البريد الإلكتروني' : 'Email Address')}
              </label>
              <Input
                value={newBLValue}
                onChange={(e) => setNewBLValue(e.target.value)}
                placeholder={
                  newBLType === 'USER' ? (isAr ? 'أدخل معرف المستخدم...' : 'Enter user ID...') :
                  newBLType === 'IP' ? (isAr ? 'أدخل عنوان IP...' : 'Enter IP address...') :
                  (isAr ? 'أدخل البريد الإلكتروني...' : 'Enter email address...')
                }
                className="h-11 text-[13px] rounded-xl"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'السبب' : 'Reason'}</label>
              <Input
                value={newBLReason}
                onChange={(e) => setNewBLReason(e.target.value)}
                placeholder={isAr ? 'أدخل سبب الإضافة...' : 'Enter reason...'}
                className="h-11 text-[13px] rounded-xl"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1E1E2E' }}>
              <span className="text-[#848E9C] text-[13px] font-bold">{isAr ? 'حظر دائم' : 'Permanent Ban'}</span>
              <button
                onClick={() => setNewBLPermanent(!newBLPermanent)}
                className="w-12 h-6 rounded-full transition-all flex items-center px-0.5"
                style={{ background: newBLPermanent ? '#c9a84c' : '#2B3139' }}
              >
                <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: newBLPermanent ? 'translateX(0px)' : 'translateX(24px)' }} />
              </button>
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="ghost"
              onClick={() => setAddBlacklistOpen(false)}
              className="text-[#848E9C] hover:text-[#EAECEF]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleAddBlacklist}
              disabled={!newBLValue || !newBLReason || actionLoading === 'add-blacklist'}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: 'rgba(246,70,93,0.15)', color: '#F6465D', border: '1px solid rgba(246,70,93,0.20)' }}
            >
              {actionLoading === 'add-blacklist' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isAr ? 'إضافة للقائمة' : 'Add to List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Red Flag Dialog */}
      <Dialog open={redFlagDialogOpen} onOpenChange={setRedFlagDialogOpen}>
        <DialogContent style={{ background: '#181A20', border: '1px solid #2B3139' }} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#EAECEF] text-[18px] font-black flex items-center gap-2">
              <AlertTriangle size={20} className="text-[#F97316]" />
              {isAr ? 'وضع إشارة حمراء' : 'Issue Red Flag'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'معرف المستخدم' : 'User ID'}</label>
              <Input
                value={redFlagUserId}
                onChange={(e) => setRedFlagUserId(e.target.value)}
                placeholder={isAr ? 'أدخل معرف المستخدم...' : 'Enter user ID...'}
                className="h-11 text-[13px] rounded-xl"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'رمز السبب' : 'Reason Code'}</label>
              <Select value={redFlagCode} onValueChange={setRedFlagCode}>
                <SelectTrigger className="h-11 text-[13px] rounded-xl" style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: '#181A20', border: '1px solid #2B3139' }}>
                  <SelectItem value="ADMIN_FLAG" style={{ color: '#EAECEF' }}>{isAr ? 'إشارة يدوية من المشرف' : 'Manual Admin Flag'}</SelectItem>
                  <SelectItem value="VPN_DETECTED" style={{ color: '#EAECEF' }}>{isAr ? 'كشف VPN' : 'VPN Detected'}</SelectItem>
                  <SelectItem value="PROXY_DETECTED" style={{ color: '#EAECEF' }}>{isAr ? 'كشف بروكسي' : 'Proxy Detected'}</SelectItem>
                  <SelectItem value="TOR_DETECTED" style={{ color: '#EAECEF' }}>{isAr ? 'كشف Tor' : 'Tor Detected'}</SelectItem>
                  <SelectItem value="SAME_IP_ACCOUNTS" style={{ color: '#EAECEF' }}>{isAr ? 'حسابات نفس IP' : 'Same-IP Accounts'}</SelectItem>
                  <SelectItem value="SUSPICIOUS_IP" style={{ color: '#EAECEF' }}>{isAr ? 'IP مشبوه' : 'Suspicious IP'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[#848E9C] text-[12px] font-bold mb-2 block">{isAr ? 'السبب التفصيلي' : 'Detailed Reason'}</label>
              <Input
                value={redFlagReason}
                onChange={(e) => setRedFlagReason(e.target.value)}
                placeholder={isAr ? 'أدخل سبب الإشارة...' : 'Enter flag reason...'}
                className="h-11 text-[13px] rounded-xl"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
              />
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.10)' }}>
              <p className="text-[#F97316] text-[12px] font-bold">
                {isAr ? '3 إشارات حمراء = حظر تلقائي • إشارتان = تجميد 3 أيام' : '3 red flags = auto ban • 2 flags = 3-day freeze'}
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="ghost"
              onClick={() => setRedFlagDialogOpen(false)}
              className="text-[#848E9C] hover:text-[#EAECEF]"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleIssueRedFlag}
              disabled={!redFlagUserId || !redFlagReason || actionLoading === 'issue-rf'}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.20)' }}
            >
              {actionLoading === 'issue-rf' ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
              {isAr ? 'وضع إشارة حمراء' : 'Issue Red Flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1E2329;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2B3139;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3B4149;
        }
      `}</style>
    </div>
  )
}
