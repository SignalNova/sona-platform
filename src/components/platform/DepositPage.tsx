'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { safeFixed } from '@/lib/utils';

const CRYPTO_METHODS = [
  {
    id: 'usdtbsc',
    label: 'USDT (BEP20)',
    labelEn: 'USDT (BEP20)',
    icon: '₮',
    color: '#f0b90b',
    bgColor: 'rgba(240, 185, 11, 0.1)',
    isPrimary: true,
  },
  {
    id: 'usdttrc20',
    label: 'USDT (TRC20)',
    labelEn: 'USDT (TRC20)',
    icon: '₮',
    color: '#26a17b',
    bgColor: 'rgba(38, 161, 123, 0.1)',
    isPrimary: false,
  },
  {
    id: 'btc',
    label: 'Bitcoin (BTC)',
    labelEn: 'Bitcoin (BTC)',
    icon: '₿',
    color: '#f7931a',
    bgColor: 'rgba(247, 147, 26, 0.1)',
    isPrimary: false,
  },
  {
    id: 'eth',
    label: 'Ethereum (ETH)',
    labelEn: 'Ethereum (ETH)',
    icon: 'Ξ',
    color: '#627eea',
    bgColor: 'rgba(98, 126, 234, 0.1)',
    isPrimary: false,
  },
  {
    id: 'bnb',
    label: 'BNB',
    labelEn: 'BNB',
    icon: '◆',
    color: '#f0b90b',
    bgColor: 'rgba(240, 185, 11, 0.1)',
    isPrimary: false,
  },
];

interface PaymentInfo {
  id: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  expiration: string | null;
  network: string;
  currency: string;
}

