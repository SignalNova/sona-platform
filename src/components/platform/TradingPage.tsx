'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useI18n } from '@/hooks/useI18n'
import { motion, AnimatePresence } from 'framer-motion'

// ═══════════════════════════════════════════════════════════════
// SONA ULTRA — Deep Blue Premium Trading Terminal
// ═══════════════════════════════════════════════════════════════
const T = {
  bg: '#060A14',
  bg2: '#0A1020',
  bg3: '#0E1530',
  card: '#111A35',
  cardHover: '#162045',
  surface: '#0D1530',
  border: 'rgba(40,80,180,0.15)',
  borderLight: 'rgba(40,80,180,0.25)',
  borderActive: 'rgba(60,130,255,0.4)',
  accent: '#3C82FF',
  accentHover: '#2A6FE8',
  accentBg: 'rgba(60,130,255,0.08)',
  accentBorder: 'rgba(60,130,255,0.3)',
  accentGlow: 'rgba(60,130,255,0.25)',
  gold: '#FFB020',
  goldBg: 'rgba(255,176,32,0.08)',
  goldBorder: 'rgba(255,176,32,0.25)',
  green: '#00E676',
  greenDark: '#00C853',
  greenBg: 'rgba(0,230,118,0.06)',
  greenBorder: 'rgba(0,230,118,0.18)',
  greenGlow: 'rgba(0,230,118,0.15)',
  red: '#FF5252',
  redDark: '#FF1744',
  redBg: 'rgba(255,82,82,0.06)',
  redBorder: 'rgba(255,82,82,0.18)',
  redGlow: 'rgba(255,82,82,0.15)',
  purple: '#A78BFA',
  purpleBg: 'rgba(167,139,250,0.08)',
  cyan: '#22D3EE',
  cyanBg: 'rgba(34,211,238,0.08)',
  orange: '#FB923C',
  blue1: '#1E3A8A',
  blue2: '#1E40AF',
  blue3: '#2563EB',
  blue4: '#3B82F6',
  blue5: '#60A5FA',
  blueDeep: '#0C1A3A',
  textPrimary: '#E8EDF5',
  textSecondary: '#8B9DC3',
  textMuted: '#4A5F8A',
  glass: 'rgba(10,16,32,0.92)',
  glassBorder: 'rgba(60,130,255,0.12)',
  panelBg: '#0A1228',
  panelHeader: '#0E1838',
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface CandleData {
  time: string; open: number; high: number; low: number; close: number; volume: number
}
interface BinanceTicker {
  symbol: string; price: number; change: number; high24h: number; low24h: number;
  volume24h: number; quoteVolume24h: number
}
interface PositionData {
  id: string; type: string; symbol: string; entryPrice: number; exitPrice: number | null;
  amount: number; profitLoss: number; status: string; confidence: number;
  stopLoss: number | null; takeProfit: number | null; quantity: number;
  isManual: boolean; openedAt: string; closedAt: string | null;
  leverage?: number; marginType?: string;
  sessionSymbol?: string; investmentAmount?: number;
}
interface OrderBookEntry { price: number; amount: number; total: number }
interface DrawingLine {
  id: string; type: 'horizontal' | 'trend' | 'rectangle';
  startX: number; startY: number; endX: number; endY: number;
}
interface StrategySignal {
  type: 'BUY' | 'SELL' | 'NEUTRAL'
  entry: number
  stopLoss: number
  targets: [number, number, number]
  confidence: number
  reason: string
  zoneHigh?: number
  zoneLow?: number
}

// ═══════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════
const fmt = (n: number | undefined | null) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
const fmtPrice = (n: number) =>
  n >= 1000 ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : n.toFixed(4)
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const fmtVol = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return n.toFixed(2)
}

// ═══════════════════════════════════════════════════════════════
// PAIRS & TIMEFRAMES
// ═══════════════════════════════════════════════════════════════
const PAIRS = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT', icon: '₿', decimals: 2, nameAr: 'بيتكوين' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', icon: 'Ξ', decimals: 2, nameAr: 'إيثريوم' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT', icon: '◆', decimals: 2, nameAr: 'بي إن بي' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT', icon: '◎', decimals: 3, nameAr: 'سولانا' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT', icon: '✕', decimals: 4, nameAr: 'ريبل' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USDT', icon: 'Ð', decimals: 5, nameAr: 'دوج كوين' },
  { symbol: 'ADAUSDT', label: 'ADA/USDT', icon: '₳', decimals: 4, nameAr: 'كاردانو' },
  { symbol: 'AVAXUSDT', label: 'AVAX/USDT', icon: '▲', decimals: 3, nameAr: 'أفالانش' },
  { symbol: 'DOTUSDT', label: 'DOT/USDT', icon: '●', decimals: 3, nameAr: 'بولكادوت' },
  { symbol: 'LINKUSDT', label: 'LINK/USDT', icon: '⬡', decimals: 3, nameAr: 'تشين لينك' },
]
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']

// ═══════════════════════════════════════════════════════════════
// INDICATOR CALCULATIONS
// ═══════════════════════════════════════════════════════════════
function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result.push(sum / period)
  }
  return result
}

function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const k = 2 / (period + 1)
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    if (i === period - 1) {
      let sum = 0; for (let j = 0; j < period; j++) sum += data[j]
      result.push(sum / period); continue
    }
    const prev = result[i - 1]!
    result.push(data[i] * k + prev * (1 - k))
  }
  return result
}

function calcBollingerBands(data: number[], period: number = 20, stdDev: number = 2) {
  const sma = calcSMA(data, period)
  const upper: (number | null)[] = [], lower: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) { upper.push(null); lower.push(null); continue }
    let sumSqDiff = 0
    for (let j = i - period + 1; j <= i; j++) sumSqDiff += (data[j] - sma[i]!) ** 2
    const sd = Math.sqrt(sumSqDiff / period)
    upper.push(sma[i]! + stdDev * sd); lower.push(sma[i]! - stdDev * sd)
  }
  return { middle: sma, upper, lower }
}

function calcRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  if (data.length < period + 1) return data.map(() => null)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1]
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change)
  }
  avgGain /= period; avgLoss /= period
  for (let i = 0; i < period; i++) result.push(null)
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  result.push(100 - 100 / (1 + rs))
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(100 - 100 / (1 + rs2))
  }
  return result
}

function calcMACD(data: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
  const emaFast = calcEMA(data, fast), emaSlow = calcEMA(data, slow)
  const macdLine: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) { macdLine.push(null); continue }
    macdLine.push(emaFast[i]! - emaSlow[i]!)
  }
  const macdValues = macdLine.filter(v => v !== null) as number[]
  const signalLine = calcEMA(macdValues, signal)
  const signalResult: (number | null)[] = []
  let idx = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) { signalResult.push(null); continue }
    signalResult.push(signalLine[idx] ?? null); idx++
  }
  const histogram: (number | null)[] = []
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || signalResult[i] === null) { histogram.push(null); continue }
    histogram.push(macdLine[i]! - signalResult[i]!)
  }
  return { macdLine, signalLine: signalResult, histogram }
}

function calcStochastic(candles: CandleData[], kPeriod: number = 14, dPeriod: number = 3, smoothing: number = 3) {
  const rawK: (number | null)[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) { rawK.push(null); continue }
    let highest = -Infinity, lowest = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high
      if (candles[j].low < lowest) lowest = candles[j].low
    }
    const range = highest - lowest
    rawK.push(range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100)
  }
  const smoothK: (number | null)[] = []
  for (let i = 0; i < rawK.length; i++) {
    if (rawK[i] === null) { smoothK.push(null); continue }
    let sum = 0, count = 0
    for (let j = Math.max(0, i - smoothing + 1); j <= i; j++) {
      if (rawK[j] !== null) { sum += rawK[j]!; count++ }
    }
    smoothK.push(count > 0 ? sum / count : null)
  }
  const dLine: (number | null)[] = []
  for (let i = 0; i < smoothK.length; i++) {
    if (smoothK[i] === null || i < kPeriod - 1 + smoothing - 1) { dLine.push(null); continue }
    let sum = 0, count = 0
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (smoothK[j] !== null) { sum += smoothK[j]!; count++ }
    }
    dLine.push(count === dPeriod ? sum / dPeriod : null)
  }
  return { kLine: smoothK, dLine }
}

function calcATR(candles: CandleData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  if (candles.length < 2) return candles.map(() => null)
  const trueRanges: number[] = [candles[0].high - candles[0].low]
  for (let i = 1; i < candles.length; i++) {
    const tr1 = candles[i].high - candles[i].low
    const tr2 = Math.abs(candles[i].high - candles[i - 1].close)
    const tr3 = Math.abs(candles[i].low - candles[i - 1].close)
    trueRanges.push(Math.max(tr1, tr2, tr3))
  }
  result.push(null)
  for (let i = 1; i < period; i++) result.push(null)
  let atr = 0
  for (let i = 1; i <= period; i++) atr += trueRanges[i]
  atr /= period; result.push(atr)
  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period; result.push(atr)
  }
  return result
}

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL INDICATOR CALCULATIONS
// ═══════════════════════════════════════════════════════════════
function calcVWAP(candles: CandleData[]): (number | null)[] {
  const result: (number | null)[] = []
  let cumVol = 0, cumTPVol = 0
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3
    cumVol += candles[i].volume
    cumTPVol += tp * candles[i].volume
    result.push(cumVol > 0 ? cumTPVol / cumVol : null)
  }
  return result
}

function calcParabolicSAR(candles: CandleData[], step: number = 0.02, maxStep: number = 0.2): (number | null)[] {
  const result: (number | null)[] = []
  if (candles.length < 2) return candles.map(() => null)
  let isUp = candles[1].close > candles[0].close
  let af = step
  let ep = isUp ? candles[0].high : candles[0].low
  let sar = isUp ? candles[0].low : candles[0].high
  result.push(null)
  for (let i = 1; i < candles.length; i++) {
    sar = sar + af * (ep - sar)
    if (isUp) {
      if (i >= 2) sar = Math.min(sar, candles[i - 1].low, candles[i - 2].low)
      if (candles[i].low <= sar) { isUp = false; sar = ep; af = step; ep = candles[i].low; }
      else { if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(af + step, maxStep) } }
    } else {
      if (i >= 2) sar = Math.max(sar, candles[i - 1].high, candles[i - 2].high)
      if (candles[i].high >= sar) { isUp = true; sar = ep; af = step; ep = candles[i].high; }
      else { if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(af + step, maxStep) } }
    }
    result.push(sar)
  }
  return result
}

function calcADX(candles: CandleData[], period: number = 14): { adx: (number | null)[], plusDI: (number | null)[], minusDI: (number | null)[] } {
  const tr: number[] = [candles[0].high - candles[0].low]
  const plusDM: number[] = [0], minusDM: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    tr.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)))
    const upMove = candles[i].high - candles[i - 1].high
    const downMove = candles[i - 1].low - candles[i].low
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }
  const smoothTR: (number | null)[] = [], smoothPlusDM: (number | null)[] = [], smoothMinusDM: (number | null)[] = []
  for (let i = 0; i < period; i++) { smoothTR.push(null); smoothPlusDM.push(null); smoothMinusDM.push(null) }
  let str = 0, spdm = 0, smdm = 0
  for (let i = 0; i < period; i++) { str += tr[i]; spdm += plusDM[i]; smdm += minusDM[i] }
  smoothTR.push(str); smoothPlusDM.push(spdm); smoothMinusDM.push(smdm)
  for (let i = period; i < candles.length - 1; i++) {
    str = str - str / period + tr[i + 1]; spdm = spdm - spdm / period + plusDM[i + 1]; smdm = smdm - smdm / period + minusDM[i + 1]
    smoothTR.push(str); smoothPlusDM.push(spdm); smoothMinusDM.push(smdm)
  }
  const plusDI: (number | null)[] = [], minusDI: (number | null)[] = [], dx: (number | null)[] = []
  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === null || smoothTR[i] === 0) { plusDI.push(null); minusDI.push(null); dx.push(null); continue }
    const pdi = (smoothPlusDM[i]! / smoothTR[i]!) * 100
    const mdi = (smoothMinusDM[i]! / smoothTR[i]!) * 100
    plusDI.push(pdi); minusDI.push(mdi)
    dx.push(pdi + mdi !== 0 ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : null)
  }
  const adx: (number | null)[] = []
  let firstADX: number | null = null
  for (let i = 0; i < dx.length; i++) {
    if (dx[i] === null) { adx.push(null); continue }
    if (firstADX === null) { firstADX = dx[i]; adx.push(null); continue }
    firstADX = (firstADX * (period - 1) + dx[i]!) / period
    adx.push(firstADX)
  }
  return { adx, plusDI, minusDI }
}

function calcCCI(candles: CandleData[], period: number = 20): (number | null)[] {
  const tp = candles.map(c => (c.high + c.low + c.close) / 3)
  const result: (number | null)[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    let sum = 0; for (let j = i - period + 1; j <= i; j++) sum += tp[j]
    const mean = sum / period
    let meanDev = 0; for (let j = i - period + 1; j <= i; j++) meanDev += Math.abs(tp[j] - mean)
    meanDev /= period
    result.push(meanDev > 0 ? (tp[i] - mean) / (0.015 * meanDev) : null)
  }
  return result
}

function calcWilliams(candles: CandleData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    let high = -Infinity, low = Infinity
    for (let j = i - period + 1; j <= i; j++) { high = Math.max(high, candles[j].high); low = Math.min(low, candles[j].low) }
    const range = high - low
    result.push(range === 0 ? -50 : ((high - candles[i].close) / range) * -100)
  }
  return result
}

function calcMFI(candles: CandleData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  let posMF = 0, negMF = 0
  for (let i = 0; i < candles.length; i++) {
    if (i < 1) { result.push(null); continue }
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3
    const prevTP = (candles[i - 1].high + candles[i - 1].low + candles[i - 1].close) / 3
    const mf = tp * candles[i].volume
    if (tp > prevTP) posMF += mf; else negMF += mf
    if (i < period) { result.push(null); continue }
    if (i > period) {
      const oldTP = (candles[i - period].high + candles[i - period].low + candles[i - period].close) / 3
      const oldPrevTP = (candles[i - period - 1].high + candles[i - period - 1].low + candles[i - period - 1].close) / 3
      const oldMF = oldTP * candles[i - period].volume
      if (oldTP > oldPrevTP) posMF -= oldMF; else negMF -= oldMF
    }
    result.push(negMF === 0 ? 100 : 100 - 100 / (1 + posMF / negMF))
  }
  return result
}

function calcOBV(candles: CandleData[]): number[] {
  const result: number[] = []
  let obv = 0
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { obv = candles[i].volume }
    else { if (candles[i].close > candles[i - 1].close) obv += candles[i].volume; else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume }
    result.push(obv)
  }
  return result
}

function calcIchimoku(candles: CandleData[], tenkan: number = 9, kijun: number = 26, senkou: number = 52): {
  tenkanSen: (number | null)[], kijunSen: (number | null)[], senkouA: (number | null)[], senkouB: (number | null)[], chikou: (number | null)[]
} {
  const hl = (start: number, end: number) => {
    let h = -Infinity, l = Infinity
    for (let i = start; i <= end; i++) { h = Math.max(h, candles[i].high); l = Math.min(l, candles[i].low) }
    return (h + l) / 2
  }
  const tenkanSen: (number | null)[] = [], kijunSen: (number | null)[] = [], senkouA: (number | null)[] = [], senkouB: (number | null)[] = [], chikou: (number | null)[] = []
  for (let i = 0; i < candles.length; i++) {
    tenkanSen.push(i >= tenkan - 1 ? hl(i - tenkan + 1, i) : null)
    kijunSen.push(i >= kijun - 1 ? hl(i - kijun + 1, i) : null)
    senkouA.push(null); senkouB.push(null); chikou.push(null)
  }
  for (let i = kijun; i < candles.length; i++) {
    if (tenkanSen[i] !== null && kijunSen[i] !== null) {
      const idx = i + kijun < candles.length ? i + kijun : candles.length - 1
      senkouA[idx] = (tenkanSen[i]! + kijunSen[i]!) / 2
    }
    if (i >= senkou - 1) {
      const idx = i + kijun < candles.length ? i + kijun : candles.length - 1
      senkouB[idx] = hl(i - senkou + 1, i)
    }
  }
  for (let i = 0; i < candles.length - kijun; i++) { chikou[i] = candles[i + kijun].close }
  return { tenkanSen, kijunSen, senkouA, senkouB, chikou }
}

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL TRADING STRATEGIES
// ═══════════════════════════════════════════════════════════════

// Strategy 1: Quantum Momentum Matrix (مصفوفة الزخم الكمي)
function calcQuantumMomentum(candles: CandleData[]): StrategySignal | null {
  if (candles.length < 50) return null
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)
  const currentPrice = closes[closes.length - 1]

  // 1. EMA alignment (EMA 9/21/50)
  const ema9 = calcEMA(closes, 9)
  const ema21 = calcEMA(closes, 21)
  const ema50 = calcEMA(closes, 50)
  const e9 = ema9[closes.length - 1]
  const e21 = ema21[closes.length - 1]
  const e50 = ema50[closes.length - 1]

  const bullishAlign = e9 !== null && e21 !== null && e50 !== null && e9 > e21 && e21 > e50
  const bearishAlign = e9 !== null && e21 !== null && e50 !== null && e9 < e21 && e21 < e50

  // 2. RSI momentum
  const rsi = calcRSI(closes, 14)
  const currentRSI = rsi[closes.length - 1]

  // 3. MACD histogram flip
  const macd = calcMACD(closes, 12, 26, 9)
  const currentHist = macd.histogram[closes.length - 1]
  const prevHist = macd.histogram[closes.length - 2]
  const histFlipBull = prevHist !== null && currentHist !== null && prevHist < 0 && currentHist > 0
  const histFlipBear = prevHist !== null && currentHist !== null && prevHist > 0 && currentHist < 0

  // 4. Bollinger Band squeeze + breakout
  const bb = calcBollingerBands(closes, 20, 2)
  const bbUpperLast = bb.upper[closes.length - 1]
  const bbLowerLast = bb.lower[closes.length - 1]
  const currentBBWidth = (bbUpperLast !== null && bbLowerLast !== null) ? bbUpperLast - bbLowerLast : 0
  let avgBBWidth = 0
  let bbCount = 0
  for (let i = Math.max(0, closes.length - 20); i < closes.length; i++) {
    if (bb.upper[i] !== null && bb.lower[i] !== null) {
      avgBBWidth += (bb.upper[i]! - bb.lower[i]!)
      bbCount++
    }
  }
  avgBBWidth = bbCount > 0 ? avgBBWidth / bbCount : 1
  const isSqueeze = currentBBWidth < avgBBWidth * 0.8
  const priceAboveUpperBB = bbUpperLast !== null && currentPrice > bbUpperLast
  const priceBelowLowerBB = bbLowerLast !== null && currentPrice < bbLowerLast

  // 5. Volume confirmation (current > 20-period SMA)
  const volMA = calcSMA(volumes, 20)
  const currentVol = volumes[volumes.length - 1]
  const avgVol = volMA[volumes.length - 1]
  const volumeConfirm = avgVol !== null && currentVol > avgVol

  // 6. ATR for dynamic stop loss
  const atr = calcATR(candles, 14)
  const currentATR = atr[closes.length - 1]

  // Scoring system
  let buyScore = 0, sellScore = 0
  if (bullishAlign) buyScore += 30
  if (bearishAlign) sellScore += 30
  if (histFlipBull) buyScore += 25
  if (histFlipBear) sellScore += 25
  if (currentRSI !== null && currentRSI < 40) buyScore += 15
  if (currentRSI !== null && currentRSI > 60) sellScore += 15
  if (isSqueeze && priceAboveUpperBB) buyScore += 20
  if (isSqueeze && priceBelowLowerBB) sellScore += 20
  if (volumeConfirm) { buyScore += 10; sellScore += 10 }

  if (buyScore >= 60 && currentATR !== null) {
    const sl = currentPrice - 1.5 * currentATR
    const risk = currentPrice - sl
    return {
      type: 'BUY', entry: currentPrice, stopLoss: sl,
      targets: [currentPrice + risk, currentPrice + risk * 2, currentPrice + risk * 3],
      confidence: Math.min(buyScore, 98),
      reason: 'EMA bullish alignment + momentum shift + volume confirmation',
    }
  }
  if (sellScore >= 60 && currentATR !== null) {
    const sl = currentPrice + 1.5 * currentATR
    const risk = sl - currentPrice
    return {
      type: 'SELL', entry: currentPrice, stopLoss: sl,
      targets: [currentPrice - risk, currentPrice - risk * 2, currentPrice - risk * 3],
      confidence: Math.min(sellScore, 98),
      reason: 'EMA bearish alignment + momentum shift + volume confirmation',
    }
  }
  return null
}

