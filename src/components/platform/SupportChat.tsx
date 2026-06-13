'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Plus,
  Loader2,
  Clock,
  CheckCircle,
  Check,
  HeadphonesIcon,
  Paperclip,
  XCircle,
  Sparkles,
  UserCheck,
  Bot,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string;
  senderName?: string;
  message: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: string;
}

// Message delivery status type
type DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read';

// Extended message with delivery tracking
interface MessageWithStatus extends ChatMessage {
  deliveryStatus?: DeliveryStatus;
}

interface SupportInfo {
  level: number;
  name: string;
  nameAr: string;
  titleAr?: string;
  avatar: string;
  status: string;
  statusIcon: string;
  isHuman: boolean;
}

interface Conversation {
  id: string;
  userId: string;
  agentId?: string;
  status: string;
  isAiActive: boolean;
  supportLevel: number;
  handoffReason?: string;
  createdAt: string;
  updatedAt: string;
  agent?: {
    id: string;
    name: string;
    nameEn: string;
    title: string;
    titleEn: string;
    avatar: string;
    specialty: string;
  };
  messages: ChatMessage[];
}

// Typing state enum for better UX - includes "pause" phase
type TypingPhase = 'idle' | 'reading' | 'thinking' | 'typing' | 'paused' | 'typingAgain';

// Level-specific config - real Arabic names + correct avatars
const LEVEL_CONFIG: Record<number, {
  avatar: string;
  color: string;
  name: string;
  title: string;
  typingTexts: { reading: string; thinking: string; typing: string; paused: string; typingAgain: string };
}> = {
  1: {
    avatar: '/smart-help-avatar.png',
    color: '#409eff',
    name: 'المساعدة الذكية',
    title: 'المساعدة الذكية',
    typingTexts: {
      reading: 'المساعدة الذكية بتقرأ رسالتك...',
      thinking: 'المساعدة الذكية بتفكر بالرد المناسب...',
      typing: 'المساعدة الذكية بتكتب رد...',
      paused: 'المساعدة الذكية توقفت لحظة...',
      typingAgain: 'المساعدة الذكية بتكمل الكتابة...',
    },
  },
  2: {
    avatar: '/sona-support-avatar.png',
    color: '#04cf99',
    name: 'دعم SONA',
    title: 'دعم SONA',
    typingTexts: {
      reading: 'دعم SONA بيقرأ رسالتك بتمعن...',
      thinking: 'دعم SONA بحلل الموضوع وبيفكر بالحل...',
      typing: 'دعم SONA بيكتب رد مفصل...',
      paused: 'دعم SONA توقف لحظة...',
      typingAgain: 'دعم SONA بيكمل الكتابة...',
    },
  },
  3: {
    avatar: '/sona-support-avatar.png',
    color: '#e6a23c',
    name: 'دعم SONA المباشر',
    title: 'دعم SONA المباشر',
    typingTexts: {
      reading: 'دعم SONA المباشر بيقرأ رسالتك بعناية...',
      thinking: 'دعم SONA المباشر بيراجع الموضوع بالكامل...',
      typing: 'دعم SONA المباشر بيكتب رد...',
      paused: 'دعم SONA المباشر توقف لحظة...',
      typingAgain: 'دعم SONA المباشر بيكمل الكتابة...',
    },
  },
};

// Get level from message metadata
function getMsgLevel(msg: ChatMessage): number {
  if (msg.metadata) {
    try {
      return JSON.parse(msg.metadata).level || 1;
    } catch {}
  }
  if (msg.senderType === 'AGENT') return 2;
  if (msg.senderType === 'ADMIN') return 3;
  return 1;
}

