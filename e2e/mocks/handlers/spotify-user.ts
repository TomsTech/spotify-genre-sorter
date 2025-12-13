/**
 * Spotify User API Handlers
 *
 * Mock handlers for /me and /me/tracks endpoints.
 */
import { http, HttpResponse } from 'msw';
import testUsers from '../../fixtures/test-data/users.json' with { type: 'json' };
import testTracks from '../../fixtures/test-data/tracks.json' with { type: 'json' };

// Configuration state
let currentUser: keyof typeof testUsers = 'default';
let emptyLibraryMode = false;
let largeLibraryMode = false;
let rateLimitAfter = Infinity;
let requestCount = 0;

export function setCurrentUser(user: keyof typeof testUsers): void {
  currentUser = user;
}

export function setEmptyLibraryMode(empty: boolean): void {
  emptyLibraryMode = empty;
}

export function setLargeLibraryMode(large: boolean): void {
  largeLibraryMode = large;
}

export function setRateLimitAfter(count: number): void {
  rateLimitAfter = count;
}

export function resetUserState(): void {
  currentUser = 'default';
  emptyLibraryMode = false;
  largeLibraryMode = false;
  rateLimitAfter = Infinity;
  requestCount = 0;
  clearNowPlaying();
}

export function getRequestCount(): number {
  return requestCount;
}

// Generate large library tracks (for testing progressive scan)
function generateLargeTracks(count: number): typeof testTracks {
  const tracks: typeof testTracks = [];
  const baseTrack = testTracks[0];

  for (let i = 0; i < count; i++) {
    tracks.push({
      ...baseTrack,
      id: `generated-track-${i}`,
      name: `Generated Track ${i}`,
    });
  }

  return tracks;
}

// Default "now playing" state
let nowPlayingTrack: {
  isPlaying: boolean;
  track: typeof testTracks[0] | null;
  progressMs: number;
  device: string;
} = {
  isPlaying: false,
  track: null,
  progressMs: 0,
  device: 'Test Device',
};

export function setNowPlaying(track: typeof testTracks[0] | null, isPlaying = true): void {
  nowPlayingTrack = {
    isPlaying,
    track,
    progressMs: Math.floor(Math.random() * (track?.duration_ms || 180000)),
    device: 'Test Device',
  };
}

export function clearNowPlaying(): void {
  nowPlayingTrack = { isPlaying: false, track: null, progressMs: 0, device: 'Test Device' };
}

export const spotifyUserHandlers = [
  // GET /me - Current user profile
  http.get('https://api.spotify.com/v1/me', ({ request }) => {
    requestCount++;

    if (requestCount > rateLimitAfter) {
      return HttpResponse.json(
        { error: { status: 429, message: 'Rate limit exceeded' } },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const token = auth.replace('Bearer ', '');
    if (token === 'invalid-token' || token === 'expired-token') {
      return HttpResponse.json(
        { error: { status: 401, message: 'The access token expired' } },
        { status: 401 }
      );
    }

    return HttpResponse.json(testUsers[currentUser]);
  }),

  // GET /me/tracks - User's liked tracks with pagination
  http.get('https://api.spotify.com/v1/me/tracks', ({ request }) => {
    requestCount++;

    if (requestCount > rateLimitAfter) {
      return HttpResponse.json(
        { error: { status: 429, message: 'Rate limit exceeded' } },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    if (emptyLibraryMode) {
      return HttpResponse.json({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
        next: null,
        previous: null,
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Use generated tracks for large library mode
    const allTracks = largeLibraryMode ? generateLargeTracks(2500) : testTracks;
    const total = allTracks.length;

    const items = allTracks.slice(offset, offset + limit).map((track) => ({
      added_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      track,
    }));

    const hasNext = offset + limit < total;
    const hasPrev = offset > 0;

    return HttpResponse.json({
      items,
      total,
      limit,
      offset,
      next: hasNext
        ? `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset + limit}`
        : null,
      previous: hasPrev
        ? `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${Math.max(0, offset - limit)}`
        : null,
    });
  }),

  // GET /me/playlists - User's playlists
  http.get('https://api.spotify.com/v1/me/playlists', ({ request }) => {
    requestCount++;

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Return empty playlists for simplicity
    return HttpResponse.json({
      items: [],
      total: 0,
      limit,
      offset,
      next: null,
      previous: null,
    });
  }),

  // GET /me/player - Current playback state (Now Playing)
  http.get('https://api.spotify.com/v1/me/player', ({ request }) => {
    requestCount++;

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    // Return 204 No Content if nothing is playing
    if (!nowPlayingTrack.track) {
      return new HttpResponse(null, { status: 204 });
    }

    return HttpResponse.json({
      is_playing: nowPlayingTrack.isPlaying,
      progress_ms: nowPlayingTrack.progressMs,
      item: {
        id: nowPlayingTrack.track.id,
        name: nowPlayingTrack.track.name,
        artists: nowPlayingTrack.track.artists,
        album: nowPlayingTrack.track.album,
        duration_ms: nowPlayingTrack.track.duration_ms,
        external_urls: nowPlayingTrack.track.external_urls,
      },
      device: {
        id: 'test-device-id',
        is_active: true,
        name: nowPlayingTrack.device,
        type: 'Computer',
        volume_percent: 75,
      },
      shuffle_state: false,
      repeat_state: 'off',
      context: null,
    });
  }),
];
