import { Hono } from 'hono';
import {
  getSession,
  updateSession,
  createOrUpdateUserStats,
  addPlaylistToUser,
  getRecentPlaylists,
  addRecentPlaylist,
  getScoreboard,
  buildScoreboard,
  getLeaderboard,
  buildLeaderboard,
  trackAnalyticsEvent,
  getAnalytics,
  getKVMetrics,
  getScanProgress,
  saveScanProgress,
  type RecentPlaylist,
  getUserPreferences,
  updateUserPreferences,
  cachedKV,
} from '../lib/session';
import {
  refreshSpotifyToken,
  getAllLikedTracks,
  getLikedTracks,
  getArtists,
  createPlaylist,
  addTracksToPlaylist,
  getCurrentUser,
  getUserPlaylists,
  getCurrentPlayback,
  getPlaylistTracks,
} from '../lib/spotify';
import { getKVMonitorData } from '../lib/kv-monitor';

const api = new Hono<{ Bindings: Env }>();

// Cache constants
const GENRE_CACHE_TTL = 3600; // 1 hour in seconds
const GENRE_CACHE_TTL_LARGE = 86400; // 24 hours for large libraries
const LARGE_LIBRARY_THRESHOLD = 1000; // tracks
const GENRE_CACHE_PREFIX = 'genre_cache_';
const CHUNK_CACHE_PREFIX = 'genre_chunk_';

// Progressive loading constants - stay under 50 subrequests
// ~10 track requests (50 per page = 500 tracks) + ~10 artist requests = ~20 total
const CHUNK_SIZE = 500;
const MAX_TRACK_REQUESTS_PER_CHUNK = 10;
const MAX_ARTIST_REQUESTS_PER_CHUNK = 10;

interface GenreCacheData {
  genres: { name: string; count: number; trackIds: string[] }[];
  totalTracks: number;
  totalGenres: number;
  totalArtists: number;
  cachedAt: number;
  cacheExpiresAt?: number;
  truncated?: boolean;
  totalInLibrary?: number;
}

// Helper to invalidate genre cache for a user
async function invalidateGenreCache(kv: KVNamespace, spotifyUserId: string): Promise<void> {
  const cacheKey = `${GENRE_CACHE_PREFIX}${spotifyUserId}`;
  await kv.delete(cacheKey);
}

// Security constants
const MAX_TRACK_IDS = 10000; // Max tracks per playlist
const MAX_GENRES_BULK = 50; // Max genres in bulk create
const MAX_GENRE_NAME_LENGTH = 100;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
const SPOTIFY_TRACK_ID_REGEX = /^[a-zA-Z0-9]{22}$/;

// PERF-003 FIX: Bounded rate limiter with deterministic cleanup
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX_ENTRIES = 10000; // Prevent unbounded memory growth
let rateLimitRequestCount = 0;

