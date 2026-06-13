'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Loader2, HeadphonesIcon, Paperclip, CheckCircle,
  Clock, HelpCircle, ChevronDown, ChevronUp, Mail,
  Wallet, ArrowDownToLine, ArrowUpFromLine, Shield,
  Users, Star, MessageCircle, Bot, UserCheck, AlertCircle,
  Search, Eye, Sparkles, ShieldCheck, FileText, RefreshCw,
  Check,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useI18n } from '@/hooks/useI18n'

interface ChatMessage {
  id: string
  senderType: string
  senderName?: string
  message: string
  imageUrl?: string
  isRead?: boolean
  createdAt: string
  metadata?: string
  _isChecking?: boolean
  _isHandoff?: boolean
  _isTransition?: boolean
  _deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read'
}

interface SupportInfo {
  level: number
  name: string
  nameAr: string
  titleAr?: string
  avatar: string
  status: string
  statusIcon: string
  isHuman: boolean
}

interface Conversation {
  id: string
  isAiActive: boolean
  supportLevel: number
  status: string
  rating?: number
  resolutionAsked: boolean
  category?: string
  agent?: { id: string; name: string; title: string; avatar: string }
  messages?: ChatMessage[]
  updatedAt: string
}

type TypingPhase = 'idle' | 'reading' | 'checking' | 'thinking' | 'typing' | 'paused' | 'typingAgain' | 'stoppedMidSentence'

const FAQ_ITEMS = [
  {
    question: 'كيف أودع في المنصة؟',
    answer: 'اذهب لصفحة الإيداع، اختر العملة الرقمية (USDT, BTC, ETH, BNB)، أدخل المبلغ، ثم أرسل المبلغ للعنوان المعروض. الحد الأدنى $10. سيتم التأكيد تلقائياً خلال 5-30 دقيقة.',
    icon: ArrowDownToLine,
  },
  {
    question: 'كيف أسحب أرباحي؟',
    answer: 'اذهب لصفحة السحب، اختر الشبكة وعنوان محفظتك. الحد الأدنى $10. السحوبات أقل من $1,000 تُعالج تلقائياً. السحوبات أكثر من $1,000 تحتاج توثيق KYC.',
    icon: ArrowUpFromLine,
  },
  {
    question: 'كيف أبدأ الاستثمار؟',
    answer: 'اذهب لصفحة الباقات، اختر الباقة المناسبة لميزانيتك، أدخل مبلغ الاستثمار وسيبدأ ربحك اليومي فوراً. الأرباح تُضاف يومياً لرصيدك القابل للسحب.',
    icon: Wallet,
  },
  {
    question: 'ما هو التحقق KYC؟',
    answer: 'التحقق من الهوية مطلوب للسحب فوق $1,000. ارفع صورة من وثيقتك (جواز سفر أو بطاقة) وصورة سيلفي من صفحة التحقق. المراجعة خلال 24 ساعة.',
    icon: Shield,
  },
  {
    question: 'كيف يعمل نظام الإحالات؟',
    answer: 'شارك كود الإحالة الخاص بك مع أصدقائك. تحصل على عمولة 15% من كل استثمار يجريه الشخص المحال. العمولة تُضاف تلقائياً لرصيدك.',
    icon: Users,
  },
]

