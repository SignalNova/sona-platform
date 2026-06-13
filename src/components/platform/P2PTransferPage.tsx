'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useI18n } from '@/hooks/useI18n'
import { safeFixed } from '@/lib/utils'

// ===== THEME =====
const D = {
  bg: '#030708',
  card: '#1f2634',
  cardHover: '#2c313e',
  surface: '#2c313e',
  border: 'rgba(255,255,255,0.06)',
  accent: '#409eff',
  accentBg: 'rgba(64,158,255,0.08)',
  accentBorder: 'rgba(64,158,255,0.2)',
  green: '#04cf99',
  greenBg: 'rgba(4,207,153,0.08)',
  greenBorder: 'rgba(4,207,153,0.2)',
  red: '#f36464',
  redBg: 'rgba(243,100,100,0.08)',
  redBorder: 'rgba(243,100,100,0.2)',
  yellow: '#e6a23c',
  yellowBg: 'rgba(230,162,60,0.08)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.25)',
}

interface P2PTransferRecord {
  id: string
  fromUserId: string
  toUserId: string
  amount: number
  fee: number
  status: string
  description: string
  createdAt: string
}

export default function P2PTransferPage() {
  const { user, refreshUser } = useAppStore()
  const { t, lang } = useI18n()
  const isAr = lang === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'

  // CRITICAL FIX: Reconcile balance on mount to fix any drift, then refresh user
  const [balanceLoading, setBalanceLoading] = useState(true)
  useEffect(() => {
    const fetchFreshBalance = async () => {
      setBalanceLoading(true)
      try {
        // Reconcile balance first to fix any inconsistency
        const token = useAppStore.getState().getToken()
        await fetch('/api/balance/reconcile', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch { /* silent */ }
      await refreshUser()
      setBalanceLoading(false)
    }
    fetchFreshBalance()
  }, [refreshUser])

  const [recipientEmail, setRecipientEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [transfers, setTransfers] = useState<P2PTransferRecord[]>([])
  const [loadingTransfers, setLoadingTransfers] = useState(true)
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send')

  // Load transfer history
  const loadTransfers = useCallback(async () => {
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/transactions?userId=' + user?.id + '&type=P2P_SEND&type=P2P_RECEIVE&limit=20', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setTransfers(data.transactions || [])
      }
    } catch { /* silent */ }
    setLoadingTransfers(false)
  }, [user?.id])

  useEffect(() => {
    if (user) loadTransfers()
  }, [user, loadTransfers])

  const handleTransfer = async () => {
    const amt = parseFloat(amount)
    if (!recipientEmail || !amt || amt <= 0) {
      setMessage({ type: 'err', text: isAr ? 'يرجى إدخال بيانات صحيحة' : 'Please enter valid data' })
      return
    }
    if (amt < 1) {
      setMessage({ type: 'err', text: isAr ? 'الحد الأدنى للتحويل هو $1' : 'Minimum transfer is $1' })
      return
    }
    // CLIENT-SIDE SECURITY: Self-transfer prevention (case-insensitive)
    if (recipientEmail.trim().toLowerCase() === (user?.email || '').toLowerCase()) {
      setMessage({ type: 'err', text: isAr ? 'لا يمكنك التحويل لنفس حسابك!' : 'You cannot transfer to your own account!' })
      return
    }
    // CLIENT-SIDE SECURITY: Maximum transfer amount ($10,000)
    if (amt > 10000) {
      setMessage({ type: 'err', text: isAr ? 'الحد الأقصى للتحويل الواحد هو $10,000' : 'Maximum transfer per transaction is $10,000' })
      return
    }
    const effectiveBalance = user?.withdrawableBalance ?? user?.balance ?? 0
    if (amt > effectiveBalance) {
      setMessage({ type: 'err', text: isAr ? `رصيدك غير كافي للتحويل. الحد الأقصى: $${effectiveBalance.toFixed(2)}` : `Insufficient balance for transfer. Max: $${effectiveBalance.toFixed(2)}` })
      return
    }

    setSending(true)
    setMessage(null)
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/p2p/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ toUserEmail: recipientEmail, amount: amt, description }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || (isAr ? 'فشل التحويل' : 'Transfer failed') })
      } else {
        setMessage({ type: 'ok', text: isAr ? `تم تحويل $${amt.toFixed(2)} بنجاح!` : `$${amt.toFixed(2)} transferred successfully!` })
        setRecipientEmail('')
        setAmount('')
        setDescription('')
        await refreshUser()
        await loadTransfers()
        setTimeout(() => setMessage(null), 4000)
      }
    } catch {
      setMessage({ type: 'err', text: isAr ? 'حدث خطأ في الاتصال' : 'Connection error' })
    }
    setSending(false)
  }

  const quickAmounts = [5, 10, 25, 50, 100]

  return (
    <div className="page-enter" style={{ maxWidth: 560, margin: '0 auto', direction: dir }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: D.textPrimary, marginBottom: 4 }}>
          {isAr ? 'تحويل داخلي P2P' : 'P2P Internal Transfer'}
        </h2>
        <p style={{ fontSize: 13, color: D.textSecondary, lineHeight: 1.5 }}>
          {isAr ? 'حوّل أموالك لأي مستخدم على المنصة مجاناً بدون أي رسوم' : 'Transfer funds to any user on the platform for free with zero fees'}
        </p>
      </div>

      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(64,158,255,0.12) 0%, rgba(4,207,153,0.12) 100%)',
        border: `1px solid ${D.accentBorder}`,
        borderRadius: 16, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: D.textSecondary, marginBottom: 6, fontFamily: "'Cairo', sans-serif" }}>
          {isAr ? 'رصيدك المتاح للتحويل' : 'Available Balance for Transfer'}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: D.green, fontFamily: 'monospace' }}>
          {balanceLoading ? '...' : `$${safeFixed(user?.balance || 0)}`}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'الرصيد الكلي' : 'Total Balance'}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, fontFamily: 'monospace' }}>${safeFixed(user?.balance)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: D.textMuted }}>{isAr ? 'رسوم التحويل' : 'Transfer Fee'}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: D.green }}>0%</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        <button
          onClick={() => setActiveTab('send')}
          style={{
            flex: 1, padding: '12px 0',
            background: activeTab === 'send' ? D.card : 'transparent',
            border: 'none', borderBottom: activeTab === 'send' ? `2px solid ${D.accent}` : `1px solid ${D.border}`,
            color: activeTab === 'send' ? D.accent : D.textMuted,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
          }}
        >
          {isAr ? 'تحويل جديد' : 'New Transfer'}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1, padding: '12px 0',
            background: activeTab === 'history' ? D.card : 'transparent',
            border: 'none', borderBottom: activeTab === 'history' ? `2px solid ${D.accent}` : `1px solid ${D.border}`,
            color: activeTab === 'history' ? D.accent : D.textMuted,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
          }}
        >
          {isAr ? 'سجل التحويلات' : 'Transfer History'}
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderTop: 'none', borderRadius: '0 0 16px 16px', padding: 24 }}>

        {/* Send Tab */}
        {activeTab === 'send' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Recipient Email */}
            <div>
              <label style={{ fontSize: 12, color: D.textSecondary, marginBottom: 6, display: 'block', fontWeight: 600, fontFamily: "'Cairo', sans-serif" }}>
                {isAr ? 'بريد المستلم' : 'Recipient Email'}
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder={isAr ? 'أدخل بريد المستلم الإلكتروني' : 'Enter recipient email address'}
                style={{
                  width: '100%', padding: '14px 16px', background: D.bg,
                  border: `1px solid ${D.border}`, borderRadius: 12,
                  color: D.textPrimary, fontSize: 14, outline: 'none',
                  fontFamily: "'Cairo', sans-serif", boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                dir="ltr"
                onFocus={(e) => e.currentTarget.style.borderColor = D.accent}
                onBlur={(e) => e.currentTarget.style.borderColor = D.border}
              />
            </div>

            {/* Amount */}
            <div>
              <label style={{ fontSize: 12, color: D.textSecondary, marginBottom: 6, display: 'block', fontWeight: 600, fontFamily: "'Cairo', sans-serif" }}>
                {isAr ? 'مبلغ التحويل (USDT)' : 'Transfer Amount (USDT)'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                style={{
                  width: '100%', padding: '14px 16px', background: D.bg,
                  border: `1px solid ${D.border}`, borderRadius: 12,
                  color: D.textPrimary, fontSize: 16, fontWeight: 700, outline: 'none',
                  fontFamily: 'monospace', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                dir="ltr"
                onFocus={(e) => e.currentTarget.style.borderColor = D.accent}
                onBlur={(e) => e.currentTarget.style.borderColor = D.border}
              />

              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {quickAmounts.map(qa => (
                  <button
                    key={qa}
                    onClick={() => setAmount(String(qa))}
                    style={{
                      padding: '6px 14px', background: D.accentBg, border: `1px solid ${D.accentBorder}`,
                      borderRadius: 8, color: D.accent, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'monospace',
                    }}
                  >
                    ${qa}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(String(user?.withdrawableBalance ?? user?.balance ?? 0))}
                  style={{
                    padding: '6px 14px', background: D.greenBg, border: `1px solid ${D.greenBorder}`,
                    borderRadius: 8, color: D.green, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
              </div>
            </div>

            {/* Description (Optional) */}
            <div>
              <label style={{ fontSize: 12, color: D.textSecondary, marginBottom: 6, display: 'block', fontWeight: 600, fontFamily: "'Cairo', sans-serif" }}>
                {isAr ? 'ملاحظة (اختياري)' : 'Note (Optional)'}
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={isAr ? 'أضف ملاحظة للتحويل...' : 'Add a note for this transfer...'}
                style={{
                  width: '100%', padding: '14px 16px', background: D.bg,
                  border: `1px solid ${D.border}`, borderRadius: 12,
                  color: D.textPrimary, fontSize: 14, outline: 'none',
                  fontFamily: "'Cairo', sans-serif", boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = D.accent}
                onBlur={(e) => e.currentTarget.style.borderColor = D.border}
              />
            </div>

            {/* Transfer Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div style={{
                background: D.bg, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: D.textSecondary }}>{isAr ? 'مبلغ التحويل' : 'Transfer Amount'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, fontFamily: 'monospace' }}>
                    ${parseFloat(amount).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: D.textSecondary }}>{isAr ? 'رسوم التحويل' : 'Transfer Fee'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: D.green }}>$0.00 (0%)</span>
                </div>
                <div style={{ height: 1, background: D.border, margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: D.textSecondary, fontWeight: 700 }}>{isAr ? 'المجموع' : 'Total'}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: D.accent, fontFamily: 'monospace' }}>
                    ${parseFloat(amount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Message */}
            {message && (
              <div style={{
                padding: '12px 16px', borderRadius: 12, fontSize: 13,
                fontFamily: "'Cairo', sans-serif", fontWeight: 600,
                background: message.type === 'ok' ? D.greenBg : D.redBg,
                border: `1px solid ${message.type === 'ok' ? D.greenBorder : D.redBorder}`,
                color: message.type === 'ok' ? D.green : D.red,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {message.type === 'ok' ? '✓' : '✕'} {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleTransfer}
              disabled={sending || !recipientEmail || !amount}
              style={{
                width: '100%', padding: '16px 0',
                background: (sending || !recipientEmail || !amount) ? 'rgba(64,158,255,0.3)' : 'linear-gradient(135deg, #409eff, #04cf99)',
                border: 'none', color: '#fff', borderRadius: 12,
                fontSize: 16, fontWeight: 900, cursor: (sending || !recipientEmail || !amount) ? 'not-allowed' : 'pointer',
                fontFamily: "'Cairo', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.3s ease',
                boxShadow: (!sending && recipientEmail && amount) ? '0 4px 20px rgba(64,158,255,0.3)' : 'none',
              }}
            >
              {sending ? (isAr ? 'جاري التحويل...' : 'Transferring...') : (isAr ? 'تحويل الآن' : 'Transfer Now')}
            </button>

            {/* Info Note */}
            <div style={{
              background: D.yellowBg, border: `1px solid rgba(230,162,60,0.2)`,
              borderRadius: 10, padding: '10px 14px',
              fontSize: 11, color: D.yellow, fontFamily: "'Cairo', sans-serif", lineHeight: 1.6,
            }}>
              {isAr
                ? 'التحويل فوري ومجاني تماماً. يتم خصم المبلغ من رصيدك وإضافته لرصيد المستلم مباشرة.'
                : 'Transfers are instant and completely free. The amount is deducted from your balance and added to the recipient\'s balance directly.'}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            {loadingTransfers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 32, height: 32, border: `3px solid ${D.border}`, borderTopColor: D.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : transfers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transfers.map((tx: any) => (
                  <div key={tx.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', background: D.bg, borderRadius: 12,
                    borderLeft: `3px solid ${tx.type === 'P2P_SEND' ? D.red : D.green}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: tx.type === 'P2P_SEND' ? D.red : D.green, marginBottom: 2 }}>
                        {tx.type === 'P2P_SEND' ? (isAr ? 'تحويل صادر' : 'Sent') : (isAr ? 'تحويل وارد' : 'Received')}
                      </div>
                      <div style={{ fontSize: 10, color: D.textMuted, fontFamily: 'monospace' }}>
                        {new Date(tx.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: tx.type === 'P2P_SEND' ? D.red : D.green, fontFamily: 'monospace' }}>
                        {tx.type === 'P2P_SEND' ? '-' : '+'}${tx.amount?.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: D.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💸</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Cairo', sans-serif" }}>
                  {isAr ? 'لا توجد تحويلات بعد' : 'No transfers yet'}
                </div>
                <div style={{ fontSize: 12, color: D.textMuted, marginTop: 4, fontFamily: "'Cairo', sans-serif" }}>
                  {isAr ? 'ستظهر تحويلاتك هنا' : 'Your transfers will appear here'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
