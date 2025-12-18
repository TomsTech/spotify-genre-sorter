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
  let offset = 0;
  const limit = 50;
  let totalInLibrary = 0;
  const trackLimit = maxTracks || MAX_TRACKS_FREE_TIER;
  let requestCount = 0;

  do {
    const response = await getLikedTracks(accessToken, limit, offset);
    allTracks.push(...response.items);
    totalInLibrary = response.total;
    offset += limit;
    requestCount++;
    onProgress?.(allTracks.length, totalInLibrary);

    // Stop if we've hit our limits to avoid subrequest errors
    if (requestCount >= MAX_TRACK_REQUESTS || allTracks.length >= trackLimit) {
      // Note: Truncation info is returned in the response for client-side display
      break;
    }
  } while (offset < totalInLibrary);

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
}

export async function getArtists(
  accessToken: string,
  artistIds: string[],
  maxRequests = MAX_ARTIST_REQUESTS
): Promise<ArtistsResult> {
  // Spotify API allows max 50 artists per request
  // We also limit total requests to stay within subrequest budget
  const maxArtists = maxRequests * 50;
  const truncated = artistIds.length > maxArtists;
  const idsToFetch = truncated ? artistIds.slice(0, maxArtists) : artistIds;

  const chunks: string[][] = [];
  for (let i = 0; i < idsToFetch.length; i += 50) {
    chunks.push(idsToFetch.slice(i, i + 50));
  }

  // OPTIMIZATION: Parallelize artist fetching to reduce total request time
  // Each request is independent, so we can fetch all chunks concurrently
  const chunkPromises = chunks.map(chunk =>
    spotifyFetch<{ artists: (SpotifyArtist | null)[] }>(
      `/artists?ids=${chunk.join(',')}`,
      accessToken
    )
  );

  const responses = await Promise.all(chunkPromises);

  const results: SpotifyArtist[] = [];
  for (const response of responses) {
    // Filter out null entries (some artists may not have data)
    const validArtists = response.artists.filter((a): a is SpotifyArtist => a !== null);
    results.push(...validArtists);
  }

  return {
    artists: results,
    totalArtists: artistIds.length,
    truncated,
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
  for (const { track, added_at } of likedTracks) {
    const genres = new Set<string>();
    for (const artist of track.artists) {
      const artistGenres = artistGenreMap.get(artist.id) || [];
      artistGenres.forEach(g => genres.add(g));
    }
    tracksWithGenres.set(track.id, { track, genres: [...genres], addedAt: added_at });
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
  // OPTIMIZATION: Parallelize playlist additions for faster bulk operations
  // Note: Keeping sequential for safety - Spotify recommends not parallelizing writes to same playlist
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ uris: chunk }),
    });
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
  owner: { id: string };
  tracks: { total: number };
}

export async function getUserPlaylists(
  accessToken: string
): Promise<SpotifyPlaylist[]> {
  const allPlaylists: SpotifyPlaylist[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore && offset < 200) {
    const response = await spotifyFetch<{
      items: SpotifyPlaylist[];
      total: number;
      next: string | null;
    }>(`/me/playlists?limit=${limit}&offset=${offset}`, accessToken);

    allPlaylists.push(...response.items);
    offset += limit;
    hasMore = !!response.next;
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
  const allTracks: PlaylistTrack[] = [];
  let offset = 0;
  const pageLimit = 50;
  let hasMore = true;

  while (hasMore && allTracks.length < limit) {
    const response = await spotifyFetch<{
      items: PlaylistTrack[];
      total: number;
      next: string | null;
    }>(`/playlists/${playlistId}/tracks?limit=${pageLimit}&offset=${offset}`, accessToken);

    allTracks.push(...response.items);
    offset += pageLimit;
    hasMore = !!response.next && allTracks.length < limit;
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
