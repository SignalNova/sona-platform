/**
 * MarketMover — Smart market price manipulation algorithm
 *
 * Provides a state-machine-driven engine for gradually adjusting candlestick
 * close prices based on volume imbalance.  All modifications are wrapped in
 * Brownian noise (Box-Muller) and smoothed via an EMA so that changes blend
 * into normal market variation.
 *
 * Phase lifecycle:
 *   ACCUMULATING  →  DISTRIBUTING  →  COOLING  →  ACCUMULATING …
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketMoverConfig {
  speed: number;           // ms between operations (100-5000)
  intensity: number;       // percentage impact (0.01-1.0)
  enabled: boolean;        // master switch
  maxDeviation: number;    // max % deviation from real price (default 2)
  smoothingFactor: number; // EMA smoothing (0.01-0.5, default 0.1)
  noiseScale: number;      // Brownian noise scale (0.01-1.0, default 0.3)
}

export enum ManipulationPhase {
  ACCUMULATING = 'ACCUMULATING',
  DISTRIBUTING = 'DISTRIBUTING',
  COOLING = 'COOLING',
}

export interface VolumeImbalanceResult {
  direction: number;   // -1 (push down) | 0 (neutral) | +1 (push up)
  magnitude: number;   // 0-1 how strong the imbalance is
  buyVolume: number;
  sellVolume: number;
  ratio: number;       // buyVolume / sellVolume (or inverse)
}

export interface ManipulationStats {
  totalAdjustments: number;
  avgAdjustment: number;
  maxAdjustment: number;
  manipulationEvents: number;
}

export interface MarketMoverStatus {
  enabled: boolean;
  phase: ManipulationPhase;
  config: MarketMoverConfig;
  cumulativeOffset: number;
  cumulativeOffsetPct: number;
  ema: number;
  stats: ManipulationStats;
  lastOperationAt: number | null;
  upTime: number;       // ms since instantiation
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: MarketMoverConfig = {
  speed: 1000,
  intensity: 0.1,
  enabled: false,
  maxDeviation: 2,
  smoothingFactor: 0.1,
  noiseScale: 0.3,
};

/** ~0.0001 % of price — the base unit of per-candle adjustment */
const BASE_DELTA_PCT = 0.000_001; // 0.0001 %

/** Thresholds for phase transitions */
const ACCUMULATION_THRESHOLD = 5;   // candles spent accumulating before distributing
const DISTRIBUTION_THRESHOLD = 8;   // candles spent distributing before cooling
const COOLING_THRESHOLD = 3;        // candles spent cooling before accumulating again

/** Volume imbalance ratio that triggers directional movement */
const IMBALANCE_TRIGGER_RATIO = 2.0;

// ---------------------------------------------------------------------------
// MarketMover class
// ---------------------------------------------------------------------------

export class MarketMover {
  // Configuration
  private config: MarketMoverConfig;

  // Internal state
  private cumulativeOffset: number = 0;
  private ema: number = 0;
  private phase: ManipulationPhase = ManipulationPhase.ACCUMULATING;
  private phaseCounter: number = 0;

  // Stats
  private stats: ManipulationStats = {
    totalAdjustments: 0,
    avgAdjustment: 0,
    maxAdjustment: 0,
    manipulationEvents: 0,
  };

  // Running total for average computation
  private adjustmentSum: number = 0;

  // Timestamps
  private lastOperationTime: number | null = null;
  private readonly createdAt: number = Date.now();

  // Cached volume imbalance (set externally or computed in-processCandles)
  private lastImbalance: VolumeImbalanceResult | null = null;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(config: { speed: number; intensity: number; enabled: boolean }) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Process an array of candle data and return a new array with manipulated
   * close prices.  The original array is NOT mutated.
   */
  processCandles(candles: CandleData[]): CandleData[] {
    if (!this.config.enabled || candles.length === 0) {
      return candles;
    }

    const now = Date.now();

    // Respect the speed gate — skip if called too soon
    if (this.lastOperationTime !== null && now - this.lastOperationTime < this.config.speed) {
      return candles;
    }

    const result: CandleData[] = [];

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const referencePrice = candle.close;

      // Check deviation from real price
      const currentDeviationPct = this.deviationPct(referencePrice);

      if (Math.abs(currentDeviationPct) >= this.config.maxDeviation) {
        // Already at max deviation — only allow adjustments that reduce the offset
        const adjustment = this.computeAdjustment(referencePrice, /* forceNeutral */ true);
        result.push(this.applyAdjustment(candle, adjustment));
      } else {
        const adjustment = this.computeAdjustment(referencePrice, false);
        result.push(this.applyAdjustment(candle, adjustment));
      }
    }