export default function DepositPage() {
  const { user, refreshUser } = useAppStore();
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usdtbsc');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initialCheckRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedCrypto = CRYPTO_METHODS.find((c) => c.id === currency)!;

  // Cleanup on unmount - critical for preventing flicker
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (initialCheckRef.current) {
        clearTimeout(initialCheckRef.current);
        initialCheckRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Countdown timer for payment expiration
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Background payment status check - runs silently, no UI indicators
  useEffect(() => {
    if (!paymentInfo?.id || paymentStatus === 'completed' || paymentStatus === 'failed') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (initialCheckRef.current) {
        clearTimeout(initialCheckRef.current);
        initialCheckRef.current = null;
      }
      return;
    }

    // Cancel any previous abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Background polling every 30 seconds
    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const res = await fetch('/api/deposit/check-nowpayments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: paymentInfo.id }),
          signal,
        });
        const data = await res.json();

        if (res.ok && mountedRef.current) {
          if (data.status === 'COMPLETED') {
            setPaymentStatus('completed');
            // Silently refresh user balance
            try { await refreshUser(); } catch { /* silent */ }
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          } else if (['FAILED', 'EXPIRED', 'REFUNDED'].includes(data.status)) {
            setPaymentStatus('failed');
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch (err) {
        // Silently continue - abort errors are expected on unmount
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }, 30000);

    // Initial check after 15 seconds
    initialCheckRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const res = await fetch('/api/deposit/check-nowpayments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: paymentInfo.id }),
          signal,
        });
        const data = await res.json();
        if (res.ok && mountedRef.current && data.status === 'COMPLETED') {
          setPaymentStatus('completed');
          try { await refreshUser(); } catch { /* silent */ }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }, 15000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (initialCheckRef.current) {
        clearTimeout(initialCheckRef.current);
        initialCheckRef.current = null;
      }
    };
  }, [paymentInfo?.id, paymentStatus]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setPaymentInfo(null);
    setPaymentStatus(null);

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setMessage({ type: 'error', text: t('deposit.invalidAmount') });
      return;
    }

    if (amountNum < 10) {
      setMessage({ type: 'error', text: t('deposit.minAmount', { amount: '10' }) });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: amountNum,
          currency,
        }),
      });
      const data = await res.json();

      if (!mountedRef.current) return;

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || t('deposit.serverError') });
        return;
      }

      setTransactionId(data.transaction?.id);
      setPaymentInfo(data.payment);
      setMessage({ type: 'success', text: t('deposit.depositCreated') });

      if (data.payment?.expiration) {
        const expiry = new Date(data.payment.expiration).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiry - now) / 1000));
        setCountdown(diff);
      } else {
        setCountdown(3600);
      }
    } catch {
      if (mountedRef.current) {
        setMessage({ type: 'error', text: t('deposit.serverError') });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewDeposit = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (initialCheckRef.current) {
      clearTimeout(initialCheckRef.current);
      initialCheckRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPaymentInfo(null);
    setTransactionId(null);
    setMessage(null);
    setPaymentStatus(null);
    setAmount('');
    setCountdown(0);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('deposit.title')}</h2>
        <p className="text-white/40 text-sm">{t('deposit.subtitle')}</p>
      </div>

      {/* Balance */}
      <div className="flex items-center gap-3 p-4 rounded-xl glass-gold">
        <ArrowDownToLine size={20} className="text-[#409eff]" />
        <span className="text-white/50 text-sm">{t('deposit.currentBalance')}:</span>
        <span className="text-[#409eff] font-bold">${safeFixed(user?.balance)}</span>
      </div>

      {!paymentInfo ? (
        /* Deposit Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount */}
          <div>
            <label className="text-white/50 text-sm mb-2 block">{t('deposit.depositAmount')}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setMessage(null); }}
              min="10"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[#409eff]/50 focus:outline-none transition-colors text-lg font-bold"
              dir="ltr"
              placeholder={t('deposit.amountPlaceholder')}
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[50, 100, 500, 1000, 5000].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(v.toString())}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-[#409eff]/10 hover:text-[#409eff] transition-colors">
                  ${v.toLocaleString()}
                </button>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-2">{t('deposit.minAmount', { amount: '10' })}</p>
          </div>

          {/* Crypto Method Selection */}
          <div>
            <label className="text-white/50 text-sm mb-2 block">{t('deposit.selectMethod')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CRYPTO_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setCurrency(m.id); setMessage(null); }}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-300 ${
                    currency === m.id
                      ? 'border-[#409eff]/30 bg-[#409eff]/10 text-[#409eff] gold-glow'
                      : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                  }`}
                >
                  {m.isPrimary && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#f0b90b]/20 text-[#f0b90b] text-[9px] font-bold whitespace-nowrap">
                      {t('deposit.recommended')}
                    </span>
                  )}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: m.bgColor, color: m.color }}
                  >
                    {m.icon}
                  </div>
                  <span className="text-xs font-medium text-center">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-l from-[#409eff] to-[#337ecc] text-white font-bold text-lg hover:shadow-lg hover:shadow-[#409eff]/20 transition-all btn-shine disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowDownToLine size={20} />}
            {t('deposit.createDeposit')}
          </button>
        </form>
      ) : (
        /* Payment Details */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Payment Address Card */}
          <div className="p-5 rounded-xl bg-[#1f2634] border border-[#409eff]/20 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#409eff]" />
              <span className="text-[#409eff] font-bold text-sm">{t('deposit.sendToAddress')}</span>
            </div>

            {/* Amount to send */}
            <div className="p-3 rounded-lg bg-white/5">
              <span className="text-white/40 text-xs block">{t('deposit.sendPayment')}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white text-xl font-bold" dir="ltr">
                  {paymentInfo.payAmount} {paymentInfo.payCurrency?.toUpperCase()}
                </span>
                <span className="text-white/30 text-sm">≈ ${amount}</span>
              </div>
            </div>

            {/* Payment Address */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-sm">{t('deposit.sendToAddress')} ({paymentInfo.network})</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#409eff]/10 text-[#409eff]">
                  {paymentInfo.network}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 text-[#409eff] text-sm overflow-x-auto font-mono break-all" dir="ltr">
                  {paymentInfo.payAddress}
                </code>
                <button
                  onClick={() => copyToClipboard(paymentInfo.payAddress)}
                  className="p-2.5 rounded-lg bg-white/5 text-white/40 hover:text-[#409eff] transition-colors flex-shrink-0"
                >
                  {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
              {copied && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-400 text-xs mt-1">
                  {t('deposit.addressCopied')}
                </motion.p>
              )}
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="w-36 h-36 rounded-xl bg-white flex items-center justify-center p-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(paymentInfo.payAddress)}`}
                  alt="QR Code"
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Timer */}
            {countdown > 0 && (
              <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <Clock size={14} className="text-amber-400" />
                <span className="text-amber-400 text-sm font-medium">
                  {formatCountdown(countdown)}
                </span>
                <span className="text-amber-400/50 text-xs">{t('deposit.remaining')}</span>
              </div>
            )}

            {/* Warning */}
            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <p className="text-yellow-400/70 text-xs leading-relaxed">
                ⚠️ {t('deposit.sendOnlyNetwork', { currency: paymentInfo.currency, network: paymentInfo.network })}
              </p>
            </div>
          </div>

          {/* Payment Status - silently updated, no verification text shown */}

          {/* New Deposit Button */}
          <button
            onClick={handleNewDeposit}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 font-medium text-sm hover:bg-white/10 hover:text-white transition-all"
          >
            {t('deposit.newDeposit')}
          </button>
        </motion.div>
      )}
    </div>
  );
}
