/**
 * KV Monitoring Module
 * Provides comprehensive KV namespace monitoring capabilities
 */

import { getKVMetrics } from './kv-cache';

export interface KVNamespaceData {
  name: string;
  prefix: string;
  description: string;
  keyCount: number;
  totalSize: number;
  avgSize: number;
  truncated: boolean;
  sampleKeys: Array<{
    name: string;
    expiration?: number;
    metadata?: unknown;
  }>;
  error?: string;
}

export interface KVMonitorResponse {
  timestamp: string;
  summary: {
    totalKeys: number;
    totalSize: number;
    avgKeySize: number;
    namespaceCount: number;
  };
  limits: {
    maxKeys: number;
    maxKeySize: number;
    maxValueSize: number;
    maxMetadataSize: number;
    dailyReads: number;
    dailyWrites: number;
  };
  usage: {
    keyUsagePercent: string;
    keysRemaining: number;
  };
  realTimeMetrics: {
    reads: number;
    writes: number;
    deletes: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    lastReset: string;
  };
  namespaces: KVNamespaceData[];
}

// KV quotas (Cloudflare Workers KV limits)
export const KV_LIMITS = {
  maxKeys: 1000000000, // 1 billion keys (effectively unlimited for our use)
  maxKeySize: 512, // bytes (key name)
  maxValueSize: 25 * 1024 * 1024, // 25 MB
  maxMetadataSize: 1024, // 1 KB
  dailyReads: 100000, // Free tier
  dailyWrites: 1000, // Free tier
};

// Define all key prefixes we track
export const KV_PREFIXES = [
  { name: 'Sessions', prefix: 'session:', description: 'Active user sessions' },
  { name: 'User Stats', prefix: 'user_stats:', description: 'User playlist statistics' },
  { name: 'User Playlists', prefix: 'user:', description: 'User playlist history' },
  { name: 'Hall of Fame', prefix: 'hof:', description: 'Featured playlists' },
  { name: 'Genre Cache', prefix: 'genre_cache_', description: 'Cached genre analysis' },
  { name: 'Artist Cache', prefix: 'artist_cache_', description: 'Cached artist data' },
  { name: 'Scan Progress', prefix: 'scan_progress:', description: 'In-progress library scans' },
  { name: 'Analytics', prefix: 'analytics_', description: 'Usage analytics data' },
  { name: 'Leaderboard', prefix: 'leaderboard', description: 'Leaderboard cache' },
  { name: 'Scoreboard', prefix: 'scoreboard', description: 'Scoreboard cache' },
  { name: 'Recent Playlists', prefix: 'recent_playlists', description: 'Recent playlist feed' },
];

/**
 * Get comprehensive KV monitoring data
 */
/* eslint-disable @typescript-eslint/no-unsafe-return */
export async function getKVMonitorData(kv: KVNamespace): Promise<KVMonitorResponse> {
  const metrics = getKVMetrics();

  // Collect detailed stats for each prefix
  // Process in chunks to avoid hitting Cloudflare's 50 concurrent subrequest limit
  const CHUNK_SIZE = 5;
  const namespaceData: KVNamespaceData[] = [];

  for (let i = 0; i < KV_PREFIXES.length; i += CHUNK_SIZE) {
    const chunkSize = Math.min(CHUNK_SIZE, KV_PREFIXES.length - i);
    const chunkPromises = new Array<Promise<KVNamespaceData>>(chunkSize);

    for (let j = 0; j < chunkSize; j++) {
      const { name, prefix, description } = KV_PREFIXES[i + j];
      chunkPromises[j] = (async (): Promise<KVNamespaceData> => {
        try {
          const list = await kv.list({ prefix, limit: 1000 });
          const keys = list.keys;
          const keyCount = keys.length;
          let totalSize = 0;

          // Native for loop is faster than for...of for arrays
          for (let k = 0; k < keyCount; k++) {
            const metadata = keys[k].metadata as { size?: number } | undefined;
            if (metadata?.size) totalSize += metadata.size;
          }

          const truncated = list.list_complete === false;

          // Optimize slice and map
          const sampleLimit = keyCount > 5 ? 5 : keyCount;
          const sampleKeys = new Array<{ name: string; expiration?: number; metadata?: unknown }>(sampleLimit);
          for (let k = 0; k < sampleLimit; k++) {
            const key = keys[k];
            sampleKeys[k] = {
              name: key.name,
              expiration: key.expiration,
              metadata: key.metadata,
            };
          }

          return {
            name,
            prefix,
            description,
            keyCount,
            totalSize,
            avgSize: keyCount > 0 ? Math.round(totalSize / keyCount) : 0,
            truncated,
            sampleKeys,
          };
        } catch (err: unknown) {
          console.error(`Error listing prefix ${prefix}:`, err);
          return {
            name,
            prefix,
            description,
            keyCount: 0,
            totalSize: 0,
            avgSize: 0,
            truncated: false,
            sampleKeys: [],
            error: 'Failed to list keys',
          };
        }
      })();
    }

    const chunkResults = await Promise.all(chunkPromises);
    for (let j = 0; j < chunkResults.length; j++) {
      namespaceData.push(chunkResults[j]);
    }
  }

  // Calculate totals
  let totalKeys = 0;
  let totalSize = 0;
  // Native for loop is faster
  for (let i = 0; i < namespaceData.length; i++) {
    const ns = namespaceData[i];
    totalKeys += ns.keyCount;
    totalSize += ns.totalSize;
  }

  // Calculate usage percentages
  const keyUsagePercent = (totalKeys / KV_LIMITS.maxKeys) * 100;

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalKeys,
      totalSize,
      avgKeySize: totalKeys > 0 ? Math.round(totalSize / totalKeys) : 0,
      namespaceCount: namespaceData.length,
    },
    limits: KV_LIMITS,
    usage: {
      keyUsagePercent: keyUsagePercent.toFixed(6),
      keysRemaining: KV_LIMITS.maxKeys - totalKeys,
    },
    realTimeMetrics: {
      reads: metrics.reads,
      writes: metrics.writes,
      deletes: metrics.deletes,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
      cacheHitRate: metrics.cacheHits + metrics.cacheMisses > 0
        ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100)
        : 0,
      lastReset: new Date(metrics.lastReset).toISOString(),
    },
    namespaces: namespaceData,
  };
}
/* eslint-enable @typescript-eslint/no-unsafe-return */
