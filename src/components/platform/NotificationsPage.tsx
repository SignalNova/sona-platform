'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  Clock,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  Shield,
  Info,
  AlertTriangle,
  Trash2,
  Loader2,
  Zap,
  Newspaper,
  Megaphone,
  Wrench,
  AlertCircle,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: string | null;
  createdAt: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string; labelEn: string }> = {
  PROFIT: { icon: TrendingUp, color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', label: 'أرباح', labelEn: 'Profit' },
  DEPOSIT: { icon: ArrowDownToLine, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)', label: 'إيداع', labelEn: 'Deposit' },
  WITHDRAWAL: { icon: ArrowUpFromLine, color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', label: 'سحب', labelEn: 'Withdrawal' },
  SIGNAL: { icon: Zap, color: '#409eff', bgColor: 'rgba(201,168,76,0.08)', label: 'إشارات', labelEn: 'Signal' },
  NEWS: { icon: Newspaper, color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.08)', label: 'أخبار', labelEn: 'News' },
  PLATFORM: { icon: Megaphone, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.08)', label: 'منصة', labelEn: 'Platform' },
  MAINTENANCE: { icon: Wrench, color: '#6b7280', bgColor: 'rgba(107,114,128,0.08)', label: 'صيانة', labelEn: 'Maintenance' },
  IMPORTANT: { icon: AlertCircle, color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', label: 'مهم', labelEn: 'Important' },
  REFERRAL: { icon: Gift, color: '#409eff', bgColor: 'rgba(64,158,255,0.08)', label: 'إحالات', labelEn: 'Referral' },
  SECURITY: { icon: Shield, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', label: 'أمان', labelEn: 'Security' },
  SYSTEM: { icon: Info, color: '#6b7280', bgColor: 'rgba(107,114,128,0.08)', label: 'نظام', labelEn: 'System' },
};

export default function NotificationsPage() {
  const { user } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch { /* ignore */ }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch { /* ignore */ }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  };

  const filteredNotifications = notifications
    .filter((n) => filter === 'all' || !n.isRead)
    .filter((n) => typeFilter === 'all' || n.type === typeFilter);

  // Get unique notification types from data
  const activeTypes = [...new Set(notifications.map(n => n.type))];

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('common.now');
    if (minutes < 60) return t('common.minutesAgo', { count: minutes });
    if (hours < 24) return t('common.hoursAgo', { count: hours });
    return t('common.daysAgo', { count: days });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#409eff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={22} className="text-[#409eff]" />
            {t('nav.notifications')}
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-bold">{unreadCount}</span>
            )}
          </h2>
          <p className="text-white/30 text-sm mt-0.5">{t('notifications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 text-xs font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
            >
              <CheckCheck size={14} />
              {t('notifications.markAllRead')}
            </button>
          )}
          <button
            onClick={loadNotifications}
            className="p-2 rounded-lg text-white/30 hover:text-[#409eff] hover:bg-[#409eff]/5 transition-all"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            filter === 'all'
              ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20'
              : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60'
          }`}
        >
          {t('common.all')} ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            filter === 'unread'
              ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20'
              : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60'
          }`}
        >
          {t('notifications.unread')} ({unreadCount})
        </button>
        
        {/* Type Filter Toggle */}
        <button
          onClick={() => setShowTypeFilter(!showTypeFilter)}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            typeFilter !== 'all'
              ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20'
              : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60'
          }`}
        >
          <Filter size={12} />
          {t('notifications.filter')}
        </button>
      </div>

      {/* Type Filter */}
      <AnimatePresence>
        {showTypeFilter && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setTypeFilter('all'); setShowTypeFilter(false); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  typeFilter === 'all'
                    ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20'
                    : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50'
                }`}
              >
                {t('common.all')}
              </button>
              {activeTypes.map((type) => {
                const config = typeConfig[type];
                if (!config) return null;
                return (
                  <button
                    key={type}
                    onClick={() => { setTypeFilter(type); setShowTypeFilter(false); }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                      typeFilter === type
                        ? 'bg-[#409eff]/15 text-[#409eff] border border-[#409eff]/20'
                        : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50'
                    }`}
                  >
                    <config.icon size={10} style={{ color: config.color }} />
                    {isRTL ? config.label : config.labelEn}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Type Filter Badge */}
      {typeFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs">{t('support.filteredBy')}</span>
          <button
            onClick={() => setTypeFilter('all')}
            className="px-2.5 py-1 rounded-lg bg-[#409eff]/10 border border-[#409eff]/20 text-[#409eff] text-xs font-medium flex items-center gap-1.5 hover:bg-[#409eff]/15 transition-all"
          >
            {typeConfig[typeFilter]?.icon && (() => {
              const Icon = typeConfig[typeFilter].icon;
              return <Icon size={10} />;
            })()}
            {isRTL ? typeConfig[typeFilter]?.label : typeConfig[typeFilter]?.labelEn}
            <X size={8} className="text-[#409eff]/50" />
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredNotifications.map((notification, i) => {
            const config = typeConfig[notification.type] || typeConfig.PLATFORM;
            const Icon = config.icon;
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => !notification.isRead && markAsRead(notification.id)}
                className={`flex items-start gap-3 p-4 rounded-xl transition-all cursor-pointer group ${
                  notification.isRead
                    ? 'bg-[#1f2634] border border-white/5'
                    : 'bg-[#1f2634] border border-[#409eff]/10 hover:border-[#409eff]/20'
                }`}
              >
                <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: config.bgColor }}>
                  <Icon size={16} style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-medium ${notification.isRead ? 'text-white/60' : 'text-white'}`}>
                      {notification.title}
                    </span>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-[#409eff] shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${notification.isRead ? 'text-white/25' : 'text-white/40'}`}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1 text-white/15 text-[10px]">
                      <Clock size={10} />
                      {formatTimeAgo(notification.createdAt)}
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: config.bgColor, color: config.color }}>
                      {isRTL ? config.label : config.labelEn}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                  className="p-1.5 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-500/5 transition-all shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-16">
            <BellOff size={40} className="text-white/8 mx-auto mb-3" />
            <p className="text-white/25 text-sm">
              {typeFilter !== 'all'
                ? t('notifications.noNotificationsOfType')
                : t('notifications.noNotifications')
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
