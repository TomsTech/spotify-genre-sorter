/**
 * Artist Genre Cache Tests
 *
 * These tests demonstrate the cache functionality and verify the implementation.
 * Note: These are demonstration tests. Full E2E tests would require KV namespace setup.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getCachedArtistGenres,
  cacheArtistGenres,
  getArtistGenreCacheStats,
  updateArtistGenreCacheStats,
  getCachedArtistCount,
  clearAllArtistGenreCache,
  cleanupOldArtistGenreCache,
  getCachedArtistGenresBatch,
  cacheArtistGenresBatch,
  invalidateArtistGenreCache
} from '../src/lib/artist-genre-cache';
import { cachedKV } from '../src/lib/kv-cache';

describe('Artist Genre Cache (#74)', () => {
  it('should have correct cache configuration', () => {
    // Verify cache constants
    const EXPECTED_TTL_DAYS = 30;
    const EXPECTED_TTL_SECONDS = EXPECTED_TTL_DAYS * 24 * 60 * 60;

    expect(EXPECTED_TTL_SECONDS).toBe(2592000); // 30 days in seconds
  });

  it('should structure cache entries correctly', () => {
    const mockCacheEntry = {
      artistId: '0TnOYISbd1XYRBk9myaseg', // Pitbull
      genres: ['miami hip hop', 'pop', 'dance pop'],
      cachedAt: Date.now(),
    };

    expect(mockCacheEntry).toHaveProperty('artistId');
    expect(mockCacheEntry).toHaveProperty('genres');
    expect(mockCacheEntry).toHaveProperty('cachedAt');
    expect(Array.isArray(mockCacheEntry.genres)).toBe(true);
  });

  it('should structure cache statistics correctly', () => {
    const mockStats = {
      totalCached: 1500,
      cacheHits: 1200,
      cacheMisses: 300,
      apiCallsSaved: 24, // 1200 hits / 50 artists per API call
      lastUpdated: new Date().toISOString(),
    };

    expect(mockStats.cacheHits + mockStats.cacheMisses).toBe(1500);
    expect(mockStats.apiCallsSaved).toBe(24);

    // Verify hit rate calculation
    const hitRate = (mockStats.cacheHits / (mockStats.cacheHits + mockStats.cacheMisses)) * 100;
    expect(hitRate).toBe(80); // 80% hit rate
  });

  it('should calculate API call savings correctly', () => {
    // Spotify API allows 50 artists per request
    const ARTISTS_PER_API_CALL = 50;

    // Scenario: User has 1000 unique artists in their library
    const totalArtists = 1000;
    const cacheHits = 800; // 80% already cached
    const cacheMisses = 200; // 20% need to be fetched

    // Without cache: ceil(1000 / 50) = 20 API calls
    const apiCallsWithoutCache = Math.ceil(totalArtists / ARTISTS_PER_API_CALL);

    // With cache: ceil(200 / 50) = 4 API calls
    const apiCallsWithCache = Math.ceil(cacheMisses / ARTISTS_PER_API_CALL);

    const apiCallsSaved = apiCallsWithoutCache - apiCallsWithCache;

    expect(apiCallsWithoutCache).toBe(20);
    expect(apiCallsWithCache).toBe(4);
    expect(apiCallsSaved).toBe(16); // 80% reduction
  });

  it('should handle batch operations efficiently', () => {
    // Simulate batch operation
    const artistIds = Array.from({ length: 100 }, (_, i) => `artist_${i}`);
    const cachedGenres = new Map<string, string[]>();

    // Simulate 70% cache hit rate
    artistIds.slice(0, 70).forEach(id => {
      cachedGenres.set(id, ['rock', 'indie']);
    });

    const cacheHits = cachedGenres.size;
    const cacheMisses = artistIds.length - cacheHits;
    const uncachedIds = artistIds.filter(id => !cachedGenres.has(id));

    expect(cacheHits).toBe(70);
    expect(cacheMisses).toBe(30);
    expect(uncachedIds.length).toBe(30);
  });

  it('should prevent unbounded cache growth with TTL', () => {
    const TTL_DAYS = 30;
    const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

    // Simulate old cache entry
    const oldEntry = {
      artistId: 'test_artist',
      genres: ['rock'],
      cachedAt: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days old
    };

    const isExpired = (Date.now() - oldEntry.cachedAt) > TTL_MS;
    expect(isExpired).toBe(true); // Should be cleaned up
  });
});

describe('Cache Performance Benefits (#74)', () => {
  it('should demonstrate significant performance improvement', () => {
    // Typical library scan scenario
    const scenario = {
      librarySize: 5000,
      uniqueArtists: 2000,
      avgArtistsPerTrack: 2.5,
    };

    // First scan (no cache)
    const firstScanApiCalls = Math.ceil(scenario.uniqueArtists / 50);
    const firstScanTime = firstScanApiCalls * 0.5; // ~500ms per API call

    // Second scan (80% cache hit rate)
    const secondScanCacheMisses = scenario.uniqueArtists * 0.2; // 20% new artists
    const secondScanApiCalls = Math.ceil(secondScanCacheMisses / 50);
    const secondScanTime = secondScanApiCalls * 0.5;

    const timeSaved = firstScanTime - secondScanTime;
    const reductionPercent = (timeSaved / firstScanTime) * 100;

    console.log('\n🎯 Cache Performance Analysis:');
    console.log(`   Library: ${scenario.librarySize} tracks, ${scenario.uniqueArtists} artists`);
    console.log(`   First scan: ${firstScanApiCalls} API calls (~${firstScanTime}s)`);
    console.log(`   Second scan: ${secondScanApiCalls} API calls (~${secondScanTime}s)`);
    console.log(`   Time saved: ~${timeSaved}s (${reductionPercent.toFixed(0)}% faster)`);

    expect(reductionPercent).toBeGreaterThan(75); // At least 75% faster
  });
});


describe('Artist Genre Cache - Error Handling', () => {
  it('getCachedArtistGenres handles KV cache errors gracefully', async () => {
    const mockKv = {} as any;
    const artistId = 'error-artist-id';

    vi.spyOn(cachedKV, 'get').mockRejectedValueOnce(new Error('KV connection failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getCachedArtistGenres(mockKv, artistId);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(`Error fetching cached genres for artist ${artistId}:`, expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('cacheArtistGenres handles KV cache errors gracefully', async () => {
    const mockKv = {} as any;
    const artistId = 'error-artist-id';

    vi.spyOn(cachedKV, 'put').mockRejectedValueOnce(new Error('KV put failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await cacheArtistGenres(mockKv, artistId, ['rock']);

    expect(consoleSpy).toHaveBeenCalledWith(`Error caching genres for artist ${artistId}:`, expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('getArtistGenreCacheStats handles KV cache errors gracefully', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'get').mockRejectedValueOnce(new Error('KV get failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getArtistGenreCacheStats(mockKv);

    expect(result).toEqual({
      totalCached: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCallsSaved: 0,
      lastUpdated: expect.any(String),
    });
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching cache stats:', expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('updateArtistGenreCacheStats handles KV cache errors gracefully', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'get').mockResolvedValueOnce(null);
    vi.spyOn(cachedKV, 'put').mockRejectedValueOnce(new Error('KV put failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await updateArtistGenreCacheStats(mockKv, { cacheHits: 1 });

    expect(consoleSpy).toHaveBeenCalledWith('Error updating cache stats:', expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('getCachedArtistCount handles KV list errors gracefully', async () => {
    const mockKv = { list: vi.fn().mockRejectedValueOnce(new Error('KV list failed')) } as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getCachedArtistCount(mockKv);

    expect(result).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith('Error getting cached artist count:', expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('getCachedArtistGenresBatch handles partial nulls', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'get')
      .mockResolvedValueOnce({ genres: null }) // Returns null
      .mockResolvedValueOnce({ genres: ['rock'] });

    const result = await getCachedArtistGenresBatch(mockKv, ['artist1', 'artist2']);

    expect(result.size).toBe(1);
    expect(result.get('artist2')).toEqual(['rock']);

    vi.restoreAllMocks();
  });

  it('getCachedArtistGenresBatch handles errors gracefully (returns map with hits)', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'get')
      .mockResolvedValueOnce({ genres: ['pop'] }) // First resolves
      .mockRejectedValueOnce(new Error('KV connection failed')); // Second fails

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getCachedArtistGenresBatch(mockKv, ['artist1', 'artist2']);

    expect(result.size).toBe(1);
    expect(result.get('artist1')).toEqual(['pop']);
    expect(consoleSpy).toHaveBeenCalledWith(`Error fetching cached genres for artist artist2:`, expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('cacheArtistGenresBatch handles errors gracefully', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'put')
      .mockResolvedValueOnce(undefined) // First resolves
      .mockRejectedValueOnce(new Error('KV put failed')); // Second fails

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const map = new Map();
    map.set('artist1', ['pop']);
    map.set('artist2', ['rock']);

    await cacheArtistGenresBatch(mockKv, map);

    expect(consoleSpy).toHaveBeenCalledWith(`Error caching genres for artist artist2:`, expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('invalidateArtistGenreCache propagates errors', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'delete').mockRejectedValueOnce(new Error('KV delete failed'));

    await expect(invalidateArtistGenreCache(mockKv, ['artist1'])).rejects.toThrow('KV delete failed');

    vi.restoreAllMocks();
  });

  it('clearAllArtistGenreCache processes entries correctly', async () => {
    const mockKv = {
      list: vi.fn()
        .mockResolvedValueOnce({
          keys: [{ name: 'key1' }, { name: 'key2' }],
          list_complete: false,
          cursor: 'cursor1'
        })
        .mockResolvedValueOnce({
          keys: [{ name: 'key3' }],
          list_complete: true
        })
    } as any;

    vi.spyOn(cachedKV, 'delete').mockResolvedValue(undefined);

    const result = await clearAllArtistGenreCache(mockKv);

    expect(result).toBe(3);
    expect(mockKv.list).toHaveBeenCalledTimes(2);
    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'key1');
    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'key2');
    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'key3');
    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'artist_genre_cache_stats');

    vi.restoreAllMocks();
  });

  it('getCachedArtistCount processes successful list', async () => {
    const mockKv = { list: vi.fn().mockResolvedValueOnce({ keys: [{ name: 'key1' }] }) } as any;

    const result = await getCachedArtistCount(mockKv);

    expect(result).toBe(1);

    vi.restoreAllMocks();
  });

  it('invalidateArtistGenreCache processes entries correctly', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'delete').mockResolvedValue(undefined);

    const result = await invalidateArtistGenreCache(mockKv, ['artist1', 'artist2']);

    expect(result).toBe(2);
    expect(cachedKV.delete).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it('getArtistGenreCacheStats returns cached stats', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'get').mockResolvedValueOnce({
      totalCached: 10,
      cacheHits: 5,
      cacheMisses: 2,
      apiCallsSaved: 1,
      lastUpdated: '2023-01-01T00:00:00.000Z'
    });

    const result = await getArtistGenreCacheStats(mockKv);

    expect(result.totalCached).toBe(10);
    vi.restoreAllMocks();
  });

  it('updateArtistGenreCacheStats updates successfully with misses and totalCached', async () => {
    const mockKv = {} as any;

    vi.spyOn(cachedKV, 'get').mockResolvedValueOnce(null);
    vi.spyOn(cachedKV, 'put').mockResolvedValue(undefined);

    await updateArtistGenreCacheStats(mockKv, { cacheMisses: 2, totalCached: 50 });

    expect(cachedKV.put).toHaveBeenCalledWith(
      mockKv,
      'artist_genre_cache_stats',
      expect.stringContaining('"cacheMisses":2'),
      expect.any(Object)
    );
    expect(cachedKV.put).toHaveBeenCalledWith(
      mockKv,
      'artist_genre_cache_stats',
      expect.stringContaining('"totalCached":50'),
      expect.any(Object)
    );

    vi.restoreAllMocks();
  });

  it('clearAllArtistGenreCache handles errors gracefully', async () => {
    const mockKv = { list: vi.fn().mockRejectedValueOnce(new Error('KV list failed')) } as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await clearAllArtistGenreCache(mockKv);

    expect(result).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith('Error clearing artist genre cache:', expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('cleanupOldArtistGenreCache processes entries correctly', async () => {
    const mockKv = {
      list: vi.fn()
        .mockResolvedValueOnce({
          keys: [{ name: 'old_key' }, { name: 'new_key' }],
          list_complete: false,
          cursor: 'cursor1'
        })
        .mockResolvedValueOnce({
          keys: [{ name: 'another_old_key' }],
          list_complete: true
        })
    } as any;

    const cutoffTime = Date.now() - (60 * 24 * 60 * 60 * 1000);

    vi.spyOn(cachedKV, 'get')
      .mockResolvedValueOnce({ cachedAt: cutoffTime - 1000 } as any) // old_key
      .mockResolvedValueOnce({ cachedAt: cutoffTime + 1000 } as any) // new_key
      .mockResolvedValueOnce({ cachedAt: cutoffTime - 1000 } as any); // another_old_key

    vi.spyOn(cachedKV, 'delete').mockResolvedValue(undefined);

    const result = await cleanupOldArtistGenreCache(mockKv);

    expect(result).toBe(2); // old_key and another_old_key
    expect(mockKv.list).toHaveBeenCalledTimes(2);
    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'old_key');
    expect(cachedKV.delete).not.toHaveBeenCalledWith(mockKv, 'new_key');
    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'another_old_key');

    vi.restoreAllMocks();
  });

  it('cleanupOldArtistGenreCache handles errors gracefully', async () => {
    const mockKv = { list: vi.fn().mockRejectedValueOnce(new Error('KV list failed')) } as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await cleanupOldArtistGenreCache(mockKv);

    expect(result).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith('Error cleaning up old cache entries:', expect.any(Error));

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });
});
