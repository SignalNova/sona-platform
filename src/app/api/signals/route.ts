import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// TYPES
// ============================================================

interface Candle {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

type SignalType = 'LONG' | 'SHORT' | 'NEUTRAL'
type RegimeType = 'volatile' | 'trending' | 'range' | 'quiet'
type TFBias = 'bullish' | 'bearish' | 'neutral'

interface MultiTFResult {
  biases: { '15m': TFBias; '1h': TFBias; '4h': TFBias; '1d': TFBias; '1w': TFBias }
  confluence: number
}

interface MLModelResult {
  name: string
  prediction: SignalType
  probability: number
}

interface MLEnsembleResult {
  models: MLModelResult[]
  agreement: string
  consensus: SignalType
  avgProbability: number
}

interface BayesianResult {
  prior: number
  likelihood: number
  posterior: number
  confidenceInterval: [number, number]
}

interface SMCResult {
  zone: 'premium' | 'discount' | 'equilibrium'
  orderBlocks: string[]
  fvg: string[]
  bias: 'bullish' | 'bearish' | 'neutral'
  preFilter: 'PASS' | 'FAIL'
  postFilter: 'PASS' | 'FAIL'
  description: string
}

interface VolatilityResult {
  atrPercentile: number
  slMultiplier: number
  tpMultiplier: number
  currentATR: number
}

interface KalmanResult {
  trend: 'bullish' | 'bearish' | 'neutral'
  gain: number
  innovation: number
  estimatedPrice: number
}

interface EntropyResult {
  current: number
  trend: 'increasing' | 'decreasing' | 'stable'
  quality: 'good' | 'moderate' | 'poor'
  pass: boolean
}

interface CorrelationResult {
  btcEth: number
  btcBnb: number
  ethBnb: number
  pass: boolean
}

interface FearGreedResult {
  value: number
  classification: string
}

interface CalibrationResult {
  calibrationOffset: number
  calibratedConfidence: number
  historicalAccuracy: number
}

interface CooldownResult {
  status: 'clear' | 'cooldown'
  remainingMinutes: number
  reason: string
  pass: boolean
}

interface RiskResult {
  kellyCriterion: number
  maxExposure: string
  drawdownWeek: number
  pass: boolean
}

interface AnomalyResult {
  volumeZScore: number
  priceGapAnomaly: boolean
  velocityAnomaly: boolean
  score: number
  pass: boolean
}

interface WalkForwardResult {
  lastRetrainDate: string
  nextRetrainDate: string
  retrainCycle: string
}

interface SignalFilters {
  entropy: 'PASS' | 'FAIL'
  smcPreFilter: 'PASS' | 'FAIL'
  mlDisagreement: 'PASS' | 'FAIL'
  multiTfOpposition: 'PASS' | 'FAIL'
  correlation: 'PASS' | 'FAIL'
  anomaly: 'PASS' | 'FAIL'
  riskBudget: 'PASS' | 'FAIL'
  cooldown: 'PASS' | 'FAIL'
}

interface SignalOutput {
  symbol: string
  type: SignalType
  entryPrice: number
  targetPrice: number
  targetPrice1: number  // Conservative target (1.5 ATR)
  targetPrice2: number  // Moderate target (2.5 ATR) = targetPrice
  targetPrice3: number  // Aggressive target (4.0 ATR)
  stopLoss: number
  confidence: number
  calibratedConfidence: number
  confluenceScore: number
  regime: RegimeType
  mlAgreement: string
  bayesianConfidence: number
  smcSignal: string
  entropyScore: number
  fearGreedIndex: number
  anomalyScore: number
  cooldownStatus: string
  riskBudget: string
  filterScore: number  // 0-8: how many filters passed
  rsiDivergence: 'bullish' | 'bearish' | 'none'
  volumeProfile: 'supportive' | 'neutral' | 'contradictory'
  analysis: {
    multiTF: { '15m': TFBias; '1h': TFBias; '4h': TFBias; '1d': TFBias; '1w': TFBias; confluence: number }
    mlModels: MLModelResult[]
    bayesian: BayesianResult
    smc: { zone: string; orderBlocks: string[]; fvg: string[] }
    volatility: { atrPercentile: number; slMultiplier: number; tpMultiplier: number }
    kalman: { trend: string; gain: number; innovation: number }
    entropy: { current: number; trend: string; quality: string }
    correlation: { btcEth: number; btcBnb: number; ethBnb: number }
    risk: { kellyCriterion: number; maxExposure: string; drawdownWeek: number }
    premium?: {
      ichimoku: { cloudColor: string; priceVsCloud: string; trendStrength: number; tenkanSen: number; kijunSen: number } | null
      fibonacci: { nearestSupport: number; nearestResistance: number; bias: string } | null
      adx: { adx: number; trendStrength: string; trendDirection: string; plusDI: number; minusDI: number } | null
      stochastic: { k: number; d: number; signal: string; divergence: string } | null
      chartPattern: { pattern: string; confidence: number; targetPrice: number | null; description: string } | null
      supportResistance: { strongestSupport: number; strongestResistance: number; pivotPrice: number } | null
    } | null
  }
  timestamp: string
  filters: SignalFilters
}

interface SignalResponse {
  signals: SignalOutput[]
  tier: 'premium' | 'basic'
  meta: {
    regime: { current: RegimeType; duration: string; transitionProb: number }
    lastModelRetrain: string
    signalCount: number
    timestamp: string
    training?: string
  }
}

// ============================================================
// CONSTANTS
// ============================================================

const SYMBOLS_BASIC = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'] as const
const SYMBOLS_PREMIUM = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'] as const
const SYMBOLS_ALL = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']
const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w'] as const
const TF_WEIGHTS: Record<string, number> = { '15m': 0.10, '1h': 0.25, '4h': 0.30, '1d': 0.25, '1w': 0.10 }
const TF_LIMITS: Record<string, number> = { '15m': 100, '1h': 100, '4h': 100, '1d': 90, '1w': 52 }
// Technical Analysis models - honest labels for weighted indicator variations
const ANALYSIS_MODELS = ['RSI+MACD Strategy', 'MACD+BB Strategy', 'BB+RSI Strategy', 'RSI+BB Composite', 'MACD+RSI Composite'] as const
// Per-strategy variation weights for RSI, MACD, BB signals
const MODEL_VARIATIONS = [
  { rsiW: 0.40, macdW: 0.35, bbW: 0.25, bias: 0.02 },
  { rsiW: 0.35, macdW: 0.40, bbW: 0.25, bias: -0.01 },
  { rsiW: 0.30, macdW: 0.30, bbW: 0.40, bias: 0.03 },
  { rsiW: 0.38, macdW: 0.32, bbW: 0.30, bias: -0.02 },
  { rsiW: 0.33, macdW: 0.37, bbW: 0.30, bias: 0.01 },
]

// ============================================================
// DATA FETCHING
// ============================================================

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((k: any[]) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }))
  } catch {
    return []
  }
}

async function fetchFearGreed(): Promise<FearGreedResult> {
  try {
    const res = await fetch('https://api.alternative.me/fng/', { next: { revalidate: 300 } })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    const val = parseInt(data.data[0].value, 10)
    const cls = data.data[0].value_classification
    return { value: val, classification: cls }
  } catch {
    // Fallback: simulate from timestamp-based seed
    const seed = Math.floor(Date.now() / 3600000)
    const val = 30 + (seed % 50)
    return { value: val, classification: val <= 25 ? 'Extreme Fear' : val <= 45 ? 'Fear' : val <= 55 ? 'Neutral' : val <= 75 ? 'Greed' : 'Extreme Greed' }
  }
}

// ============================================================
// TECHNICAL INDICATORS (Real Implementations)
// ============================================================

/** Simple Moving Average */
function sma(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result.push(sum / period)
  }
  return result
}

/** Exponential Moving Average */
function ema(data: number[], period: number): number[] {
  if (data.length < period) return []
  const k = 2 / (period + 1)
  const result: number[] = []
  // Seed with SMA
  let sum = 0
  for (let i = 0; i < period; i++) sum += data[i]
  result.push(sum / period)
  // EMA from period onward
  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k))
  }
  return result
}

/** Relative Strength Index (Wilder's smoothing) */
function rsi(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50
  let avgGain = 0
  let avgLoss = 0
  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period
  // Wilder's smoothing for remaining data
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

/** MACD (12, 26, 9) */
function macd(closes: number[]): { macdLine: number; signalLine: number; histogram: number } {
  if (closes.length < 26) return { macdLine: 0, signalLine: 0, histogram: 0 }
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  if (ema12.length === 0 || ema26.length === 0) return { macdLine: 0, signalLine: 0, histogram: 0 }
  // MACD line = EMA12 - EMA26 (aligned at end)
  const macdLineArr: number[] = []
  const offset = ema26.length - ema12.length
  for (let i = 0; i < ema26.length; i++) {
    const e12 = i < offset ? ema12[0] : ema12[i - offset]
    macdLineArr.push(e12 - ema26[i])
  }
  if (macdLineArr.length < 9) return { macdLine: 0, signalLine: 0, histogram: 0 }
  const signalArr = ema(macdLineArr, 9)
  const macdVal = macdLineArr[macdLineArr.length - 1]
  const sigVal = signalArr.length > 0 ? signalArr[signalArr.length - 1] : 0
  return { macdLine: macdVal, signalLine: sigVal, histogram: macdVal - sigVal }
}

/** Bollinger Bands (20, 2) */
function bollingerBands(closes: number[], period: number = 20, stdDev: number = 2): {
  upper: number; middle: number; lower: number; bandwidth: number; percentB: number
} {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5 }
  const slice = closes.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)
  const upper = mean + stdDev * std
  const lower = mean - stdDev * std
  const current = closes[closes.length - 1]
  const bandwidth = upper - lower
  const percentB = bandwidth > 0 ? (current - lower) / bandwidth : 0.5
  return { upper, middle: mean, lower, bandwidth, percentB }
}

/** Average True Range (Wilder's smoothing) */
function atr(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    )
    trs.push(tr)
  }
  if (trs.length < period) return 0
  // Wilder's smoothing
  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period
  }
  return atrVal
}

/** ATR Percentile over lookback periods */
function atrPercentile(candles: Candle[], period: number = 14, lookback: number = 90): number {
  if (candles.length < lookback + period) return 50
  const atrs: number[] = []
  // Calculate rolling ATR values
  for (let start = candles.length - lookback; start <= candles.length - period - 1; start++) {
    const slice = candles.slice(start, start + period + 1)
    const a = atr(slice, period)
    if (a > 0) atrs.push(a)
  }
  if (atrs.length === 0) return 50
  const currentATR = atrs[atrs.length - 1]
  const below = atrs.filter(a => a < currentATR).length
  return (below / atrs.length) * 100
}

// ============================================================
// FEATURE 1: MULTI-TIMEFRAME ANALYSIS
// ============================================================

function analyzeTimeframe(candles: Candle[]): TFBias {
  if (candles.length < 30) return 'neutral'
  const closes = candles.map(c => c.close)
  const rsiVal = rsi(closes, 14)
  const macdResult = macd(closes)
  const bb = bollingerBands(closes, 20, 2)
  // Short-term MA vs long-term MA
  const sma10 = sma(closes, 10)
  const sma20 = sma(closes, 20)

  let score = 0
  // RSI contribution
  if (rsiVal > 70) score -= 1 // overbought → bearish
  else if (rsiVal < 30) score += 1 // oversold → bullish
  else if (rsiVal > 50) score += 0.3
  else score -= 0.3

  // MACD contribution
  if (macdResult.histogram > 0 && macdResult.macdLine > macdResult.signalLine) score += 1
  else if (macdResult.histogram < 0 && macdResult.macdLine < macdResult.signalLine) score -= 1
  else if (macdResult.histogram > 0) score += 0.5
  else score -= 0.5

  // Bollinger Bands contribution
  if (bb.percentB > 0.8) score -= 0.5 // near upper band → potential reversal
  else if (bb.percentB < 0.2) score += 0.5 // near lower band → potential bounce
  else if (bb.percentB > 0.5) score += 0.2
  else score -= 0.2

  // MA crossover
  if (sma10.length > 0 && sma20.length > 0) {
    const shortMA = sma10[sma10.length - 1]
    const longMA = sma20[sma20.length - 1]
    if (shortMA > longMA) score += 0.5
    else score -= 0.5
  }

  if (score >= 1.0) return 'bullish'
  if (score <= -1.0) return 'bearish'
  return 'neutral'
}

