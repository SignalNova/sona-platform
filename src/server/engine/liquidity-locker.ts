// ============================================================================
// LiquidityLocker — Spoofing / Liquidity Locking Engine
// ============================================================================
// Generates realistic-looking spoof orders around the current price to create
// the illusion of liquidity walls. Orders are automatically cancelled and
// repositioned if the real market price approaches them, ensuring they never
// actually execute while maintaining a persistent presence in the order book.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpoofOrder {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  amount: number;
  createdAt: Date;
  distancePercent: number; // how far from current price when created
  status: 'ACTIVE' | 'CANCELLED' | 'REPLACED';
}

export interface LiquidityLockerConfig {
  enabled: boolean;
  orderSize: number;           // Size of spoof orders in USD (100-100000, default 5000)
  distanceFromPrice: number;   // % distance from current price (0.05-2.0, default 0.3)
  maxOrders: number;           // Max spoof orders per side (1-10, default 3)
  refreshInterval: number;     // ms between order refreshes (1000-30000, default 5000)
  autoCancelThreshold: number; // % distance to auto-cancel (0.01-0.5, default 0.05)
}

export interface LiquidityLockerStatus {
  enabled: boolean;
  config: LiquidityLockerConfig;
  activeOrders: SpoofOrder[];
  stats: {
    totalOrdersCreated: number;
    totalOrdersCancelled: number;
    currentActiveOrders: number;
    avgSize: number;
  };
  priceHistory: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Generate a random float in [min, max). */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// LiquidityLocker Class
// ---------------------------------------------------------------------------

export class LiquidityLocker {
  // Configuration
  private config: LiquidityLockerConfig;

  // Internal state
  private activeOrders: Map<string, SpoofOrder> = new Map();
  private priceHistory: number[] = [];
  private readonly MAX_PRICE_HISTORY = 100;

  // Statistics
  private stats = {
    totalOrdersCreated: 0,
    totalOrdersCancelled: 0,
    currentActiveOrders: 0,
    avgSize: 0,
  };

  // Cumulative tracking for average size
  private totalSizeSum = 0;

  // Refresh timer handle
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // Last known symbol used for refresh cycle
  private lastSymbol: string = '';
  private lastPrice: number = 0;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(initialConfig: { enabled: boolean; orderSize: number; distanceFromPrice: number }) {
    this.config = {
      enabled: initialConfig.enabled,
      orderSize: clamp(initialConfig.orderSize, 100, 100000),
      distanceFromPrice: clamp(initialConfig.distanceFromPrice, 0.05, 2.0),
      maxOrders: 3,
      refreshInterval: 5000,
      autoCancelThreshold: 0.05,
    };
  }

  // ---------------------------------------------------------------------------
  // Order ID Generation
  // ---------------------------------------------------------------------------

