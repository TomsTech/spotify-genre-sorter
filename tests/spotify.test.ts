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


  describe('getLikedTracks', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch liked tracks successfully', async () => {
      const mockResponse = {
        items: [{ track: { id: 'track1', name: 'Track 1', artists: [], album: { name: '', images: [] } }, added_at: '2023-01-01T00:00:00Z' }],
        total: 1,
        next: null
      };

      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers()
      });

      const result = await getLikedTracks('fake-token', 10, 5);

      expect(global.fetch).toHaveBeenCalledWith('https://api.spotify.com/v1/me/tracks?limit=10&offset=5', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token',
          'Content-Type': 'application/json'
        })
      }));

      expect(result).toEqual(mockResponse);
    });

    it('should use default limit and offset if not provided', async () => {
      const mockResponse = {
        items: [],
        total: 0,
        next: null
      };

      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers()
      });

      await getLikedTracks('fake-token');

      expect(global.fetch).toHaveBeenCalledWith('https://api.spotify.com/v1/me/tracks?limit=50&offset=0', expect.any(Object));
    });

    it('should throw an error if the fetch fails', async () => {
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
        headers: new Headers()
      });

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

  describe('addTracksToPlaylist', () => {
    it('should chunk track URIs and add them in parallel respecting concurrency limit', async () => {
      // Mock the global fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ snapshot_id: 'fake-snapshot' })
      });
      vi.stubGlobal('fetch', fetchMock);

      const { addTracksToPlaylist } = await import('../src/lib/spotify');

      // Create 250 fake track URIs.
      // With a limit of 100 per chunk, this creates 3 chunks: 100, 100, and 50.
      const trackUris = Array.from({ length: 250 }, (_, i) => `spotify:track:track${i}`);

      await addTracksToPlaylist('fake-token', 'playlist-123', trackUris);

      // Verify that fetch was called 3 times (once for each chunk).
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Ensure fetch is called with chunked URIs.
      const calls = fetchMock.mock.calls;
      expect(JSON.parse(calls[0][1].body).uris.length).toBe(100);
      expect(JSON.parse(calls[1][1].body).uris.length).toBe(100);
      expect(JSON.parse(calls[2][1].body).uris.length).toBe(50);
    });

    it('should handle failures in individual chunks without failing the whole batch', async () => {
      // Mock fetch where the second chunk fails.
      // Return 500 continuously for the second chunk so it exhausts retries and fails
      const fetchMock = vi.fn().mockImplementation(async (url, init) => {
        const body = JSON.parse(init.body);
        if (body.uris[0] === 'spotify:track:track100') {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            text: async () => 'Internal Server Error'
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ snapshot_id: 'fake-snapshot' })
        };
      });
      vi.stubGlobal('fetch', fetchMock);

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { addTracksToPlaylist } = await import('../src/lib/spotify');

      const trackUris = Array.from({ length: 250 }, (_, i) => `spotify:track:track${i}`);

      // It shouldn't throw an exception to the top level.
      await expect(addTracksToPlaylist('fake-token', 'playlist-123', trackUris)).resolves.not.toThrow();

      // fetchMock is called 5 times: 3 original requests + 2 retries on the failing chunk (fetchWithRetry default maxRetries is 3)
      expect(fetchMock).toHaveBeenCalledTimes(5);
      // Ensure the error was logged for the failed chunk.
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

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




  describe('getArtists', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch artists from Spotify when KV is not provided', async () => {
      const mockArtists = {
        artists: [
          { id: '1', name: 'Artist 1', genres: ['pop'] },
          { id: '2', name: 'Artist 2', genres: ['rock'] }
        ]
      };

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
        if (url.includes('/artists')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtists
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }));

      const { getArtists } = await import('../src/lib/spotify');
      const result = await getArtists('fake-token', ['1', '2']);

      expect(result.artists.length).toBe(2);
      expect(result.artists[0].id).toBe('1');
      expect(result.totalArtists).toBe(2);
      expect(result.truncated).toBe(false);
      expect(result.cacheHits).toBeUndefined();
      expect(result.cacheMisses).toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should truncate artistIds if exceeding maxRequests', async () => {
      const mockArtists = { artists: [] };
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        return { ok: true, status: 200, json: async () => mockArtists };
      }));

      // maxRequests is 1, so maxArtists is 50
      const largeArtistIds = Array.from({ length: 60 }, (_, i) => String(i));
      const { getArtists } = await import('../src/lib/spotify');

      const result = await getArtists('fake-token', largeArtistIds, 1);

      expect(result.totalArtists).toBe(60);
      expect(result.truncated).toBe(true);

      // Should have only requested the first 50
      expect(fetch).toHaveBeenCalledTimes(1);
      const fetchCallUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      const urlParams = new URLSearchParams(fetchCallUrl.split('?')[1]);
      const idsParam = urlParams.get('ids');
      expect(idsParam?.split(',').length).toBe(50);
    });

    it('should use KV cache when provided and return cached genres', async () => {
      const mockKv = {} as KVNamespace;

      // Mock the cache functions directly via vi.doMock
      vi.doMock('../src/lib/artist-genre-cache', () => {
        return {
          getCachedArtistGenresBatch: vi.fn().mockResolvedValue(new Map([
            ['1', ['pop', 'dance']]
          ])),
          cacheArtistGenresBatch: vi.fn().mockResolvedValue(undefined),
          updateArtistGenreCacheStats: vi.fn().mockResolvedValue(undefined),
        };
      });

      const mockSpotifyArtists = {
        artists: [
          { id: '2', name: 'Artist 2', genres: ['rock'] }
        ]
      };

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
        if (url.includes('/artists')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockSpotifyArtists
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }));

      // Need to re-import dynamically to pick up the doMock
      vi.resetModules();
      const { getArtists } = await import('../src/lib/spotify');
      const result = await getArtists('fake-token', ['1', '2'], undefined, mockKv);

      expect(result.artists.length).toBe(2);

      // Check cached artist
      const cachedArtist = result.artists.find(a => a.id === '1');
      expect(cachedArtist).toBeDefined();
      expect(cachedArtist?.genres).toEqual(['pop', 'dance']);

      // Check fetched artist
      const fetchedArtist = result.artists.find(a => a.id === '2');
      expect(fetchedArtist).toBeDefined();
      expect(fetchedArtist?.genres).toEqual(['rock']);

      expect(result.cacheHits).toBe(1);
      expect(result.cacheMisses).toBe(1);

      // Clean up mock
      vi.doUnmock('../src/lib/artist-genre-cache');
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
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
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
      }));

      const { getTracksWithGenres } = await import('../src/lib/spotify');
      const result = await getTracksWithGenres('fake-token');

      expect(fetch).toHaveBeenCalled();

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

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
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
      }));

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

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
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
      }));

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

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
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
      }));

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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
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
    }));

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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
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
    }));

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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
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
    }));

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