// Rate limiting middleware
api.use('/*', async (c, next) => {
  // Skip rate limiting in E2E test mode to allow parallel test execution
  // SECURITY: Only allow bypass in non-production environments (ISSUE-001)
  if (c.env.E2E_TEST_MODE === 'true' && c.env.ENVIRONMENT !== 'production') {
    return next();
  }

  const clientIP = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();

  const rateData = rateLimitMap.get(clientIP);
  if (rateData) {
    if (now > rateData.resetAt) {
      // Window expired, reset
      rateLimitMap.set(clientIP, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else if (rateData.count >= RATE_LIMIT_MAX_REQUESTS) {
      c.header('Retry-After', String(Math.ceil((rateData.resetAt - now) / 1000)));
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    } else {
      rateData.count++;
    }
  } else {
    rateLimitMap.set(clientIP, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // Deterministic cleanup every 100 requests (not random)
  rateLimitRequestCount++;
  if (rateLimitRequestCount % 100 === 0) {
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now > data.resetAt + RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(ip);
      }
    }
  }

  // Emergency cleanup if map grows too large (prevents OOM)
  if (rateLimitMap.size > RATE_LIMIT_MAX_ENTRIES) {
    // Remove oldest 20% of entries
    const entriesToRemove = Math.floor(RATE_LIMIT_MAX_ENTRIES * 0.2);
    const sortedEntries = [...rateLimitMap.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      rateLimitMap.delete(sortedEntries[i][0]);
    }
  }

  await next();
});

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = ['/scoreboard', '/leaderboard', '/recent-playlists', '/deploy-status', '/changelog', '/analytics', '/kv-usage', '/kv-metrics', '/log-error', '/log-perf', '/listening'];

// Auth middleware - check auth and refresh tokens if needed
api.use('/*', async (c, next) => {
  // Skip auth for public endpoints
  const path = new URL(c.req.url).pathname.replace('/api', '');
  if (PUBLIC_ENDPOINTS.includes(path)) {
    return next();
  }

  const session = await getSession(c);

  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  if (!session.spotifyAccessToken) {
    return c.json({ error: 'Spotify not connected' }, 401);
  }

  // Check if token is expired or about to expire (5 min buffer)
  if (session.spotifyExpiresAt && session.spotifyExpiresAt < Date.now() + 300000) {
    if (!session.spotifyRefreshToken) {
      return c.json({ error: 'Spotify session expired' }, 401);
    }

    try {
      const tokens = await refreshSpotifyToken(
        session.spotifyRefreshToken,
        c.env.SPOTIFY_CLIENT_ID,
        c.env.SPOTIFY_CLIENT_SECRET
      );

      await updateSession(c, {
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
      });

      session.spotifyAccessToken = tokens.access_token;
    } catch (err) {
      console.error('Token refresh failed:', err);
      return c.json({ error: 'Failed to refresh Spotify token' }, 401);
    }
  }

  c.set('session' as never, session);
  await next();
});

// Get current user info
api.get('/me', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const spotifyUser = await getCurrentUser(session.spotifyAccessToken);
    return c.json({
      github: {
        username: session.githubUser,
        avatar: session.githubAvatar,
      },
      spotify: {
        id: spotifyUser.id,
        name: spotifyUser.display_name,
        avatar: spotifyUser.images?.[0]?.url,
      },
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    return c.json({ error: 'Failed to fetch user info' }, 500);
  }
});

// Get library size (#75 - display library stats before scan)
api.get('/library-size', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    // Minimal API call - just get total count
    const sizeCheck = await getLikedTracks(session.spotifyAccessToken, 1, 0);
    const total = sizeCheck.total;

    // Estimate scan time based on library size
    // ~500 tracks per chunk, ~5-8 seconds per chunk
    const chunks = Math.ceil(total / 500);
    const estimatedSeconds = chunks * 6; // ~6 seconds avg per chunk

    let estimatedTime: string;
    if (estimatedSeconds < 60) {
      estimatedTime = `~${estimatedSeconds} seconds`;
    } else {
      const minutes = Math.ceil(estimatedSeconds / 60);
      estimatedTime = `~${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    return c.json({
      total,
      isLarge: total > 5000,
      isVeryLarge: total > 10000,
      estimatedScanTime: estimatedTime,
      requiresProgressiveLoad: total > PROGRESSIVE_LOAD_THRESHOLD,
    });
  } catch (err) {
    console.error('Error fetching library size:', err);
    return c.json({ error: 'Failed to fetch library size' }, 500);
  }
});

// Get current playback state (Now Playing)
// Also stores listening status in KV for public "who's listening" feature
api.get('/now-playing', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const playback = await getCurrentPlayback(session.spotifyAccessToken);
    const kv = c.env.SESSIONS;

    // If user is listening, store it in KV with 90-second TTL
    if (playback?.is_playing && playback.item && session.spotifyUserId) {
      const listeningData = {
        spotifyId: session.spotifyUserId,
        spotifyName: session.spotifyUser || session.spotifyUserId,
        spotifyAvatar: session.spotifyAvatar || null,
        track: {
          name: playback.item.name,
          artists: playback.item.artists.map(a => a.name).join(', '),
          albumArt: playback.item.album.images[1]?.url || playback.item.album.images[0]?.url || null,
          url: playback.item.external_urls.spotify,
        },
        updatedAt: new Date().toISOString(),
      };
      // CRITICAL FIX: Use cachedKV for listening status writes
      await cachedKV.put(kv, `listening:${session.spotifyUserId}`, JSON.stringify(listeningData), {
        expirationTtl: 90, // 90 seconds - auto-expires if user stops polling
        immediate: false // Can be batched - not critical if delayed by a few seconds
      });
    } else if (session.spotifyUserId) {
      // User not playing - delete their listening entry
      await cachedKV.delete(kv, `listening:${session.spotifyUserId}`);
    }

    if (!playback || !playback.item) {
      return c.json({ playing: false });
    }

    return c.json({
      playing: playback.is_playing,
      track: {
        id: playback.item.id,
        name: playback.item.name,
        artists: playback.item.artists.map(a => a.name).join(', '),
        album: playback.item.album.name,
        albumArt: playback.item.album.images[0]?.url || null,
        duration: playback.item.duration_ms,
        progress: playback.progress_ms,
        url: playback.item.external_urls.spotify,
      },
      device: playback.device?.name || 'Unknown device',
    });
  } catch (err) {
    console.error('Error fetching playback:', err);
    return c.json({ playing: false, error: 'Failed to fetch playback' });
  }
});

// Threshold for switching to progressive loading (tracks)
const PROGRESSIVE_LOAD_THRESHOLD = 500;

// Get all genres from liked tracks (with caching)
api.get('/genres', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated', details: 'No Spotify access token found. Please reconnect Spotify.' }, 401);
  }

  const forceRefresh = c.req.query('refresh') === 'true';

  try {
    // Get user ID for cache key
    const user = await getCurrentUser(session.spotifyAccessToken);
    const cacheKey = `${GENRE_CACHE_PREFIX}${user.id}`;

    // Check cache unless forcing refresh
    if (!forceRefresh) {
      const cachedData = await c.env.SESSIONS.get<GenreCacheData>(cacheKey, 'json');
      if (cachedData) {
        return c.json({
          ...cachedData,
          fromCache: true,
        });
      }
    }

    // Early check: Get library size with minimal API call
    // This prevents wasting subrequests on large libraries that will fail
    const sizeCheck = await getLikedTracks(session.spotifyAccessToken, 1, 0);
    const librarySize = sizeCheck.total;

    // If library is large, immediately redirect to progressive loading
    if (librarySize > PROGRESSIVE_LOAD_THRESHOLD) {
      return c.json({
        requiresProgressiveLoad: true,
        totalInLibrary: librarySize,
        message: 'Library too large for standard loading. Use progressive loading.',
      });
    }

    // Step 1: Get all liked tracks (limited to avoid subrequest limits)
    let tracksResult;
    try {
      tracksResult = await getAllLikedTracks(session.spotifyAccessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching liked tracks:', message);
      return c.json({
        error: 'Failed to fetch liked tracks from Spotify',
        details: message,
        step: 'fetching_tracks'
      }, 500);
    }

    const { tracks: likedTracks, totalInLibrary, truncated } = tracksResult;

    if (!likedTracks || likedTracks.length === 0) {
      return c.json({
        totalTracks: 0,
        totalGenres: 0,
        genres: [],
        cachedAt: null,
        fromCache: false,
        message: 'No liked tracks found in your Spotify library'
      });
    }

    // Step 2: Collect unique artist IDs
    const artistIds = new Set<string>();
    for (const { track } of likedTracks) {
      for (const artist of track.artists) {
        artistIds.add(artist.id);
      }
    }

    // Step 3: Fetch all artists to get genres (limited to prevent subrequest overflow)
    // Pass KV namespace to enable persistent caching (#74)
    let artists;
    try {
      const artistResult = await getArtists(session.spotifyAccessToken, [...artistIds], undefined, c.env.SESSIONS);
      artists = artistResult.artists;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching artists:', message);
      return c.json({
        error: 'Failed to fetch artist data from Spotify',
        details: message,
        step: 'fetching_artists',
        tracksFound: likedTracks.length,
        artistsToFetch: artistIds.size
      }, 500);
    }

    const artistGenreMap = new Map<string, string[]>();
    for (const artist of artists) {
      artistGenreMap.set(artist.id, artist.genres);
    }

    // Step 4: Count tracks per genre and collect track IDs
    const genreData = new Map<string, { count: number; trackIds: string[] }>();

    for (const { track } of likedTracks) {
      const trackGenres = new Set<string>();
      for (const artist of track.artists) {
        const genres = artistGenreMap.get(artist.id) || [];
        genres.forEach(g => trackGenres.add(g));
      }

      for (const genre of trackGenres) {
        let data = genreData.get(genre);
        if (!data) {
          data = { count: 0, trackIds: [] };
          genreData.set(genre, data);
        }
        data.count++;
        data.trackIds.push(track.id);
      }
    }

    // Convert to sorted array
    const genres = [...genreData.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        trackIds: data.trackIds,
      }))
      .sort((a, b) => b.count - a.count);

    // Use extended TTL for large libraries (24h vs 1h)
    const cacheTtl = likedTracks.length >= LARGE_LIBRARY_THRESHOLD
      ? GENRE_CACHE_TTL_LARGE
      : GENRE_CACHE_TTL;

    // Build response data
    const responseData: GenreCacheData = {
      totalTracks: likedTracks.length,
      totalGenres: genres.length,
      totalArtists: artistIds.size,
      genres,
      cachedAt: Date.now(),
      cacheExpiresAt: Date.now() + (cacheTtl * 1000),
      truncated,
      totalInLibrary: truncated ? totalInLibrary : undefined,
    };

    // Store in cache
    // CRITICAL FIX: Use cachedKV for genre cache writes to leverage batching
    await cachedKV.put(c.env.SESSIONS, cacheKey, JSON.stringify(responseData), {
      expirationTtl: cacheTtl,
      immediate: true // Genre cache is important - write immediately
    });

    // Update user stats with analysis results
    if (session.spotifyUserId) {
      await createOrUpdateUserStats(c.env.SESSIONS, session.spotifyUserId, {
        totalGenresDiscovered: responseData.totalGenres,
        totalArtistsDiscovered: responseData.totalArtists,
        totalTracksAnalysed: responseData.totalTracks,
      });
    }

    // Track library scan in analytics
    await trackAnalyticsEvent(c.env.SESSIONS, 'libraryScan', {
      tracksCount: responseData.totalTracks,
      visitorId: session.spotifyUserId,
    });

    return c.json({
      ...responseData,
      fromCache: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error fetching genres:', err);
    return c.json({
      error: 'Failed to fetch genres',
      details: message,
      step: 'unknown'
    }, 500);
  }
});

// Chunk cache data interface
interface ChunkCacheData {
  genres: { name: string; count: number; trackIds: string[] }[];
  trackCount: number;
  artistCount: number;
  cachedAt: number;
}

// Get scan progress status (check if there's an interrupted scan to resume)
api.get('/genres/scan-status', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const user = await getCurrentUser(session.spotifyAccessToken);
    const progress = await getScanProgress(c.env.SESSIONS, user.id);

    if (!progress) {
      return c.json({ hasProgress: false });
    }

    const progressPercent = Math.min(100, Math.round((progress.offset / progress.totalInLibrary) * 100));

    return c.json({
      hasProgress: true,
      status: progress.status,
      progress: progressPercent,
      scannedTracks: progress.partialTrackCount,
      totalInLibrary: progress.totalInLibrary,
      genresFound: progress.partialGenres.length,
      startedAt: progress.startedAt,
      lastUpdatedAt: progress.lastUpdatedAt,
      canResume: progress.status === 'in_progress' && progress.offset > 0 && progress.offset < progress.totalInLibrary,
    });
  } catch (err) {
    console.error('Error checking scan status:', err);
    return c.json({ hasProgress: false });
  }
});

// Progressive scan with resume capability
// This endpoint handles large libraries by scanning in chunks and storing progress
api.get('/genres/progressive', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const forceRestart = c.req.query('restart') === 'true';

  try {
    const user = await getCurrentUser(session.spotifyAccessToken);

    // Check for existing progress
    let progress = await getScanProgress(c.env.SESSIONS, user.id);

    // If forcing restart or no progress, start fresh
    if (forceRestart || !progress) {
      // Get total library size
      const initialResponse = await getLikedTracks(session.spotifyAccessToken, 1, 0);

      progress = {
        userId: user.id,
        offset: 0,
        totalInLibrary: initialResponse.total,
        partialGenres: [],
        partialArtistCount: 0,
        partialTrackCount: 0,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        status: 'in_progress',
      };
    }

    // If scan is complete, return the full cache
    if (progress.status === 'completed') {
      const cacheKey = `${GENRE_CACHE_PREFIX}${user.id}`;
      const cachedData = await c.env.SESSIONS.get<GenreCacheData>(cacheKey, 'json');
      if (cachedData) {
        return c.json({
          ...cachedData,
          fromCache: true,
          scanStatus: 'completed',
          progress: 100,
        });
      }
      // Cache missing, restart scan
      progress.status = 'in_progress';
      progress.offset = 0;
    }

    // OPTIMIZATION: Fetch next chunk of tracks in parallel
    const CHUNK_SIZE_PROGRESSIVE = 500;
    const allChunkTracks = [];
    const maxPages = Math.min(10, Math.ceil(CHUNK_SIZE_PROGRESSIVE / 50));

    // Build array of parallel fetch operations
    const fetchPromises = [];
    for (let i = 0; i < maxPages; i++) {
      const pageOffset = progress.offset + (i * 50);
      const pageLimit = Math.min(50, progress.offset + CHUNK_SIZE_PROGRESSIVE - pageOffset);
      if (pageLimit > 0) {
        fetchPromises.push(getLikedTracks(session.spotifyAccessToken, pageLimit, pageOffset));
      }
    }

    // Fetch all pages concurrently
    const responses = await Promise.all(fetchPromises);
    let currentOffset = progress.offset;

    for (const response of responses) {
      allChunkTracks.push(...response.items);
      currentOffset += response.items.length;
      if (currentOffset >= response.total) break;
    }

    if (allChunkTracks.length === 0 && progress.offset >= progress.totalInLibrary) {
      // Scan complete
      progress.status = 'completed';
      progress.lastUpdatedAt = new Date().toISOString();
      await saveScanProgress(c.env.SESSIONS, progress);

      // Build and cache final results
      const finalData: GenreCacheData = {
        genres: progress.partialGenres.sort((a, b) => b.count - a.count),
        totalTracks: progress.partialTrackCount,
        totalGenres: progress.partialGenres.length,
        totalArtists: progress.partialArtistCount,
        cachedAt: Date.now(),
        cacheExpiresAt: Date.now() + (GENRE_CACHE_TTL_LARGE * 1000),
      };

      const cacheKey = `${GENRE_CACHE_PREFIX}${user.id}`;
      // CRITICAL FIX: Use cachedKV for progressive scan final cache
      await cachedKV.put(c.env.SESSIONS, cacheKey, JSON.stringify(finalData), {
        expirationTtl: GENRE_CACHE_TTL_LARGE,
        immediate: true
      });

      // Update user stats
      await createOrUpdateUserStats(c.env.SESSIONS, user.id, {
        totalGenresDiscovered: finalData.totalGenres,
        totalArtistsDiscovered: finalData.totalArtists,
        totalTracksAnalysed: finalData.totalTracks,
      });

      return c.json({
        ...finalData,
        fromCache: false,
        scanStatus: 'completed',
        progress: 100,
      });
    }

    // Process chunk: get artists and genres
    const artistIds = new Set<string>();
    for (const { track } of allChunkTracks) {
      for (const artist of track.artists) {
        artistIds.add(artist.id);
      }
    }

    const { artists } = await getArtists(session.spotifyAccessToken, [...artistIds].slice(0, 500), undefined, c.env.SESSIONS);
    const artistGenreMap = new Map<string, string[]>();
    for (const artist of artists) {
      artistGenreMap.set(artist.id, artist.genres);
    }

    // Merge into progress
    const genreMap = new Map<string, { count: number; trackIds: string[] }>();

    // Load existing partial genres
    for (const g of progress.partialGenres) {
      genreMap.set(g.name, { count: g.count, trackIds: g.trackIds });
    }

    // Add new tracks
    for (const { track } of allChunkTracks) {
      const trackGenres = new Set<string>();
      for (const artist of track.artists) {
        const genres = artistGenreMap.get(artist.id) || [];
        genres.forEach(g => trackGenres.add(g));
      }

      for (const genre of trackGenres) {
        let data = genreMap.get(genre);
        if (!data) {
          data = { count: 0, trackIds: [] };
          genreMap.set(genre, data);
        }
        data.count++;
        data.trackIds.push(track.id);
      }
    }

    // Update progress
    progress.partialGenres = [...genreMap.entries()].map(([name, data]) => ({
      name,
      count: data.count,
      trackIds: data.trackIds,
    }));
    progress.partialTrackCount += allChunkTracks.length;
    progress.partialArtistCount = new Set([
      ...progress.partialGenres.flatMap(g => g.trackIds),
    ]).size; // Approximate
    progress.offset = currentOffset;
    progress.lastUpdatedAt = new Date().toISOString();

    // Save progress
    await saveScanProgress(c.env.SESSIONS, progress);

    const progressPercent = Math.min(100, Math.round((progress.offset / progress.totalInLibrary) * 100));

    return c.json({
      scanStatus: 'in_progress',
      progress: progressPercent,
      scannedTracks: progress.partialTrackCount,
      totalInLibrary: progress.totalInLibrary,
      genresFound: progress.partialGenres.length,
      nextOffset: progress.offset,
      message: `Scanned ${progress.partialTrackCount} of ${progress.totalInLibrary} tracks (${progressPercent}%)`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in progressive scan:', err);
    return c.json({
      error: 'Progressive scan failed',
      details: message,
    }, 500);
  }
});

// Progressive loading: Get genres for a chunk of tracks
// This endpoint stays under 50 subrequests by limiting track fetching per call
api.get('/genres/chunk', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const offsetStr = c.req.query('offset') || '0';
  const limitStr = c.req.query('limit') || String(CHUNK_SIZE);
  const offset = parseInt(offsetStr, 10);
  const limit = Math.min(parseInt(limitStr, 10), CHUNK_SIZE);

  if (isNaN(offset) || offset < 0) {
    return c.json({ error: 'Invalid offset' }, 400);
  }

  try {
    const user = await getCurrentUser(session.spotifyAccessToken);
    const chunkCacheKey = `${CHUNK_CACHE_PREFIX}${user.id}_${offset}_${limit}`;

    // Check chunk cache
    const cachedChunk = await c.env.SESSIONS.get<ChunkCacheData>(chunkCacheKey, 'json');
    if (cachedChunk) {
      // Get total from a quick /me/tracks call
      const totalResponse = await getLikedTracks(session.spotifyAccessToken, 1, 0);
      const totalInLibrary = totalResponse.total;
      const hasMore = offset + limit < totalInLibrary;

      return c.json({
        chunk: cachedChunk,
        pagination: {
          offset,
          limit,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
          totalInLibrary,
        },
        progress: Math.min(100, Math.round(((offset + limit) / totalInLibrary) * 100)),
        fromCache: true,
      });
    }

    // OPTIMIZATION: Fetch tracks in parallel for faster chunk loading
    // Calculate how many pages we need
    const allChunkTracks = [];
    let totalInLibrary = 0;
    const pagesToFetch = Math.min(MAX_TRACK_REQUESTS_PER_CHUNK, Math.ceil(limit / 50));

    // Build array of offsets to fetch in parallel
    const fetchPromises = [];
    for (let i = 0; i < pagesToFetch; i++) {
      const pageOffset = offset + (i * 50);
      const pageLimit = Math.min(50, offset + limit - pageOffset);
      if (pageLimit > 0) {
        fetchPromises.push(getLikedTracks(session.spotifyAccessToken, pageLimit, pageOffset));
      }
    }

    // Fetch all pages in parallel
    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      allChunkTracks.push(...response.items);
      totalInLibrary = response.total;
      // Stop if we've reached the end of the library
      if (allChunkTracks.length >= response.total - offset) break;
    }

    if (allChunkTracks.length === 0) {
      // No more tracks at this offset
      return c.json({
        chunk: {
          genres: [],
          trackCount: 0,
          artistCount: 0,
          cachedAt: Date.now(),
        },
        pagination: {
          offset,
          limit,
          hasMore: false,
          nextOffset: null,
          totalInLibrary,
        },
        progress: 100,
        fromCache: false,
      });
    }

    // Collect unique artist IDs from this chunk
    const artistIds = new Set<string>();
    for (const { track } of allChunkTracks) {
      for (const artist of track.artists) {
        artistIds.add(artist.id);
      }
    }

    // Fetch artists (stay under subrequest limit)
    // Pass KV namespace to enable persistent caching (#74)
    const artistIdArray = [...artistIds].slice(0, MAX_ARTIST_REQUESTS_PER_CHUNK * 50);
    const { artists } = await getArtists(session.spotifyAccessToken, artistIdArray, undefined, c.env.SESSIONS);

    const artistGenreMap = new Map<string, string[]>();
    for (const artist of artists) {
      artistGenreMap.set(artist.id, artist.genres);
    }

    // Build genre data for this chunk
    const genreData = new Map<string, { count: number; trackIds: string[] }>();

    for (const { track } of allChunkTracks) {
      const trackGenres = new Set<string>();
      for (const artist of track.artists) {
        const genres = artistGenreMap.get(artist.id) || [];
        genres.forEach(g => trackGenres.add(g));
      }

      for (const genre of trackGenres) {
        let data = genreData.get(genre);
        if (!data) {
          data = { count: 0, trackIds: [] };
          genreData.set(genre, data);
        }
        data.count++;
        data.trackIds.push(track.id);
      }
    }

    // Convert to array
    const genres = [...genreData.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        trackIds: data.trackIds,
      }))
      .sort((a, b) => b.count - a.count);

    const chunkData: ChunkCacheData = {
      genres,
      trackCount: allChunkTracks.length,
      artistCount: artistIds.size,
      cachedAt: Date.now(),
    };

    // Cache this chunk
    // CRITICAL FIX: Use cachedKV for chunk cache writes
    await cachedKV.put(c.env.SESSIONS, chunkCacheKey, JSON.stringify(chunkData), {
      expirationTtl: GENRE_CACHE_TTL,
      immediate: false // Can be batched - chunks are accessed sequentially
    });

    const hasMore = offset + allChunkTracks.length < totalInLibrary;

    return c.json({
      chunk: chunkData,
      pagination: {
        offset,
        limit,
        hasMore,
        nextOffset: hasMore ? offset + allChunkTracks.length : null,
        totalInLibrary,
      },
      progress: Math.min(100, Math.round(((offset + allChunkTracks.length) / totalInLibrary) * 100)),
      fromCache: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error fetching genre chunk:', err);
    return c.json({
      error: 'Failed to fetch genre chunk',
      details: message,
    }, 500);
  }
});

// Discriminated union types for validation results
type ValidationSuccess<T> = { valid: true; value: T };
type ValidationError = { valid: false; error: string };
type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// Helper to validate track IDs
function validateTrackIds(trackIds: unknown): ValidationResult<string[]> {
  if (!Array.isArray(trackIds)) {
    return { valid: false, error: 'trackIds must be an array' };
  }
  if (trackIds.length === 0) {
    return { valid: false, error: 'trackIds cannot be empty' };
  }
  if (trackIds.length > MAX_TRACK_IDS) {
    return { valid: false, error: `trackIds exceeds maximum of ${MAX_TRACK_IDS}` };
  }

  const validIds: string[] = [];
  for (const id of trackIds) {
    if (typeof id !== 'string' || !SPOTIFY_TRACK_ID_REGEX.test(id)) {
      return { valid: false, error: 'Invalid track ID format detected' };
    }
    validIds.push(id);
  }

  return { valid: true, value: validIds };
}

// Helper to sanitise genre name (#99e - whitelist approach)
// Whitelist: letters (including unicode), numbers, spaces, hyphens, ampersands, apostrophes, parentheses, dots, commas
const GENRE_WHITELIST_REGEX = /^[\p{L}\p{N}\s\-&'().,:!?/+]+$/u;

function sanitiseGenreName(genre: unknown): ValidationResult<string> {
  if (typeof genre !== 'string') {
    return { valid: false, error: 'Genre must be a string' };
  }
  const trimmed = genre.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Genre cannot be empty' };
  }
  if (trimmed.length > MAX_GENRE_NAME_LENGTH) {
    return { valid: false, error: `Genre name exceeds ${MAX_GENRE_NAME_LENGTH} characters` };
  }
  // Whitelist validation - only allow safe characters
  if (!GENRE_WHITELIST_REGEX.test(trimmed)) {
    // Strip non-whitelisted characters instead of rejecting
    const sanitised = trimmed.replace(/[^\p{L}\p{N}\s\-&'().,:!?/+]/gu, '');
    if (sanitised.length === 0) {
      return { valid: false, error: 'Genre name contains only invalid characters' };
    }
    return { valid: true, value: sanitised };
  }
  return { valid: true, value: trimmed };
}

// Create a playlist for a specific genre
api.post('/playlist', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json<{
      genre: string;
      trackIds: string[];
      force?: boolean;
      customName?: string;
      customDescription?: string;
    }>();
    const { genre, trackIds, force, customName, customDescription } = body;

    // Validate genre name
    const genreValidation = sanitiseGenreName(genre);
    if (!genreValidation.valid) {
      return c.json({ error: genreValidation.error }, 400);
    }

    // Validate track IDs
    const trackValidation = validateTrackIds(trackIds);
    if (!trackValidation.valid) {
      return c.json({ error: trackValidation.error }, 400);
    }

    // Validate custom name if provided
    let playlistName: string;
    if (customName && customName.trim()) {
      const nameValidation = sanitiseGenreName(customName.trim());
      if (!nameValidation.valid) {
        return c.json({ error: 'Invalid playlist name' }, 400);
      }
      playlistName = nameValidation.value;
    } else {
      playlistName = `${genreValidation.value} (from Likes)`;
    }

    const user = await getCurrentUser(session.spotifyAccessToken);
    const safeName = genreValidation.value;
    const safeTrackIds = trackValidation.value;

    // Check for duplicate playlist unless force=true
    if (!force) {
      const existingPlaylists = await getUserPlaylists(session.spotifyAccessToken);
      const duplicate = existingPlaylists.find(
        p => p.name.toLowerCase() === playlistName.toLowerCase() && p.owner.id === user.id
      );
      if (duplicate) {
        return c.json({
          success: false,
          duplicate: true,
          existingPlaylist: {
            id: duplicate.id,
            name: duplicate.name,
            trackCount: duplicate.tracks.total,
          },
          message: `A playlist named "${playlistName}" already exists with ${duplicate.tracks.total} tracks`,
        });
      }
    }

    // Use custom description or default
    const description = customDescription && customDescription.trim()
      ? customDescription.trim().slice(0, 300) // Spotify has 300 char limit
      : `${safeName} tracks from your liked songs ♫ Created with Spotify Genre Sorter — organise your music library into genre playlists automatically at github.com/TomsTech/spotify-genre-sorter`;

    const playlist = await createPlaylist(
      session.spotifyAccessToken,
      user.id,
      playlistName,
      description,
      false
    );

    const trackUris = safeTrackIds.map(id => `spotify:track:${id}`);
    await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

    // Invalidate cache since library has changed
    await invalidateGenreCache(c.env.SESSIONS, user.id);

    // Update user stats
    await addPlaylistToUser(c.env.SESSIONS, user.id, playlist.id, safeTrackIds.length);

    // Add to recent playlists feed
    const recentPlaylist: RecentPlaylist = {
      playlistId: playlist.id,
      playlistName: playlistName,
      genre: safeName,
      trackCount: safeTrackIds.length,
      createdBy: {
        spotifyId: user.id,
        spotifyName: user.display_name,
        spotifyAvatar: user.images?.[0]?.url,
      },
      createdAt: new Date().toISOString(),
      spotifyUrl: playlist.external_urls.spotify,
    };
    await addRecentPlaylist(c.env.SESSIONS, recentPlaylist);

    // Track playlist creation in analytics
    await trackAnalyticsEvent(c.env.SESSIONS, 'playlistCreated', { visitorId: user.id });

    return c.json({
      success: true,
      playlist: {
        id: playlist.id,
        url: playlist.external_urls.spotify,
        name: playlistName,
        trackCount: safeTrackIds.length,
      },
    });
  } catch (err) {
    console.error('Error creating playlist:', err);
    return c.json({ error: 'Failed to create playlist' }, 500);
  }
});

// Create playlists for multiple genres at once
api.post('/playlists/bulk', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json<{
      genres: { name: string; trackIds: string[] }[];
      skipDuplicates?: boolean;
    }>();
    const { genres, skipDuplicates } = body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return c.json({ error: 'Genres array required' }, 400);
    }

    if (genres.length > MAX_GENRES_BULK) {
      return c.json({ error: `Maximum ${MAX_GENRES_BULK} genres allowed per request` }, 400);
    }

    const user = await getCurrentUser(session.spotifyAccessToken);

    // Fetch existing playlists once for duplicate checking
    const existingPlaylists = await getUserPlaylists(session.spotifyAccessToken);
    const existingNames = new Set(
      existingPlaylists
        .filter(p => p.owner.id === user.id)
        .map(p => p.name.toLowerCase())
    );

    const results: { genre: string; success: boolean; url?: string; error?: string; skipped?: boolean }[] = [];

    for (const { name, trackIds } of genres) {
      // Validate each genre
      const genreValidation = sanitiseGenreName(name);
      if (!genreValidation.valid) {
        results.push({ genre: String(name), success: false, error: genreValidation.error });
        continue;
      }

      const trackValidation = validateTrackIds(trackIds);
      if (!trackValidation.valid) {
        results.push({ genre: genreValidation.value, success: false, error: trackValidation.error });
        continue;
      }

      const safeName = genreValidation.value;
      const playlistName = `${safeName} (from Likes)`;

      // Check for duplicate
      if (existingNames.has(playlistName.toLowerCase())) {
        if (skipDuplicates) {
          results.push({
            genre: safeName,
            success: false,
            skipped: true,
            error: 'Playlist already exists',
          });
          continue;
        }
      }

      try {
        const safeTrackIds = trackValidation.value;

        const playlist = await createPlaylist(
          session.spotifyAccessToken,
          user.id,
          playlistName,
          `${safeName} tracks from your liked songs ♫ Created with Spotify Genre Sorter — organise your music library into genre playlists automatically at github.com/TomsTech/spotify-genre-sorter`,
          false
        );

        const trackUris = safeTrackIds.map(id => `spotify:track:${id}`);
        await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

        // Add to existing names to prevent duplicates within same batch
        existingNames.add(playlistName.toLowerCase());

        // Update user stats
        await addPlaylistToUser(c.env.SESSIONS, user.id, playlist.id, safeTrackIds.length);

        // Add to recent playlists feed
        const recentPlaylist: RecentPlaylist = {
          playlistId: playlist.id,
          playlistName: playlistName,
          genre: safeName,
          trackCount: safeTrackIds.length,
          createdBy: {
            spotifyId: user.id,
            spotifyName: user.display_name,
            spotifyAvatar: user.images?.[0]?.url,
          },
          createdAt: new Date().toISOString(),
          spotifyUrl: playlist.external_urls.spotify,
        };
        await addRecentPlaylist(c.env.SESSIONS, recentPlaylist);

        results.push({
          genre: safeName,
          success: true,
          url: playlist.external_urls.spotify,
        });
      } catch {
        // Don't expose internal error details
        results.push({
          genre: safeName,
          success: false,
          error: 'Failed to create playlist',
        });
      }
    }

    // Invalidate cache if any playlists were created
    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    if (successCount > 0) {
      await invalidateGenreCache(c.env.SESSIONS, user.id);
      // Track bulk playlist creation in analytics (single KV write instead of N writes)
      await trackAnalyticsEvent(c.env.SESSIONS, 'playlistCreated', { visitorId: user.id, count: successCount });
    }

    return c.json({
      total: genres.length,
      successful: successCount,
      skipped: skippedCount,
      results,
    });
  } catch (err) {
    console.error('Error creating playlists:', err);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

// Changelog endpoint - dynamically fetches from GitHub releases with caching
const CHANGELOG_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let changelogCache: { data: unknown; timestamp: number } | null = null;

api.get('/changelog', async (c) => {
  const REPO_URL = 'https://github.com/TomsTech/spotify-genre-sorter';
  const API_URL = 'https://api.github.com/repos/TomsTech/spotify-genre-sorter/releases';

  // Check cache first
  if (changelogCache && Date.now() - changelogCache.timestamp < CHANGELOG_CACHE_TTL) {
    return c.json(changelogCache.data);
  }

  try {
    // Fetch releases from GitHub API
    const response = await fetch(API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Genre-Genie-App',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const releases: Array<{
      tag_name: string;
      published_at: string;
      body: string;
      name: string;
    }> = await response.json();

    // Transform GitHub releases to our changelog format
    const changelog = releases.slice(0, 10).map((release) => {
      // Extract version from tag (e.g., "v3.4.0" -> "3.4.0")
      const version = release.tag_name.replace(/^v/, '');

      // Extract date from published_at
      const date = release.published_at.split('T')[0];

      // Parse release body into changes array
      // Look for markdown list items (- or *)
      const bodyLines = (release.body || '').split('\n');
      const changes: string[] = [];

      for (const line of bodyLines) {
        const trimmed = line.trim();
        // Match markdown list items: - item or * item
        const match = trimmed.match(/^[-*]\s+(.+)$/);
        if (match) {
          // Clean up the change text (remove markdown formatting)
          const change = match[1]
            .replace(/\*\*/g, '')  // Remove bold
            .replace(/`/g, '')     // Remove code ticks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links, keep text
          changes.push(change);
        }
      }

      // If no list items found, use the release name or first line
      if (changes.length === 0) {
        changes.push(release.name || `Release ${version}`);
      }

      return {
        version,
        date,
        changes: changes.slice(0, 8), // Limit to 8 changes per release
      };
    });

    const result = {
      changelog,
      repoUrl: REPO_URL,
      cached: false,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    changelogCache = {
      data: { ...result, cached: true },
      timestamp: Date.now(),
    };

    return c.json(result);
  } catch (error) {
    console.error('Failed to fetch GitHub releases:', error);

    // If we have stale cache, return it
    if (changelogCache) {
      return c.json({ ...changelogCache.data as object, stale: true });
    }

    // Fallback to static data if GitHub API fails and no cache
    const fallbackChangelog = [
      {
        version: '3.4.0',
        date: '2025-12-09',
        changes: ['Dynamic changelog from GitHub releases', 'Bug fixes and improvements'],
      },
    ];

    return c.json({
      changelog: fallbackChangelog,
      repoUrl: REPO_URL,
      error: 'Failed to fetch releases, showing fallback',
    });
  }
});

