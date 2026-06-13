'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Loader2,
  Play,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Activity,
  RefreshCw,
  Brain,
  Database,
  Server,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';

interface AgentLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface ScheduleItem {
  id: string;
  key: string;
  task: string;
  cron: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface EndpointHealth {
  name: string;
  path: string;
  status: 'healthy' | 'degraded' | 'unreachable' | 'error';
  statusCode: number;
  responseTime: number;
  error?: string;
}

export default function AdminEngineerAgent({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [scheduleCronInput, setScheduleCronInput] = useState<Record<string, string>>({
    schedule_diagnostics: '0 */6 * * *',
    schedule_security_scan: '0 2 * * *',
  });

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/engineer-agent', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedules() {
    setSchedulesLoading(true);
    try {
      const res = await fetch('/api/admin/engineer-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'get_schedules' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.schedules) {
          setSchedules(data.schedules);
        }
      }
    } catch {
      // ignore
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function runAction(action: string, extraBody?: Record<string, any>) {
    setActionLoading(action);
    setResult(null);
    try {
      const res = await fetch('/api/admin/engineer-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action, ...extraBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ action, data });
        showToast('success', t('common.success'));
        await loadStatus();
        if (action.startsWith('schedule_') || action === 'toggle_schedule') {
          await loadSchedules();
        }
      } else {
        showToast('error', data.error || t('common.error'));
      }
    } catch {
      showToast('error', t('common.connectionError'));
    } finally {
      setActionLoading(null);
    }
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleToggleSchedule(scheduleKey: string, currentEnabled: boolean) {
    await runAction('toggle_schedule', { scheduleKey, enabled: !currentEnabled });
  }

  async function handleScheduleAction(action: string) {
    const cron = scheduleCronInput[action];
    if (!cron) return;
    await runAction(action, { schedule: cron });
  }

  async function handleCleanup() {
    setShowCleanupConfirm(false);
    await runAction('cleanup_database');
  }

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [isAr]);

  // ──── Action definitions ────
  const coreActions = [
    {
      key: 'diagnostics',
      label: t('agent.engineer.runDiagnostics'),
      icon: Zap,
      color: '#8b5cf6',
      desc: t('agent.engineer.runDiagnosticsDesc'),
    },
    {
      key: 'security_scan',
      label: t('agent.engineer.securityScan'),
      icon: Shield,
      color: '#ef4444',
      desc: t('agent.engineer.securityScanDesc'),
    },
    {
      key: 'fix_errors',
      label: t('agent.engineer.fixErrors'),
      icon: Wrench,
      color: '#f59e0b',
      desc: t('agent.engineer.fixErrorsDesc'),
    },
    {
      key: 'daily_report',
      label: t('agent.engineer.dailyReport'),
      icon: FileText,
      color: '#06b6d4',
      desc: t('agent.engineer.dailyReportDesc'),
    },
  ];

  const advancedActions = [
    {
      key: 'genius_mode',
      label: t('agent.engineer.geniusMode'),
      icon: Brain,
      color: '#a855f7',
      desc: t('agent.engineer.geniusModeDesc'),
    },
    {
      key: 'performance_optimization',
      label: t('agent.engineer.performanceOptimization'),
      icon: BarChart3,
      color: '#10b981',
      desc: t('agent.engineer.performanceOptimizationDesc'),
    },
    {
      key: 'monitor_api_health',
      label: t('agent.engineer.apiHealthMonitor'),
      icon: Server,
      color: '#3b82f6',
      desc: t('agent.engineer.apiHealthMonitorDesc'),
    },
    {
      key: 'backup_report',
      label: t('agent.engineer.backupReport'),
      icon: Database,
      color: '#f97316',
      desc: t('agent.engineer.backupReportDesc'),
    },
  ];

  // ──── Loading state ────
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
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              toast.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Wrench size={22} className="text-[#409eff]" />
              {t('agent.engineer.title')}
            </h2>
            <p className="text-white/40 text-sm">{t('agent.engineer.subtitle')}</p>
          </div>
          <button
            onClick={loadStatus}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-medium hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
          >
            <RefreshCw size={14} />
            {t('common.refresh')}
          </button>
        </div>
      </motion.div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('agent.engineer.status'), value: agentStatus?.status || 'running', color: '#22c55e', icon: Activity },
          { label: t('agent.engineer.errorsFound'), value: agentStatus?.errorsFound || 0, color: '#ef4444', icon: AlertTriangle },
          { label: t('agent.engineer.errorsFixed'), value: agentStatus?.errorsFixed || 0, color: '#22c55e', icon: CheckCircle },
          { label: t('agent.engineer.performanceScore'), value: '98%', color: '#409eff', icon: Zap },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-[#1f2634] border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: s.color }} />
                <span className="text-white/30 text-xs">{s.label}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: s.color }}>
                {s.value}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Last Check Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-[#1f2634] border border-white/5">
          <span className="text-white/30 text-xs">{t('agent.engineer.lastCheck')}</span>
          <div className="text-white/60 text-sm mt-1">
            {agentStatus?.lastCheck ? formatDate(agentStatus.lastCheck) : '-'}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#1f2634] border border-white/5">
          <span className="text-white/30 text-xs">{t('agent.engineer.lastSecurityScan')}</span>
          <div className="text-white/60 text-sm mt-1">
            {agentStatus?.lastSecurityScan ? formatDate(agentStatus.lastSecurityScan) : '-'}
          </div>
        </div>
      </div>

      {/* Core Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5"
      >
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Play size={14} className="text-[#409eff]" />
          {t('admin.quickActions')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coreActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => runAction(action.key)}
                disabled={actionLoading === action.key}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all disabled:opacity-50 text-right"
              >
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: action.color + '15', color: action.color }}
                >
                  {actionLoading === action.key ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Icon size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-sm font-medium">{action.label}</div>
                  <div className="text-white/25 text-[10px]">{action.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Advanced Actions */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5"
      >
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Brain size={14} className="text-purple-400" />
          {t('agent.engineer.advancedActions')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {advancedActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => runAction(action.key)}
                disabled={actionLoading === action.key}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all disabled:opacity-50 text-right"
              >
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: action.color + '15', color: action.color }}
                >
                  {actionLoading === action.key ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Icon size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-sm font-medium">{action.label}</div>
                  <div className="text-white/25 text-[10px]">{action.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Database Cleanup with confirmation */}
        <div className="mt-3">
          <button
            onClick={() => setShowCleanupConfirm(true)}
            disabled={actionLoading === 'cleanup_database'}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/[0.04] border border-red-500/10 hover:border-red-500/20 transition-all disabled:opacity-50 text-right w-full"
          >
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              {actionLoading === 'cleanup_database' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-red-300/80 text-sm font-medium">
                {t('agent.engineer.cleanupDatabase')}
              </div>
              <div className="text-white/25 text-[10px]">
                {t('agent.engineer.cleanupDatabaseDesc')}
              </div>
            </div>
          </button>

          {/* Cleanup Confirmation Dialog */}
          <AnimatePresence>
            {showCleanupConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 p-4 rounded-xl bg-red-500/[0.06] border border-red-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-red-300 text-sm font-medium">
                    {t('agent.engineer.cleanupConfirmTitle')}
                  </span>
                </div>
                <p className="text-white/40 text-xs mb-3">
                  {t('agent.engineer.cleanupConfirmDesc')}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCleanup}
                    className="px-4 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-all"
                  >
                    {t('common.confirm')}
                  </button>
                  <button
                    onClick={() => setShowCleanupConfirm(false)}
                    className="px-4 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 text-xs font-medium hover:text-white/60 transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Scheduled Tasks Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5"
      >
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Calendar size={14} className="text-amber-400" />
          {t('agent.engineer.scheduledTasks')}
        </h3>

        {/* Existing Schedules */}
        <div className="space-y-3 mb-4">
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <div
                key={schedule.key}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <div
                  className={`p-1.5 rounded-lg ${
                    schedule.enabled ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'
                  }`}
                >
                  <Clock size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs font-medium">
                      {schedule.task === 'diagnostics'
                        ? t('agent.engineer.diagnosticsSchedule')
                        : t('agent.engineer.securityScanSchedule')}
                    </span>
                    <span className="text-white/25 text-[10px] font-mono">{schedule.cron}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[10px] ${schedule.enabled ? 'text-green-400/60' : 'text-white/20'}`}
                    >
                      {schedule.enabled ? t('common.enabled') : t('common.disabled')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleSchedule(schedule.key, schedule.enabled)}
                  disabled={actionLoading === 'toggle_schedule'}
                  className="shrink-0"
                >
                  {schedule.enabled ? (
                    <ToggleRight size={22} className="text-green-400 hover:text-green-300 transition-colors" />
                  ) : (
                    <ToggleLeft size={22} className="text-white/20 hover:text-white/40 transition-colors" />
                  )}
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <Calendar size={24} className="text-white/10 mx-auto mb-2" />
              <p className="text-white/20 text-xs">{t('agent.engineer.noScheduledTasks')}</p>
            </div>
          )}
        </div>

        {/* Add Schedule Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Schedule Diagnostics */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-[#8b5cf6]" />
              <span className="text-white/60 text-xs font-medium">
                {t('agent.engineer.scheduleDiagnostics')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scheduleCronInput.schedule_diagnostics}
                onChange={(e) =>
                  setScheduleCronInput((prev) => ({ ...prev, schedule_diagnostics: e.target.value }))
                }
                placeholder="0 */6 * * *"
                className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-[10px] font-mono placeholder:text-white/15 focus:outline-none focus:border-[#409eff]/30"
              />
              <button
                onClick={() => handleScheduleAction('schedule_diagnostics')}
                disabled={actionLoading === 'schedule_diagnostics'}
                className="px-3 py-1.5 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] text-[10px] font-medium hover:bg-[#8b5cf6]/20 transition-all disabled:opacity-50"
              >
                {actionLoading === 'schedule_diagnostics' ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  t('common.apply')
                )}
              </button>
            </div>
          </div>

          {/* Schedule Security Scan */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={12} className="text-[#ef4444]" />
              <span className="text-white/60 text-xs font-medium">
                {t('agent.engineer.scheduleSecurityScan')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scheduleCronInput.schedule_security_scan}
                onChange={(e) =>
                  setScheduleCronInput((prev) => ({ ...prev, schedule_security_scan: e.target.value }))
                }
                placeholder="0 2 * * *"
                className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-[10px] font-mono placeholder:text-white/15 focus:outline-none focus:border-[#409eff]/30"
              />
              <button
                onClick={() => handleScheduleAction('schedule_security_scan')}
                disabled={actionLoading === 'schedule_security_scan'}
                className="px-3 py-1.5 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-[10px] font-medium hover:bg-[#ef4444]/20 transition-all disabled:opacity-50"
              >
                {actionLoading === 'schedule_security_scan' ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  t('common.apply')
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Result Display */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="rounded-xl bg-[#1f2634] border overflow-hidden"
            style={{ borderColor: getResultBorderColor(result.action) }}
          >
            {/* Genius Mode Special Display */}
            {result.action === 'genius_mode' && result.data?.aiAnalysis ? (
              <GeniusModeResult data={result.data} t={t} formatDate={formatDate} />
            ) : result.action === 'monitor_api_health' && result.data?.endpoints ? (
              <ApiHealthResult data={result.data} t={t} />
            ) : result.action === 'performance_optimization' && result.data?.tableSizes ? (
              <PerformanceResult data={result.data} t={t} />
            ) : result.action === 'cleanup_database' ? (
              <CleanupResult data={result.data} t={t} />
            ) : result.action === 'backup_report' ? (
              <BackupResult data={result.data} t={t} />
            ) : (
              /* Default Result Display */
              <div className="p-5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400" />
                  {t('agent.engineer.result')}:{' '}
                  {getActionLabel(result.action, t)}
                </h3>
                <pre
                  className="text-white/60 text-xs overflow-auto max-h-64 bg-white/[0.02] p-3 rounded-lg"
                  dir="ltr"
                >
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Logs */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-5 rounded-xl bg-[#1f2634] border border-white/5"
      >
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Clock size={16} className="text-[#409eff]" />
          {t('agent.engineer.logs')}
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {agentStatus?.recentLogs?.length > 0 ? (
            agentStatus.recentLogs.map((log: AgentLog) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#409eff] shrink-0" />
                <span className="text-white/50 flex-1 truncate">
                  {log.action}: {log.details || '-'}
                </span>
                <span className="text-white/20 shrink-0">{formatDate(log.createdAt)}</span>
              </div>
            ))
          ) : (
            <p className="text-white/20 text-xs text-center py-4">{t('agent.engineer.noLogs')}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── Genius Mode Result Card ───
function GeniusModeResult({ data, t, formatDate }: { data: any; t: (k: string) => string; formatDate: (d: string) => string }) {
  const systemData = data.systemData;
  const aiAnalysis: string = data.aiAnalysis || '';

  // Try to extract health score from AI analysis
  const healthScoreMatch = aiAnalysis.match(/(?:health|score|overall)[:\s]*(\d{1,3})/i);
  const healthScore = healthScoreMatch ? parseInt(healthScoreMatch[1]) : null;

  // Parse AI analysis into sections
  const analysisSections = aiAnalysis
    .split(/\n(?=\d+\.\s+\*\*|\*\*\d+\.|##|\n#{1,3}\s)/)
    .filter(Boolean);

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          {t('agent.engineer.geniusModeResult')}
        </h3>
        <span className="text-white/20 text-[10px] font-mono">{data.model}</span>
      </div>

      {/* Health Score & Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {healthScore !== null && (
          <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/[0.02] border border-purple-500/20">
            <div className="text-white/40 text-[10px] mb-1">{t('agent.engineer.healthScore')}</div>
            <div
              className="text-2xl font-bold"
              style={{ color: healthScore >= 80 ? '#22c55e' : healthScore >= 50 ? '#f59e0b' : '#ef4444' }}
            >
              {healthScore}
              <span className="text-sm text-white/20">/100</span>
            </div>
          </div>
        )}
        {systemData?.database && (
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-white/40 text-[10px] mb-1">DB</div>
            <div className="text-sm font-bold" style={{ color: systemData.database.status === 'healthy' ? '#22c55e' : '#ef4444' }}>
              {systemData.database.status}
            </div>
            <div className="text-white/20 text-[10px]">{systemData.database.responseTimeMs}ms</div>
          </div>
        )}
        {systemData?.errors && (
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-white/40 text-[10px] mb-1">{t('agent.engineer.errors7d')}</div>
            <div className="text-sm font-bold text-red-400">{systemData.errors.last7Days}</div>
            <div className="text-white/20 text-[10px]">{systemData.logs?.errorRate} rate</div>
          </div>
        )}
        {systemData?.financials && (
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-white/40 text-[10px] mb-1">{t('agent.engineer.totalUsers')}</div>
            <div className="text-sm font-bold text-[#409eff]">{systemData.database?.totalUsers || 0}</div>
          </div>
        )}
      </div>

      {/* Critical Issues from system data */}
      {systemData?.errors?.recent?.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/[0.04] border border-red-500/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-red-300 text-xs font-medium">{t('agent.engineer.criticalIssues')}</span>
          </div>
          <div className="space-y-1">
            {systemData.errors.recent.slice(0, 3).map((err: any, idx: number) => (
              <div key={idx} className="text-white/40 text-[10px] truncate">
                <span className="text-red-400/60">•</span> {err.action}: {err.details || '-'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis Text */}
      <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="text-white/50 text-xs whitespace-pre-wrap leading-relaxed" dir="ltr">
          {aiAnalysis}
        </div>
      </div>

      <div className="text-white/15 text-[10px] text-right">
        {t('agent.engineer.generatedAt')}: {data.generatedAt ? formatDate(data.generatedAt) : '-'}
      </div>
    </div>
  );
}

// ─── API Health Result ───
function ApiHealthResult({ data, t }: { data: any; t: (k: string) => string }) {
  const { overallStatus, summary, endpoints } = data;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Server size={16} className="text-blue-400" />
          {t('agent.engineer.apiHealthResult')}
        </h3>
        <div className="flex items-center gap-2">
          <div
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              overallStatus === 'healthy'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : overallStatus === 'degraded'
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {overallStatus?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
          <div className="text-white/30 text-[10px]">{t('common.total')}</div>
          <div className="text-white/70 text-sm font-bold">{summary?.total || 0}</div>
        </div>
        <div className="p-2 rounded-lg bg-green-500/[0.04] border border-green-500/10 text-center">
          <div className="text-green-400/50 text-[10px]">Healthy</div>
          <div className="text-green-400 text-sm font-bold">{summary?.healthy || 0}</div>
        </div>
        <div className="p-2 rounded-lg bg-yellow-500/[0.04] border border-yellow-500/10 text-center">
          <div className="text-yellow-400/50 text-[10px]">Degraded</div>
          <div className="text-yellow-400 text-sm font-bold">{summary?.degraded || 0}</div>
        </div>
        <div className="p-2 rounded-lg bg-red-500/[0.04] border border-red-500/10 text-center">
          <div className="text-red-400/50 text-[10px]">Unreachable</div>
          <div className="text-red-400 text-sm font-bold">{summary?.unreachable || 0}</div>
        </div>
      </div>

      {/* Endpoint List */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {(endpoints as EndpointHealth[]).map((ep, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.01] border border-white/[0.03] text-xs"
          >
            {ep.status === 'healthy' ? (
              <CheckCircle size={12} className="text-green-400 shrink-0" />
            ) : ep.status === 'degraded' ? (
              <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            ) : (
              <XCircle size={12} className="text-red-400 shrink-0" />
            )}
            <span className="text-white/50 flex-1 truncate">{ep.name}</span>
            <span className="text-white/20 text-[10px] font-mono shrink-0">{ep.path}</span>
            <span className="text-white/15 text-[10px] shrink-0 w-12 text-right">{ep.responseTime}ms</span>
            <span
              className={`text-[10px] font-medium shrink-0 w-6 text-right ${
                ep.status === 'healthy'
                  ? 'text-green-400'
                  : ep.status === 'degraded'
                    ? 'text-yellow-400'
                    : 'text-red-400'
              }`}
            >
              {ep.statusCode}
            </span>
          </div>
        ))}
      </div>

      <div className="text-white/15 text-[10px]">
        {t('agent.engineer.avgResponseTime')}: {summary?.avgResponseTimeMs || 0}ms
      </div>
    </div>
  );
}

// ─── Performance Optimization Result ───
function PerformanceResult({ data, t }: { data: any; t: (k: string) => string }) {
  const { database, tableSizes, concerns, recommendations, suggestedIndexes } = data;

  return (
    <div className="p-5 space-y-4">
      <h3 className="text-white font-bold text-sm flex items-center gap-2">
        <BarChart3 size={16} className="text-emerald-400" />
        {t('agent.engineer.performanceResult')}
      </h3>

      {/* DB Status */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <Database size={14} className={database?.status === 'fast' ? 'text-green-400' : database?.status === 'normal' ? 'text-yellow-400' : 'text-red-400'} />
        <div>
          <span className="text-white/50 text-xs">{t('agent.engineer.dbResponseTime')}</span>
          <div className="flex items-center gap-2">
            <span className="text-white/80 text-sm font-bold">{database?.responseTimeMs}ms</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                database?.status === 'fast'
                  ? 'bg-green-500/10 text-green-400'
                  : database?.status === 'normal'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
              }`}
            >
              {database?.status?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Table Sizes */}
      <div>
        <div className="text-white/40 text-[10px] mb-2">{t('agent.engineer.tableSizes')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(tableSizes || {}).map(([table, count]) => (
            <div key={table} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.03] text-center">
              <div className="text-white/25 text-[10px] capitalize">{table}</div>
              <div className="text-white/60 text-xs font-bold">{(count as number).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-500/[0.04] border border-yellow-500/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} className="text-yellow-400" />
            <span className="text-yellow-300 text-xs font-medium">{t('agent.engineer.recommendations')}</span>
          </div>
          <ul className="space-y-1">
            {recommendations.map((rec: string, idx: number) => (
              <li key={idx} className="text-white/40 text-[10px]">
                <span className="text-yellow-400/60">{idx + 1}.</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Indexes */}
      {suggestedIndexes?.length > 0 && (
        <div className="p-3 rounded-lg bg-blue-500/[0.04] border border-blue-500/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-blue-400" />
            <span className="text-blue-300 text-xs font-medium">{t('agent.engineer.suggestedIndexes')}</span>
          </div>
          <ul className="space-y-1">
            {suggestedIndexes.map((idx_rec: string, idx: number) => (
              <li key={idx} className="text-white/40 text-[10px]">
                <span className="text-blue-400/60">•</span> {idx_rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Cleanup Result ───
function CleanupResult({ data, t }: { data: any; t: (k: string) => string }) {
  const { cleaned, totalDeleted, cutoffDate } = data;

  return (
    <div className="p-5 space-y-4">
      <h3 className="text-white font-bold text-sm flex items-center gap-2">
        <Trash2 size={16} className="text-red-400" />
        {t('agent.engineer.cleanupResult')}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-red-500/[0.06] border border-red-500/10 text-center">
          <div className="text-white/30 text-[10px]">{t('agent.engineer.totalDeleted')}</div>
          <div className="text-red-400 text-xl font-bold">{totalDeleted}</div>
        </div>
        {Object.entries(cleaned || {}).map(([type, count]) => (
          <div key={type} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
            <div className="text-white/25 text-[10px] capitalize">
              {type.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div className="text-white/60 text-sm font-bold">{(count as number).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="text-white/15 text-[10px]">
        {t('agent.engineer.cutoffDate')}: {cutoffDate ? new Date(cutoffDate).toLocaleDateString() : '-'}
      </div>
    </div>
  );
}

// ─── Backup Report Result ───
function BackupResult({ data, t }: { data: any; t: (k: string) => string }) {
  return (
    <div className="p-5 space-y-4">
      <h3 className="text-white font-bold text-sm flex items-center gap-2">
        <Database size={16} className="text-orange-400" />
        {t('agent.engineer.backupReportResult')}
      </h3>
      <pre className="text-white/60 text-xs overflow-auto max-h-64 bg-white/[0.02] p-3 rounded-lg" dir="ltr">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function getResultBorderColor(action: string): string {
  const colors: Record<string, string> = {
    genius_mode: 'rgba(168, 85, 247, 0.3)',
    performance_optimization: 'rgba(16, 185, 129, 0.3)',
    monitor_api_health: 'rgba(59, 130, 246, 0.3)',
    backup_report: 'rgba(249, 115, 22, 0.3)',
    cleanup_database: 'rgba(239, 68, 68, 0.3)',
    diagnostics: 'rgba(139, 92, 246, 0.3)',
    security_scan: 'rgba(239, 68, 68, 0.3)',
    fix_errors: 'rgba(245, 158, 11, 0.3)',
    daily_report: 'rgba(6, 182, 212, 0.3)',
  };
  return colors[action] || 'rgba(64, 158, 255, 0.2)';
}

function getActionLabel(action: string, t: (k: string) => string): string {
  const labels: Record<string, string> = {
    diagnostics: t('agent.engineer.runDiagnostics'),
    security_scan: t('agent.engineer.securityScan'),
    fix_errors: t('agent.engineer.fixErrors'),
    daily_report: t('agent.engineer.dailyReport'),
    genius_mode: t('agent.engineer.geniusMode'),
    performance_optimization: t('agent.engineer.performanceOptimization'),
    monitor_api_health: t('agent.engineer.apiHealthMonitor'),
    backup_report: t('agent.engineer.backupReport'),
    cleanup_database: t('agent.engineer.cleanupDatabase'),
  };
  return labels[action] || action;
}
