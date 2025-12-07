/**
 * KV Caching Layer
 *
 * Reduces KV reads/writes by:
 * 1. In-memory LRU cache (persists for worker lifetime)
 * 2. Write batching with delayed flush
 * 3. Operation counting for monitoring
 */

// In-memory cache with LRU eviction
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

const MEMORY_CACHE_MAX_SIZE = 100;
const MEMORY_CACHE_DEFAULT_TTL = 60000; // 1 minute

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed for LRU
    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = MEMORY_CACHE_DEFAULT_TTL): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= MEMORY_CACHE_MAX_SIZE) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      lastAccessed: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global memory cache instance
const memoryCache = new MemoryCache();

// Operation counter for monitoring
interface KVMetrics {
  reads: number;
  writes: number;
  deletes: number;
  cacheHits: number;
  cacheMisses: number;
  lastReset: number;
}

const metrics: KVMetrics = {
  reads: 0,
  writes: 0,
  deletes: 0,
  cacheHits: 0,
  cacheMisses: 0,
  lastReset: Date.now(),
};

// Reset metrics daily
function checkMetricsReset(): void {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - metrics.lastReset > dayMs) {
    metrics.reads = 0;
    metrics.writes = 0;
    metrics.deletes = 0;
    metrics.cacheHits = 0;
    metrics.cacheMisses = 0;
    metrics.lastReset = now;
  }
}

export function getKVMetrics(): KVMetrics {
  checkMetricsReset();
  return { ...metrics };
}

// Write queue for batching
interface WriteQueueEntry {
  key: string;
  value: string;
  expirationTtl?: number;
  addedAt: number;
}

const writeQueue: WriteQueueEntry[] = [];
const WRITE_BATCH_DELAY = 5000; // 5 seconds
const WRITE_BATCH_MAX_SIZE = 10;
let writeFlushTimeout: ReturnType<typeof setTimeout> | null = null;

async function flushWriteQueue(kv: KVNamespace): Promise<void> {
  if (writeQueue.length === 0) return;

  const batch = writeQueue.splice(0, WRITE_BATCH_MAX_SIZE);

  for (const entry of batch) {
    try {
      await kv.put(entry.key, entry.value, entry.expirationTtl ? { expirationTtl: entry.expirationTtl } : undefined);
      metrics.writes++;
    } catch (err) {
      console.error(`KV write failed for key ${entry.key}:`, err);
    }
  }

  // Schedule next flush if there are more items
  if (writeQueue.length > 0) {
    scheduleFlush(kv);
  }
}

function scheduleFlush(kv: KVNamespace): void {
  if (writeFlushTimeout) return;
  writeFlushTimeout = setTimeout(() => {
    writeFlushTimeout = null;
    flushWriteQueue(kv).catch(console.error);
  }, WRITE_BATCH_DELAY);
}

/**
 * Cached KV wrapper that reduces operations
 */
export const cachedKV = {
  /**
   * Get value with memory cache layer
   */
  async get<T>(kv: KVNamespace, key: string, options?: { cacheTtlMs?: number }): Promise<T | null> {
    checkMetricsReset();

    // Check memory cache first
    const cached = memoryCache.get<T>(key);
    if (cached !== null) {
      metrics.cacheHits++;
      return cached;
    }

    // Read from KV
    metrics.cacheMisses++;
    metrics.reads++;
    const data = await kv.get(key);
    if (!data) return null;

    try {
      const parsed = JSON.parse(data) as T;
      // Store in memory cache
      memoryCache.set(key, parsed, options?.cacheTtlMs);
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Get value as string with caching
   */
  async getString(kv: KVNamespace, key: string, options?: { cacheTtlMs?: number }): Promise<string | null> {
    checkMetricsReset();

    // Check memory cache first
    const cached = memoryCache.get<string>(key);
    if (cached !== null) {
      metrics.cacheHits++;
      return cached;
    }

    metrics.cacheMisses++;
    metrics.reads++;
    const data = await kv.get(key);
    if (data !== null) {
      memoryCache.set(key, data, options?.cacheTtlMs);
    }
    return data;
  },

  /**
   * Put value with optional batching
   * @param immediate - if true, writes immediately instead of batching
   */
  async put(
    kv: KVNamespace,
    key: string,
    value: string,
    options?: { expirationTtl?: number; immediate?: boolean }
  ): Promise<void> {
    checkMetricsReset();

    // Update memory cache
    try {
      const parsed: unknown = JSON.parse(value);
      memoryCache.set(key, parsed, (options?.expirationTtl || 3600) * 1000);
    } catch {
      memoryCache.set(key, value, (options?.expirationTtl || 3600) * 1000);
    }

    if (options?.immediate) {
      // Write immediately
      await kv.put(key, value, options.expirationTtl ? { expirationTtl: options.expirationTtl } : undefined);
      metrics.writes++;
    } else {
      // Add to write queue
      writeQueue.push({
        key,
        value,
        expirationTtl: options?.expirationTtl,
        addedAt: Date.now(),
      });

      // Flush immediately if queue is full
      if (writeQueue.length >= WRITE_BATCH_MAX_SIZE) {
        await flushWriteQueue(kv);
      } else {
        scheduleFlush(kv);
      }
    }
  },

  /**
   * Delete value
   */
  async delete(kv: KVNamespace, key: string): Promise<void> {
    checkMetricsReset();
    memoryCache.delete(key);
    await kv.delete(key);
    metrics.deletes++;
  },

  /**
   * Force flush any pending writes
   */
  async flush(kv: KVNamespace): Promise<void> {
    if (writeFlushTimeout) {
      clearTimeout(writeFlushTimeout);
      writeFlushTimeout = null;
    }
    await flushWriteQueue(kv);
  },

  /**
   * Clear memory cache (for testing)
   */
  clearCache(): void {
    memoryCache.clear();
  },
};

// Frequently accessed keys that benefit from aggressive caching
export const CACHE_TTL = {
  SESSION: 60000, // 1 minute
  USER_STATS: 300000, // 5 minutes
  LEADERBOARD: 900000, // 15 minutes
  SCOREBOARD: 3600000, // 1 hour
  RECENT_PLAYLISTS: 60000, // 1 minute
  GENRE_CACHE: 3600000, // 1 hour
} as const;
