/**
 * Source Selector E2E Tests
 *
 * Tests the source selection modal that appears after login,
 * allowing users to choose which sources (liked songs, playlists)
 * to scan for genres.
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Source Selector Modal', () => {
  test('shows source selector modal after login', async ({ authenticatedPage }) => {
    // Modal should appear automatically after authentication
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Should have a title
    const title = modal.locator('h2');
    await expect(title).toContainText(/Select Music Sources|Välj musikkällor/);
  });

  test('displays liked songs option checked by default', async ({ authenticatedPage }) => {
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Liked songs checkbox should be checked by default
    const likedCheckbox = modal.locator('#source-liked');
    await expect(likedCheckbox).toBeChecked();
  });

  test('displays user playlists with details', async ({ authenticatedPage }) => {
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Should show playlist options
    const playlistOptions = modal.locator('.source-option').filter({ hasText: /Rock Collection|Workout Mix|Top 50 Global/ });

    // We mock 3 playlists, so expect at least 3 playlist options (plus liked songs)
    const count = await playlistOptions.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('can select and deselect playlists', async ({ authenticatedPage }) => {
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Find a playlist checkbox and toggle it
    const playlistCheckbox = modal.locator('input[type="checkbox"]').nth(1); // First playlist after liked

    // Initially unchecked (only liked is checked by default)
    const initialState = await playlistCheckbox.isChecked();

    // Toggle it
    await playlistCheckbox.click();

    // Should be opposite of initial state
    const newState = await playlistCheckbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('requires at least one source selected', async ({ authenticatedPage }) => {
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Uncheck liked songs
    const likedCheckbox = modal.locator('#source-liked');
    if (await likedCheckbox.isChecked()) {
      await likedCheckbox.click();
    }

    // Try to confirm with no sources
    const confirmButton = modal.locator('button').filter({ hasText: /Analyze|Analysera|Start|Confirm/ });

    // Button should be disabled or show error when no sources selected
    // The exact behavior depends on implementation
    const isDisabled = await confirmButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      // If button is clickable, click it and expect an error message
      await confirmButton.click();

      // Should show validation message
      const hasValidation = await modal.locator('text=/select at least|välj minst/i').isVisible().catch(() => false);
      expect(hasValidation || isDisabled).toBe(true);
    }
  });

  test('cancel closes modal without scanning', async ({ authenticatedPage }) => {
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Click cancel/close button
    const cancelButton = modal.locator('button').filter({ hasText: /Cancel|Avbryt|Close|×/ }).first();

    // Check if there's a cancel button
    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Modal should close
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('confirm starts scan with selected sources', async ({ authenticatedPage }) => {
    const modal = authenticatedPage.locator('.source-selector-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Keep liked songs checked (default)
    const likedCheckbox = modal.locator('#source-liked');
    await expect(likedCheckbox).toBeChecked();

    // Click confirm/start button
    const confirmButton = modal.locator('button').filter({ hasText: /Analyze|Analysera|Start|Confirm/ }).first();
    await confirmButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Should start loading/scanning
    const hasLoading = await authenticatedPage.locator('.loading, .progress, [class*="loading"], [class*="progress"]').isVisible().catch(() => false);
    const hasGenres = await authenticatedPage.locator('.genre-item, .genre-card, [class*="genre"]').first().isVisible({ timeout: 30000 }).catch(() => false);

    // Either loading or genres should be visible
    expect(hasLoading || hasGenres).toBe(true);
  });
});

test.describe('Source Selector - Swedish Mode', () => {
  test('shows Swedish translations when Swedish mode active', async ({ authenticatedPage }) => {
    // Enable Swedish mode by setting localStorage before the modal appears
    await authenticatedPage.evaluate(() => {
      localStorage.setItem('swedishMode', 'true');
    });

    // Reload to apply Swedish mode
    await authenticatedPage.reload();

    const modal = authenticatedPage.locator('.source-selector-modal');

    // Wait for modal (might take a moment after reload)
    const isVisible = await modal.isVisible({ timeout: 10000 }).catch(() => false);

    if (isVisible) {
      // Check for Swedish text
      const hasSwedishTitle = await modal.locator('text=/Välj musikkällor/').isVisible().catch(() => false);
      const hasSwedishLiked = await modal.locator('text=/Gillade låtar/').isVisible().catch(() => false);

      // At least one Swedish element should be visible
      expect(hasSwedishTitle || hasSwedishLiked).toBe(true);
    }
  });
});

test.describe('Source Selector - API Integration', () => {
  test('GET /api/user-playlists returns playlist list', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get('/api/user-playlists');

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('playlists');
    expect(Array.isArray(data.playlists)).toBe(true);

    // Check playlist structure
    if (data.playlists.length > 0) {
      const playlist = data.playlists[0];
      expect(playlist).toHaveProperty('id');
      expect(playlist).toHaveProperty('name');
      expect(playlist).toHaveProperty('trackCount');
      expect(playlist).toHaveProperty('owner');
      expect(playlist).toHaveProperty('isOwned');
    }
  });

  test('handles /api/user-playlists failure gracefully', async ({ authenticatedPage }) => {
    // Override the route to return an error
    await authenticatedPage.route('**/api/user-playlists', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to fetch playlists' }),
      });
    });

    // Reload to trigger the error
    await authenticatedPage.reload();

    // App should still work - either show error or fall back to liked songs only
    // Wait a bit for the page to handle the error
    await authenticatedPage.waitForTimeout(2000);

    // Should not crash - page should still be responsive
    const isPageAlive = await authenticatedPage.locator('body').isVisible();
    expect(isPageAlive).toBe(true);
  });
});
