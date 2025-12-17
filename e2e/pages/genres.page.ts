/**
 * Genres Page Object Model
 *
 * Handles interactions with the genre list and playlist creation.
 */
import { Page, Locator, expect } from '@playwright/test';

export class GenresPage {
  readonly page: Page;

  // Genre list elements
  readonly genreContainer: Locator;
  readonly genreItems: Locator;
  readonly genreSearch: Locator;
  readonly genreCount: Locator;

  // Loading states
  readonly loadingSpinner: Locator;
  readonly progressBar: Locator;
  readonly progressText: Locator;

  // Empty/error states
  readonly emptyState: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;

  // Playlist creation
  readonly createButton: Locator;
  readonly bulkCreateButton: Locator;
  readonly selectedGenres: Locator;

  // Success/feedback
  readonly successToast: Locator;
  readonly playlistLink: Locator;

  // Cache controls
  readonly refreshButton: Locator;
  readonly cacheInfo: Locator;

  // Genre stats
  readonly statsButton: Locator;
  readonly statsModal: Locator;
  readonly diversityScore: Locator;

  constructor(page: Page) {
    this.page = page;

    // Genre list
    this.genreContainer = page.locator('#genre-list, .genre-list, [data-testid="genre-container"]');
    this.genreItems = page.locator('label.genre-item');
    this.genreSearch = page.locator('input.search-input[placeholder*="Search"], input[data-i18n-placeholder="searchGenres"]');
    this.genreCount = page.locator('.genre-count, [data-testid="genre-count"]');

    // Loading
    this.loadingSpinner = page.locator('.loading, .spinner, [data-loading="true"]');
    this.progressBar = page.locator('.progress-bar, [data-testid="progress-bar"]');
    this.progressText = page.locator('.progress-text, [data-testid="progress-text"]');

    // States
    this.emptyState = page.locator('.empty-state, [data-testid="empty-state"]');
    this.errorMessage = page.locator('.error-message, [data-testid="error"]');
    this.retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');

    // Creation
    this.createButton = page.locator('#create-btn, button:has-text("Create Playlists"), button:has-text("Create Playlist")');
    this.bulkCreateButton = page.locator('button:has-text("Create All"), button:has-text("Bulk Create")');
    this.selectedGenres = page.locator('label.genre-item input.genre-checkbox:checked');

    // Feedback - notification element OR results div with success indicators
    // The bulk creation flow shows success in #results div, not a notification toast
    this.successToast = page.locator('.notification.success, .toast-success, .success-message, [data-testid="success-toast"], #results .result-success, #results:has(.result-success)');
    this.playlistLink = page.locator('a[href*="open.spotify.com/playlist"]');

    // Cache
    this.refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh-genres"]');
    this.cacheInfo = page.locator('.cache-info, [data-testid="cache-info"]');

    // Stats
    this.statsButton = page.locator('button:has-text("Stats"), [data-testid="stats-button"]');
    this.statsModal = page.locator('.stats-modal, [data-testid="stats-modal"]');
    this.diversityScore = page.locator('.diversity-score, [data-testid="diversity-score"]');
  }

  /**
   * Wait for genres to load
   */
  async waitForGenresLoaded(timeout = 30000): Promise<void> {
    // Wait for loading to finish
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout }).catch(() => {});

    // Wait for content
    await Promise.race([
      this.genreItems.first().waitFor({ state: 'visible', timeout }),
      this.emptyState.waitFor({ state: 'visible', timeout }),
      this.errorMessage.waitFor({ state: 'visible', timeout }),
    ]);
  }

  /**
   * Wait for progressive scan to complete
   */
  async waitForProgressiveScan(timeout = 120000): Promise<void> {
    // If progress bar is visible, wait for it to complete
    const hasProgress = await this.progressBar.isVisible().catch(() => false);

    if (hasProgress) {
      await this.progressBar.waitFor({ state: 'hidden', timeout });
    }

    await this.waitForGenresLoaded(timeout);
  }

  /**
   * Get all genre names
   */
  async getGenreNames(): Promise<string[]> {
    const items = await this.genreItems.all();
    const names: string[] = [];

    for (const item of items) {
      const nameEl = item.locator('.genre-name, .name, span').first();
      const text = await nameEl.textContent();
      if (text) names.push(text.trim());
    }

    return names;
  }

  /**
   * Get genre count
   */
  async getGenreCount(): Promise<number> {
    return this.genreItems.count();
  }

  /**
   * Search for genres
   */
  async search(query: string): Promise<void> {
    await this.genreSearch.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.genreSearch.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * Select a genre by name
   */
  async selectGenre(name: string): Promise<void> {
    const genre = this.genreItems.filter({ hasText: name }).first();
    await genre.click();
  }

  /**
   * Select multiple genres
   */
  async selectGenres(names: string[]): Promise<void> {
    for (const name of names) {
      await this.selectGenre(name);
    }
  }

  /**
   * Get selected genre count
   */
  async getSelectedCount(): Promise<number> {
    return this.selectedGenres.count();
  }

  /**
   * Create playlist for selected genre(s)
   */
  async createPlaylist(): Promise<void> {
    await this.createButton.click();
  }

  /**
   * Bulk create playlists
   */
  async bulkCreate(): Promise<void> {
    await this.bulkCreateButton.click();
  }

  /**
   * Wait for playlist creation success
   * Looks for either notification toast OR results div with success indicators
   */
  async waitForPlaylistCreated(timeout = 30000): Promise<void> {
    // Use .first() since selector may match multiple elements (e.g., results div AND result links)
    await this.successToast.first().waitFor({ state: 'visible', timeout });
  }

  /**
   * Refresh genre cache
   */
  async refreshCache(): Promise<void> {
    await this.refreshButton.click();
    await this.waitForGenresLoaded();
  }

  /**
   * Open stats modal
   */
  async openStats(): Promise<void> {
    await this.statsButton.click();
    await this.statsModal.waitFor({ state: 'visible' });
  }

  /**
   * Get diversity score
   */
  async getDiversityScore(): Promise<number | null> {
    const isVisible = await this.diversityScore.isVisible().catch(() => false);
    if (!isVisible) return null;

    const text = await this.diversityScore.textContent();
    const match = text?.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Check if error is shown
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Retry after error
   */
  async retry(): Promise<void> {
    await this.retryButton.click();
    await this.waitForGenresLoaded();
  }

  /**
   * Expect specific genre count
   */
  async expectGenreCount(count: number): Promise<void> {
    await expect(this.genreItems).toHaveCount(count);
  }

  /**
   * Expect genres to contain specific names
   */
  async expectGenresToInclude(names: string[]): Promise<void> {
    const actualNames = await this.getGenreNames();
    for (const name of names) {
      expect(actualNames).toContain(name);
    }
  }

  /**
   * Expect empty state
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Expect error state
   */
  async expectError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Expect success toast or results div with success indicators
   */
  async expectSuccessMessage(): Promise<void> {
    // Use .first() since selector may match multiple elements
    await expect(this.successToast.first()).toBeVisible();
  }
}
