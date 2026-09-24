import { describe, it, expect, vi, afterEach } from 'vitest';
import { addTracksToPlaylist } from '../src/lib/spotify';

describe('addTracksToPlaylist', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send correct POST request for under 100 tracks', async () => {
    let fetchCallArgs: any[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (...args) => {
      fetchCallArgs.push(args);
      return { ok: true, status: 201, json: async () => ({}) };
    }));

    const token = 'test-token';
    const playlistId = 'playlist-123';
    const uris = ['spotify:track:1', 'spotify:track:2'];

    await addTracksToPlaylist(token, playlistId, uris);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(fetchCallArgs[0][0]).toBe('https://api.spotify.com/v1/playlists/playlist-123/tracks');
    expect(fetchCallArgs[0][1].method).toBe('POST');
    expect(fetchCallArgs[0][1].headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(fetchCallArgs[0][1].body).uris).toEqual(uris);
  });

  it('should chunk requests for more than 100 tracks', async () => {
    let fetchCallArgs: any[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (...args) => {
      fetchCallArgs.push(args);
      return { ok: true, status: 201, json: async () => ({}) };
    }));

    const token = 'test-token';
    const playlistId = 'playlist-123';
    const uris = Array.from({ length: 250 }, (_, i) => `spotify:track:${i}`);

    await addTracksToPlaylist(token, playlistId, uris);

    expect(global.fetch).toHaveBeenCalledTimes(3);

    fetchCallArgs.sort((a, b) => {
      const aBody = JSON.parse(a[1].body);
      const bBody = JSON.parse(b[1].body);
      return aBody.uris[0].localeCompare(bBody.uris[0], undefined, {numeric: true});
    });

    expect(JSON.parse(fetchCallArgs[0][1].body).uris).toEqual(uris.slice(0, 100));
    expect(JSON.parse(fetchCallArgs[1][1].body).uris).toEqual(uris.slice(100, 200));
    expect(JSON.parse(fetchCallArgs[2][1].body).uris).toEqual(uris.slice(200, 250));
  });

  it('should handle errors gracefully without failing the whole operation', async () => {
    // We only need useFakeTimers if we test retry behavior. Let's just do real timers if spotifyFetch
    // handles its retries internally or fails fast. Let's look at the fetch mock.
    vi.useFakeTimers();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (...args) => {
      const body = JSON.parse(args[1].body);
      if (body.uris.includes('spotify:track:150')) {
         return { ok: false, status: 500, text: async () => 'API Error', headers: new Headers() };
      }
      return { ok: true, status: 201, json: async () => ({}) };
    }));

    const token = 'test-token';
    const playlistId = 'playlist-123';
    const uris = Array.from({ length: 250 }, (_, i) => `spotify:track:${i}`);

    const promise = addTracksToPlaylist(token, playlistId, uris);

    // We need a loop to advance timers since fetchWithRetry waits 1000ms then 2000ms then 4000ms etc.
    // fetchWithRetry waits based on 2^attempt * 1000, 3 max retries.
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000); // if any

    await promise;

    // chunk 1: 1 call
    // chunk 2: 3 calls (initial + 2 retries or max retries?)
    // Wait, let's just assert that console.error was called, and let's not assert on the exact fetch call count, since the exact retry count inside spotifyFetch is tested elsewhere.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to add tracks chunk starting at index 100:',
      expect.any(Error)
    );

    vi.useRealTimers();
  });
});