// Level config with rich typing texts and checking messages
const LEVEL_CONFIG: Record<number, {
  icon: any
  label: string
  color: string
  bg: string
  avatar: string
  name: string
  typingTexts: {
    reading: string
    checking: string
    thinking: string
    typing: string
    paused: string
    typingAgain: string
  }
  checkingMessages: string[]
}> = {
  1: {
    icon: Bot,
    label: 'المساعدة الذكية',
    color: '#409eff',
    bg: 'rgba(64,158,255,0.1)',
    avatar: '/smart-help-avatar.png',
    name: 'المساعدة الذكية',
    typingTexts: {
      reading: 'بتقرأ رسالتك...',
      checking: 'بتراجع حسابك ومعاملاتك...',
      thinking: 'بتفكر بالرد المناسب...',
      typing: 'بتكتب رد...',
      paused: 'توقفت لحظة...',
      typingAgain: 'بتكمل الكتابة...',
    },
    checkingMessages: [
      'خليني أشوف حسابك هلأ...',
      'شوية أراجع بياناتك...',
      'لحظات أتحقق من رصيدك ومعاملاتك...',
      'أشوف سجلك هلأ...',
      'بص، خليني أفتح حسابك...',
      'أوكي، شوية أتأكد من بياناتك...',
    ],
  },
  2: {
    icon: HeadphonesIcon,
    label: 'دعم SONA',
    color: '#04cf99',
    bg: 'rgba(4,207,153,0.1)',
    avatar: '/sona-support-avatar.png',
    name: 'دعم SONA',
    typingTexts: {
      reading: 'بيقرأ رسالتك بتمعن...',
      checking: 'بيراجع حسابك ومعاملاتك بالتفصيل...',
      thinking: 'بحلل الموضوع وبيفكر بالحل...',
      typing: 'بيكتب رد مفصل...',
      paused: 'توقف لحظة...',
      typingAgain: 'بيكمل الكتابة...',
    },
    checkingMessages: [
      'فهمت عليك. خليني أشوف حسابك بالتفصيل...',
      'تمام، شوية أفتح النظام وأراجع بياناتك...',
      'أكيد، لحظات أتحقق من المعاملات تبعك بالتفصيل...',
      'شفت شي — خليني أتأكد من التفاصيل...',
      'أوكي، بدقق على حسابك هلأ...',
      'بص، شوية أراجع سجلك بالكامل...',
    ],
  },
  3: {
    icon: UserCheck,
    label: 'دعم SONA المباشر',
    color: '#e6a23c',
    bg: 'rgba(230,162,60,0.1)',
    avatar: '/sona-support-avatar.png',
    name: 'دعم SONA المباشر',
    typingTexts: {
      reading: 'بيقرأ رسالتك بعناية...',
      checking: 'بيتحقق من حسابك ومعاملاتك شخصياً...',
      thinking: 'بيراجع الموضوع بالكامل...',
      typing: 'بيكتب رد...',
      paused: 'توقف لحظة...',
      typingAgain: 'بيكمل الكتابة...',
    },
    checkingMessages: [
      'فهمت المشكلة. خليني أراجع حسابك هلأ شخصياً...',
      'شوية أفتح نظامنا وأتحقق من كل شي...',
      'طيب، بدقق على حسابك ومعاملاتك هلأ...',
      'أوكي، شوية أشوف كل التفاصيل تبعك...',
      'تمام، لحظات أراجع بياناتك بالكامل...',
      'شفت شي مهم — خليني أتأكد...',
    ],
  },
}

// Get level from message metadata
function getMsgLevel(msg: ChatMessage): number {
  if (msg.metadata) {
    try { return JSON.parse(msg.metadata).level || 1 } catch {}
  }
  if (msg.senderType === 'AGENT') return 2
  if (msg.senderType === 'ADMIN') return 3
  return 1
}

