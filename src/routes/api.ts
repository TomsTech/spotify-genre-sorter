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

// Middleware to check auth and refresh tokens if needed
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

// Get all genres from liked tracks
api.get('/genres', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    // Get all liked tracks
    const likedTracks = await getAllLikedTracks(session.spotifyAccessToken);

    // Collect unique artist IDs
    const artistIds = new Set<string>();
    for (const { track } of likedTracks) {
      for (const artist of track.artists) {
        artistIds.add(artist.id);
      }
    }

    // Fetch all artists to get genres
    const artists = await getArtists(session.spotifyAccessToken, [...artistIds]);
    const artistGenreMap = new Map<string, string[]>();
    for (const artist of artists) {
      artistGenreMap.set(artist.id, artist.genres);
    }

    // Count tracks per genre and collect track IDs
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

    return c.json({
      totalTracks: likedTracks.length,
      totalGenres: genres.length,
      genres,
    });
  } catch (err) {
    console.error('Error fetching genres:', err);
    return c.json({ error: 'Failed to fetch genres' }, 500);
  }
});

// Create a playlist for a specific genre
api.post('/playlist', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json<{ genre: string; trackIds: string[] }>();
    const { genre, trackIds } = body;

    if (!genre || !trackIds?.length) {
      return c.json({ error: 'Genre and trackIds required' }, 400);
    }

    const user = await getCurrentUser(session.spotifyAccessToken);

    const playlist = await createPlaylist(
      session.spotifyAccessToken,
      user.id,
      `${genre} (from Likes)`,
      `Auto-generated playlist of ${genre} tracks from your liked songs`,
      false
    );

    const trackUris = trackIds.map(id => `spotify:track:${id}`);
    await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

    return c.json({
      success: true,
      playlist: {
        id: playlist.id,
        url: playlist.external_urls.spotify,
        name: `${genre} (from Likes)`,
        trackCount: trackIds.length,
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

    if (!genres?.length) {
      return c.json({ error: 'Genres array required' }, 400);
    }

    const user = await getCurrentUser(session.spotifyAccessToken);
    const results: { genre: string; success: boolean; url?: string; error?: string }[] = [];

    for (const { name, trackIds } of genres) {
      try {
        const playlist = await createPlaylist(
          session.spotifyAccessToken,
          user.id,
          `${name} (from Likes)`,
          `Auto-generated playlist of ${name} tracks from your liked songs`,
          false
        );

        const trackUris = trackIds.map(id => `spotify:track:${id}`);
        await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

        results.push({
          genre: name,
          success: true,
          url: playlist.external_urls.spotify,
        });
      } catch (err) {
        results.push({
          genre: name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return c.json({
      total: genres.length,
      successful: results.filter(r => r.success).length,
      results,
    });
  } catch (err) {
    console.error('Error creating playlists:', err);
    return c.json({ error: 'Failed to create playlists' }, 500);
  }
});

export default api;