// ================== Leaderboard & Scoreboard Endpoints ==================

// Get scoreboard (top users by category)
api.get('/scoreboard', async (c) => {
  try {
    // Try to get cached scoreboard
    let scoreboard = await getScoreboard(c.env.SESSIONS);
    let fromCache = true;

    if (!scoreboard) {
      // Build fresh scoreboard
      scoreboard = await buildScoreboard(c.env.SESSIONS);
      fromCache = false;
    }

    // Calculate cache age for transparency
    const cacheAge = Math.round((Date.now() - new Date(scoreboard.updatedAt).getTime()) / 1000);
    const nextRefresh = Math.max(0, 3600 - cacheAge); // 1 hour cache

    return c.json({
      ...scoreboard,
      _cache: {
        ageSeconds: cacheAge,
        nextRefreshSeconds: nextRefresh,
        fromCache,
        ttl: '1 hour',
      },
    });
  } catch (err) {
    console.error('Error fetching scoreboard:', err);
    return c.json({ error: 'Failed to fetch scoreboard' }, 500);
  }
});

// Get leaderboard (pioneers + new users) - CACHED to reduce KV usage
api.get('/leaderboard', async (c) => {
  try {
    // Try to get cached leaderboard first (reduces 112+ KV ops to 1 read)
    let leaderboard = await getLeaderboard(c.env.SESSIONS);
    let fromCache = true;

    if (!leaderboard) {
      // Build fresh leaderboard and cache it
      leaderboard = await buildLeaderboard(c.env.SESSIONS);
      fromCache = false;
    }

    // Calculate cache age for transparency
    const cacheAge = Math.round((Date.now() - new Date(leaderboard.updatedAt).getTime()) / 1000);
    const nextRefresh = Math.max(0, 900 - cacheAge); // 15 min cache

    return c.json({
      pioneers: leaderboard.pioneers,
      newUsers: leaderboard.newUsers,
      totalUsers: leaderboard.totalUsers,
      _cache: {
        updatedAt: leaderboard.updatedAt,
        ageSeconds: cacheAge,
        nextRefreshSeconds: nextRefresh,
        fromCache,
        ttl: '15 minutes',
      },
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return c.json({ error: 'Failed to fetch leaderboard' }, 500);
  }
});

// Get all users currently listening to music (public endpoint)
// Reads listening:* keys from KV (auto-expiring entries set by /now-playing)
api.get('/listening', async (c) => {
  try {
    const kv = c.env.SESSIONS;
    const list = await kv.list({ prefix: 'listening:', limit: 50 });

    interface ListeningEntry {
      spotifyId: string;
      spotifyName: string;
      spotifyAvatar: string | null;
      track: {
        name: string;
        artists: string;
        albumArt: string | null;
        url: string;
      };
      updatedAt: string;
    }

    // PERF-013 FIX: Use Promise.all for parallel reads instead of sequential loop
    const dataPromises = list.keys.map(key => kv.get(key.name));
    const dataResults = await Promise.all(dataPromises);

    const listeners: ListeningEntry[] = [];
    for (const data of dataResults) {
      if (data) {
        try {
          const entry = JSON.parse(data) as ListeningEntry;
          listeners.push(entry);
        } catch { /* skip malformed entries */ }
      }
    }

    return c.json({
      listeners,
      count: listeners.length,
    });
  } catch (err) {
    console.error('Error fetching listening data:', err);
    return c.json({ listeners: [], count: 0 });
  }
});

// Get recent playlists feed
api.get('/recent-playlists', async (c) => {
  try {
    const playlists = await getRecentPlaylists(c.env.SESSIONS);
    return c.json({ playlists });
  } catch (err) {
    console.error('Error fetching recent playlists:', err);
    return c.json({ error: 'Failed to fetch recent playlists' }, 500);
  }
});



// Get user's playlists for scanning
api.get('/my-playlists', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated with Spotify' }, 401);
  }

  try {
    // Refresh token if needed
    let accessToken = session.spotifyAccessToken;
    if (session.spotifyExpiresAt && session.spotifyRefreshToken && Date.now() > session.spotifyExpiresAt - 60000) {
      const refreshed = await refreshSpotifyToken(
        session.spotifyRefreshToken,
        c.env.SPOTIFY_CLIENT_ID,
        c.env.SPOTIFY_CLIENT_SECRET
      );
      accessToken = refreshed.access_token;
      await updateSession(c, {
        spotifyAccessToken: refreshed.access_token,
        spotifyExpiresAt: Date.now() + refreshed.expires_in * 1000,
      });
    }

    const playlists = await getUserPlaylists(accessToken);

    // Return playlists with basic info
    return c.json({
      playlists: playlists.map(p => ({
        id: p.id,
        name: p.name,
        trackCount: p.tracks.total,
        isOwner: p.owner.id === session.spotifyUserId
      }))
    });
  } catch (err) {
    console.error('Error fetching playlists:', err);
    return c.json({ error: 'Failed to fetch playlists' }, 500);
  }
});

