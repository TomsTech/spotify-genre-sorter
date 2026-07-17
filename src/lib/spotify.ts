export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export interface LikedTrack {
  track: SpotifyTrack;
  added_at: string;
}

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH = 'https://accounts.spotify.com';

// PKCE (Proof Key for Code Exchange) helpers for enhanced OAuth security
// Generates a cryptographically random code verifier
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Creates SHA256 hash of verifier for code_challenge
export async function createCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

// Base64 URL encoding (no padding, URL-safe characters)
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// High availability: retry with exponential backoff
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on rate limiting (429) or server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);

        if (attempt < retries - 1) {
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export function getSpotifyAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge?: string
): string {
  const scopes = [
    'user-library-read',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
    'user-read-currently-playing',
    'user-read-playback-state',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  // Add PKCE parameters if code_challenge provided
  if (codeChallenge) {
    params.set('code_challenge_method', 'S256');
    params.set('code_challenge', codeChallenge);
  }

  return `${SPOTIFY_AUTH}/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  // Add PKCE code_verifier if provided
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetchWithRetry(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Spotify token exchange failed: ${error}`);
  }

  const data: SpotifyTokens = await response.json();
  return data;
}

export async function refreshSpotifyToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyTokens> {
  const response = await fetchWithRetry(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Spotify token');
  }

  const data: SpotifyTokens = await response.json();
  // Spotify may not return a new refresh token
  return {
    ...data,
    refresh_token: data.refresh_token || refreshToken,
  };
}

async function spotifyFetch<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithRetry(`${SPOTIFY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Spotify API error: ${response.status} ${error}`);
  }

  const data: T = await response.json();
  return data;
}

export async function getLikedTracks(
  accessToken: string,
  limit = 50,
  offset = 0
): Promise<{ items: LikedTrack[]; total: number; next: string | null }> {
  return spotifyFetch(
    `/me/tracks?limit=${limit}&offset=${offset}`,
    accessToken
  );
}

// Cloudflare Workers free plan has 50 subrequest limit
// We need to budget for BOTH track fetching AND artist fetching
// - Track fetching: 50 tracks per request
// - Artist fetching: 50 artists per request (usually ~60% unique artists per track)
// Budget: ~20 track requests + ~25 artist requests = 45 (leaving 5 buffer for overhead)
const MAX_TRACK_REQUESTS = 20; // 20 * 50 = 1000 tracks
const MAX_ARTIST_REQUESTS = 25; // 25 * 50 = 1250 unique artists
const MAX_TRACKS_FREE_TIER = MAX_TRACK_REQUESTS * 50; // 1000 tracks

export interface LikedTracksResult {
  tracks: LikedTrack[];
  totalInLibrary: number;
  truncated: boolean;
}

export async function getAllLikedTracks(
  accessToken: string,
  onProgress?: (loaded: number, total: number) => void,
  maxTracks?: number
): Promise<LikedTracksResult> {
  const allTracks: LikedTrack[] = [];
  const limit = 50;
  const trackLimit = maxTracks || MAX_TRACKS_FREE_TIER;

  // PERF-FIX: Fetch first page to get total item count, then fetch remaining in parallel
  const initialResponse = await getLikedTracks(accessToken, limit, 0);
  allTracks.push(...initialResponse.items);
  const totalInLibrary = initialResponse.total;
  onProgress?.(allTracks.length, totalInLibrary);

  if (limit < totalInLibrary && allTracks.length < trackLimit && 1 < MAX_TRACK_REQUESTS) {
    const remainingOffsets: number[] = [];
    let offset = limit;
    let requestCount = 1;

    while (offset < totalInLibrary && requestCount < MAX_TRACK_REQUESTS && offset < trackLimit) {
      remainingOffsets.push(offset);
      offset += limit;
      requestCount++;
    }

    // Fetch all remaining pages concurrently while preserving order and progress updates
    let loadedCount = allTracks.length;
    const responses = await Promise.all(
      remainingOffsets.map(async (off) => {
        const response = await getLikedTracks(accessToken, limit, off);
        loadedCount += response.items.length;
        onProgress?.(loadedCount, totalInLibrary);
        return response;
      })
    );

    for (const response of responses) {
      allTracks.push(...response.items);
    }
  }

  return {
    tracks: allTracks,
    totalInLibrary,
    truncated: allTracks.length < totalInLibrary,
  };
}

export interface ArtistsResult {
  artists: SpotifyArtist[];
  totalArtists: number;
  truncated: boolean;
  cacheHits?: number;
  cacheMisses?: number;
}