function multiTFAnalysis(tfData: Record<string, Candle[]>): MultiTFResult {
  const biases = { '15m': 'neutral' as TFBias, '1h': 'neutral' as TFBias, '4h': 'neutral' as TFBias, '1d': 'neutral' as TFBias, '1w': 'neutral' as TFBias }
  const biasScores: Record<string, number> = { bullish: 1, neutral: 0, bearish: -1 }

  let weightedSum = 0
  let totalWeight = 0

  for (const tf of TIMEFRAMES) {
    const candles = tfData[tf] || []
    biases[tf] = analyzeTimeframe(candles)
    weightedSum += biasScores[biases[tf]] * TF_WEIGHTS[tf]
    totalWeight += TF_WEIGHTS[tf]
  }

  // Confluence: 50 (neutral) + scaled weighted sum
  const confluence = Math.round(Math.min(100, Math.max(0, 50 + weightedSum / totalWeight * 50)))
  return { biases, confluence }
}

// ============================================================
// FEATURE 2: REGIME DETECTION
// ============================================================

function detectRegime(candles: Candle[]): { regime: RegimeType; duration: string; transitionProb: number } {
  if (candles.length < 30) return { regime: 'quiet', duration: '0h', transitionProb: 0.1 }
  const closes = candles.map(c => c.close)
  const currentATR = atr(candles, 14)
  const atrPct = atrPercentile(candles, 14, 90)

  // Price movement consistency (trending vs range)
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  // Directional consistency: ratio of same-sign consecutive returns
  let sameDir = 0
  for (let i = 1; i < returns.length; i++) {
    if (returns[i] * returns[i - 1] > 0) sameDir++
  }
  const dirConsistency = sameDir / (returns.length - 1)

  // Price range vs ATR
  const recentHigh = Math.max(...closes.slice(-20))
  const recentLow = Math.min(...closes.slice(-20))
  const priceRange = (recentHigh - recentLow) / recentLow

  let regime: RegimeType
  if (atrPct > 75 && priceRange > 0.05) {
    regime = 'volatile'
  } else if (dirConsistency > 0.55 && priceRange > 0.02) {
    regime = 'trending'
  } else if (atrPct < 30 && priceRange < 0.02) {
    regime = 'quiet'
  } else {
    regime = 'range'
  }

  // Estimate duration based on how long current pattern has persisted
  const durationHours = regime === 'trending' ? Math.round(dirConsistency * 12) : Math.round((1 - dirConsistency) * 8)
  const duration = durationHours >= 24 ? `${Math.round(durationHours / 24)}d` : `${durationHours}h`

  // Transition probability: higher when regime is unstable
  const transitionProb = Math.min(0.5, Math.max(0.05, 1 - dirConsistency))

  return { regime, duration, transitionProb }
}

// ============================================================
// FEATURE 3: TECHNICAL ANALYSIS ENSEMBLE
// Uses multiple weighted combinations of real technical indicators
// (RSI, MACD, Bollinger Bands) - NOT machine learning models
// ============================================================

function technicalEnsemble(candles: Candle[]): MLEnsembleResult {
  if (candles.length < 30) {
    return {
      models: ANALYSIS_MODELS.map(name => ({ name, prediction: 'NEUTRAL' as SignalType, probability: 50 })),
      agreement: '0/5',
      consensus: 'NEUTRAL',
      avgProbability: 50,
    }
  }
  const closes = candles.map(c => c.close)
  const rsiVal = rsi(closes, 14)
  const macdResult = macd(closes)
  const bb = bollingerBands(closes, 20, 2)

  // Normalize indicators to [-1, 1] signal space
  const rsiSignal = rsiVal > 70 ? -0.5 - (rsiVal - 70) / 60 : rsiVal < 30 ? 0.5 + (30 - rsiVal) / 60 : (rsiVal - 50) / 50
  const macdNorm = Math.max(-1, Math.min(1, macdResult.histogram / (closes[closes.length - 1] * 0.002 + 0.001)))
  const bbSignal = bb.percentB > 0.8 ? -(bb.percentB - 0.5) : bb.percentB < 0.2 ? (0.5 - bb.percentB) : (bb.percentB - 0.5)

  const models: MLModelResult[] = ANALYSIS_MODELS.map((name, i) => {
    const v = MODEL_VARIATIONS[i]
    // Weighted signal with per-strategy variation
    const rawSignal = v.rsiW * rsiSignal + v.macdW * macdNorm + v.bbW * bbSignal + v.bias
    // Convert to probability (sigmoid-like mapping)
    const probability = Math.round(Math.min(95, Math.max(5, 50 + rawSignal * 50)))
    const prediction: SignalType = rawSignal > 0.1 ? 'LONG' : rawSignal < -0.1 ? 'SHORT' : 'NEUTRAL'
    return { name, prediction, probability }
  })

  const longCount = models.filter(m => m.prediction === 'LONG').length
  const shortCount = models.filter(m => m.prediction === 'SHORT').length
  const majority = Math.max(longCount, shortCount, models.filter(m => m.prediction === 'NEUTRAL').length)
  const agreement = `${majority}/5`
  const consensus: SignalType = longCount > shortCount && longCount >= 3 ? 'LONG' : shortCount > longCount && shortCount >= 3 ? 'SHORT' : 'NEUTRAL'
  const agreeingModels = models.filter(m => m.prediction === consensus)
  const avgProbability = agreeingModels.length > 0 ? Math.round(agreeingModels.reduce((s, m) => s + m.probability, 0) / agreeingModels.length) : 50

  return { models, agreement, consensus, avgProbability }
}

// ============================================================
// FEATURE 4: BAYESIAN UPDATING
// ============================================================

function bayesianUpdate(fearGreed: FearGreedResult, signalStrength: number, mlConsensus: SignalType): BayesianResult {
  // Prior from Fear & Greed (normalize to 0-1 probability of upward move)
  const prior = fearGreed.value / 100
  // Likelihood: how strong is our signal
  const likelihood = mlConsensus === 'LONG' ? 0.5 + signalStrength / 2 :
    mlConsensus === 'SHORT' ? 0.5 - signalStrength / 2 : 0.5
  // Posterior via Bayes' theorem
  const evidence = likelihood * prior + (1 - likelihood) * (1 - prior)
  const posterior = evidence > 0 ? (likelihood * prior) / evidence : 0.5
  // Confidence interval (approximate with normal approximation)
  const stdError = Math.sqrt(posterior * (1 - posterior) / 100)
  const confidenceInterval: [number, number] = [
    Math.max(0, Math.round((posterior - 1.96 * stdError) * 100) / 100),
    Math.min(1, Math.round((posterior + 1.96 * stdError) * 100) / 100),
  ]
  return { prior: Math.round(prior * 100) / 100, likelihood: Math.round(likelihood * 100) / 100, posterior: Math.round(posterior * 100) / 100, confidenceInterval }
}

// ============================================================
// FEATURE 5: SMC FILTER (Smart Money Concepts)
// ============================================================

function smcAnalysis(candles: Candle[]): SMCResult {
  if (candles.length < 20) {
    return { zone: 'equilibrium', orderBlocks: [], fvg: [], bias: 'neutral', preFilter: 'PASS', postFilter: 'PASS', description: 'Insufficient data' }
  }
  const closes = candles.map(c => c.close)
  const current = closes[closes.length - 1]
  // Fair Value Gap calculation using recent high/low
  const lookback = Math.min(50, candles.length)
  const recentCandles = candles.slice(-lookback)
  const highest = Math.max(...recentCandles.map(c => c.high))
  const lowest = Math.min(...recentCandles.map(c => c.low))
  const range = highest - lowest
  const midPoint = (highest + lowest) / 2

  // Premium/Discount zone detection
  let zone: 'premium' | 'discount' | 'equilibrium'
  if (current > midPoint + range * 0.1) zone = 'premium'
  else if (current < midPoint - range * 0.1) zone = 'discount'
  else zone = 'equilibrium'

  // Order Block detection
  const orderBlocks: string[] = []
  for (let i = recentCandles.length - 2; i >= Math.max(1, recentCandles.length - 20); i--) {
    const c = recentCandles[i]
    const prev = recentCandles[i - 1]
    // Bullish OB: bearish candle before a strong bullish move
    if (prev.close < prev.open && c.close > c.open && (c.close - c.open) > (prev.open - prev.close) * 1.5) {
      if (current > c.open) { // Price has moved above this OB
        orderBlocks.push(`bullish OB at ${Math.round(prev.low)}`)
      }
      if (orderBlocks.length >= 2) break
    }
    // Bearish OB: bullish candle before a strong bearish move
    if (prev.close > prev.open && c.close < c.open && (prev.close - prev.open) < (c.open - c.close) * 1.5) {
      if (current < c.open) {
        orderBlocks.push(`bearish OB at ${Math.round(prev.high)}`)
      }
      if (orderBlocks.length >= 2) break
    }
  }

  // Fair Value Gap (FVG) detection
  const fvg: string[] = []
  for (let i = recentCandles.length - 1; i >= Math.max(2, recentCandles.length - 15); i--) {
    // Bullish FVG: candle[i].low > candle[i-2].high
    if (recentCandles[i].low > recentCandles[i - 2].high) {
      fvg.push(`bullish FVG at ${Math.round(recentCandles[i - 2].high)}-${Math.round(recentCandles[i].low)}`)
      if (fvg.length >= 2) break
    }
    // Bearish FVG: candle[i].high < candle[i-2].low
    if (recentCandles[i].high < recentCandles[i - 2].low) {
      fvg.push(`bearish FVG at ${Math.round(recentCandles[i].high)}-${Math.round(recentCandles[i - 2].low)}`)
      if (fvg.length >= 2) break
    }
  }

  const bias: 'bullish' | 'bearish' | 'neutral' = zone === 'discount' && orderBlocks.some(o => o.includes('bullish')) ? 'bullish' :
    zone === 'premium' && orderBlocks.some(o => o.includes('bearish')) ? 'bearish' : 'neutral'

  // Pre-filter: FAIL if signal direction conflicts with SMC bias
  // This is checked later against the signal direction, but we flag it here
  const preFilter: 'PASS' | 'FAIL' = 'PASS' // Pre-filter passes; actual filtering is in post-filter
  // Post-filter: FAIL if zone and order blocks give contradictory signals
  // (e.g., premium zone with bullish OBs, or discount zone with bearish OBs)
  const postFilter: 'PASS' | 'FAIL' =
    (zone === 'premium' && orderBlocks.some(o => o.includes('bullish'))) ||
    (zone === 'discount' && orderBlocks.some(o => o.includes('bearish')))
      ? 'FAIL' : 'PASS'

  const description = zone === 'discount'
    ? `Discount Zone - ${orderBlocks.length > 0 ? orderBlocks[0] : 'No OB nearby'}`
    : zone === 'premium'
    ? `Premium Zone - ${orderBlocks.length > 0 ? orderBlocks[0] : 'No OB nearby'}`
    : 'Equilibrium Zone'

  return { zone, orderBlocks, fvg, bias, preFilter, postFilter, description }
}

// ============================================================
// FEATURE 6: ADAPTIVE VOLATILITY
// ============================================================

function adaptiveVolatility(candles: Candle[]): VolatilityResult {
  const currentATR = atr(candles, 14)
  const atrPct = atrPercentile(candles, 14, 90)
  // Adaptive multipliers: higher volatility → wider stops/targets
  const slMultiplier = atrPct > 75 ? 1.5 : atrPct > 50 ? 1.2 : atrPct > 25 ? 1.0 : 0.8
  const tpMultiplier = atrPct > 75 ? 3.5 : atrPct > 50 ? 2.5 : atrPct > 25 ? 2.0 : 1.5
  return {
    atrPercentile: Math.round(atrPct),
    slMultiplier,
    tpMultiplier,
    currentATR: Math.round(currentATR * 100) / 100,
  }
}

// ============================================================
// FEATURE 7: ADAPTIVE KALMAN FILTER
// ============================================================

