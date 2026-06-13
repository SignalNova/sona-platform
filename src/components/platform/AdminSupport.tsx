'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  XCircle,
  Send,
  MessageCircle,
  X,
  Clock,
  User,
  Image as ImageIcon,
  AlertCircle,
  Flame,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface TicketUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  type: 'ticket' | 'chat';
  isAiActive?: boolean;
  handoffReason?: string;
  agent?: { id: string; name: string; title: string; specialty: string };
  createdAt: string;
  updatedAt: string;
  user: TicketUser;
  messageCount: number;
}

interface Message {
  id: string;
  content?: string;
  message?: string;
  senderType: string;
  senderName?: string;
  imageUrl?: string;
  createdAt: string;
  user?: { id: string; name: string; role: string };
}

interface TicketDetail extends Ticket {
  messages: Message[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminSupport({ isAr, getAuthHeaders }: { isAr: boolean; getAuthHeaders: () => Record<string, string> }) {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [ticketType, setTicketType] = useState<'ticket' | 'chat'>('ticket');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const priorityConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
    low: { label: t('support.low'), color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', icon: Info },
    medium: { label: t('support.medium'), color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', icon: Clock },
    high: { label: t('support.high'), color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', icon: AlertTriangle },
    urgent: { label: t('support.urgent'), color: '#dc2626', bgColor: 'rgba(220,38,38,0.12)', icon: Flame },
  };

  const statusLabels: Record<string, string> = {
    OPEN: t('support.open'),
    IN_PROGRESS: t('support.inProgress'),
    RESOLVED: t('support.resolvedStatus'),
    CLOSED: t('support.closed'),
  };

  const statusColors: Record<string, string> = {
    OPEN: 'bg-yellow-500/10 text-yellow-400',
    IN_PROGRESS: 'bg-blue-500/10 text-blue-400',
    RESOLVED: 'bg-green-500/10 text-green-400',
    CLOSED: 'bg-white/5 text-white/40',
  };

  const categoryLabels: Record<string, string> = {
    ai_chat: t('support.smartHelp'),
    human_chat: t('support.liveSupport'),
    general: t('support.general'),
    deposit: t('transactions.deposit'),
    withdrawal: t('transactions.withdrawal'),
    investment: t('transactions.investment'),
    technical: t('support.technical'),
    referral: t('support.referralCat'),
  };

  const categoryColors: Record<string, string> = {
    ai_chat: 'bg-[#409eff]/10 text-[#409eff]',
    human_chat: 'bg-emerald-500/10 text-emerald-400',
    general: 'bg-white/10 text-white/60',
    deposit: 'bg-green-500/10 text-green-400',
    withdrawal: 'bg-red-500/10 text-red-400',
    investment: 'bg-[#409eff]/10 text-[#409eff]',
    technical: 'bg-blue-500/10 text-blue-400',
    referral: 'bg-purple-500/10 text-purple-400',
  };

  const responseTemplates = [
    { label: t('support.templateThankYou'), text: t('support.templateThankYouText') },
    { label: t('support.templateNeedsTime'), text: t('support.templateNeedsTimeText') },
    { label: t('support.templateResolved'), text: t('support.templateResolvedText') },
    { label: t('support.templateTransfer'), text: t('support.templateTransferText') },
  ];

  const loadTickets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/support?${params}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter, getAuthHeaders]);

  useEffect(() => {
    loadTickets(1);
  }, [statusFilter, loadTickets]);

  // Auto-refresh tickets every 15 seconds for new conversations
  useEffect(() => {
    const interval = setInterval(() => {
      loadTickets(pagination.page);
    }, 15000);
    return () => clearInterval(interval);
  }, [pagination.page]);

  async function openTicket(ticketId: string) {
    setTicketLoading(true);
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data.ticket);
        setTicketType(data.type || 'ticket');
      }
    } catch {
      // ignore
    } finally {
      setTicketLoading(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      const res = await fetch(`/api/admin/support/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyText('');
        await openTicket(selectedTicket.id);
        await loadTickets(pagination.page);
        setToast({ type: 'success', message: t('common.success') });
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    } finally {
      setReplyLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const uploadRes = await fetch('/api/support/upload', { method: 'POST', body: formData, headers: getAuthHeaders() });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        const res = await fetch(`/api/admin/support/${selectedTicket.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ content: '', imageUrl: uploadData.imageUrl }),
        });
        if (res.ok) {
          await openTicket(selectedTicket.id);
          setToast({ type: 'success', message: t('support.imageSent') });
        }
      }
    } catch {
      setToast({ type: 'error', message: t('support.imageUploadFailed') });
    }
    setTimeout(() => setToast(null), 4000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function updateTicketStatus(ticketId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: t('support.statusUpdated') });
        await loadTickets(pagination.page);
        if (selectedTicket) await openTicket(ticketId);
      } else {
        setToast({ type: 'error', message: data.error || t('common.error') });
      }
    } catch {
      setToast({ type: 'error', message: t('common.connectionError') });
    }
    setTimeout(() => setToast(null), 4000);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getMessageContent = (msg: Message) => msg.content || msg.message || '';
  const getMessageSenderName = (msg: Message) => {
    if (msg.senderName) return msg.senderName;
    if (msg.user?.name) return msg.user.name;
    if (msg.senderType === 'admin' || msg.senderType === 'ADMIN') return t('support.adminSender');
    if (msg.senderType === 'ai_bot' || msg.senderType === 'AI') return t('support.smartHelp');
    if (msg.senderType === 'AGENT') return t('support.agentSender');
    return t('support.userSender');
  };

  const filters = [
    { id: '', label: t('common.all') },
    { id: 'OPEN', label: t('support.open') },
    { id: 'IN_PROGRESS', label: t('support.inProgress') },
    { id: 'RESOLVED', label: t('support.resolvedStatus') },
    { id: 'CLOSED', label: t('support.closed') },
  ];

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl text-sm ${toast.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Headphones size={22} className="text-[#409eff]" />
          {t('admin.manageSupport')}
        </h2>
        <p className="text-white/40 text-sm">{pagination.total} {t('support.conversationCount')}</p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-white/30 shrink-0" />
        {filters.map((f) => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusFilter === f.id ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#409eff]" /></div>
      ) : tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((ticket, i) => {
            const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
            const PriorityIcon = priority.icon;
            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="p-4 sm:p-5 rounded-xl bg-[#1f2634] border border-white/5 hover:border-[#409eff]/20 cursor-pointer transition-colors"
                onClick={() => openTicket(ticket.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gradient-to-br from-[#409eff]/20 to-[#409eff]/5 text-[#409eff]">
                      {ticket.user.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm truncate">{ticket.subject}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[ticket.status] || 'bg-white/5 text-white/40'}`}>
                          {statusLabels[ticket.status] || ticket.status}
                        </span>
                        {ticket.category && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[ticket.category] || 'bg-white/5 text-white/40'}`}>
                            {categoryLabels[ticket.category] || ticket.category}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: priority.bgColor, color: priority.color }}>
                          <PriorityIcon size={8} className="inline mr-1" />{priority.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-white/30 text-xs">{ticket.user.name}</span>
                        <span className="text-white/20 text-xs">•</span>
                        <span className="text-white/30 text-xs">{ticket.type === 'chat' ? t('support.directChat') : t('support.ticket')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-white/30 text-xs"><MessageCircle size={12} />{ticket.messageCount}</div>
                    <div className="flex items-center gap-1 text-white/20 text-xs"><Clock size={12} />{formatDate(ticket.createdAt)}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-white/30 text-sm">{t('admin.page')} {pagination.page} {t('admin.of')} {pagination.totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => loadTickets(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronRight size={16} /></button>
                <button onClick={() => loadTickets(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"><ChevronLeft size={16} /></button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl bg-[#1f2634] border border-white/5">
          <Headphones size={48} className="text-white/8 mx-auto mb-4" />
          <h3 className="text-white/50 font-bold text-lg mb-2">{t('support.noConversations')}</h3>
          <p className="text-white/30 text-sm">{t('support.noMatching')}</p>
        </motion.div>
      )}

      {/* Ticket Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTicket(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-[#1f2634] border border-[#409eff]/20 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[selectedTicket.status]}`}>
                      {statusLabels[selectedTicket.status] || selectedTicket.status}
                    </span>
                    {selectedTicket.priority && (() => {
                      const p = priorityConfig[selectedTicket.priority] || priorityConfig.medium;
                      return <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: p.bgColor, color: p.color }}>{p.label}</span>;
                    })()}
                    {ticketType === 'chat' && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedTicket.isAiActive ? 'bg-[#409eff]/10 text-[#409eff]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {selectedTicket.isAiActive ? t('support.smartHelp') : t('support.liveSupport')}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="text-white/30 hover:text-white"><X size={20} /></button>
                </div>
                <h3 className="text-white font-bold text-lg">{selectedTicket.subject}</h3>
                <div className="flex items-center gap-3 mt-2 text-white/30 text-xs">
                  <span>{selectedTicket.user?.name}</span>
                  {selectedTicket.user?.email && <span dir="ltr">{selectedTicket.user.email}</span>}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
                {ticketLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-[#409eff]" /></div>
                ) : selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                  selectedTicket.messages.map((msg) => {
                    const isAdmin = msg.senderType === 'admin' || msg.senderType === 'ADMIN';
                    const isAi = msg.senderType === 'ai_bot' || msg.senderType === 'AI';
                    const isAgent = msg.senderType === 'AGENT';
                    const content = getMessageContent(msg);
                    const senderName = getMessageSenderName(msg);

                    return (
                      <div key={msg.id} className={`p-3 rounded-xl ${isAdmin ? 'bg-[#409eff]/5 border border-[#409eff]/10 mr-8' : isAi ? 'bg-purple-500/5 border border-purple-500/10 mr-8' : isAgent ? 'bg-emerald-500/5 border border-emerald-500/10 mr-8' : 'bg-white/[0.03] border border-white/5 ml-8'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${isAdmin ? 'text-[#409eff]' : isAi ? 'text-purple-400' : isAgent ? 'text-emerald-400' : 'text-white/60'}`}>
                            {isAdmin ? `🔑 ${t('support.adminSender')}` : isAi ? `🎧 ${t('support.smartHelp')}` : isAgent ? `👨‍💻 ${t('support.agentSender')}` : senderName}
                          </span>
                          <span className="text-white/20 text-[10px]">{formatDate(msg.createdAt)}</span>
                        </div>
                        {msg.imageUrl && <div className="mb-2"><img src={msg.imageUrl} alt={t('support.image')} className="max-w-full rounded-lg max-h-48 object-cover" /></div>}
                        <p className="text-white/70 text-sm whitespace-pre-wrap">{content}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8"><MessageCircle size={32} className="text-white/8 mx-auto mb-2" /><p className="text-white/25 text-sm">{t('support.noMessages')}</p></div>
                )}
              </div>

              {/* Reply + Actions */}
              <div className="p-4 border-t border-white/5 flex-shrink-0">
                {/* Status Actions */}
                <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                  <span className="text-white/30 text-xs flex-shrink-0">{t('common.status')}:</span>
                  {[{ key: 'OPEN', label: t('support.open') }, { key: 'IN_PROGRESS', label: t('support.inProgress') }, { key: 'CLOSED', label: t('support.closed') }].map(({ key, label }) => (
                    <button key={key} onClick={() => updateTicketStatus(selectedTicket.id, key)} disabled={selectedTicket.status === key}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap disabled:opacity-30 ${selectedTicket.status === key ? 'bg-[#409eff]/10 text-[#409eff] border border-[#409eff]/20' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Response Templates */}
                <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                  <span className="text-white/30 text-[10px] flex-shrink-0">{t('support.templates')}:</span>
                  {responseTemplates.map((tpl, i) => (
                    <button key={i} onClick={() => setReplyText(tpl.text)}
                      className="px-2 py-1 rounded-lg text-[9px] font-medium whitespace-nowrap bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                      {tpl.label}
                    </button>
                  ))}
                </div>

                {/* Reply Input */}
                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <ImageIcon size={18} />
                  </button>
                  <input
                    type="text"
                    placeholder={t('support.replyPlaceholder')}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-white placeholder-white/30 text-sm focus:border-[#409eff]/30 focus:outline-none transition-colors"
                  />
                  <button onClick={sendReply} disabled={replyLoading || !replyText.trim()}
                    className="p-3 rounded-xl bg-[#409eff]/10 text-[#409eff] hover:bg-[#409eff]/20 transition-all disabled:opacity-50">
                    {replyLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