// Scan a specific playlist for genres
api.get('/scan-playlist/:playlistId', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated with Spotify' }, 401);
  }

  const playlistId = c.req.param('playlistId');
  if (!playlistId || !/^[a-zA-Z0-9]{22}$/.test(playlistId)) {
    return c.json({ error: 'Invalid playlist ID' }, 400);
  }

  try {
    // Refresh token if needed
    let accessToken = session.spotifyAccessToken;
    if (session.spotifyExpiresAt && session.spotifyRefreshToken && Date.now() > session.spotifyExpiresAt - 60000) {
      const refreshed = await refreshSpotifyToken(
        session.spotifyRefreshToken,
        c.env.SPOTIFY_CLIENT_ID,
        c.env.SPOTIFY_CLIENT_SECRET
      );
      accessToken = refreshed.access_token;
      await updateSession(c, {
        spotifyAccessToken: refreshed.access_token,
        spotifyExpiresAt: Date.now() + refreshed.expires_in * 1000,
      });
    }

    // Get playlist tracks (limit to 500 to stay under subrequest limit)
    const tracks = await getPlaylistTracks(accessToken, playlistId, 500);

    // Get unique artists
    const artistIds = new Set<string>();
    const trackData: { id: string; name: string; artistIds: string[] }[] = [];

    for (const item of tracks) {
      if (item.track && item.track.id) {
        const artistIdsForTrack = item.track.artists.map(a => a.id);
        artistIdsForTrack.forEach(id => artistIds.add(id));
        trackData.push({
          id: item.track.id,
          name: item.track.name,
          artistIds: artistIdsForTrack
        });
      }
    }

    // Get artist genres
    const artistIdList = Array.from(artistIds);
    const artistGenres = new Map<string, string[]>();

    // Fetch artists in batches of 50 (limited to stay under subrequest limit)
    // Pass KV namespace to enable persistent caching (#74)
    for (let i = 0; i < artistIdList.length && i < 500; i += 50) {
      const batch = artistIdList.slice(i, i + 50);
      const { artists } = await getArtists(accessToken, batch, undefined, c.env.SESSIONS);
      for (const artist of artists) {
        artistGenres.set(artist.id, artist.genres);
      }
    }

    // Aggregate genres
    const genreCounts = new Map<string, { count: number; trackIds: string[] }>();

    for (const track of trackData) {
      const trackGenres = new Set<string>();
      for (const artistId of track.artistIds) {
        const genres = artistGenres.get(artistId) || [];
        genres.forEach(g => trackGenres.add(g));
      }

      for (const genre of trackGenres) {
        const existing = genreCounts.get(genre) || { count: 0, trackIds: [] };
        existing.count++;
        existing.trackIds.push(track.id);
        genreCounts.set(genre, existing);
      }
    }

    // Convert to sorted array
    const genres = Array.from(genreCounts.entries())
      .map(([name, data]) => ({ name, count: data.count, trackIds: data.trackIds }))
      .sort((a, b) => b.count - a.count);

    return c.json({
      totalTracks: trackData.length,
      totalArtists: artistIds.size,
      totalGenres: genres.length,
      genres,
      truncated: tracks.length >= 500
    });
  } catch (err) {
    console.error('Error scanning playlist:', err);
    return c.json({ error: 'Failed to scan playlist' }, 500);
  }
});



