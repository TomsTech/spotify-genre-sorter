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
export async function getKVMonitorData(kv: KVNamespace): Promise<KVMonitorResponse> {
  const metrics = getKVMetrics();

  // Collect detailed stats for each prefix
  const namespaceData = await Promise.all(
    KV_PREFIXES.map(async ({ name, prefix, description }) => {
      try {
        const list = await kv.list({ prefix, limit: 1000 });
        const keyCount = list.keys.length;
        const totalSize = list.keys.reduce((sum, key) => sum + (key.metadata?.size || 0), 0);
        const truncated = list.list_complete === false;

        // Get sample keys for preview (first 5)
        const sampleKeys = list.keys.slice(0, 5).map(key => ({
          name: key.name,
          expiration: key.expiration,
          metadata: key.metadata,
        }));

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
      } catch (err) {
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
    })
  );

  // Calculate totals
  const totalKeys = namespaceData.reduce((sum, ns) => sum + ns.keyCount, 0);
  const totalSize = namespaceData.reduce((sum, ns) => sum + ns.totalSize, 0);

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
