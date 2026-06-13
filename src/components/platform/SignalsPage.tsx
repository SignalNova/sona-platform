'use client';

import { safeFixed } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Zap,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  ShieldAlert,
  Gauge,
  ChevronDown,
  Star,
  Crown,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';

interface MarketPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
}

interface Signal {
  id: string;
  symbol: string;
  name: string;
  type: 'buy' | 'sell' | 'hold';
  price: number;
  targetPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  targetPrice3: number;
  stopLoss: number;
  confidence: number;
  timestamp: string;
  source: string;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  tier?: 'premium' | 'basic';
  premiumAnalysis?: {
    ichimoku?: { cloudColor: string; priceVsCloud: string; trendStrength: number; tenkanSen: number; kijunSen: number } | null;
    fibonacci?: { nearestSupport: number; nearestResistance: number; bias: string } | null;
    adx?: { adx: number; trendStrength: string; trendDirection: string; plusDI: number; minusDI: number } | null;
    stochastic?: { k: number; d: number; signal: string; divergence: string } | null;
    chartPattern?: { pattern: string; confidence: number; targetPrice: number | null; description: string } | null;
    supportResistance?: { strongestSupport: number; strongestResistance: number; pivotPrice: number } | null;
    aiAnalysis?: {
      direction: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      reasoning: string;
      keyLevels: { support: number; resistance: number };
      riskLevel: 'low' | 'medium' | 'high';
    } | null;
  } | null;
}

function generateSignalFromPrice(mp: MarketPrice, tier: 'premium' | 'basic' = 'basic'): Signal {
  let type: 'buy' | 'sell' | 'hold' = 'hold';
  let confidence = 50;
  let targetMultiplier = 1.03;
  let stopMultiplier = 0.97;

  if (mp.change24h > 3) {
    type = 'buy';
    confidence = 75 + Math.min(15, Math.floor(mp.change24h * 2));
    targetMultiplier = 1.05 + (mp.change24h / 200);
    stopMultiplier = 0.97;
  } else if (mp.change24h > 1) {
    type = 'buy';
    confidence = 65 + Math.floor(mp.change24h * 3);
    targetMultiplier = 1.03;
    stopMultiplier = 0.98;
  } else if (mp.change24h < -3) {
    type = 'sell';
    confidence = 70 + Math.min(15, Math.floor(Math.abs(mp.change24h) * 2));
    targetMultiplier = 0.95 - (Math.abs(mp.change24h) / 200);
    stopMultiplier = 1.03;
  } else if (mp.change24h < -1) {
    type = 'sell';
    confidence = 60 + Math.floor(Math.abs(mp.change24h) * 3);
    targetMultiplier = 0.97;
    stopMultiplier = 1.02;
  } else {
    type = 'hold';
    confidence = 50 + Math.floor(Math.abs(mp.change24h) * 10);
    targetMultiplier = mp.change24h >= 0 ? 1.02 : 0.98;
    stopMultiplier = mp.change24h >= 0 ? 0.98 : 1.02;
  }

  confidence = Math.min(95, Math.max(45, confidence));

  // Calculate 3 targets based on direction
  const direction = type === 'buy' ? 1 : type === 'sell' ? -1 : 0;
  const conservativeMultiplier = direction * 0.015;  // ~1.5% move
  const moderateMultiplier = direction * (targetMultiplier - 1);  // Same as existing target
  const aggressiveMultiplier = direction * 0.08;  // ~8% move

  return {
    id: mp.symbol,
    symbol: mp.symbol.replace('USDT', '/USDT'),
    name: mp.name,
    type,
    price: mp.price,
    targetPrice: mp.price * targetMultiplier,
    targetPrice1: mp.price * (1 + conservativeMultiplier),
    targetPrice2: mp.price * (1 + moderateMultiplier),
    targetPrice3: mp.price * (1 + aggressiveMultiplier),
    stopLoss: mp.price * stopMultiplier,
    confidence,
    timestamp: new Date().toISOString(),
    source: 'analysis-team',
    change24h: mp.change24h,
    high24h: mp.high24h,
    low24h: mp.low24h,
    volume: mp.volume,
    tier,
  };
}


function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price < 1) return safeFixed(price, 4);
  if (price < 100) return safeFixed(price, 3);
  return safeFixed(price, 2);
}