// Get user preferences
api.get('/preferences', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyUserId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const prefs = await getUserPreferences(c.env.SESSIONS, session.spotifyUserId);
    return c.json({ preferences: prefs });
  } catch (err) {
    console.error('Error fetching preferences:', err);
    return c.json({ error: 'Failed to fetch preferences' }, 500);
  }
});

// Update user preferences
api.post('/preferences', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyUserId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body: Record<string, unknown> = await c.req.json();

    // Validate allowed fields
    const allowedFields = ['theme', 'swedishMode', 'playlistTemplate', 'hiddenGenres', 'showHiddenGenres', 'tutorialCompleted'] as const;
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const prefs = await updateUserPreferences(c.env.SESSIONS, session.spotifyUserId, updates);
    return c.json({ preferences: prefs });
  } catch (err) {
    console.error('Error updating preferences:', err);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});


// Store invite requests
const INVITE_REQUESTS_KEY = 'invite_requests';

// Submit invite request
api.post('/invite-request', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body: Record<string, unknown> = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!email || email.length < 3 || email.length > 100) {
      return c.json({ error: 'Invalid email/name' }, 400);
    }

    // Store the request
    const existingRaw = await c.env.SESSIONS.get(INVITE_REQUESTS_KEY);
    interface InviteRequest {
      email: string;
      note: string;
      createdAt: string;
      status: 'pending' | 'approved' | 'denied';
      ip?: string;
    }
    const existing: InviteRequest[] = existingRaw ? JSON.parse(existingRaw) as InviteRequest[] : [];

    // Check if already requested
    if (existing.some(r => r.email.toLowerCase() === email.toLowerCase())) {
      return c.json({ error: 'Request already submitted' }, 409);
    }

    const request: InviteRequest = {
      email,
      note,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ip: c.req.header('cf-connecting-ip') || undefined
    };

    existing.push(request);
    await c.env.SESSIONS.put(INVITE_REQUESTS_KEY, JSON.stringify(existing));

    // Track analytics
    await trackAnalyticsEvent(c.env.SESSIONS, 'inviteRequest');

    return c.json({
      success: true,
      message: 'Request submitted! You will receive an email when reviewed.',
      trackingUrl: null // Could add tracking later
    });
  } catch (err) {
    console.error('Error submitting invite request:', err);
    return c.json({ error: 'Failed to submit request' }, 500);
  }
});

