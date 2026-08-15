import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSpotifyAuthUrl, refreshSpotifyToken, generateCodeVerifier, getPlaylistTracks } from '../src/lib/spotify';


describe('Spotify Library', () => {

describe('generateCodeVerifier', () => {
  it('should generate a string of length 43', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it('should generate a URL-safe base64 string', () => {
    const verifier = generateCodeVerifier();
    // URL-safe base64 characters: A-Z, a-z, 0-9, -, _
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should be cryptographically random (different each time)', () => {
    const verifier1 = generateCodeVerifier();
    const verifier2 = generateCodeVerifier();
    expect(verifier1).not.toBe(verifier2);
  });
});


describe('getPlaylistTracks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch a single page of tracks when total is less than limit', async () => {
    const mockItems = [{ track: { id: '1', name: 'Track 1' } }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: mockItems,
        total: 1,
        next: null
      }),
      headers: new Headers()
    });

    const tracks = await getPlaylistTracks('fake-token', 'playlist-id', 100);
    expect(tracks).toEqual(mockItems);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/playlists/playlist-id/tracks?limit=50&offset=0'),
      expect.any(Object)
    );
  });

  it('should fetch multiple pages concurrently when total exceeds limit', async () => {
    const mockItems1 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `\${i}` } }));
    const mockItems2 = Array.from({ length: 25 }, (_, i) => ({ track: { id: `\${i + 50}` } }));

    // First call returns next URL, subsequent call returns null
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: mockItems1,
            total: 75,
            next: 'https://api.spotify.com/v1/playlists/playlist-id/tracks?offset=50&limit=50'
          }),
          headers: new Headers()
        });
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: mockItems2,
            total: 75,
            next: null
          }),
          headers: new Headers()
        });
      }
    });

    const tracks = await getPlaylistTracks('fake-token', 'playlist-id', 100);
    expect(tracks.length).toBe(75);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });


  it('should throw an error if the fetch to Spotify API fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

    await expect(getPlaylistTracks('fake-token', 'playlist-id', 100)).rejects.toThrow('Network Error');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should respect the overall limit argument', async () => {
    const mockItems1 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `\${i}` } }));
    const mockItems2 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `\${i + 50}` } }));

    // Total is 150, but we limit to 60.
    // First fetch: 50 items.
    // remainingOffsets will check offset < limit, so offset=50 will be pushed.
    // offset=100 won't be pushed.
    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('offset=0')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: mockItems1,
            total: 150,
            next: 'https://api.spotify.com/v1/playlists/playlist-id/tracks?offset=50&limit=50'
          }),
          headers: new Headers()
        });
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: mockItems2,
            total: 150,
            next: 'https://api.spotify.com/v1/playlists/playlist-id/tracks?offset=100&limit=50'
          }),
          headers: new Headers()
        });
      }
    });

    const tracks = await getPlaylistTracks('fake-token', 'playlist-id', 60);
    // Limit is 60. offset=0 and offset=50 are fetched.
    expect(tracks.length).toBe(60);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

  describe('getSpotifyAuthUrl', () => {
    it('should generate a valid Spotify auth URL', () => {
      const url = getSpotifyAuthUrl(
        'test-client-id',
        'https://example.com/callback',
        'test-state-123'
      );

      expect(url).toContain('https://accounts.spotify.com/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('state=test-state-123');
    });

    it('should include required scopes', () => {
      const url = getSpotifyAuthUrl('client', 'redirect', 'state');

      expect(url).toContain('user-library-read');
      expect(url).toContain('playlist-modify-public');
      expect(url).toContain('playlist-modify-private');
    });
  });
});