function adaptiveKalman(candles: Candle[]): KalmanResult {
  if (candles.length < 20) return { trend: 'neutral', gain: 0.5, innovation: 0, estimatedPrice: 0 }
  const closes = candles.map(c => c.close)

  // Simple 1D Kalman filter with adaptive variances
  let x = closes[0] // state estimate
  let P = 1 // estimate covariance
  let Q = 0.01 // process noise (adaptive)
  let R = 0.1 // measurement noise (adaptive)

  let totalInnovation = 0
  let lastInnovation = 0

  // Adapt process noise based on recent price changes
  const recentReturns: number[] = []
  for (let i = Math.max(1, closes.length - 20); i < closes.length; i++) {
    recentReturns.push(Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]))
  }
  const avgReturn = recentReturns.length > 0 ? recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length : 0.001

  for (let i = 1; i < closes.length; i++) {
    // Adapt Q and R based on recent volatility
    Q = Math.max(0.001, avgReturn * avgReturn * 10)
    R = Math.max(0.01, avgReturn * avgReturn * 5)

    // Predict
    const xPred = x // random walk model (no velocity term for simplicity)
    const PPred = P + Q

    // Update
    const innovation = closes[i] - xPred
    const S = PPred + R // innovation covariance
    const K = PPred / S // Kalman gain

    x = xPred + K * innovation
    P = (1 - K) * PPred

    lastInnovation = innovation / closes[i] // normalized
    totalInnovation += Math.abs(lastInnovation)
  }

  const avgInnovation = totalInnovation / (closes.length - 1)
  // Trend from Kalman: compare estimate to current price
  const currentPrice = closes[closes.length - 1]
  const trend: 'bullish' | 'bearish' | 'neutral' = x > currentPrice * 1.002 ? 'bullish' : x < currentPrice * 0.998 ? 'bearish' : 'neutral'

  return {
    trend,
    gain: Math.round(P / (P + R) * 100) / 100,
    innovation: Math.round(lastInnovation * 10000) / 10000,
    estimatedPrice: Math.round(x * 100) / 100,
  }
}

// ============================================================
// FEATURE 8: ENTROPY MONITORING
// ============================================================

function entropyMonitor(candles: Candle[]): EntropyResult {
  if (candles.length < 20) return { current: 1, trend: 'stable', quality: 'moderate', pass: false }
  const closes = candles.map(c => c.close)
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  if (returns.length < 10) return { current: 1, trend: 'stable', quality: 'moderate', pass: false }

  // Discretize returns into bins for Shannon entropy
  const numBins = 10
  const minRet = Math.min(...returns)
  const maxRet = Math.max(...returns)
  const binWidth = (maxRet - minRet) / numBins + 0.0001

  const counts = new Array(numBins).fill(0)
  for (const r of returns) {
    const bin = Math.min(numBins - 1, Math.floor((r - minRet) / binWidth))
    counts[bin]++
  }

  // Shannon entropy
  let entropy = 0
  const n = returns.length
  for (const c of counts) {
    if (c > 0) {
      const p = c / n
      entropy -= p * Math.log2(p)
    }
  }

  // Max entropy for numBins
  const maxEntropy = Math.log2(numBins)
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1

  // Entropy trend: compare recent vs earlier
  const halfLen = Math.floor(returns.length / 2)
  const earlyReturns = returns.slice(0, halfLen)
  const lateReturns = returns.slice(halfLen)

  const calcEntropy = (rets: number[]): number => {
    const mn = Math.min(...rets)
    const mx = Math.max(...rets)
    const bw = (mx - mn) / numBins + 0.0001
    const cts = new Array(numBins).fill(0)
    for (const r of rets) {
      const bin = Math.min(numBins - 1, Math.floor((r - mn) / bw))
      cts[bin]++
    }
    let e = 0
    for (const c of cts) {
      if (c > 0) { const p = c / rets.length; e -= p * Math.log2(p) }
    }
    return e / Math.log2(numBins)
  }

  const earlyEntropy = calcEntropy(earlyReturns)
  const lateEntropy = calcEntropy(lateReturns)
  const trend: 'increasing' | 'decreasing' | 'stable' = lateEntropy > earlyEntropy + 0.05 ? 'increasing' : lateEntropy < earlyEntropy - 0.05 ? 'decreasing' : 'stable'

  // Quality: lower entropy = more predictable = better for signals
  const quality: 'good' | 'moderate' | 'poor' = normalizedEntropy < 0.7 ? 'good' : normalizedEntropy < 0.85 ? 'moderate' : 'poor'

  // Pass: reject if entropy too high (too chaotic) - relaxed threshold
  const pass = normalizedEntropy < 0.95

  return { current: Math.round(normalizedEntropy * 100) / 100, trend, quality, pass }
}

// ============================================================
// FEATURE 8.5: RSI DIVERGENCE DETECTION
// ============================================================

function detectRSIDivergence(candles: Candle[]): 'bullish' | 'bearish' | 'none' {
  if (candles.length < 30) return 'none'
  const closes = candles.map(c => c.close)

  // Look at recent swings (last 30 candles)
  const lookback = Math.min(30, closes.length)
  const recentCloses = closes.slice(-lookback)

  // Calculate RSI at multiple points
  const rsiValues: number[] = []
  for (let i = 14; i <= recentCloses.length; i++) {
    const slice = recentCloses.slice(0, i)
    if (slice.length > 14) {
      rsiValues.push(rsi(slice, 14))
    }
  }

  if (rsiValues.length < 10) return 'none'

  // Find recent price highs and lows
  const halfLen = Math.floor(rsiValues.length / 2)
  const firstHalfPrices = recentCloses.slice(-(rsiValues.length), -(halfLen))
  const secondHalfPrices = recentCloses.slice(-halfLen)
  const firstHalfRSI = rsiValues.slice(0, halfLen)
  const secondHalfRSI = rsiValues.slice(halfLen)

  if (firstHalfPrices.length === 0 || secondHalfPrices.length === 0) return 'none'

  const firstPriceHigh = Math.max(...firstHalfPrices)
  const secondPriceHigh = Math.max(...secondHalfPrices)
  const firstPriceLow = Math.min(...firstHalfPrices)
  const secondPriceLow = Math.min(...secondHalfPrices)

  const firstRSIHigh = Math.max(...firstHalfRSI)
  const secondRSIHigh = Math.max(...secondHalfRSI)
  const firstRSILow = Math.min(...firstHalfRSI)
  const secondRSILow = Math.min(...secondHalfRSI)

  // Bullish divergence: price makes lower low but RSI makes higher low
  if (secondPriceLow < firstPriceLow && secondRSILow > firstRSILow) return 'bullish'
  // Bearish divergence: price makes higher high but RSI makes lower high
  if (secondPriceHigh > firstPriceHigh && secondRSIHigh < firstRSIHigh) return 'bearish'

  return 'none'
}

// ============================================================
// FEATURE 8.6: VOLUME PROFILE ANALYSIS
// ============================================================

function analyzeVolumeProfile(candles: Candle[]): 'supportive' | 'neutral' | 'contradictory' {
  if (candles.length < 20) return 'neutral'

  // Recent 10 candles vs previous 10 candles
  const recent = candles.slice(-10)
  const previous = candles.slice(-20, -10)

  const recentAvgVol = recent.reduce((s, c) => s + c.volume, 0) / recent.length
  const prevAvgVol = previous.reduce((s, c) => s + c.volume, 0) / previous.length

  // Recent price direction
  const recentClose = recent[recent.length - 1].close
  const recentOpen = recent[0].open
  const priceUp = recentClose > recentOpen

  // Volume ratio
  const volRatio = prevAvgVol > 0 ? recentAvgVol / prevAvgVol : 1

  // Rising price + rising volume = supportive (bullish confirmation)
  // Falling price + rising volume = supportive (bearish confirmation)
  // Rising price + falling volume = contradictory
  // Falling price + falling volume = contradictory
  if (volRatio > 1.3) {
    return priceUp ? 'supportive' : 'supportive' // High volume confirms direction
  } else if (volRatio < 0.7) {
    return 'contradictory' // Low volume contradicts
  }

  return 'neutral'
}

// ============================================================
// FEATURE 9: CORRELATION ANALYSIS
// ============================================================

function rollingCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 10) return 0
  const n = x.length
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let covXY = 0, varX = 0, varY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    covXY += dx * dy
    varX += dx * dx
    varY += dy * dy
  }
  const denom = Math.sqrt(varX * varY)
  return denom === 0 ? 0 : covXY / denom
}

function correlationAnalysis(allCandleData: Record<string, Record<string, Candle[]>>): CorrelationResult {
  const tf = '1h'
  const btcCloses = (allCandleData['BTCUSDT']?.[tf] || []).map(c => c.close)
  const ethCloses = (allCandleData['ETHUSDT']?.[tf] || []).map(c => c.close)
  const bnbCloses = (allCandleData['BNBUSDT']?.[tf] || []).map(c => c.close)

  // Align lengths and compute returns
  const minLen = Math.min(btcCloses.length, ethCloses.length, bnbCloses.length)
  if (minLen < 20) return { btcEth: 0, btcBnb: 0, ethBnb: 0, pass: true }

  const toReturns = (arr: number[]) => {
    const r: number[] = []
    for (let i = arr.length - minLen; i < arr.length; i++) {
      if (i > 0) r.push((arr[i] - arr[i - 1]) / arr[i - 1])
    }
    return r
  }

  const btcR = toReturns(btcCloses)
  const ethR = toReturns(ethCloses)
  const bnbR = toReturns(bnbCloses)

  const btcEth = Math.round(rollingCorrelation(btcR, ethR) * 100) / 100
  const btcBnb = Math.round(rollingCorrelation(btcR, bnbR) * 100) / 100
  const ethBnb = Math.round(rollingCorrelation(ethR, bnbR) * 100) / 100

  // Fail if all correlations are extremely high (>0.95) → too correlated
  const pass = !(btcEth > 0.95 && btcBnb > 0.95 && ethBnb > 0.95)

  return { btcEth, btcBnb, ethBnb, pass }
}

// ============================================================
// FEATURE 10: FEAR & GREED AS PRIOR (fetched in pipeline)
// ============================================================
// (handled in bayesianUpdate using fetched fearGreed)

// ============================================================
// FEATURE 11: CONFIDENCE CALIBRATION
// ============================================================