// Admin endpoint to view invite requests
api.get('/admin/invites', async (c) => {
  const session = await getSession(c);
  const adminUsers = ['tomspseudonym', 'tomstech'];

  if (!session?.spotifyUser || !adminUsers.includes(session.spotifyUser.toLowerCase())) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const requestsRaw = await c.env.SESSIONS.get(INVITE_REQUESTS_KEY);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const requests: unknown[] = requestsRaw ? JSON.parse(requestsRaw) as unknown[] : [];
    return c.json({ requests });
  } catch (err) {
    console.error('Error fetching invites:', err);
    return c.json({ error: 'Failed to fetch invites' }, 500);
  }
});

// ====================================
// Frontend Error & Performance Logging
// ====================================

const ERROR_LOG_KEY = 'client_errors';
const PERF_LOG_KEY = 'client_perf';

// Log frontend JS errors
api.post('/log-error', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body: Record<string, unknown> = await c.req.json();
    const errors = Array.isArray(body.errors) ? body.errors : [];

    if (errors.length === 0) {
      return c.json({ ok: true });
    }

    // Get existing errors (last 100)
    // CRITICAL FIX: Use cachedKV for error log reads
    const existing = await cachedKV.get<unknown[]>(c.env.SESSIONS, ERROR_LOG_KEY) || [];

    // Add new errors with server timestamp
    const newErrors = errors.slice(0, 10).map((e: unknown) => ({
      ...(typeof e === 'object' && e !== null ? e : { raw: e }),
      serverTime: new Date().toISOString(),
      ip: c.req.header('cf-connecting-ip') || 'unknown'
    }));

    // Keep last 100 errors
    const combined = [...newErrors, ...existing].slice(0, 100);

    // CRITICAL FIX: Use cachedKV with batching for error logs (non-critical, can be delayed)
    await cachedKV.put(c.env.SESSIONS, ERROR_LOG_KEY, JSON.stringify(combined), {
      expirationTtl: 86400 * 7, // 7 days
      immediate: false // Batch error logs to reduce KV writes
    });

    // Log to console for immediate visibility
    console.error('[CLIENT ERROR]', JSON.stringify(newErrors[0]));

    return c.json({ ok: true, logged: newErrors.length });
  } catch (err) {
    console.error('Error logging client errors:', err);
    return c.json({ error: 'Failed to log' }, 500);
  }
});

// Log frontend performance metrics
api.post('/log-perf', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body: Record<string, unknown> = await c.req.json();

    // Validate basic structure
    if (typeof body.pageLoadTime !== 'number') {
      return c.json({ ok: true }); // Silently ignore invalid data
    }

    // Get existing perf data (last 1000 samples)
    // CRITICAL FIX: Use cachedKV for perf log reads
    const existing = await cachedKV.get<unknown[]>(c.env.SESSIONS, PERF_LOG_KEY) || [];

    // Add new sample
    const sample = {
      pageLoadTime: body.pageLoadTime,
      domContentLoaded: body.domContentLoaded,
      timeToFirstByte: body.timeToFirstByte,
      serverResponse: body.serverResponse,
      timestamp: new Date().toISOString(),
      userAgent: c.req.header('user-agent')?.substring(0, 100) || 'unknown'
    };

    const combined = [sample, ...existing].slice(0, 1000);

    // CRITICAL FIX: Use cachedKV with batching for perf logs (non-critical, can be delayed)
    await cachedKV.put(c.env.SESSIONS, PERF_LOG_KEY, JSON.stringify(combined), {
      expirationTtl: 86400 * 30, // 30 days
      immediate: false // Batch perf logs to reduce KV writes
    });

    return c.json({ ok: true });
  } catch (err) {
    console.error('Error logging perf:', err);
    return c.json({ error: 'Failed to log' }, 500);
  }
});

// Admin endpoint to view error logs
api.get('/admin/errors', async (c) => {
  const session = await getSession(c);
  const adminUsers = ['tomspseudonym', 'tomstech'];

  if (!session?.spotifyUser || !adminUsers.includes(session.spotifyUser.toLowerCase())) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const errorsRaw = await c.env.SESSIONS.get(ERROR_LOG_KEY);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const errors: unknown[] = errorsRaw ? JSON.parse(errorsRaw) as unknown[] : [];
    return c.json({ errors, count: errors.length });
  } catch {
    return c.json({ error: 'Failed to fetch errors' }, 500);
  }
});

// Admin endpoint to view performance metrics
api.get('/admin/perf', async (c) => {
  const session = await getSession(c);
  const adminUsers = ['tomspseudonym', 'tomstech'];

  if (!session?.spotifyUser || !adminUsers.includes(session.spotifyUser.toLowerCase())) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const perfRaw = await c.env.SESSIONS.get(PERF_LOG_KEY);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const samples: unknown[] = perfRaw ? JSON.parse(perfRaw) as unknown[] : [];

    // Calculate averages
    const validSamples = samples.filter((s: unknown): s is Record<string, number> =>
      typeof s === 'object' && s !== null && typeof (s as Record<string, unknown>).pageLoadTime === 'number'
    );

    const avg = (key: string) => {
      const values = validSamples
        .map(s => s[key])
        .filter((v): v is number => typeof v === 'number' && v > 0);
      return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    };

    return c.json({
      samples: samples.slice(0, 50), // Last 50 samples
      totalSamples: samples.length,
      averages: {
        pageLoadTime: avg('pageLoadTime'),
        domContentLoaded: avg('domContentLoaded'),
        timeToFirstByte: avg('timeToFirstByte'),
        serverResponse: avg('serverResponse')
      }
    });
  } catch {
    return c.json({ error: 'Failed to fetch perf data' }, 500);
  }
});