describe('Genre Extraction Logic', () => {
  it('should extract unique genres from artist data', () => {
    const artistGenreMap = new Map<string, string[]>([
      ['artist1', ['rock', 'alternative rock']],
      ['artist2', ['pop', 'dance pop']],
      ['artist3', ['rock', 'indie rock']],
    ]);

    const allGenres = new Set<string>();
    for (const genres of artistGenreMap.values()) {
      genres.forEach(g => allGenres.add(g));
    }

    expect(allGenres.size).toBe(5);
    expect(allGenres.has('rock')).toBe(true);
  });

  it('should count tracks per genre correctly', () => {
    const tracks = [
      { id: '1', artists: [{ id: 'a1' }] },
      { id: '2', artists: [{ id: 'a1' }, { id: 'a2' }] },
      { id: '3', artists: [{ id: 'a2' }] },
    ];

    const artistGenres = new Map([
      ['a1', ['rock']],
      ['a2', ['pop', 'rock']],
    ]);

    const genreCounts = new Map<string, number>();

    for (const track of tracks) {
      const trackGenres = new Set<string>();
      for (const artist of track.artists) {
        const genres = artistGenres.get(artist.id) || [];
        genres.forEach(g => trackGenres.add(g));
      }
      for (const genre of trackGenres) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }

    expect(genreCounts.get('rock')).toBe(3);
    expect(genreCounts.get('pop')).toBe(2);
  });

  it('should sort genres by track count descending', () => {
    const genres = [
      { name: 'indie', count: 5 },
      { name: 'rock', count: 20 },
      { name: 'pop', count: 15 },
    ];

    const sorted = [...genres].sort((a, b) => b.count - a.count);

    expect(sorted[0].name).toBe('rock');
    expect(sorted[1].name).toBe('pop');
    expect(sorted[2].name).toBe('indie');
  });
});

describe('Playlist Creation', () => {
  it('should chunk track URIs for batch operations', () => {
    const trackIds = Array.from({ length: 250 }, (_, i) => `track${i}`);
    const trackUris = trackIds.map(id => `spotify:track:${id}`);

    const chunks: string[][] = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      chunks.push(trackUris.slice(i, i + 100));
    }

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(100);
    expect(chunks[2].length).toBe(50);
  });

  it('should format track URIs correctly', () => {
    const trackId = 'abc123xyz';
    const uri = `spotify:track:${trackId}`;

    expect(uri).toBe('spotify:track:abc123xyz');
  });
});

describe('Artist Chunking', () => {
  it('should chunk artist IDs into groups of 50', () => {
    const artistIds = Array.from({ length: 175 }, (_, i) => `artist${i}`);

    const chunks: string[][] = [];
    for (let i = 0; i < artistIds.length; i += 50) {
      chunks.push(artistIds.slice(i, i + 50));
    }

    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(50);
    expect(chunks[3].length).toBe(25);
  });
});

describe('refreshSpotifyToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw an error if the fetch to Spotify token endpoint fails due to network error', async () => {
    vi.useFakeTimers();

    // Mock the global fetch object to simulate a network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // Start the fetch and immediately set up the rejection handler
    const promise = refreshSpotifyToken('fake-refresh-token', 'client-id', 'client-secret');

    // Store a reference to catch the rejection (prevents unhandled rejection warning)
    let caughtError: Error | null = null;
    const catchPromise = promise.catch(err => {
      caughtError = err;
    });

    // Advance timers for all retry delays
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    // Wait for the catch handler to complete
    await catchPromise;

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toBe('Network error');

    vi.useRealTimers();
  });

  it('should throw an error if the response is not ok', async () => {
    // Mock the global fetch object
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
      headers: new Headers()
    });

    await expect(refreshSpotifyToken('fake-refresh-token', 'client-id', 'client-secret')).rejects.toThrow('Failed to refresh Spotify token');
  });

  it('should successfully refresh the token', async () => {
    // Mock the global fetch object
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'new-access-token', expires_in: 3600 }),
      headers: new Headers()
    });

    const tokens = await refreshSpotifyToken('fake-refresh-token', 'client-id', 'client-secret');
    expect(tokens.access_token).toBe('new-access-token');
    expect(tokens.refresh_token).toBe('fake-refresh-token'); // It should preserve the refresh token if not returned
  });
});