describe('getAllLikedTracks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockResponse = (total, items) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items,
        total,
      }),
      headers: new Headers(),
    };
  };

  it('should fetch all tracks when total is less than limit', async () => {
    const mockItems = Array.from({ length: 30 }, (_, i) => ({ track: { id: `t${i}` } }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockResponse(30, mockItems)));

    const { getAllLikedTracks } = await import('../src/lib/spotify');
    const onProgress = vi.fn();

    const result = await getAllLikedTracks('fake-token', onProgress);

    expect(result.tracks).toHaveLength(30);
    expect(result.totalInLibrary).toBe(30);
    expect(result.truncated).toBe(false);
    expect(onProgress).toHaveBeenCalledWith(30, 30);

    // Only one fetch call expected
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should paginate and fetch all tracks in batches when total exceeds limit', async () => {
    // Total 120 tracks: limit is 50. Requires 3 pages (offset 0, 50, 100)
    const mockItemsPage1 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `p1-${i}` } }));
    const mockItemsPage2 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `p2-${i}` } }));
    const mockItemsPage3 = Array.from({ length: 20 }, (_, i) => ({ track: { id: `p3-${i}` } }));

    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlObj = new URL(url);
      const offset = parseInt(urlObj.searchParams.get('offset') || '0', 10);

      if (offset === 0) return createMockResponse(120, mockItemsPage1);
      if (offset === 50) return createMockResponse(120, mockItemsPage2);
      if (offset === 100) return createMockResponse(120, mockItemsPage3);

      return createMockResponse(120, []);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { getAllLikedTracks } = await import('../src/lib/spotify');
    const onProgress = vi.fn();

    const result = await getAllLikedTracks('fake-token', onProgress);

    expect(result.tracks).toHaveLength(120);
    expect(result.totalInLibrary).toBe(120);
    expect(result.truncated).toBe(false);

    // Verify progress was called multiple times as batches complete
    expect(onProgress).toHaveBeenCalled();
    // The final call should be with total count
    expect(onProgress).toHaveBeenLastCalledWith(120, 120);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should truncate tracks if maxTracks limit is reached', async () => {
    // Total 150 tracks. maxTracks = 100.
    const mockItemsPage1 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `p1-${i}` } }));
    const mockItemsPage2 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `p2-${i}` } }));
    const mockItemsPage3 = Array.from({ length: 50 }, (_, i) => ({ track: { id: `p3-${i}` } }));

    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const urlObj = new URL(url);
      const offset = parseInt(urlObj.searchParams.get('offset') || '0', 10);

      if (offset === 0) return createMockResponse(150, mockItemsPage1);
      if (offset === 50) return createMockResponse(150, mockItemsPage2);
      if (offset === 100) return createMockResponse(150, mockItemsPage3);

      return createMockResponse(150, []);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { getAllLikedTracks } = await import('../src/lib/spotify');
    const onProgress = vi.fn();

    const result = await getAllLikedTracks('fake-token', onProgress, 100);

    expect(result.tracks).toHaveLength(100);
    expect(result.totalInLibrary).toBe(150);
    expect(result.truncated).toBe(true);

    // Initial fetch (offset 0) + 1 remaining fetch (offset 50) before hitting maxTracks limit
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


