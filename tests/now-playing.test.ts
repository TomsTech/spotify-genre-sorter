import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import * as spotifyLib from '../src/lib/spotify';
import api from '../src/routes/api';
import * as sessionLib from '../src/lib/session';

describe('Now Playing Route Tests', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();

    // Setup env mock
    app.use('*', async (c, next) => {
      c.env = {
        SESSIONS: {
          put: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          list: vi.fn()
        }
      };
      await next();
    });

    app.route('/api', api);

    // Mock the session lib
    vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      spotifyAccessToken: 'valid-token',
      spotifyUserId: 'user123'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/now-playing', () => {
    it('should return error when spotify fetching playback fails', async () => {
      // Mock the spotify lib to fail
      vi.spyOn(spotifyLib, 'getCurrentPlayback').mockRejectedValue(new Error('Spotify API failure'));

      const res = await app.request('/api/now-playing');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        playing: false,
        error: 'Failed to fetch playback'
      });
    });
  });
});
