/**
 * Mock KV Namespace Implementation
 *
 * In-memory implementation of Cloudflare KV that mimics the real API.
 * Used for E2E tests to avoid burning Cloudflare KV credits.
 *
 * Features:
 * - Full KVNamespace interface (get, put, delete, list)
 * - TTL/expiration support
 * - Test utilities (seed, clear, snapshot, operation log)
 */

interface KVNamespacePutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

interface KVNamespaceListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface KVNamespaceListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
  list_complete: boolean;
  cursor?: string;
}

interface MockKVEntry {
  value: string;
  expiresAt: number | null;
  metadata?: Record<string, unknown>;
}

interface KVOperation {
  op: 'get' | 'put' | 'delete' | 'list';
  key: string;
  timestamp: number;
  success: boolean;
}

/**
 * Metrics tracking for KV operations
 * Matches the real kv-cache layer metrics format
 */
export interface KVMetrics {
  reads: number;
  writes: number;
  deletes: number;
  cacheHits: number;
  cacheMisses: number;
  lastReset: number;
}

export class MockKVNamespace {
  private store = new Map<string, MockKVEntry>();
  private operationLog: KVOperation[] = [];
  private metrics: KVMetrics = {
    reads: 0,
    writes: 0,
    deletes: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastReset: Date.now(),
  };
  // Simple in-memory cache for simulating kv-cache layer
  private memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

  /**
   * Get a value from the store
   */
  async get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null | unknown> {
    this.log('get', key);

    // Check memory cache first (simulates kv-cache layer)
    const cached = this.memoryCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.metrics.cacheHits++;
      return cached.value;
    }

    // Cache miss - read from "KV"
    this.metrics.cacheMisses++;
    this.metrics.reads++;

    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    if (options?.type === 'json') {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }

    return entry.value;
  }

  /**
   * Get with metadata
   */
  async getWithMetadata<T = unknown>(
    key: string,
    options?: { type?: 'text' | 'json' }
  ): Promise<{ value: T | null; metadata: Record<string, unknown> | null }> {
    this.log('get', key);

    const entry = this.store.get(key);

    if (!entry) {
      return { value: null, metadata: null };
    }

    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return { value: null, metadata: null };
    }

    let value: T | null = entry.value as unknown as T;
    if (options?.type === 'json') {
      try {
        value = JSON.parse(entry.value) as T;
      } catch {
        value = null;
      }
    }

    return { value, metadata: entry.metadata || null };
  }

  /**
   * Store a value
   */
  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVNamespacePutOptions): Promise<void> {
    this.log('put', key);
    this.metrics.writes++;

    let expiresAt: number | null = null;

    if (options?.expirationTtl) {
      expiresAt = Date.now() + options.expirationTtl * 1000;
    } else if (options?.expiration) {
      expiresAt = options.expiration * 1000;
    }

    // Convert value to string if needed
    let stringValue: string;
    if (typeof value === 'string') {
      stringValue = value;
    } else if (value instanceof ArrayBuffer) {
      stringValue = new TextDecoder().decode(value);
    } else {
      // ReadableStream - not commonly used, store placeholder
      stringValue = '[ReadableStream]';
    }

    this.store.set(key, {
      value: stringValue,
      expiresAt,
      metadata: options?.metadata,
    });
  }

  /**
   * Delete a value
   */
  async delete(key: string): Promise<void> {
    this.log('delete', key);
    this.metrics.deletes++;
    this.store.delete(key);
    this.memoryCache.delete(key);
  }

  /**
   * List keys with optional prefix filtering
   */
  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult> {
    this.log('list', options?.prefix || '*');

    const keys: Array<{ name: string; expiration?: number; metadata?: unknown }> = [];
    const prefix = options?.prefix || '';
    const limit = options?.limit || 1000;

    // Sort keys for consistent ordering
    const sortedKeys = Array.from(this.store.keys()).sort();

    for (const key of sortedKeys) {
      if (!key.startsWith(prefix)) continue;

      const entry = this.store.get(key)!;

      // Check expiry
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.store.delete(key);
        continue;
      }

      keys.push({
        name: key,
        expiration: entry.expiresAt ? Math.floor(entry.expiresAt / 1000) : undefined,
        metadata: entry.metadata,
      });

      if (keys.length >= limit) break;
    }

    return {
      keys,
      list_complete: keys.length < limit,
      cursor: keys.length >= limit ? 'mock-cursor' : undefined,
    };
  }

  // ============ Test Utility Methods ============

  /**
   * Seed the store with test data
   */
  seed(data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      this.store.set(key, {
        value: typeof value === 'string' ? value : JSON.stringify(value),
        expiresAt: null,
      });
    }
  }

  /**
   * Clear all data and reset operation log
   */
  clear(): void {
    this.store.clear();
    this.operationLog = [];
    this.memoryCache.clear();
    this.resetMetrics();
  }

  /**
   * Get current KV metrics (reads, writes, deletes, cache hits/misses)
   * Matches the format from src/lib/kv-cache.ts
   */
  getMetrics(): KVMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.metrics = {
      reads: 0,
      writes: 0,
      deletes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastReset: Date.now(),
    };
  }

  /**
   * Add a value to the in-memory cache (simulates kv-cache layer)
   * This allows tests to pre-populate the cache to simulate cache hits
   */
  cacheSet(key: string, value: unknown, ttlMs: number = 300000): void {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Clear the in-memory cache only (not the underlying store)
   */
  cacheClear(): void {
    this.memoryCache.clear();
  }

  /**
   * Get the operation log for debugging/assertions
   */
  getOperationLog(): KVOperation[] {
    return [...this.operationLog];
  }

  /**
   * Get operations filtered by type
   */
  getOperationsByType(type: KVOperation['op']): KVOperation[] {
    return this.operationLog.filter(op => op.op === type);
  }

  /**
   * Get a snapshot of current store contents
   */
  getSnapshot(): Map<string, string> {
    const snapshot = new Map<string, string>();

    for (const [key, entry] of this.store.entries()) {
      // Skip expired entries
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        continue;
      }
      snapshot.set(key, entry.value);
    }

    return snapshot;
  }

  /**
   * Get store size (excluding expired entries)
   */
  size(): number {
    let count = 0;
    for (const [, entry] of this.store.entries()) {
      if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a key exists (respecting TTL)
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get all keys matching a prefix (for test assertions)
   */
  keysWithPrefix(prefix: string): string[] {
    const keys: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
          keys.push(key);
        }
      }
    }
    return keys.sort();
  }

  private log(op: KVOperation['op'], key: string): void {
    this.operationLog.push({
      op,
      key,
      timestamp: Date.now(),
      success: true,
    });
  }
}

