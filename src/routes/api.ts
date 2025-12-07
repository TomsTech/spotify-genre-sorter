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
  type RecentPlaylist,
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
} from '../lib/spotify';

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

// Simple in-memory rate limiter (resets on worker restart, but good enough for abuse prevention)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Rate limiting middleware
api.use('/*', async (c, next) => {
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

  // Clean up old entries periodically (every 100 requests)
  if (Math.random() < 0.01) {
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now > data.resetAt + RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(ip);
      }
    }
  }

  await next();
});

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = ['/scoreboard', '/leaderboard', '/recent-playlists', '/deploy-status', '/changelog', '/analytics', '/kv-usage'];

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

    // Step 3: Fetch all artists to get genres
    let artists;
    try {
      artists = await getArtists(session.spotifyAccessToken, [...artistIds]);
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
    await c.env.SESSIONS.put(cacheKey, JSON.stringify(responseData), {
      expirationTtl: cacheTtl,
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

    // Fetch tracks for this chunk
    const allChunkTracks = [];
    let currentOffset = offset;
    let totalInLibrary = 0;
    let requestCount = 0;

    while (currentOffset < offset + limit && requestCount < MAX_TRACK_REQUESTS_PER_CHUNK) {
      const pageLimit = Math.min(50, offset + limit - currentOffset);
      const response = await getLikedTracks(session.spotifyAccessToken, pageLimit, currentOffset);
      allChunkTracks.push(...response.items);
      totalInLibrary = response.total;
      currentOffset += pageLimit;
      requestCount++;

      // Stop if we've reached the end of the library
      if (currentOffset >= response.total) break;
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
    const artistIdArray = [...artistIds].slice(0, MAX_ARTIST_REQUESTS_PER_CHUNK * 50);
    const artists = await getArtists(session.spotifyAccessToken, artistIdArray);

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
    await c.env.SESSIONS.put(chunkCacheKey, JSON.stringify(chunkData), {
      expirationTtl: GENRE_CACHE_TTL,
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

// Helper to sanitise genre name
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
  // Remove any potentially dangerous characters (keep alphanumeric, spaces, hyphens, common chars)
  const sanitised = trimmed.replace(/[<>"'&]/g, '');
  return { valid: true, value: sanitised };
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

// Changelog endpoint for deploy widget timeline
api.get('/changelog', (c) => {
  // Static changelog data - updated during releases
  const changelog = [
    {
      version: '2.2.0',
      date: '2025-12-07',
      changes: [
        'Track total songs added to playlists in scoreboard',
        'New "Sorted" tab shows users ranked by tracks sorted',
        'User stats now track cumulative tracks in created playlists',
      ],
    },
    {
      version: '1.3.0',
      date: '2025-12-01',
      changes: [
        'PDF documentation generation',
        'SEO playlist descriptions',
        'Enhanced health endpoint',
        'All backlog tasks complete',
      ],
    },
    {
      version: '1.2.1',
      date: '2025-11-29',
      changes: [
        'Fix track limit for subrequest errors',
        'Show truncation warning in UI',
      ],
    },
    {
      version: '1.2.0',
      date: '2025-11-28',
      changes: [
        'Dark/light theme toggle',
        'Hidden genres management',
        'Genre statistics dashboard',
        'Export to JSON/CSV',
      ],
    },
    {
      version: '1.1.0',
      date: '2025-11-27',
      changes: [
        'Security headers (CSP, HSTS)',
        'Retry logic with exponential backoff',
        'Australian English spelling',
      ],
    },
    {
      version: '1.0.0',
      date: '2025-11-26',
      changes: [
        'Initial release',
        'Hall of Fame',
        'Swedish Easter eggs',
        'Spotify-only auth mode',
      ],
    },
  ];

  return c.json({
    changelog: changelog.slice(0, 10),
    repoUrl: 'https://github.com/TomsTech/spotify-genre-sorter',
  });
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
    });
  } catch (err) {
    console.error('Error fetching KV usage:', err);
    return c.json({ error: 'Failed to fetch KV usage' }, 500);
  }
});

export default api;
