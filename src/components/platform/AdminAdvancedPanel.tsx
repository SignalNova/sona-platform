'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import {
  Shield, Power, Pause, AlertTriangle, RefreshCw,
  ArrowDownToLine, ArrowUpFromLine, Wallet, DollarSign,
  Search, CheckCircle, XCircle, Clock,
  Bot, TreePine, FileText, Lock, Key, Globe, Monitor,
  Loader2, ChevronLeft, ChevronRight,
  Save, Plus, Trash2, AlertCircle, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface KillSwitches {
  maintenanceMode: boolean;
  roiPaused: boolean;
  depositsPaused: boolean;
  withdrawalsPaused: boolean;
}

interface LiquidityData {
  realWalletBalance: number;
  totalWithdrawable: number;
  totalLockedCapital: number;
  totalDeposited: number;
  totalWithdrawn: number;
  netPosition: number;
}

interface WithdrawalTx {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string; withdrawableBalance: number; lockedCapital: number };
  dynamicMessage: string | null;
  queueStage: string | null;
}

interface BotControl {
  id: string;
  isActive: boolean;
  tradesPerMinute: number;
  winRate: number;
  volatilityFactor: number;
  minTradeAmount: number;
  maxTradeAmount: number;
  symbols: string;
}

interface TreeNode {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalDeposited: number;
  referralCount: number;
  totalReferralDeposits: number;
  children: TreeNode[];
  reward?: number;
  rewardStatus?: string;
  referredAt?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  admin: { id: string; name: string; email: string };
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  balance: number;
  withdrawableBalance: number;
  lockedCapital: number;
  totalProfit: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

// ─── Tab Definitions ──────────────────────────────────────────────
const TABS = [
  { id: 'kill-switches', labelAr: 'لوحة التحكم الرئيسية', labelEn: 'Main Controls', icon: Power },
  { id: 'withdrawals', labelAr: 'طابور السحوبات', labelEn: 'Withdrawal Queue', icon: ArrowUpFromLine },
  { id: 'balance-override', labelAr: 'تعديل الأرصدة', labelEn: 'Balance Override', icon: DollarSign },
  { id: 'bot-controls', labelAr: 'تحكم البوت', labelEn: 'Bot Controls', icon: Bot },
  { id: 'referral-tree', labelAr: 'شجرة الإحالة', labelEn: 'Referral Tree', icon: TreePine },
  { id: 'audit-logs', labelAr: 'سجل التدقيق', labelEn: 'Audit Logs', icon: FileText },
  { id: 'security', labelAr: 'أمان لوحة الإدارة', labelEn: 'Admin Security', icon: Lock },
];

// ─── Helpers ──────────────────────────────────────────────────────
function formatUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeElapsed(dateStr: string, isAr: boolean) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} ${isAr ? 'دقيقة' : 'min'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${isAr ? 'ساعة' : 'hr'}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${isAr ? 'يوم' : 'day'}`;
}

function formatDate(dateStr: string, isAr: boolean) {
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Main Component ───────────────────────────────────────────────
export default function AdminAdvancedPanel({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const user = useAppStore(s => s.user);
  const [activeTab, setActiveTab] = useState('kill-switches');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  // ─── Tab 1: Kill Switches ───────────────────────────────────
  const [killSwitches, setKillSwitches] = useState<KillSwitches | null>(null);
  const [killLoading, setKillLoading] = useState(true);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  async function loadKillSwitches() {
    setKillLoading(true);
    try {
      const res = await fetch('/api/admin/kill-switches', {
        headers: getAuthHeaders(),
      });
      if (res.ok) { const data = await res.json(); setKillSwitches(data); }
    } catch { /* ignore */ }
    setKillLoading(false);
  }

  useEffect(() => {
    const authHeaders = getAuthHeaders();
    fetch('/api/admin/kill-switches', { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setKillSwitches(data); setKillLoading(false); })
      .catch(() => { setKillLoading(false); });
  }, []);

  async function toggleSwitch(switchType: string, enabled: boolean) {
    setSwitchingKey(switchType);
    try {
      const res = await fetch('/api/admin/kill-switches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ switchType, enabled, message: switchType === 'maintenance' ? maintenanceMsg : undefined }),
      });
      const data = await res.json();
      if (res.ok) { showToast('success', data.message || (isAr ? 'تم التحديث' : 'Updated')); loadKillSwitches(); }
      else { showToast('error', data.error || (isAr ? 'حدث خطأ' : 'An error occurred')); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setSwitchingKey(null);
  }

  // ─── Tab 2: Withdrawal Queue ────────────────────────────────
  const [withdrawals, setWithdrawals] = useState<WithdrawalTx[]>([]);
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [wdPage, setWdPage] = useState(1);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdLoading, setWdLoading] = useState(true);
  const [wdActionLoading, setWdActionLoading] = useState<string | null>(null);
  const [walletBalanceInput, setWalletBalanceInput] = useState('');
  const [selectedWd, setSelectedWd] = useState<string[]>([]);

  async function loadWithdrawals() {
    setWdLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=PENDING&page=${wdPage}&limit=15`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.transactions || []);
        setLiquidity(data.liquidity || null);
        setWdTotalPages(data.pagination?.totalPages || 1);
        if (data.liquidity) setWalletBalanceInput(String(data.liquidity.realWalletBalance));
      }
    } catch { /* ignore */ }
    setWdLoading(false);
  }

  useEffect(() => {
    if (activeTab !== 'withdrawals') return;
    const authHeaders = getAuthHeaders();
    fetch(`/api/admin/withdrawals?status=PENDING&page=${wdPage}&limit=15`, { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setWithdrawals(data.transactions || []);
          setLiquidity(data.liquidity || null);
          setWdTotalPages(data.pagination?.totalPages || 1);
          if (data.liquidity) setWalletBalanceInput(String(data.liquidity.realWalletBalance));
        }
        setWdLoading(false);
      })
      .catch(() => { setWdLoading(false); });
  }, [activeTab, wdPage]);

  async function handleWdAction(action: 'approve' | 'reject', transactionId: string, reason?: string) {
    setWdActionLoading(transactionId);
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action, transactionId, reason }),
      });
      const data = await res.json();
      if (res.ok) { showToast('success', data.message); loadWithdrawals(); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setWdActionLoading(null);
  }

  async function updateWalletBalance() {
    try {
      const res = await fetch('/api/admin/wallet-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ balance: parseFloat(walletBalanceInput) || 0 }),
      });
      const data = await res.json();
      if (res.ok) { showToast('success', data.message); loadWithdrawals(); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
  }

  async function batchApprove() {
    for (const id of selectedWd) { await handleWdAction('approve', id); }
    setSelectedWd([]);
  }

  // ─── Tab 3: Balance Override ────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [balanceField, setBalanceField] = useState('withdrawableBalance');
  const [balanceOp, setBalanceOp] = useState<'set' | 'increment' | 'decrement'>('set');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searching, setSearching] = useState(false);

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}&limit=10`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) { const data = await res.json(); setSearchResults(data.users || []); }
    } catch { /* ignore */ }
    setSearching(false);
  }

  async function applyBalanceOverride() {
    if (!selectedUser || !balanceAmount || !balanceReason) return;
    setBalanceLoading(true);
    try {
      const res = await fetch('/api/admin/balance-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: selectedUser.id, field: balanceField, amount: parseFloat(balanceAmount), operation: balanceOp, reason: balanceReason }),
      });
      const data = await res.json();
      if (res.ok) { showToast('success', data.message); searchUsers(); setSelectedUser(null); setBalanceAmount(''); setBalanceReason(''); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setBalanceLoading(false);
    setShowConfirmModal(false);
  }

  // ─── Tab 4: Bot Controls ────────────────────────────────────
  const [botControl, setBotControl] = useState<BotControl | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [botSaving, setBotSaving] = useState(false);
  const [botForm, setBotForm] = useState({
    isActive: false, tradesPerMinute: 1, winRate: 0.65, volatilityFactor: 1.0,
    minTradeAmount: 10, maxTradeAmount: 1000, symbols: 'BTCUSDT,ETHUSDT',
  });

  async function loadBotControls() {
    setBotLoading(true);
    try {
      const res = await fetch('/api/admin/bot-controls', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const c = data.control;
        setBotControl(c);
        if (c) {
          setBotForm({
            isActive: c.isActive, tradesPerMinute: c.tradesPerMinute, winRate: c.winRate,
            volatilityFactor: c.volatilityFactor, minTradeAmount: c.minTradeAmount,
            maxTradeAmount: c.maxTradeAmount, symbols: c.symbols || 'BTCUSDT,ETHUSDT',
          });
        }
      }
    } catch { /* ignore */ }
    setBotLoading(false);
  }

  useEffect(() => {
    if (activeTab !== 'bot-controls') return;
    const authHeaders = getAuthHeaders();
    fetch('/api/admin/bot-controls', { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.control) {
          const c = data.control;
          setBotControl(c);
          setBotForm({
            isActive: c.isActive, tradesPerMinute: c.tradesPerMinute, winRate: c.winRate,
            volatilityFactor: c.volatilityFactor, minTradeAmount: c.minTradeAmount,
            maxTradeAmount: c.maxTradeAmount, symbols: c.symbols || 'BTCUSDT,ETHUSDT',
          });
        }
        setBotLoading(false);
      })
      .catch(() => { setBotLoading(false); });
  }, [activeTab]);

  async function saveBotControls() {
    setBotSaving(true);
    try {
      const res = await fetch('/api/admin/bot-controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(botForm),
      });
      const data = await res.json();
      if (res.ok) { showToast('success', data.message); loadBotControls(); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setBotSaving(false);
  }

  // ─── Tab 5: Referral Tree ───────────────────────────────────
  const [refSearch, setRefSearch] = useState('');
  const [refTree, setRefTree] = useState<TreeNode | null>(null);
  const [topReferrers, setTopReferrers] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  async function loadTopReferrers() {
    setRefLoading(true);
    try {
      const res = await fetch('/api/admin/referral-tree', {
        headers: getAuthHeaders(),
      });
      if (res.ok) { const data = await res.json(); setTopReferrers(data.topReferrers || []); }
    } catch { /* ignore */ }
    setRefLoading(false);
  }

  useEffect(() => {
    if (activeTab !== 'referral-tree') return;
    const authHeaders = getAuthHeaders();
    fetch('/api/admin/referral-tree', { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTopReferrers(data.topReferrers || []); setRefLoading(false); })
      .catch(() => { setRefLoading(false); });
  }, [activeTab]);

  async function loadUserTree(userId: string) {
    setRefLoading(true);
    try {
      const res = await fetch(`/api/admin/referral-tree?userId=${userId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRefTree(data.tree);
        if (data.tree) setExpandedNodes(new Set([data.tree.id]));
      }
    } catch { /* ignore */ }
    setRefLoading(false);
  }

  function toggleNode(nodeId: string) {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }

  // ─── Tab 6: Audit Logs ──────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  async function loadAuditLogs() {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ page: String(auditPage), limit: '20' });
      if (auditActionFilter) params.set('action', auditActionFilter);
      if (auditStartDate) params.set('startDate', auditStartDate);
      if (auditEndDate) params.set('endDate', auditEndDate);
      const res = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditTotalPages(data.pagination?.totalPages || 1);
      }
    } catch { /* ignore */ }
    setAuditLoading(false);
  }

  useEffect(() => {
    if (activeTab !== 'audit-logs') return;
    const authHeaders = getAuthHeaders();
    const params = new URLSearchParams({ page: String(auditPage), limit: '20' });
    if (auditActionFilter) params.set('action', auditActionFilter);
    if (auditStartDate) params.set('startDate', auditStartDate);
    if (auditEndDate) params.set('endDate', auditEndDate);
    fetch(`/api/admin/audit-logs?${params}`, { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setAuditLogs(data.logs || []);
          setAuditTotalPages(data.pagination?.totalPages || 1);
        }
        setAuditLoading(false);
      })
      .catch(() => { setAuditLoading(false); });
  }, [activeTab, auditPage, auditActionFilter, auditStartDate, auditEndDate]);

  // ─── Tab 7: Security ────────────────────────────────────────
  const [twoFA, setTwoFA] = useState({ enabled: false, hasSecret: false });
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFATestCode, setTwoFATestCode] = useState('');
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState('');
  const [twoFADisableCode, setTwoFADisableCode] = useState('');
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle');

  const [ipList, setIpList] = useState<string[]>([]);
  const [ipRestricted, setIpRestricted] = useState(false);
  const [ipLoading, setIpLoading] = useState(true);
  const [newIp, setNewIp] = useState('');

  async function loadSecurity() {
    setTwoFALoading(true);
    setIpLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [r2fa, rIp] = await Promise.all([fetch('/api/admin/2fa', { headers: authHeaders }), fetch('/api/admin/ip-restrict', { headers: authHeaders })]);
      if (r2fa.ok) {
        const d = await r2fa.json();
        setTwoFA({ enabled: d.enabled, hasSecret: d.hasSecret });
        setTwoFAStep(d.enabled ? 'idle' : d.hasSecret ? 'verify' : 'idle');
      }
      if (rIp.ok) {
        const d = await rIp.json();
        setIpList(d.ips || []);
        setIpRestricted(d.restricted);
      }
    } catch { /* ignore */ }
    setTwoFALoading(false);
    setIpLoading(false);
  }

  useEffect(() => {
    if (activeTab !== 'security') return;
    const authHeaders = getAuthHeaders();
    Promise.all([fetch('/api/admin/2fa', { headers: authHeaders }), fetch('/api/admin/ip-restrict', { headers: authHeaders })])
      .then(async ([r2fa, rIp]) => {
        if (r2fa.ok) {
          const d = await r2fa.json();
          setTwoFA({ enabled: d.enabled, hasSecret: d.hasSecret });
          setTwoFAStep(d.enabled ? 'idle' : d.hasSecret ? 'verify' : 'idle');
        }
        if (rIp.ok) {
          const d = await rIp.json();
          setIpList(d.ips || []);
          setIpRestricted(d.restricted);
        }
        setTwoFALoading(false);
        setIpLoading(false);
      })
      .catch(() => { setTwoFALoading(false); setIpLoading(false); });
  }, [activeTab]);

  async function setup2FA() {
    setTwoFALoading(true);
    try {
      const res = await fetch('/api/admin/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ action: 'setup' }) });
      const data = await res.json();
      if (res.ok) { setTwoFASecret(data.secret); setTwoFATestCode(data.testCode); setTwoFAStep('verify'); showToast('success', data.message); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setTwoFALoading(false);
  }

  async function verify2FA() {
    setTwoFALoading(true);
    try {
      const res = await fetch('/api/admin/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ action: 'verify', code: twoFAVerifyCode }) });
      const data = await res.json();
      if (res.ok) { setTwoFA(prev => ({ ...prev, enabled: true })); setTwoFAStep('idle'); showToast('success', data.message); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setTwoFALoading(false);
  }

  async function disable2FA() {
    setTwoFALoading(true);
    try {
      const res = await fetch('/api/admin/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ action: 'disable', code: twoFADisableCode }) });
      const data = await res.json();
      if (res.ok) { setTwoFA({ enabled: false, hasSecret: false }); setTwoFAStep('idle'); setTwoFADisableCode(''); showToast('success', data.message); }
      else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setTwoFALoading(false);
  }

  async function saveIpRestriction() {
    setIpLoading(true);
    try {
      const res = await fetch('/api/admin/ip-restrict', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ ips: ipList, restricted: ipRestricted }) });
      const data = await res.json();
      if (res.ok) { showToast('success', data.message); } else { showToast('error', data.error); }
    } catch { showToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error'); }
    setIpLoading(false);
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm shadow-lg ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {toast.message}
            <button onClick={() => setToast(null)} className="mr-2 opacity-70 hover:opacity-100"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={24} className="text-[#409eff]" />
            {isAr ? 'لوحة التحكم المتقدمة' : 'Advanced Panel'}
          </h2>
          <p className="text-white/40 text-sm mt-1">{isAr ? 'مركز التحكم المطلق في المنصة' : 'Absolute Control Center'}</p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20' : 'bg-white/[0.02] text-white/50 border border-white/5 hover:bg-white/[0.05] hover:text-white/70'
                }`}>
                <Icon size={15} />
                {isAr ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

          {/* ═══ Tab 1: Kill Switches ═══ */}
          {activeTab === 'kill-switches' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'maintenanceMode', label: isAr ? 'وضع الصيانة' : 'Maintenance Mode', active: killSwitches?.maintenanceMode },
                  { key: 'roiPaused', label: isAr ? 'إيقاف الأرباح' : 'Pause ROI', active: killSwitches?.roiPaused },
                  { key: 'depositsPaused', label: isAr ? 'إيقاف الإيداعات' : 'Pause Deposits', active: killSwitches?.depositsPaused },
                  { key: 'withdrawalsPaused', label: isAr ? 'إيقاف السحوبات' : 'Pause Withdrawals', active: killSwitches?.withdrawalsPaused },
                ].map((s, i) => (
                  <motion.div key={s.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`p-3 rounded-xl border text-center ${s.active ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                    <div className={`text-xs font-medium ${s.active ? 'text-red-400' : 'text-green-400'}`}>{s.active ? (isAr ? 'مفعّل' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}</div>
                    <div className="text-white/50 text-[10px] mt-1">{s.label}</div>
                  </motion.div>
                ))}
              </div>

              {killLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={28} className="animate-spin text-[#409eff]" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { type: 'maintenance', label: isAr ? 'وضع الصيانة الشامل' : 'Full Maintenance Mode', desc: isAr ? 'إخفاء زر السحب عن جميع المستخدمين' : 'Hide withdraw button from all users', icon: AlertTriangle, field: 'maintenanceMode' as const },
                    { type: 'roi', label: isAr ? 'إيقاف احتساب الأرباح' : 'Stop Profit Calculation', desc: isAr ? 'إيقاف البوت عن إضافة الأرباح' : 'Stop bot from adding profits', icon: Pause, field: 'roiPaused' as const },
                    { type: 'deposits', label: isAr ? 'إيقاف الإيداعات' : 'Stop Deposits', desc: isAr ? 'منع جميع عمليات الإيداع الجديدة' : 'Block all new deposits', icon: ArrowDownToLine, field: 'depositsPaused' as const },
                    { type: 'withdrawals', label: isAr ? 'إيقاف السحوبات' : 'Stop Withdrawals', desc: isAr ? 'منع جميع عمليات السحب' : 'Block all withdrawals', icon: ArrowUpFromLine, field: 'withdrawalsPaused' as const },
                  ].map((sw, idx) => {
                    const Icon = sw.icon;
                    const isActive = killSwitches?.[sw.field];
                    return (
                      <motion.div key={sw.type} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + idx * 0.05 }}
                        className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg ${isActive ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                              <Icon size={20} className={isActive ? 'text-red-400' : 'text-green-400'} />
                            </div>
                            <div>
                              <h3 className="text-white font-bold text-sm">{sw.label}</h3>
                              <p className="text-white/40 text-xs">{sw.desc}</p>
                            </div>
                          </div>
                          <button onClick={() => toggleSwitch(sw.type, !isActive)} disabled={switchingKey === sw.type}
                            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${isActive ? 'bg-red-500' : 'bg-white/10'}`}>
                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${isActive ? 'right-1' : 'right-9'}`} />
                            {switchingKey === sw.type && <Loader2 size={14} className="absolute top-2 right-7 animate-spin text-white/70" />}
                          </button>
                        </div>
                        {sw.type === 'maintenance' && (
                          <input type="text" placeholder={isAr ? 'رسالة الصيانة (اختياري)' : 'Maintenance message (optional)'} value={maintenanceMsg}
                            onChange={e => setMaintenanceMsg(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-white/70 text-sm focus:outline-none focus:border-[#409eff]/30" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ Tab 2: Withdrawal Queue ═══ */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Wallet size={16} className="text-[#409eff]" />{isAr ? 'لوحة السيولة الحقيقية' : 'Real Liquidity Panel'}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: isAr ? 'رصيد المحفظة الحقيقي' : 'Real Wallet Balance', value: liquidity ? formatUSD(liquidity.realWalletBalance) : '—', color: '#409eff', editable: true },
                    { label: isAr ? 'إجمالي الإيداعات' : 'Total Deposits', value: liquidity ? formatUSD(liquidity.totalDeposited) : '—', color: '#22c55e' },
                    { label: isAr ? 'إجمالي السحوبات' : 'Total Withdrawals', value: liquidity ? formatUSD(liquidity.totalWithdrawn) : '—', color: '#ef4444' },
                    { label: isAr ? 'الموضع الصافي' : 'Net Position', value: liquidity ? formatUSD(liquidity.netPosition) : '—', color: '#f59e0b' },
                    { label: isAr ? 'الرصيد القابل للسحب' : 'Withdrawable Balance', value: liquidity ? formatUSD(liquidity.totalWithdrawable) : '—', color: '#06b6d4' },
                    { label: isAr ? 'رأس المال المقفل' : 'Locked Capital', value: liquidity ? formatUSD(liquidity.totalLockedCapital) : '—', color: '#8b5cf6' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      {item.editable ? (
                        <div className="flex items-center gap-1 mb-1">
                          <input type="number" value={walletBalanceInput} onChange={e => setWalletBalanceInput(e.target.value)}
                            className="w-full bg-transparent text-lg font-bold focus:outline-none" style={{ color: item.color }} dir="ltr" />
                          <button onClick={updateWalletBalance} className="p-1 rounded hover:bg-white/5"><Save size={12} className="text-white/40" /></button>
                        </div>
                      ) : (
                        <div className="text-lg font-bold" style={{ color: item.color }} dir="ltr">{item.value}</div>
                      )}
                      <div className="text-white/30 text-[10px]">{item.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {selectedWd.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#409eff]/5 border border-[#409eff]/10">
                  <span className="text-[#409eff] text-sm font-medium">{selectedWd.length} {isAr ? 'طلب محدد' : 'selected request(s)'}</span>
                  <button onClick={batchApprove} className="px-4 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all">{isAr ? 'موافقة جماعية' : 'Batch Approve'}</button>
                  <button onClick={() => setSelectedWd([])} className="px-4 py-1.5 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all">{isAr ? 'إلغاء التحديد' : 'Deselect'}</button>
                </motion.div>
              )}

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2"><Clock size={14} className="text-amber-400" />{isAr ? 'طلبات السحب المعلقة' : 'Pending Withdrawals'}</h3>
                  <button onClick={loadWithdrawals} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-[#409eff] text-xs hover:bg-[#409eff]/10 transition-all"><RefreshCw size={12} />{isAr ? 'تحديث' : 'Refresh'}</button>
                </div>

                {wdLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 size={28} className="animate-spin text-[#409eff]" /></div>
                ) : withdrawals.length === 0 ? (
                  <div className="text-center py-12"><CheckCircle size={32} className="text-green-400/30 mx-auto mb-2" /><p className="text-white/30 text-sm">{isAr ? 'لا توجد طلبات سحب معلقة' : 'No pending withdrawal requests'}</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right"><input type="checkbox" onChange={e => { if (e.target.checked) setSelectedWd(withdrawals.map(w => w.id)); else setSelectedWd([]); }} className="rounded" /></th>
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'المستخدم' : 'User'}</th>
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'المبلغ' : 'Amount'}</th>
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'الحالة' : 'Status'}</th>
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'الوقت المنقضي' : 'Time Elapsed'}</th>
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'ما يراه المستخدم' : 'User Sees'}</th>
                          <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'إجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((wd) => (
                          <tr key={wd.id} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selectedWd.includes(wd.id)} onChange={e => { if (e.target.checked) setSelectedWd(prev => [...prev, wd.id]); else setSelectedWd(prev => prev.filter(id => id !== wd.id)); }} className="rounded" />
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-white/70 text-xs font-medium">{wd.user.name}</div>
                              <div className="text-white/30 text-[10px]" dir="ltr">{wd.user.email}</div>
                            </td>
                            <td className="px-4 py-3 text-white/80 font-bold text-xs" dir="ltr">{formatUSD(wd.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${wd.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' : wd.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/40'}`}>
                                {wd.status === 'PENDING' ? (isAr ? 'معلق' : 'Pending') : wd.status === 'PROCESSING' ? (isAr ? 'قيد المعالجة' : 'Processing') : wd.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/40 text-xs">{timeElapsed(wd.createdAt, isAr)}</td>
                            <td className="px-4 py-3 text-white/40 text-xs max-w-[150px] truncate">{wd.dynamicMessage || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleWdAction('approve', wd.id)} disabled={wdActionLoading === wd.id}
                                  className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                                  {wdActionLoading === wd.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                </button>
                                <button onClick={() => { const reason = prompt(isAr ? 'سبب الرفض:' : 'Rejection reason:'); if (reason) handleWdAction('reject', wd.id, reason); }} disabled={wdActionLoading === wd.id}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                  <XCircle size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {wdTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
                    <button onClick={() => setWdPage(p => Math.max(1, p - 1))} disabled={wdPage <= 1} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30"><ChevronRight size={14} /></button>
                    <span className="text-white/40 text-xs">{wdPage} / {wdTotalPages}</span>
                    <button onClick={() => setWdPage(p => Math.min(wdTotalPages, p + 1))} disabled={wdPage >= wdTotalPages} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={14} /></button>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* ═══ Tab 3: Balance Override ═══ */}
          {activeTab === 'balance-override' && (
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Search size={16} className="text-[#409eff]" />{isAr ? 'البحث عن مستخدم' : 'Search User'}</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder={isAr ? 'بحث بالاسم أو البريد الإلكتروني...' : 'Search by name or email...'} value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20" />
                  <button onClick={searchUsers} disabled={searching}
                    className="px-5 py-2.5 rounded-xl bg-[#409eff] text-white text-sm font-medium hover:bg-[#409eff]/80 transition-all disabled:opacity-50 flex items-center gap-2">
                    {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}{isAr ? 'بحث' : 'Search'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map(u => (
                      <button key={u.id} onClick={() => setSelectedUser(u)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          selectedUser?.id === u.id ? 'bg-[#409eff]/5 border-[#409eff]/20' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 flex items-center justify-center text-[#409eff] font-bold text-xs">{u.name.charAt(0)}</div>
                          <div className="text-right">
                            <div className="text-white/70 text-xs font-medium">{u.name}</div>
                            <div className="text-white/30 text-[10px]" dir="ltr">{u.email}</div>
                          </div>
                        </div>
                        <div className="text-[#409eff] text-xs font-bold" dir="ltr">{formatUSD(u.balance)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>

              {selectedUser && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                  <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                    <DollarSign size={16} className="text-green-400" />{isAr ? 'تعديل رصيد:' : 'Edit Balance:'} <span className="text-[#409eff]">{selectedUser.name}</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {[
                      { label: isAr ? 'الرصيد الكلي' : 'Total Balance', value: selectedUser.balance, field: 'balance' },
                      { label: isAr ? 'الرصيد القابل للسحب' : 'Withdrawable Balance', value: selectedUser.withdrawableBalance, field: 'withdrawableBalance' },
                      { label: isAr ? 'رأس المال المقفل' : 'Locked Capital', value: selectedUser.lockedCapital, field: 'lockedCapital' },
                      { label: isAr ? 'إجمالي الأرباح' : 'Total Profits', value: selectedUser.totalProfit, field: 'totalProfit' },
                      { label: isAr ? 'إجمالي الإيداعات' : 'Total Deposits', value: selectedUser.totalDeposited, field: 'totalDeposited' },
                      { label: isAr ? 'إجمالي السحوبات' : 'Total Withdrawals', value: selectedUser.totalWithdrawn, field: 'totalWithdrawn' },
                    ].map((b, i) => (
                      <button key={i} onClick={() => setBalanceField(b.field)}
                        className={`p-3 rounded-lg border text-center transition-all ${balanceField === b.field ? 'bg-[#409eff]/5 border-[#409eff]/20' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                        <div className="text-white/60 text-xs font-bold" dir="ltr">{formatUSD(b.value)}</div>
                        <div className="text-white/30 text-[10px] mt-1">{b.label}</div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'نوع العملية' : 'Operation Type'}</label>
                      <div className="flex gap-1">
                        {[{ key: 'set', label: isAr ? 'تعيين' : 'Set' }, { key: 'increment', label: isAr ? 'زيادة' : 'Increment' }, { key: 'decrement', label: isAr ? 'نقصان' : 'Decrement' }].map(op => (
                          <button key={op.key} onClick={() => setBalanceOp(op.key as any)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                              balanceOp === op.key ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20' : 'bg-white/[0.02] text-white/40 border border-white/5 hover:bg-white/[0.05]'
                            }`}>{op.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'المبلغ' : 'Amount'}</label>
                      <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} placeholder="0.00" dir="ltr"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'السبب (مطلوب)' : 'Reason (required)'}</label>
                      <input type="text" value={balanceReason} onChange={e => setBalanceReason(e.target.value)} placeholder={isAr ? 'أدخل سبب التعديل...' : 'Enter adjustment reason...'}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20" />
                    </div>
                  </div>

                  <button onClick={() => { if (!balanceAmount || !balanceReason) { showToast('error', isAr ? 'يرجى إدخال المبلغ والسبب' : 'Please enter amount and reason'); return; } setShowConfirmModal(true); }}
                    disabled={balanceLoading}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-[#409eff] text-white text-sm font-medium hover:bg-[#409eff]/80 transition-all disabled:opacity-50 flex items-center gap-2">
                    {balanceLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{isAr ? 'تطبيق التعديل' : 'Apply Adjustment'}
                  </button>
                </motion.div>
              )}

              {showConfirmModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#1f2634] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-red-500/10"><AlertTriangle size={20} className="text-red-400" /></div>
                      <h3 className="text-white font-bold text-lg">{isAr ? 'تأكيد تعديل الرصيد' : 'Confirm Balance Override'}</h3>
                    </div>
                    <div className="space-y-2 mb-6 text-sm">
                      <div className="flex justify-between text-white/60"><span>{isAr ? 'المستخدم:' : 'User:'}</span><span className="text-white/80">{selectedUser.name}</span></div>
                      <div className="flex justify-between text-white/60"><span>{isAr ? 'الحقل:' : 'Field:'}</span><span className="text-white/80">{balanceField}</span></div>
                      <div className="flex justify-between text-white/60"><span>{isAr ? 'العملية:' : 'Operation:'}</span><span className="text-white/80">{balanceOp === 'set' ? (isAr ? 'تعيين' : 'Set') : balanceOp === 'increment' ? (isAr ? 'زيادة' : 'Increment') : (isAr ? 'نقصان' : 'Decrement')}</span></div>
                      <div className="flex justify-between text-white/60"><span>{isAr ? 'المبلغ:' : 'Amount:'}</span><span className="text-white/80" dir="ltr">{balanceAmount}</span></div>
                      <div className="flex justify-between text-white/60"><span>{isAr ? 'السبب:' : 'Reason:'}</span><span className="text-white/80">{balanceReason}</span></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={applyBalanceOverride} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-500/80 transition-all">{isAr ? 'تأكيد التعديل' : 'Confirm Override'}</button>
                      <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10 transition-all">{isAr ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Tab 4: Bot Controls ═══ */}
          {activeTab === 'bot-controls' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-sm flex items-center gap-2"><Bot size={16} className="text-[#409eff]" />{isAr ? 'إعدادات البوت' : 'Bot Settings'}</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${botForm.isActive ? 'text-green-400' : 'text-red-400'}`}>{botForm.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'متوقف' : 'Stopped')}</span>
                  <button onClick={() => setBotForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${botForm.isActive ? 'bg-green-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${botForm.isActive ? 'right-0.5' : 'right-6'}`} />
                  </button>
                </div>
              </div>

              {botLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={28} className="animate-spin text-[#409eff]" /></div>
              ) : (
                <div className="space-y-6">
                  {[
                    { label: isAr ? 'عدد الصفقات في الدقيقة' : 'Trades per Minute', key: 'tradesPerMinute', min: 0.5, max: 10, step: 0.5, value: botForm.tradesPerMinute, format: (v: number) => String(v) },
                    { label: isAr ? 'نسبة الفوز' : 'Win Rate', key: 'winRate', min: 0.1, max: 0.95, step: 0.05, value: botForm.winRate, format: (v: number) => `${(v * 100).toFixed(0)}%` },
                    { label: isAr ? 'عامل التقلب' : 'Volatility Factor', key: 'volatilityFactor', min: 0.1, max: 5.0, step: 0.1, value: botForm.volatilityFactor, format: (v: number) => String(v) },
                  ].map((slider) => (
                    <div key={slider.key}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white/60 text-sm">{slider.label}</span>
                        <span className="text-[#409eff] text-sm font-bold" dir="ltr">{slider.format(slider.value)}</span>
                      </div>
                      <input type="range" min={slider.min} max={slider.max} step={slider.step} value={slider.value}
                        onChange={e => setBotForm(prev => ({ ...prev, [slider.key]: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to left, #409eff ${((slider.value - slider.min) / (slider.max - slider.min)) * 100}%, rgba(255,255,255,0.1) ${((slider.value - slider.min) / (slider.max - slider.min)) * 100}%)` }} />
                      <div className="flex justify-between mt-1">
                        <span className="text-white/20 text-[10px]" dir="ltr">{slider.min}</span>
                        <span className="text-white/20 text-[10px]" dir="ltr">{slider.max}</span>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الحد الأدنى للمبلغ ($)' : 'Min Amount ($)'}</label>
                      <input type="number" value={botForm.minTradeAmount} onChange={e => setBotForm(prev => ({ ...prev, minTradeAmount: parseFloat(e.target.value) || 0 }))} dir="ltr"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30" />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الحد الأقصى للمبلغ ($)' : 'Max Amount ($)'}</label>
                      <input type="number" value={botForm.maxTradeAmount} onChange={e => setBotForm(prev => ({ ...prev, maxTradeAmount: parseFloat(e.target.value) || 0 }))} dir="ltr"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30" />
                    </div>
                  </div>

                  <div>
                    <label className="text-white/40 text-xs block mb-1.5">{isAr ? 'الرموز (مفصولة بفواصل)' : 'Symbols (comma-separated)'}</label>
                    <input type="text" value={botForm.symbols} onChange={e => setBotForm(prev => ({ ...prev, symbols: e.target.value }))} placeholder="BTCUSDT,ETHUSDT,BNBUSDT" dir="ltr"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20" />
                  </div>

                  <button onClick={saveBotControls} disabled={botSaving}
                    className="w-full py-3 rounded-xl bg-[#409eff] text-white text-sm font-medium hover:bg-[#409eff]/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {botSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{isAr ? 'حفظ الإعدادات' : 'Save Settings'}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Tab 5: Referral Tree ═══ */}
          {activeTab === 'referral-tree' && (
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><TreePine size={16} className="text-green-400" />{isAr ? 'شجرة الإحالة' : 'Referral Tree'}</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={refSearch} onChange={e => setRefSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && refSearch) loadUserTree(refSearch); }}
                    placeholder={isAr ? 'أدخل معرف المستخدم أو ابحث...' : 'Enter user ID or search...'}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20" />
                  <button onClick={() => refSearch && loadUserTree(refSearch)}
                    className="px-5 py-2.5 rounded-xl bg-[#409eff] text-white text-sm font-medium hover:bg-[#409eff]/80 transition-all flex items-center gap-2"><Search size={14} />{isAr ? 'عرض' : 'View'}</button>
                </div>

                {topReferrers.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[#409eff] font-bold text-lg">{topReferrers.length}</div>
                      <div className="text-white/30 text-[10px]">{isAr ? 'أفضل المُحيلين' : 'Top Referrers'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-green-400 font-bold text-lg" dir="ltr">{formatUSD(topReferrers.reduce((sum: number, r: any) => sum + (r.totalRewards || 0), 0))}</div>
                      <div className="text-white/30 text-[10px]">{isAr ? 'إجمالي العمولات' : 'Total Commissions'}</div>
                    </div>
                  </div>
                )}

                {!refTree && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {topReferrers.map((r: any) => (
                      <button key={r.id} onClick={() => loadUserTree(r.id)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-[#409eff]/20 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400/20 to-green-400/5 flex items-center justify-center text-green-400 font-bold text-xs">{r.name?.charAt(0) || '?'}</div>
                          <div>
                            <div className="text-white/70 text-xs font-medium">{r.name}</div>
                            <div className="text-white/30 text-[10px]" dir="ltr">{r.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center"><div className="text-[#409eff] text-xs font-bold">{r.referralCount}</div><div className="text-white/20 text-[9px]">{isAr ? 'إحالات' : 'Referrals'}</div></div>
                          <div className="text-center"><div className="text-green-400 text-xs font-bold" dir="ltr">{formatUSD(r.totalRewards || 0)}</div><div className="text-white/20 text-[9px]">{isAr ? 'عمولات' : 'Commissions'}</div></div>
                          <ChevronLeft size={14} className="text-white/20" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>

              {refTree && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-bold text-sm">{isAr ? 'شجرة المستخدم:' : 'User Tree:'} {refTree.name}</h4>
                    <button onClick={() => setRefTree(null)} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-all">{isAr ? 'رجوع' : 'Back'}</button>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    <TreeNodeComponent node={refTree} depth={0} expandedNodes={expandedNodes} onToggle={toggleNode} isAr={isAr} />
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ═══ Tab 6: Audit Logs ═══ */}
          {activeTab === 'audit-logs' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <div className="flex flex-wrap gap-3">
                  <input type="text" value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} placeholder={isAr ? 'تصفية بنوع الإجراء...' : 'Filter by action type...'}
                    className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-white text-xs focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20 w-40" />
                  <input type="date" value={auditStartDate} onChange={e => setAuditStartDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-white text-xs focus:outline-none focus:border-[#409eff]/30" />
                  <input type="date" value={auditEndDate} onChange={e => setAuditEndDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-white text-xs focus:outline-none focus:border-[#409eff]/30" />
                  <button onClick={loadAuditLogs} className="px-4 py-2 rounded-lg bg-[#409eff]/10 text-[#409eff] text-xs font-medium hover:bg-[#409eff]/20 transition-all flex items-center gap-1.5"><RefreshCw size={12} />{isAr ? 'تحديث' : 'Refresh'}</button>
                </div>
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={28} className="animate-spin text-[#409eff]" /></div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12"><FileText size={32} className="text-white/8 mx-auto mb-2" /><p className="text-white/30 text-sm">{isAr ? 'لا توجد سجلات' : 'No logs found'}</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'الوقت' : 'Time'}</th>
                        <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'المسؤول' : 'Admin'}</th>
                        <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'الإجراء' : 'Action'}</th>
                        <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'الهدف' : 'Target'}</th>
                        <th className="px-4 py-3 text-white/30 text-xs font-medium text-right">{isAr ? 'التفاصيل' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                          <td className="px-4 py-3 text-white/40 text-xs">{formatDate(log.createdAt, isAr)}</td>
                          <td className="px-4 py-3">
                            <div className="text-white/60 text-xs">{log.admin.name}</div>
                            <div className="text-white/25 text-[10px]" dir="ltr">{log.admin.email}</div>
                          </td>
                          <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff]">{log.action}</span></td>
                          <td className="px-4 py-3 text-white/40 text-xs">{log.targetType}{log.targetId ? ` / ${log.targetId.slice(0, 8)}...` : ''}</td>
                          <td className="px-4 py-3 text-white/30 text-xs max-w-[200px] truncate" title={log.details || ''}>{log.details ? (log.details.length > 60 ? log.details.slice(0, 60) + '...' : log.details) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {auditTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-white/5">
                  <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage <= 1} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30"><ChevronRight size={14} /></button>
                  <span className="text-white/40 text-xs">{auditPage} / {auditTotalPages}</span>
                  <button onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))} disabled={auditPage >= auditTotalPages} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={14} /></button>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Tab 7: Security ═══ */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Key size={16} className="text-amber-400" />{isAr ? 'المصادقة الثنائية (2FA)' : 'Two-Factor Authentication (2FA)'}</h3>
                {twoFALoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-[#409eff]" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className={`flex items-center justify-between p-4 rounded-lg ${twoFA.enabled ? 'bg-green-500/5 border border-green-500/10' : 'bg-red-500/5 border border-red-500/10'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${twoFA.enabled ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {twoFA.enabled ? <Shield size={18} className="text-green-400" /> : <AlertCircle size={18} className="text-red-400" />}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${twoFA.enabled ? 'text-green-400' : 'text-red-400'}`}>{twoFA.enabled ? (isAr ? 'المصادقة الثنائية مفعّلة' : '2FA is enabled') : (isAr ? 'المصادقة الثنائية معطّلة' : '2FA is disabled')}</div>
                          <div className="text-white/30 text-xs">{twoFA.enabled ? (isAr ? 'حسابك محمي بالمصادقة الثنائية' : 'Your account is protected with 2FA') : (isAr ? 'يُنصح بتفعيل المصادقة الثنائية لحماية إضافية' : 'Enable 2FA for additional protection')}</div>
                        </div>
                      </div>
                      {!twoFA.enabled && twoFAStep === 'idle' && (
                        <button onClick={setup2FA} className="px-4 py-2 rounded-lg bg-[#409eff] text-white text-xs font-medium hover:bg-[#409eff]/80 transition-all">{isAr ? 'إعداد' : 'Setup'}</button>
                      )}
                      {twoFA.enabled && twoFAStep === 'idle' && (
                        <button onClick={() => setTwoFAStep('disable')} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all">{isAr ? 'تعطيل' : 'Disable'}</button>
                      )}
                    </div>

                    {twoFAStep === 'setup' && twoFASecret && (
                      <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div className="text-amber-400 text-xs font-medium mb-2">{isAr ? 'احفظ السر التالي بشكل آمن:' : 'Save the following secret securely:'}</div>
                        <div className="bg-black/30 p-3 rounded-lg text-white/80 text-xs font-mono break-all" dir="ltr">{twoFASecret}</div>
                        <div className="text-amber-400/70 text-xs mt-2">{isAr ? 'الكود التجريبي:' : 'Test code:'} <span className="font-bold" dir="ltr">{twoFATestCode}</span></div>
                      </div>
                    )}

                    {twoFAStep === 'verify' && (
                      <div className="flex gap-3">
                        <input type="text" value={twoFAVerifyCode} onChange={e => setTwoFAVerifyCode(e.target.value)} placeholder={isAr ? 'أدخل كود التحقق' : 'Enter verification code'} maxLength={6} dir="ltr"
                          className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20 text-center tracking-widest" />
                        <button onClick={verify2FA} className="px-6 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-500/80 transition-all">{isAr ? 'تحقق' : 'Verify'}</button>
                      </div>
                    )}

                    {twoFAStep === 'disable' && (
                      <div className="flex gap-3">
                        <input type="text" value={twoFADisableCode} onChange={e => setTwoFADisableCode(e.target.value)} placeholder={isAr ? 'أدخل كود المصادقة لتعطيل' : 'Enter auth code to disable'} maxLength={6} dir="ltr"
                          className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20 text-center tracking-widest" />
                        <button onClick={disable2FA} className="px-6 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-500/80 transition-all">{isAr ? 'تعطيل' : 'Disable'}</button>
                        <button onClick={() => setTwoFAStep('idle')} className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all">{isAr ? 'إلغاء' : 'Cancel'}</button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2"><Globe size={16} className="text-[#409eff]" />{isAr ? 'تقييد عناوين IP' : 'IP Restriction'}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${ipRestricted ? 'text-green-400' : 'text-white/40'}`}>{ipRestricted ? (isAr ? 'مفعّل' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}</span>
                    <button onClick={() => setIpRestricted(!ipRestricted)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${ipRestricted ? 'bg-green-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${ipRestricted ? 'right-0.5' : 'right-6'}`} />
                    </button>
                  </div>
                </div>
                {ipLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 size={20} className="animate-spin text-[#409eff]" /></div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {ipList.map((ip, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-white/60 text-xs font-mono" dir="ltr">{ip}</span>
                          <button onClick={() => setIpList(prev => prev.filter((_, idx) => idx !== i))} className="p-1 rounded hover:bg-red-500/10 text-red-400/50 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                        </div>
                      ))}
                      {ipList.length === 0 && <p className="text-white/20 text-xs text-center py-4">{isAr ? 'لا توجد عناوين IP مسموحة' : 'No allowed IP addresses'}</p>}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={newIp} onChange={e => setNewIp(e.target.value)} placeholder={isAr ? 'أدخل عنوان IP (مثال: 192.168.1.1)' : 'Enter IP address (e.g., 192.168.1.1)'} dir="ltr"
                        className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-white text-xs focus:outline-none focus:border-[#409eff]/30 placeholder:text-white/20" />
                      <button onClick={() => { if (newIp.trim()) { setIpList(prev => [...prev, newIp.trim()]); setNewIp(''); } }}
                        className="px-3 py-2 rounded-lg bg-[#409eff]/10 text-[#409eff] text-xs font-medium hover:bg-[#409eff]/20 transition-all flex items-center gap-1"><Plus size={12} />{isAr ? 'إضافة' : 'Add'}</button>
                    </div>
                    <button onClick={saveIpRestriction} className="w-full py-2.5 rounded-xl bg-[#409eff] text-white text-sm font-medium hover:bg-[#409eff]/80 transition-all flex items-center justify-center gap-2"><Save size={14} />{isAr ? 'حفظ إعدادات IP' : 'Save IP Settings'}</button>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Monitor size={16} className="text-purple-400" />{isAr ? 'معلومات الجلسة الحالية' : 'Current Session Info'}</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/50 text-xs">{isAr ? 'المستخدم' : 'User'}</span><span className="text-white/70 text-xs font-medium">{user?.name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/50 text-xs">{isAr ? 'البريد الإلكتروني' : 'Email'}</span><span className="text-white/70 text-xs font-medium" dir="ltr">{user?.email || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white/50 text-xs">{isAr ? 'الدور' : 'Role'}</span><span className="text-[#409eff] text-xs font-medium">{user?.role === 'ADMIN' ? (isAr ? 'مسؤول' : 'Admin') : user?.role || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                    <span className="text-white/50 text-xs">{isAr ? 'حالة الجلسة' : 'Session Status'}</span>
                    <span className="text-green-400 text-xs font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />{isAr ? 'نشطة' : 'Active'}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Tree Node Component ──────────────────────────────────────────
function TreeNodeComponent({ node, depth, expandedNodes, onToggle, isAr }: {
  node: TreeNode; depth: number; expandedNodes: Set<string>; onToggle: (id: string) => void; isAr: boolean;
}) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginRight: depth > 0 ? '24px' : '0' }}>
      <button onClick={() => hasChildren && onToggle(node.id)}
        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all mb-2 ${
          isExpanded ? 'bg-[#409eff]/5 border-[#409eff]/15' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
        }`}>
        <div className="flex items-center gap-3">
          {hasChildren ? <ChevronLeft size={14} className={`text-white/30 transition-transform ${isExpanded ? '-rotate-90' : ''}`} /> : <div className="w-3.5" />}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400/20 to-green-400/5 flex items-center justify-center text-green-400 font-bold text-xs">{node.name.charAt(0)}</div>
          <div>
            <div className="text-white/70 text-xs font-medium">{node.name}</div>
            <div className="text-white/25 text-[10px]" dir="ltr">{node.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-[#409eff] text-xs font-bold">{node.referralCount}</div><div className="text-white/20 text-[9px]">{isAr ? 'إحالات' : 'Referrals'}</div></div>
          <div className="text-center"><div className="text-green-400 text-xs font-bold" dir="ltr">{formatUSD(node.totalDeposited || 0)}</div><div className="text-white/20 text-[9px]">{isAr ? 'إيداعات' : 'Deposits'}</div></div>
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {node.children.map(child => (
              <TreeNodeComponent key={child.id} node={child} depth={depth + 1} expandedNodes={expandedNodes} onToggle={onToggle} isAr={isAr} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
