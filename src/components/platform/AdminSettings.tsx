'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  Save,
  Server,
  DollarSign,
  UserPlus,
  Mail,
  Megaphone,
  ToggleLeft,
  ToggleRight,
  Globe,
  ShieldCheck,
  Wallet,
  Zap,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface PlatformSetting {
  key: string;
  value: string;
}

export default function AdminSettings() {
  const { user } = useAppStore();
  const { t, lang } = useI18n();
  const isAr = lang === 'ar';
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('PLATFORM');
  const [notifTarget, setNotifTarget] = useState('all');
  const [sendingNotif, setSendingNotif] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    if (!user) return;
    setLoading(true);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch('/api/admin/settings', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings && Array.isArray(data.settings)) {
          setSettings(data.settings);
        } else if (res.status === 401) {
          setToast({ type: 'error', message: isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please login first' });
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!user) return;
    if (settings.length === 0) {
      setToast({ type: 'error', message: isAr ? 'لا توجد إعدادات لحفظها، يرجى تحديث الصفحة' : 'No settings to save, please refresh the page' });
      return;
    }
    setSaving(true);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: t('admin.saveSuccess') });
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleAction(action: string) {
    if (!user) return;
    setActionLoading(action);
    try {
      const token = useAppStore.getState().getToken();
      let res: Response;
      if (action === 'checkDeposits') {
        res = await fetch('/api/admin/deposits/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
      } else if (action === 'ensureAdmin') {
        res = await fetch('/api/admin/ensure-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
      } else {
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: data.message || t('common.success') });
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    } finally {
      setActionLoading(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function sendBroadcastNotification() {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      setToast({ type: 'error', message: t('admin.enterTitleAndMessage') });
      return;
    }
    setSendingNotif(true);
    try {
      const token = useAppStore.getState().getToken();
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ broadcast: true, type: notifType, title: notifTitle.trim(), message: notifMessage.trim(), target: notifTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: data.message || t('admin.sentSuccessfully') });
        setNotifTitle('');
        setNotifMessage('');
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    } finally {
      setSendingNotif(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  function getSetting(key: string): string {
    return settings.find((s) => s.key === key)?.value || '';
  }

  function updateSetting(key: string, value: string) {
    setSettings((prev) => {
      const exists = prev.find((s) => s.key === key);
      if (exists) return prev.map((s) => (s.key === key ? { ...s, value } : s));
      return [...prev, { key, value }];
    });
  }

  function toggleBooleanSetting(key: string) {
    const current = getSetting(key);
    updateSetting(key, current === 'true' ? 'false' : 'true');
  }

  const isBooleanSetting = (key: string): boolean => {
    return ['maintenance_mode', 'registration_enabled', 'deposit_enabled', 'withdrawal_enabled', 'investment_enabled', 'support_enabled', 'sona_enabled', 'fake_hack_mode'].includes(key);
  };

  // Settings organized by sections
  const settingsSections = [
    {
      title: t('admin.systemSection'),
      icon: Server,
      color: '#409eff',
      keys: ['maintenance_mode', 'platform_name', 'platform_currency', 'platform_mode'],
    },
    {
      title: isAr ? 'إعدادات سونا' : 'SONA Settings',
      icon: Zap,
      color: '#06b6d4',
      keys: ['sona_enabled', 'fake_hack_mode', 'fake_hack_message', 'weekly_transfer_day', 'daily_profit_time'],
    },
    {
      title: t('admin.financeSection'),
      icon: DollarSign,
      color: '#22c55e',
      keys: ['min_deposit', 'min_withdrawal', 'referral_bonus', 'reinvest_bonus_percent', 'platform_commission_percent'],
    },
    {
      title: isAr ? 'معالجة السحوبات' : 'Withdrawal Processing',
      icon: Clock,
      color: '#f97316',
      keys: ['withdrawal_processing_fast', 'withdrawal_processing_medium', 'withdrawal_processing_slow'],
    },
    {
      title: t('admin.featuresSection'),
      icon: ShieldCheck,
      color: '#f59e0b',
      keys: ['registration_enabled', 'deposit_enabled', 'withdrawal_enabled', 'investment_enabled', 'support_enabled'],
    },
    {
      title: t('admin.communicationSection'),
      icon: Mail,
      color: '#8b5cf6',
      keys: ['notification_email'],
    },
  ];

  const formatSettingLabel = (key: string): string => {
    const labels: Record<string, string> = {
      maintenance_mode: t('admin.maintenanceModeLabel'),
      min_deposit: t('admin.minDepositLabel'),
      min_withdrawal: t('admin.minWithdrawalLabel'),
      registration_enabled: t('admin.registrationEnabled'),
      deposit_enabled: t('admin.depositEnabled'),
      withdrawal_enabled: t('admin.withdrawalEnabled'),
      investment_enabled: t('admin.investmentEnabled'),
      referral_bonus: t('admin.referralBonusLabel'),
      support_enabled: t('admin.supportEnabled'),
      platform_name: t('admin.platformNameLabel'),
      platform_currency: t('admin.platformCurrencyLabel'),
      notification_email: t('admin.notificationEmailLabel'),
      platform_mode: isAr ? 'وضع المنصة' : 'Platform Mode',
      sona_enabled: isAr ? 'وضع سونا' : 'SONA Mode',
      fake_hack_mode: isAr ? 'وضع الاختراق المزيف' : 'Fake Hack Mode',
      fake_hack_message: isAr ? 'رسالة الاختراق المزيف' : 'Fake Hack Message',
      weekly_transfer_day: isAr ? 'يوم التحويل الأسبوعي' : 'Weekly Transfer Day',
      daily_profit_time: isAr ? 'وقت الربح اليومي' : 'Daily Profit Time',
      reinvest_bonus_percent: isAr ? 'نسبة مكافأة إعادة الاستثمار' : 'Reinvest Bonus %',
      platform_commission_percent: isAr ? 'نسبة عمولة المنصة' : 'Platform Commission %',
      withdrawal_processing_fast: isAr ? 'معالجة سحب سريعة (ساعات)' : 'Fast Withdrawal (hours)',
      withdrawal_processing_medium: isAr ? 'معالجة سحب متوسطة (ساعات)' : 'Medium Withdrawal (hours)',
      withdrawal_processing_slow: isAr ? 'معالجة سحب بطيئة (ساعات)' : 'Slow Withdrawal (hours)',
    };
    return labels[key] || key;
  };

  const getSettingIcon = (key: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      maintenance_mode: <Server size={16} />,
      min_deposit: <DollarSign size={16} />,
      min_withdrawal: <DollarSign size={16} />,
      registration_enabled: <UserPlus size={16} />,
      deposit_enabled: <Wallet size={16} />,
      withdrawal_enabled: <Wallet size={16} />,
      investment_enabled: <TrendingUp size={16} />,
      referral_bonus: <DollarSign size={16} />,
      support_enabled: <Mail size={16} />,
      platform_name: <Globe size={16} />,
      platform_currency: <DollarSign size={16} />,
      notification_email: <Mail size={16} />,
      platform_mode: <Zap size={16} />,
      sona_enabled: <Zap size={16} />,
      fake_hack_mode: <Shield size={16} />,
      fake_hack_message: <Megaphone size={16} />,
      weekly_transfer_day: <Clock size={16} />,
      daily_profit_time: <Clock size={16} />,
      reinvest_bonus_percent: <DollarSign size={16} />,
      platform_commission_percent: <DollarSign size={16} />,
      withdrawal_processing_fast: <Zap size={16} />,
      withdrawal_processing_medium: <Clock size={16} />,
      withdrawal_processing_slow: <Clock size={16} />,
    };
    return icons[key] || <Settings size={16} />;
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
      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings size={22} className="text-[#409eff]" />
            {t('admin.platformSettings')}
          </h2>
          <p className="text-white/40 text-sm mt-1">{t('admin.manageSettings')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadSettings()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all">
            <RefreshCw size={14} />
            {t('common.refresh')}
          </button>
          <button onClick={saveSettings} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#409eff]/10 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('admin.saveSettings')}
          </button>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          {t('admin.quickActions')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => handleAction('checkDeposits')} disabled={actionLoading === 'checkDeposits'}
            className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/10 text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50">
            {actionLoading === 'checkDeposits' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            <div className="text-right">
              <div className="text-sm font-medium">{t('admin.checkDeposits')}</div>
              <div className="text-[10px] opacity-60">{t('admin.checkDepositsDesc')}</div>
            </div>
          </button>
          <button onClick={() => handleAction('ensureAdmin')} disabled={actionLoading === 'ensureAdmin'}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#409eff]/5 border border-[#409eff]/10 text-[#409eff] hover:bg-[#409eff]/10 transition-all disabled:opacity-50">
            {actionLoading === 'ensureAdmin' ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            <div className="text-right">
              <div className="text-sm font-medium">{t('admin.ensureAdmin')}</div>
              <div className="text-[10px] opacity-60">{t('admin.ensureAdminDesc')}</div>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Platform Info Summary */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Globe size={16} className="text-[#409eff]" />
          {t('admin.platformInfo')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-white/30 text-[10px] mb-1">{t('admin.platformName')}</div>
            <div className="text-[#409eff] font-bold text-sm">{getSetting('platform_name') || t('common.appName')}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-white/30 text-[10px] mb-1">{t('admin.platformCurrency')}</div>
            <div className="text-white/80 font-bold text-sm">{getSetting('platform_currency') || 'USDT'}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-white/30 text-[10px] mb-1">{t('admin.maintenanceMode')}</div>
            <div className={`font-bold text-sm ${getSetting('maintenance_mode') === 'true' ? 'text-red-400' : 'text-green-400'}`}>
              {getSetting('maintenance_mode') === 'true' ? t('common.enabled') : t('common.disabled')}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-white/30 text-[10px] mb-1">{t('admin.referralBonusSetting')}</div>
            <div className="text-green-400 font-bold text-sm">${getSetting('referral_bonus') || '5'}</div>
          </div>
        </div>
      </motion.div>

      {/* Settings Sections */}
      {settingsSections.map((section, si) => {
        const SectionIcon = section.icon;
        const sectionSettings = settings.filter(s => section.keys.includes(s.key));
        if (sectionSettings.length === 0) return null;

        return (
          <motion.div key={section.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + si * 0.05 }}
            className="rounded-xl bg-[#1f2634] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-white/5" style={{ borderBottomColor: section.color + '15' }}>
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: section.color + '15', color: section.color }}>
                <SectionIcon size={14} />
              </div>
              <h3 className="text-white font-bold text-sm">{section.title}</h3>
            </div>
            <div className="p-4 space-y-2">
              {sectionSettings.map((setting) => (
                <div key={setting.key}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-white/[0.03] text-white/30">
                      {getSettingIcon(setting.key)}
                    </div>
                    <span className="text-white/60 text-sm">{formatSettingLabel(setting.key)}</span>
                  </div>
                  {isBooleanSetting(setting.key) ? (
                    <button onClick={() => toggleBooleanSetting(setting.key)} className="flex items-center gap-2">
                      <span className={`text-xs ${setting.value === 'true' ? 'text-green-400' : 'text-red-400'}`}>
                        {setting.value === 'true' ? t('common.enabled') : t('common.disabled')}
                      </span>
                      {setting.value === 'true' ? (
                        <ToggleRight size={22} className="text-green-400" />
                      ) : (
                        <ToggleLeft size={22} className="text-white/20" />
                      )}
                    </button>
                  ) : setting.key === 'platform_mode' ? (
                    <select
                      value={setting.value}
                      onChange={(e) => updateSetting(setting.key, e.target.value)}
                      className="w-32 sm:w-48 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-white text-sm focus:border-[#409eff]/30 focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                      <option value="SONA" className="bg-[#1f2634]">SONA</option>
                      <option value="BOTH" className="bg-[#1f2634]">BOTH</option>
                      <option value="DUBIBO" className="bg-[#1f2634]">DUBIBO</option>
                    </select>
                  ) : (
                    <input
                      type={setting.key.includes('percent') || setting.key.includes('min_') || setting.key.includes('bonus') || setting.key.includes('processing') || setting.key.includes('day') ? 'number' : 'text'}
                      value={setting.value}
                      onChange={(e) => updateSetting(setting.key, e.target.value)}
                      className="w-32 sm:w-48 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-white text-sm text-left focus:border-[#409eff]/30 focus:outline-none transition-colors"
                      dir={setting.key.includes('email') || setting.key.includes('currency') || setting.key.includes('percent') || setting.key.includes('processing') || setting.key.includes('profit') || setting.key.includes('day') || setting.key.includes('bonus') || setting.key.includes('min_') ? 'ltr' : 'rtl'}
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Broadcast Notification */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={18} className="text-[#409eff]" />
          <h3 className="text-white font-bold text-sm">{t('admin.broadcastNotification')}</h3>
        </div>
        <p className="text-white/30 text-xs mb-4">{t('admin.broadcastDesc')}</p>
        <div className="space-y-3">
          <div>
            <label className="text-white/40 text-xs block mb-1.5">{t('admin.sendToGroup')}</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: t('common.all'), color: '#409eff' },
                { value: 'active', label: t('admin.activeUsersGroup'), color: '#22c55e' },
                { value: 'inactive', label: t('admin.inactiveUsersGroup'), color: '#ef4444' },
                { value: 'verified', label: t('admin.verifiedUsersGroup'), color: '#06b6d4' },
                { value: 'unverified', label: t('admin.unverifiedUsersGroup'), color: '#f59e0b' },
              ].map((target) => (
                <button key={target.value} onClick={() => setNotifTarget(target.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${notifTarget === target.value ? 'border-opacity-30 bg-opacity-10' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'}`}
                  style={notifTarget === target.value ? { borderColor: target.color + '40', backgroundColor: target.color + '10', color: target.color } : {}}>
                  {target.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/40 text-xs block mb-1.5">{t('admin.notificationType')}</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'PLATFORM', label: t('admin.typePlatform'), color: '#06b6d4' },
                { value: 'IMPORTANT', label: t('admin.typeImportant'), color: '#ef4444' },
                { value: 'NEWS', label: t('admin.typeNews'), color: '#8b5cf6' },
                { value: 'PROFIT', label: t('admin.typeProfit'), color: '#22c55e' },
                { value: 'MAINTENANCE', label: t('admin.typeMaintenance'), color: '#6b7280' },
                { value: 'SECURITY', label: t('admin.typeSecurity'), color: '#f59e0b' },
              ].map((type) => (
                <button key={type.value} onClick={() => setNotifType(type.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${notifType === type.value ? 'border-opacity-30 bg-opacity-10' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'}`}
                  style={notifType === type.value ? { borderColor: type.color + '40', backgroundColor: type.color + '10', color: type.color } : {}}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/40 text-xs block mb-1.5">{t('admin.notificationTitle')}</label>
            <input type="text" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)}
              placeholder={t('admin.notificationPlaceholder')}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:border-[#409eff]/30 focus:outline-none transition-all text-sm" />
          </div>
          <div>
            <label className="text-white/40 text-xs block mb-1.5">{t('admin.notificationBody')}</label>
            <textarea value={notifMessage} onChange={(e) => setNotifMessage(e.target.value)}
              placeholder={t('admin.notificationBodyPlaceholder')} rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:border-[#409eff]/30 focus:outline-none transition-all text-sm resize-none" />
          </div>
          <button onClick={sendBroadcastNotification} disabled={sendingNotif || !notifTitle.trim() || !notifMessage.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-sm hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 flex items-center justify-center gap-2">
            {sendingNotif ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
            {t('admin.sendToAll')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