    this.lastOperationTime = now;
    return result;
  }

  /**
   * Dynamically update configuration.  Partial updates are merged.
   */
  updateConfig(partial: Partial<MarketMoverConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
    };

    // Clamp values to valid ranges
    this.config.speed = clamp(this.config.speed, 100, 5000);
    this.config.intensity = clamp(this.config.intensity, 0.01, 1.0);
    this.config.maxDeviation = clamp(this.config.maxDeviation, 0.1, 10);
    this.config.smoothingFactor = clamp(this.config.smoothingFactor, 0.01, 0.5);
    this.config.noiseScale = clamp(this.config.noiseScale, 0.01, 1.0);
  }

  /**
   * Return a snapshot of the current status, config, and stats.
   */
  getStatus(): MarketMoverStatus {
    // Use the last known reference price for offset-pct, default 0 if none
    const refPrice = this.lastReferencePrice ?? 1;
    return {
      enabled: this.config.enabled,
      phase: this.phase,
      config: { ...this.config },
      cumulativeOffset: this.cumulativeOffset,
      cumulativeOffsetPct: this.deviationPct(refPrice),
      ema: this.ema,
      stats: { ...this.stats },
      lastOperationAt: this.lastOperationTime,
      upTime: Date.now() - this.createdAt,
    };
  }

  /**
   * Analyse the imbalance between buy and sell volume.
   *
   * Logic:
   *   - If buyVolume >> sellVolume  →  direction = -1  (push price DOWN)
   *   - If sellVolume >> buyVolume  →  direction = +1  (push price UP)
   *   - magnitude reflects how extreme the imbalance is
   */
  calculateVolumeImbalance(buyVolume: number, sellVolume: number): VolumeImbalanceResult {
    const safeBuy = Math.max(buyVolume, 0);
    const safeSell = Math.max(sellVolume, 0);
    const total = safeBuy + safeSell;

    if (total === 0) {
      return { direction: 0, magnitude: 0, buyVolume: safeBuy, sellVolume: safeSell, ratio: 1 };
    }

    const ratio = safeBuy > 0 && safeSell > 0
      ? safeBuy / safeSell
      : safeBuy > 0
        ? Infinity
        : safeSell > 0
          ? 0
          : 1;

    let direction: number;
    let magnitude: number;

    if (safeBuy > safeSell * IMBALANCE_TRIGGER_RATIO) {
      // Heavy buying → push price down to accumulate cheaper
      direction = -1;
      magnitude = Math.min(1, (safeBuy / safeSell - 1) / (IMBALANCE_TRIGGER_RATIO - 1));
    } else if (safeSell > safeBuy * IMBALANCE_TRIGGER_RATIO) {
      // Heavy selling → push price up to distribute at higher levels
      direction = 1;
      magnitude = Math.min(1, (safeSell / safeBuy - 1) / (IMBALANCE_TRIGGER_RATIO - 1));
    } else {
      direction = 0;
      magnitude = Math.abs(safeBuy - safeSell) / total;
    }

    const result: VolumeImbalanceResult = {
      direction,
      magnitude: clamp(magnitude, 0, 1),
      buyVolume: safeBuy,
      sellVolume: safeSell,
      ratio: isFinite(ratio) ? ratio : safeBuy > 0 ? 9999 : 0,
    };

    // Cache for internal use
    this.lastImbalance = result;
    return result;
  }

  // -------------------------------------------------------------------------
  // Core algorithm (private)
  // -------------------------------------------------------------------------

  private lastReferencePrice: number | null = null;

  /**
   * Compute the price adjustment delta for a single candle.
   *
   * Formula:
   *   delta = -direction * intensity * baseDelta + brownianNoise
   *
   * Where baseDelta ≈ 0.0001% of the price.
   */
  private computeAdjustment(referencePrice: number, forceNeutral: boolean): number {
    this.lastReferencePrice = referencePrice;

    // Advance the state machine
    this.advancePhase();

    // During COOLING phase, make only tiny mean-reverting adjustments
    if (this.phase === ManipulationPhase.COOLING) {
      const revertDelta = -this.cumulativeOffset * 0.05; // gently pull back toward 0
      const tinyNoise = this.config.noiseScale * this.gaussianRandom() * referencePrice * BASE_DELTA_PCT * 0.2;
      return revertDelta + tinyNoise;
    }

    if (forceNeutral) {
      // Mean-revert toward zero offset
      const revertDelta = -this.cumulativeOffset * 0.1;
      const noise = this.config.noiseScale * this.gaussianRandom() * referencePrice * BASE_DELTA_PCT * 0.3;
      return revertDelta + noise;
    }

    // Get imbalance direction (use cached if available, else neutral)
    const imbalance = this.lastImbalance ?? { direction: 0, magnitude: 0 };
    const direction = imbalance.direction;
    const magnitude = imbalance.magnitude;

    // Phase multiplier
    const phaseMultiplier = this.phase === ManipulationPhase.ACCUMULATING
      ? 0.4   // subtle during accumulation
      : 1.0;  // full force during distribution

    // Base delta: ~0.0001% of price
    const baseDelta = referencePrice * BASE_DELTA_PCT;

    // Directional component: push opposite to crowd
    const directionalDelta = -direction * this.config.intensity * magnitude * phaseMultiplier * baseDelta;

    // Brownian noise via Box-Muller
    const brownianNoise = this.config.noiseScale * this.gaussianRandom() * baseDelta;

    // Total raw delta
    let delta = directionalDelta + brownianNoise;

    // Apply EMA smoothing to avoid sudden jumps
    const smoothing = this.config.smoothingFactor;
    const smoothedDelta = smoothing * delta + (1 - smoothing) * this.ema;

    // Update EMA
    this.ema = smoothedDelta;

    // Add lag simulation — dampen large deltas
    const maxSingleDelta = referencePrice * 0.0005; // 0.05% max per candle
    const clampedDelta = clamp(smoothedDelta, -maxSingleDelta, maxSingleDelta);

    // Record stats
    this.recordAdjustment(clampedDelta);

    return clampedDelta;
  }

  /**
   * Apply a computed adjustment delta to a candle, returning a new CandleData.
   * Open / high / low are adjusted proportionally to maintain consistency.
   */
  private applyAdjustment(candle: CandleData, delta: number): CandleData {
    const newClose = candle.close + delta;

    // Maintain high >= close and low <= close consistency
    const spread = candle.high - candle.low;
    const ratio = spread > 0 ? (newClose - candle.low) / spread : 0.5;

    // Shift open proportionally (smaller shift than close)
    const openDelta = delta * 0.3;
    const newOpen = candle.open + openDelta;

    // Adjust high/low to encompass the new close
    const newHigh = Math.max(candle.high + delta * 0.5, newClose, newOpen);
    const newLow = Math.min(candle.low + delta * 0.5, newClose, newOpen);

    // Update cumulative offset
    this.cumulativeOffset += delta;

    return {
      time: candle.time,
      open: newOpen,
      high: newHigh,
      low: newLow,
      close: newClose,
      volume: candle.volume,
    };
  }

  // -------------------------------------------------------------------------
  // State machine
  // -------------------------------------------------------------------------

  private advancePhase(): void {
    this.phaseCounter++;

    switch (this.phase) {
      case ManipulationPhase.ACCUMULATING:
        if (this.phaseCounter >= ACCUMULATION_THRESHOLD) {
          this.transitionTo(ManipulationPhase.DISTRIBUTING);
        }
        break;

      case ManipulationPhase.DISTRIBUTING:
        if (this.phaseCounter >= DISTRIBUTION_THRESHOLD) {
          this.transitionTo(ManipulationPhase.COOLING);
          this.stats.manipulationEvents++;
        }
        break;

      case ManipulationPhase.COOLING:
        if (this.phaseCounter >= COOLING_THRESHOLD) {
          this.transitionTo(ManipulationPhase.ACCUMULATING);
        }
        break;
    }
  }

  private transitionTo(newPhase: ManipulationPhase): void {
    this.phase = newPhase;
    this.phaseCounter = 0;
  }

  // -------------------------------------------------------------------------
  // Deviation tracking
  // -------------------------------------------------------------------------

  private deviationPct(referencePrice: number): number {
    if (referencePrice === 0) return 0;
    return (this.cumulativeOffset / referencePrice) * 100;
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  private recordAdjustment(delta: number): void {
    this.stats.totalAdjustments++;
    this.adjustmentSum += Math.abs(delta);
    this.stats.avgAdjustment = this.adjustmentSum / this.stats.totalAdjustments;
    this.stats.maxAdjustment = Math.max(this.stats.maxAdjustment, Math.abs(delta));
  }

  // -------------------------------------------------------------------------
  // Random number generation — Box-Muller transform
  // -------------------------------------------------------------------------

  /**
   * Generate a standard Gaussian random variable using the Box-Muller transform.
   * Produces normally-distributed values with mean 0 and standard deviation 1.
   */
  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Singleton instance (disabled by default)
// ---------------------------------------------------------------------------

export const marketMover = new MarketMover({
  speed: 1000,
  intensity: 0.1,
  enabled: false,
});
