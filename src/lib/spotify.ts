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

export function getSpotifyAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    'user-library-read',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  return `${SPOTIFY_AUTH}/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const response = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
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
  const response = await fetch(`${SPOTIFY_AUTH}/api/token`, {
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
  const response = await fetch(`${SPOTIFY_API}${endpoint}`, {
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

export async function getAllLikedTracks(
  accessToken: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<LikedTrack[]> {
  const allTracks: LikedTrack[] = [];
  let offset = 0;
  const limit = 50;
  let total = 0;

  do {
    const response = await getLikedTracks(accessToken, limit, offset);
    allTracks.push(...response.items);
    total = response.total;
    offset += limit;
    onProgress?.(allTracks.length, total);
  } while (offset < total);

  return allTracks;
}

export async function getArtists(
  accessToken: string,
  artistIds: string[]
): Promise<SpotifyArtist[]> {
  // Spotify API allows max 50 artists per request
  const chunks: string[][] = [];
  for (let i = 0; i < artistIds.length; i += 50) {
    chunks.push(artistIds.slice(i, i + 50));
  }

  const results: SpotifyArtist[] = [];
  for (const chunk of chunks) {
    const response = await spotifyFetch<{ artists: SpotifyArtist[] }>(
      `/artists?ids=${chunk.join(',')}`,
      accessToken
    );
    results.push(...response.artists);
  }

  return results;
}

export async function getTracksWithGenres(
  accessToken: string
): Promise<Map<string, { track: SpotifyTrack; genres: string[]; addedAt: string }>> {
  const likedTracks = await getAllLikedTracks(accessToken);

  // Collect unique artist IDs
  const artistIds = new Set<string>();
  for (const { track } of likedTracks) {
    for (const artist of track.artists) {
      artistIds.add(artist.id);
    }
  }

  // Fetch all artists to get genres
  const artists = await getArtists(accessToken, [...artistIds]);
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
