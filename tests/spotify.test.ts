import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSpotifyAuthUrl, refreshSpotifyToken, generateCodeVerifier, fetchWithRetry, createPlaylist, getLikedTracks } from '../src/lib/spotify';


describe('Spotify Library', () => {
  describe('getLikedTracks', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch liked tracks successfully', async () => {
      const mockData = {
        items: [
          { track: { id: '1', name: 'Track 1' } },
          { track: { id: '2', name: 'Track 2' } },
        ],
        total: 2,
        next: null
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      }));

      const result = await getLikedTracks('fake-token', 50, 0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/tracks?limit=50&offset=0'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token'
          })
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should pass custom limit and offset to API', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total: 0, next: null })
      }));

      await getLikedTracks('fake-token', 10, 20);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/tracks?limit=10&offset=20'),
        expect.any(Object)
      );
    });

    it('should throw error when API responds with an error status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }));

      await expect(getLikedTracks('fake-token')).rejects.toThrow('Spotify API error: 401 Unauthorized');
    });
  });


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

    it('should include PKCE parameters if codeChallenge is provided', () => {
      const url = getSpotifyAuthUrl(
        'test-client-id',
        'https://example.com/callback',
        'test-state-123',
        'test-code-challenge'
      );

      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('code_challenge=test-code-challenge');
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully create a playlist and send correct payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'new-playlist-id', external_urls: { spotify: 'url' } }),
    });

    const result = await createPlaylist('fake-token', 'user-123', 'My Playlist', 'Desc', true);

    expect(result.id).toBe('new-playlist-id');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(global.fetch).mock.calls[0];

    expect(url).toBe('https://api.spotify.com/v1/users/user-123/playlists');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer fake-token');

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      name: 'My Playlist',
      description: 'Desc',
      public: true,
    });
  });

  it('should throw an error when API returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden access',
    });

    await expect(createPlaylist('fake-token', 'user-123', 'My Playlist', 'Desc', false))
      .rejects
      .toThrow('Spotify API error: 403 Forbidden access');
  });

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



  describe('getTracksWithGenres', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should correctly map tracks to their genres', async () => {
      const mockTracks = {
        tracks: [
          {
            added_at: '2023-01-01T00:00:00Z',
            track: {
              id: 'track1',
              name: 'Song 1',
              artists: [{ id: 'artist1', name: 'Artist 1' }, { id: 'artist2', name: 'Artist 2' }]
            }
          },
          {
            added_at: '2023-01-02T00:00:00Z',
            track: {
              id: 'track2',
              name: 'Song 2',
              artists: [{ id: 'artist3', name: 'Artist 3' }]
            }
          }
        ]
      };

      const mockArtists = {
        artists: [
          { id: 'artist1', name: 'Artist 1', genres: ['rock', 'indie'] },
          { id: 'artist2', name: 'Artist 2', genres: ['pop'] },
          { id: 'artist3', name: 'Artist 3', genres: ['jazz', 'blues'] }
        ]
      };

      // Mock the global fetch
      (global as any).fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/me/tracks')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: mockTracks.tracks,
              total: 2
            })
          };
        } else if (url.includes('/artists')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtists
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const { getTracksWithGenres } = await import('../src/lib/spotify');
      const result = await getTracksWithGenres('fake-token');

      expect((global as any).fetch).toHaveBeenCalled();

      expect(result.size).toBe(2);

      const track1 = result.get('track1');
      expect(track1).toBeDefined();
      expect(track1?.addedAt).toBe('2023-01-01T00:00:00Z');
      expect(track1?.genres).toEqual(expect.arrayContaining(['rock', 'indie', 'pop']));
      expect(track1?.genres.length).toBe(3);

      const track2 = result.get('track2');
      expect(track2).toBeDefined();
      expect(track2?.addedAt).toBe('2023-01-02T00:00:00Z');
      expect(track2?.genres).toEqual(expect.arrayContaining(['jazz', 'blues']));
      expect(track2?.genres.length).toBe(2);
    });

    it('should handle artists with no genres', async () => {
      const mockTracks = {
        tracks: [
          {
            added_at: '2023-01-01T00:00:00Z',
            track: {
              id: 'track1',
              name: 'Song 1',
              artists: [{ id: 'artist1', name: 'Artist 1' }]
            }
          }
        ]
      };

      const mockArtists = {
        artists: [
          { id: 'artist1', name: 'Artist 1', genres: [] }
        ]
      };

      (global as any).fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/me/tracks')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: mockTracks.tracks,
              total: 1
            })
          };
        } else if (url.includes('/artists')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtists
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const { getTracksWithGenres } = await import('../src/lib/spotify');
      const result = await getTracksWithGenres('fake-token');

      const track1 = result.get('track1');
      expect(track1?.genres).toEqual([]);
    });

    it('should handle missing artists in the response', async () => {
      const mockTracks = {
        tracks: [
          {
            added_at: '2023-01-01T00:00:00Z',
            track: {
              id: 'track1',
              name: 'Song 1',
              artists: [{ id: 'artist1', name: 'Artist 1' }]
            }
          }
        ]
      };

      const mockArtists = {
        artists: [] // Artist not found in response
      };

      (global as any).fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/me/tracks')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: mockTracks.tracks,
              total: 1
            })
          };
        } else if (url.includes('/artists')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtists
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const { getTracksWithGenres } = await import('../src/lib/spotify');
      const result = await getTracksWithGenres('fake-token');

      const track1 = result.get('track1');
      expect(track1?.genres).toEqual([]);
    });

    it('should deduplicate genres from multiple artists on the same track', async () => {
      const mockTracks = {
        tracks: [
          {
            added_at: '2023-01-01T00:00:00Z',
            track: {
              id: 'track1',
              name: 'Song 1',
              artists: [{ id: 'artist1', name: 'Artist 1' }, { id: 'artist2', name: 'Artist 2' }]
            }
          }
        ]
      };

      const mockArtists = {
        artists: [
          { id: 'artist1', name: 'Artist 1', genres: ['rock', 'pop'] },
          { id: 'artist2', name: 'Artist 2', genres: ['pop', 'indie'] }
        ]
      };

      (global as any).fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/me/tracks')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: mockTracks.tracks,
              total: 1
            })
          };
        } else if (url.includes('/artists')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtists
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const { getTracksWithGenres } = await import('../src/lib/spotify');
      const result = await getTracksWithGenres('fake-token');

      const track1 = result.get('track1');
      expect(track1?.genres).toEqual(expect.arrayContaining(['rock', 'pop', 'indie']));
      expect(track1?.genres.length).toBe(3); // pop should be deduplicated
    });
  });


  describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should retry on 429 rate limit response', async () => {
    vi.useFakeTimers();

    let attemptCount = 0;
    (global as any).fetch = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        return {
          status: 429,
          headers: new Headers({ 'Retry-After': '2' }),
        };
      }
      return {
        status: 200,
        ok: true,
      };
    });

    const promise = fetchWithRetry('https://api.spotify.com/v1/me', {});

    // First wait
    await vi.advanceTimersByTimeAsync(2000);
    // Second wait
    await vi.advanceTimersByTimeAsync(2000);

    const res = await promise;
    expect(attemptCount).toBe(3);
    expect(res.status).toBe(200);

      });

  it('should retry on 5xx server errors', async () => {
    vi.useFakeTimers();

    let attemptCount = 0;
    (global as any).fetch = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 2) {
        return {
          status: 503,
          headers: new Headers(),
        };
      }
      return {
        status: 200,
        ok: true,
      };
    });

    const promise = fetchWithRetry('https://api.spotify.com/v1/me', {});

    // Base delay is 1000ms * 2^0 = 1000ms
    await vi.advanceTimersByTimeAsync(1000);

    const res = await promise;
    expect(attemptCount).toBe(2);
    expect(res.status).toBe(200);

      });

  it('should fallback to 2^attempt * BASE_DELAY if Retry-After is missing', async () => {
    vi.useFakeTimers();

    let attemptCount = 0;
    (global as any).fetch = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        return {
          status: 429,
          headers: new Headers(), // Missing Retry-After
        };
      }
      return {
        status: 200,
        ok: true,
      };
    });

    const promise = fetchWithRetry('https://api.spotify.com/v1/me', {});

    // Attempt 0 -> delay: 1000 * 2^0 = 1000
    await vi.advanceTimersByTimeAsync(1000);

    // Attempt 1 -> delay: 1000 * 2^1 = 2000
    await vi.advanceTimersByTimeAsync(2000);

    const res = await promise;
    expect(attemptCount).toBe(3);
    expect(res.status).toBe(200);

      });
});

describe('refreshSpotifyToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw an error if the fetch to Spotify token endpoint fails due to network error', async () => {
    vi.useFakeTimers();

    // Mock the global fetch object to simulate a network error
    (global as any).fetch = vi.fn().mockRejectedValue(new Error('Network error'));

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

      });

  it('should throw an error if the response is not ok', async () => {
    // Mock the global fetch object
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
      headers: new Headers()
    });

    await expect(refreshSpotifyToken('fake-refresh-token', 'client-id', 'client-secret')).rejects.toThrow('Failed to refresh Spotify token');
  });

  it('should successfully refresh the token', async () => {
    // Mock the global fetch object
    (global as any).fetch = vi.fn().mockResolvedValue({
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