// Analytics dashboard data (public, for Better Stack monitoring)
api.get('/analytics', async (c) => {
  try {
    const analytics = await getAnalytics(c.env.SESSIONS);
    return c.json(analytics);
  } catch (err) {
    console.error('Error fetching analytics:', err);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

// KV usage estimation endpoint for status page monitoring
// Cloudflare Workers free tier: 100k reads/day, 1k writes/day
api.get('/kv-usage', async (c) => {
  try {
    const analytics = await getAnalytics(c.env.SESSIONS);
    const today = analytics.today;

    // Get real-time metrics from the kv-cache layer
    const realtimeMetrics = getKVMetrics();
    const last7Days = analytics.last7Days;

    // Estimate KV operations by category (after optimizations)
    // Sessions: 1 read per authenticated request
    // Caches: leaderboard (5min), scoreboard (1h), genre (1-24h)
    // User stats: 1 read + 1 write per playlist
    // Recent playlists: 1 read per poll, 1 read + 1 write per add

    const breakdown = {
      sessions: {
        reads: Math.round(today.libraryScans * 2 + today.playlistsCreated * 2),
        writes: today.signIns * 2, // create + update
      },
      caches: {
        reads: Math.round(today.pageViews * 0.5), // Most are cache hits
        writes: Math.round(today.pageViews * 0.02), // Rare cache rebuilds
      },
      userStats: {
        reads: today.playlistsCreated,
        writes: today.playlistsCreated,
      },
      recentPlaylists: {
        reads: Math.round(today.pageViews * 0.3), // Polling (now 3min interval)
        writes: today.playlistsCreated,
      },
      auth: {
        reads: today.signIns * 3,
        writes: today.signIns * 2,
      },
    };

    const estimatedReads = Object.values(breakdown).reduce((sum, cat) => sum + cat.reads, 0);
    const estimatedWrites = Object.values(breakdown).reduce((sum, cat) => sum + cat.writes, 0);

    // Free tier limits
    const READ_LIMIT = 100000;
    const WRITE_LIMIT = 1000;

    const readUsagePercent = Math.round((estimatedReads / READ_LIMIT) * 100);
    const writeUsagePercent = Math.round((estimatedWrites / WRITE_LIMIT) * 100);

    // Determine status and any recommendations
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    const recommendations: string[] = [];

    if (writeUsagePercent > 90 || readUsagePercent > 90) {
      status = 'critical';
    } else if (writeUsagePercent > 80 || readUsagePercent > 80) {
      status = 'warning';
    }

    // Smart recommendations based on usage patterns
    if (breakdown.recentPlaylists.reads > estimatedReads * 0.4) {
      recommendations.push('Consider increasing polling interval for recent playlists');
    }
    if (breakdown.userStats.writes > 50) {
      recommendations.push('High playlist creation activity - stats writes elevated');
    }
    if (today.authFailures > 10) {
      recommendations.push('Elevated auth failures detected - possible attack or misconfiguration');
    }

    // Calculate 7-day trend
    const avgDailyWrites = Math.round(
      (last7Days.signIns * 2 + last7Days.libraryScans + last7Days.playlistsCreated * 2) / 7
    );
    const trend = estimatedWrites > avgDailyWrites * 1.5 ? 'increasing' :
                  estimatedWrites < avgDailyWrites * 0.5 ? 'decreasing' : 'stable';

    return c.json({
      date: today.date,
      estimated: {
        reads: estimatedReads,
        writes: estimatedWrites,
      },
      breakdown,
      limits: {
        reads: READ_LIMIT,
        writes: WRITE_LIMIT,
      },
      usage: {
        readsPercent: readUsagePercent,
        writesPercent: writeUsagePercent,
        readsRemaining: READ_LIMIT - estimatedReads,
        writesRemaining: WRITE_LIMIT - estimatedWrites,
      },
      trend: {
        direction: trend,
        avgDailyWrites,
        todayVsAvg: avgDailyWrites > 0 ? `${Math.round((estimatedWrites / avgDailyWrites) * 100)}%` : 'N/A',
      },
      status,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      activity: {
        signIns: today.signIns,
        libraryScans: today.libraryScans,
        playlistsCreated: today.playlistsCreated,
        authFailures: today.authFailures,
      },
      optimizations: {
        leaderboardCacheTTL: '15 minutes',
        scoreboardCacheTTL: '1 hour',
        pollingInterval: '3 minutes',
        pageViewTracking: 'disabled (using Cloudflare Analytics)',
        analyticsSampling: '10% (90% reduction in writes)',
      },
      // Real-time metrics from kv-cache layer (since worker started)
      realtime: {
        reads: realtimeMetrics.reads,
        writes: realtimeMetrics.writes,
        deletes: realtimeMetrics.deletes,
        cacheHits: realtimeMetrics.cacheHits,
        cacheMisses: realtimeMetrics.cacheMisses,
        cacheHitRate: realtimeMetrics.cacheHits + realtimeMetrics.cacheMisses > 0
          ? Math.round((realtimeMetrics.cacheHits / (realtimeMetrics.cacheHits + realtimeMetrics.cacheMisses)) * 100)
          : 0,
        lastReset: new Date(realtimeMetrics.lastReset).toISOString(),
      },
    });
  } catch (err) {
    console.error('Error fetching KV usage:', err);
    return c.json({ error: 'Failed to fetch KV usage' }, 500);
  }
});

// In-memory KV metrics (for monitoring cache effectiveness)
api.get('/kv-metrics', (c) => {
  const metrics = getKVMetrics();

  // Calculate cache hit ratio
  const totalCacheRequests = metrics.cacheHits + metrics.cacheMisses;
  const hitRatio = totalCacheRequests > 0 ? Math.round((metrics.cacheHits / totalCacheRequests) * 100) : 0;

  // Estimate KV savings
  const estimatedKVReadsSaved = metrics.cacheHits;
  const actualKVReads = metrics.reads;

  return c.json({
    timestamp: new Date().toISOString(),
    metrics: {
      kvReads: metrics.reads,
      kvWrites: metrics.writes,
      kvDeletes: metrics.deletes,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
    },
    cacheEfficiency: {
      hitRatio: `${hitRatio}%`,
      estimatedKVReadsSaved,
      actualKVReads,
      reduction: actualKVReads > 0 ? `${Math.round((estimatedKVReadsSaved / (estimatedKVReadsSaved + actualKVReads)) * 100)}%` : 'N/A',
    },
    note: 'Metrics reset daily and when worker restarts',
  });
});


// ================== Admin Debug Panel ==================

/**
 * Get admin users from environment variable (security: no hardcoded admins)
 * Format: comma-separated usernames, e.g., "user1,user2,user3"
 */
function getAdminUsers(env: Env): string[] {
  const adminList = env.ADMIN_USERS || '';
  if (!adminList.trim()) return [];
  return adminList.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
}

async function isAdmin(c: { env: Env }, session: { githubUser?: string; spotifyUserId?: string } | null): Promise<boolean> {
  if (!session) return false;
  const adminUsers = getAdminUsers(c.env);
  if (adminUsers.length === 0) return false; // No admins configured = no admin access
  if (session.githubUser && adminUsers.includes(session.githubUser.toLowerCase())) return true;
  if (session.spotifyUserId) {
    try {
      const stats = await c.env.SESSIONS.get(`user_stats:${session.spotifyUserId}`);
      if (stats) {
        const parsed = JSON.parse(stats) as { spotifyName?: string };
        if (parsed.spotifyName && adminUsers.includes(parsed.spotifyName.toLowerCase())) return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

api.get('/admin', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const kv = c.env.SESSIONS;
  const metrics = getKVMetrics();
  const analytics = await getAnalytics(kv);

  const keyCounts: Record<string, number> = {};
  for (const prefix of ['session:', 'user:', 'user_stats:', 'hof:', 'genre_cache_', 'scan_progress:']) {
    const list = await kv.list({ prefix, limit: 1000 });
    keyCounts[prefix] = list.keys.length;
  }

  return c.json({
    admin: { user: session?.githubUser || session?.spotifyUserId, accessTime: new Date().toISOString() },
    health: { kvConnected: true, totalUsers: keyCounts['user_stats:'] || 0, activeSessions: keyCounts['session:'] || 0 },
    kvMetrics: { reads: metrics.reads, writes: metrics.writes, cacheHits: metrics.cacheHits },
    keyCounts,
    analytics: { today: analytics.today, last7Days: analytics.last7Days },
    version: '3.0.0',
  });
});

api.post('/admin/clear-cache', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const { cache } = await c.req.json<{ cache: string }>();
  const kv = c.env.SESSIONS;
  let cleared = 0;

  switch (cache) {
    case 'leaderboard': await kv.delete('leaderboard_cache'); cleared = 1; break;
    case 'scoreboard': await kv.delete('scoreboard_cache'); cleared = 1; break;
    case 'all_genre_caches': {
      const list = await kv.list({ prefix: 'genre_cache_' });
      for (const key of list.keys) { await kv.delete(key.name); cleared++; }
      break;
    }
  }
  return c.json({ success: true, keysCleared: cleared });
});

api.post('/admin/rebuild-caches', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const kv = c.env.SESSIONS;
  await buildLeaderboard(kv);
  await buildScoreboard(kv);
  return c.json({ success: true, timestamp: new Date().toISOString() });
});

// List all users for admin management
api.get('/admin/users', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const kv = c.env.SESSIONS;
  const userStatsList = await kv.list({ prefix: 'user_stats:', limit: 500 });

  const users: Array<{
    spotifyId: string;
    spotifyName: string;
    spotifyAvatar: string | null;
    playlistCount: number;
    registeredAt: string;
    lastActive: string | null;
    isPioneer?: boolean;
    hofPosition?: number;
  }> = [];

  // Track which Spotify IDs we've seen
  const seenIds = new Set<string>();

  // PERF-014 FIX: Use Promise.all for parallel reads instead of sequential loop
  const dataPromises = userStatsList.keys.map(key => kv.get(key.name));
  const dataResults = await Promise.all(dataPromises);

  for (const statsJson of dataResults) {
    if (statsJson) {
      try {
        const stats = JSON.parse(statsJson) as {
          spotifyId: string;
          spotifyName: string;
          spotifyAvatar?: string;
          playlistsCreated?: number;
          firstSeen?: string;
          lastActive?: string;
        };
        seenIds.add(stats.spotifyId);
        users.push({
          spotifyId: stats.spotifyId,
          spotifyName: stats.spotifyName || 'Unknown',
          spotifyAvatar: stats.spotifyAvatar || null,
          playlistCount: stats.playlistsCreated || 0,
          registeredAt: stats.firstSeen || 'Unknown',
          lastActive: stats.lastActive || null,
        });
      } catch { /* skip malformed entries */ }
    }
  }

  // Also fetch HoF users (pioneers) who might not have user_stats entries
  const hofKeys = Array.from({ length: 20 }, (_, i) => `hof:${String(i + 1).padStart(3, '0')}`);
  const hofPromises = hofKeys.map(key => kv.get(key));
  const hofResults = await Promise.all(hofPromises);

  for (let i = 0; i < hofResults.length; i++) {
    const hofJson = hofResults[i];
    if (hofJson) {
      try {
        const hofUser = JSON.parse(hofJson) as {
          spotifyId: string;
          spotifyName: string;
          spotifyAvatar?: string;
          registeredAt?: string;
        };
        // Only add if not already in users list
        if (!seenIds.has(hofUser.spotifyId)) {
          seenIds.add(hofUser.spotifyId);
          users.push({
            spotifyId: hofUser.spotifyId,
            spotifyName: hofUser.spotifyName || 'Unknown',
            spotifyAvatar: hofUser.spotifyAvatar || null,
            playlistCount: 0,
            registeredAt: hofUser.registeredAt || 'Unknown',
            lastActive: null,
            isPioneer: true,
            hofPosition: i + 1,
          });
        } else {
          // Mark existing user as pioneer
          const existingUser = users.find(u => u.spotifyId === hofUser.spotifyId);
          if (existingUser) {
            existingUser.isPioneer = true;
            existingUser.hofPosition = i + 1;
          }
        }
      } catch { /* skip malformed entries */ }
    }
  }

  // Sort by registration date (newest first)
  users.sort((a, b) => {
    if (a.registeredAt === 'Unknown') return 1;
    if (b.registeredAt === 'Unknown') return -1;
    return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
  });

  return c.json({ users, total: users.length });
});

// Delete a user and all their data
api.delete('/admin/user/:spotifyId', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  // URL decode the spotifyId in case it contains special characters
  const spotifyId = decodeURIComponent(c.req.param('spotifyId') || '');
  if (!spotifyId) return c.json({ error: 'Spotify ID required' }, 400);

  const kv = c.env.SESSIONS;
  const deleted: string[] = [];

  // Standard keys to delete (by Spotify ID)
  const keysToDelete = [
    `user_stats:${spotifyId}`,
    `user:${spotifyId}`,
    `genre_cache_${spotifyId}`,
    `scan_progress:${spotifyId}`,
    `user_prefs:${spotifyId}`,
    `listening:${spotifyId}` // Also delete listening status
  ];

  // Delete all standard keys without checking existence (delete is idempotent)
  for (const key of keysToDelete) {
    await cachedKV.delete(kv, key);
    deleted.push(key);
  }

  // Find and delete HoF entry by scanning for matching spotifyId
  // HoF keys are formatted as hof:001, hof:002, etc.
  const hofKeys = Array.from({ length: 20 }, (_, i) => `hof:${String(i + 1).padStart(3, '0')}`);
  const hofPromises = hofKeys.map(key => kv.get(key));
  const hofResults = await Promise.all(hofPromises);

  for (let i = 0; i < hofResults.length; i++) {
    if (hofResults[i]) {
      try {
        const hofData = JSON.parse(hofResults[i] as string) as { spotifyId?: string };
        if (hofData.spotifyId === spotifyId) {
          const hofKey = `hof:${String(i + 1).padStart(3, '0')}`;
          await cachedKV.delete(kv, hofKey);
          deleted.push(hofKey);
          break; // User can only be in HoF once
        }
      } catch { /* skip malformed entries */ }
    }
  }

  // Find and delete any active sessions for this user
  const sessionsList = await kv.list({ prefix: 'session:', limit: 1000 });
  for (const key of sessionsList.keys) {
    try {
      const sessionJson = await kv.get(key.name);
      if (sessionJson) {
        const sessionData = JSON.parse(sessionJson) as { spotifyUserId?: string };
        if (sessionData.spotifyUserId === spotifyId) {
          await cachedKV.delete(kv, key.name);
          deleted.push(key.name);
        }
      }
    } catch { /* skip malformed sessions */ }
  }

  // Decrement user count if we deleted a user_stats entry
  if (deleted.includes(`user_stats:${spotifyId}`)) {
    try {
      const countStr = await kv.get('stats:user_count');
      const count = countStr ? parseInt(countStr, 10) : 0;
      if (count > 0) {
        await kv.put('stats:user_count', String(count - 1));
      }
    } catch { /* ignore count errors */ }
  }

  // Clear leaderboard and scoreboard caches so they rebuild without this user
  // Use cachedKV to also clear in-memory cache
  await cachedKV.delete(kv, 'leaderboard_cache');
  await cachedKV.delete(kv, 'scoreboard_cache');

  return c.json({
    success: true,
    spotifyId,
    keysDeleted: deleted,
    message: `User ${spotifyId} removed from system`,
  });
});

// ================== Artist Genre Cache Statistics ==================

// Get artist genre cache statistics (#74 - Persistent Genre Cache)
api.get('/cache/artist-genres/stats', async (c) => {
  try {
    const { getArtistGenreCacheStats } = await import('../lib/artist-genre-cache');
    const stats = await getArtistGenreCacheStats(c.env.SESSIONS);

    // Calculate cache efficiency metrics
    const totalRequests = stats.cacheHits + stats.cacheMisses;
    const hitRate = totalRequests > 0 ? (stats.cacheHits / totalRequests) * 100 : 0;

    return c.json({
      stats: {
        totalCachedArtists: stats.totalCached,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        apiCallsSaved: stats.apiCallsSaved,
        hitRate: `${hitRate.toFixed(1)}%`,
        lastUpdated: stats.lastUpdated,
      },
      performance: {
        estimatedApiCallReduction: stats.apiCallsSaved,
        estimatedTimeSaved: `~${Math.round(stats.apiCallsSaved * 0.5)}s`, // Rough estimate
      },
      cacheConfig: {
        ttl: '30 days',
        prefix: 'artist_genre:',
        strategy: 'Persistent KV storage with 5-minute in-memory cache',
      },
    });
  } catch (err) {
    console.error('Error fetching cache stats:', err);
    return c.json({ error: 'Failed to fetch cache statistics' }, 500);
  }
});

// Admin: Clear artist genre cache
api.post('/admin/cache/artist-genres/clear', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  try {
    const { clearAllArtistGenreCache } = await import('../lib/artist-genre-cache');
    const deletedCount = await clearAllArtistGenreCache(c.env.SESSIONS);

    return c.json({
      success: true,
      deletedEntries: deletedCount,
      message: `Cleared ${deletedCount} cached artist entries`,
    });
  } catch (err) {
    console.error('Error clearing artist genre cache:', err);
    return c.json({ error: 'Failed to clear cache' }, 500);
  }
});

// Admin: Cleanup old artist genre cache entries
api.post('/admin/cache/artist-genres/cleanup', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  try {
    const body = await c.req.json<{ maxAgeDays?: number }>();
    const maxAgeDays = body.maxAgeDays || 60;

    const { cleanupOldArtistGenreCache } = await import('../lib/artist-genre-cache');
    const deletedCount = await cleanupOldArtistGenreCache(c.env.SESSIONS, maxAgeDays);

    return c.json({
      success: true,
      deletedEntries: deletedCount,
      maxAgeDays,
      message: `Cleaned up ${deletedCount} cache entries older than ${maxAgeDays} days`,
    });
  } catch (err) {
    console.error('Error cleaning up cache:', err);
    return c.json({ error: 'Failed to cleanup cache' }, 500);
  }
});