export async function getArtists(
  accessToken: string,
  artistIds: string[],
  maxRequests = MAX_ARTIST_REQUESTS,
  kv?: KVNamespace
): Promise<ArtistsResult> {
  // Spotify API allows max 50 artists per request
  // We also limit total requests to stay within subrequest budget
  const maxArtists = maxRequests * 50;
  const truncated = artistIds.length > maxArtists;
  const idsToFetch = truncated ? artistIds.slice(0, maxArtists) : artistIds;

  let cacheHits = 0;
  let cacheMisses = 0;
  const results: SpotifyArtist[] = [];

  // If KV is provided, try to use cache (#74 - Persistent Genre Cache)
  if (kv) {
    const {
      getCachedArtistGenresBatch,
      cacheArtistGenresBatch,
      updateArtistGenreCacheStats,
    } = await import('./artist-genre-cache');

    // Check cache for all artists
    const cachedGenres = await getCachedArtistGenresBatch(kv, idsToFetch);
    cacheHits = cachedGenres.size;
    cacheMisses = idsToFetch.length - cacheHits;

    // Build results from cache
    for (const [artistId, genres] of cachedGenres.entries()) {
      results.push({
        id: artistId,
        name: '', // Name not cached (not needed for genre sorting)
        genres,
      });
    }

    // Determine which artists need to be fetched from Spotify
    const uncachedIds = idsToFetch.filter((id) => !cachedGenres.has(id));

    if (uncachedIds.length > 0) {
      // Fetch uncached artists from Spotify API
      const chunks: string[][] = [];
      for (let i = 0; i < uncachedIds.length; i += 50) {
        chunks.push(uncachedIds.slice(i, i + 50));
      }

      // OPTIMIZATION: Parallelize artist fetching to reduce total request time
      const chunkPromises = chunks.map((chunk) =>
        spotifyFetch<{ artists: (SpotifyArtist | null)[] }>(
          `/artists?ids=${chunk.join(',')}`,
          accessToken
        )
      );

      const responses = await Promise.all(chunkPromises);

      // Build map of newly fetched artist genres for caching
      const newArtistGenres = new Map<string, string[]>();

      for (const response of responses) {
        // Filter out null entries (some artists may not have data)
        const validArtists = response.artists.filter((a): a is SpotifyArtist => a !== null);
        results.push(...validArtists);

        // Store for caching
        for (const artist of validArtists) {
          newArtistGenres.set(artist.id, artist.genres);
        }
      }

      // Cache newly fetched artist genres (fire and forget)
      cacheArtistGenresBatch(kv, newArtistGenres).catch((err) =>
        console.error('Failed to cache artist genres:', err)
      );
    }

    // Update cache statistics (fire and forget)
    updateArtistGenreCacheStats(kv, { cacheHits, cacheMisses }).catch((err) =>
      console.error('Failed to update cache stats:', err)
    );
  } else {
    // No KV provided, fetch all from Spotify (original behavior)
    const chunks: string[][] = [];
    for (let i = 0; i < idsToFetch.length; i += 50) {
      chunks.push(idsToFetch.slice(i, i + 50));
    }

    // OPTIMIZATION: Parallelize artist fetching to reduce total request time
    // Each request is independent, so we can fetch all chunks concurrently
    const chunkPromises = chunks.map((chunk) =>
      spotifyFetch<{ artists: (SpotifyArtist | null)[] }>(
        `/artists?ids=${chunk.join(',')}`,
        accessToken
      )
    );

    const responses = await Promise.all(chunkPromises);

    for (const response of responses) {
      // Filter out null entries (some artists may not have data)
      const validArtists = response.artists.filter((a): a is SpotifyArtist => a !== null);
      results.push(...validArtists);
    }
  }

  return {
    artists: results,
    totalArtists: artistIds.length,
    truncated,
    cacheHits: kv ? cacheHits : undefined,
    cacheMisses: kv ? cacheMisses : undefined,
  };
}

