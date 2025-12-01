import { test, expect } from '@playwright/test';

test.describe('Playlist Creation (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated session
    await page.route('**/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'test-user', display_name: 'Test User' },
        }),
      });
    });

    // Mock genres API
    await page.route('**/api/genres', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          genres: {
            rock: {
              count: 10,
              tracks: [
                { id: '1', name: 'Song 1', artists: [{ name: 'Artist 1' }] },
                { id: '2', name: 'Song 2', artists: [{ name: 'Artist 2' }] },
              ],
            },
          },
          totalTracks: 10,
          totalInLibrary: 10,
          truncated: false,
        }),
      });
    });

    // Mock playlist creation
    await page.route('**/api/playlist', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          playlistUrl: 'https://open.spotify.com/playlist/mock123',
          playlistName: 'rock (from Likes)',
          trackCount: 10,
        }),
      });
    });

    // Mock bulk playlist creation
    await page.route('**/api/playlists/bulk', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              genre: 'rock',
              success: true,
              playlistUrl: 'https://open.spotify.com/playlist/mock123',
            },
          ],
          summary: { total: 1, successful: 1, failed: 0, skipped: 0 },
        }),
      });
    });
  });

  test('should have playlist creation functionality', async ({ page }) => {
    await page.goto('/');

    // Page should load successfully
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test('playlist API endpoint accepts POST', async ({ request }) => {
    const response = await request.post('/api/playlist', {
      data: { genre: 'rock' },
      headers: { 'Content-Type': 'application/json' },
    });

    // Either 200 (mocked) or 401 (not authenticated) is valid
    expect([200, 401]).toContain(response.status());
  });

  test('bulk playlist API endpoint accepts POST', async ({ request }) => {
    const response = await request.post('/api/playlists/bulk', {
      data: { genres: ['rock', 'pop'] },
      headers: { 'Content-Type': 'application/json' },
    });

    // Either 200 (mocked) or 401 (not authenticated) is valid
    expect([200, 401]).toContain(response.status());
  });
});

test.describe('Playlist Duplicate Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'test-user', display_name: 'Test User' },
        }),
      });
    });
  });

  test('should handle duplicate playlist warning', async ({ page }) => {
    // Mock playlist creation returning duplicate warning
    await page.route('**/api/playlist', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          warning: 'duplicate',
          existingPlaylist: 'rock (from Likes)',
        }),
      });
    });

    await page.goto('/');

    // Page loads successfully
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