export default function SupportChat() {
  const { user } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingPhase, setTypingPhase] = useState<TypingPhase>('idle');
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);
  const [showEscalationNotice, setShowEscalationNotice] = useState<{ from: string; to: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // messagesEndRef removed — scrollTop handles scrolling (RTL-safe)
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const forceScrollRef = useRef(false);

  // Image preview state
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null);

  // Queue for sending messages while bot is typing
  const [messageQueue, setMessageQueue] = useState<string[]>([]);

  // Rating popup state
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  const [deEscalationNotice, setDeEscalationNotice] = useState<string | null>(null);

  // Current support level - determined by supportInfo from API
  const currentLevel = supportInfo?.level || 1;
  const levelConfig = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[1];

  const scrollToBottom = useCallback(() => {
    // Double RAF + scrollTop = RTL-safe (scrollIntoView causes jumps in RTL)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    })
  }, [])

  // Scroll to bottom when messages change or typing starts
  // CRITICAL: useLayoutEffect fires BEFORE browser paint, preventing the "jump up" flicker
  useLayoutEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      // ALWAYS scroll to bottom - especially during active sending
      container.scrollTop = container.scrollHeight
    }
    scrollToBottom()
    const t1 = setTimeout(scrollToBottom, 50)
    const t2 = setTimeout(scrollToBottom, 150)
    const t3 = setTimeout(scrollToBottom, 300)
    const t4 = setTimeout(scrollToBottom, 500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [messages, typingPhase, scrollToBottom])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // SECURITY: Enforce max length on client side (2000 chars)
    const value = e.target.value.substring(0, 2000);
    setMessageInput(value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
  };

  const loadConversation = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/support');
      if (res.ok) {
        const data = await res.json();
        const conv: Conversation | null = data.conversation || null;
        if (conv) {
          setConversation(conv);
          setMessages((conv.messages || []).map(m => ({
            ...m,
            deliveryStatus: m.isRead ? 'read' as DeliveryStatus : 'delivered' as DeliveryStatus,
          })));
        }
        if (data.supportInfo) {
          setSupportInfo(data.supportInfo);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadConversation();
    }
  }, [isOpen, user, loadConversation]);

  // Auto-poll for new messages every 5 seconds when chat is open
  useEffect(() => {
    if (!isOpen || !user || !conversation || conversation.status === 'CLOSED') return;
    const interval = setInterval(async () => {
      // Skip polling while user is actively sending a message
      if (sendingRef.current) return;
      try {
        const res = await fetch('/api/support');
        if (res.ok) {
          const data = await res.json();
          if (data.conversation) {
            const serverMsgs = data.conversation.messages || [];
            
            // Check if user is near bottom before updating
            const container = messagesContainerRef.current;
            const isNearBottom = container
              ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 150
              : true;
            
            // Merge: find messages from server that we don't have locally
            setMessages(prev => {
              const localIds = new Set(prev.map(m => m.id));
              const trulyNewMsgs = serverMsgs.filter((m: any) => !localIds.has(m.id));
              
              if (trulyNewMsgs.length === 0) return prev; // No change, skip re-render
              
              // Append only new messages with delivery status
              const withStatus = trulyNewMsgs.map((m: any) => ({
                ...m,
                deliveryStatus: m.isRead ? 'read' as DeliveryStatus : 'delivered' as DeliveryStatus,
              }));
              return [...prev, ...withStatus];
            });
            
            setConversation(data.conversation);
            if (data.supportInfo) setSupportInfo(data.supportInfo);
            
            // Only scroll to bottom if user was already near bottom
            if (isNearBottom) {
              setTimeout(scrollToBottom, 100);
            }
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen, user, conversation?.id, conversation?.status, scrollToBottom]);

  // Process message queue - allows user to send multiple messages while bot is "typing"
  useEffect(() => {
    if (messageQueue.length > 0 && typingPhase === 'idle' && !isSending) {
      const nextMsg = messageQueue[0];
      setMessageQueue(prev => prev.slice(1));
      sendMessageInternal(nextMsg);
    }
  }, [messageQueue, typingPhase, isSending]);

  // 30-minute auto de-escalation timer for level 2 & 3 conversations
  useEffect(() => {
    if (!isOpen || !conversation || conversation.status === 'CLOSED' || currentLevel <= 1) {
      if (inactivityTimer) clearInterval(inactivityTimer);
      setInactivityTimer(null);
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/support/de-escalate');
        if (res.ok) {
          const data = await res.json();
          if (data.shouldDeEscalate) {
            // Auto de-escalate due to inactivity
            const deEscRes = await fetch('/api/support/de-escalate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: conversation.id, reason: 'inactivity', showRating: false }),
            });
            if (deEscRes.ok) {
              const deEscData = await deEscRes.json();
              if (deEscData.supportInfo) setSupportInfo(deEscData.supportInfo);

              // Add de-escalation message to messages
              const deEscMsg: MessageWithStatus = {
                id: `deesc-auto-${Date.now()}`,
                conversationId: conversation.id,
                senderType: 'SYSTEM',
                senderId: '',
                senderName: 'النظام',
                message: deEscData.deEscalationMsg || 'تم إعادة المحادثة إلى المستوى الأول بسبب عدم النشاط.',
                isRead: true,
                createdAt: new Date().toISOString(),
                deliveryStatus: 'read' as DeliveryStatus,
              };
              setMessages(prev => [...prev, deEscMsg]);

              // Show brief notice
              setDeEscalationNotice('تم إعادة المحادثة إلى المستوى الأول بسبب عدم النشاط لمدة 30 دقيقة');
              setTimeout(() => setDeEscalationNotice(null), 5000);

              // Reload conversation to get new messages and updated state
              loadConversation();
            }
          }
        }
      } catch {
        // ignore - will retry on next interval
      }
    }, 60000); // Check every 60 seconds

    setInactivityTimer(timer);
    return () => clearInterval(timer);
  }, [isOpen, conversation?.id, conversation?.status, currentLevel, inactivityTimer, loadConversation]);

  const sendMessage = async () => {
    if (!user) return;

    const hasText = messageInput.trim().length > 0;
    const hasImage = !!pendingImage;

    if (!hasText && !hasImage) return;

    const content = messageInput.trim();
    const imageUrlToSend = pendingImage?.url || null;

    // Clear input immediately - user can keep typing
    setMessageInput('');
    setPendingImage(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // If bot is currently typing, queue the message
    if (typingPhase !== 'idle' || isSending) {
      setMessageQueue(prev => [...prev, content]);
      return;
    }

    await sendMessageInternal(content, imageUrlToSend);
  };

  const sendMessageInternal = async (content: string, imageUrl?: string | null) => {
    setIsSending(true);
    sendingRef.current = true;
    forceScrollRef.current = true;

    // Add optimistic user message IMMEDIATELY to UI (before API call)
    const optimisticId = `temp-${Date.now()}`;
    const optimisticUserMsg: MessageWithStatus = {
      id: optimisticId,
      conversationId: conversation?.id || '',
      senderType: 'USER',
      senderId: user?.id || '',
      senderName: user?.name || '',
      message: content,
      imageUrl: imageUrl || undefined,
      isRead: false,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sending' as DeliveryStatus,
    };
    setMessages(prev => [...prev, optimisticUserMsg]);
    // IMMEDIATE synchronous scroll + RAF scroll after adding user message
    const c = messagesContainerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
    requestAnimationFrame(() => {
      const c2 = messagesContainerRef.current;
      if (c2) c2.scrollTop = c2.scrollHeight;
    });

    // Calculate realistic human-like delays based on message complexity
    const msgLen = content.length;
    const isSimple = msgLen < 20 || /^(شكرا|نعم|لا|تم|حسنا|طيب|ok|أهلا|مرحبا)/i.test(content);
    const isComplex = msgLen > 80 || /كيف|شرح|خطوات|مشكل|إيداع|سحب|باقه|استثمار|kyc/i.test(content);
    const pressureFactor = 0.8 + Math.random() * 0.6;

    let readDelay, thinkDelay, typePauseDelay, typeResumeDelay;

    if (isSimple) {
      readDelay = 400 + Math.random() * 600;
      thinkDelay = 300 + Math.random() * 500;
      typePauseDelay = 500 + Math.random() * 800;
      typeResumeDelay = 300 + Math.random() * 500;
    } else if (isComplex) {
      readDelay = 800 + Math.random() * 1200;
      thinkDelay = 1000 + Math.random() * 2000;
      typePauseDelay = 1500 + Math.random() * 2000;
      typeResumeDelay = 800 + Math.random() * 1200;
    } else {
      readDelay = 600 + Math.random() * 800;
      thinkDelay = 600 + Math.random() * 1000;
      typePauseDelay = 1000 + Math.random() * 1500;
      typeResumeDelay = 600 + Math.random() * 800;
    }

    // Apply pressure factor
    readDelay = Math.round(readDelay * pressureFactor);
    thinkDelay = Math.round(thinkDelay * pressureFactor);
    typePauseDelay = Math.round(typePauseDelay * pressureFactor);
    typeResumeDelay = Math.round(typeResumeDelay * pressureFactor);

    try {
      // Start the API call immediately with timeout (in parallel with typing animation)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30s timeout
      const apiPromise = fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId: conversation?.id || null,
          imageUrl: imageUrl || null,
        }),
        signal: abortController.signal,
      });

      // Phase 1: "reading" indicator
      setTypingPhase('reading');
      await new Promise(resolve => setTimeout(resolve, readDelay));

      // Phase 2: "thinking" indicator
      setTypingPhase('thinking');
      await new Promise(resolve => setTimeout(resolve, thinkDelay));

      // Phase 3: "typing" indicator
      setTypingPhase('typing');
      await new Promise(resolve => setTimeout(resolve, typePauseDelay));

      // Phase 4: "paused" - agent stops typing momentarily (very realistic!)
      setTypingPhase('paused');
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));

      // Phase 5: "typing again" - agent resumes typing
      setTypingPhase('typingAgain');
      await new Promise(resolve => setTimeout(resolve, typeResumeDelay));

      // Now wait for the API response
      let res: Response;
      try {
        res = await apiPromise;
        clearTimeout(timeoutId);
      } catch (apiError) {
        clearTimeout(timeoutId);
        // API call failed or timed out - update optimistic message to show error
        setTypingPhase('idle');
        setIsSending(false);
        // Mark optimistic message as failed
        setMessages(prev => prev.map(m =>
          m.id === optimisticId
            ? { ...m, deliveryStatus: 'sent' as DeliveryStatus }
            : m
        ));
        const errorMsg: MessageWithStatus = {
          id: `error-${Date.now()}`,
          conversationId: conversation?.id || '',
          senderType: 'AI',
          senderId: '',
          senderName: 'المساعدة الذكية',
          message: 'صار تأخير بالرد. ممكن تعيد إرسال رسالتك؟',
          isRead: true,
          createdAt: new Date().toISOString(),
          deliveryStatus: 'read',
        };
        setMessages((prev) => [...prev, errorMsg]);
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
        return;
      }

      if (res.ok) {
        const data = await res.json();

        // Replace optimistic message with real user message from server
        // and add agent responses in ONE setMessages call to prevent scroll jumps
        setMessages((prev) => {
          const newMessages: MessageWithStatus[] = [];

          // Replace optimistic user message with real one
          for (const m of prev) {
            if (m.id === optimisticId && data.userMsg) {
              newMessages.push({
                ...data.userMsg,
                deliveryStatus: 'delivered' as DeliveryStatus,
              });
            } else if (m.id === optimisticId) {
              // No server userMsg, just update status
              newMessages.push({ ...m, deliveryStatus: 'delivered' as DeliveryStatus });
            } else {
              newMessages.push(m);
            }
          }

          // Add handoff message from Level 1
          if (data.handoffMsg) {
            newMessages.push({
              ...data.handoffMsg,
              deliveryStatus: 'read' as DeliveryStatus,
            });
          }

          // Add transition message (for Level 3 escalation)
          if (data.transitionMsg) {
            newMessages.push({
              ...data.transitionMsg,
              deliveryStatus: 'read' as DeliveryStatus,
            });
          }

          // Add escalation message (old format compatibility)
          if (data.escalationMsg) {
            newMessages.push({
              ...data.escalationMsg,
              deliveryStatus: 'read' as DeliveryStatus,
            });
          }

          if (data.agentMsg) {
            newMessages.push({
              ...data.agentMsg,
              deliveryStatus: 'read' as DeliveryStatus,
            });
          }

          // Add human follow-up message (Level 3)
          if (data.humanMsg) {
            newMessages.push({
              ...data.humanMsg,
              deliveryStatus: 'read' as DeliveryStatus,
            });
          }

          // Mark last user message as "read"
          const lastUserIdx = [...newMessages].reverse().findIndex(m => m.senderType === 'USER');
          if (lastUserIdx !== -1) {
            const actualIdx = newMessages.length - 1 - lastUserIdx;
            newMessages[actualIdx] = { ...newMessages[actualIdx], deliveryStatus: 'read' };
          }

          return newMessages;
        });

        // Force scroll after adding API response messages
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 300);

        // After a short delay, mark as delivered (if still 'sent')
        setTimeout(() => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastUserMsg = [...updated].reverse().find(m => m.senderType === 'USER');
            if (lastUserMsg && lastUserMsg.deliveryStatus === 'sent') {
              const idx = updated.findIndex(m => m.id === lastUserMsg.id);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], deliveryStatus: 'delivered' };
              }
            }
            return updated;
          });
        }, 800);

        // Show escalation notice if escalation happened
        if (data.escalated && data.supportInfo) {
          const prevLevel = currentLevel;
          const newLevel = data.supportInfo.level;
          if (newLevel > prevLevel) {
            const fromName = LEVEL_CONFIG[prevLevel]?.name || 'المساعدة الذكية';
            const toName = LEVEL_CONFIG[newLevel]?.name || 'دعم SONA';

            setIsConnecting(true);
            setTypingPhase('idle');

            setTimeout(() => {
              setIsConnecting(false);
              setShowEscalationNotice({ from: fromName, to: toName });
            }, 1500);

            setTimeout(() => setShowEscalationNotice(null), 5500);
          }
        }

        // Handle de-escalation response from backend
        if (data.deEscalated) {
          if (data.showRating) {
            setShowRatingPopup(true);
          }
          if (data.deEscalationMsg) {
            const deEscMsg: MessageWithStatus = {
              id: `deesc-${Date.now()}`,
              conversationId: conversation?.id || data.conversationId || '',
              senderType: 'SYSTEM',
              senderId: '',
              senderName: 'النظام',
              message: data.deEscalationMsg,
              isRead: true,
              createdAt: new Date().toISOString(),
              deliveryStatus: 'read' as DeliveryStatus,
            };
            setMessages(prev => [...prev, deEscMsg]);
          }
        }

        // Update support info from API response
        if (data.supportInfo) {
          setSupportInfo(data.supportInfo);
        }

        if (data.conversationId) {
          setConversation((prev: Conversation | null) => {
            const updated = {
              ...((prev || {}) as Conversation),
              id: data.conversationId,
              supportLevel: data.supportInfo?.level || prev?.supportLevel || 1,
              isAiActive: data.handedOff ? false : (prev?.isAiActive ?? true),
              agent: data.newAgent ? { id: data.newAgent.id, name: data.newAgent.name, title: data.newAgent.title, nameEn: '', titleEn: '', avatar: '', specialty: '' } : prev?.agent,
            } as Conversation;
            return updated;
          });
        }

        setTypingPhase('idle');
      } else {
        // API returned error - update optimistic message status
        setMessages(prev => prev.map(m =>
          m.id === optimisticId
            ? { ...m, deliveryStatus: 'sent' as DeliveryStatus }
            : m
        ));
        setTypingPhase('idle');
      }
    } catch (error) {
      // Safety net: always reset typing phase
      setMessages(prev => prev.map(m =>
        m.id === optimisticId
          ? { ...m, deliveryStatus: 'sent' as DeliveryStatus }
          : m
      ));
      setTypingPhase('idle');
    } finally {
      // ALWAYS reset these to prevent stuck UI
      sendingRef.current = false;
      forceScrollRef.current = false;
      setIsSending(false);
      setTypingPhase('idle');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    try {
      const formData = new FormData();
      formData.append('image', file);

      const uploadRes = await fetch('/api/support/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        const imageUrl = uploadData.imageUrl;

        setPendingImage({ url: imageUrl, file });
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch {
      // ignore
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingImage = () => {
    setPendingImage(null);
  };

  const startNewChat = async () => {
    // Close old conversation in the database first
    if (conversation?.id) {
      try {
        await fetch('/api/support', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: conversation.id, action: 'close' }),
        });
      } catch {
        // ignore - proceed with local reset
      }
    }
    setConversation(null);
    setMessages([]);
    setPendingImage(null);
    setTypingPhase('idle');
    setSupportInfo(null);
    setMessageQueue([]);
    setShowRatingPopup(false);
    setRatingValue(0);
    setRatingHover(0);
    setDeEscalationNotice(null);
    if (inactivityTimer) clearInterval(inactivityTimer);
    setInactivityTimer(null);
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Quick reply suggestions
  const quickReplies = messages.length === 0 ? [
    { text: 'شو كيف أودع؟', icon: '💰' },
    { text: 'كيف أسحب أرباحي؟', icon: '📤' },
    { text: 'باقات الاستثمار', icon: '📊' },
    { text: 'التحقق KYC', icon: '🛡️' },
    { text: 'نظام الإحالات', icon: '🤝' },
    { text: 'مشكلة بحسابي', icon: '🔧' },
  ] : [];

  // Render delivery status icon
  const renderDeliveryStatus = (status?: DeliveryStatus) => {
    switch (status) {
      case 'sending':
        return <Clock size={10} className="text-white/20 animate-pulse" />;
      case 'sent':
        return <Check size={10} className="text-white/25" />;
      case 'delivered':
        return (
          <div className="flex">
            <Check size={10} className="text-white/30 -mr-1" />
            <Check size={10} className="text-white/30" />
          </div>
        );
      case 'read':
        return (
          <div className="flex">
            <Check size={10} className="text-[#409eff]/50 -mr-1" />
            <Check size={10} className="text-[#409eff]/50" />
          </div>
        );
      default:
        return <Clock size={10} className="text-white/20" />;
    }
  };

  // Typing phase text - uses level-specific name
  const getTypingPhaseText = () => {
    const config = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[1];
    switch (typingPhase) {
      case 'reading': return config.typingTexts.reading;
      case 'thinking': return config.typingTexts.thinking;
      case 'typing': return config.typingTexts.typing;
      case 'paused': return config.typingTexts.paused;
      case 'typingAgain': return config.typingTexts.typingAgain;
      default: return '';
    }
  };

  // Check if we should show typing indicator
  const showTypingIndicator = typingPhase !== 'idle';

  // Is the "paused" phase
  const isPaused = typingPhase === 'paused';

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Floating Chat Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#409eff] to-[#337ecc] shadow-lg shadow-[#409eff]/20 flex items-center justify-center hover:scale-110 transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={24} className="text-white" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }} className="relative">
              <MessageCircle size={24} className="text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-[#337ecc]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-24 left-6 z-50 w-[400px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-140px)] rounded-2xl bg-[#0d1117] border border-white/[0.08] shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            {/* Header - shows real agent name and avatar */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b transition-colors duration-500"
              style={{
                background: `linear-gradient(135deg, ${levelConfig.color}10 0%, transparent 60%)`,
                borderColor: `${levelConfig.color}15`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full relative overflow-hidden" style={{ boxShadow: `0 2px 8px ${levelConfig.color}33` }}>
                  <img
                    src={levelConfig.avatar}
                    alt="Support"
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d1117]" style={{ backgroundColor: levelConfig.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-sm">{supportInfo?.nameAr || levelConfig.name}</h3>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${levelConfig.color}15`, color: levelConfig.color }}
                    >
                      {levelConfig.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: levelConfig.color }} />
                    <span className="text-[10px]" style={{ color: `${levelConfig.color}CC` }}>متصل الآن</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {currentLevel < 3 && (
                  <button
                    onClick={() => {
                      setMessageInput('أريد التحدث مع دعم SONA');
                    }}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                    title="طلب دعم SONA"
                  >
                    <UserCheck size={14} />
                  </button>
                )}
                {messages.length > 0 && (
                  <button
                    onClick={startNewChat}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                    title="محادثة جديدة"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#409eff20 transparent' }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-[#409eff]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4">
                    <img src="/smart-help-avatar.png" alt="المساعدة الذكية" className="w-full h-full object-contain" />
                  </div>
                  <h4 className="text-white font-bold text-base mb-1">أهلاً فيك بدعم SONA</h4>
                  <p className="text-white/30 text-xs mb-4 max-w-[260px]">
                    شو بقدر أساعدك اليوم؟
                  </p>

                  {/* Quick Reply Buttons */}
                  {quickReplies.length > 0 && (
                    <div className="w-full space-y-2">
                      {quickReplies.map((reply, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08, duration: 0.2 }}
                          onClick={() => { setMessageInput(reply.text); }}
                          className="w-full text-right px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:bg-[#409eff]/5 hover:border-[#409eff]/20 hover:text-[#409eff] transition-all flex items-center gap-2"
                        >
                          <span className="text-sm">{reply.icon}</span>
                          <span>{reply.text}</span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => {
                    const isUser = msg.senderType === 'USER';
                    const msgLevel = getMsgLevel(msg);
                    const msgLevelConfig = LEVEL_CONFIG[msgLevel] || LEVEL_CONFIG[1];
                    const isLastUserMessage = isUser && index === messages.length - 1 - [...messages].reverse().findIndex(m => m.senderType === 'USER');
                    const isHandoff = msg.metadata ? (JSON.parse(msg.metadata || '{}').handoff || false) : false;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%]`}>
                          {!isUser && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <img
                                src={msgLevelConfig.avatar}
                                alt=""
                                className="w-5 h-5 rounded-full object-contain"
                              />
                              <span className="text-[10px] font-bold" style={{ color: `${msgLevelConfig.color}CC` }}>
                                {msgLevelConfig.name}
                              </span>
                              {isHandoff && (
                                <span className="text-[8px] px-1 py-0.5 rounded-full bg-white/5 text-white/30">
                                  تمرير
                                </span>
                              )}
                            </div>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isUser
                                ? 'bg-[#409eff] text-white rounded-bl-md'
                                : `text-white/90 rounded-br-md border`
                            }`}
                            style={!isUser ? {
                              background: `${msgLevelConfig.color}08`,
                              borderColor: `${msgLevelConfig.color}15`,
                              borderLeftWidth: msgLevel === 2 ? '3px' : '1px',
                              borderLeftColor: msgLevel === 2 ? msgLevelConfig.color : `${msgLevelConfig.color}15`,
                            } : undefined}
                          >
                            {msg.imageUrl && (
                              <div className="mb-2">
                                <img
                                  src={msg.imageUrl}
                                  alt="صورة مرفقة"
                                  className="max-w-full rounded-lg max-h-48 object-cover"
                                />
                              </div>
                            )}
                            {msg.message && (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-white/20 text-[10px]">{formatTime(msg.createdAt)}</span>
                            {isUser && isLastUserMessage && (
                              renderDeliveryStatus(msg.deliveryStatus)
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing Indicator with phases - shows level-specific name */}
                  {showTypingIndicator && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-start"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <img
                            src={levelConfig.avatar}
                            alt=""
                            className="w-5 h-5 rounded-full object-contain"
                          />
                          <span className="text-[10px] font-bold" style={{ color: `${levelConfig.color}CC` }}>{levelConfig.name}</span>
                        </div>
                        <div
                          className="rounded-2xl rounded-br-md px-4 py-2.5 border"
                          style={{
                            background: `${levelConfig.color}08`,
                            borderColor: `${levelConfig.color}15`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {typingPhase === 'thinking' ? (
                              <Sparkles size={12} className="text-amber-400/60 animate-pulse" />
                            ) : null}
                            <span className="text-white/40 text-xs">{getTypingPhaseText()}</span>
                            {!isPaused && (
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '0ms', backgroundColor: `${levelConfig.color}99` }} />
                                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '150ms', backgroundColor: `${levelConfig.color}99` }} />
                                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '300ms', backgroundColor: `${levelConfig.color}99` }} />
                              </div>
                            )}
                            {isPaused && (
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${levelConfig.color}44` }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Queued messages indicator */}
                  {messageQueue.length > 0 && (
                    <div className="text-center">
                      <span className="text-white/20 text-[10px]">{messageQueue.length} رسالة في الانتظار</span>
                    </div>
                  )}
                </>
              )}

              {/* Connecting Animation during Escalation */}
              <AnimatePresence>
                {isConnecting && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="mx-auto"
                  >
                    <div className="px-3 py-2 rounded-xl bg-[#409eff]/10 border border-[#409eff]/20 text-center flex items-center justify-center gap-2">
                      <Loader2 size={12} className="animate-spin text-[#409eff]" />
                      <span className="text-[#409eff] text-[10px] font-medium">جاري الاتصال بفريق دعم SONA...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Escalation Notice */}
              <AnimatePresence>
                {showEscalationNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="mx-auto"
                  >
                    <div className="px-4 py-2 rounded-xl bg-[#04cf99]/10 border border-[#04cf99]/20 text-center">
                      <span className="text-[#04cf99] text-xs font-medium">
                        {showEscalationNotice.from} ↦ {showEscalationNotice.to}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* De-Escalation Notice */}
              <AnimatePresence>
                {deEscalationNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    className="mx-auto"
                  >
                    <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center flex items-center justify-center gap-2">
                      <Clock size={12} className="text-amber-400/60" />
                      <span className="text-amber-400 text-xs font-medium">{deEscalationNotice}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* scroll anchor — scrollTop handles scrolling */}
            </div>

            {/* Rating Popup */}
            <AnimatePresence>
              {showRatingPopup && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mx-3 mb-2 p-4 rounded-xl bg-gradient-to-br from-[#04cf99]/10 to-[#409eff]/10 border border-[#04cf99]/20"
                >
                  <h4 className="text-white text-sm font-bold mb-2 text-center">كيف كانت تجربة الدعم؟</h4>
                  <div className="flex justify-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRatingValue(star)}
                        onMouseEnter={() => setRatingHover(star)}
                        onMouseLeave={() => setRatingHover(0)}
                        className="text-xl transition-transform hover:scale-125"
                      >
                        <span className={star <= (ratingHover || ratingValue) ? 'text-amber-400' : 'text-white/20'}>★</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!ratingValue || !conversation) return;
                        try {
                          await fetch('/api/support/rate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ conversationId: conversation.id, rating: ratingValue, comment: '' }),
                          });
                        } catch {}
                        setShowRatingPopup(false);
                        setRatingValue(0);
                        setRatingHover(0);
                      }}
                      className="flex-1 py-2 rounded-lg bg-[#04cf99] text-white text-xs font-bold hover:bg-[#04cf99]/80 transition-colors disabled:opacity-50"
                      disabled={ratingValue === 0}
                    >
                      قيّم الآن
                    </button>
                    <button
                      onClick={() => { setShowRatingPopup(false); setRatingValue(0); setRatingHover(0); }}
                      className="flex-1 py-2 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 transition-colors"
                    >
                      قيّم لاحقاً
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-3 border-t border-white/5 bg-[#0d1117]">
              <div className="flex flex-col gap-2">
                {/* Pending Image Preview */}
                <AnimatePresence>
                  {pendingImage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative inline-block"
                    >
                      <div className="relative inline-block max-w-[25%] rounded-lg overflow-hidden border border-[#409eff]/20">
                        <img
                          src={pendingImage.url}
                          alt="صورة معلقة"
                          className="w-full h-auto object-cover rounded-lg"
                        />
                        <button
                          onClick={removePendingImage}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white hover:bg-red-500/80 transition-all"
                        >
                          <XCircle size={12} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-end gap-2">
                  {/* Image upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/25 hover:text-[#409eff] hover:border-[#409eff]/20 transition-all"
                    title="إرفاق صورة"
                  >
                    <Paperclip size={15} />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={messageInput}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={showTypingIndicator ? "اكتب رسالتك... (الوكيل يكتب لكن يمكنك الإرسال)" : "اكتب رسالتك..."}
                      rows={1}
                      maxLength={2000}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#409eff]/30 focus:bg-white/[0.06] transition-all resize-none overflow-hidden"
                      style={{ minHeight: '38px', maxHeight: '96px' }}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={(!messageInput.trim() && !pendingImage)}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#409eff] to-[#337ecc] flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
                  >
                    {isSending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-white/10 text-[9px]">Shift+Enter سطر جديد</span>
                  <div className="flex items-center gap-1">
                    <img
                      src={levelConfig.avatar}
                      alt=""
                      className="w-3 h-3 rounded-full object-contain"
                    />
                    <span className="text-white/20 text-[9px]">{levelConfig.name} - {levelConfig.title}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