// Admin: Invalidate specific artists from cache
api.post('/admin/cache/artist-genres/invalidate', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  try {
    const body = await c.req.json<{ artistIds: string[] }>();
    const { artistIds } = body;

    if (!Array.isArray(artistIds) || artistIds.length === 0) {
      return c.json({ error: 'artistIds array required' }, 400);
    }

    const { invalidateArtistGenreCache } = await import('../lib/artist-genre-cache');
    const deletedCount = await invalidateArtistGenreCache(c.env.SESSIONS, artistIds);

    return c.json({
      success: true,
      deletedEntries: deletedCount,
      message: `Invalidated ${deletedCount} artist cache entries`,
    });
  } catch (err) {
    console.error('Error invalidating cache:', err);
    return c.json({ error: 'Failed to invalidate cache' }, 500);
  }
});

// Request Access - for non-whitelisted users to request an invite
interface AccessRequestBody {
  email?: string;
  github?: string;
  message?: string;
}

interface AccessRequest {
  email: string;
  github: string | null;
  message: string | null;
  requestedAt: string;
  status: string;
  ip: string;
  userAgent: string;
}

api.post('/request-access', async (c) => {
  try {
    const body = await c.req.json<AccessRequestBody>();
    const { email, github, message } = body;

    if (!email || typeof email !== 'string') {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const kv = c.env.SESSIONS;
    const requestKey = `access_request_${email.toLowerCase()}`;

    // Check if already requested
    const existing = await kv.get(requestKey);
    if (existing) {
      return c.json({ message: 'Request already submitted', alreadyRequested: true });
    }

    // Store the request
    const request: AccessRequest = {
      email: email.toLowerCase(),
      github: github || null,
      message: message || null,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown',
    };

    // Store with 90-day TTL
    await kv.put(requestKey, JSON.stringify(request), { expirationTtl: 90 * 24 * 60 * 60 });

    // Also add to a list for easy admin review
    const listKey = 'access_requests_list';
    const existingList = await kv.get(listKey);
    const list: string[] = existingList ? JSON.parse(existingList) as string[] : [];
    if (!list.includes(email.toLowerCase())) {
      list.push(email.toLowerCase());
      await kv.put(listKey, JSON.stringify(list));
    }

    // Track analytics
    await trackAnalyticsEvent(kv, 'accessRequest', { email: email.toLowerCase() });

    return c.json({ success: true, message: 'Request submitted successfully' });
  } catch (err) {
    console.error('Request access error:', err);
    return c.json({ error: 'Failed to submit request' }, 500);
  }
});

// Admin: Get access requests
api.get('/admin/access-requests', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const kv = c.env.SESSIONS;
  const listKey = 'access_requests_list';
  const existingList = await kv.get(listKey);
  const emails: string[] = existingList ? JSON.parse(existingList) as string[] : [];

  // PERF-015 FIX: Use Promise.all for parallel reads instead of sequential loop
  const requestKeys = emails.map(email => `access_request_${email}`);
  const dataPromises = requestKeys.map(key => kv.get(key));
  const dataResults = await Promise.all(dataPromises);

  const requests: AccessRequest[] = [];
  for (const data of dataResults) {
    if (data) {
      try {
        requests.push(JSON.parse(data) as AccessRequest);
      } catch { /* skip malformed entries */ }
    }
  }

  // Sort by most recent first
  requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  return c.json({ requests, total: requests.length });
});

// ================== KV Monitoring Dashboard ==================

/**
 * GET /admin/kv-monitor
 * Comprehensive KV namespace monitoring - key counts, sizes, and metadata
 */
api.get('/admin/kv-monitor', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  try {
    const data = await getKVMonitorData(c.env.SESSIONS);
    return c.json(data);
  } catch (err) {
    console.error('Error getting KV monitor data:', err);
    return c.json({ error: 'Failed to fetch KV monitoring data' }, 500);
  }
});

/**
 * GET /admin/kv-keys
 * Browse keys in a specific namespace with pagination
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
api.get('/admin/kv-keys', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const prefix = c.req.query('prefix') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const cursor = c.req.query('cursor') || undefined;

  const kv = c.env.SESSIONS;

  try {
    const result = await kv.list({ prefix, limit, cursor });

    // Enrich keys with metadata
    const keys = result.keys.map(key => ({
      name: key.name,
      expiration: key.expiration,
      metadata: key.metadata,
      expiresAt: key.expiration ? new Date(key.expiration * 1000).toISOString() : null,
    }));

    return c.json({
      keys,
      cursor: result.list_complete ? null : (result as { cursor: string }).cursor,
      list_complete: result.list_complete,
      total: keys.length,
    });
  } catch (err) {
    // err is unknown type from catch
    console.error('Error listing keys:', err);
    return c.json({ error: 'Failed to list keys' }, 500);
  }
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment */

/**
 * GET /admin/kv-key/:key
 * Get details of a specific key including value (admin only)
 */
api.get('/admin/kv-key/:key', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const keyName = c.req.param('key');
  if (!keyName) return c.json({ error: 'Key name required' }, 400);

  const kv = c.env.SESSIONS;

  try {
    const value = await kv.get(keyName);
    if (value === null) {
      return c.json({ error: 'Key not found' }, 404);
    }

    // Try to parse as JSON for better display
    let parsedValue: unknown = value;
    let valueType = 'string';
    try {
      parsedValue = JSON.parse(value);
      valueType = 'json';
    } catch {
      // Keep as string
    }

    // Get metadata via list
    const list = await kv.list({ prefix: keyName, limit: 1 });
    const keyMeta = list.keys.find(k => k.name === keyName);

    return c.json({
      key: keyName,
      value: parsedValue,
      valueType,
      rawValue: value,
      size: value.length,
      metadata: keyMeta?.metadata,
      expiration: keyMeta?.expiration,
      expiresAt: keyMeta?.expiration ? new Date(keyMeta.expiration * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error('Error getting key:', err);
    return c.json({ error: 'Failed to get key value' }, 500);
  }
});

/**
 * DELETE /admin/kv-key/:key
 * Delete a specific key (admin only)
 */
api.delete('/admin/kv-key/:key', async (c) => {
  const session = await getSession(c);
  if (!await isAdmin(c, session)) return c.json({ error: 'Access denied' }, 403);

  const keyName = c.req.param('key');
  if (!keyName) return c.json({ error: 'Key name required' }, 400);

  const kv = c.env.SESSIONS;

  try {
    await kv.delete(keyName);
    return c.json({ success: true, key: keyName, deletedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Error deleting key:', err);
    return c.json({ error: 'Failed to delete key' }, 500);
  }
});

export default api;
