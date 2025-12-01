import { Hono } from 'hono';
import { getSession, updateSession } from '../lib/session';
import {
  refreshSpotifyToken,
  getAllLikedTracks,
  getArtists,
  createPlaylist,
  addTracksToPlaylist,
  getCurrentUser,
} from '../lib/spotify';

const api = new Hono<{ Bindings: Env }>();

// Cache constants
const GENRE_CACHE_TTL = 3600; // 1 hour in seconds
const GENRE_CACHE_PREFIX = 'genre_cache_';

interface GenreCacheData {
  genres: { name: string; count: number; trackIds: string[] }[];
  totalTracks: number;
  totalGenres: number;
  totalArtists: number;
  cachedAt: number;
}

// Helper to invalidate genre cache for a user
async function invalidateGenreCache(kv: KVNamespace, spotifyUserId: string): Promise<void> {
  const cacheKey = `${GENRE_CACHE_PREFIX}${spotifyUserId}`;
  await kv.delete(cacheKey);
  console.log(`Invalidated genre cache for user ${spotifyUserId}`);
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

// Auth middleware - check auth and refresh tokens if needed
api.use('/*', async (c, next) => {
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
        console.log(`Cache hit for user ${user.id}`);
        return c.json({
          ...cachedData,
          fromCache: true,
        });
      }
    }

    console.log(`Cache miss for user ${user.id}, fetching fresh data...`);

    // Step 1: Get all liked tracks
    let likedTracks;
    try {
      likedTracks = await getAllLikedTracks(session.spotifyAccessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching liked tracks:', message);
      return c.json({
        error: 'Failed to fetch liked tracks from Spotify',
        details: message,
        step: 'fetching_tracks'
      }, 500);
    }

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

    // Build response data
    const responseData: GenreCacheData = {
      totalTracks: likedTracks.length,
      totalGenres: genres.length,
      totalArtists: artistIds.size,
      genres,
      cachedAt: Date.now(),
    };

    // Store in cache
    await c.env.SESSIONS.put(cacheKey, JSON.stringify(responseData), {
      expirationTtl: GENRE_CACHE_TTL,
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

// Helper to validate track IDs
function validateTrackIds(trackIds: unknown): { valid: boolean; error?: string; ids?: string[] } {
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

  return { valid: true, ids: validIds };
}

// Helper to sanitise genre name
function sanitiseGenreName(genre: unknown): { valid: boolean; error?: string; name?: string } {
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
  return { valid: true, name: sanitised };
}

// Create a playlist for a specific genre
api.post('/playlist', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json<{ genre: string; trackIds: string[] }>();
    const { genre, trackIds } = body;

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

    const user = await getCurrentUser(session.spotifyAccessToken);
    const safeName = genreValidation.name!;
    const safeTrackIds = trackValidation.ids!;

    const playlist = await createPlaylist(
      session.spotifyAccessToken,
      user.id,
      `${safeName} (from Likes)`,
      `Auto-generated playlist of ${safeName} tracks from your liked songs`,
      false
    );

    const trackUris = safeTrackIds.map(id => `spotify:track:${id}`);
    await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

    // Invalidate cache since library has changed
    await invalidateGenreCache(c.env.SESSIONS, user.id);

    return c.json({
      success: true,
      playlist: {
        id: playlist.id,
        url: playlist.external_urls.spotify,
        name: `${safeName} (from Likes)`,
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
    const body = await c.req.json<{ genres: { name: string; trackIds: string[] }[] }>();
    const { genres } = body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return c.json({ error: 'Genres array required' }, 400);
    }

    if (genres.length > MAX_GENRES_BULK) {
      return c.json({ error: `Maximum ${MAX_GENRES_BULK} genres allowed per request` }, 400);
    }

    const user = await getCurrentUser(session.spotifyAccessToken);
    const results: { genre: string; success: boolean; url?: string; error?: string }[] = [];

    for (const { name, trackIds } of genres) {
      // Validate each genre
      const genreValidation = sanitiseGenreName(name);
      if (!genreValidation.valid) {
        results.push({ genre: String(name), success: false, error: genreValidation.error });
        continue;
      }

      const trackValidation = validateTrackIds(trackIds);
      if (!trackValidation.valid) {
        results.push({ genre: genreValidation.name!, success: false, error: trackValidation.error });
        continue;
      }

      try {
        const safeName = genreValidation.name!;
        const safeTrackIds = trackValidation.ids!;

        const playlist = await createPlaylist(
          session.spotifyAccessToken,
          user.id,
          `${safeName} (from Likes)`,
          `Auto-generated playlist of ${safeName} tracks from your liked songs`,
          false
        );

        const trackUris = safeTrackIds.map(id => `spotify:track:${id}`);
        await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

        results.push({
          genre: safeName,
          success: true,
          url: playlist.external_urls.spotify,
        });
      } catch {
        // Don't expose internal error details
        results.push({
          genre: genreValidation.name!,
          success: false,
          error: 'Failed to create playlist',
        });
      }
    }

    // Invalidate cache if any playlists were created
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      await invalidateGenreCache(c.env.SESSIONS, user.id);
    }

    return c.json({
      total: genres.length,
      successful: successCount,
      results,
    });
  } catch (err) {
    console.error('Error creating playlists:', err);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

export default api;