// Singleton instance for cross-test state (when needed)
let globalMockKV: MockKVNamespace | null = null;

export function getGlobalMockKV(): MockKVNamespace {
  if (!globalMockKV) {
    globalMockKV = new MockKVNamespace();
  }
  return globalMockKV;
}

export function resetGlobalMockKV(): void {
  globalMockKV?.clear();
  globalMockKV = null;
}

/**
 * Load production KV data from an export file
 * Used to seed E2E tests with real production state
 */
export interface KVExportData {
  exportedAt: string;
  sourceNamespace: string;
  sourceNamespaceTitle?: string;
  keyCount: number;
  metadata?: Record<string, { expiration?: number; expiresAt?: string }>;
  data: Record<string, unknown>;
}

export function loadProductionKVData(kv: MockKVNamespace, exportData: KVExportData): number {
  let loaded = 0;

  for (const [key, value] of Object.entries(exportData.data)) {
    const meta = exportData.metadata?.[key];

    // Skip expired keys
    if (meta?.expiration && meta.expiration * 1000 < Date.now()) {
      continue;
    }

    // Determine expiration
    let expiresAt: number | null = null;
    if (meta?.expiration) {
      expiresAt = meta.expiration * 1000;
    }

    // Seed the value
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    kv.seed({ [key]: valueStr });

    // If there's expiration, we need to re-put with the expiration
    if (expiresAt) {
      // Re-put with proper expiration
      void kv.put(key, valueStr, { expiration: Math.floor(expiresAt / 1000) });
    }

    loaded++;
  }

  return loaded;
}

/**
 * Try to load the default kv-export.json if it exists
 */
export async function loadDefaultProductionData(kv: MockKVNamespace): Promise<number> {
  try {
    // This is for Node.js environment (E2E tests)
    // In browser/worker context, this won't work and that's fine
    const fs = await import('fs');
    const path = await import('path');

    const exportPath = path.join(process.cwd(), 'e2e', 'fixtures', 'kv-export.json');

    if (fs.existsSync(exportPath)) {
      const data = JSON.parse(fs.readFileSync(exportPath, 'utf-8')) as KVExportData;
      const loaded = loadProductionKVData(kv, data);
      console.log(`[MockKV] Loaded ${loaded} keys from production export`);
      return loaded;
    }
  } catch {
    // Silently fail - export file doesn't exist or we're in wrong environment
  }

  return 0;
}