describe('exchangeSpotifyCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully exchange code for tokens', async () => {
    const mockTokens = {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer'
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTokens,
      headers: new Headers()
    }));

    const { exchangeSpotifyCode } = await import('../src/lib/spotify');

    const result = await exchangeSpotifyCode('fake-code', 'fake-client-id', 'fake-client-secret', 'http://localhost/callback');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://accounts.spotify.com/api/token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa('fake-client-id:fake-client-secret')}`,
      }),
      body: expect.any(URLSearchParams)
    }));

    // Check URLSearchParams body contents
    const fetchCallArgs = (global.fetch as any).mock.calls[0];
    const bodyArgs = fetchCallArgs[1].body as URLSearchParams;
    expect(bodyArgs.get('grant_type')).toBe('authorization_code');
    expect(bodyArgs.get('code')).toBe('fake-code');
    expect(bodyArgs.get('redirect_uri')).toBe('http://localhost/callback');
    expect(bodyArgs.get('code_verifier')).toBeNull();

    expect(result).toEqual(mockTokens);
  });

  it('should include code_verifier if provided for PKCE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      headers: new Headers()
    }));

    const { exchangeSpotifyCode } = await import('../src/lib/spotify');

    await exchangeSpotifyCode('fake-code', 'fake-client-id', 'fake-client-secret', 'http://localhost/callback', 'fake-verifier');

    const fetchCallArgs = (global.fetch as any).mock.calls[0];
    const bodyArgs = fetchCallArgs[1].body as URLSearchParams;
    expect(bodyArgs.get('code_verifier')).toBe('fake-verifier');
  });

  it('should throw an error if the token exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
      headers: new Headers()
    }));

    const { exchangeSpotifyCode } = await import('../src/lib/spotify');

    await expect(exchangeSpotifyCode('fake-code', 'fake-client-id', 'fake-client-secret', 'http://localhost/callback')).rejects.toThrow('Spotify token exchange failed: invalid_grant');
  });
});