// Check if message is a "checking" status message
function isCheckingMessage(msg: ChatMessage): boolean {
  if (msg._isChecking) return true
  if (msg.metadata) {
    try { return JSON.parse(msg.metadata).checking || false } catch {}
  }
  return false
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function SupportPage() {
  const { user } = useAppStore()
  const { t, isRTL } = useI18n()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [typingPhase, setTypingPhase] = useState<TypingPhase>('idle')
  const [showFAQ, setShowFAQ] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [showRatingPopup, setShowRatingPopup] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [showEscalationNotice, setShowEscalationNotice] = useState<{ from: string; to: string } | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [quickReplies] = useState([
    'إيداعي ما إجى',
    'سحب معلق',
    'حسابي مخترق',
    'شو كيف أودع؟',
    'كيف أسحب أرباحي؟',
    'بدي أحكي مع موظف',
  ])
  // messagesEndRef removed — we use scrollTop directly (scrollIntoView causes RTL bugs)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const sendingRef = useRef(false)
  const forceScrollRef = useRef(false)
  const lastUserMessageTimeRef = useRef<Date>(new Date())

  // ===== SCROLL TO BOTTOM - RTL SAFE (NO scrollIntoView!) =====
  // scrollIntoView causes scroll jumps in RTL layouts.
  // We use ONLY scrollTop = scrollHeight which works correctly in RTL.
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  // Track if user is near bottom — used to decide whether to auto-scroll
  const isNearBottomRef = useRef(true)

  // Auto-scroll when messages change or typing phase changes
  // useLayoutEffect fires BEFORE browser paint, preventing the "jump up" flicker
  useLayoutEffect(() => {
    // Only force scroll if user is near bottom OR actively sending
    const shouldScroll = isNearBottomRef.current || forceScrollRef.current
    if (!shouldScroll) return

    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
    // RAF-based scroll catches late DOM updates
    const raf = requestAnimationFrame(() => {
      const c = messagesContainerRef.current
      if (c) c.scrollTop = c.scrollHeight
    })
    const t1 = setTimeout(scrollToBottom, 100)
    const t2 = setTimeout(scrollToBottom, 300)
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2) }
  }, [messages, typingPhase, scrollToBottom])

  // Track scroll position to know if user is near bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!container) return
      isNearBottomRef.current = (container.scrollHeight - container.scrollTop - container.clientHeight) < 200
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => { loadConversation() }, [])

  // Auto-polling for new messages every 5 seconds
  useEffect(() => {
    if (conversation && conversation.status !== 'CLOSED') {
      pollingRef.current = setInterval(async () => {
        // Skip polling while user is actively sending a message
        if (sendingRef.current) return
        
        try {
          const res = await fetch('/api/support')
          if (res.ok) {
            const data = await res.json()
            if (data.conversation) {
              const newMsgs: ChatMessage[] = data.conversation.messages || []
              
              // Use tracked scroll position (from scroll event listener)
              const wasNearBottom = isNearBottomRef.current
              
              // Merge: find messages from server that we don't have locally
              setMessages(prev => {
                const localIds = new Set(prev.map(m => m.id))
                const trulyNewMsgs = newMsgs.filter(m => !localIds.has(m.id))
                
                if (trulyNewMsgs.length === 0) return prev // No change, skip re-render
                
                // Append only new messages (don't replace existing ones)
                const updated = [...prev, ...trulyNewMsgs]
                return updated
              })
              
              setConversation(data.conversation)
              if (data.supportInfo) setSupportInfo(data.supportInfo)
              
              // Only scroll to bottom if user was already near bottom
              if (wasNearBottom) {
                forceScrollRef.current = true
                setTimeout(() => { scrollToBottom(); forceScrollRef.current = false }, 100)
              }
            }
          }
        } catch {}
      }, 5000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [conversation?.id, conversation?.status, scrollToBottom])

  // ===== 30-MINUTE AUTO DE-ESCALATION FOR LEVEL 2 & 3 =====
  useEffect(() => {
    const level = supportInfo?.level || conversation?.supportLevel || 1
    if (!conversation || conversation.status === 'CLOSED' || level <= 1) {
      return
    }

    const timer = setInterval(async () => {
      if (sendingRef.current) return
      try {
        // Check if 30 minutes have passed since last user message
        const now = new Date()
        const lastMsgTime = lastUserMessageTimeRef.current
        const diffMs = now.getTime() - lastMsgTime.getTime()
        const THIRTY_MINUTES = 30 * 60 * 1000

        if (diffMs >= THIRTY_MINUTES) {
          const res = await fetch('/api/support/de-escalate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: conversation.id, reason: 'inactivity', showRating: false })
          })
          if (res.ok) {
            const deEscData = await res.json()
            if (deEscData.supportInfo) setSupportInfo(deEscData.supportInfo)
            if (deEscData.conversation) setConversation(deEscData.conversation)
            else setConversation(prev => prev ? { ...prev, supportLevel: deEscData.supportInfo?.level || prev.supportLevel } : null)
            loadConversation()
          }
        }
      } catch {}
    }, 60000) // Check every 60 seconds

    return () => clearInterval(timer)
  }, [conversation?.id, conversation?.status, supportInfo?.level, conversation?.supportLevel])

  const loadConversation = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/support')
      if (res.ok) {
        const data = await res.json()
        if (data.conversation) {
          setConversation(data.conversation)
          setMessages(data.conversation.messages || [])
          setSupportInfo(data.supportInfo || null)
        }
      }
    } catch {}
    setLoading(false)
    setTimeout(scrollToBottom, 200)
  }

  const startNewChat = async () => {
    if (!conversation) return
    try {
      await fetch('/api/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id, action: 'close' })
      })
    } catch {}
    setConversation(null)
    setMessages([])
    setSupportInfo(null)
    setTypingPhase('idle')
    setShowRating(false)
    setLoading(true)
    try {
      const res = await fetch('/api/support')
      if (res.ok) {
        const data = await res.json()
        if (data.conversation) {
          setConversation(data.conversation)
          setMessages(data.conversation.messages || [])
          setSupportInfo(data.supportInfo || null)
        }
      }
    } catch {}
    setLoading(false)
    setTimeout(() => scrollToBottom(), 200)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.substring(0, 2000)
    setMessageInput(value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  // ===== SEND MESSAGE - WITH IMMEDIATE USER MSG + HUMAN-LIKE TYPING =====
  const sendMessage = async (text?: string, img?: string) => {
    const msg = text || messageInput.trim()
    if (!msg && !img) return
    if (sending) return

    setSending(true)
    sendingRef.current = true
    forceScrollRef.current = true
    lastUserMessageTimeRef.current = new Date()
    setMessageInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // ===== STEP 1: Add user message IMMEDIATELY to UI =====
    const tempUserMsgId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const tempUserMsg: ChatMessage = {
      id: tempUserMsgId,
      senderType: 'USER',
      senderName: user?.name || 'أنت',
      message: msg,
      imageUrl: img,
      isRead: true,
      createdAt: new Date().toISOString(),
      _deliveryStatus: 'sent',
    }
    setMessages(prev => [...prev, tempUserMsg])
    // IMMEDIATE synchronous scroll + RAF scroll after adding user message
    const c = messagesContainerRef.current
    if (c) c.scrollTop = c.scrollHeight
    requestAnimationFrame(() => {
      const c2 = messagesContainerRef.current
      if (c2) c2.scrollTop = c2.scrollHeight
    })

    // Mark as delivered after short delay
    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === tempUserMsgId ? { ...m, _deliveryStatus: 'delivered' as const } : m
      ))
    }, 800)

    try {
      // ===== STEP 2: Calculate realistic human-like delays =====
      const currentLvl = supportInfo?.level || 1
      const msgLen = msg.length
      const isSimple = msgLen < 20 || /^(شكرا|نعم|لا|تم|حسنا|طيب|ok|أهلا|مرحبا)/i.test(msg)
      const isComplex = msgLen > 80 || /كيف|شرح|خطوات|مشكل|إيداع|سحب|باقه|استثمار|kyc|مخترق|معلق|لم يصل|ما وصل|فشل|حسابي|رصيد|أرباح|سرق|اختلاس/i.test(msg)
      const pf = 0.8 + Math.random() * 0.6
      const levelFactor = currentLvl === 1 ? 1.0 : currentLvl === 2 ? 1.4 : 1.8

      // ===== BINANCE-LEVEL REALISTIC DELAYS =====
      // Binance support takes 5-15 seconds for complex issues
      // The key is: more phases = more human feel
      let readD, checkingD, thinkD, typePauseD, stoppedD, typeResumeD, finalReviewD
      if (isSimple && !isComplex) {
        // Simple: 4-7 seconds total feel — quick but not instant
        readD = (1200 + Math.random() * 1500) * pf
        checkingD = 0 // Skip checking for simple messages
        thinkD = (800 + Math.random() * 1000) * pf
        typePauseD = (1500 + Math.random() * 1800) * pf
        stoppedD = (300 + Math.random() * 500) * pf
        typeResumeD = (800 + Math.random() * 1000) * pf
        finalReviewD = 0
      } else if (isComplex) {
        // Complex: 10-20 seconds total feel — like Binance for account issues
        // Agent reads, checks account deeply, thinks, types, stops, rethinks, continues
        readD = (2500 + Math.random() * 2500) * pf
        checkingD = (5000 + Math.random() * 5000) * levelFactor
        thinkD = (3000 + Math.random() * 4000) * levelFactor
        typePauseD = (3000 + Math.random() * 3000) * levelFactor
        stoppedD = (1500 + Math.random() * 2000) * levelFactor  // LONGER pause — rethinking
        typeResumeD = (2000 + Math.random() * 2500) * pf
        finalReviewD = (800 + Math.random() * 1200) * pf  // Final review before sending
      } else {
        // Medium: 7-12 seconds total feel
        readD = (1800 + Math.random() * 2000) * pf
        checkingD = (3000 + Math.random() * 3000) * pf
        thinkD = (2000 + Math.random() * 2000) * pf
        typePauseD = (2500 + Math.random() * 2500) * levelFactor
        stoppedD = (800 + Math.random() * 1200) * pf  // Brief stop — rethinking
        typeResumeD = (1200 + Math.random() * 1500) * pf
        finalReviewD = (500 + Math.random() * 800) * pf
      }

      // ===== STEP 3: Start API call in parallel with typing animation =====
      const apiPromise = fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, imageUrl: img })
      })

      // Phase 1: "reading" — agent is reading the user's message
      setTypingPhase('reading')
      scrollToBottom()
      await new Promise(r => setTimeout(r, readD))

      // Phase 2: "checking" — agent is checking account data (VERY HUMAN!)
      // This is shown for complex questions or account-related queries
      // Skip for simple messages — humans don't "check your account" for "thank you"
      const shouldCheck = checkingD > 0 && (isComplex || /مشكل|إيداع|سحب|حساب|رصيد|أرباح|مخترق|معلق|لم يصل|ما وصل|فشل|سرق|اختلاف|خصم|معامله/i.test(msg))
      if (shouldCheck) {
        setTypingPhase('checking')
        scrollToBottom()

        // Add a "checking" status message to the chat (appears as agent is looking)
        const lvlConfig = LEVEL_CONFIG[currentLvl] || LEVEL_CONFIG[1]
        const checkingText = pickRandom(lvlConfig.checkingMessages)
        const checkingMsgId = `checking_${Date.now()}`
        const checkingMsg: ChatMessage = {
          id: checkingMsgId,
          senderType: currentLvl === 1 ? 'AI' : currentLvl === 2 ? 'AGENT' : 'ADMIN',
          senderName: lvlConfig.name,
          message: checkingText,
          isRead: true,
          createdAt: new Date().toISOString(),
          metadata: JSON.stringify({ level: currentLvl, checking: true }),
          _isChecking: true,
        }
        setMessages(prev => [...prev, checkingMsg])
        // Force scroll after adding checking message
        const cc = messagesContainerRef.current
        if (cc) cc.scrollTop = cc.scrollHeight
        requestAnimationFrame(() => {
          const cc2 = messagesContainerRef.current
          if (cc2) cc2.scrollTop = cc2.scrollHeight
        })

        await new Promise(r => setTimeout(r, checkingD))

        // Mark user message as "read" after agent checks
        setMessages(prev => prev.map(m =>
          m.id === tempUserMsgId ? { ...m, _deliveryStatus: 'read' as const } : m
        ))
      }

      // Phase 3: "thinking" — agent is composing the response
      setTypingPhase('thinking')
      scrollToBottom()
      await new Promise(r => setTimeout(r, thinkD))

      // Phase 4: "typing" — agent starts typing the response
      setTypingPhase('typing')
      scrollToBottom()
      await new Promise(r => setTimeout(r, typePauseD))

      // Phase 5: "stopped mid-sentence" — VERY REALISTIC! Like Binance agents
      // Agent stops mid-sentence to recheck something or rephrase
      // This is the KEY differentiator from bots — bots don't stop mid-sentence!
      setTypingPhase('stoppedMidSentence')
      scrollToBottom()
      await new Promise(r => setTimeout(r, stoppedD))

      // Phase 6: "typing again" — agent resumes after brief pause
      setTypingPhase('typingAgain')
      scrollToBottom()
      await new Promise(r => setTimeout(r, typeResumeD))

      // Phase 7: "paused" — final review before sending (very human!)
      if (finalReviewD > 0) {
        setTypingPhase('paused')
        await new Promise(r => setTimeout(r, finalReviewD))
      }

      // ===== STEP 4: Get API response =====
      const res = await apiPromise

      if (res.ok) {
        const data = await res.json()

        // Show escalation notice if level changed
        if (data.escalated && data.supportInfo) {
          const prevLevel = currentLvl
          const newLevel = data.supportInfo.level
          if (newLevel > prevLevel) {
            const fromName = LEVEL_CONFIG[prevLevel]?.name || 'المساعدة الذكية'
            const toName = LEVEL_CONFIG[newLevel]?.name || 'دعم SONA'

            setIsConnecting(true)
            setTypingPhase('idle')

            setTimeout(() => {
              setIsConnecting(false)
              setShowEscalationNotice({ from: fromName, to: toName })
            }, 1500)

            setTimeout(() => setShowEscalationNotice(null), 5500)
          }
        }

        // SMART UPDATE: Update temp user msg in-place + append new agent messages only
        // This prevents the "jump" caused by replacing all messages (which triggers re-animation)
        setMessages(prev => {
          const updated = prev.map(m =>
            m.id === tempUserMsgId
              ? { ...m, _deliveryStatus: 'read' as const }
              : m
          )

          // Add handoff message (only from API — not already shown in UI)
          if (data.handoffMsg) {
            updated.push({ ...data.handoffMsg, _isHandoff: true })
          }

          // Add transition message
          if (data.transitionMsg) {
            updated.push({ ...data.transitionMsg, _isTransition: true })
          }

          // Add escalation message
          if (data.escalationMsg) {
            updated.push(data.escalationMsg)
          }

          // Add agent response
          if (data.agentMsg) {
            updated.push({ ...data.agentMsg, _deliveryStatus: 'read' as const })
          }

          // Add human follow-up message
          if (data.humanMsg) {
            updated.push({ ...data.humanMsg, _deliveryStatus: 'read' as const })
          }

          // Handle de-escalation
          if (data.deEscalated) {
            if (data.deEscalationMsg) {
              updated.push({ ...data.deEscalationMsg, _deliveryStatus: 'read' as const })
            }
            if (data.showRating) {
              setShowRatingPopup(true)
            }
          }

          return updated
        })

        // Force scroll after adding API response messages
        requestAnimationFrame(() => {
          const c = messagesContainerRef.current
          if (c) c.scrollTop = c.scrollHeight
        })
        setTimeout(() => {
          const c = messagesContainerRef.current
          if (c) c.scrollTop = c.scrollHeight
        }, 100)
        setTimeout(() => {
          const c = messagesContainerRef.current
          if (c) c.scrollTop = c.scrollHeight
        }, 300)

        // Update support info
        if (data.supportInfo) {
          setSupportInfo(data.supportInfo)
        }

        if (data.conversationId && conversation) {
          setConversation(prev => prev ? { ...prev, supportLevel: data.supportInfo?.level || prev.supportLevel } : null)
        }
      }
    } catch {}

    setTypingPhase('idle')
    sendingRef.current = false
    forceScrollRef.current = false
    setSending(false)
    scrollToBottom()
    setTimeout(() => scrollToBottom(), 100)
    setTimeout(() => scrollToBottom(), 300)
    setTimeout(() => textareaRef.current?.focus(), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/support/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        sendMessage('أرسلت صورة', data.imageUrl)
      }
    } catch (err) {
      console.error('[SUPPORT] Image upload failed:', err)
    }
    e.target.value = ''
  }

  const requestHumanAgent = () => {
    sendMessage('أريد التحدث مع دعم SONA')
  }

  const submitRating = async () => {
    if (!ratingValue || !conversation) return
    try {
      const res = await fetch('/api/support/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          rating: ratingValue,
          comment: '',
        })
      })
      if (res.ok) {
        setShowRating(false)
        setConversation(prev => prev ? { ...prev, rating: ratingValue, status: 'CLOSED' } : null)
        loadConversation()
      }
    } catch {}
  }

  const currentLevel = supportInfo?.level || conversation?.supportLevel || 1
  const levelConfig = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[1]
  const LevelIcon = levelConfig.icon

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  }

  const getTypingText = () => {
    const name = levelConfig.name
    switch (typingPhase) {
      case 'reading': return `${name} ${levelConfig.typingTexts.reading}`
      case 'checking': return `${name} ${levelConfig.typingTexts.checking}`
      case 'thinking': return `${name} ${levelConfig.typingTexts.thinking}`
      case 'typing': return `${name} ${levelConfig.typingTexts.typing}`
      case 'paused': return `${name} ${levelConfig.typingTexts.paused}`
      case 'stoppedMidSentence': return `${name} توقف لحظة...`
      case 'typingAgain': return `${name} ${levelConfig.typingTexts.typingAgain}`
      default: return ''
    }
  }

  const isPaused = typingPhase === 'paused' || typingPhase === 'stoppedMidSentence'
  const isCheckingPhase = typingPhase === 'checking'
  const isStoppedMidSentence = typingPhase === 'stoppedMidSentence'

  // Render delivery status icon
  const renderDeliveryStatus = (status?: string) => {
    switch (status) {
      case 'sent':
        return <Check size={10} className="text-white/25" />
      case 'delivered':
        return (
          <div className="flex">
            <Check size={10} className="text-white/30 -mr-1" />
            <Check size={10} className="text-white/30" />
          </div>
        )
      case 'read':
        return (
          <div className="flex">
            <Check size={10} className="text-[#409eff]/50 -mr-1" />
            <Check size={10} className="text-[#409eff]/50" />
          </div>
        )
      default:
        return <Clock size={10} className="text-white/20" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#409eff]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ===== HEADER ===== */}
      <div
        className="shrink-0 border-b transition-colors duration-500"
        style={{
          background: `linear-gradient(135deg, ${levelConfig.color}08 0%, #0d1117 60%)`,
          borderColor: `${levelConfig.color}15`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={levelConfig.avatar || supportInfo?.avatar || '/sona-icon.png'}
                alt="Support"
                className="w-10 h-10 rounded-xl object-contain"
                style={{ filter: `drop-shadow(0 2px 8px ${levelConfig.color}40)` }}
              />
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0d1117]"
                style={{ backgroundColor: levelConfig.color }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{supportInfo?.nameAr || levelConfig.name}</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: levelConfig.bg, color: levelConfig.color }}
                >
                  <LevelIcon className="w-3 h-3 inline -mt-0.5" /> {levelConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ color: levelConfig.color }} className="text-xs">{supportInfo?.statusIcon || '🟢'} {supportInfo?.status || 'متصل الآن'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentLevel < 3 && (
              <button
                onClick={requestHumanAgent}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                دعم SONA
              </button>
            )}
            {conversation && messages.length > 1 && (
              <button
                onClick={startNewChat}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                محادثة جديدة
              </button>
            )}
            <button
              onClick={() => setShowFAQ(!showFAQ)}
              className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              أسئلة شائعة
            </button>
          </div>
        </div>
      </div>

      {/* ===== FAQ PANEL ===== */}
      <AnimatePresence>
        {showFAQ && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0 border-b border-white/[0.06]"
          >
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {FAQ_ITEMS.map((item, i) => {
                const Icon = item.icon
                return (
                  <button
                    key={i}
                    onClick={() => { sendMessage(item.question); setShowFAQ(false) }}
                    className="w-full text-right flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group"
                  >
                    <Icon className="w-5 h-5 text-[#409eff] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">{item.question}</div>
                      <div className="text-white/30 text-xs mt-1 leading-relaxed">{item.answer}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MESSAGES ===== */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ minHeight: 0, scrollbarWidth: 'thin', scrollbarColor: '#409eff20 transparent', overflowAnchor: 'auto' }}
      >
        {messages.length <= 1 && !sending && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4">
              <img src="/smart-help-avatar.png" alt="المساعدة الذكية" className="w-full h-full object-contain" />
            </div>
            <h4 className="text-white font-bold text-base mb-1">أهلاً فيك بدعم SONA</h4>
            <p className="text-white/30 text-xs mb-5 max-w-[280px]">
              شو بقدر أساعدك؟ براجع حسابك وبحل مشاكلك
            </p>
            <div className="w-full space-y-2 max-w-sm">
              {quickReplies.map((reply, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.2 }}
                  onClick={() => sendMessage(reply)}
                  className="w-full text-right px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:bg-[#409eff]/5 hover:border-[#409eff]/20 hover:text-[#409eff] transition-all"
                >
                  {reply}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.senderType === 'USER'
          const msgLevel = getMsgLevel(msg)
          const msgLevelConfig = LEVEL_CONFIG[msgLevel] || LEVEL_CONFIG[1]
          const isHandoff = msg._isHandoff || (msg.metadata ? (() => { try { return JSON.parse(msg.metadata).handoff } catch { return false } })() : false)
          const isChecking = isCheckingMessage(msg)
          const isLastUserMsg = isUser && i === messages.length - 1 - [...messages].reverse().findIndex(m => m.senderType === 'USER')

          return (
            <div
              key={msg.id || i}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                {/* Sender name with avatar */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <img
                      src={msgLevelConfig.avatar || '/sona-icon.png'}
                      alt=""
                      className="w-4 h-4 rounded-full object-contain"
                    />
                    <span className="text-[10px] font-bold" style={{ color: msgLevelConfig.color }}>
                      {msgLevelConfig.name}
                    </span>
                    {isHandoff && (
                      <span className="text-[8px] px-1 py-0.5 rounded-full bg-white/5 text-white/30">تمرير</span>
                    )}
                    {isChecking && (
                      <span className="text-[8px] px-1 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff]/60 flex items-center gap-0.5">
                        <Search className="w-2.5 h-2.5" /> يتحقق
                      </span>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#409eff] text-white rounded-bl-md'
                      : isChecking
                      ? 'rounded-bl-md border border-dashed'
                      : 'rounded-bl-md border'
                  }`}
                  style={!isUser ? {
                    background: isChecking ? `${msgLevelConfig.color}05` : `${msgLevelConfig.color}08`,
                    borderColor: isChecking ? `${msgLevelConfig.color}20` : `${msgLevelConfig.color}15`,
                    borderLeftWidth: msgLevel === 2 ? '3px' : '1px',
                    borderLeftColor: msgLevel === 2 ? msgLevelConfig.color : `${msgLevelConfig.color}15`,
                  } : undefined}
                >
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="صورة" className="max-w-full rounded-lg mb-2 max-h-48 object-cover" />
                  )}
                  {msg.message && (
                    <div className={`whitespace-pre-wrap break-words ${isChecking ? 'text-white/40' : ''}`}>
                      {isChecking && <Search className="w-3 h-3 inline ml-1 opacity-40 animate-pulse" />}
                      {msg.message}
                    </div>
                  )}
                </div>

                {/* Time and delivery status */}
                <div className={`flex items-center gap-1 mt-1 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-white/20 text-[10px]">{formatTime(msg.createdAt)}</span>
                  {isUser && isLastUserMsg && renderDeliveryStatus(msg._deliveryStatus)}
                </div>
              </div>
            </div>
          )
        })}

        {/* Connecting Animation during Escalation */}
        <AnimatePresence>
          {isConnecting && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mx-auto"
            >
              <div className="px-4 py-3 rounded-xl bg-[#409eff]/10 border border-[#409eff]/20 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#409eff]" />
                <span className="text-[#409eff] text-xs font-medium">جاري الاتصال بالفريق المتخصص...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Escalation Notice */}
        <AnimatePresence>
          {showEscalationNotice && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
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

        {/* Typing indicator with phases */}
        {typingPhase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <img
                  src={levelConfig.avatar}
                  alt=""
                  className="w-4 h-4 rounded-full object-contain"
                />
                <span className="text-[10px] font-bold" style={{ color: levelConfig.color }}>{levelConfig.name}</span>
                {isCheckingPhase && (
                  <span className="text-[8px] px-1 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff]/60 flex items-center gap-0.5">
                    <Eye className="w-2.5 h-2.5" /> يراجع حسابك
                  </span>
                )}
              </div>
              <div
                className={`rounded-2xl rounded-bl-md px-4 py-3 border ${
                  isCheckingPhase ? 'border-dashed' : ''
                }`}
                style={{
                  background: isCheckingPhase ? `${levelConfig.color}05` : `${levelConfig.color}08`,
                  borderColor: isCheckingPhase ? `${levelConfig.color}20` : `${levelConfig.color}15`,
                }}
              >
                <div className="flex items-center gap-2">
                  {isCheckingPhase && (
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-[#409eff]/60 animate-pulse" />
                    </div>
                  )}
                  {typingPhase === 'thinking' && (
                    <Sparkles size={12} className="text-amber-400/60 animate-pulse" />
                  )}
                  {!isPaused ? (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '0ms', backgroundColor: levelConfig.color }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '150ms', backgroundColor: levelConfig.color }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '300ms', backgroundColor: levelConfig.color }} />
                    </div>
                  ) : isStoppedMidSentence ? (
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: `${levelConfig.color}66` }} />
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: `${levelConfig.color}44` }} />
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: `${levelConfig.color}22` }} />
                    </div>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${levelConfig.color}44` }} />
                  )}
                  <span className="text-white/30 text-xs">{getTypingText()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Scroll anchor — browser uses this to maintain scroll position */}
        <div style={{ height: 1, overflowAnchor: 'auto' }} />
      </div>

      {/* ===== DE-ESCALATION RATING POPUP (Levels 2 & 3) ===== */}
      <AnimatePresence>
        {showRatingPopup && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-4 mb-3 p-5 rounded-xl bg-gradient-to-br from-[#04cf99]/10 to-[#409eff]/10 border border-[#04cf99]/20"
          >
            <h4 className="text-white text-sm font-bold mb-3 text-center">كيف كانت تجربة الدعم؟</h4>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  className="text-2xl transition-transform hover:scale-125"
                >
                  <span className={star <= (ratingHover || ratingValue) ? 'text-amber-400' : 'text-white/20'}>★</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!ratingValue || !conversation) return
                  try {
                    await fetch('/api/support/rate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ conversationId: conversation.id, rating: ratingValue, comment: '' })
                    })
                  } catch {}
                  setShowRatingPopup(false)
                  setRatingValue(0)
                  setRatingHover(0)
                }}
                className="flex-1 py-2.5 rounded-lg bg-[#04cf99] text-white text-sm font-bold hover:bg-[#04cf99]/80 transition-colors disabled:opacity-50"
                disabled={ratingValue === 0}
              >
                قيّم الآن
              </button>
              <button
                onClick={() => { setShowRatingPopup(false); setRatingValue(0); setRatingHover(0) }}
                className="flex-1 py-2.5 rounded-lg bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                قيّم لاحقاً
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== RATING POPUP ===== */}
      <AnimatePresence>
        {showRating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="shrink-0 border-t border-white/[0.06] bg-[#0d1117] p-5"
          >
            <div className="text-center">
              <h3 className="text-white font-bold text-base mb-2">كيف تقيم تجربتك مع دعم SONA؟</h3>
              <div className="flex justify-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    onMouseEnter={() => setRatingHover(star)}
                    onMouseLeave={() => setRatingHover(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className="w-8 h-8 transition-colors"
                      fill={(ratingHover || ratingValue) >= star ? '#e6a23c' : 'none'}
                      stroke={(ratingHover || ratingValue) >= star ? '#e6a23c' : '#444'}
                    />
                  </button>
                ))}
              </div>
              {ratingValue > 0 && (
                <div className="text-sm text-white/50 mb-3">
                  {ratingValue === 5 ? 'ممتاز' : ratingValue === 4 ? 'جيد جداً' : ratingValue === 3 ? 'جيد' : ratingValue === 2 ? 'مقبول' : 'سيئ'}
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={submitRating}
                  disabled={!ratingValue}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#409eff] to-[#04cf99] text-white font-bold text-sm disabled:opacity-40"
                >
                  إرسال التقييم
                </button>
                <button
                  onClick={() => setShowRating(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/40 text-sm"
                >
                  لاحقاً
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== RESOLUTION CHECK BUTTONS ===== */}
      {conversation?.resolutionAsked && !conversation?.rating && conversation?.status !== 'CLOSED' && !showRating && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowRating(true)}
              className="px-4 py-2 rounded-xl bg-[#04cf99]/10 text-[#04cf99] text-sm font-medium border border-[#04cf99]/20 hover:bg-[#04cf99]/20 transition-colors"
            >
              <CheckCircle className="w-4 h-4 inline -mt-0.5" /> نعم، تم الحل
            </button>
            <button
              onClick={() => sendMessage('لا، لم تُحل المشكلة')}
              className="px-4 py-2 rounded-xl bg-white/[0.04] text-white/50 text-sm hover:bg-white/[0.08] transition-colors"
            >
              <AlertCircle className="w-4 h-4 inline -mt-0.5" /> لا، لم تُحل
            </button>
          </div>
        </div>
      )}

      {/* ===== INPUT ===== */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0d1117] p-3">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={typingPhase !== 'idle' ? "الوكيل يراجع حسابك... يمكنك الكتابة" : "اكتب رسالتك..."}
              rows={1}
              maxLength={2000}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-[#409eff]/40 transition-colors"
              style={{ maxHeight: 120, direction: isRTL ? 'rtl' : 'ltr' }}
            />
          </div>

          <button
            onClick={() => sendMessage()}
            disabled={!messageInput.trim() || sending}
            className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#409eff] to-[#04cf99] flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {/* Level indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <LevelIcon className="w-3 h-3" style={{ color: levelConfig.color }} />
          <span className="text-[10px] text-white/25">{levelConfig.name} - {levelConfig.label}</span>
        </div>
      </div>
    </div>
  )
}