function formatVolume(vol: number | undefined | null): string {
  if (vol === undefined || vol === null || isNaN(vol)) return '0';
  if (vol >= 1e9) return `${safeFixed(vol / 1e9, 1)}B`;
  if (vol >= 1e6) return `${safeFixed(vol / 1e6, 1)}M`;
  if (vol >= 1e3) return `${safeFixed(vol / 1e3, 1)}K`;
  return safeFixed(vol, 0);
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return '#22c55e';
  if (confidence >= 60) return '#f59e0b';
  return '#ef4444';
}

function getConfidenceLabelKey(confidence: number): string {
  if (confidence >= 80) return 'signals.confidenceHigh';
  if (confidence >= 65) return 'signals.confidenceMedium';
  return 'signals.confidenceLow';
}

function percentChange(entry: number, target: number): string {
  if (!entry || entry === 0) return '0.0';
  const pct = ((target - entry) / entry) * 100;
  return (pct >= 0 ? '+' : '') + safeFixed(pct) + '%';
}

export default function SignalsPage() {
  const { user } = useAppStore();
  const { t, isRTL, dir } = useI18n();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'hold'>('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tier, setTier] = useState<'premium' | 'basic'>('basic');

  const loadMarketData = useCallback(async () => {
    try {
      // Try the signals API first for tier info
      const signalsRes = await fetch('/api/signals');
      if (signalsRes.ok) {
        const signalsData = await signalsRes.json();
        if (signalsData.tier) setTier(signalsData.tier);
        // If we got real signals, use them
        if (signalsData.signals && signalsData.signals.length > 0 && signalsData.signals[0].targetPrice1 !== undefined) {
          const mapped: Signal[] = signalsData.signals.map((s: any) => ({
            id: s.symbol?.replace('/USDT', 'USDT') || s.id || Math.random().toString(),
            symbol: s.symbol,
            name: s.symbol?.replace('/USDT', '') || '',
            type: (s.type === 'LONG' ? 'buy' : s.type === 'SHORT' ? 'sell' : 'hold') as 'buy' | 'sell' | 'hold',
            price: s.entryPrice || s.price || 0,
            targetPrice: s.targetPrice || 0,
            targetPrice1: s.targetPrice1 || s.targetPrice || 0,
            targetPrice2: s.targetPrice2 || s.targetPrice || 0,
            targetPrice3: s.targetPrice3 || s.targetPrice || 0,
            stopLoss: s.stopLoss || 0,
            confidence: s.calibratedConfidence || s.confidence || 50,
            timestamp: s.timestamp || new Date().toISOString(),
            source: 'analysis-team',
            change24h: 0,
            high24h: 0,
            low24h: 0,
            volume: 0,
            tier: signalsData.tier || 'basic',
            premiumAnalysis: s.analysis?.premium || (s.analysis as any)?.premium || null,
          }));
          // Filter out NEUTRAL/hold if needed
          setSignals(mapped);
          setLoading(false);
          return;
        }
      }

      // Fallback to market API
      const res = await fetch('/api/market');
      if (res.ok) {
        const data = await res.json();
        const prices: MarketPrice[] = Object.values(data.prices || {});
        if (prices.length > 0 && prices[0].price > 0) {
          const generatedSignals = prices
            .filter(p => p.price > 0)
            .map(p => generateSignalFromPrice(p, tier));
          setSignals(generatedSignals);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    loadMarketData();
    const interval = setInterval(() => {
      loadMarketData();
      setLastUpdate(new Date());
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [loadMarketData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMarketData();
    setLastUpdate(new Date());
    setRefreshing(false);
  };

  const filteredSignals = filter === 'all' ? signals : signals.filter((s) => s.type === filter);

  const typeConfig = {
    buy: {
      label: t('signals.long'),
      color: '#22c55e',
      bgColor: 'rgba(34,197,94,0.08)',
      borderColor: 'rgba(34,197,94,0.15)',
      icon: ArrowUpRight,
      gradient: 'from-green-500/10',
    },
    sell: {
      label: t('signals.short'),
      color: '#ef4444',
      bgColor: 'rgba(239,68,68,0.08)',
      borderColor: 'rgba(239,68,68,0.15)',
      icon: ArrowDownRight,
      gradient: 'from-red-500/10',
    },
    hold: {
      label: t('common.hold'),
      color: '#f59e0b',
      bgColor: 'rgba(245,158,11,0.08)',
      borderColor: 'rgba(245,158,11,0.15)',
      icon: Minus,
      gradient: 'from-amber-500/10',
    },
  };

  const activeBuySignals = signals.filter((s) => s.type === 'buy').length;
  const activeSellSignals = signals.filter((s) => s.type === 'sell').length;
  const avgConfidence = signals.length > 0 ? Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#409eff]" />
          <span className="text-white/30 text-sm">{t('signals.loadingSignals')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#409eff]/10">
              <Zap size={18} className="text-[#409eff]" />
            </div>
            {t('signals.title')}
          </h2>
          <p className="text-white/25 text-xs mt-1">{t('signals.subtitleUpdated')}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#409eff]/10 border border-[#409eff]/15 text-[#409eff] text-sm font-medium hover:bg-[#409eff]/20 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Premium Banner */}
      {tier === 'premium' ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 sm:p-4 rounded-xl bg-gradient-to-l from-amber-500/[0.08] to-[#1a1f2e] border border-amber-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
              <Crown size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-amber-300 font-bold text-sm">
                  إشارات SONA المميزة
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  PREMIUM
                </span>
              </div>
              <p className="text-white/30 text-xs mt-0.5">3 أهداف × 6 عملات — إتشيموكو + فيبوناتشي + ADX + ستوكاستيك + أنماط</p>
            </div>
            <Sparkles size={16} className="text-amber-400/50 shrink-0" />
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 sm:p-4 rounded-xl bg-gradient-to-l from-[#409eff]/[0.06] to-[#1a1f2e] border border-[#409eff]/10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#409eff]/10 shrink-0">
              <Lock size={18} className="text-[#409eff]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white/80 font-semibold text-xs sm:text-sm">
                حسّن إشاراتك مع باقة SONA
              </h3>
              <p className="text-white/25 text-[10px] sm:text-xs mt-0.5">
                احصل على 3 أهداف لكل إشارة، تحليل أعمق، و6 عملات رقمية
              </p>
            </div>
            <button
              onClick={() => {
                // Navigate to packages - use the app's routing
                window.location.hash = '#packages';
              }}
              className="px-3 py-1.5 rounded-lg bg-[#409eff]/15 border border-[#409eff]/20 text-[#409eff] text-xs font-bold hover:bg-[#409eff]/25 transition-all shrink-0"
            >
              فعّل الآن
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 sm:p-4 rounded-xl bg-[#1a1f2e] border border-white/[0.04]"
        >
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight size={12} className="text-green-400" />
            <span className="text-white/25 text-[10px]">{t('signals.long')}</span>
          </div>
          <div className="text-xl font-bold text-green-400">{activeBuySignals}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 sm:p-4 rounded-xl bg-[#1a1f2e] border border-white/[0.04]"
        >
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={12} className="text-[#409eff]" />
            <span className="text-white/25 text-[10px]">{t('signals.avgConfidence')}</span>
          </div>
          <div className="text-xl font-bold text-[#409eff]">{avgConfidence}%</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 sm:p-4 rounded-xl bg-[#1a1f2e] border border-white/[0.04]"
        >
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight size={12} className="text-red-400" />
            <span className="text-white/25 text-[10px]">{t('signals.short')}</span>
          </div>
          <div className="text-xl font-bold text-red-400">{activeSellSignals}</div>
        </motion.div>
      </div>

      {/* Live Market Banner - Simplified */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 rounded-xl bg-gradient-to-l from-emerald-500/[0.06] to-[#1a1f2e] border border-emerald-500/10"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 shrink-0">
            <Activity size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white/80 font-semibold text-xs">{t('signals.liveFromBinance')}</h3>
            <p className="text-white/20 text-[10px] mt-0.5">{t('signals.autoUpdateDesc')}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400/60 text-[10px]">{t('market.live')}</span>
          </div>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        {(['all', 'buy', 'sell', 'hold'] as const).map((f) => {
          const count = f === 'all' ? signals.length : signals.filter(s => s.type === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-[#409eff]/12 text-[#409eff] border border-[#409eff]/15'
                  : 'text-white/30 hover:text-white/50 border border-transparent'
              }`}
            >
              {f === 'all' ? t('common.all') : f === 'buy' ? t('signals.long') : f === 'sell' ? t('signals.short') : t('common.hold')}
              <span className={`text-[10px] ${filter === f ? 'text-[#409eff]/60' : 'text-white/15'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Signals List */}
      {refreshing ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#409eff]" />
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/20">
          <Activity size={32} className="mb-3 opacity-30" />
          <p className="text-sm">{t('signals.noSignals')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSignals.map((signal, i) => {
            const config = typeConfig[signal.type];
            const TypeIcon = config.icon;
            const confColor = getConfidenceColor(signal.confidence);
            const isExpanded = expandedId === signal.id;
            const profitPotential = ((signal.targetPrice ?? 0) - (signal.price ?? 0)) / (signal.price ?? 1) * 100;
            const profitPotentialStr = safeFixed(profitPotential);
            const riskPotential = ((signal.price ?? 0) - (signal.stopLoss ?? 0)) / (signal.price ?? 1) * 100;
            const riskPotentialStr = safeFixed(riskPotential);
            const rrRatio = riskPotential !== 0 ? safeFixed(Math.abs(profitPotential / riskPotential), 1) : '0.0';
            const isPremium = tier === 'premium' || signal.tier === 'premium';

            // Target percentages
            const t1Pct = percentChange(signal.price, signal.targetPrice1);
            const t2Pct = percentChange(signal.price, signal.targetPrice2);
            const t3Pct = percentChange(signal.price, signal.targetPrice3);

            return (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl bg-[#1a1f2e] border border-white/[0.04] hover:border-white/[0.08] transition-all overflow-hidden"
              >
                {/* Main Card Content */}
                <div className="p-3.5 sm:p-4">
                  {/* Top Row: Symbol + Type Badge + 24h Change */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {/* Symbol Icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: config.bgColor }}
                      >
                        <TypeIcon size={16} style={{ color: config.color }} />
                      </div>
                      {/* Symbol Name */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm" dir="ltr">{signal.symbol}</span>
                          <span className="text-white/20 text-[10px] hidden sm:inline">{signal.name}</span>
                          {isPremium && (
                            <Crown size={10} className="text-amber-400/60" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-medium ${signal.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}
                            dir="ltr"
                          >
                            {signal.change24h >= 0 ? '+' : ''}{safeFixed(signal.change24h)}%
                          </span>
                          <span className="text-white/10 text-[10px]">24h</span>
                        </div>
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{
                        backgroundColor: config.bgColor,
                        color: config.color,
                        border: `1px solid ${config.borderColor}`,
                      }}
                    >
                      {config.label}
                    </div>
                  </div>

                  {/* 3 Targets Row (Premium) or Single Target Row (Basic) */}
                  {isPremium ? (
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Target size={10} className="text-green-400/50" />
                        <span className="text-white/20 text-[10px]">الأهداف</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Target 1 - Conservative */}
                        <div className="p-2 rounded-lg bg-green-500/[0.04] border border-green-500/[0.06]">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-green-400/50 text-[9px]">محافظ</span>
                          </div>
                          <div className="text-green-400/80 font-bold text-xs" dir="ltr">${formatPrice(signal.targetPrice1)}</div>
                          <div className="text-green-400/40 text-[9px]" dir="ltr">{t1Pct}</div>
                        </div>
                        {/* Target 2 - Moderate (Main) */}
                        <div className="p-2 rounded-lg bg-green-500/[0.08] border border-green-500/[0.12]">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-green-400 font-semibold text-[9px]">متوسط</span>
                            <span className="px-1 py-0 rounded bg-green-500/20 text-green-400 text-[8px] font-bold">رئيسي</span>
                          </div>
                          <div className="text-green-400 font-bold text-sm" dir="ltr">${formatPrice(signal.targetPrice2)}</div>
                          <div className="text-green-400/50 text-[9px]" dir="ltr">{t2Pct}</div>
                        </div>
                        {/* Target 3 - Aggressive */}
                        <div className="p-2 rounded-lg bg-green-500/[0.04] border border-green-500/[0.06]">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-green-400/50 text-[9px]">جريء</span>
                            <Star size={7} className="text-green-400/40 fill-green-400/40" />
                          </div>
                          <div className="text-green-400/80 font-bold text-xs" dir="ltr">${formatPrice(signal.targetPrice3)}</div>
                          <div className="text-green-400/40 text-[9px]" dir="ltr">{t3Pct}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Basic tier - single target + upgrade CTA */
                    <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3">
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.price')}</div>
                        <div className="text-white font-bold text-xs sm:text-sm" dir="ltr">${formatPrice(signal.price)}</div>
                      </div>
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.target')}</div>
                        <div className="text-green-400 font-bold text-xs sm:text-sm" dir="ltr">${formatPrice(signal.targetPrice2 || signal.targetPrice)}</div>
                      </div>
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.stopLoss')}</div>
                        <div className="text-red-400 font-bold text-xs sm:text-sm" dir="ltr">${formatPrice(signal.stopLoss)}</div>
                      </div>
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.confidence')}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm" style={{ color: confColor }}>
                            {signal.confidence}%
                          </span>
                          <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden hidden sm:block">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${signal.confidence}%` }}
                              transition={{ duration: 0.8, delay: i * 0.04 + 0.2 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: confColor }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Premium tier: price + stop loss + confidence in a row */}
                  {isPremium && (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.price')}</div>
                        <div className="text-white font-bold text-xs sm:text-sm" dir="ltr">${formatPrice(signal.price)}</div>
                      </div>
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.stopLoss')}</div>
                        <div className="text-red-400 font-bold text-xs sm:text-sm" dir="ltr">${formatPrice(signal.stopLoss)}</div>
                      </div>
                      <div>
                        <div className="text-white/20 text-[10px] mb-0.5">{t('signals.confidence')}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm" style={{ color: confColor }}>
                            {signal.confidence}%
                          </span>
                          <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden hidden sm:block">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${signal.confidence}%` }}
                              transition={{ duration: 0.8, delay: i * 0.04 + 0.2 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: confColor }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Basic tier upgrade banner in card */}
                  {!isPremium && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#409eff]/[0.04] border border-[#409eff]/[0.06] mb-3">
                      <Lock size={10} className="text-[#409eff]/40 shrink-0" />
                      <span className="text-[#409eff]/50 text-[10px] flex-1">
                        فعّل باقة SONA للحصول على 3 أهداف وتحليل أعمق
                      </span>
                    </div>
                  )}

                  {/* Confidence Bar (Mobile) + Expand Toggle */}
                  <div className="flex items-center gap-2">
                    {/* Mobile confidence bar */}
                    <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden sm:hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${signal.confidence}%` }}
                        transition={{ duration: 0.8, delay: i * 0.04 + 0.2 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: confColor }}
                      />
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : signal.id)}
                      className="flex items-center gap-1 text-white/15 text-[10px] hover:text-white/30 transition-colors"
                    >
                      <span className="hidden sm:inline">{isExpanded ? t('common.less') : t('common.more')}</span>
                      <ChevronDown
                        size={10}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1 border-t border-white/[0.04]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div className="p-2.5 rounded-lg bg-white/[0.02]">
                            <div className="text-white/20 text-[10px] mb-1">{t('signals.expectedProfit')}</div>
                            <div className={`font-bold text-xs ${profitPotential >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                              {profitPotential >= 0 ? '+' : ''}{profitPotentialStr}%
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white/[0.02]">
                            <div className="text-white/20 text-[10px] mb-1">{t('signals.riskRatio')}</div>
                            <div className="font-bold text-xs text-white/60" dir="ltr">1:{rrRatio}</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white/[0.02]">
                            <div className="text-white/20 text-[10px] mb-1">{t('signals.high24h')}</div>
                            <div className="font-bold text-xs text-white/60" dir="ltr">${formatPrice(signal.high24h)}</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white/[0.02]">
                            <div className="text-white/20 text-[10px] mb-1">{t('signals.low24h')}</div>
                            <div className="font-bold text-xs text-white/60" dir="ltr">${formatPrice(signal.low24h)}</div>
                          </div>
                        </div>

                        {/* Premium Analysis Details (SONA Package Only) */}
                        {isPremium && signal.premiumAnalysis && (
                          <div className="mt-3 pt-2 border-t border-white/[0.03]">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Crown size={10} className="text-amber-400/60" />
                              <span className="text-amber-400/60 text-[10px] font-semibold">تحليل SONA المتقدم</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {/* Ichimoku */}
                              {signal.premiumAnalysis.ichimoku && (
                                <div className="p-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.06]">
                                  <div className="text-white/20 text-[9px] mb-1">إتشيموكو</div>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[9px] font-medium ${
                                      signal.premiumAnalysis.ichimoku.cloudColor === 'bullish' ? 'text-green-400' :
                                      signal.premiumAnalysis.ichimoku.cloudColor === 'bearish' ? 'text-red-400' : 'text-white/40'
                                    }`}>
                                      {signal.premiumAnalysis.ichimoku.cloudColor === 'bullish' ? '☁️ صعودي' :
                                       signal.premiumAnalysis.ichimoku.cloudColor === 'bearish' ? '☁️ هبوطي' : '☁️ محايد'}
                                    </span>
                                  </div>
                                  <div className="text-white/30 text-[9px] mt-0.5">
                                    قوة: {signal.premiumAnalysis.ichimoku.trendStrength}%
                                  </div>
                                </div>
                              )}
                              {/* ADX */}
                              {signal.premiumAnalysis.adx && (
                                <div className="p-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.06]">
                                  <div className="text-white/20 text-[9px] mb-1">ADX</div>
                                  <div className={`text-[9px] font-medium ${
                                    signal.premiumAnalysis.adx.trendStrength === 'strong' ? 'text-green-400' :
                                    signal.premiumAnalysis.adx.trendStrength === 'moderate' ? 'text-amber-400' : 'text-white/40'
                                  }`}>
                                    {signal.premiumAnalysis.adx.trendStrength === 'strong' ? 'اتجاه قوي' :
                                     signal.premiumAnalysis.adx.trendStrength === 'moderate' ? 'اتجاه متوسط' :
                                     signal.premiumAnalysis.adx.trendStrength === 'weak' ? 'اتجاه ضعيف' : 'بدون اتجاه'}
                                  </div>
                                  <div className="text-white/30 text-[9px] mt-0.5" dir="ltr">
                                    ADX: {signal.premiumAnalysis.adx.adx}
                                  </div>
                                </div>
                              )}
                              {/* Stochastic */}
                              {signal.premiumAnalysis.stochastic && (
                                <div className="p-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.06]">
                                  <div className="text-white/20 text-[9px] mb-1">ستوكاستيك</div>
                                  <div className={`text-[9px] font-medium ${
                                    signal.premiumAnalysis.stochastic.signal === 'oversold' ? 'text-green-400' :
                                    signal.premiumAnalysis.stochastic.signal === 'overbought' ? 'text-red-400' : 'text-white/40'
                                  }`}>
                                    {signal.premiumAnalysis.stochastic.signal === 'oversold' ? 'تشبع بيعي' :
                                     signal.premiumAnalysis.stochastic.signal === 'overbought' ? 'تشبع شرائي' : 'محايد'}
                                  </div>
                                  {signal.premiumAnalysis.stochastic.divergence !== 'none' && (
                                    <div className={`text-[8px] mt-0.5 font-medium ${
                                      signal.premiumAnalysis.stochastic.divergence === 'bullish' ? 'text-green-400/70' : 'text-red-400/70'
                                    }`}>
                                      {signal.premiumAnalysis.stochastic.divergence === 'bullish' ? '🔄 تباعد صعودي' : '🔄 تباعد هبوطي'}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Fibonacci */}
                              {signal.premiumAnalysis.fibonacci && (
                                <div className="p-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.06]">
                                  <div className="text-white/20 text-[9px] mb-1">فيبوناتشي</div>
                                  <div className={`text-[9px] font-medium ${
                                    signal.premiumAnalysis.fibonacci.bias === 'bullish' ? 'text-green-400' :
                                    signal.premiumAnalysis.fibonacci.bias === 'bearish' ? 'text-red-400' : 'text-white/40'
                                  }`}>
                                    {signal.premiumAnalysis.fibonacci.bias === 'bullish' ? '📈 صعودي' :
                                     signal.premiumAnalysis.fibonacci.bias === 'bearish' ? '📉 هبوطي' : '↔️ محايد'}
                                  </div>
                                  <div className="text-white/30 text-[9px] mt-0.5" dir="ltr">
                                    S: ${formatPrice(signal.premiumAnalysis.fibonacci.nearestSupport)} | R: ${formatPrice(signal.premiumAnalysis.fibonacci.nearestResistance)}
                                  </div>
                                </div>
                              )}
                              {/* Chart Pattern */}
                              {signal.premiumAnalysis.chartPattern && signal.premiumAnalysis.chartPattern.pattern !== 'none' && (
                                <div className="p-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.06]">
                                  <div className="text-white/20 text-[9px] mb-1">نمط السعر</div>
                                  <div className={`text-[9px] font-medium ${
                                    signal.premiumAnalysis.chartPattern.pattern === 'double_bottom' || signal.premiumAnalysis.chartPattern.pattern === 'inverse_head_shoulders' ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {signal.premiumAnalysis.chartPattern.pattern === 'double_top' ? 'قمة مزدوجة' :
                                     signal.premiumAnalysis.chartPattern.pattern === 'double_bottom' ? 'قاع مزدوج' :
                                     signal.premiumAnalysis.chartPattern.pattern === 'head_shoulders' ? 'رأس وكتفين' :
                                     signal.premiumAnalysis.chartPattern.pattern === 'inverse_head_shoulders' ? 'رأس وكتفين معكوس' : signal.premiumAnalysis.chartPattern.pattern}
                                  </div>
                                  <div className="text-white/30 text-[9px] mt-0.5">
                                    ثقة: {signal.premiumAnalysis.chartPattern.confidence}%
                                  </div>
                                </div>
                              )}
                              {/* Support/Resistance */}
                              {signal.premiumAnalysis.supportResistance && (
                                <div className="p-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.06]">
                                  <div className="text-white/20 text-[9px] mb-1">دعم/مقاومة</div>
                                  <div className="text-white/40 text-[9px]" dir="ltr">
                                    S: ${formatPrice(signal.premiumAnalysis.supportResistance.strongestSupport)}
                                  </div>
                                  <div className="text-white/40 text-[9px]" dir="ltr">
                                    R: ${formatPrice(signal.premiumAnalysis.supportResistance.strongestResistance)}
                                  </div>
                                  <div className="text-white/25 text-[8px] mt-0.5" dir="ltr">
                                    Pivot: ${formatPrice(signal.premiumAnalysis.supportResistance.pivotPrice)}
                                  </div>
                                </div>
                              )}
                              {/* AI Analysis (SONA Package - Premium) */}
                              {signal.premiumAnalysis?.aiAnalysis && (
                                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/[0.06] to-amber-500/[0.03] border border-purple-500/[0.10]">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Sparkles size={8} className="text-purple-400" />
                                    <span className="text-purple-400 text-[9px] font-bold">تحليل SONA الذكي</span>
                                  </div>
                                  <div className={`text-[9px] font-medium ${
                                    signal.premiumAnalysis.aiAnalysis.direction === 'bullish' ? 'text-green-400' :
                                    signal.premiumAnalysis.aiAnalysis.direction === 'bearish' ? 'text-red-400' : 'text-white/40'
                                  }`}>
                                    {signal.premiumAnalysis.aiAnalysis.direction === 'bullish' ? '🟢 صعودي' :
                                     signal.premiumAnalysis.aiAnalysis.direction === 'bearish' ? '🔴 هبوطي' : '⚪ محايد'}
                                    <span className="text-white/30 mr-1">({signal.premiumAnalysis.aiAnalysis.confidence}%)</span>
                                  </div>
                                  {signal.premiumAnalysis.aiAnalysis.reasoning && (
                                    <div className="text-white/30 text-[8px] mt-0.5 leading-relaxed">
                                      {signal.premiumAnalysis.aiAnalysis.reasoning}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-green-400/40 text-[8px]" dir="ltr">
                                      S: ${formatPrice(signal.premiumAnalysis.aiAnalysis.keyLevels.support)}
                                    </span>
                                    <span className="text-red-400/40 text-[8px]" dir="ltr">
                                      R: ${formatPrice(signal.premiumAnalysis.aiAnalysis.keyLevels.resistance)}
                                    </span>
                                    <span className={`text-[8px] ${
                                      signal.premiumAnalysis.aiAnalysis.riskLevel === 'low' ? 'text-green-400/50' :
                                      signal.premiumAnalysis.aiAnalysis.riskLevel === 'high' ? 'text-red-400/50' : 'text-amber-400/50'
                                    }`}>
                                      {signal.premiumAnalysis.aiAnalysis.riskLevel === 'low' ? 'مخاطرة منخفضة' :
                                       signal.premiumAnalysis.aiAnalysis.riskLevel === 'high' ? 'مخاطرة عالية' : 'مخاطرة متوسطة'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.03]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: confColor }}
                            />
                            <span className="text-white/25 text-[10px]">
                              {t('signals.confidence')} {t(getConfidenceLabelKey(signal.confidence))}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-white/15 text-[10px]">
                            <Clock size={8} />
                            <span>{new Date(signal.timestamp).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="w-1 h-1 rounded-full bg-[#409eff]/30 animate-pulse" />
        <span className="text-white/12 text-[10px]">
          {t('signals.lastUpdate')}: {lastUpdate.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