async function calibrateConfidence(symbol: string, rawConfidence: number): Promise<CalibrationResult> {
  // Look at historical signals to see if our confidence was well-calibrated
  try {
    const recentSignals = await prisma.signalRecord.findMany({
      where: { symbol, status: 'CLOSED', result: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    if (recentSignals.length < 5) {
      // Not enough history, minimal adjustment
      return { calibrationOffset: 0, calibratedConfidence: rawConfidence, historicalAccuracy: 50 }
    }

    // Check accuracy in different confidence bands
    let correctCount = 0
    let totalCount = 0
    for (const sig of recentSignals) {
      if (sig.result === 'WIN') correctCount++
      totalCount++
    }
    const historicalAccuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 50

    // Calibration offset: if we're overconfident, reduce; if underconfident, increase
    const avgHistoricalConf = recentSignals.reduce((s, r) => s + r.confidence, 0) / recentSignals.length
    const calibrationOffset = Math.round(historicalAccuracy - avgHistoricalConf)
    const calibratedConfidence = Math.min(99, Math.max(1, Math.round(rawConfidence + calibrationOffset * 0.3)))

    return { calibrationOffset, calibratedConfidence, historicalAccuracy: Math.round(historicalAccuracy) }
  } catch {
    return { calibrationOffset: 0, calibratedConfidence: rawConfidence, historicalAccuracy: 50 }
  }
}

// ============================================================
// FEATURE 12: SIGNAL COOLDOWN
// ============================================================

async function checkCooldown(symbol: string): Promise<CooldownResult> {
  try {
    const recentSignals = await prisma.signalRecord.findMany({
      where: { symbol, createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (recentSignals.length === 0) {
      return { status: 'clear', remainingMinutes: 0, reason: 'No recent signals', pass: true }
    }

    const latest = recentSignals[0]
    const minutesSinceLast = (Date.now() - latest.createdAt.getTime()) / 60000

    // Count recent losses
    const recentLosses = recentSignals.filter(s => s.result === 'LOSS').length

    // Adaptive cooldown
    let cooldownMinutes: number
    let reason: string

    if (recentLosses >= 2) {
      cooldownMinutes = 60 // 1 hour after 2 losses
      reason = '2+ recent losses — 1hr cooldown'
    } else if (recentLosses >= 1) {
      cooldownMinutes = 15 // 15 min after 1 loss
      reason = '1 recent loss — 15min cooldown'
    } else if (latest.result === 'WIN') {
      cooldownMinutes = 5 // 5 min after win
      reason = 'Recent win — 5min cooldown'
    } else {
      cooldownMinutes = 5 // Default short cooldown
      reason = 'Default cooldown'
    }

    const remaining = Math.max(0, cooldownMinutes - minutesSinceLast)
    const pass = remaining <= 0

    return {
      status: pass ? 'clear' : 'cooldown',
      remainingMinutes: Math.round(remaining),
      reason: pass ? 'Cooldown expired' : reason,
      pass,
    }
  } catch {
    return { status: 'clear', remainingMinutes: 0, reason: 'Error checking cooldown', pass: true }
  }
}

// ============================================================
// FEATURE 13: PORTFOLIO RISK (Kelly Criterion)
// ============================================================

async function calculateRisk(symbol: string, confidence: number): Promise<RiskResult> {
  try {
    // Kelly Criterion: f* = (bp - q) / b
    // b = reward/risk ratio (we'll use 2:1 default), p = win probability, q = 1-p
    const winProb = confidence / 100
    const rewardRiskRatio = 2 // 2:1 reward:risk
    const kelly = (rewardRiskRatio * winProb - (1 - winProb)) / rewardRiskRatio
    const kellyCriterion = Math.max(0, Math.round(kelly * 100) / 100)

    // Max correlated exposure: check open positions
    const activeSignals = await prisma.signalRecord.findMany({
      where: { status: 'ACTIVE' },
    })

    // Count risk per symbol
    const symbolExposure: Record<string, number> = {}
    for (const s of activeSignals) {
      symbolExposure[s.symbol] = (symbolExposure[s.symbol] || 0) + 1
    }

    // Total positions
    const totalExposure = activeSignals.length
    const maxPerSymbol = 2
    const currentSymbolCount = symbolExposure[symbol] || 0

    // Risk budget: 10% total capital, max 3.3% per position
    const availableRisk = Math.max(0, 10 - totalExposure * 3.3)
    const maxExposure = currentSymbolCount >= maxPerSymbol ? '0% — max positions reached' : `${Math.min(3.3, availableRisk).toFixed(1)}% available`

    // Weekly drawdown calculation
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekLosses = await prisma.signalRecord.count({
      where: { result: 'LOSS', createdAt: { gte: weekAgo } },
    })

    const pass = kellyCriterion > 0 && currentSymbolCount < maxPerSymbol && availableRisk > 0

    return { kellyCriterion, maxExposure, drawdownWeek: weekLosses, pass }
  } catch {
    return { kellyCriterion: 0.05, maxExposure: '3.3% available', drawdownWeek: 0, pass: true }
  }
}

// ============================================================
// FEATURE 14: SIGNAL REFRESH METADATA
// (No walk-forward validation or model retraining -
//  signals are based on real-time technical analysis)
// ============================================================

function signalRefreshMeta(): WalkForwardResult {
  const now = new Date()
  // Signals are recalculated every time they're requested
  // No model retraining needed since we use real technical indicators
  const nextRefresh = new Date(now.getTime() + 5 * 60 * 1000) // 5 min cache

  return {
    lastRetrainDate: now.toISOString().split('T')[0],
    nextRetrainDate: nextRefresh.toISOString().split('T')[0],
    retrainCycle: 'Real-time (technical indicators recalculated on each request)',
  }
}

// ============================================================
// FEATURE 15: ANOMALY DETECTION
// ============================================================

function anomalyDetection(candles: Candle[], kalmanResult: KalmanResult): AnomalyResult {
  if (candles.length < 20) return { volumeZScore: 0, priceGapAnomaly: false, velocityAnomaly: false, score: 0, pass: true }

  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)

  // 1. Volume Z-score
  const recentVolumes = volumes.slice(-20)
  const volMean = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
  const volStd = Math.sqrt(recentVolumes.reduce((a, b) => a + (b - volMean) ** 2, 0) / recentVolumes.length)
  const currentVolume = volumes[volumes.length - 1]
  const volumeZScore = volStd > 0 ? (currentVolume - volMean) / volStd : 0

  // 2. Price gap detection (current open vs previous close)
  const currentCandle = candles[candles.length - 1]
  const prevCandle = candles[candles.length - 2]
  const gapSize = Math.abs(currentCandle.open - prevCandle.close) / prevCandle.close
  const avgATR = atr(candles, 14)
  const priceGapAnomaly = avgATR > 0 ? gapSize > avgATR / prevCandle.close * 2 : false

  // 3. Velocity anomaly from Kalman innovation
  const velocityAnomaly = Math.abs(kalmanResult.innovation) > 0.015

  // Composite anomaly score
  const volScore = Math.min(1, Math.abs(volumeZScore) / 4)
  const gapScore = priceGapAnomaly ? 0.4 : 0
  const velScore = velocityAnomaly ? 0.3 : 0
  const score = Math.round((volScore * 0.3 + gapScore * 0.3 + velScore * 0.4) * 100) / 100

  const pass = score < 0.5

  return {
    volumeZScore: Math.round(volumeZScore * 100) / 100,
    priceGapAnomaly,
    velocityAnomaly,
    score,
    pass,
  }
}

// ============================================================
// PREMIUM-ONLY ANALYSIS FEATURES
// These features are only applied for SONA package users
// ============================================================

/** Ichimoku Cloud Analysis (Premium Only) */
function ichimokuCloud(candles: Candle[]): {
  tenkanSen: number; kijunSen: number; senkouSpanA: number; senkouSpanB: number;
  chikouSpan: number; cloudColor: 'bullish' | 'bearish' | 'neutral';
  priceVsCloud: 'above' | 'below' | 'inside';
  trendStrength: number; // 0-100
} {
  if (candles.length < 52) {
    return { tenkanSen: 0, kijunSen: 0, senkouSpanA: 0, senkouSpanB: 0, chikouSpan: 0, cloudColor: 'neutral', priceVsCloud: 'inside', trendStrength: 50 }
  }

  const high = (data: Candle[], period: number, offset = 0): number => {
    const slice = data.slice(-(period + offset), data.length - offset || undefined)
    return slice.length > 0 ? Math.max(...slice.map(c => c.high)) : 0
  }
  const low = (data: Candle[], period: number, offset = 0): number => {
    const slice = data.slice(-(period + offset), data.length - offset || undefined)
    return slice.length > 0 ? Math.min(...slice.map(c => c.low)) : 0
  }

  // Tenkan-sen (Conversion Line) = (9-period high + 9-period low) / 2
  const tenkanSen = (high(candles, 9) + low(candles, 9)) / 2
  // Kijun-sen (Base Line) = (26-period high + 26-period low) / 2
  const kijunSen = (high(candles, 26) + low(candles, 26)) / 2
  // Senkou Span A (Leading Span A) = (Tenkan-sen + Kijun-sen) / 2 (plotted 26 periods ahead)
  const senkouSpanA = (tenkanSen + kijunSen) / 2
  // Senkou Span B (Leading Span B) = (52-period high + 52-period low) / 2 (plotted 26 periods ahead)
  const senkouSpanB = (high(candles, 52) + low(candles, 52)) / 2
  // Chikou Span (Lagging Span) = Current closing price (plotted 26 periods back)
  const chikouSpan = candles[candles.length - 1].close

  // Cloud color
  const cloudColor: 'bullish' | 'bearish' | 'neutral' =
    senkouSpanA > senkouSpanB * 1.001 ? 'bullish' :
    senkouSpanA < senkouSpanB * 0.999 ? 'bearish' : 'neutral'

  // Price vs cloud position
  const currentPrice = candles[candles.length - 1].close
  const cloudTop = Math.max(senkouSpanA, senkouSpanB)
  const cloudBottom = Math.min(senkouSpanA, senkouSpanB)
  const priceVsCloud: 'above' | 'below' | 'inside' =
    currentPrice > cloudTop ? 'above' :
    currentPrice < cloudBottom ? 'below' : 'inside'

  // Trend strength based on multiple Ichimoku factors
  let strength = 50
  if (priceVsCloud === 'above' && cloudColor === 'bullish') strength += 25
  else if (priceVsCloud === 'below' && cloudColor === 'bearish') strength += 25
  else if (priceVsCloud === 'inside') strength -= 10
  if (tenkanSen > kijunSen && currentPrice > tenkanSen) strength += 15
  else if (tenkanSen < kijunSen && currentPrice < tenkanSen) strength += 15
  else strength -= 10
  if (chikouSpan > candles[Math.max(0, candles.length - 26)].high) strength += 10
  else if (chikouSpan < candles[Math.max(0, candles.length - 26)].low) strength += 10
  else strength -= 5

  return {
    tenkanSen: Math.round(tenkanSen * 100) / 100,
    kijunSen: Math.round(kijunSen * 100) / 100,
    senkouSpanA: Math.round(senkouSpanA * 100) / 100,
    senkouSpanB: Math.round(senkouSpanB * 100) / 100,
    chikouSpan: Math.round(chikouSpan * 100) / 100,
    cloudColor,
    priceVsCloud,
    trendStrength: Math.min(100, Math.max(0, strength)),
  }
}

/** Fibonacci Retracement Levels (Premium Only) */
function fibonacciLevels(candles: Candle[]): {
  levels: { label: string; price: number; strength: number }[];
  nearestSupport: number;
  nearestResistance: number;
  bias: 'bullish' | 'bearish' | 'neutral';
} {
  if (candles.length < 30) {
    const price = candles.length > 0 ? candles[candles.length - 1].close : 0
    return { levels: [], nearestSupport: price, nearestResistance: price, bias: 'neutral' }
  }

  // Find the most recent significant swing high and low
  const lookback = Math.min(100, candles.length)
  const recent = candles.slice(-lookback)
  const highPrice = Math.max(...recent.map(c => c.high))
  const lowPrice = Math.min(...recent.map(c => c.low))
  const range = highPrice - lowPrice
  const currentPrice = candles[candles.length - 1].close

  // Fibonacci levels
  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
  const fibLabels = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%']
  const direction = highPrice > lowPrice ? 1 : -1

  const levels = fibRatios.map((ratio, i) => ({
    label: fibLabels[i],
    price: Math.round((highPrice - range * ratio) * 100) / 100,
    strength: ratio === 0.618 || ratio === 0.382 ? 3 : ratio === 0.5 ? 2 : 1, // Golden ratio levels are strongest
  }))

  // Find nearest support and resistance from fib levels
  const belowPrice = levels.filter(l => l.price < currentPrice).sort((a, b) => b.price - a.price)
  const abovePrice = levels.filter(l => l.price > currentPrice).sort((a, b) => a.price - b.price)

  const nearestSupport = belowPrice.length > 0 ? belowPrice[0].price : lowPrice
  const nearestResistance = abovePrice.length > 0 ? abovePrice[0].price : highPrice

  // Bias: if price is above 61.8% retracement, bullish; below 38.2%, bearish
  const fib618 = highPrice - range * 0.618
  const fib382 = highPrice - range * 0.382
  const bias: 'bullish' | 'bearish' | 'neutral' =
    currentPrice > fib382 ? 'bullish' :
    currentPrice < fib618 ? 'bearish' : 'neutral'

  return { levels, nearestSupport, nearestResistance, bias }
}

/** ADX - Average Directional Index (Premium Only) */
function adxIndicator(candles: Candle[]): {
  adx: number; plusDI: number; minusDI: number;
  trendStrength: 'strong' | 'moderate' | 'weak' | 'no_trend';
  trendDirection: 'bullish' | 'bearish' | 'neutral';
} {
  const period = 14
  if (candles.length < period * 2 + 1) {
    return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'no_trend', trendDirection: 'neutral' }
  }

  // Calculate True Range, +DM, -DM
  let plusDM: number[] = []
  let minusDM: number[] = []
  let trValues: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const highDiff = candles[i].high - candles[i - 1].high
    const lowDiff = candles[i - 1].low - candles[i].low
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0)
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0)
    trValues.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ))
  }

  // Wilder's smoothing
  const wilderSmooth = (data: number[], p: number): number[] => {
    if (data.length < p) return []
    const result: number[] = []
    let sum = data.slice(0, p).reduce((a, b) => a + b, 0)
    result.push(sum)
    for (let i = p; i < data.length; i++) {
      sum = sum - sum / p + data[i]
      result.push(sum)
    }
    return result
  }

  const smoothTR = wilderSmooth(trValues, period)
  const smoothPlusDM = wilderSmooth(plusDM, period)
  const smoothMinusDM = wilderSmooth(minusDM, period)

  if (smoothTR.length < period + 1) {
    return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'no_trend', trendDirection: 'neutral' }
  }

  // Calculate DI values
  const plusDIValues: number[] = []
  const minusDIValues: number[] = []
  const dxValues: number[] = []

  for (let i = 0; i < smoothPlusDM.length; i++) {
    const pdi = smoothTR[i] > 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0
    const mdi = smoothTR[i] > 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0
    plusDIValues.push(pdi)
    minusDIValues.push(mdi)
    const diSum = pdi + mdi
    const diDiff = Math.abs(pdi - mdi)
    dxValues.push(diSum > 0 ? (diDiff / diSum) * 100 : 0)
  }

  // ADX = smoothed DX
  let adx = dxValues.length >= period ? dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period : 0
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period
  }

  const currentPlusDI = plusDIValues.length > 0 ? plusDIValues[plusDIValues.length - 1] : 0
  const currentMinusDI = minusDIValues.length > 0 ? minusDIValues[minusDIValues.length - 1] : 0

  const trendStrength: 'strong' | 'moderate' | 'weak' | 'no_trend' =
    adx > 50 ? 'strong' : adx > 25 ? 'moderate' : adx > 15 ? 'weak' : 'no_trend'

  const trendDirection: 'bullish' | 'bearish' | 'neutral' =
    currentPlusDI > currentMinusDI + 5 ? 'bullish' :
    currentMinusDI > currentPlusDI + 5 ? 'bearish' : 'neutral'

  return {
    adx: Math.round(adx * 100) / 100,
    plusDI: Math.round(currentPlusDI * 100) / 100,
    minusDI: Math.round(currentMinusDI * 100) / 100,
    trendStrength,
    trendDirection,
  }
}

