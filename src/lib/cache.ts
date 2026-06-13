// In-memory cache with TTL support
class MemoryCache {
  private cache = new Map<string, { value: unknown; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number = 60000): void {
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) this.cache.delete(key);
    }
  }

  // Get or set pattern - compute value if not cached
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlMs: number = 60000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }

  // Cache stats
  getStats() {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

export const cache = new MemoryCache();

// Helper for common cache key patterns
export const CacheKeys = {
  marketPrices: () => 'market:prices',
  marketPrice: (symbol: string) => `market:price:${symbol}`,
  userBalance: (userId: string) => `user:balance:${userId}`,
  platformStats: () => 'admin:stats',
  botControl: () => 'bot:control',
  engineConfig: () => 'engine:config',
  referralTree: (userId: string) => `referral:tree:${userId}`,
};