// Strategy 2: Smart Liquidity Hunter (صياد السيولة الذكي)
function calcSmartLiquidityHunter(candles: CandleData[]): StrategySignal | null {
  if (candles.length < 55) return null
  const closes = candles.map(c => c.close)
  const currentPrice = closes[closes.length - 1]
  const volumes = candles.map(c => c.volume)

  // 1. EMA 50 as filter
  const ema50 = calcEMA(closes, 50)
  const e50 = ema50[closes.length - 1]
  const aboveEMA50 = e50 !== null && currentPrice > e50
  const belowEMA50 = e50 !== null && currentPrice < e50

  // 2. Order Block detection
  let demandZoneHigh: number | null = null
  let demandZoneLow: number | null = null
  let supplyZoneHigh: number | null = null
  let supplyZoneLow: number | null = null

  // Look back for demand zone: last bearish candle before strong bullish move
  for (let i = candles.length - 2; i >= Math.max(1, candles.length - 20); i--) {
    const curr = candles[i]
    const _prev = candles[i - 1] // kept for future expansion
    void _prev
    const next = candles[i + 1] || candles[i]
    // Demand zone: bearish candle followed by strong bullish
    if (curr.close < curr.open && next.close > next.open) {
      const moveStrength = (next.close - next.open) / (curr.open - curr.close + 0.0001)
      if (moveStrength > 1.5) {
        demandZoneHigh = curr.open
        demandZoneLow = Math.min(curr.low, curr.close)
        break
      }
    }
  }
  // Supply zone: bullish candle followed by strong bearish
  for (let i = candles.length - 2; i >= Math.max(1, candles.length - 20); i--) {
    const curr = candles[i]
    const next = candles[i + 1] || candles[i]
    if (curr.close > curr.open && next.close < next.open) {
      const moveStrength = (next.open - next.close) / (curr.close - curr.open + 0.0001)
      if (moveStrength > 1.5) {
        supplyZoneHigh = Math.max(curr.high, curr.close)
        supplyZoneLow = curr.open
        break
      }
    }
  }

  // 3. Fair Value Gap (FVG) detection
  let bullishFVG: { high: number; low: number } | null = null
  let bearishFVG: { high: number; low: number } | null = null
  if (candles.length >= 3) {
    const c1 = candles[candles.length - 3]
    const c3 = candles[candles.length - 1]
    // Bullish FVG: gap between c1 high and c3 low
    if (c3.low > c1.high) {
      bullishFVG = { high: c3.low, low: c1.high }
    }
    // Bearish FVG: gap between c1 low and c3 high
    if (c1.low > c3.high) {
      bearishFVG = { high: c1.low, low: c3.high }
    }
  }

  // 4. Volume spike (institutional activity)
  const volMA = calcSMA(volumes, 20)
  const currentVol = volumes[volumes.length - 1]
  const avgVol = volMA[volumes.length - 1]
  const volSpike = avgVol !== null && currentVol > avgVol * 2

  // 5. RSI(7) for timing
  const rsi7 = calcRSI(closes, 7)
  const currentRSI7 = rsi7[closes.length - 1]

  // BUY signal logic: above EMA50, near demand zone or bullish FVG, RSI7 < 40, vol spike
  let buyScore = 0, sellScore = 0
  const nearDemand = demandZoneLow !== null && currentPrice >= demandZoneLow && currentPrice <= (demandZoneHigh ?? demandZoneLow * 1.01)
  const nearSupply = supplyZoneHigh !== null && currentPrice <= supplyZoneHigh && currentPrice >= (supplyZoneLow ?? supplyZoneHigh * 0.99)
  const inBullishFVG = bullishFVG !== null && currentPrice >= bullishFVG.low && currentPrice <= bullishFVG.high
  const inBearishFVG = bearishFVG !== null && currentPrice >= bearishFVG.low && currentPrice <= bearishFVG.high

  if (aboveEMA50) buyScore += 20
  if (belowEMA50) sellScore += 20
  if (nearDemand || inBullishFVG) buyScore += 25
  if (nearSupply || inBearishFVG) sellScore += 25
  if (currentRSI7 !== null && currentRSI7 < 40) buyScore += 20
  if (currentRSI7 !== null && currentRSI7 > 60) sellScore += 20
  if (volSpike) { buyScore += 15; sellScore += 15 }
  if (demandZoneLow !== null && currentPrice <= demandZoneLow * 1.005) buyScore += 10
  if (supplyZoneHigh !== null && currentPrice >= supplyZoneHigh * 0.995) sellScore += 10

  if (buyScore >= 55) {
    const zoneLow = demandZoneLow ?? bullishFVG?.low ?? currentPrice * 0.98
    const zoneHigh = demandZoneHigh ?? bullishFVG?.high ?? currentPrice
    const zoneHeight = zoneHigh - zoneLow
    const sl = zoneLow - zoneHeight * 0.1
    return {
      type: 'BUY', entry: currentPrice, stopLoss: sl,
      targets: [
        currentPrice + zoneHeight * 1.0,
        currentPrice + zoneHeight * 1.618,
        currentPrice + zoneHeight * 2.618,
      ],
      confidence: Math.min(buyScore, 95),
      reason: 'Demand zone + institutional volume + RSI oversold',
      zoneHigh, zoneLow,
    }
  }
  if (sellScore >= 55) {
    const zoneLow = supplyZoneLow ?? bearishFVG?.low ?? currentPrice
    const zoneHigh = supplyZoneHigh ?? bearishFVG?.high ?? currentPrice * 1.02
    const zoneHeight = zoneHigh - zoneLow
    const sl = zoneHigh + zoneHeight * 0.1
    return {
      type: 'SELL', entry: currentPrice, stopLoss: sl,
      targets: [
        currentPrice - zoneHeight * 1.0,
        currentPrice - zoneHeight * 1.618,
        currentPrice - zoneHeight * 2.618,
      ],
      confidence: Math.min(sellScore, 95),
      reason: 'Supply zone + institutional volume + RSI overbought',
      zoneHigh, zoneLow,
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// SONA CHART — Professional Candlestick Chart
// ═══════════════════════════════════════════════════════════════
function SonaChart({
  candles, selectedPair, isAr, openPositions, drawings, onDrawingsChange, activeDrawTool, onSetActiveDrawTool,
  showEMA, showBB, showRSI, showMACD, showStoch, showATR, showVWAP, showSAR, showADX, showCCI, showWilliams, showMFI, showOBV, showIchimoku, showSignalLines, chartHeight, currentPrice: currentPriceProp,
  activeStrategy, strategyResult,
}: {
  candles: CandleData[]; selectedPair: typeof PAIRS[0]; isAr: boolean
  openPositions?: PositionData[]; drawings?: DrawingLine[]
  onDrawingsChange?: (d: DrawingLine[]) => void
  activeDrawTool?: string | null; onSetActiveDrawTool?: (tool: string | null) => void
  showEMA: boolean; showBB: boolean; showRSI: boolean; showMACD: boolean
  showStoch: boolean; showATR: boolean; showVWAP: boolean; showSAR: boolean
  showADX: boolean; showCCI: boolean; showWilliams: boolean; showMFI: boolean
  showOBV: boolean; showIchimoku: boolean; showSignalLines: boolean
  chartHeight?: number; currentPrice?: number
  activeStrategy?: string | null; strategyResult?: StrategySignal | null
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const volMaRef = useRef<any>(null)
  const ema7Ref = useRef<any>(null)
  const ema25Ref = useRef<any>(null)
  const sma50Ref = useRef<any>(null)
  const bbUpperRef = useRef<any>(null)
  const bbMiddleRef = useRef<any>(null)
  const bbLowerRef = useRef<any>(null)
  const rsiChartRef = useRef<any>(null)
  const rsiSeriesRef = useRef<any>(null)
  const rsiObRef = useRef<any>(null)
  const rsiOsRef = useRef<any>(null)
  const macdChartRef = useRef<any>(null)
  const macdLineRef = useRef<any>(null)
  const macdSignalRef = useRef<any>(null)
  const macdHistRef = useRef<any>(null)
  const stochChartRef = useRef<any>(null)
  const stochKRef = useRef<any>(null)
  const stochDRef = useRef<any>(null)
  const stochObRef = useRef<any>(null)
  const stochOsRef = useRef<any>(null)
  const atrChartRef = useRef<any>(null)
  const atrSeriesRef = useRef<any>(null)
  const vwapRef = useRef<any>(null)
  const sarRef = useRef<any>(null)
  const adxChartRef = useRef<any>(null)
  const adxLineRef = useRef<any>(null)
  const adxPlusDIRef = useRef<any>(null)
  const adxMinusDIRef = useRef<any>(null)
  const cciChartRef = useRef<any>(null)
  const cciSeriesRef = useRef<any>(null)
  const williamsChartRef = useRef<any>(null)
  const williamsSeriesRef = useRef<any>(null)
  const mfiChartRef = useRef<any>(null)
  const mfiSeriesRef = useRef<any>(null)
  const obvChartRef = useRef<any>(null)
  const obvSeriesRef = useRef<any>(null)
  const ichimokuTenkanRef = useRef<any>(null)
  const ichimokuKijunRef = useRef<any>(null)
  const ichimokuSenkouARef = useRef<any>(null)
  const ichimokuSenkouBRef = useRef<any>(null)
  const ichimokuChikouRef = useRef<any>(null)
  const [chartReady, setChartReady] = useState(false)
  const signalLinesRef = useRef<any[]>([])
  const strategyLinesRef = useRef<any[]>([])
  const drawingLinesRef = useRef<any[]>([])
  const lcRef = useRef<any>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const activeDrawToolRef = useRef(activeDrawTool)
  const drawingsRef = useRef(drawings)
  const dragStartRef = useRef<{ x: number; y: number; time: number; price: number } | null>(null)
  const isDraggingRef = useRef(false)
  useEffect(() => { activeDrawToolRef.current = activeDrawTool }, [activeDrawTool])
  useEffect(() => { drawingsRef.current = drawings }, [drawings])
  const mainChartHeight = chartHeight ?? 400

  const chartData = useMemo(() => {
    if (!candles || candles.length === 0) return { candleData: [], volumeData: [], closes: [] }
    const candleData = candles.map(c => ({
      time: Math.floor(new Date(c.time).getTime() / 1000) as unknown as string,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }))
    const volumeData = candles.map(c => ({
      time: Math.floor(new Date(c.time).getTime() / 1000) as unknown as string,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)',
    }))
    return { candleData, volumeData, closes: candles.map(c => c.close) }
  }, [candles])

  useEffect(() => {
    if (!chartContainerRef.current) return
    let mounted = true
    const initChart = async () => {
      const lc = await import('lightweight-charts')
      if (!mounted || !chartContainerRef.current) return
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

      const chart = lc.createChart(chartContainerRef.current, {
        layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11 },
        grid: { vertLines: { color: 'rgba(30,58,138,0.08)' }, horzLines: { color: 'rgba(30,58,138,0.08)' } },
        crosshair: {
          mode: 0,
          vertLine: { color: 'rgba(60,130,255,0.3)', width: 1, style: 2, labelBackgroundColor: T.accent },
          horzLine: { color: 'rgba(60,130,255,0.3)', width: 1, style: 2, labelBackgroundColor: T.accent },
        },
        rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.05, bottom: 0.25 } },
        timeScale: { borderColor: T.border, timeVisible: true, secondsVisible: false, rightOffset: 20, barSpacing: 22, minBarSpacing: 4 },
        handleScroll: { vertTouchDrag: false },
        attributionLogo: false,
      } as any)
      chartRef.current = chart

      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: T.green, downColor: T.red,
        borderUpColor: T.green, borderDownColor: T.red,
        wickUpColor: T.green, wickDownColor: T.red,
      })
      candleSeriesRef.current = candleSeries

      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: 'volume' }, priceScaleId: 'volume',
      })
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      volumeSeriesRef.current = volumeSeries

      const volMa = chart.addSeries(lc.LineSeries, {
        color: 'rgba(60,130,255,0.35)', lineWidth: 1, priceLineVisible: false,
        lastValueVisible: false, crosshairMarkerVisible: false, priceScaleId: 'volume',
      })
      volMaRef.current = volMa

      const ema7 = chart.addSeries(lc.LineSeries, {
        color: T.blue4, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      ema7Ref.current = ema7

      const ema25 = chart.addSeries(lc.LineSeries, {
        color: T.purple, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      ema25Ref.current = ema25

      const sma50 = chart.addSeries(lc.LineSeries, {
        color: T.cyan, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      sma50Ref.current = sma50

      const bbUpper = chart.addSeries(lc.LineSeries, {
        color: 'rgba(0,230,118,0.4)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: 2,
      })
      bbUpperRef.current = bbUpper

      const bbMiddle = chart.addSeries(lc.LineSeries, {
        color: 'rgba(60,130,255,0.25)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      bbMiddleRef.current = bbMiddle

      const bbLower = chart.addSeries(lc.LineSeries, {
        color: 'rgba(255,82,82,0.4)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: 2,
      })
      bbLowerRef.current = bbLower

      // RSI pane
      const rsiContainer = wrapperRef.current?.querySelector('#rsi-pane') as HTMLElement
      if (rsiContainer) {
        const rsiChart = lc.createChart(rsiContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        rsiChartRef.current = rsiChart
        const rsiSeries = rsiChart.addSeries(lc.LineSeries, { color: T.purple, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } })
        rsiSeriesRef.current = rsiSeries
        const rsiOb = rsiChart.addSeries(lc.LineSeries, { color: 'rgba(255,82,82,0.25)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        rsiObRef.current = rsiOb
        const rsiOs = rsiChart.addSeries(lc.LineSeries, { color: 'rgba(0,230,118,0.25)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        rsiOsRef.current = rsiOs
      }

      // MACD pane
      const macdContainer = wrapperRef.current?.querySelector('#macd-pane') as HTMLElement
      if (macdContainer) {
        const macdChart = lc.createChart(macdContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        macdChartRef.current = macdChart
        const macdLine = macdChart.addSeries(lc.LineSeries, { color: T.blue4, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false })
        macdLineRef.current = macdLine
        const macdSignal = macdChart.addSeries(lc.LineSeries, { color: T.orange, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        macdSignalRef.current = macdSignal
        const macdHist = macdChart.addSeries(lc.HistogramSeries, { priceFormat: { type: 'price', precision: 2, minMove: 0.01 } })
        macdHistRef.current = macdHist
      }

      // Stochastic pane
      const stochContainer = wrapperRef.current?.querySelector('#stoch-pane') as HTMLElement
      if (stochContainer) {
        const stochChart = lc.createChart(stochContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.05, bottom: 0.05 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        stochChartRef.current = stochChart
        const stochK = stochChart.addSeries(lc.LineSeries, { color: T.blue4, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } })
        stochKRef.current = stochK
        const stochD = stochChart.addSeries(lc.LineSeries, { color: T.orange, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        stochDRef.current = stochD
        const stochOb = stochChart.addSeries(lc.LineSeries, { color: 'rgba(255,82,82,0.25)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        stochObRef.current = stochOb
        const stochOs = stochChart.addSeries(lc.LineSeries, { color: 'rgba(0,230,118,0.25)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        stochOsRef.current = stochOs
      }

      // ATR pane
      const atrContainer = wrapperRef.current?.querySelector('#atr-pane') as HTMLElement
      if (atrContainer) {
        const atrChart = lc.createChart(atrContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        atrChartRef.current = atrChart
        const atrSeries = atrChart.addSeries(lc.LineSeries, { color: T.cyan, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } })
        atrSeriesRef.current = atrSeries
      }

      // VWAP line on main chart
      const vwap = chart.addSeries(lc.LineSeries, {
        color: '#FF6B9D', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: 0,
      })
      vwapRef.current = vwap

      // SAR dots on main chart
      const sar = chart.addSeries(lc.LineSeries, {
        color: '#FF9CF5', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        lineStyle: 2,
      })
      sarRef.current = sar

      // Ichimoku lines on main chart
      const ichimokuTenkan = chart.addSeries(lc.LineSeries, {
        color: '#2196F3', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      ichimokuTenkanRef.current = ichimokuTenkan
      const ichimokuKijun = chart.addSeries(lc.LineSeries, {
        color: '#F44336', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      ichimokuKijunRef.current = ichimokuKijun
      const ichimokuSenkouA = chart.addSeries(lc.LineSeries, {
        color: 'rgba(76,175,80,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: 2,
      })
      ichimokuSenkouARef.current = ichimokuSenkouA
      const ichimokuSenkouB = chart.addSeries(lc.LineSeries, {
        color: 'rgba(244,67,54,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: 2,
      })
      ichimokuSenkouBRef.current = ichimokuSenkouB
      const ichimokuChikou = chart.addSeries(lc.LineSeries, {
        color: 'rgba(156,39,176,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      ichimokuChikouRef.current = ichimokuChikou

      // ADX pane
      const adxContainer = wrapperRef.current?.querySelector('#adx-pane') as HTMLElement
      if (adxContainer) {
        const adxChart = lc.createChart(adxContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        adxChartRef.current = adxChart
        const adxLine = adxChart.addSeries(lc.LineSeries, { color: '#F59E0B', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } })
        adxLineRef.current = adxLine
        const adxPlusDI = adxChart.addSeries(lc.LineSeries, { color: T.green, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        adxPlusDIRef.current = adxPlusDI
        const adxMinusDI = adxChart.addSeries(lc.LineSeries, { color: T.red, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        adxMinusDIRef.current = adxMinusDI
      }

      // CCI pane
      const cciContainer = wrapperRef.current?.querySelector('#cci-pane') as HTMLElement
      if (cciContainer) {
        const cciChart = lc.createChart(cciContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        cciChartRef.current = cciChart
        const cciSeries = cciChart.addSeries(lc.LineSeries, { color: '#14B8A6', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } })
        cciSeriesRef.current = cciSeries
      }

      // Williams %R pane
      const williamsContainer = wrapperRef.current?.querySelector('#williams-pane') as HTMLElement
      if (williamsContainer) {
        const williamsChart = lc.createChart(williamsContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        williamsChartRef.current = williamsChart
        const williamsSeries = williamsChart.addSeries(lc.LineSeries, { color: '#E879F9', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } })
        williamsSeriesRef.current = williamsSeries
      }

      // MFI pane
      const mfiContainer = wrapperRef.current?.querySelector('#mfi-pane') as HTMLElement
      if (mfiContainer) {
        const mfiChart = lc.createChart(mfiContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        mfiChartRef.current = mfiChart
        const mfiSeries = mfiChart.addSeries(lc.LineSeries, { color: '#34D399', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } })
        mfiSeriesRef.current = mfiSeries
      }

      // OBV pane
      const obvContainer = wrapperRef.current?.querySelector('#obv-pane') as HTMLElement
      if (obvContainer) {
        const obvChart = lc.createChart(obvContainer, {
          layout: { background: { color: T.bg }, textColor: T.textMuted, fontFamily: "'SF Mono', monospace", fontSize: 10 },
          grid: { vertLines: { color: 'rgba(30,58,138,0.06)' }, horzLines: { color: 'rgba(30,58,138,0.06)' } },
          rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { visible: false },
          crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { color: 'rgba(60,130,255,0.25)', labelBackgroundColor: T.accent } },
          handleScroll: false, handleScale: false,
        })
        obvChartRef.current = obvChart
        const obvSeries = obvChart.addSeries(lc.LineSeries, { color: '#60A5FA', lineWidth: 1, priceLineVisible: false, lastValueVisible: true })
        obvSeriesRef.current = obvSeries
      }

      // Store lightweight-charts module reference for drawing line rendering
      lcRef.current = lc

      // Drawing: canvas overlay will handle drawing via mouse events (see below)
      // No longer using chart.subscribeClick for drawing

      setChartReady(true)
    }
    initChart()
    return () => {
      mounted = false
      ;[chartRef, rsiChartRef, macdChartRef, stochChartRef, atrChartRef, adxChartRef, cciChartRef, williamsChartRef, mfiChartRef, obvChartRef].forEach(ref => {
        if (ref.current) { try { ref.current.remove() } catch {} ref.current = null }
      })
    }
  }, [])

  // Signal lines for positions - Enhanced with P&L visualization
  useEffect(() => {
    if (!chartReady || !chartRef.current) return
    const updateSignalLines = async () => {
      const lc = await import('lightweight-charts')
      if (!chartRef.current) return
      signalLinesRef.current.forEach(line => { try { chartRef.current?.removeSeries(line) } catch {} })
      signalLinesRef.current = []
      const pairPositions = (openPositions || []).filter(pos => {
        const posSymbol = pos.symbol || pos.sessionSymbol || ''
        return posSymbol === selectedPair.label || posSymbol === selectedPair.symbol
      })
      if (pairPositions.length === 0) return
      const times = chartData.candleData.map(d => d.time)
      if (times.length === 0) return

      pairPositions.forEach(pos => {
        const isBuy = pos.type === 'BUY'
        const pnlPercent = pos.entryPrice ? ((currentPriceProp || 0) - pos.entryPrice) / pos.entryPrice * 100 * (isBuy ? 1 : -1) : 0
        const isProfitable = pnlPercent >= 0
        const pnlColor = isBuy ? (isProfitable ? '#00E676' : '#FF5252') : (isProfitable ? '#00E676' : '#FF5252')
        
        if (pos.entryPrice) {
          try {
            // Entry price line with enhanced title showing direction, P&L, and amount
            const entryLine = chartRef.current.addSeries(lc.LineSeries, {
              color: isBuy ? '#00E676' : '#FF5252', lineWidth: 2, lineStyle: 0,
              priceLineVisible: true, lastValueVisible: true,
              priceFormat: { type: 'price', precision: selectedPair.decimals, minMove: 1 / Math.pow(10, selectedPair.decimals) },
              title: `${isBuy ? '▲ شراء' : '▼ بيع'} ${fmtPrice(pos.entryPrice)} | ${isProfitable ? '+' : ''}${pnlPercent.toFixed(2)}% | $${pos.amount?.toFixed(0)}`,
            })
            entryLine.setData(times.map(t => ({ time: t, value: pos.entryPrice! })))
            signalLinesRef.current.push(entryLine)
          } catch {}

          // P&L zone: Area fill between entry and current price showing profit/loss zone
          // Green area above entry for BUY profit, red area below entry for BUY loss (and vice versa for SELL)
          try {
            const currentP = currentPriceProp || pos.entryPrice
            const upperPrice = isBuy ? Math.max(pos.entryPrice, currentP) : Math.max(pos.entryPrice, currentP)
            const lowerPrice = isBuy ? Math.min(pos.entryPrice, currentP) : Math.min(pos.entryPrice, currentP)
            const areaData = times.map(t => ({ time: t, value: upperPrice }))
            
            const pnlArea = chartRef.current.addSeries(lc.LineSeries, {
              color: isProfitable ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)',
              lineWidth: 0,
              priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
              fill: true,
            })
            pnlArea.setData(areaData)
            signalLinesRef.current.push(pnlArea)
          } catch {}
        }
        if (pos.stopLoss) {
          try {
            const slLine = chartRef.current.addSeries(lc.LineSeries, {
              color: '#FF5252', lineWidth: 1, lineStyle: 2,
              priceLineVisible: true, lastValueVisible: true,
              priceFormat: { type: 'price', precision: selectedPair.decimals, minMove: 1 / Math.pow(10, selectedPair.decimals) },
              title: `⛔ SL: ${fmtPrice(pos.stopLoss)}`,
            })
            slLine.setData(times.map(t => ({ time: t, value: pos.stopLoss! })))
            signalLinesRef.current.push(slLine)
          } catch {}
        }
        if (pos.takeProfit) {
          try {
            const tpLine = chartRef.current.addSeries(lc.LineSeries, {
              color: '#00E676', lineWidth: 1, lineStyle: 2,
              priceLineVisible: true, lastValueVisible: true,
              priceFormat: { type: 'price', precision: selectedPair.decimals, minMove: 1 / Math.pow(10, selectedPair.decimals) },
              title: `🎯 TP: ${fmtPrice(pos.takeProfit)}`,
            })
            tpLine.setData(times.map(t => ({ time: t, value: pos.takeProfit! })))
            signalLinesRef.current.push(tpLine)
          } catch {}
        }
      })
    }
    updateSignalLines()
  }, [chartReady, openPositions, chartData.candleData, selectedPair, showSignalLines, currentPriceProp])

  // Strategy signal lines
  useEffect(() => {
    if (!chartReady || !chartRef.current) return
    const updateStrategyLines = async () => {
      const lc = await import('lightweight-charts')
      if (!chartRef.current) return
      strategyLinesRef.current.forEach(line => { try { chartRef.current?.removeSeries(line) } catch {} })
      strategyLinesRef.current = []
      if (!activeStrategy || !strategyResult || strategyResult.type === 'NEUTRAL') return
      const times = chartData.candleData.map(d => d.time)
      if (times.length === 0) return
      const isBuy = strategyResult.type === 'BUY'
      const strategyLabel = activeStrategy === 'quantum' ? 'QMM' : 'SLH'

      // Entry line
      try {
        const entryLine = chartRef.current.addSeries(lc.LineSeries, {
          color: isBuy ? '#00E676' : '#FF5252', lineWidth: 2, lineStyle: 0,
          priceLineVisible: true, lastValueVisible: true,
          priceFormat: { type: 'price', precision: selectedPair.decimals, minMove: 1 / Math.pow(10, selectedPair.decimals) },
          title: `${isBuy ? '🟢 BUY' : '🔴 SELL'} ${strategyLabel}: ${fmtPrice(strategyResult.entry)} | Conf: ${strategyResult.confidence}%`,
        })
        entryLine.setData(times.map(t => ({ time: t, value: strategyResult.entry })))
        strategyLinesRef.current.push(entryLine)
      } catch {}

      // Stop Loss line
      try {
        const slLine = chartRef.current.addSeries(lc.LineSeries, {
          color: '#FF5252', lineWidth: 2, lineStyle: 2,
          priceLineVisible: true, lastValueVisible: true,
          priceFormat: { type: 'price', precision: selectedPair.decimals, minMove: 1 / Math.pow(10, selectedPair.decimals) },
          title: `⛔ SL ${strategyLabel}: ${fmtPrice(strategyResult.stopLoss)}`,
        })
        slLine.setData(times.map(t => ({ time: t, value: strategyResult.stopLoss })))
        strategyLinesRef.current.push(slLine)
      } catch {}

      // Target lines
      const targetColors = ['rgba(0,230,118,0.6)', '#00E676', '#69F0AE']
      const targetStyles: (0 | 2)[] = [2, 2, 2]
      strategyResult.targets.forEach((target, idx) => {
        if (!target) return
        try {
          const tLine = chartRef.current.addSeries(lc.LineSeries, {
            color: targetColors[idx], lineWidth: 1, lineStyle: targetStyles[idx],
            priceLineVisible: true, lastValueVisible: true,
            priceFormat: { type: 'price', precision: selectedPair.decimals, minMove: 1 / Math.pow(10, selectedPair.decimals) },
            title: `🎯 T${idx + 1} ${strategyLabel}: ${fmtPrice(target)}`,
          })
          tLine.setData(times.map(t => ({ time: t, value: target })))
          strategyLinesRef.current.push(tLine)
        } catch {}
      })

      // Zone highlight (order block / FVG zone) - render as two boundary lines
      if (strategyResult.zoneHigh !== undefined && strategyResult.zoneLow !== undefined) {
        try {
          const zoneTopLine = chartRef.current.addSeries(lc.LineSeries, {
            color: isBuy ? 'rgba(0,230,118,0.25)' : 'rgba(255,82,82,0.25)', lineWidth: 1, lineStyle: 1,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          })
          zoneTopLine.setData(times.map(t => ({ time: t, value: strategyResult.zoneHigh! })))
          strategyLinesRef.current.push(zoneTopLine)

          const zoneBotLine = chartRef.current.addSeries(lc.LineSeries, {
            color: isBuy ? 'rgba(0,230,118,0.25)' : 'rgba(255,82,82,0.25)', lineWidth: 1, lineStyle: 1,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          })
          zoneBotLine.setData(times.map(t => ({ time: t, value: strategyResult.zoneLow! })))
          strategyLinesRef.current.push(zoneBotLine)
        } catch {}
      }
    }
    updateStrategyLines()
  }, [chartReady, activeStrategy, strategyResult, chartData.candleData, selectedPair])

  // Drawing lines — render saved drawings as line series on the chart
  useEffect(() => {
    if (!chartReady || !chartRef.current || !lcRef.current) return

    // Remove old drawing line series
    drawingLinesRef.current.forEach(series => {
      try { chartRef.current?.removeSeries(series) } catch {}
    })
    drawingLinesRef.current = []

    if (!drawings || drawings.length === 0) return

    const lc = lcRef.current
    drawings.forEach(d => {
      if (!chartRef.current) return

      if (d.type === 'horizontal') {
        try {
          const hLine = chartRef.current.addSeries(lc.LineSeries, {
            color: '#60A5FA', lineWidth: 2, lineStyle: 2,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          })
          hLine.setData([
            { time: d.startX as unknown as string, value: d.startY },
            { time: d.endX as unknown as string, value: d.startY },
          ])
          drawingLinesRef.current.push(hLine)
        } catch {}
      } else if (d.type === 'trend') {
        try {
          const tLine = chartRef.current.addSeries(lc.LineSeries, {
            color: '#FB923C', lineWidth: 2, lineStyle: 0,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          })
          tLine.setData([
            { time: d.startX as unknown as string, value: d.startY },
            { time: d.endX as unknown as string, value: d.endY },
          ])
          drawingLinesRef.current.push(tLine)
        } catch {}
      } else if (d.type === 'rectangle') {
        try {
          const maxPrice = Math.max(d.startY, d.endY)
          const minPrice = Math.min(d.startY, d.endY)
          const minTime = Math.min(d.startX, d.endX)
          const maxTime = Math.max(d.startX, d.endX)
          // Offset time by 1 second for vertical lines to avoid same-time data points
          const minTimeAdj = minTime
          const maxTimeAdj = maxTime
          const timeEpsilon = 1 // 1 second offset for vertical lines
          const opts = { color: '#A78BFA', lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }

          // Top horizontal line
          const topLine = chartRef.current.addSeries(lc.LineSeries, opts)
          topLine.setData([{ time: minTimeAdj as unknown as string, value: maxPrice }, { time: maxTimeAdj as unknown as string, value: maxPrice }])
          drawingLinesRef.current.push(topLine)

          // Bottom horizontal line
          const bottomLine = chartRef.current.addSeries(lc.LineSeries, opts)
          bottomLine.setData([{ time: minTimeAdj as unknown as string, value: minPrice }, { time: maxTimeAdj as unknown as string, value: minPrice }])
          drawingLinesRef.current.push(bottomLine)

          // Left vertical line (offset times slightly so both points aren't at the same time)
          const leftLine = chartRef.current.addSeries(lc.LineSeries, { ...opts, lineStyle: 2 })
          leftLine.setData([
            { time: (minTimeAdj - timeEpsilon) as unknown as string, value: minPrice },
            { time: (minTimeAdj + timeEpsilon) as unknown as string, value: maxPrice },
          ])
          drawingLinesRef.current.push(leftLine)

          // Right vertical line
          const rightLine = chartRef.current.addSeries(lc.LineSeries, { ...opts, lineStyle: 2 })
          rightLine.setData([
            { time: (maxTimeAdj - timeEpsilon) as unknown as string, value: minPrice },
            { time: (maxTimeAdj + timeEpsilon) as unknown as string, value: maxPrice },
          ])
          drawingLinesRef.current.push(rightLine)
        } catch {}
      }
    })

    return () => {
      // Cleanup on unmount or before next effect run
      drawingLinesRef.current.forEach(series => {
        try { chartRef.current?.removeSeries(series) } catch {}
      })
      drawingLinesRef.current = []
    }
  }, [chartReady, drawings])

  // Update chart data
  useEffect(() => {
    if (!chartReady || chartData.candleData.length === 0) return
    try {
      candleSeriesRef.current?.setData(chartData.candleData)
      volumeSeriesRef.current?.setData(chartData.volumeData)
      const closes = chartData.closes
      const times = chartData.candleData.map(d => d.time)
      const volumes = candles.map(c => c.volume)
      const volMaData = calcSMA(volumes, 20)
      volMaRef.current?.setData(volMaData.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      if (showEMA) {
        ema7Ref.current?.setData(calcEMA(closes, 7).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        ema25Ref.current?.setData(calcEMA(closes, 25).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        sma50Ref.current?.setData(calcSMA(closes, 50).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      } else { ema7Ref.current?.setData([]); ema25Ref.current?.setData([]); sma50Ref.current?.setData([]) }
      if (showBB) {
        const bb = calcBollingerBands(closes, 20, 2)
        bbUpperRef.current?.setData(bb.upper.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        bbMiddleRef.current?.setData(bb.middle.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        bbLowerRef.current?.setData(bb.lower.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      } else { bbUpperRef.current?.setData([]); bbMiddleRef.current?.setData([]); bbLowerRef.current?.setData([]) }
      if (showRSI && rsiSeriesRef.current) {
        rsiSeriesRef.current?.setData(calcRSI(closes, 14).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        rsiObRef.current?.setData(times.map(t => ({ time: t, value: 70 })))
        rsiOsRef.current?.setData(times.map(t => ({ time: t, value: 30 })))
      }
      if (showMACD && macdLineRef.current) {
        const macd = calcMACD(closes, 12, 26, 9)
        macdLineRef.current?.setData(macd.macdLine.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        macdSignalRef.current?.setData(macd.signalLine.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        macdHistRef.current?.setData(macd.histogram.map((v, i) => {
          if (v === null) return null
          return { time: times[i], value: v, color: v >= 0 ? 'rgba(0,230,118,0.5)' : 'rgba(255,82,82,0.5)' }
        }).filter(Boolean))
      }
      if (showStoch && stochKRef.current) {
        const stoch = calcStochastic(candles, 14, 3, 3)
        stochKRef.current?.setData(stoch.kLine.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        stochDRef.current?.setData(stoch.dLine.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        stochObRef.current?.setData(times.map(t => ({ time: t, value: 80 })))
        stochOsRef.current?.setData(times.map(t => ({ time: t, value: 20 })))
      }
      if (showATR && atrSeriesRef.current) {
        atrSeriesRef.current?.setData(calcATR(candles, 14).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      }
      // VWAP
      if (showVWAP) {
        vwapRef.current?.setData(calcVWAP(candles).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      } else { vwapRef.current?.setData([]) }
      // Parabolic SAR
      if (showSAR) {
        sarRef.current?.setData(calcParabolicSAR(candles).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      } else { sarRef.current?.setData([]) }
      // Ichimoku
      if (showIchimoku) {
        const ich = calcIchimoku(candles)
        ichimokuTenkanRef.current?.setData(ich.tenkanSen.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        ichimokuKijunRef.current?.setData(ich.kijunSen.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        ichimokuSenkouARef.current?.setData(ich.senkouA.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        ichimokuSenkouBRef.current?.setData(ich.senkouB.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        ichimokuChikouRef.current?.setData(ich.chikou.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      } else {
        ichimokuTenkanRef.current?.setData([]); ichimokuKijunRef.current?.setData([])
        ichimokuSenkouARef.current?.setData([]); ichimokuSenkouBRef.current?.setData([])
        ichimokuChikouRef.current?.setData([])
      }
      // ADX
      if (showADX && adxLineRef.current) {
        const adxData = calcADX(candles, 14)
        adxLineRef.current?.setData(adxData.adx.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        adxPlusDIRef.current?.setData(adxData.plusDI.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
        adxMinusDIRef.current?.setData(adxData.minusDI.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      }
      // CCI
      if (showCCI && cciSeriesRef.current) {
        cciSeriesRef.current?.setData(calcCCI(candles, 20).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      }
      // Williams %R
      if (showWilliams && williamsSeriesRef.current) {
        williamsSeriesRef.current?.setData(calcWilliams(candles, 14).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      }
      // MFI
      if (showMFI && mfiSeriesRef.current) {
        mfiSeriesRef.current?.setData(calcMFI(candles, 14).map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean))
      }
      // OBV
      if (showOBV && obvSeriesRef.current) {
        obvSeriesRef.current?.setData(calcOBV(candles).map((v, i) => ({ time: times[i], value: v })))
      }
      // Zoom in on recent candles — show ~80 candles large & close like TradingView default
      const ts = chartRef.current?.timeScale()
      const cd = chartData.candleData
      if (ts && cd.length > 0) {
        const visibleCount = 80
        const fromIdx = Math.max(0, cd.length - visibleCount)
        ts.setVisibleRange({ from: cd[fromIdx].time as unknown as number, to: cd[cd.length - 1].time as unknown as number })
      }
    } catch {}
  }, [chartData, chartReady, showEMA, showBB, showRSI, showMACD, showStoch, showATR, showVWAP, showSAR, showADX, showCCI, showWilliams, showMFI, showOBV, showIchimoku, candles])

  // Resize
  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver(() => {
      const w = wrapperRef.current?.clientWidth
      if (w) { [chartRef, rsiChartRef, macdChartRef, stochChartRef, atrChartRef, adxChartRef, cciChartRef, williamsChartRef, mfiChartRef, obvChartRef].forEach(ref => ref.current?.applyOptions({ width: w })) }
      // Resize drawing canvas too (only main chart area height)
      const canvas = drawCanvasRef.current
      if (canvas && wrapperRef.current) {
        canvas.width = wrapperRef.current.clientWidth
        canvas.height = mainChartHeight
      }
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  // Canvas overlay for drag-based drawing
  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas || !chartRef.current) return
    const container = wrapperRef.current
    if (!container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to main chart area only
    canvas.width = container.clientWidth
    canvas.height = mainChartHeight

    const clearCanvas = () => {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const drawPreview = (startX: number, startY: number, endX: number, endY: number, tool: string) => {
      if (!ctx) return
      clearCanvas()
      ctx.strokeStyle = tool === 'horizontal' ? '#60A5FA' : tool === 'trend' ? '#FB923C' : '#A78BFA'
      ctx.lineWidth = 2
      ctx.setLineDash(tool === 'horizontal' ? [8, 4] : [])

      if (tool === 'horizontal') {
        ctx.beginPath()
        ctx.moveTo(0, startY)
        ctx.lineTo(canvas.width, startY)
        ctx.stroke()
      } else if (tool === 'trend') {
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      } else if (tool === 'rectangle') {
        ctx.beginPath()
        ctx.rect(Math.min(startX, endX), Math.min(startY, endY), Math.abs(endX - startX), Math.abs(endY - startY))
        ctx.stroke()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (!activeDrawToolRef.current || !chartRef.current || !candleSeriesRef.current) return
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Convert pixel to chart coordinates
      const timeScale = chartRef.current!.timeScale()
      const time = timeScale.coordinateToTime(x)
      const price = candleSeriesRef.current!.coordinateToPrice(y)
      if (time === null || price === null) return

      isDraggingRef.current = true
      dragStartRef.current = { x, y, time: time as number, price: price as number }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      drawPreview(dragStartRef.current.x, dragStartRef.current.y, x, y, activeDrawToolRef.current || 'trend')
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Convert pixel to chart coordinates
      const timeScale = chartRef.current!.timeScale()
      const endTime = timeScale.coordinateToTime(x)
      const endPrice = candleSeriesRef.current!.coordinateToPrice(y)
      if (endTime !== null && endPrice !== null) {
        const start = dragStartRef.current
        // Only add if start and end are meaningfully different
        if (start.time !== endTime || start.price !== endPrice) {
          if (onDrawingsChange) {
            onDrawingsChange([...(drawingsRef.current || []), {
              id: Date.now().toString(),
              type: activeDrawToolRef.current as any,
              startX: start.time, startY: start.price,
              endX: endTime as number, endY: endPrice as number,
            }])
          }
        }
      }

      isDraggingRef.current = false
      dragStartRef.current = null
      clearCanvas()
    }

    const handleMouseLeave = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        dragStartRef.current = null
        clearCanvas()
      }
    }

    // Touch event handlers for mobile support
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
    }
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
    }
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.changedTouches[0]
      handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [chartReady, activeDrawTool, onDrawingsChange])

  const pairPositions = (openPositions || []).filter(pos => {
    const posSymbol = pos.symbol || pos.sessionSymbol || ''
    return posSymbol === selectedPair.label || posSymbol === selectedPair.symbol
  })

  return (
    <div ref={wrapperRef} style={{ direction: 'ltr', position: 'relative' }}>
      {/* SONA Logo Watermark */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src="/sona-logo.png" alt="SONA" style={{
          maxWidth: '40%', maxHeight: '50%', objectFit: 'contain', opacity: 0.04,
          filter: 'brightness(2) contrast(0.8)',
        }} />
      </div>
      {/* Drawing Canvas Overlay */}
      <canvas ref={drawCanvasRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: mainChartHeight, zIndex: activeDrawTool ? 15 : -1,
        pointerEvents: activeDrawTool ? 'auto' : 'none', cursor: activeDrawTool ? 'crosshair' : 'default',
      }} />
      {activeDrawTool && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.15))`, border: `1px solid ${T.accentBorder}`,
          borderRadius: 8, padding: '4px 14px', fontSize: 10, color: T.accent,
          fontWeight: 700, fontFamily: "'Cairo', sans-serif", zIndex: 10, pointerEvents: 'none',
        }}>
          {isAr ? 'اضغط واسحب للرسم' : 'Click & drag to draw'}
        </div>
      )}

      {pairPositions.length > 0 && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 200, pointerEvents: 'none' }}>
          {pairPositions.map((pos, i) => {
            const isBuy = pos.type === 'BUY'
            const lev = (pos as any).leverage || 1
            const cp = currentPriceProp || 0
            const qty = pos.quantity || (pos.entryPrice > 0 ? pos.amount / pos.entryPrice : 0)
            const pnl = cp > 0 && pos.entryPrice > 0 ? (isBuy ? (cp - pos.entryPrice) * qty : (pos.entryPrice - cp) * qty) : 0
            return (
              <div key={pos.id || i} style={{ padding: '6px 10px', fontSize: 9, borderRadius: 8, background: T.glass, border: `1px solid ${isBuy ? T.greenBorder : T.redBorder}`, backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: isBuy ? T.green : T.red, boxShadow: `0 0 8px ${isBuy ? T.green : T.red}`, display: 'inline-block' }} />
                  <span style={{ color: isBuy ? T.green : T.red, fontWeight: 900, fontSize: 10, background: isBuy ? T.greenBg : T.redBg, padding: '0 5px', borderRadius: 4 }}>
                    {isBuy ? 'LONG' : 'SHORT'}
                  </span>
                  <span style={{ color: T.textPrimary, fontWeight: 700, fontSize: 10, fontFamily: 'monospace' }}>${pos.amount.toFixed(0)}</span>
                  {lev > 1 && <span style={{ color: T.gold, fontWeight: 900, fontSize: 9, fontFamily: 'monospace', background: T.goldBg, padding: '0 4px', borderRadius: 3, border: `1px solid ${T.goldBorder}` }}>{lev}x</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 8, fontFamily: 'monospace' }}>
                  <span style={{ color: isBuy ? T.green : T.red }}>Entry: {fmtPrice(pos.entryPrice)}</span>
                  {pos.stopLoss && <span style={{ color: T.red }}>SL: {fmtPrice(pos.stopLoss)}</span>}
                  {pos.takeProfit && <span style={{ color: T.green }}>TP: {fmtPrice(pos.takeProfit)}</span>}
                  {cp > 0 && <span style={{ color: pnl >= 0 ? T.green : T.red }}>
                    PnL: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                  </span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div ref={chartContainerRef} id="main-chart" style={{ width: '100%', height: mainChartHeight, minHeight: 200 }} />
      {showRSI && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.purple, padding: '2px 8px', fontWeight: 700 }}>RSI (14)</div>
          <div id="rsi-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showMACD && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.blue4, padding: '2px 8px', fontWeight: 700 }}>MACD (12,26,9)</div>
          <div id="macd-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showStoch && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.blue4, padding: '2px 8px', fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>Stoch (14,3,3)</span>
            <span style={{ color: T.blue4 }}>● %K</span>
            <span style={{ color: T.orange }}>● %D</span>
          </div>
          <div id="stoch-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showATR && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.cyan, padding: '2px 8px', fontWeight: 700 }}>ATR (14)</div>
          <div id="atr-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showADX && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: '#F59E0B', padding: '2px 8px', fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>ADX (14)</span>
            <span style={{ color: '#F59E0B' }}>● ADX</span>
            <span style={{ color: T.green }}>● +DI</span>
            <span style={{ color: T.red }}>● -DI</span>
          </div>
          <div id="adx-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showCCI && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: '#14B8A6', padding: '2px 8px', fontWeight: 700 }}>CCI (20)</div>
          <div id="cci-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showWilliams && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: '#E879F9', padding: '2px 8px', fontWeight: 700 }}>Williams %R (14)</div>
          <div id="williams-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showMFI && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: '#34D399', padding: '2px 8px', fontWeight: 700 }}>MFI (14)</div>
          <div id="mfi-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      {showOBV && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: '#60A5FA', padding: '2px 8px', fontWeight: 700 }}>OBV</div>
          <div id="obv-pane" style={{ width: '100%', height: 80 }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, padding: '4px 8px', fontSize: 9, fontFamily: 'monospace', flexWrap: 'wrap' }}>
        {showEMA && <><span style={{ color: T.blue4 }}>● EMA7</span><span style={{ color: T.purple }}>● EMA25</span><span style={{ color: T.cyan }}>● SMA50</span></>}
        {showBB && <span style={{ color: T.green }}>● BB(20,2)</span>}
        {showVWAP && <span style={{ color: '#FF6B9D' }}>● VWAP</span>}
        {showSAR && <span style={{ color: '#FF9CF5' }}>● SAR</span>}
        {showIchimoku && <><span style={{ color: '#2196F3' }}>● Tenkan</span><span style={{ color: '#F44336' }}>● Kijun</span><span style={{ color: 'rgba(76,175,80,0.7)' }}>● SenkouA</span><span style={{ color: 'rgba(244,67,54,0.7)' }}>● SenkouB</span></>}
        <span style={{ color: 'rgba(60,130,255,0.4)' }}>● VolMA(20)</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ORDER SUCCESS OVERLAY
// ═══════════════════════════════════════════════════════════════
const OrderSuccessOverlay = ({ success, isAr }: { success: { side: string; amount: number; price: number }; isAr: boolean }) => (
  <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
    className="fixed inset-0 flex items-center justify-center z-[1000]" style={{ background: 'rgba(6,10,20,0.88)', backdropFilter: 'blur(20px)' }}>
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.3 }}
      className="relative rounded-2xl p-8 text-center max-w-[360px] w-[90%] overflow-hidden"
      style={{ background: `linear-gradient(145deg, ${T.card}, ${T.bg2})`, border: `1px solid ${success.side === 'BUY' ? T.greenBorder : T.redBorder}`, boxShadow: `0 32px 80px ${success.side === 'BUY' ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)'}` }}>
      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${success.side === 'BUY' ? T.green : T.red}, transparent 70%)` }} />
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: success.side === 'BUY' ? T.greenBg : T.redBg, border: `2px solid ${success.side === 'BUY' ? T.green : T.red}` }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={success.side === 'BUY' ? T.green : T.red} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </motion.div>
      <div className="text-lg font-black mb-2" style={{ color: success.side === 'BUY' ? T.green : T.red, fontFamily: "'Cairo', sans-serif" }}>
        {success.side === 'BUY' ? (isAr ? 'تم الشراء بنجاح!' : 'Buy Order Executed!') : (isAr ? 'تم البيع بنجاح!' : 'Sell Order Executed!')}
      </div>
      <div className="text-3xl font-black mb-1" style={{ color: T.textPrimary, fontFamily: 'monospace' }}>${success.amount.toFixed(2)}</div>
      <div className="text-xs" style={{ color: T.textMuted, fontFamily: 'monospace' }}>@ {fmtPrice(success.price)}</div>
    </motion.div>
  </motion.div>
)

// ═══════════════════════════════════════════════════════════════
// FULL-SCREEN PANEL WRAPPER (for Indicators / Draw tools)
// ═══════════════════════════════════════════════════════════════
const FullPanel = ({ isOpen, onClose, title, children, isAr }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; isAr: boolean
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, x: isAr ? -300 : 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: isAr ? -300 : 300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="absolute inset-0 z-50"
        style={{ background: `linear-gradient(180deg, ${T.panelHeader}, ${T.panelBg})`, display: 'flex', flexDirection: 'column' }}
      >
        {/* Panel Header with Back Button */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: `linear-gradient(135deg, ${T.card}, ${T.bg3})`,
          borderBottom: `1px solid ${T.borderLight}`,
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.accentBorder}`,
            background: `linear-gradient(135deg, ${T.accentBg}, transparent)`,
            color: T.accent, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, fontFamily: "'Cairo', sans-serif" }}>{title}</span>
        </div>
        {/* Panel Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }} className="scrollbar-none">
          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
)

// ═══════════════════════════════════════════════════════════════
// INDICATOR ITEM (inside panel)
// ═══════════════════════════════════════════════════════════════
const IndicatorItem = ({ label, description, active, color, onToggle, isAr }: {
  label: string; description: string; active: boolean; color: string; onToggle: () => void; isAr: boolean
}) => (
  <button onClick={onToggle} style={{
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
    borderRadius: 14, marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s',
    background: active ? `linear-gradient(135deg, ${color}10, ${color}05)` : T.card,
    border: `1px solid ${active ? `${color}30` : T.border}`,
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? `${color}18` : T.bg2, border: `1px solid ${active ? `${color}25` : T.border}`,
      transition: 'all 0.2s',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? color : T.textMuted} strokeWidth="2">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    </div>
    <div style={{ flex: 1, textAlign: isAr ? 'right' : 'left' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: active ? color : T.textPrimary, fontFamily: "'Cairo', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{description}</div>
    </div>
    {/* Toggle Switch */}
    <div style={{
      width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'all 0.3s',
      background: active ? `${color}30` : T.bg2, border: `1px solid ${active ? `${color}40` : T.border}`,
    }}>
      <motion.div animate={{ x: active ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 18, height: 18, borderRadius: 9, position: 'absolute', top: 2,
          background: active ? color : T.textMuted, boxShadow: active ? `0 0 10px ${color}40` : 'none',
          transition: 'all 0.2s',
        }}
      />
    </div>
  </button>
)

// ═══════════════════════════════════════════════════════════════
// DRAW TOOL ITEM (inside panel)
// ═══════════════════════════════════════════════════════════════
const DrawToolItem = ({ label, symbol, color, active, onToggle, isAr }: {
  label: string; symbol: string; color: string; active: boolean; onToggle: () => void; isAr: boolean
}) => (
  <button onClick={onToggle} style={{
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
    borderRadius: 14, marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s',
    background: active ? `${color}10` : T.card, border: `1px solid ${active ? `${color}30` : T.border}`,
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? `${color}15` : T.bg2, border: `1px solid ${active ? `${color}25` : T.border}`,
      fontSize: 20, fontWeight: 900, color: active ? color : T.textMuted,
    }}>
      {symbol}
    </div>
    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: active ? color : T.textPrimary, fontFamily: "'Cairo', sans-serif", textAlign: isAr ? 'right' : 'left' }}>{label}</span>
    {active && (
      <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${color}15`, color, border: `1px solid ${color}25` }}>
        {isAr ? 'نشط' : 'Active'}
      </span>
    )}
  </button>
)

// ═══════════════════════════════════════════════════════════════
// MAIN TRADING PAGE — SONA ULTRA (DEEP BLUE REDESIGN)
// ═══════════════════════════════════════════════════════════════
const TradingPage = ({ user, lang, onNavigate }: { user: any; lang: string; onNavigate?: (page: string) => void }) => {
  const { t } = useI18n()
  const isAr = lang === 'ar'
  const { setDashboardPage } = useAppStore()

  // ── Core state ──
  const [chartData, setChartData] = useState<CandleData[]>([])
  const [binanceTicker, setBinanceTicker] = useState<BinanceTicker | null>(null)
  const [selectedPair, setSelectedPair] = useState(PAIRS[0])
  const [timeframe, setTimeframe] = useState('1m')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'info' } | null>(null)
  const [loadingChart, setLoadingChart] = useState(true)
  const [pairDropdownOpen, setPairDropdownOpen] = useState(false) // kept for ref compatibility
  const [showMarketPanel, setShowMarketPanel] = useState(false)

  // ── Order form ──
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY')
  const [orderAmount, setOrderAmount] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit1, setTakeProfit1] = useState('')
  const [takeProfit2, setTakeProfit2] = useState('')
  const [takeProfit3, setTakeProfit3] = useState('')
  const [orderPercent, setOrderPercent] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<{ side: string; amount: number; price: number } | null>(null)

  // ── Positions ──
  const [openPositions, setOpenPositions] = useState<PositionData[]>([])
  const [closedPositions, setClosedPositions] = useState<PositionData[]>([])
  const [positionTab, setPositionTab] = useState<'open' | 'closed' | 'package'>('open')
  const [closingId, setClosingId] = useState<string | null>(null)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})

  // ── Order book ──
  const [orderBook, setOrderBook] = useState<{ asks: OrderBookEntry[]; bids: OrderBookEntry[] }>({ asks: [], bids: [] })

  // ── Mobile ──
  const [mobileTab, setMobileTab] = useState<'chart' | 'trade' | 'positions'>('chart')

  // ── Trade controls ──
  const [leverage, setLeverage] = useState(1)
  const [marginType, setMarginType] = useState<'cross' | 'isolated'>('cross')
  const [showMobilePositions, setShowMobilePositions] = useState(false)
  const [leverageFlash, setLeverageFlash] = useState(false)

  // ── Investment ──
  const [hasActivePackage, setHasActivePackage] = useState(false)
  const [packageTrades, setPackageTrades] = useState<any[]>([])
  const [packageInvestments, setPackageInvestments] = useState<any[]>([])

  // ── Chart tools ──
  const [drawings, setDrawings] = useState<DrawingLine[]>([])
  const [activeDrawTool, setActiveDrawTool] = useState<string | null>(null)
  // ── Indicator states (persisted in localStorage) ──
  const getStoredIndicators = (): Record<string, boolean> => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem('sona-indicators')
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  }
  const [indicatorOverrides] = useState(getStoredIndicators)

  const [showRSI, setShowRSI] = useState(indicatorOverrides.RSI ?? false)
  const [showMACD, setShowMACD] = useState(indicatorOverrides.MACD ?? false)
  const [showBB, setShowBB] = useState(indicatorOverrides.BB ?? false)
  const [showEMA, setShowEMA] = useState(indicatorOverrides.EMA ?? false)
  const [showStoch, setShowStoch] = useState(indicatorOverrides.Stoch ?? false)
  const [showATR, setShowATR] = useState(indicatorOverrides.ATR ?? false)
  const [showVWAP, setShowVWAP] = useState(indicatorOverrides.VWAP ?? false)
  const [showSAR, setShowSAR] = useState(indicatorOverrides.SAR ?? false)
  const [showADX, setShowADX] = useState(indicatorOverrides.ADX ?? false)
  const [showCCI, setShowCCI] = useState(indicatorOverrides.CCI ?? false)
  const [showWilliams, setShowWilliams] = useState(indicatorOverrides.Williams ?? false)
  const [showMFI, setShowMFI] = useState(indicatorOverrides.MFI ?? false)
  const [showOBV, setShowOBV] = useState(indicatorOverrides.OBV ?? false)
  const [showIchimoku, setShowIchimoku] = useState(indicatorOverrides.Ichimoku ?? false)

  // Persist indicators to localStorage whenever they change
  useEffect(() => {
    const indicators = {
      RSI: showRSI, MACD: showMACD, BB: showBB, EMA: showEMA,
      Stoch: showStoch, ATR: showATR, VWAP: showVWAP, SAR: showSAR,
      ADX: showADX, CCI: showCCI, Williams: showWilliams, MFI: showMFI,
      OBV: showOBV, Ichimoku: showIchimoku,
    }
    try { localStorage.setItem('sona-indicators', JSON.stringify(indicators)) } catch {}
  }, [showRSI, showMACD, showBB, showEMA, showStoch, showATR, showVWAP, showSAR, showADX, showCCI, showWilliams, showMFI, showOBV, showIchimoku])
  const [showSignalLines, setShowSignalLines] = useState(true)
  const [activeStrategy, setActiveStrategy] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem('sona-active-strategy') || null } catch { return null }
  })
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false)
  const [showStrategyPanel, setShowStrategyPanel] = useState(false)
  const [showDrawPanel, setShowDrawPanel] = useState(false)
  const [showSlTp, setShowSlTp] = useState(false)
  const [showOrderBook, setShowOrderBook] = useState(true)
  const [tfLoading, setTfLoading] = useState(false)

  // Persist activeStrategy to localStorage
  useEffect(() => {
    try {
      if (activeStrategy) localStorage.setItem('sona-active-strategy', activeStrategy)
      else localStorage.removeItem('sona-active-strategy')
    } catch {}
  }, [activeStrategy])

  // Compute strategy result from chart data
  const strategyResult = useMemo<StrategySignal | null>(() => {
    if (!activeStrategy || chartData.length < 55) return null
    if (activeStrategy === 'quantum') return calcQuantumMomentum(chartData)
    if (activeStrategy === 'liquidity') return calcSmartLiquidityHunter(chartData)
    return null
  }, [activeStrategy, chartData])

  // ── Refs ──
  const binanceIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const bookIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const posIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const tickerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pairDropdownRef = useRef<HTMLDivElement>(null)
  const isInputFocusedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const klineWsRef = useRef<WebSocket | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err' | 'info' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const handleLeverageChange = (l: number) => { setLeverage(l); setLeverageFlash(true); setTimeout(() => setLeverageFlash(false), 1200) }

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pairDropdownRef.current && !pairDropdownRef.current.contains(e.target as Node)) setPairDropdownOpen(false)
    }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── API loaders ──
  const loadBinanceData = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/binance?symbol=${selectedPair.symbol}&interval=${timeframe}&limit=10000`)
      if (!res.ok) throw new Error(); const data = await res.json()
      if (data.candles?.length > 0 && !isInputFocusedRef.current) {
        setChartData(data.candles)
      }
      if (data.ticker) {
        setBinanceTicker(data.ticker)
        setLivePrices(p => ({ ...p, [selectedPair.label]: data.ticker.price }))
      }
      setLoadingChart(false)
    } catch { setLoadingChart(false) }
  }, [selectedPair, timeframe])

  const loadPositions = useCallback(async () => {
    if (isInputFocusedRef.current) return
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/trading/positions', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) return; const data = await res.json()
      setOpenPositions(data.openPositions || []); setClosedPositions(data.closedPositions || [])
    } catch {}
  }, [])

  const loadOrderBook = useCallback(async () => {
    if (isInputFocusedRef.current) return
    try {
      const res = await fetch(`/api/market/binance?symbol=${selectedPair.symbol}&type=depth&depthLimit=15`)
      if (!res.ok) throw new Error(); const data = await res.json()
      if (data.asks?.length > 0 || data.bids?.length > 0) setOrderBook({ asks: data.asks.reverse(), bids: data.bids })
    } catch {
      const price = binanceTicker?.price || chartData[chartData.length - 1]?.close || 60000
      const asks: OrderBookEntry[] = [], bids: OrderBookEntry[] = []; let at = 0, bt = 0
      for (let i = 0; i < 10; i++) {
        const s = price * 0.0002 * (i + 1)
        at += Math.random() * 2 + 0.1; asks.push({ price: price + s, amount: Math.random() * 2 + 0.1, total: at })
        bt += Math.random() * 2 + 0.1; bids.push({ price: price - s, amount: Math.random() * 2 + 0.1, total: bt })
      }
      setOrderBook({ asks: asks.reverse(), bids })
    }
  }, [selectedPair.symbol, binanceTicker?.price, chartData])

  const refreshAllPrices = useCallback(async () => {
    try {
      const results = await Promise.allSettled(PAIRS.map(async (p) => {
        const res = await fetch(`/api/market/binance?symbol=${p.symbol}&interval=1m&limit=1`)
        if (!res.ok) return null; const data = await res.json()
        return { label: p.label, price: data.ticker?.price || 0 }
      }))
      const np: Record<string, number> = {}
      results.forEach(r => { if (r.status === 'fulfilled' && r.value) np[r.value.label] = r.value.price })
      setLivePrices(p => ({ ...p, ...np }))
    } catch {}
  }, [])

  useEffect(() => { Promise.all([loadBinanceData(), loadPositions(), refreshAllPrices()]) }, [])
  useEffect(() => { binanceIntervalRef.current = setInterval(loadBinanceData, 15000); return () => { if (binanceIntervalRef.current) clearInterval(binanceIntervalRef.current) } }, [loadBinanceData])
  useEffect(() => { loadOrderBook(); bookIntervalRef.current = setInterval(loadOrderBook, 3000); return () => { if (bookIntervalRef.current) clearInterval(bookIntervalRef.current) } }, [loadOrderBook])
  useEffect(() => { posIntervalRef.current = setInterval(loadPositions, 5000); return () => { if (posIntervalRef.current) clearInterval(posIntervalRef.current) } }, [loadPositions])
  useEffect(() => { tickerIntervalRef.current = setInterval(refreshAllPrices, 5000); return () => { if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current) } }, [refreshAllPrices])

  // ── Binance WebSocket for real-time ticker ──
  useEffect(() => {
    const connectTickerWs = () => {
      if (wsRef.current) { try { wsRef.current.close() } catch {} }
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedPair.symbol.toLowerCase()}@ticker`)
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.c) {
            const price = parseFloat(data.c)
            const change = parseFloat(data.P)
            const high = parseFloat(data.h)
            const low = parseFloat(data.l)
            const vol = parseFloat(data.q)
            setBinanceTicker(prev => prev ? { ...prev, price, change, high24h: high, low24h: low, quoteVolume24h: vol } : prev)
            setLivePrices(p => ({ ...p, [selectedPair.label]: price }))
          }
        } catch {}
      }
      ws.onerror = () => { /* will auto-reconnect */ }
      ws.onclose = () => {
        setTimeout(() => { if (!document.hidden) connectTickerWs() }, 3000)
      }
      wsRef.current = ws
    }
    connectTickerWs()
    return () => { if (wsRef.current) { try { wsRef.current.close() } catch {} } }
  }, [selectedPair.symbol])

  // ── Binance WebSocket for real-time kline ──
  useEffect(() => {
    const connectKlineWs = () => {
      if (klineWsRef.current) { try { klineWsRef.current.close() } catch {} }
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedPair.symbol.toLowerCase()}@kline_${timeframe}`)
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.k) {
            const k = data.k
            const newCandle: CandleData = {
              time: new Date(k.t).toISOString(),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            }
            setChartData(prev => {
              const updated = [...prev]
              const lastTime = updated.length > 0 ? updated[updated.length - 1].time : null
              if (lastTime && new Date(lastTime).getTime() === new Date(newCandle.time).getTime()) {
                updated[updated.length - 1] = newCandle
              } else {
                updated.push(newCandle)
                if (updated.length > 10000) updated.shift()
              }
              return updated
            })
            setLoadingChart(false)
            setTfLoading(false)
          }
        } catch {}
      }
      ws.onerror = () => {}
      ws.onclose = () => {
        setTimeout(() => { if (!document.hidden) connectKlineWs() }, 3000)
      }
      klineWsRef.current = ws
    }
    connectKlineWs()
    return () => { if (klineWsRef.current) { try { klineWsRef.current.close() } catch {} } }
  }, [selectedPair.symbol, timeframe])

  useEffect(() => {
    const h = () => {
      if (document.hidden) { [binanceIntervalRef, bookIntervalRef, posIntervalRef, tickerIntervalRef].forEach(r => { if (r.current) clearInterval(r.current) }) }
      else {
        loadBinanceData(); loadOrderBook(); loadPositions()
        binanceIntervalRef.current = setInterval(loadBinanceData, 15000)
        bookIntervalRef.current = setInterval(loadOrderBook, 3000)
        posIntervalRef.current = setInterval(loadPositions, 5000)
        tickerIntervalRef.current = setInterval(refreshAllPrices, 5000)
      }
    }
    document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h)
  }, [loadBinanceData, loadOrderBook, loadPositions, refreshAllPrices])

  const currentPrice = binanceTicker?.price || chartData[chartData.length - 1]?.close || 0
  const priceChange = binanceTicker?.change || (chartData.length > 1 ? ((chartData[chartData.length - 1]?.close - chartData[0]?.open) / chartData[0]?.open * 100) : 0)

  const [liveBalance, setLiveBalance] = useState<number>(user?.balance || 0)
  const availableForTrade = liveBalance

  const fetchRealBalance = useCallback(async () => {
    if (isInputFocusedRef.current) return
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/auth/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (res.ok) { const d = await res.json(); if (d.user?.balance !== undefined) setLiveBalance(d.user.balance) }
    } catch {}
  }, [])
  useEffect(() => { fetchRealBalance(); const i = setInterval(fetchRealBalance, 15000); return () => clearInterval(i) }, [fetchRealBalance])

  const fetchInvestmentData = useCallback(async () => {
    if (isInputFocusedRef.current) return
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/investments', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (res.ok) {
        const data = await res.json(); const all = data.investments || []
        const active = all.filter((inv: any) => inv.status === 'ACTIVE')
        setHasActivePackage(active.length > 0); setPackageInvestments(all)
        const trades: any[] = []
        for (const inv of all) {
          try {
            const sr = await fetch(`/api/trading/session?investmentId=${inv.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            if (sr.ok) { const sd = await sr.json(); trades.push(...(sd.trades || []).map((t: any) => ({ ...t, investmentId: inv.id, packageName: inv.package?.name || 'SONA', investmentAmount: inv.amount }))) }
          } catch {}
        }
        setPackageTrades(trades)
      }
    } catch {}
  }, [])
  useEffect(() => { fetchInvestmentData(); const i = setInterval(fetchInvestmentData, 30000); return () => clearInterval(i) }, [fetchInvestmentData])

  const setAmountPercent = (pct: number) => { setOrderPercent(pct); setOrderAmount((availableForTrade * pct / 100).toFixed(2)) }

  const executeOrder = async () => {
    if (!orderAmount || parseFloat(orderAmount) <= 0) { showToast(isAr ? 'يرجى إدخال مبلغ صحيح' : 'Enter a valid amount', 'err'); return }
    if (parseFloat(orderAmount) > availableForTrade) { showToast(isAr ? `يتجاوز الرصيد (${availableForTrade.toFixed(2)})` : `Exceeds balance (${availableForTrade.toFixed(2)})`, 'err'); return }
    if (currentPrice <= 0) { showToast(isAr ? 'السعر غير متاح' : 'Price unavailable', 'err'); return }
    const sl = stopLoss ? parseFloat(stopLoss) : undefined
    const tp1 = takeProfit1 ? parseFloat(takeProfit1) : undefined
    const tp2 = takeProfit2 ? parseFloat(takeProfit2) : undefined
    const tp3 = takeProfit3 ? parseFloat(takeProfit3) : undefined
    if (sl) {
      if (orderSide === 'BUY' && sl >= currentPrice) { showToast(isAr ? 'SL يجب أن يكون أقل' : 'SL must be below price', 'err'); return }
      if (orderSide === 'SELL' && sl <= currentPrice) { showToast(isAr ? 'SL يجب أن يكون أعلى' : 'SL must be above price', 'err'); return }
    }
    if (tp1) {
      if (orderSide === 'BUY' && tp1 <= currentPrice) { showToast(isAr ? 'TP1 يجب أن يكون أعلى' : 'TP1 must be above price', 'err'); return }
      if (orderSide === 'SELL' && tp1 >= currentPrice) { showToast(isAr ? 'TP1 يجب أن يكون أقل' : 'TP1 must be below price', 'err'); return }
    }
    if (tp2) {
      if (orderSide === 'BUY' && tp2 <= currentPrice) { showToast(isAr ? 'TP2 يجب أن يكون أعلى' : 'TP2 must be above price', 'err'); return }
      if (orderSide === 'SELL' && tp2 >= currentPrice) { showToast(isAr ? 'TP2 يجب أن يكون أقل' : 'TP2 must be below price', 'err'); return }
    }
    if (tp3) {
      if (orderSide === 'BUY' && tp3 <= currentPrice) { showToast(isAr ? 'TP3 يجب أن يكون أعلى' : 'TP3 must be above price', 'err'); return }
      if (orderSide === 'SELL' && tp3 >= currentPrice) { showToast(isAr ? 'TP3 يجب أن يكون أقل' : 'TP3 must be below price', 'err'); return }
    }
    setSubmitting(true)
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/trading/positions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ symbol: selectedPair.label, type: orderSide, amount: parseFloat(orderAmount), stopLoss: sl, takeProfit: tp1, takeProfit2: tp2, takeProfit3: tp3, leverage, marginType }),
      })
      if (res.ok) {
        const data = await res.json(); const amt = parseFloat(orderAmount)
        setOrderSuccess({ side: orderSide, amount: amt, price: data.currentPrice || currentPrice })
        setOrderAmount(''); setStopLoss(''); setTakeProfit1(''); setTakeProfit2(''); setTakeProfit3(''); setOrderPercent(0); setShowSlTp(false)
        showToast(isAr ? `تم تنفيذ أمر ${orderSide === 'BUY' ? 'الشراء' : 'البيع'}` : `${orderSide} executed`, 'ok')
        if (data.newBalance !== undefined) setLiveBalance(data.newBalance)
        loadPositions(); useAppStore.getState().refreshUser(); setTimeout(() => setOrderSuccess(null), 2500)
      } else { const e = await res.json().catch(() => ({})); showToast(e.error || (isAr ? 'فشل الأمر' : 'Order failed'), 'err') }
    } catch { showToast(isAr ? 'خطأ اتصال' : 'Connection error', 'err') }
    finally { setSubmitting(false) }
  }

  const closePosition = async (id: string) => {
    setClosingId(id)
    try {
      const token = useAppStore.getState().getToken()
      const res = await fetch('/api/trading/positions/close', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ positionId: id }),
      })
      if (res.ok) {
        const data = await res.json()
        showToast(data.profitLoss >= 0 ? (isAr ? `ربح ${data.profitLoss.toFixed(2)}` : `Profit ${data.profitLoss.toFixed(2)}`) : (isAr ? `خسارة ${Math.abs(data.profitLoss).toFixed(2)}` : `Loss ${Math.abs(data.profitLoss).toFixed(2)}`), data.profitLoss >= 0 ? 'ok' : 'err')
        if (data.newBalance !== undefined) setLiveBalance(data.newBalance)
        loadPositions(); useAppStore.getState().refreshUser()
      } else { showToast(isAr ? 'فشل الإغلاق' : 'Close failed', 'err') }
    } catch { showToast(isAr ? 'خطأ اتصال' : 'Error', 'err') }
    finally { setClosingId(null) }
  }

  const calculatePnL = (pos: PositionData): { pnl: number; pnlPct: number } => {
    const cp = livePrices[pos.symbol] || currentPrice
    if (!cp || pos.entryPrice <= 0) return { pnl: 0, pnlPct: 0 }
    const qty = pos.quantity || (pos.amount / pos.entryPrice)
    const pnl = pos.type === 'BUY' ? (cp - pos.entryPrice) * qty : (pos.entryPrice - cp) * qty
    return { pnl, pnlPct: pos.amount > 0 ? (pnl / pos.amount) * 100 : 0 }
  }

  const totalPnl = useMemo(() => openPositions.reduce((s, p) => s + calculatePnL(p).pnl, 0), [openPositions, livePrices, currentPrice]) // eslint-disable-line

  const goBack = () => { if (onNavigate) onNavigate('dashboard'); else setDashboardPage('dashboard') }

  const INDICATORS = [
    { key: 'EMA', label: isAr ? 'متوسطات متحركة' : 'EMA / SMA', desc: isAr ? 'EMA7, EMA25, SMA50' : 'EMA7, EMA25, SMA50', active: showEMA, color: T.blue4, toggle: () => setShowEMA(!showEMA) },
    { key: 'BB', label: isAr ? 'بولنجر باند' : 'Bollinger Bands', desc: isAr ? 'BB(20, 2)' : 'BB(20, 2)', active: showBB, color: T.green, toggle: () => setShowBB(!showBB) },
    { key: 'RSI', label: 'RSI', desc: isAr ? 'مؤشر القوة النسبية (14)' : 'Relative Strength Index (14)', active: showRSI, color: T.purple, toggle: () => setShowRSI(!showRSI) },
    { key: 'MACD', label: 'MACD', desc: isAr ? 'MACD (12, 26, 9)' : 'MACD (12, 26, 9)', active: showMACD, color: T.gold, toggle: () => setShowMACD(!showMACD) },
    { key: 'Stoch', label: 'Stochastic', desc: isAr ? 'ستوكاستيك (14, 3, 3)' : 'Stochastic (14, 3, 3)', active: showStoch, color: T.orange, toggle: () => setShowStoch(!showStoch) },
    { key: 'ATR', label: 'ATR', desc: isAr ? 'متوسط المدى الحقيقي (14)' : 'Average True Range (14)', active: showATR, color: T.cyan, toggle: () => setShowATR(!showATR) },
    { key: 'VWAP', label: isAr ? 'VWAP' : 'VWAP', desc: isAr ? 'متوسط السعر المرجح بحجم' : 'Volume Weighted Average Price', active: showVWAP, color: '#FF6B9D', toggle: () => setShowVWAP(!showVWAP) },
    { key: 'SAR', label: isAr ? 'بارابوليك SAR' : 'Parabolic SAR', desc: isAr ? 'ستوب وانعكاس (0.02, 0.2)' : 'Stop and Reverse (0.02, 0.2)', active: showSAR, color: '#FF9CF5', toggle: () => setShowSAR(!showSAR) },
    { key: 'ADX', label: isAr ? 'ADX' : 'ADX', desc: isAr ? 'مؤشر الاتجاه المتوسط (14)' : 'Average Directional Index (14)', active: showADX, color: '#F59E0B', toggle: () => setShowADX(!showADX) },
    { key: 'CCI', label: isAr ? 'CCI' : 'CCI', desc: isAr ? 'مؤشر القنوات السلعية (20)' : 'Commodity Channel Index (20)', active: showCCI, color: '#14B8A6', toggle: () => setShowCCI(!showCCI) },
    { key: 'Williams', label: isAr ? 'وليامز %R' : 'Williams %R', desc: isAr ? 'وليامز بيرسنت (14)' : 'Williams Percent Range (14)', active: showWilliams, color: '#E879F9', toggle: () => setShowWilliams(!showWilliams) },
    { key: 'MFI', label: isAr ? 'MFI' : 'MFI', desc: isAr ? 'مؤشر تدفق الأموال (14)' : 'Money Flow Index (14)', active: showMFI, color: '#34D399', toggle: () => setShowMFI(!showMFI) },
    { key: 'OBV', label: isAr ? 'OBV' : 'OBV', desc: isAr ? 'حجم التوازن' : 'On Balance Volume', active: showOBV, color: '#60A5FA', toggle: () => setShowOBV(!showOBV) },
    { key: 'Ichimoku', label: isAr ? 'إيتشيموكو' : 'Ichimoku Cloud', desc: isAr ? 'إيتشيموكو (9, 26, 52)' : 'Ichimoku (9, 26, 52)', active: showIchimoku, color: '#A78BFA', toggle: () => setShowIchimoku(!showIchimoku) },
  ]
  const STRATEGIES = [
    {
      key: 'quantum',
      label: isAr ? 'مصفوفة الزخم الكمي' : 'Quantum Momentum Matrix',
      desc: isAr ? 'EMA 9/21/50 + RSI + MACD + BB Squeeze + حجم' : 'EMA 9/21/50 + RSI + MACD + BB Squeeze + Volume',
      active: activeStrategy === 'quantum',
      color: '#3B82F6',
      icon: '⚛',
      toggle: () => setActiveStrategy(activeStrategy === 'quantum' ? null : 'quantum'),
    },
    {
      key: 'liquidity',
      label: isAr ? 'صياد السيولة الذكي' : 'Smart Liquidity Hunter',
      desc: isAr ? 'Order Blocks + FVG + EMA50 + حجم مؤسسي + RSI7' : 'Order Blocks + FVG + EMA50 + Inst. Volume + RSI7',
      active: activeStrategy === 'liquidity',
      color: '#F59E0B',
      icon: '🏦',
      toggle: () => setActiveStrategy(activeStrategy === 'liquidity' ? null : 'liquidity'),
    },
  ]
  const DRAW_TOOLS = [
    { key: 'horizontal', label: isAr ? 'خط أفقي' : 'Horizontal Line', symbol: '—', color: T.blue5 },
    { key: 'trend', label: isAr ? 'خط اتجاه' : 'Trend Line', symbol: '/', color: T.orange },
    { key: 'rectangle', label: isAr ? 'مستطيل' : 'Rectangle', symbol: '□', color: T.purple },
  ]

  // ── DEPTH BAR ──
  const DepthBar = () => {
    const maxBid = Math.max(...orderBook.bids.map(b => b.total), 1)
    const maxAsk = Math.max(...orderBook.asks.map(a => a.total), 1)
    const spread = orderBook.asks.length > 0 && orderBook.bids.length > 0 ? Math.abs(orderBook.asks[orderBook.asks.length - 1]?.price - orderBook.bids[0]?.price) : 0
    const spreadPct = currentPrice > 0 ? (spread / currentPrice * 100) : 0
    return (
      <div style={{ padding: '0 12px' }}>
        <div style={{ maxHeight: 130, overflow: 'hidden' }}>
          {[...orderBook.asks].reverse().slice(0, 8).map((ask, i) => (
            <div key={`a${i}`} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' }}>
              <div className="depth-bar" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(ask.total / maxAsk) * 100}%`, background: 'linear-gradient(270deg, rgba(255,82,82,0.08), transparent)', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: 'none' }} />
              <span style={{ color: T.red, fontWeight: 600, position: 'relative', zIndex: 1 }}>{fmtPrice(ask.price)}</span>
              <span style={{ color: T.textMuted, position: 'relative', zIndex: 1 }}>{ask.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: priceChange >= 0 ? T.green : T.red, textShadow: `0 0 12px ${priceChange >= 0 ? T.greenGlow : T.redGlow}` }}>{fmtPrice(currentPrice)}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: T.accent, background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>{spreadPct.toFixed(3)}%</span>
        </div>
        <div style={{ maxHeight: 130, overflow: 'hidden' }}>
          {orderBook.bids.slice(0, 8).map((bid, i) => (
            <div key={`b${i}`} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' }}>
              <div className="depth-bar" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(bid.total / maxBid) * 100}%`, background: 'linear-gradient(270deg, rgba(0,230,118,0.08), transparent)', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: 'none' }} />
              <span style={{ color: T.green, fontWeight: 600, position: 'relative', zIndex: 1 }}>{fmtPrice(bid.price)}</span>
              <span style={{ color: T.textMuted, position: 'relative', zIndex: 1 }}>{bid.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── TRADE INPUT ──
  const TradeInput = ({ label, value, onChange, placeholder, prefix, suffixText }: {
    label: string; value: string; onChange: (v: string) => void; placeholder: string; prefix?: string; suffixText?: string
  }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, marginBottom: 4, fontFamily: "'Cairo', sans-serif" }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: T.bg2, borderRadius: 10, border: `1px solid ${T.borderLight}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
        {prefix && <span style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: T.accent }}>{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }}
          placeholder={placeholder} dir="ltr"
          style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 12px', fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
        {suffixText && <span style={{ padding: '0 10px', fontSize: 10, fontWeight: 600, color: T.textMuted }}>{suffixText}</span>}
      </div>
    </div>
  )

  // ── CHART ACTION BUTTONS (Bottom bar with Indicators/Draw/Signals) ──
  // ── TIMEFRAME CHANGE HANDLER (with loading animation) ──
  const handleTimeframeChange = (tf: string) => {
    if (tf === timeframe) return
    setTfLoading(true)
    setTimeframe(tf)
    setChartData([])
    setLoadingChart(true)
    setTimeout(() => setTfLoading(false), 1500)
  }

  // ── TOOL BAR BUTTONS (Indicators / Draw / Signals) ──
  const ToolBarButtons = ({ compact }: { compact?: boolean }) => (
    <>
      {/* Indicators Button */}
      <button className="toolbar-btn" onClick={() => setShowIndicatorPanel(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 6,
        padding: compact ? '4px 8px' : '6px 12px', borderRadius: compact ? 6 : 8, fontSize: compact ? 9 : 10, fontWeight: 800,
        fontFamily: "'Cairo', sans-serif", cursor: 'pointer', transition: 'all 0.15s ease',
        background: `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.08))`,
        border: `1px solid ${T.accentBorder}`, color: T.accent,
      }}>
        <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
        {isAr ? 'مؤشرات' : 'Indicators'}
        {(INDICATORS.filter(i => i.active).length > 0 || activeStrategy) && (
          <span style={{ padding: '0 5px', borderRadius: 5, fontSize: 8, fontWeight: 800, background: T.accent, color: '#fff', lineHeight: '14px' }}>
            {INDICATORS.filter(i => i.active).length + (activeStrategy ? 1 : 0)}
          </span>
        )}
      </button>
      {/* Strategies Button - opens same panel as Indicators */}
      <button className="toolbar-btn" onClick={() => setShowIndicatorPanel(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 6,
        padding: compact ? '4px 8px' : '6px 12px', borderRadius: compact ? 6 : 8, fontSize: compact ? 9 : 10, fontWeight: 800,
        fontFamily: "'Cairo', sans-serif", cursor: 'pointer', transition: 'all 0.15s ease',
        background: activeStrategy ? `linear-gradient(135deg, ${T.goldBg}, rgba(255,176,32,0.05))` : T.card,
        border: `1px solid ${activeStrategy ? T.goldBorder : T.border}`,
        color: activeStrategy ? T.gold : T.textSecondary,
      }}>
        <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        {isAr ? 'استراتيجيات' : 'Strategies'}
        {activeStrategy && (
          <span style={{ padding: '0 5px', borderRadius: 5, fontSize: 8, fontWeight: 800, background: T.gold, color: '#000', lineHeight: '14px' }}>
            1
          </span>
        )}
      </button>
      {/* Draw Button */}
      <button onClick={() => setShowDrawPanel(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 6,
        padding: compact ? '4px 8px' : '6px 12px', borderRadius: compact ? 6 : 8, fontSize: compact ? 9 : 10, fontWeight: 800,
        fontFamily: "'Cairo', sans-serif", cursor: 'pointer', transition: 'all 0.2s',
        background: activeDrawTool ? `linear-gradient(135deg, rgba(251,146,60,0.1), transparent)` : T.card,
        border: `1px solid ${activeDrawTool ? 'rgba(251,146,60,0.3)' : T.border}`,
        color: activeDrawTool ? T.orange : T.textSecondary,
      }}>
        <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
        {isAr ? 'رسم' : 'Draw'}
      </button>
      {/* Signal Lines Toggle */}
      <button onClick={() => setShowSignalLines(!showSignalLines)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 6,
        padding: compact ? '4px 8px' : '6px 12px', borderRadius: compact ? 6 : 8, fontSize: compact ? 9 : 10, fontWeight: 800,
        fontFamily: "'Cairo', sans-serif", cursor: 'pointer', transition: 'all 0.2s',
        background: showSignalLines ? T.greenBg : T.card,
        border: `1px solid ${showSignalLines ? T.greenBorder : T.border}`,
        color: showSignalLines ? T.green : T.textSecondary,
      }}>
        <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" /></svg>
        {isAr ? 'إشارات' : 'Signals'}
      </button>
    </>
  )

  // ── POSITION CARD ──
  const PositionCard = ({ pos }: { pos: any }) => {
    const { pnl, pnlPct } = positionTab !== 'package' ? calculatePnL(pos) : { pnl: pos.profitLoss || 0, pnlPct: 0 }
    const isProfit = pnl >= 0
    const markPrice = positionTab !== 'package' ? (livePrices[pos.symbol] || currentPrice) : (pos.exitPrice || pos.entryPrice)
    const isBuy = pos.type === 'BUY'
    const lev = pos.leverage || 1
    return (
      <div style={{ background: `linear-gradient(135deg, ${T.card}, ${T.bg2})`, borderRadius: 12, padding: '12px 14px', marginBottom: 6, border: `1px solid ${T.border}`, transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.textPrimary, fontFamily: 'monospace' }}>{pos.symbol || pos.sessionSymbol}</span>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: isBuy ? T.greenBg : T.redBg, color: isBuy ? T.green : T.red, border: `1px solid ${isBuy ? T.greenBorder : T.redBorder}` }}>{isBuy ? 'LONG' : 'SHORT'}</span>
            {lev > 1 && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: T.goldBg, color: T.gold, border: `1px solid ${T.goldBorder}` }}>{lev}x</span>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: isProfit ? T.green : T.red, textShadow: `0 0 8px ${isProfit ? T.greenGlow : T.redGlow}` }}>
              {isProfit ? '+' : ''}{pnl.toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: isProfit ? T.green : T.red, fontFamily: 'monospace' }}>{isProfit ? '+' : ''}{pnlPct.toFixed(1)}%</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'monospace', color: T.textMuted }}>
          <span>{isAr ? 'دخول' : 'Entry'}: {fmtPrice(pos.entryPrice)}</span>
          <span>{isAr ? 'علامة' : 'Mark'}: {fmtPrice(markPrice)}</span>
          {positionTab === 'open' && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => closePosition(pos.id)} disabled={closingId === pos.id}
              style={{ padding: '3px 10px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: closingId === pos.id ? 'not-allowed' : 'pointer', opacity: closingId === pos.id ? 0.5 : 1, fontFamily: "'Cairo', sans-serif" }}>
              {closingId === pos.id ? '...' : (isAr ? 'إغلاق' : 'Close')}
            </motion.button>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.bg2})`, direction: isAr ? 'rtl' : 'ltr', fontFamily: "'Cairo', sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes blueGlow { 0%, 100% { box-shadow: 0 0 6px rgba(60,130,255,0.2); } 50% { box-shadow: 0 0 18px rgba(60,130,255,0.5); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .tv-attr-logo, [class*="tv-attr"], a[href*="tradingview"] { display: none !important; }
        button { transition: all 0.15s ease !important; }
        button:hover { filter: brightness(1.1); }
        button:active { transform: scale(0.98); }
        .chart-fade-in { animation: fadeIn 0.4s ease-out; }
        .pair-switch { animation: slideUp 0.25s ease-out; }
        .depth-bar { transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .tf-btn { transition: all 0.15s ease !important; }
        .toolbar-btn:hover { box-shadow: 0 0 12px rgba(60,130,255,0.2); }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, padding: '10px 20px', borderRadius: 12, fontSize: 12, fontWeight: 700, maxWidth: '90%', fontFamily: "'Cairo', sans-serif",
              background: toast.type === 'ok' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : toast.type === 'err' ? `linear-gradient(135deg, ${T.red}, ${T.redDark})` : `linear-gradient(135deg, ${T.card}, ${T.bg3})`,
              color: toast.type === 'info' ? T.textPrimary : '#fff',
              border: `1px solid ${toast.type === 'ok' ? T.greenBorder : toast.type === 'err' ? T.redBorder : T.border}`,
              boxShadow: `0 8px 32px ${toast.type === 'ok' ? T.greenGlow : toast.type === 'err' ? T.redGlow : T.accentGlow}` }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{orderSuccess && <OrderSuccessOverlay success={orderSuccess} isAr={isAr} />}</AnimatePresence>

      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div className="hidden md:flex md:flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', height: 50, padding: '0 14px', gap: 12, flexShrink: 0, background: `linear-gradient(135deg, ${T.glass}, rgba(10,18,40,0.95))`, backdropFilter: 'blur(24px)', borderBottom: `1px solid ${T.borderLight}` }}>
          <button onClick={goBack} style={{ padding: 6, borderRadius: 10, color: T.textSecondary, cursor: 'pointer', background: 'transparent', border: `1px solid transparent`, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => setShowMarketPanel(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, color: T.textPrimary, cursor: 'pointer', background: showMarketPanel ? T.accentBg : 'transparent', border: `1px solid ${showMarketPanel ? T.accentBorder : 'transparent'}`, transition: 'all 0.2s' }}>
            <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace' }}>{selectedPair.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace' }}>{selectedPair.label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: priceChange >= 0 ? T.green : T.red, textShadow: `0 0 16px ${priceChange >= 0 ? T.greenGlow : T.redGlow}` }}>{fmtPrice(currentPrice)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, fontFamily: 'monospace', background: priceChange >= 0 ? T.greenBg : T.redBg, color: priceChange >= 0 ? T.green : T.red, border: `1px solid ${priceChange >= 0 ? T.greenBorder : T.redBorder}` }}>{fmtPct(priceChange)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginLeft: 'auto' }}>
            {[{ l: isAr ? 'أعلى 24س' : '24h H', v: fmtPrice(binanceTicker?.high24h || 0), c: T.green }, { l: isAr ? 'أدنى 24س' : '24h L', v: fmtPrice(binanceTicker?.low24h || 0), c: T.red }, { l: isAr ? 'حجم 24س' : '24h Vol', v: fmtVol(binanceTicker?.quoteVolume24h || 0), c: T.gold }].map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: T.textMuted }}>{s.l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: s.c, fontFamily: 'monospace' }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeframe + Tool Buttons */}
        <div style={{ flexShrink: 0, background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
          {/* Row 1: Timeframes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 12px', position: 'relative' }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => handleTimeframeChange(tf)}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: timeframe === tf ? `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.15))` : 'transparent', color: timeframe === tf ? T.accent : T.textMuted, border: `1px solid ${timeframe === tf ? T.accentBorder : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
                {tf}
                {tfLoading && timeframe === tf && (
                  <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: T.accent, animation: 'pulse 0.8s infinite', boxShadow: `0 0 6px ${T.accent}` }} />
                )}
              </button>
            ))}
            {/* Loading indicator when changing timeframe */}
            {tfLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                <div style={{ width: 14, height: 14, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: T.accent, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'جاري التحديث...' : 'Loading...'}</span>
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {INDICATORS.filter(i => i.active).map(ind => (
                <span key={ind.key} style={{ fontSize: 8, fontWeight: 600, color: ind.color, padding: '2px 6px', borderRadius: 4, background: `${ind.color}10`, border: `1px solid ${ind.color}15` }}>{ind.key}</span>
              ))}
              {activeStrategy && (
                <span style={{ fontSize: 8, fontWeight: 700, color: STRATEGIES.find(s => s.key === activeStrategy)?.color, padding: '2px 6px', borderRadius: 4, background: `${STRATEGIES.find(s => s.key === activeStrategy)?.color}10`, border: `1px solid ${STRATEGIES.find(s => s.key === activeStrategy)?.color}15` }}>⚡{activeStrategy === 'quantum' ? 'QMM' : 'SLH'}</span>
              )}
            </div>
          </div>
          {/* Row 2: Tool Buttons (Indicators / Draw / Signals) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 6px', borderTop: `1px solid ${T.border}` }}>
            <ToolBarButtons />
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* LEFT: Chart + Action Bar + Positions */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, borderRight: `1px solid ${T.border}`, position: 'relative' }}>
            <div style={{ flex: 1, position: 'relative', minHeight: 0, background: T.bg }} className={!loadingChart ? 'chart-fade-in' : undefined}>
              {loadingChart && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: T.bg }}>
                  <div style={{ width: 36, height: 36, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
              <SonaChart candles={chartData} selectedPair={selectedPair} isAr={isAr} openPositions={openPositions} drawings={drawings} onDrawingsChange={setDrawings} activeDrawTool={activeDrawTool} onSetActiveDrawTool={setActiveDrawTool} showEMA={showEMA} showBB={showBB} showRSI={showRSI} showMACD={showMACD} showStoch={showStoch} showATR={showATR} showVWAP={showVWAP} showSAR={showSAR} showADX={showADX} showCCI={showCCI} showWilliams={showWilliams} showMFI={showMFI} showOBV={showOBV} showIchimoku={showIchimoku} showSignalLines={showSignalLines} chartHeight={450} currentPrice={currentPrice} activeStrategy={activeStrategy} strategyResult={strategyResult} />
            </div>

            {/* Market Selection Full Panel */}
            <FullPanel isOpen={showMarketPanel} onClose={() => setShowMarketPanel(false)} title={isAr ? 'اختيار السوق' : 'Select Market'} isAr={isAr}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {PAIRS.map(p => {
                  const pPrice = livePrices[p.label] || 0
                  const isActive = selectedPair.symbol === p.symbol
                  return (
                    <motion.button key={p.symbol} whileTap={{ scale: 0.97 }} onClick={() => { setSelectedPair(p); setChartData([]); setLoadingChart(true); setShowMarketPanel(false) }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', textAlign: isAr ? 'right' : 'left',
                        background: isActive ? `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.15))` : T.card,
                        border: `1px solid ${isActive ? T.accentBorder : T.border}`,
                        boxShadow: isActive ? `0 0 20px ${T.accentGlow}` : 'none',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: isAr ? 'flex-end' : 'flex-start' }}>
                        <span style={{ fontSize: 22, fontWeight: 900 }}>{p.icon}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: isActive ? T.accent : T.textPrimary }}>{p.label}</div>
                          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{p.nameAr}</div>
                        </div>
                        {isActive && <span style={{ marginLeft: 'auto', marginRight: isAr ? 0 : 'auto', fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: T.accent, color: '#fff' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: pPrice > 0 ? T.textPrimary : T.textMuted }}>
                        {pPrice > 0 ? fmtPrice(pPrice) : '---'}
                        <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}> USDT</span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </FullPanel>

            {/* Indicator Full Panel (overlays chart area) */}
            <FullPanel isOpen={showIndicatorPanel} onClose={() => setShowIndicatorPanel(false)} title={isAr ? 'المؤشرات والاستراتيجيات' : 'Indicators & Strategies'} isAr={isAr}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.accent, fontFamily: "'Cairo', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>{isAr ? '📈 المؤشرات الفنية' : '📈 TECHNICAL INDICATORS'}</span>
              </div>
              {INDICATORS.map(ind => (
                <IndicatorItem key={ind.key} label={ind.label} description={ind.desc} active={ind.active} color={ind.color} onToggle={ind.toggle} isAr={isAr} />
              ))}

              {/* ═══ STRATEGIES SECTION ═══ */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}`, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.gold, fontFamily: "'Cairo', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>{isAr ? '⚡ الاستراتيجيات الاحترافية' : '⚡ PRO STRATEGIES'}</span>
                </div>
                {/* Strategy Result Display */}
                {activeStrategy && strategyResult && strategyResult.type !== 'NEUTRAL' && (
                  <div style={{
                    marginBottom: 16, padding: 16, borderRadius: 14,
                    background: strategyResult.type === 'BUY'
                      ? `linear-gradient(135deg, ${T.greenBg}, rgba(0,230,118,0.03))`
                      : `linear-gradient(135deg, ${T.redBg}, rgba(255,82,82,0.03))`,
                    border: `1px solid ${strategyResult.type === 'BUY' ? T.greenBorder : T.redBorder}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, padding: '4px 12px', borderRadius: 8, background: strategyResult.type === 'BUY' ? T.green : T.red, color: '#fff', fontFamily: 'monospace' }}>
                        {strategyResult.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>
                        {activeStrategy === 'quantum' ? (isAr ? 'مصفوفة الزخم الكمي' : 'Quantum Momentum Matrix') : (isAr ? 'صياد السيولة الذكي' : 'Smart Liquidity Hunter')}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'سعر الدخول' : 'Entry'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.entry)}</div>
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'وقف الخسارة' : 'Stop Loss'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.red, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.stopLoss)}</div>
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الهدف ١' : 'Target 1'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.green, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.targets[0])}</div>
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الهدف ٢' : 'Target 2'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.green, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.targets[1])}</div>
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الهدف ٣' : 'Target 3'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.green, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.targets[2])}</div>
                      </div>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الثقة' : 'Confidence'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: strategyResult.confidence >= 75 ? T.green : T.gold, fontFamily: 'monospace' }}>{strategyResult.confidence}%</div>
                      </div>
                    </div>
                    {strategyResult.reason && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
                        <div style={{ fontSize: 9, color: T.accent, fontFamily: "'Cairo', sans-serif", fontWeight: 700 }}>{isAr ? 'السبب' : 'Reason'}</div>
                        <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{strategyResult.reason}</div>
                      </div>
                    )}
                  </div>
                )}
                {activeStrategy && (!strategyResult || strategyResult.type === 'NEUTRAL') && chartData.length >= 55 && (
                  <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, background: T.card, border: `1px solid ${T.border}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'جاري تحليل السوق...' : 'Analyzing market conditions...'}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif", marginTop: 4 }}>{isAr ? 'يتم البحث عن فرص التداول' : 'Scanning for trade opportunities'}</div>
                  </div>
                )}
                {activeStrategy && chartData.length < 55 && (
                  <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, background: T.card, border: `1px solid ${T.border}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'جاري تحميل البيانات...' : 'Loading chart data...'}</div>
                  </div>
                )}
                {/* Strategy Cards */}
                {STRATEGIES.map(strat => (
                  <button key={strat.key} onClick={strat.toggle} style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
                    borderRadius: 14, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s ease',
                    background: strat.active ? `linear-gradient(135deg, ${strat.color}10, ${strat.color}05)` : T.card,
                    border: `1px solid ${strat.active ? `${strat.color}30` : T.border}`,
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: strat.active ? `${strat.color}18` : T.bg2, border: `1px solid ${strat.active ? `${strat.color}25` : T.border}`,
                      fontSize: 24, transition: 'all 0.15s ease',
                    }}>{strat.icon}</div>
                    <div style={{ flex: 1, textAlign: isAr ? 'right' : 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: strat.active ? strat.color : T.textPrimary, fontFamily: "'Cairo', sans-serif" }}>{strat.label}</div>
                      <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif", marginTop: 2 }}>{strat.desc}</div>
                      {strat.active && (
                        <span style={{ marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, background: `${strat.color}15`, color: strat.color, border: `1px solid ${strat.color}30` }}>{isAr ? '● نشط' : '● ACTIVE'}</span>
                      )}
                    </div>
                    {/* Toggle Switch */}
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'all 0.3s',
                      background: strat.active ? `${strat.color}30` : T.bg2, border: `1px solid ${strat.active ? `${strat.color}40` : T.border}`,
                    }}>
                      <motion.div animate={{ x: strat.active ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          width: 18, height: 18, borderRadius: 9, position: 'absolute', top: 2,
                          background: strat.active ? strat.color : T.textMuted, boxShadow: strat.active ? `0 0 10px ${strat.color}40` : 'none',
                          transition: 'all 0.2s',
                        }}
                      />
                    </div>
                  </button>
                ))}
                {/* Strategy Info */}
                <div style={{ marginTop: 10, padding: 14, borderRadius: 14, background: T.card, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, fontFamily: "'Cairo', sans-serif", marginBottom: 8 }}>{isAr ? '⚡ كيف تعمل الاستراتيجيات' : '⚡ How Strategies Work'}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif", lineHeight: 1.8 }}>
                    {isAr
                      ? '• عند تفعيل استراتيجية، يتم تحليل البيانات تلقائياً وعرض إشارة شراء أو بيع على الرسم البياني\n• يظهر وقف الخسارة و3 أهداف ربح على الشارت\n• الاستراتيجية تعمل بشكل مستمر وتحدث الإشارات تلقائياً\n• يمكنك تفعيل استراتيجية واحدة فقط في كل مرة'
                      : '• When a strategy is activated, it automatically analyzes data and displays a BUY or SELL signal on the chart\n• Stop loss and 3 profit targets are shown on the chart\n• The strategy runs continuously and updates signals automatically\n• Only one strategy can be active at a time'
                    }
                  </div>
                </div>
              </div>
            </FullPanel>

            {/* Draw Full Panel */}
            <FullPanel isOpen={showDrawPanel} onClose={() => { setShowDrawPanel(false); setActiveDrawTool(null) }} title={isAr ? 'أدوات الرسم' : 'Drawing Tools'} isAr={isAr}>
              {DRAW_TOOLS.map(tool => (
                <DrawToolItem key={tool.key} label={tool.label} symbol={tool.symbol} color={tool.color} active={activeDrawTool === tool.key} onToggle={() => { setActiveDrawTool(tool.key); setShowDrawPanel(false) }} isAr={isAr} />
              ))}
              {activeDrawTool && (
                <button onClick={() => { setActiveDrawTool(null); setShowDrawPanel(false) }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px',
                  borderRadius: 14, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer',
                  fontFamily: "'Cairo', sans-serif", fontSize: 13, fontWeight: 700, marginTop: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  {isAr ? 'إلغاء التحديد' : 'Deselect Tool'}
                </button>
              )}
              {drawings.length > 0 && (
                <button onClick={() => { setDrawings([]); setShowDrawPanel(false) }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px',
                  borderRadius: 14, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer',
                  fontFamily: "'Cairo', sans-serif", fontSize: 13, fontWeight: 700, marginTop: 4,
                }}>
                  {isAr ? 'مسح الكل' : 'Clear All'} ({drawings.length})
                </button>
              )}
            </FullPanel>

            {/* Positions */}
            <div style={{ flexShrink: 0, maxHeight: '30%', overflow: 'auto' }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
                {[{ k: 'open' as const, l: isAr ? 'مفتوحة' : 'Open', c: openPositions.length }, { k: 'closed' as const, l: isAr ? 'مغلقة' : 'Closed', c: closedPositions.length }, ...(hasActivePackage ? [{ k: 'package' as const, l: isAr ? 'الباقة' : 'Package', c: packageTrades.length }] : [])].map(tab => (
                  <button key={tab.k} onClick={() => setPositionTab(tab.k)}
                    style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, fontFamily: "'Cairo', sans-serif", background: positionTab === tab.k ? T.accentBg : 'transparent', color: positionTab === tab.k ? T.accent : T.textMuted, border: 'none', borderBottom: positionTab === tab.k ? `2px solid ${T.accent}` : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {tab.l} {tab.c > 0 && <span style={{ fontSize: 9, marginLeft: 4, padding: '0 5px', borderRadius: 8, background: positionTab === tab.k ? T.accentBorder : T.border, color: positionTab === tab.k ? T.accent : T.textMuted }}>{tab.c}</span>}
                  </button>
                ))}
              </div>
              {totalPnl !== 0 && positionTab === 'open' && openPositions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: totalPnl >= 0 ? T.greenBg : T.redBg, borderBottom: `1px solid ${totalPnl >= 0 ? T.greenBorder : T.redBorder}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: totalPnl >= 0 ? T.green : T.red }}>{isAr ? 'إجمالي' : 'Total PnL'}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: totalPnl >= 0 ? T.green : T.red }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT</span>
                </div>
              )}
              <div style={{ padding: 6, maxHeight: 180, overflow: 'auto' }}>
                {(positionTab === 'open' ? openPositions : positionTab === 'closed' ? closedPositions : packageTrades).length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: T.textMuted, fontSize: 11 }}>{positionTab === 'open' ? (isAr ? 'لا توجد صفقات' : 'No positions') : (isAr ? 'لا توجد صفقات' : 'No history')}</div>
                ) : (positionTab === 'open' ? openPositions : positionTab === 'closed' ? closedPositions : packageTrades).map((pos: any) => <PositionCard key={pos.id} pos={pos} />)}
              </div>
            </div>
          </div>

          {/* RIGHT: OrderBook + Trade */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 320, background: `linear-gradient(180deg, ${T.bg2}, ${T.bg})` }}>
            <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'دفتر الأوامر' : 'Order Book'}</span>
                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: T.accent, background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>{selectedPair.label}</span>
              </div>
              <DepthBar />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {/* Balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.05))`, border: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted }}>{isAr ? 'الرصيد المتاح' : 'Available'}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: T.accent }}>{fmt(availableForTrade)} <span style={{ fontSize: 9, color: T.textMuted }}>USDT</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}`, animation: 'pulse 2s infinite' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.green }}>LIVE</span>
                </div>
              </div>

              {/* Buy/Sell Toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOrderSide('BUY')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: 'pointer', transition: 'all 0.25s',
                    background: orderSide === 'BUY' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : T.greenBg,
                    border: `1px solid ${orderSide === 'BUY' ? T.green : T.greenBorder}`,
                    color: orderSide === 'BUY' ? '#fff' : T.green,
                    boxShadow: orderSide === 'BUY' ? `0 4px 20px ${T.greenGlow}` : 'none' }}>
                  {isAr ? 'شراء LONG' : 'BUY / LONG'}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOrderSide('SELL')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: 'pointer', transition: 'all 0.25s',
                    background: orderSide === 'SELL' ? `linear-gradient(135deg, ${T.red}, ${T.redDark})` : T.redBg,
                    border: `1px solid ${orderSide === 'SELL' ? T.red : T.redBorder}`,
                    color: orderSide === 'SELL' ? '#fff' : T.red,
                    boxShadow: orderSide === 'SELL' ? `0 4px 20px ${T.redGlow}` : 'none' }}>
                  {isAr ? 'بيع SHORT' : 'SELL / SHORT'}
                </motion.button>
              </div>

              {/* Order Type */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 10, padding: 3, borderRadius: 10, background: T.bg2, border: `1px solid ${T.border}` }}>
                {(['market', 'limit'] as const).map(type => (
                  <button key={type} onClick={() => setOrderType(type)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, fontFamily: "'Cairo', sans-serif", background: orderType === type ? `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.1))` : 'transparent', color: orderType === type ? T.accent : T.textMuted, border: `1px solid ${orderType === type ? T.accentBorder : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                    {type === 'market' ? (isAr ? 'سوقي' : 'Market') : (isAr ? 'محدد' : 'Limit')}
                  </button>
                ))}
              </div>

              {orderType === 'limit' && <TradeInput label={isAr ? 'سعر الأمر' : 'Order Price'} value={orderPrice} onChange={setOrderPrice} placeholder={fmtPrice(currentPrice)} suffixText="USDT" />}
              <TradeInput label={isAr ? 'المبلغ' : 'Amount'} value={orderAmount} onChange={v => { setOrderAmount(v); setOrderPercent(0) }} placeholder="0.00" suffixText="USDT" />

              {/* Percent */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct} onClick={() => setAmountPercent(pct)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, fontFamily: "'Cairo', sans-serif", background: orderPercent === pct ? `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.1))` : T.bg2, border: `1px solid ${orderPercent === pct ? T.accentBorder : T.border}`, color: orderPercent === pct ? T.accent : T.textMuted, cursor: 'pointer', transition: 'all 0.2s' }}>
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Leverage */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>{isAr ? 'الرافعة المالية' : 'Leverage'}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', padding: '2px 10px', borderRadius: 8, color: T.gold, background: T.goldBg, border: `1px solid ${T.goldBorder}`, animation: leverageFlash ? 'blueGlow 0.6s ease' : 'none' }}>{leverage}x</span>
                </div>
                {/* Slider */}
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  <input type="range" min={1} max={125} value={leverage} onChange={e => handleLeverageChange(parseInt(e.target.value))}
                    style={{ width: '100%', height: 6, appearance: 'none', background: `linear-gradient(to right, ${T.gold} ${(leverage - 1) / 124 * 100}%, ${T.border} ${(leverage - 1) / 124 * 100}%)`, borderRadius: 3, outline: 'none', cursor: 'pointer' }} />
                  <style>{`
                    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: ${T.gold}; border: 2px solid #fff; cursor: pointer; box-shadow: 0 0 8px ${T.gold}60; }
                    input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: ${T.gold}; border: 2px solid #fff; cursor: pointer; box-shadow: 0 0 8px ${T.gold}60; }
                  `}</style>
                </div>
                {/* Quick buttons */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1, 5, 10, 25, 50, 75, 100, 125].map(lev => (
                    <button key={lev} onClick={() => handleLeverageChange(lev)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 8, fontWeight: 700, fontFamily: 'monospace', background: leverage === lev ? T.goldBg : 'transparent', border: `1px solid ${leverage === lev ? T.goldBorder : T.border}`, color: leverage === lev ? T.gold : T.textMuted, cursor: 'pointer', transition: 'all 0.2s' }}>
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 10, padding: 3, borderRadius: 10, background: T.bg2, border: `1px solid ${T.border}` }}>
                {(['cross', 'isolated'] as const).map(mt => (
                  <button key={mt} onClick={() => setMarginType(mt)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, fontFamily: "'Cairo', sans-serif", background: marginType === mt ? `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.1))` : 'transparent', color: marginType === mt ? T.accent : T.textMuted, border: `1px solid ${marginType === mt ? T.accentBorder : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                    {mt === 'cross' ? (isAr ? 'مشترك' : 'Cross') : (isAr ? 'معزول' : 'Isolated')}
                  </button>
                ))}
              </div>

              {/* SL/TP */}
              <button onClick={() => setShowSlTp(!showSlTp)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", marginBottom: 6, padding: 0 }}>
                <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showSlTp ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                {isAr ? 'وقف خسارة / أهداف الربح' : 'Stop Loss / Take Profit'}
                {(stopLoss || takeProfit1 || takeProfit2 || takeProfit3) && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}>{[stopLoss, takeProfit1, takeProfit2, takeProfit3].filter(Boolean).length}</span>}
              </button>
              <AnimatePresence>
                {showSlTp && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    {/* Stop Loss */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.redBorder}`, marginBottom: 6 }}>
                      <span style={{ padding: '0 8px', fontSize: 9, fontWeight: 700, color: T.red, whiteSpace: 'nowrap' }}>{isAr ? 'وقف' : 'SL'}</span>
                      <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 0.98 : currentPrice * 1.02)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: T.red, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                    </div>
                    {/* Target 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.greenBorder}`, marginBottom: 6 }}>
                      <span style={{ padding: '0 8px', fontSize: 9, fontWeight: 700, color: T.green, whiteSpace: 'nowrap' }}>{isAr ? 'هدف ١' : 'TP1'}</span>
                      <input type="number" value={takeProfit1} onChange={e => setTakeProfit1(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 1.02 : currentPrice * 0.98)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: T.green, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                    </div>
                    {/* Target 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.greenBorder}`, marginBottom: 6 }}>
                      <span style={{ padding: '0 8px', fontSize: 9, fontWeight: 700, color: '#22d3ee', whiteSpace: 'nowrap' }}>{isAr ? 'هدف ٢' : 'TP2'}</span>
                      <input type="number" value={takeProfit2} onChange={e => setTakeProfit2(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 1.05 : currentPrice * 0.95)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#22d3ee', fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                    </div>
                    {/* Target 3 */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.greenBorder}`, marginBottom: 10 }}>
                      <span style={{ padding: '0 8px', fontSize: 9, fontWeight: 700, color: '#a78bfa', whiteSpace: 'nowrap' }}>{isAr ? 'هدف ٣' : 'TP3'}</span>
                      <input type="number" value={takeProfit3} onChange={e => setTakeProfit3(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 1.10 : currentPrice * 0.90)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Execute */}
              <motion.button whileTap={{ scale: 0.98 }} onClick={executeOrder} disabled={submitting}
                style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 14, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
                  background: orderSide === 'BUY' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : `linear-gradient(135deg, ${T.red}, ${T.redDark})`,
                  color: '#fff', opacity: submitting ? 0.6 : 1,
                  boxShadow: `0 6px 28px ${orderSide === 'BUY' ? T.greenGlow : T.redGlow}`,
                  border: 'none' }}>
                {submitting ? '...' : (isAr ? (orderSide === 'BUY' ? 'شراء' : 'بيع') : (orderSide === 'BUY' ? 'BUY' : 'SELL'))} {selectedPair.label.replace('/USDT', '')}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE LAYOUT ═══ */}
      <div className="flex flex-col md:hidden" style={{ minHeight: '100vh' }}>
        {/* Mobile Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: 44, background: `linear-gradient(135deg, ${T.glass}, rgba(10,18,40,0.95))`, backdropFilter: 'blur(24px)', borderBottom: `1px solid ${T.borderLight}` }}>
          <button onClick={goBack} style={{ padding: 4, borderRadius: 8, color: T.textSecondary, cursor: 'pointer', background: 'transparent', border: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => setShowMarketPanel(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, color: T.textPrimary, cursor: 'pointer', background: showMarketPanel ? T.accentBg : 'transparent', border: `1px solid ${showMarketPanel ? T.accentBorder : 'transparent'}`, transition: 'all 0.2s' }}>
            <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>{selectedPair.icon} {selectedPair.label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: priceChange >= 0 ? T.green : T.red, textShadow: `0 0 12px ${priceChange >= 0 ? T.greenGlow : T.redGlow}` }}>{fmtPrice(currentPrice)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', background: priceChange >= 0 ? T.greenBg : T.redBg, color: priceChange >= 0 ? T.green : T.red, border: `1px solid ${priceChange >= 0 ? T.greenBorder : T.redBorder}` }}>{fmtPct(priceChange)}</span>
          </div>
        </div>

        {/* Mobile Timeframe + Tool Buttons */}
        <div style={{ background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
          {/* Timeframes */}
          <div style={{ display: 'flex', gap: 2, padding: '4px 8px', alignItems: 'center', position: 'relative' }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => handleTimeframeChange(tf)}
                style={{ flex: 1, padding: '4px 0', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', background: timeframe === tf ? T.accentBg : 'transparent', color: timeframe === tf ? T.accent : T.textMuted, border: `1px solid ${timeframe === tf ? T.accentBorder : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
                {tf}
                {tfLoading && timeframe === tf && (
                  <span style={{ position: 'absolute', top: -2, right: 2, width: 6, height: 6, borderRadius: '50%', background: T.accent, animation: 'pulse 0.8s infinite', boxShadow: `0 0 4px ${T.accent}` }} />
                )}
              </button>
            ))}
            {tfLoading && (
              <div style={{ width: 12, height: 12, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginLeft: 4, flexShrink: 0 }} />
            )}
          </div>
          {/* Tool Buttons */}
          <div style={{ display: 'flex', gap: 4, padding: '3px 8px 5px', borderTop: `1px solid ${T.border}` }}>
            <ToolBarButtons compact />
          </div>
        </div>

        {/* Mobile Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: mobileTab === 'chart' ? 220 : 60 }} className="scrollbar-none">
          {mobileTab === 'chart' && (
            <div style={{ position: 'relative' }}>
              <SonaChart candles={chartData} selectedPair={selectedPair} isAr={isAr} openPositions={openPositions} drawings={drawings} onDrawingsChange={setDrawings} activeDrawTool={activeDrawTool} onSetActiveDrawTool={setActiveDrawTool} showEMA={showEMA} showBB={showBB} showRSI={showRSI} showMACD={showMACD} showStoch={showStoch} showATR={showATR} showVWAP={showVWAP} showSAR={showSAR} showADX={showADX} showCCI={showCCI} showWilliams={showWilliams} showMFI={showMFI} showOBV={showOBV} showIchimoku={showIchimoku} showSignalLines={showSignalLines} chartHeight={300} currentPrice={currentPrice} activeStrategy={activeStrategy} strategyResult={strategyResult} />
              {/* Market Selection Panel (mobile) */}
              <FullPanel isOpen={showMarketPanel} onClose={() => setShowMarketPanel(false)} title={isAr ? 'اختيار السوق' : 'Select Market'} isAr={isAr}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PAIRS.map(p => {
                    const pPrice = livePrices[p.label] || 0
                    const isActive = selectedPair.symbol === p.symbol
                    return (
                      <motion.button key={p.symbol} whileTap={{ scale: 0.97 }} onClick={() => { setSelectedPair(p); setChartData([]); setLoadingChart(true); setShowMarketPanel(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                          background: isActive ? `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.15))` : T.card,
                          border: `1px solid ${isActive ? T.accentBorder : T.border}`,
                          boxShadow: isActive ? `0 0 16px ${T.accentGlow}` : 'none',
                        }}>
                        <span style={{ fontSize: 24, fontWeight: 900 }}>{p.icon}</span>
                        <div style={{ flex: 1, textAlign: isAr ? 'right' : 'left' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: isActive ? T.accent : T.textPrimary }}>{p.label}</div>
                          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{p.nameAr}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: pPrice > 0 ? T.textPrimary : T.textMuted }}>
                            {pPrice > 0 ? fmtPrice(pPrice) : '---'}
                          </div>
                          <div style={{ fontSize: 8, color: T.textMuted, fontWeight: 600 }}>USDT</div>
                        </div>
                        {isActive && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: T.accent, color: '#fff' }}>✓</span>}
                      </motion.button>
                    )
                  })}
                </div>
              </FullPanel>

              {/* Indicator Panel (mobile overlay) */}
              <FullPanel isOpen={showIndicatorPanel} onClose={() => setShowIndicatorPanel(false)} title={isAr ? 'المؤشرات والاستراتيجيات' : 'Indicators & Strategies'} isAr={isAr}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.accent, fontFamily: "'Cairo', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>{isAr ? '📈 المؤشرات الفنية' : '📈 TECHNICAL INDICATORS'}</span>
                </div>
                {INDICATORS.map(ind => (
                  <IndicatorItem key={ind.key} label={ind.label} description={ind.desc} active={ind.active} color={ind.color} onToggle={ind.toggle} isAr={isAr} />
                ))}

                {/* ═══ STRATEGIES SECTION ═══ */}
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}`, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: T.gold, fontFamily: "'Cairo', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>{isAr ? '⚡ الاستراتيجيات الاحترافية' : '⚡ PRO STRATEGIES'}</span>
                  </div>
                  {/* Strategy Result Display */}
                  {activeStrategy && strategyResult && strategyResult.type !== 'NEUTRAL' && (
                    <div style={{
                      marginBottom: 16, padding: 16, borderRadius: 14,
                      background: strategyResult.type === 'BUY'
                        ? `linear-gradient(135deg, ${T.greenBg}, rgba(0,230,118,0.03))`
                        : `linear-gradient(135deg, ${T.redBg}, rgba(255,82,82,0.03))`,
                      border: `1px solid ${strategyResult.type === 'BUY' ? T.greenBorder : T.redBorder}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, padding: '4px 12px', borderRadius: 8, background: strategyResult.type === 'BUY' ? T.green : T.red, color: '#fff', fontFamily: 'monospace' }}>
                          {strategyResult.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>
                          {activeStrategy === 'quantum' ? (isAr ? 'مصفوفة الزخم الكمي' : 'Quantum Momentum Matrix') : (isAr ? 'صياد السيولة الذكي' : 'Smart Liquidity Hunter')}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'سعر الدخول' : 'Entry'}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.entry)}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'وقف الخسارة' : 'Stop Loss'}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.red, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.stopLoss)}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الهدف ١' : 'Target 1'}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.green, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.targets[0])}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الهدف ٢' : 'Target 2'}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.green, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.targets[1])}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الهدف ٣' : 'Target 3'}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.green, fontFamily: 'monospace' }}>{fmtPrice(strategyResult.targets[2])}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'الثقة' : 'Confidence'}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: strategyResult.confidence >= 75 ? T.green : T.gold, fontFamily: 'monospace' }}>{strategyResult.confidence}%</div>
                        </div>
                      </div>
                      {strategyResult.reason && (
                        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
                          <div style={{ fontSize: 9, color: T.accent, fontFamily: "'Cairo', sans-serif", fontWeight: 700 }}>{isAr ? 'السبب' : 'Reason'}</div>
                          <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{strategyResult.reason}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeStrategy && (!strategyResult || strategyResult.type === 'NEUTRAL') && chartData.length >= 55 && (
                    <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, background: T.card, border: `1px solid ${T.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'جاري تحليل السوق...' : 'Analyzing market conditions...'}</div>
                      <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif", marginTop: 4 }}>{isAr ? 'يتم البحث عن فرص التداول' : 'Scanning for trade opportunities'}</div>
                    </div>
                  )}
                  {activeStrategy && chartData.length < 55 && (
                    <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, background: T.card, border: `1px solid ${T.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, fontFamily: "'Cairo', sans-serif" }}>{isAr ? 'جاري تحميل البيانات...' : 'Loading chart data...'}</div>
                    </div>
                  )}
                  {/* Strategy Cards */}
                  {STRATEGIES.map(strat => (
                    <button key={strat.key} onClick={strat.toggle} style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
                      borderRadius: 14, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s ease',
                      background: strat.active ? `linear-gradient(135deg, ${strat.color}10, ${strat.color}05)` : T.card,
                      border: `1px solid ${strat.active ? `${strat.color}30` : T.border}`,
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: strat.active ? `${strat.color}18` : T.bg2, border: `1px solid ${strat.active ? `${strat.color}25` : T.border}`,
                        fontSize: 24, transition: 'all 0.15s ease',
                      }}>{strat.icon}</div>
                      <div style={{ flex: 1, textAlign: isAr ? 'right' : 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: strat.active ? strat.color : T.textPrimary, fontFamily: "'Cairo', sans-serif" }}>{strat.label}</div>
                        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif", marginTop: 2 }}>{strat.desc}</div>
                        {strat.active && (
                          <span style={{ marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, background: `${strat.color}15`, color: strat.color, border: `1px solid ${strat.color}30` }}>{isAr ? '● نشط' : '● ACTIVE'}</span>
                        )}
                      </div>
                      {/* Toggle Switch */}
                      <div style={{
                        width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'all 0.3s',
                        background: strat.active ? `${strat.color}30` : T.bg2, border: `1px solid ${strat.active ? `${strat.color}40` : T.border}`,
                      }}>
                        <motion.div animate={{ x: strat.active ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{
                            width: 18, height: 18, borderRadius: 9, position: 'absolute', top: 2,
                            background: strat.active ? strat.color : T.textMuted, boxShadow: strat.active ? `0 0 10px ${strat.color}40` : 'none',
                            transition: 'all 0.2s',
                          }}
                        />
                      </div>
                    </button>
                  ))}
                  {/* Strategy Info */}
                  <div style={{ marginTop: 10, padding: 14, borderRadius: 14, background: T.card, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, fontFamily: "'Cairo', sans-serif", marginBottom: 8 }}>{isAr ? '⚡ كيف تعمل الاستراتيجيات' : '⚡ How Strategies Work'}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Cairo', sans-serif", lineHeight: 1.8 }}>
                      {isAr
                        ? '• عند تفعيل استراتيجية، يتم تحليل البيانات تلقائياً وعرض إشارة شراء أو بيع على الرسم البياني\n• يظهر وقف الخسارة و3 أهداف ربح على الشارت\n• الاستراتيجية تعمل بشكل مستمر وتحدث الإشارات تلقائياً\n• يمكنك تفعيل استراتيجية واحدة فقط في كل مرة'
                        : '• When a strategy is activated, it automatically analyzes data and displays a BUY or SELL signal on the chart\n• Stop loss and 3 profit targets are shown on the chart\n• The strategy runs continuously and updates signals automatically\n• Only one strategy can be active at a time'
                      }
                    </div>
                  </div>
                </div>
              </FullPanel>
              <FullPanel isOpen={showDrawPanel} onClose={() => { setShowDrawPanel(false); setActiveDrawTool(null) }} title={isAr ? 'أدوات الرسم' : 'Drawing Tools'} isAr={isAr}>
                {DRAW_TOOLS.map(tool => (
                  <DrawToolItem key={tool.key} label={tool.label} symbol={tool.symbol} color={tool.color} active={activeDrawTool === tool.key} onToggle={() => { setActiveDrawTool(tool.key); setShowDrawPanel(false) }} isAr={isAr} />
                ))}
                {activeDrawTool && (
                  <button onClick={() => { setActiveDrawTool(null); setShowDrawPanel(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 14, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                    {isAr ? 'إلغاء التحديد' : 'Deselect Tool'}
                  </button>
                )}
                {drawings.length > 0 && (
                  <button onClick={() => { setDrawings([]); setShowDrawPanel(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 14, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                    {isAr ? 'مسح الكل' : 'Clear All'} ({drawings.length})
                  </button>
                )}
              </FullPanel>
              {/* Compact order book */}
              <div style={{ padding: '6px 10px', borderTop: `1px solid ${T.border}` }}>
                <button onClick={() => setShowOrderBook(!showOrderBook)} style={{ width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.card, border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                  {isAr ? 'دفتر الأوامر' : 'Order Book'}
                  <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showOrderBook ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                </button>
                <AnimatePresence>
                  {showOrderBook && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderRadius: '0 0 8px 8px', background: T.card }}>
                      <DepthBar />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* Positions summary */}
              {openPositions.length > 0 && (
                <div style={{ padding: '0 10px 6px' }}>
                  <button onClick={() => setShowMobilePositions(!showMobilePositions)} style={{ width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 10, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: totalPnl >= 0 ? T.greenBg : T.redBg, border: `1px solid ${totalPnl >= 0 ? T.greenBorder : T.redBorder}`, color: totalPnl >= 0 ? T.green : T.red, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                    <span>{isAr ? `صفقات (${openPositions.length})` : `Positions (${openPositions.length})`}</span>
                    <span style={{ fontWeight: 900, fontFamily: 'monospace' }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</span>
                  </button>
                  <AnimatePresence>
                    {showMobilePositions && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', paddingTop: 4 }}>
                        {openPositions.map((pos: any) => <PositionCard key={pos.id} pos={pos} />)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
          {mobileTab === 'trade' && (
            <div style={{ padding: 10 }}>
              <DepthBar />
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: `linear-gradient(135deg, ${T.accentBg}, rgba(30,58,138,0.05))`, border: `1px solid ${T.border}` }}>
                  <div><div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted }}>{isAr ? 'الرصيد' : 'Available'}</div><div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: T.accent }}>{fmt(availableForTrade)} USDT</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}`, animation: 'pulse 2s infinite' }} /><span style={{ fontSize: 9, fontWeight: 700, color: T.green }}>LIVE</span></div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOrderSide('BUY')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: 'pointer', background: orderSide === 'BUY' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : T.greenBg, border: `1px solid ${orderSide === 'BUY' ? T.green : T.greenBorder}`, color: orderSide === 'BUY' ? '#fff' : T.green, boxShadow: orderSide === 'BUY' ? `0 4px 16px ${T.greenGlow}` : 'none', transition: 'all 0.25s' }}>{isAr ? 'شراء' : 'BUY'}</motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOrderSide('SELL')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: 'pointer', background: orderSide === 'SELL' ? `linear-gradient(135deg, ${T.red}, ${T.redDark})` : T.redBg, border: `1px solid ${orderSide === 'SELL' ? T.red : T.redBorder}`, color: orderSide === 'SELL' ? '#fff' : T.red, boxShadow: orderSide === 'SELL' ? `0 4px 16px ${T.redGlow}` : 'none', transition: 'all 0.25s' }}>{isAr ? 'بيع' : 'SELL'}</motion.button>
                </div>
                <TradeInput label={isAr ? 'المبلغ' : 'Amount'} value={orderAmount} onChange={v => { setOrderAmount(v); setOrderPercent(0) }} placeholder="0.00" suffixText="USDT" />
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>{[25, 50, 75, 100].map(pct => (<button key={pct} onClick={() => setAmountPercent(pct)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "'Cairo', sans-serif", background: orderPercent === pct ? T.accentBg : T.bg2, border: `1px solid ${orderPercent === pct ? T.accentBorder : T.border}`, color: orderPercent === pct ? T.accent : T.textMuted, cursor: 'pointer' }}>{pct}%</button>))}</div>

                {/* Mobile Leverage Slider */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>{isAr ? 'الرافعة المالية' : 'Leverage'}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, color: T.gold, background: T.goldBg, border: `1px solid ${T.goldBorder}` }}>{leverage}x</span>
                  </div>
                  <input type="range" min={1} max={125} value={leverage} onChange={e => handleLeverageChange(parseInt(e.target.value))}
                    style={{ width: '100%', height: 5, appearance: 'none', background: `linear-gradient(to right, ${T.gold} ${(leverage - 1) / 124 * 100}%, ${T.border} ${(leverage - 1) / 124 * 100}%)`, borderRadius: 3, outline: 'none', cursor: 'pointer' }} />
                  <style>{`
                    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: ${T.gold}; border: 2px solid #fff; cursor: pointer; box-shadow: 0 0 6px ${T.gold}60; }
                    input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: ${T.gold}; border: 2px solid #fff; cursor: pointer; box-shadow: 0 0 6px ${T.gold}60; }
                  `}</style>
                  <div style={{ display: 'flex', gap: 3, marginTop: 4, overflowX: 'auto' }} className="scrollbar-none">{[1, 5, 10, 25, 50, 75, 100, 125].map(lev => (<button key={lev} onClick={() => handleLeverageChange(lev)} style={{ flex: 1, padding: '3px 0', borderRadius: 5, fontSize: 8, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', background: leverage === lev ? T.goldBg : 'transparent', border: `1px solid ${leverage === lev ? T.goldBorder : T.border}`, color: leverage === lev ? T.gold : T.textMuted, cursor: 'pointer' }}>{lev}x</button>))}</div>
                </div>

                {/* Mobile SL/TP */}
                <button onClick={() => setShowSlTp(!showSlTp)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", marginBottom: 4, padding: 0 }}>
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showSlTp ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  {isAr ? 'وقف خسارة / أهداف' : 'SL / TP'}
                  {(stopLoss || takeProfit1 || takeProfit2 || takeProfit3) && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}>{[stopLoss, takeProfit1, takeProfit2, takeProfit3].filter(Boolean).length}</span>}
                </button>
                <AnimatePresence>
                  {showSlTp && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.redBorder}`, marginBottom: 4 }}>
                        <span style={{ padding: '0 6px', fontSize: 8, fontWeight: 700, color: T.red, whiteSpace: 'nowrap' }}>{isAr ? 'وقف' : 'SL'}</span>
                        <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 0.98 : currentPrice * 1.02)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: T.red, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.greenBorder}`, marginBottom: 4 }}>
                        <span style={{ padding: '0 6px', fontSize: 8, fontWeight: 700, color: T.green, whiteSpace: 'nowrap' }}>{isAr ? 'هدف١' : 'TP1'}</span>
                        <input type="number" value={takeProfit1} onChange={e => setTakeProfit1(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 1.02 : currentPrice * 0.98)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: T.green, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', background: T.bg2, border: `1px solid rgba(34,211,238,0.18)`, marginBottom: 4 }}>
                        <span style={{ padding: '0 6px', fontSize: 8, fontWeight: 700, color: '#22d3ee', whiteSpace: 'nowrap' }}>{isAr ? 'هدف٢' : 'TP2'}</span>
                        <input type="number" value={takeProfit2} onChange={e => setTakeProfit2(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 1.05 : currentPrice * 0.95)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: '#22d3ee', fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', background: T.bg2, border: `1px solid rgba(167,139,250,0.18)`, marginBottom: 8 }}>
                        <span style={{ padding: '0 6px', fontSize: 8, fontWeight: 700, color: '#a78bfa', whiteSpace: 'nowrap' }}>{isAr ? 'هدف٣' : 'TP3'}</span>
                        <input type="number" value={takeProfit3} onChange={e => setTakeProfit3(e.target.value)} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={fmtPrice(orderSide === 'BUY' ? currentPrice * 1.10 : currentPrice * 0.90)} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button whileTap={{ scale: 0.98 }} onClick={executeOrder} disabled={submitting} style={{ width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 13, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer', background: orderSide === 'BUY' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : `linear-gradient(135deg, ${T.red}, ${T.redDark})`, color: '#fff', opacity: submitting ? 0.6 : 1, boxShadow: `0 4px 20px ${orderSide === 'BUY' ? T.greenGlow : T.redGlow}`, border: 'none', transition: 'all 0.25s' }}>
                  {submitting ? '...' : (isAr ? (orderSide === 'BUY' ? 'شراء' : 'بيع') : (orderSide === 'BUY' ? 'BUY' : 'SELL'))} {selectedPair.label.replace('/USDT', '')}
                </motion.button>
              </div>
            </div>
          )}
          {mobileTab === 'positions' && (
            <div style={{ padding: 10 }}>
              <div style={{ display: 'flex', marginBottom: 8, borderRadius: 10, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.border}` }}>
                {[{ k: 'open' as const, l: isAr ? 'مفتوحة' : 'Open' }, { k: 'closed' as const, l: isAr ? 'مغلقة' : 'Closed' }, ...(hasActivePackage ? [{ k: 'package' as const, l: isAr ? 'باقة' : 'Pkg' }] : [])].map(tab => (
                  <button key={tab.k} onClick={() => setPositionTab(tab.k)} style={{ flex: 1, padding: '8px 0', fontSize: 10, fontWeight: 700, fontFamily: "'Cairo', sans-serif", background: positionTab === tab.k ? T.accentBg : 'transparent', color: positionTab === tab.k ? T.accent : T.textMuted, border: 'none', borderBottom: positionTab === tab.k ? `2px solid ${T.accent}` : '2px solid transparent', cursor: 'pointer' }}>{tab.l}</button>
                ))}
              </div>
              {totalPnl !== 0 && positionTab === 'open' && openPositions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, marginBottom: 8, background: totalPnl >= 0 ? T.greenBg : T.redBg, border: `1px solid ${totalPnl >= 0 ? T.greenBorder : T.redBorder}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: totalPnl >= 0 ? T.green : T.red }}>{isAr ? 'إجمالي' : 'Total'}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: totalPnl >= 0 ? T.green : T.red }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</span>
                </div>
              )}
              {(positionTab === 'open' ? openPositions : positionTab === 'closed' ? closedPositions : packageTrades).length === 0
                ? <div style={{ padding: '30px 0', textAlign: 'center', color: T.textMuted, fontSize: 11 }}>{isAr ? 'لا توجد صفقات' : 'No positions'}</div>
                : (positionTab === 'open' ? openPositions : positionTab === 'closed' ? closedPositions : packageTrades).map((pos: any) => <PositionCard key={pos.id} pos={pos} />)}
            </div>
          )}
        </div>

        {/* Mobile Bottom Trading (chart tab) */}
        {mobileTab === 'chart' && (
          <div style={{ position: 'fixed', bottom: 52, left: 0, right: 0, zIndex: 40, background: `linear-gradient(135deg, ${T.glass}, rgba(10,18,40,0.95))`, backdropFilter: 'blur(24px)', borderTop: `1px solid ${T.borderLight}`, padding: '8px 10px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOrderSide('BUY')} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: 'pointer', background: orderSide === 'BUY' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : T.greenBg, border: `1px solid ${orderSide === 'BUY' ? T.green : T.greenBorder}`, color: orderSide === 'BUY' ? '#fff' : T.green, boxShadow: orderSide === 'BUY' ? `0 2px 12px ${T.greenGlow}` : 'none', transition: 'all 0.25s' }}>{isAr ? 'شراء' : 'BUY'}</motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOrderSide('SELL')} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: 'pointer', background: orderSide === 'SELL' ? `linear-gradient(135deg, ${T.red}, ${T.redDark})` : T.redBg, border: `1px solid ${orderSide === 'SELL' ? T.red : T.redBorder}`, color: orderSide === 'SELL' ? '#fff' : T.red, boxShadow: orderSide === 'SELL' ? `0 2px 12px ${T.redGlow}` : 'none', transition: 'all 0.25s' }}>{isAr ? 'بيع' : 'SELL'}</motion.button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', background: T.bg2, border: `1px solid ${T.border}` }}>
                <input type="number" value={orderAmount} onChange={e => { setOrderAmount(e.target.value); setOrderPercent(0) }} onFocus={() => { isInputFocusedRef.current = true }} onBlur={() => { isInputFocusedRef.current = false }} placeholder={isAr ? 'المبلغ' : 'Amount'} dir="ltr" style={{ flex: 1, background: 'transparent', border: 'none', padding: '7px 10px', fontSize: 12, fontWeight: 700, color: T.textPrimary, fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                <span style={{ padding: '0 8px', fontSize: 9, fontWeight: 600, color: T.textMuted }}>USDT</span>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={executeOrder} disabled={submitting} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 900, fontFamily: "'Cairo', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer', background: orderSide === 'BUY' ? `linear-gradient(135deg, ${T.green}, ${T.greenDark})` : `linear-gradient(135deg, ${T.red}, ${T.redDark})`, color: '#fff', opacity: submitting ? 0.6 : 1, boxShadow: `0 2px 12px ${orderSide === 'BUY' ? T.greenGlow : T.redGlow}`, border: 'none' }}>
                {submitting ? '...' : (orderSide === 'BUY' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL'))}
              </motion.button>
            </div>
          </div>
        )}

        {/* Mobile Bottom Nav */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', zIndex: 50, background: `linear-gradient(135deg, ${T.glass}, rgba(10,18,40,0.95))`, backdropFilter: 'blur(24px)', borderTop: `1px solid ${T.borderLight}` }}>
          {[
            { k: 'chart' as const, l: isAr ? 'الرسم' : 'Chart', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg> },
            { k: 'trade' as const, l: isAr ? 'تداول' : 'Trade', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l6-4 6 4" /><path d="M9 3v12" /><path d="M21 17l-6 4-6-4" /><path d="M15 21V9" /></svg> },
            { k: 'positions' as const, l: isAr ? 'صفقات' : 'Positions', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg> },
          ].map(tab => (
            <button key={tab.k} onClick={() => setMobileTab(tab.k)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0', color: mobileTab === tab.k ? T.accent : T.textMuted, background: mobileTab === tab.k ? T.accentBg : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
              {tab.ic}
              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{tab.l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TradingPage