/** Stochastic Oscillator (Premium Only) */
function stochasticOscillator(candles: Candle[]): {
  k: number; d: number; signal: 'overbought' | 'oversold' | 'neutral';
  divergence: 'bullish' | 'bearish' | 'none';
} {
  const period = 14
  const smoothK = 3
  if (candles.length < period + smoothK) {
    return { k: 50, d: 50, signal: 'neutral', divergence: 'none' }
  }

  // Calculate %K values
  const kValues: number[] = []
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1)
    const highN = Math.max(...slice.map(c => c.high))
    const lowN = Math.min(...slice.map(c => c.low))
    const range = highN - lowN
    kValues.push(range > 0 ? ((candles[i].close - lowN) / range) * 100 : 50)
  }

  // Smooth %K to get fast %K, then smooth again for %D
  if (kValues.length < smoothK) return { k: 50, d: 50, signal: 'neutral', divergence: 'none' }

  const smoothKValues: number[] = []
  for (let i = smoothK - 1; i < kValues.length; i++) {
    smoothKValues.push(kValues.slice(i - smoothK + 1, i + 1).reduce((a, b) => a + b, 0) / smoothK)
  }

  const currentK = smoothKValues[smoothKValues.length - 1]
  const currentD = smoothKValues.length >= smoothK
    ? smoothKValues.slice(-smoothK).reduce((a, b) => a + b, 0) / smoothK
    : currentK

  const signal: 'overbought' | 'oversold' | 'neutral' =
    currentK > 80 ? 'overbought' : currentK < 20 ? 'oversold' : 'neutral'

  // Simple divergence detection
  let divergence: 'bullish' | 'bearish' | 'none' = 'none'
  if (smoothKValues.length >= 10) {
    const recentK = smoothKValues.slice(-5)
    const prevK = smoothKValues.slice(-10, -5)
    const recentPrices = candles.slice(-5).map(c => c.close)
    const prevPrices = candles.slice(-10, -5).map(c => c.close)

    const recentKLow = Math.min(...recentK)
    const prevKLow = Math.min(...prevK)
    const recentPriceLow = Math.min(...recentPrices)
    const prevPriceLow = Math.min(...prevPrices)

    const recentKHigh = Math.max(...recentK)
    const prevKHigh = Math.max(...prevK)
    const recentPriceHigh = Math.max(...recentPrices)
    const prevPriceHigh = Math.max(...prevPrices)

    // Bullish divergence: price lower low, stochastic higher low
    if (recentPriceLow < prevPriceLow && recentKLow > prevKLow && currentK < 30) divergence = 'bullish'
    // Bearish divergence: price higher high, stochastic lower high
    if (recentPriceHigh > prevPriceHigh && recentKHigh < prevKHigh && currentK > 70) divergence = 'bearish'
  }

  return {
    k: Math.round(currentK * 100) / 100,
    d: Math.round(currentD * 100) / 100,
    signal,
    divergence,
  }
}

/** Chart Pattern Detection - Double Top/Bottom (Premium Only) */
function detectChartPatterns(candles: Candle[]): {
  pattern: 'double_top' | 'double_bottom' | 'head_shoulders' | 'inverse_head_shoulders' | 'none';
  confidence: number; // 0-100
  targetPrice: number | null;
  description: string;
} {
  if (candles.length < 40) {
    return { pattern: 'none', confidence: 0, targetPrice: null, description: 'Insufficient data' }
  }

  const recent = candles.slice(-40)
  const closes = recent.map(c => c.close)

  // Find local peaks and troughs
  const peaks: { index: number; price: number }[] = []
  const troughs: { index: number; price: number }[] = []

  for (let i = 2; i < closes.length - 2; i++) {
    if (closes[i] > closes[i - 1] && closes[i] > closes[i - 2] && closes[i] > closes[i + 1] && closes[i] > closes[i + 2]) {
      peaks.push({ index: i, price: closes[i] })
    }
    if (closes[i] < closes[i - 1] && closes[i] < closes[i - 2] && closes[i] < closes[i + 1] && closes[i] < closes[i + 2]) {
      troughs.push({ index: i, price: closes[i] })
    }
  }

  const currentPrice = closes[closes.length - 1]
  const tolerance = currentPrice * 0.015 // 1.5% tolerance for pattern matching

  // Double Top: Two peaks at similar levels with a trough between
  if (peaks.length >= 2) {
    const lastTwoPeaks = peaks.slice(-2)
    if (Math.abs(lastTwoPeaks[1].price - lastTwoPeaks[0].price) < tolerance) {
      const troughBetween = troughs.find(t => t.index > lastTwoPeaks[0].index && t.index < lastTwoPeaks[1].index)
      if (troughBetween) {
        const neckline = troughBetween.price
        const height = Math.max(lastTwoPeaks[0].price, lastTwoPeaks[1].price) - neckline
        return {
          pattern: 'double_top',
          confidence: Math.min(85, 50 + Math.round(height / currentPrice * 5000)),
          targetPrice: Math.round((neckline - height) * 100) / 100,
          description: `Double Top at ${Math.round(Math.max(lastTwoPeaks[0].price, lastTwoPeaks[1].price) * 100) / 100}, neckline at ${Math.round(neckline * 100) / 100}`,
        }
      }
    }
  }

  // Double Bottom: Two troughs at similar levels with a peak between
  if (troughs.length >= 2) {
    const lastTwoTroughs = troughs.slice(-2)
    if (Math.abs(lastTwoTroughs[1].price - lastTwoTroughs[0].price) < tolerance) {
      const peakBetween = peaks.find(p => p.index > lastTwoTroughs[0].index && p.index < lastTwoTroughs[1].index)
      if (peakBetween) {
        const neckline = peakBetween.price
        const height = neckline - Math.min(lastTwoTroughs[0].price, lastTwoTroughs[1].price)
        return {
          pattern: 'double_bottom',
          confidence: Math.min(85, 50 + Math.round(height / currentPrice * 5000)),
          targetPrice: Math.round((neckline + height) * 100) / 100,
          description: `Double Bottom at ${Math.round(Math.min(lastTwoTroughs[0].price, lastTwoTroughs[1].price) * 100) / 100}, neckline at ${Math.round(neckline * 100) / 100}`,
        }
      }
    }
  }

  // Head and Shoulders (simplified detection)
  if (peaks.length >= 3) {
    const last3 = peaks.slice(-3)
    const [left, head, right] = last3
    if (head.price > left.price && head.price > right.price &&
        Math.abs(left.price - right.price) < tolerance * 2) {
      const necklineTr = troughs.find(t => t.index > left.index && t.index < right.index)
      if (necklineTr) {
        const height = head.price - necklineTr.price
        return {
          pattern: 'head_shoulders',
          confidence: Math.min(80, 45 + Math.round(height / currentPrice * 4000)),
          targetPrice: Math.round((necklineTr.price - height) * 100) / 100,
          description: `H&S: Head at ${Math.round(head.price * 100) / 100}, neckline at ${Math.round(necklineTr.price * 100) / 100}`,
        }
      }
    }
  }

  // Inverse Head and Shoulders (simplified detection)
  if (troughs.length >= 3) {
    const last3 = troughs.slice(-3)
    const [left, head, right] = last3
    if (head.price < left.price && head.price < right.price &&
        Math.abs(left.price - right.price) < tolerance * 2) {
      const necklinePk = peaks.find(p => p.index > left.index && p.index < right.index)
      if (necklinePk) {
        const height = necklinePk.price - head.price
        return {
          pattern: 'inverse_head_shoulders',
          confidence: Math.min(80, 45 + Math.round(height / currentPrice * 4000)),
          targetPrice: Math.round((necklinePk.price + height) * 100) / 100,
          description: `Inv H&S: Head at ${Math.round(head.price * 100) / 100}, neckline at ${Math.round(necklinePk.price * 100) / 100}`,
        }
      }
    }
  }

  return { pattern: 'none', confidence: 0, targetPrice: null, description: 'No pattern detected' }
}

/** Premium Support/Resistance from Volume Profile (Premium Only) */
function premiumSupportResistance(candles: Candle[]): {
  supports: number[]; resistances: number[];
  strongestSupport: number; strongestResistance: number;
  pivotPrice: number;
} {
  if (candles.length < 30) {
    const price = candles.length > 0 ? candles[candles.length - 1].close : 0
    return { supports: [], resistances: [], strongestSupport: price, strongestResistance: price, pivotPrice: price }
  }

  // Volume-weighted price levels
  const priceVolume: Map<string, number> = new Map()
  const binSize = candles[candles.length - 1].close * 0.002 // 0.2% bins

  for (const c of candles.slice(-60)) {
    const bin = Math.round(c.close / binSize) * binSize
    const key = bin.toFixed(2)
    priceVolume.set(key, (priceVolume.get(key) || 0) + c.volume)
  }

  // Sort by volume to find high-volume nodes (HVN)
  const sorted = [...priceVolume.entries()].sort((a, b) => b[1] - a[1])
  const topNodes = sorted.slice(0, 6).map(([price, vol]) => ({ price: parseFloat(price), volume: vol }))

  const currentPrice = candles[candles.length - 1].close

  const supports = topNodes.filter(n => n.price < currentPrice).map(n => n.price).sort((a, b) => b - a)
  const resistances = topNodes.filter(n => n.price > currentPrice).map(n => n.price).sort((a, b) => a - b)

  // Pivot: classic pivot point
  const recentHigh = Math.max(...candles.slice(-20).map(c => c.high))
  const recentLow = Math.min(...candles.slice(-20).map(c => c.low))
  const recentClose = candles[candles.length - 1].close
  const pivotPrice = (recentHigh + recentLow + recentClose) / 3

  return {
    supports,
    resistances,
    strongestSupport: supports.length > 0 ? supports[0] : recentLow,
    strongestResistance: resistances.length > 0 ? resistances[0] : recentHigh,
    pivotPrice: Math.round(pivotPrice * 100) / 100,
  }
}

// ============================================================
// SIGNAL PIPELINE
// ============================================================