export async function getTracksWithGenres(
  accessToken: string
): Promise<Map<string, { track: SpotifyTrack; genres: string[]; addedAt: string }>> {
  const { tracks: likedTracks } = await getAllLikedTracks(accessToken);

  // Collect unique artist IDs
  const artistIds = new Set<string>();
  for (const { track } of likedTracks) {
    for (const artist of track.artists) {
      artistIds.add(artist.id);
    }
  }

  // Fetch all artists to get genres (limited to prevent subrequest overflow)
  const { artists } = await getArtists(accessToken, [...artistIds]);
  const artistGenreMap = new Map<string, string[]>();
  for (const artist of artists) {
    artistGenreMap.set(artist.id, artist.genres);
  }

  // Map tracks to their genres
  const tracksWithGenres = new Map<string, { track: SpotifyTrack; genres: string[]; addedAt: string }>();

  // PERF-031 FIX: Eliminate redundant GC overhead
  // Instantiating a new Set for every track causes massive garbage collection overhead.
  // Using a single reusable Set instead maintains O(N) deduplication without memory penalty.
  const reusableGenresSet = new Set<string>();

  for (const { track, added_at } of likedTracks) {
    reusableGenresSet.clear();
    for (const artist of track.artists) {
      const artistGenres = artistGenreMap.get(artist.id) || [];
      // Replace forEach with a simple for loop for slightly better performance
      for (let i = 0; i < artistGenres.length; i++) {
        reusableGenresSet.add(artistGenres[i]);
      }
    }
    tracksWithGenres.set(track.id, { track, genres: [...reusableGenresSet], addedAt: added_at });
  }

  return tracksWithGenres;
}

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic = false
): Promise<{ id: string; external_urls: { spotify: string } }> {
  return spotifyFetch(`/users/${userId}/playlists`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  // Spotify allows max 100 tracks per request
  // PERF-001 FIX: Parallelize playlist additions for faster bulk operations
  // Note: Using a controlled concurrency limit of 3 to balance speed and safety.
  const CONCURRENCY_LIMIT = 3;
  for (let i = 0; i < trackUris.length; i += 100 * CONCURRENCY_LIMIT) {
    const batchPromises = [];
    for (let j = 0; j < CONCURRENCY_LIMIT && (i + j * 100) < trackUris.length; j++) {
      const chunkStart = i + j * 100;
      const chunk = trackUris.slice(chunkStart, chunkStart + 100);
      batchPromises.push(
        (async () => {
          try {
            await spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
              method: 'POST',
              body: JSON.stringify({ uris: chunk }),
            });
          } catch (error) {
            console.error(`Failed to add tracks chunk starting at index ${chunkStart}:`, error);
          }
        })()
      );
    }
    await Promise.all(batchPromises);
  }
}

export async function getCurrentUser(
  accessToken: string
): Promise<{ id: string; display_name: string; images: { url: string }[] }> {
  return spotifyFetch('/me', accessToken);
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  owner: { id: string; display_name?: string };
  tracks: { total: number };
  images?: Array<{ url: string; width: number; height: number }>;
}

export async function getUserPlaylists(
  accessToken: string
): Promise<SpotifyPlaylist[]> {
  const limit = 50;
  const maxPlaylists = 200;

  // Fetch first page
  const initial = await spotifyFetch<{
    items: SpotifyPlaylist[];
    total: number;
    next: string | null;
  }>(`/me/playlists?limit=${limit}&offset=0`, accessToken);

  const allPlaylists = [...initial.items];

  if (initial.next && allPlaylists.length < maxPlaylists) {
    const remainingOffsets: number[] = [];
    for (let offset = limit; offset < initial.total && offset < maxPlaylists; offset += limit) {
      remainingOffsets.push(offset);
    }

    if (remainingOffsets.length > 0) {
      const responses = await Promise.all(
        remainingOffsets.map(off =>
          spotifyFetch<{ items: SpotifyPlaylist[] }>(
            `/me/playlists?limit=${limit}&offset=${off}`,
            accessToken
          )
        )
      );
      for (const res of responses) {
        allPlaylists.push(...res.items);
      }
    }
  }

  return allPlaylists;
}

export interface PlaylistTrack {
  track: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
  } | null;
  added_at: string;
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
  limit = 100
): Promise<PlaylistTrack[]> {
  const pageLimit = 50;

  // Fetch first page to determine total tracks
  const initial = await spotifyFetch<{
    items: PlaylistTrack[];
    total: number;
    next: string | null;
  }>(`/playlists/${playlistId}/tracks?limit=${pageLimit}&offset=0`, accessToken);

  const allTracks = [...initial.items];

  if (initial.next && allTracks.length < limit) {
    const remainingOffsets: number[] = [];
    for (let offset = pageLimit; offset < initial.total && offset < limit; offset += pageLimit) {
      remainingOffsets.push(offset);
    }

    // Fetch remaining pages concurrently
    if (remainingOffsets.length > 0) {
      const responses = await Promise.all(
        remainingOffsets.map(off =>
          spotifyFetch<{ items: PlaylistTrack[] }>(
            `/playlists/${playlistId}/tracks?limit=${pageLimit}&offset=${off}`,
            accessToken
          )
        )
      );
      for (const res of responses) {
        allTracks.push(...res.items);
      }
    }
  }

  return allTracks.slice(0, limit);
}

export interface CurrentPlayback {
  is_playing: boolean;
  item: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: {
      name: string;
      images: { url: string; width: number; height: number }[];
    };
    duration_ms: number;
    external_urls: { spotify: string };
  } | null;
  progress_ms: number | null;
  device: {
    name: string;
    type: string;
  } | null;
}

export async function getCurrentPlayback(
  accessToken: string
): Promise<CurrentPlayback | null> {
  try {
    const response = await fetchWithRetry(`${SPOTIFY_API}/me/player`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // 204 means no active device/playback
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data: CurrentPlayback = await response.json();
    return data;
  } catch {
    return null;
  }
}