  private generateOrderId(): string {
    const chars = '0123456789ABCDEF';
    let id = '';
    for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * 16)];
    return id;
  }

  // ---------------------------------------------------------------------------
  // Price History
  // ---------------------------------------------------------------------------

  private recordPrice(price: number): void {
    this.priceHistory.push(price);
    if (this.priceHistory.length > this.MAX_PRICE_HISTORY) {
      this.priceHistory.shift();
    }
  }

  // ---------------------------------------------------------------------------
  // Order Size Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate a realistic-looking order size with random variation around the
   * configured `orderSize`. The variation is ±30 % to avoid uniform sizes
   * that could be fingerprinted. We also snap to common lot sizes to look
   * more natural.
   */
  private generateOrderSize(): number {
    const baseSize = this.config.orderSize;
    // ±30 % random variation
    const variation = randomInRange(-0.3, 0.3);
    let size = baseSize * (1 + variation);

    // Snap to realistic precision (2 decimal places)
    size = Math.round(size * 100) / 100;

    // Ensure minimum of $10
    size = Math.max(size, 10);

    return size;
  }

  // ---------------------------------------------------------------------------
  // Distance Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate a distance from the current price with random jitter so that
   * orders don't all sit at exactly the same offset. Returns a percentage
   * value.
   */
  private generateDistance(): number {
    const base = this.config.distanceFromPrice;
    // Add ±40 % jitter around the base distance
    const jitter = randomInRange(-0.4, 0.4);
    const distance = base * (1 + jitter);
    return clamp(distance, 0.05, 2.0);
  }

  // ---------------------------------------------------------------------------
  // Price Formatting
  // ---------------------------------------------------------------------------

  /**
   * Round a price to a realistic number of decimal places based on magnitude.
   * - price >= 1000  → 2 decimals
   * - price >= 1     → 4 decimals
   * - price < 1      → 6 decimals
   */
  private formatPrice(price: number): number {
    if (price >= 1000) return Math.round(price * 100) / 100;
    if (price >= 1) return Math.round(price * 10000) / 10000;
    return Math.round(price * 1000000) / 1000000;
  }

  // ---------------------------------------------------------------------------
  // Core: Generate Spoof Orders
  // ---------------------------------------------------------------------------

  /**
   * Generate fake buy orders just above the current price and fake sell orders
   * just below it. The orders are spaced with random variation to appear
   * natural.
   *
   * - BUY orders are placed **above** the current price (they act as a sell
   *   wall / resistance in the book).
   * - SELL orders are placed **below** the current price (they act as a buy
   *   wall / support in the book).
   *
   * This mirrors how a spoofing system would paint liquidity to influence
   * other traders: large buy walls below price signal support, large sell
   * walls above signal resistance — but neither side ever fills.
   */
  generateSpoofOrders(currentPrice: number, symbol: string): SpoofOrder[] {
    if (!this.config.enabled) {
      return [];
    }

    this.recordPrice(currentPrice);
    this.lastSymbol = symbol;
    this.lastPrice = currentPrice;

    const orders: SpoofOrder[] = [];
    const maxPerSide = this.config.maxOrders;

    // Generate BUY orders (placed above current price — spoof ask wall)
    for (let i = 0; i < maxPerSide; i++) {
      const distance = this.generateDistance();
      // Stagger orders: each subsequent order is slightly further away
      const staggerMultiplier = 1 + i * randomInRange(0.3, 0.8);
      const effectiveDistance = distance * staggerMultiplier;
      const priceOffset = currentPrice * (effectiveDistance / 100);
      const price = this.formatPrice(currentPrice + priceOffset);
      const amount = this.generateOrderSize();

      const order = this.createOrder(symbol, 'BUY', price, amount, effectiveDistance);
      orders.push(order);
    }

    // Generate SELL orders (placed below current price — spoof bid wall)
    for (let i = 0; i < maxPerSide; i++) {
      const distance = this.generateDistance();
      const staggerMultiplier = 1 + i * randomInRange(0.3, 0.8);
      const effectiveDistance = distance * staggerMultiplier;
      const priceOffset = currentPrice * (effectiveDistance / 100);
      const price = this.formatPrice(currentPrice - priceOffset);
      // Ensure price stays positive
      const finalPrice = Math.max(price, currentPrice * 0.01);
      const amount = this.generateOrderSize();

      const order = this.createOrder(symbol, 'SELL', finalPrice, amount, effectiveDistance);
      orders.push(order);
    }

    // Start the automatic refresh cycle if not already running
    this.startRefreshCycle();

    return orders;
  }

  // ---------------------------------------------------------------------------
  // Core: Update Orders
  // ---------------------------------------------------------------------------

  /**
   * Scan all active orders. If the current price has moved within
   * `autoCancelThreshold` % of an order's price, cancel that order and
   * generate a replacement at a new position further from the current price.
   */
  updateOrders(currentPrice: number, symbol: string): SpoofOrder[] {
    if (!this.config.enabled) {
      return [];
    }

    this.recordPrice(currentPrice);
    this.lastPrice = currentPrice;
    this.lastSymbol = symbol;

    const replacedOrders: SpoofOrder[] = [];
    const ordersToCancel: string[] = [];

    this.activeOrders.forEach((order, orderId) => {
      if (order.status !== 'ACTIVE') return;
      if (order.symbol !== symbol) return;

      const distancePercent = Math.abs(currentPrice - order.price) / currentPrice * 100;

      // If the real price has approached too close, cancel and replace
      if (distancePercent <= this.config.autoCancelThreshold) {
        ordersToCancel.push(orderId);

        // Determine replacement side
        const type: 'BUY' | 'SELL' = order.type;

        // Generate replacement order at a new, further distance
        const newDistance = this.generateDistance();
        // Ensure the new distance is at least 2× the autoCancelThreshold so it
        // doesn't immediately trigger another replacement
        const minDistance = this.config.autoCancelThreshold * 2;
        const effectiveDistance = Math.max(newDistance, minDistance);
        const priceOffset = currentPrice * (effectiveDistance / 100);

        let newPrice: number;
        if (type === 'BUY') {
          newPrice = this.formatPrice(currentPrice + priceOffset);
        } else {
          newPrice = this.formatPrice(currentPrice - priceOffset);
          newPrice = Math.max(newPrice, currentPrice * 0.01);
        }

        const newAmount = this.generateOrderSize();
        const newOrder = this.createOrder(symbol, type, newPrice, newAmount, effectiveDistance);
        replacedOrders.push(newOrder);
      }
    });

    // Cancel the flagged orders
    for (const orderId of ordersToCancel) {
      this.cancelOrder(orderId, 'REPLACED');
    }

    return replacedOrders;
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Dynamically update configuration. Values are clamped to their allowed
   * ranges. If `enabled` is toggled off, all active orders are cancelled and
   * the refresh cycle is stopped.
   */
  updateConfig(partial: Partial<LiquidityLockerConfig>): void {
    if (partial.enabled !== undefined) {
      this.config.enabled = partial.enabled;

      if (!partial.enabled) {
        // Cancel all active orders and stop the refresh cycle
        this.cancelAllOrders();
        this.stopRefreshCycle();
      }
    }

    if (partial.orderSize !== undefined) {
      this.config.orderSize = clamp(partial.orderSize, 100, 100000);
    }

    if (partial.distanceFromPrice !== undefined) {
      this.config.distanceFromPrice = clamp(partial.distanceFromPrice, 0.05, 2.0);
    }

    if (partial.maxOrders !== undefined) {
      this.config.maxOrders = clamp(partial.maxOrders, 1, 10);
    }

    if (partial.refreshInterval !== undefined) {
      this.config.refreshInterval = clamp(partial.refreshInterval, 1000, 30000);
      // Restart the refresh cycle with the new interval if it's running
      if (this.refreshTimer) {
        this.stopRefreshCycle();
        this.startRefreshCycle();
      }
    }

    if (partial.autoCancelThreshold !== undefined) {
      this.config.autoCancelThreshold = clamp(partial.autoCancelThreshold, 0.01, 0.5);
    }
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  /**
   * Return a snapshot of the current state including active orders, stats,
   * and configuration.
   */
  getStatus(): LiquidityLockerStatus {
    const activeOrderList = Array.from(this.activeOrders.values())
      .filter((o) => o.status === 'ACTIVE');

    return {
      enabled: this.config.enabled,
      config: { ...this.config },
      activeOrders: activeOrderList,
      stats: {
        totalOrdersCreated: this.stats.totalOrdersCreated,
        totalOrdersCancelled: this.stats.totalOrdersCancelled,
        currentActiveOrders: activeOrderList.length,
        avgSize: this.stats.totalOrdersCreated > 0
          ? Math.round((this.totalSizeSum / this.stats.totalOrdersCreated) * 100) / 100
          : 0,
      },
      priceHistory: [...this.priceHistory],
    };
  }

  // ---------------------------------------------------------------------------
  // Remove Order
  // ---------------------------------------------------------------------------

  /**
   * Remove a specific order by its ID. Returns `true` if the order was found
   * and removed, `false` otherwise.
   */
  removeOrder(orderId: string): boolean {
    return this.cancelOrder(orderId, 'CANCELLED');
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Create a single spoof order, register it in the active map, and update
   * stats.
   */
  private createOrder(
    symbol: string,
    type: 'BUY' | 'SELL',
    price: number,
    amount: number,
    distancePercent: number,
  ): SpoofOrder {
    const order: SpoofOrder = {
      id: this.generateOrderId(),
      symbol,
      type,
      price,
      amount,
      createdAt: new Date(),
      distancePercent: Math.round(distancePercent * 10000) / 10000,
      status: 'ACTIVE',
    };

    this.activeOrders.set(order.id, order);
    this.stats.totalOrdersCreated += 1;
    this.totalSizeSum += amount;

    return order;
  }

  /**
   * Cancel a single order. Sets its status and updates cancellation stats.
   * Returns `true` if the order was found.
   */
  private cancelOrder(orderId: string, status: 'CANCELLED' | 'REPLACED'): boolean {
    const order = this.activeOrders.get(orderId);
    if (!order) return false;

    order.status = status;
    this.activeOrders.delete(orderId);
    this.stats.totalOrdersCancelled += 1;

    return true;
  }

  /**
   * Cancel all active orders in one shot.
   */
  private cancelAllOrders(): void {
    const ids = Array.from(this.activeOrders.keys());
    for (const orderId of ids) {
      this.cancelOrder(orderId, 'CANCELLED');
    }
  }

  // ---------------------------------------------------------------------------
  // Refresh Cycle
  // ---------------------------------------------------------------------------

  /**
   * Start a periodic refresh that cancels stale orders and generates fresh
   * ones at updated positions. This keeps the order book looking alive even
   * if `updateOrders` is not called externally.
   */
  private startRefreshCycle(): void {
    if (this.refreshTimer) return; // already running

    this.refreshTimer = setInterval(() => {
      if (!this.config.enabled || this.lastPrice <= 0 || !this.lastSymbol) {
        return;
      }

      // Simulate slight price drift for realism (±0.05 %)
      const drift = this.lastPrice * randomInRange(-0.0005, 0.0005);
      const simulatedPrice = this.lastPrice + drift;

      // Cancel all existing orders and regenerate
      this.cancelAllOrders();
      this.generateSpoofOrders(simulatedPrice, this.lastSymbol);
    }, this.config.refreshInterval);
  }

  /**
   * Stop the periodic refresh cycle.
   */
  private stopRefreshCycle(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

export const liquidityLocker = new LiquidityLocker({
  enabled: false,
  orderSize: 5000,
  distanceFromPrice: 0.3,
});