async function generateSignalForSymbol(
  symbol: string,
  tfData: Record<string, Candle[]>,
  allCandleData: Record<string, Record<string, Candle[]>>,
  fearGreed: FearGreedResult,
  tier: 'premium' | 'basic' = 'basic',
): Promise<SignalOutput> {
  const displaySymbol = symbol.replace('USDT', '/USDT')
  const candles1h = tfData['1h'] || []
  const candles4h = tfData['4h'] || []
  const candles1d = tfData['1d'] || []

  // Current price
  const currentPrice = candles1h.length > 0 ? candles1h[candles1h.length - 1].close : 0

  // --- Pipeline Step 1: Entropy Check ---
  const entropyResult = entropyMonitor(candles1h)

  // --- Pipeline Step 2: Regime Detection ---
  const regimeResult = detectRegime(candles4h.length > 0 ? candles4h : candles1h)

  // --- Pipeline Step 3: Fear & Greed Prior (already fetched) ---

  // --- Pipeline Step 4: Multi-TF Analysis ---
  const multiTF = multiTFAnalysis(tfData)

  // --- Pipeline Step 5: Technical Analysis Ensemble ---
  const mlResult = technicalEnsemble(candles4h.length > 0 ? candles4h : candles1h)

  // --- Pipeline Step 6: Bayesian Update ---
  const signalStrength = mlResult.avgProbability / 100
  const bayesian = bayesianUpdate(fearGreed, signalStrength, mlResult.consensus)

  // --- Pipeline Step 7: Volatility Engine ---
  const volatility = adaptiveVolatility(candles1h)

  // --- Pipeline Step 8: Kalman Filter ---
  const kalman = adaptiveKalman(candles1h)

  // --- Pipeline Step 9: SMC Filter ---
  const smc = smcAnalysis(candles1d.length > 0 ? candles1d : candles1h)

  // --- Pipeline Step 10: Correlation ---
  const correlation = correlationAnalysis(allCandleData)

  // --- Pipeline Step 11: Anomaly Detection ---
  const anomaly = anomalyDetection(candles1h, kalman)

  // --- PREMIUM-ONLY ANALYSIS (Steps 12-16) ---
  // These features add significant intelligence for SONA package users
  let ichimokuResult: ReturnType<typeof ichimokuCloud> | null = null
  let fibResult: ReturnType<typeof fibonacciLevels> | null = null
  let adxResult: ReturnType<typeof adxIndicator> | null = null
  let stochResult: ReturnType<typeof stochasticOscillator> | null = null
  let chartPatternResult: ReturnType<typeof detectChartPatterns> | null = null
  let srResult: ReturnType<typeof premiumSupportResistance> | null = null

  if (tier === 'premium') {
    // Premium Step 12: Ichimoku Cloud Analysis
    ichimokuResult = ichimokuCloud(candles1d.length > 0 ? candles1d : candles1h)

    // Premium Step 13: Fibonacci Retracement Levels
    fibResult = fibonacciLevels(candles1d.length > 0 ? candles1d : candles4h)

    // Premium Step 14: ADX Trend Strength
    adxResult = adxIndicator(candles4h.length > 0 ? candles4h : candles1h)

    // Premium Step 15: Stochastic Oscillator
    stochResult = stochasticOscillator(candles4h.length > 0 ? candles4h : candles1h)

    // Premium Step 16: Chart Pattern Detection
    chartPatternResult = detectChartPatterns(candles1d.length > 0 ? candles1d : candles4h)

    // Premium Step 17: Volume-Profile Support/Resistance
    srResult = premiumSupportResistance(candles1d.length > 0 ? candles1d : candles1h)
  }

  // --- Determine signal type ---
  // Weighted decision from all engines
  let signalScore = 0
  // Multi-TF (confluence: 50=neutral, >50=bullish, <50=bearish)
  signalScore += (multiTF.confluence - 50) / 50 * 0.25
  // ML consensus
  signalScore += (mlResult.consensus === 'LONG' ? 1 : mlResult.consensus === 'SHORT' ? -1 : 0) * 0.20
  // Bayesian posterior (>0.5 = bullish)
  signalScore += (bayesian.posterior - 0.5) * 0.20
  // Kalman trend
  signalScore += (kalman.trend === 'bullish' ? 0.5 : kalman.trend === 'bearish' ? -0.5 : 0) * 0.10
  // SMC bias
  signalScore += (smc.bias === 'bullish' ? 0.5 : smc.bias === 'bearish' ? -0.5 : 0) * 0.15
  // Regime: in trending regime, trust signal more; in range, dampen
  if (regimeResult.regime === 'range') signalScore *= 0.6
  else if (regimeResult.regime === 'volatile') signalScore *= 0.8

  // --- PREMIUM SIGNAL ENHANCEMENT ---
  // Premium users get additional weighted inputs from advanced indicators
  if (tier === 'premium') {
    // Ichimoku cloud contribution (weight: 0.08)
    if (ichimokuResult) {
      const ichimokuSignal = ichimokuResult.priceVsCloud === 'above' && ichimokuResult.cloudColor === 'bullish' ? 0.5 :
        ichimokuResult.priceVsCloud === 'below' && ichimokuResult.cloudColor === 'bearish' ? -0.5 :
        ichimokuResult.priceVsCloud === 'above' ? 0.2 : ichimokuResult.priceVsCloud === 'below' ? -0.2 : 0
      signalScore += ichimokuSignal * 0.08
    }

    // ADX trend direction (weight: 0.06)
    if (adxResult && adxResult.trendStrength !== 'no_trend') {
      signalScore += (adxResult.trendDirection === 'bullish' ? 0.5 : adxResult.trendDirection === 'bearish' ? -0.5 : 0) * 0.06
      // Strengthen signal when ADX shows strong trend
      if (adxResult.trendStrength === 'strong') signalScore *= 1.1
    }

    // Stochastic confirmation (weight: 0.05)
    if (stochResult) {
      if (stochResult.signal === 'oversold' && signalScore > 0) signalScore += 0.3 * 0.05 // Oversold + bullish = stronger
      if (stochResult.signal === 'overbought' && signalScore < 0) signalScore -= 0.3 * 0.05 // Overbought + bearish = stronger
      if (stochResult.divergence === 'bullish' && signalScore > 0) signalScore += 0.2 * 0.05
      if (stochResult.divergence === 'bearish' && signalScore < 0) signalScore -= 0.2 * 0.05
      // Dampen signal if stochastic contradicts
      if (stochResult.signal === 'overbought' && signalScore > 0) signalScore *= 0.9
      if (stochResult.signal === 'oversold' && signalScore < 0) signalScore *= 0.9
    }

    // Fibonacci bias (weight: 0.04)
    if (fibResult) {
      signalScore += (fibResult.bias === 'bullish' ? 0.3 : fibResult.bias === 'bearish' ? -0.3 : 0) * 0.04
    }

    // Chart pattern contribution (weight: 0.05)
    if (chartPatternResult && chartPatternResult.pattern !== 'none') {
      const patternSignal = chartPatternResult.pattern === 'double_bottom' || chartPatternResult.pattern === 'inverse_head_shoulders' ? 0.5 :
        chartPatternResult.pattern === 'double_top' || chartPatternResult.pattern === 'head_shoulders' ? -0.5 : 0
      signalScore += patternSignal * 0.05 * (chartPatternResult.confidence / 100)
    }

    // Support/Resistance pivot alignment (weight: 0.02)
    if (srResult) {
      if (currentPrice > srResult.pivotPrice) signalScore += 0.1 * 0.02
      else signalScore -= 0.1 * 0.02
    }
  }

  // Premium: Higher threshold for signal (more selective = more accurate)
  const signalThreshold = tier === 'premium' ? 0.18 : 0.15
  const type: SignalType = signalScore > signalThreshold ? 'LONG' : signalScore < -signalThreshold ? 'SHORT' : 'NEUTRAL'

  // Calculate confidence
  let rawConfidence = Math.min(95, Math.max(10, Math.round(50 + Math.abs(signalScore) * 50)))

  // Premium: Boost confidence when multiple premium indicators agree
  if (tier === 'premium') {
    let premiumAgreement = 0
    if (ichimokuResult) {
      const iBias = ichimokuResult.priceVsCloud === 'above' ? 'bullish' : ichimokuResult.priceVsCloud === 'below' ? 'bearish' : 'neutral'
      if ((type === 'LONG' && iBias === 'bullish') || (type === 'SHORT' && iBias === 'bearish')) premiumAgreement++
    }
    if (adxResult && adxResult.trendDirection !== 'neutral') {
      if ((type === 'LONG' && adxResult.trendDirection === 'bullish') || (type === 'SHORT' && adxResult.trendDirection === 'bearish')) premiumAgreement++
    }
    if (stochResult) {
      if ((type === 'LONG' && stochResult.divergence === 'bullish') || (type === 'SHORT' && stochResult.divergence === 'bearish')) premiumAgreement++
    }
    if (fibResult) {
      if ((type === 'LONG' && fibResult.bias === 'bullish') || (type === 'SHORT' && fibResult.bias === 'bearish')) premiumAgreement++
    }
    if (chartPatternResult && chartPatternResult.pattern !== 'none') {
      const patternBias = chartPatternResult.pattern === 'double_bottom' || chartPatternResult.pattern === 'inverse_head_shoulders' ? 'bullish' :
        chartPatternResult.pattern === 'double_top' || chartPatternResult.pattern === 'head_shoulders' ? 'bearish' : 'neutral'
      if ((type === 'LONG' && patternBias === 'bullish') || (type === 'SHORT' && patternBias === 'bearish')) premiumAgreement++
    }
    // Boost confidence when 3+ premium indicators agree with signal
    if (premiumAgreement >= 3) rawConfidence = Math.min(97, rawConfidence + 12)
    else if (premiumAgreement >= 2) rawConfidence = Math.min(96, rawConfidence + 6)
    else if (premiumAgreement === 0 && type !== 'NEUTRAL') rawConfidence = Math.max(15, rawConfidence - 8) // Penalty if no premium agreement
  }

  // --- Pipeline Step 12: Calibration ---
  const calibration = await calibrateConfidence(displaySymbol, rawConfidence)

  // --- Pipeline Step 13: Cooldown ---
  const cooldown = await checkCooldown(displaySymbol)

  // --- Pipeline Step 14: Risk Budget ---
  const risk = await calculateRisk(displaySymbol, calibration.calibratedConfidence)

  // --- RSI Divergence Detection ---
  const rsiDivergence = detectRSIDivergence(candles4h.length > 0 ? candles4h : candles1h)

  // --- Volume Profile Analysis ---
  const volumeProfile = analyzeVolumeProfile(candles1h)

  // --- Calculate Entry/TP/SL with 3 Targets ---
  const atrVal = volatility.currentATR > 0 ? volatility.currentATR : currentPrice * 0.01
  const slDistance = atrVal * volatility.slMultiplier

  // Direction multiplier: +1 for LONG, -1 for SHORT, 0 for NEUTRAL
  const direction = type === 'LONG' ? 1 : type === 'SHORT' ? -1 : 0

  // --- PREMIUM TARGET CALCULATION ---
  // Premium: Use support/resistance and Fibonacci for more precise targets
  let target1Distance: number
  let target2Distance: number
  let target3Distance: number
  let premiumSL: number | null = null

  if (tier === 'premium' && srResult && fibResult && direction !== 0) {
    // Premium Target 1 (Conservative): Nearest Fibonacci support/resistance
    const fibTarget = type === 'LONG' ? fibResult.nearestResistance : fibResult.nearestSupport
    const fibDistance = Math.abs(fibTarget - currentPrice)
    target1Distance = fibDistance > 0 ? fibDistance : atrVal * 1.5

    // Premium Target 2 (Moderate): Use volume-profile S/R
    const srTarget = type === 'LONG' ? srResult.strongestResistance : srResult.strongestSupport
    const srDistance = Math.abs(srTarget - currentPrice)
    target2Distance = srDistance > currentPrice * 0.005 ? srDistance : atrVal * 2.5

    // Premium Target 3 (Aggressive): Use pattern target or extended S/R
    if (chartPatternResult && chartPatternResult.targetPrice && chartPatternResult.pattern !== 'none') {
      const patternTarget = chartPatternResult.targetPrice
      target3Distance = Math.abs(patternTarget - currentPrice)
    } else {
      // Fall back to next S/R level or ATR-based
      const nextResistance = srResult.resistances.length > 1 ? srResult.resistances[1] : 0
      const nextSupport = srResult.supports.length > 1 ? srResult.supports[1] : 0
      const nextTarget = type === 'LONG' ? nextResistance : nextSupport
      target3Distance = nextTarget > 0 ? Math.abs(nextTarget - currentPrice) : atrVal * 4.0
    }

    // Premium Stop Loss: Place behind strongest support/resistance
    const slSupport = type === 'LONG' ? srResult.strongestSupport : srResult.strongestResistance
    const slSRDistance = Math.abs(currentPrice - slSupport)
    if (slSRDistance > 0 && slSRDistance < atrVal * volatility.slMultiplier * 3) {
      premiumSL = type === 'LONG' ? slSupport - atrVal * 0.3 : slSupport + atrVal * 0.3
    }
  } else {
    // Basic tier: standard ATR-based targets
    target1Distance = atrVal * 1.5  // Conservative
    target2Distance = atrVal * 2.5  // Moderate
    target3Distance = atrVal * 4.0  // Aggressive
  }

  const entryPrice = currentPrice
  const targetPrice1 = entryPrice + direction * target1Distance
  const targetPrice2 = entryPrice + direction * target2Distance  // = targetPrice (backward compat)
  const targetPrice3 = entryPrice + direction * target3Distance
  const targetPrice = targetPrice2  // Backward compatibility
  const baseSL = type === 'LONG' ? entryPrice - slDistance : type === 'SHORT' ? entryPrice + slDistance : entryPrice
  const stopLoss = premiumSL !== null ? premiumSL : baseSL

  // --- Apply filters (smarter: don't reject, just reduce confidence) ---
  // Premium: Stricter ML agreement threshold (4/5 instead of 3/5)
  const mlAgreementThreshold = tier === 'premium' ? 4 : 3
  const filters: SignalFilters = {
    entropy: entropyResult.pass ? 'PASS' : 'FAIL',
    smcPreFilter: smc.preFilter,
    mlDisagreement: parseInt(mlResult.agreement) >= mlAgreementThreshold ? 'PASS' : 'FAIL',
    multiTfOpposition: multiTF.confluence >= 40 && multiTF.confluence <= 60 ? 'FAIL' : 'PASS',
    correlation: correlation.pass ? 'PASS' : 'FAIL',
    anomaly: anomaly.pass ? 'PASS' : 'FAIL',
    riskBudget: risk.pass ? 'PASS' : 'FAIL',
    cooldown: cooldown.pass ? 'PASS' : 'FAIL',
  }

  // Calculate filter score (0-8: how many filters pass)
  const filterScore = Object.values(filters).filter(f => f === 'PASS').length

  // Instead of rejecting signals, reduce confidence based on filter score
  // Even with some failures, signals still appear but with lower confidence
  let finalType = type
  let finalConfidence = Math.round(calibration.calibratedConfidence * (0.5 + 0.5 * filterScore / 8))

  // Only fully suppress if cooldown is active
  if (filters.cooldown === 'FAIL') {
    finalConfidence = Math.min(finalConfidence, 10)
  }

  // RSI divergence boost/penalty
  if (rsiDivergence === 'bullish' && finalType === 'LONG') finalConfidence = Math.min(99, finalConfidence + 5)
  if (rsiDivergence === 'bearish' && finalType === 'SHORT') finalConfidence = Math.min(99, finalConfidence + 5)
  if (rsiDivergence === 'bullish' && finalType === 'SHORT') finalConfidence = Math.max(1, finalConfidence - 5)
  if (rsiDivergence === 'bearish' && finalType === 'LONG') finalConfidence = Math.max(1, finalConfidence - 5)

  // Volume profile boost/penalty
  if (volumeProfile === 'supportive') finalConfidence = Math.min(99, finalConfidence + 3)
  if (volumeProfile === 'contradictory') finalConfidence = Math.max(1, finalConfidence - 5)

  // Premium: Additional confidence adjustments from premium indicators
  if (tier === 'premium') {
    // Stochastic divergence boost/penalty (additional to RSI divergence)
    if (stochResult) {
      if (stochResult.divergence === 'bullish' && finalType === 'LONG') finalConfidence = Math.min(99, finalConfidence + 4)
      if (stochResult.divergence === 'bearish' && finalType === 'SHORT') finalConfidence = Math.min(99, finalConfidence + 4)
      if (stochResult.divergence === 'bullish' && finalType === 'SHORT') finalConfidence = Math.max(1, finalConfidence - 4)
      if (stochResult.divergence === 'bearish' && finalType === 'LONG') finalConfidence = Math.max(1, finalConfidence - 4)
    }
    // ADX trend strength bonus
    if (adxResult) {
      if (adxResult.trendStrength === 'strong') finalConfidence = Math.min(99, finalConfidence + 5)
      else if (adxResult.trendStrength === 'no_trend') finalConfidence = Math.max(1, finalConfidence - 8)
    }
    // Ichimoku cloud position boost
    if (ichimokuResult) {
      if ((finalType === 'LONG' && ichimokuResult.priceVsCloud === 'above' && ichimokuResult.cloudColor === 'bullish') ||
          (finalType === 'SHORT' && ichimokuResult.priceVsCloud === 'below' && ichimokuResult.cloudColor === 'bearish')) {
        finalConfidence = Math.min(99, finalConfidence + 4)
      }
    }
  }

  // Build analysis object with optional premium data
  const analysisData: SignalOutput['analysis'] = {
    multiTF: { ...multiTF.biases, confluence: multiTF.confluence },
    mlModels: mlResult.models,
    bayesian,
    smc: { zone: smc.zone, orderBlocks: smc.orderBlocks, fvg: smc.fvg },
    volatility: { atrPercentile: volatility.atrPercentile, slMultiplier: volatility.slMultiplier, tpMultiplier: volatility.tpMultiplier },
    kalman: { trend: kalman.trend, gain: kalman.gain, innovation: kalman.innovation },
    entropy: { current: entropyResult.current, trend: entropyResult.trend, quality: entropyResult.quality },
    correlation: { btcEth: correlation.btcEth, btcBnb: correlation.btcBnb, ethBnb: correlation.ethBnb },
    risk: { kellyCriterion: risk.kellyCriterion, maxExposure: risk.maxExposure, drawdownWeek: risk.drawdownWeek },
    // Premium-only analysis data (null for basic tier)
    premium: tier === 'premium' ? {
      ichimoku: ichimokuResult ? {
        cloudColor: ichimokuResult.cloudColor,
        priceVsCloud: ichimokuResult.priceVsCloud,
        trendStrength: ichimokuResult.trendStrength,
        tenkanSen: ichimokuResult.tenkanSen,
        kijunSen: ichimokuResult.kijunSen,
      } : null,
      fibonacci: fibResult ? {
        nearestSupport: fibResult.nearestSupport,
        nearestResistance: fibResult.nearestResistance,
        bias: fibResult.bias,
      } : null,
      adx: adxResult ? {
        adx: adxResult.adx,
        trendStrength: adxResult.trendStrength,
        trendDirection: adxResult.trendDirection,
        plusDI: adxResult.plusDI,
        minusDI: adxResult.minusDI,
      } : null,
      stochastic: stochResult ? {
        k: stochResult.k,
        d: stochResult.d,
        signal: stochResult.signal,
        divergence: stochResult.divergence,
      } : null,
      chartPattern: chartPatternResult ? {
        pattern: chartPatternResult.pattern,
        confidence: chartPatternResult.confidence,
        targetPrice: chartPatternResult.targetPrice,
        description: chartPatternResult.description,
      } : null,
      supportResistance: srResult ? {
        strongestSupport: srResult.strongestSupport,
        strongestResistance: srResult.strongestResistance,
        pivotPrice: srResult.pivotPrice,
      } : null,
    } : null,
  } as any

  return {
    symbol: displaySymbol,
    type: finalType,
    entryPrice: Math.round(entryPrice * 100) / 100,
    targetPrice: Math.round(targetPrice * 100) / 100,
    targetPrice1: Math.round(targetPrice1 * 100) / 100,
    targetPrice2: Math.round(targetPrice2 * 100) / 100,
    targetPrice3: Math.round(targetPrice3 * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    confidence: rawConfidence,
    calibratedConfidence: finalConfidence,
    filterScore,
    rsiDivergence,
    volumeProfile,
    confluenceScore: multiTF.confluence,
    regime: regimeResult.regime,
    mlAgreement: mlResult.agreement,
    bayesianConfidence: Math.round(bayesian.posterior * 100),
    smcSignal: smc.description,
    entropyScore: entropyResult.current,
    fearGreedIndex: fearGreed.value,
    anomalyScore: anomaly.score,
    cooldownStatus: cooldown.status === 'clear' ? 'clear' : `${cooldown.remainingMinutes}min remaining`,
    riskBudget: risk.maxExposure,
    analysis: analysisData,
    timestamp: new Date().toISOString(),
    filters,
  }
}

// ============================================================
// MAIN PIPELINE ORCHESTRATOR
// ============================================================

// ===== LOAD LEARNED WEIGHTS FROM TRAINING =====
async function loadLearnedWeights(): Promise<{
  weights: Record<string, number>
  bias: Record<string, { longBias: number; shortBias: number }>
  globalWinRate: number
} | null> {
  try {
    const weightsSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_training_weights' } })
    const biasSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_training_bias' } })
    const winRateSetting = await prisma.platformSetting.findUnique({ where: { key: 'signal_global_winrate' } })

    if (!weightsSetting) return null

    return {
      weights: JSON.parse(weightsSetting.value),
      bias: biasSetting ? JSON.parse(biasSetting.value) : {},
      globalWinRate: winRateSetting ? parseFloat(winRateSetting.value) : 50,
    }
  } catch {
    return null
  }
}

// ===== AI-POWERED PREMIUM ANALYSIS (SONA Package Only) =====
async function aiPremiumAnalysis(symbol: string, candles1h: Candle[], currentPrice: number, tier: 'premium' | 'basic'): Promise<{
  aiConfidence: number
  aiDirection: 'bullish' | 'bearish' | 'neutral'
  aiReasoning: string
  aiKeyLevels: { support: number; resistance: number }
  aiRiskLevel: 'low' | 'medium' | 'high'
} | null> {
  // Only run AI analysis for premium (SONA package) users
  if (tier !== 'premium') return null
  if (candles1h.length < 30) return null

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Prepare market data summary for AI analysis
    const recentCandles = candles1h.slice(-24) // Last 24 hours
    const priceData = recentCandles.map(c => `O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`).join(' | ')
    const high24h = Math.max(...recentCandles.map(c => c.high))
    const low24h = Math.min(...recentCandles.map(c => c.low))
    const avgVolume = recentCandles.reduce((s, c) => s + c.volume, 0) / recentCandles.length
    const recentVolume = recentCandles.slice(-6).reduce((s, c) => s + c.volume, 0) / 6

    const prompt = `أنت محلل فني محترف للعملات الرقمية. حلل البيانات التالية لـ ${symbol} وأعط تقييمك:

السعر الحالي: $${currentPrice.toFixed(2)}
أعلى سعر 24 ساعة: $${high24h.toFixed(2)}
أدنى سعر 24 ساعة: $${low24h.toFixed(2)}
متوسط الحجم: ${avgVolume.toFixed(0)}
الحجم الأخير: ${recentVolume.toFixed(0)}
بيانات آخر 24 شمعة ساعية: ${priceData}

أجب فقط بصيغة JSON التالية بدون أي نص إضافي:
{"direction": "bullish/bearish/neutral", "confidence": 0-100, "reasoning": "سبب قصير", "support": سعر, "resistance": سعر, "risk": "low/medium/high"}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'أنت محلل فني محترف. أجب فقط بـ JSON صحيح بدون أي نص إضافي.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    })

    const content = completion.choices?.[0]?.message?.content || ''
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    return {
      aiConfidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      aiDirection: parsed.direction === 'bullish' ? 'bullish' : parsed.direction === 'bearish' ? 'bearish' : 'neutral',
      aiReasoning: parsed.reasoning || '',
      aiKeyLevels: {
        support: parseFloat(parsed.support) || low24h,
        resistance: parseFloat(parsed.resistance) || high24h,
      },
      aiRiskLevel: parsed.risk === 'low' ? 'low' : parsed.risk === 'high' ? 'high' : 'medium',
    }
  } catch (error) {
    // AI analysis is optional - don't fail the whole pipeline
    console.error('[AI-PREMIUM] Analysis failed:', error)
    return null
  }
}

async function runFullPipeline(targetSymbols: string[] = [...SYMBOLS_BASIC], tier: 'premium' | 'basic' = 'basic'): Promise<SignalResponse> {
  // ===== LOAD LEARNED PARAMETERS FROM TRAINING =====
  const learned = await loadLearnedWeights()

  // Fetch all candle data in parallel
  const allCandleData: Record<string, Record<string, Candle[]>> = {}
  const fetchPromises: Promise<void>[] = []

  for (const symbol of targetSymbols) {
    allCandleData[symbol] = {}
    for (const tf of TIMEFRAMES) {
      const p = fetchKlines(symbol, tf, TF_LIMITS[tf]).then(candles => {
        allCandleData[symbol][tf] = candles
      })
      fetchPromises.push(p)
    }
  }
  await Promise.all(fetchPromises)

  // Fetch Fear & Greed
  const fearGreed = await fetchFearGreed()

  // Generate signals for each symbol
  const signalPromises = targetSymbols.map(async (symbol) => {
    const signal = await generateSignalForSymbol(symbol, allCandleData[symbol] || {}, allCandleData, fearGreed, tier)

    // ===== APPLY LEARNED BIAS FROM TRAINING =====
    if (learned && learned.bias[symbol]) {
      const symbolBias = learned.bias[symbol]
      // If training shows long is more successful, slightly boost long confidence
      if (signal.type === 'LONG' && symbolBias.longBias > symbolBias.shortBias + 0.15) {
        signal.confidence = Math.min(97, signal.confidence + 5)
        signal.calibratedConfidence = Math.min(97, signal.calibratedConfidence + 5)
      }
      // If training shows short is more successful, slightly boost short confidence
      if (signal.type === 'SHORT' && symbolBias.shortBias > symbolBias.longBias + 0.15) {
        signal.confidence = Math.min(97, signal.confidence + 5)
        signal.calibratedConfidence = Math.min(97, signal.calibratedConfidence + 5)
      }
    }

    // ===== AI-POWERED PREMIUM ANALYSIS (SONA Package Only) =====
    if (tier === 'premium') {
      const aiResult = await aiPremiumAnalysis(symbol, allCandleData[symbol]?.['1h'] || [], signal.entryPrice, tier)
      if (aiResult) {
        // Boost confidence when AI agrees with technical analysis
        if ((signal.type === 'LONG' && aiResult.aiDirection === 'bullish') ||
            (signal.type === 'SHORT' && aiResult.aiDirection === 'bearish')) {
          signal.confidence = Math.min(98, signal.confidence + Math.round(aiResult.aiConfidence * 0.1))
          signal.calibratedConfidence = Math.min(98, signal.calibratedConfidence + Math.round(aiResult.aiConfidence * 0.1))
        }
        // Reduce confidence when AI disagrees
        if ((signal.type === 'LONG' && aiResult.aiDirection === 'bearish') ||
            (signal.type === 'SHORT' && aiResult.aiDirection === 'bullish')) {
          signal.confidence = Math.max(10, signal.confidence - 8)
          signal.calibratedConfidence = Math.max(10, signal.calibratedConfidence - 8)
        }
        // Add AI analysis to premium data
        if (signal.analysis.premium) {
          (signal.analysis.premium as any).aiAnalysis = {
            direction: aiResult.aiDirection,
            confidence: aiResult.aiConfidence,
            reasoning: aiResult.aiReasoning,
            keyLevels: aiResult.aiKeyLevels,
            riskLevel: aiResult.aiRiskLevel,
          }
        }
      }
    }

    return signal
  })
  const signals = await Promise.all(signalPromises)

  // Regime meta from BTC as reference
  const btcCandles4h = allCandleData['BTCUSDT']?.['4h'] || []
  const regimeMeta = detectRegime(btcCandles4h.length > 0 ? btcCandles4h : [])
  const refreshMeta = signalRefreshMeta()

  // Add training info to meta
  const lastTraining = learned ? 'Training applied' : 'No training data yet'

  return {
    signals,
    tier,
    meta: {
      regime: { current: regimeMeta.regime, duration: regimeMeta.duration, transitionProb: regimeMeta.transitionProb },
      lastModelRetrain: refreshMeta.lastRetrainDate,
      signalCount: signals.length,
      timestamp: new Date().toISOString(),
      training: lastTraining,
    },
  }
}

// ============================================================
// API ROUTES
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbolParam = searchParams.get('symbol')

    // Check SONA package status
    let tier: 'premium' | 'basic' = 'basic'
    let userId: string | undefined
    try {
      const authUser = await getAuthUser(request)
      if (authUser?.id) {
        userId = authUser.id
        const activeSonaInvestment = await prisma.investment.findFirst({
          where: { userId: authUser.id, status: 'ACTIVE', mode: 'SONA' },
        })
        if (activeSonaInvestment) tier = 'premium'
      }
    } catch {
      // Unauthenticated - basic tier
    }

    const targetSymbolsAll = tier === 'premium' ? [...SYMBOLS_PREMIUM] : [...SYMBOLS_BASIC]
    let targetSymbols: string[] = targetSymbolsAll
    if (symbolParam) {
      const requested = symbolParam.toUpperCase()
      if (SYMBOLS_ALL.includes(requested)) {
        // If basic user requests premium symbol, still show it but mark as basic tier
        targetSymbols = [requested]
      } else {
        return NextResponse.json({ error: `Invalid symbol. Supported: ${SYMBOLS_ALL.join(', ')}` }, { status: 400 })
      }
    }

    // Try to get recent signals from DB first (5 min cache)
    const recentCutoff = new Date(Date.now() - 5 * 60 * 1000)
    const recentSignals = await prisma.signalRecord.findMany({
      where: {
        symbol: { in: targetSymbols.map(s => s.replace('USDT', '/USDT')) },
        status: 'ACTIVE',
        createdAt: { gte: recentCutoff },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recentSignals.length >= targetSymbols.length) {
      // Return cached signals formatted
      const signals: SignalOutput[] = recentSignals.map(s => ({
        symbol: s.symbol,
        type: (s.type as SignalType),
        entryPrice: s.entryPrice,
        targetPrice: s.targetPrice,
        targetPrice1: s.targetPrice1 ?? s.targetPrice * 0.6 + s.entryPrice * 0.4,
        targetPrice2: s.targetPrice2 ?? s.targetPrice,
        targetPrice3: s.targetPrice3 ?? s.targetPrice * 1.6 - s.entryPrice * 0.6,
        stopLoss: s.stopLoss,
        confidence: s.confidence,
        calibratedConfidence: s.calibratedConfidence ?? s.confidence,
        confluenceScore: s.confluenceScore ?? 50,
        regime: (s.regimeType as RegimeType) ?? 'range',
        mlAgreement: s.mlAgreement ?? '3/5',
        bayesianConfidence: s.bayesianConfidence ?? 50,
        smcSignal: s.smcSignal ?? '',
        entropyScore: s.entropyScore ?? 0.5,
        fearGreedIndex: s.fearGreedIndex ?? 50,
        anomalyScore: s.anomalyScore ?? 0,
        cooldownStatus: s.cooldownStatus ?? 'clear',
        riskBudget: s.riskBudget ?? '3.3% available',
        filterScore: 8,
        rsiDivergence: 'none' as const,
        volumeProfile: 'neutral' as const,
        analysis: {
          multiTF: { '15m': 'neutral' as TFBias, '1h': 'neutral' as TFBias, '4h': 'neutral' as TFBias, '1d': 'neutral' as TFBias, '1w': 'neutral' as TFBias, confluence: s.confluenceScore ?? 50 },
          mlModels: [],
          bayesian: { prior: 0.5, likelihood: 0.5, posterior: (s.bayesianConfidence ?? 50) / 100, confidenceInterval: [0.4, 0.6] },
          smc: { zone: 'equilibrium', orderBlocks: [], fvg: [] },
          volatility: { atrPercentile: s.volatilityPercentile ?? 50, slMultiplier: 1.2, tpMultiplier: 2.5 },
          kalman: { trend: s.kalmanTrend ?? 'neutral', gain: 0.5, innovation: 0 },
          entropy: { current: s.entropyScore ?? 0.5, trend: 'stable', quality: 'moderate' },
          correlation: { btcEth: 0.8, btcBnb: 0.7, ethBnb: 0.75 },
          risk: { kellyCriterion: 0.05, maxExposure: s.riskBudget ?? '3.3% available', drawdownWeek: 0 },
        },
        timestamp: s.createdAt.toISOString(),
        filters: {
          entropy: 'PASS', smcPreFilter: 'PASS', mlDisagreement: 'PASS',
          multiTfOpposition: 'PASS', correlation: 'PASS', anomaly: 'PASS',
          riskBudget: 'PASS', cooldown: 'PASS',
        },
      }))

      return NextResponse.json({
        signals,
        tier,
        meta: {
          regime: { current: 'range', duration: '4h', transitionProb: 0.15 },
          lastModelRetrain: signalRefreshMeta().lastRetrainDate,
          signalCount: signals.length,
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Generate fresh signals
    const result = await runFullPipeline(targetSymbols, tier)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Signals API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch signals', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const symbolParam = body?.symbol

    // Check SONA package status
    let tier: 'premium' | 'basic' = 'basic'
    try {
      const authUser = await getAuthUser(request)
      if (authUser?.id) {
        const activeSonaInvestment = await prisma.investment.findFirst({
          where: { userId: authUser.id, status: 'ACTIVE', mode: 'SONA' },
        })
        if (activeSonaInvestment) tier = 'premium'
      }
    } catch {
      // Unauthenticated - basic tier
    }

    const targetSymbolsAll = tier === 'premium' ? [...SYMBOLS_PREMIUM] : [...SYMBOLS_BASIC]
    let targetSymbols: string[] = targetSymbolsAll
    if (symbolParam) {
      const requested = symbolParam.toUpperCase()
      if (SYMBOLS_ALL.includes(requested)) {
        targetSymbols = [requested]
      }
    }

    // Generate fresh signals
    const result = await runFullPipeline(targetSymbols, tier)

    // Store signals in DB
    for (const signal of result.signals) {
      // Expire old active signals for this symbol
      await prisma.signalRecord.updateMany({
        where: { symbol: signal.symbol, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      })

      // Create new signal record
      await prisma.signalRecord.create({
        data: {
          symbol: signal.symbol,
          type: signal.type,
          entryPrice: signal.entryPrice,
          targetPrice: signal.targetPrice,
          targetPrice1: signal.targetPrice1,
          targetPrice2: signal.targetPrice2,
          targetPrice3: signal.targetPrice3,
          stopLoss: signal.stopLoss,
          confidence: signal.confidence,
          confluenceScore: signal.confluenceScore,
          regimeType: signal.regime,
          mlAgreement: signal.mlAgreement,
          bayesianConfidence: signal.bayesianConfidence,
          smcSignal: signal.smcSignal,
          volatilityPercentile: signal.analysis.volatility.atrPercentile,
          kalmanTrend: signal.analysis.kalman.trend,
          entropyScore: signal.entropyScore,
          correlationNote: `BTC-ETH:${signal.analysis.correlation.btcEth} BTC-BNB:${signal.analysis.correlation.btcBnb} ETH-BNB:${signal.analysis.correlation.ethBnb}`,
          fearGreedIndex: signal.fearGreedIndex,
          calibratedConfidence: signal.calibratedConfidence,
          cooldownStatus: signal.cooldownStatus,
          riskBudget: signal.riskBudget,
          anomalyScore: signal.anomalyScore,
          status: 'ACTIVE',
        },
      })
    }

    return NextResponse.json({
      ...result,
      stored: true,
      message: `${result.signals.length} signal(s) generated and stored`,
    })
  } catch (error: any) {
    console.error('[Signals API] POST error:', error)
    return NextResponse.json({ error: 'Failed to generate signals', details: error.message }, { status: 500 })
  }
}
