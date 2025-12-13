/**
 * Home Page Object Model
 *
 * Encapsulates interactions with the main Genre Genie page.
 */
import { Page, Locator, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;

  // Header elements
  readonly heading: Locator;
  readonly logo: Locator;
  readonly versionBadge: Locator;

  // Auth elements
  readonly signInButton: Locator;
  readonly userAvatar: Locator;
  readonly userName: Locator;
  readonly logoutButton: Locator;

  // Genre list
  readonly genreList: Locator;
  readonly genreItems: Locator;
  readonly genreSearchInput: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyStateMessage: Locator;

  // Sidebar
  readonly sidebar: Locator;
  readonly pioneersSection: Locator;
  readonly newUsersSection: Locator;
  readonly recentPlaylistsSection: Locator;

  // Theme & Easter eggs
  readonly themeToggle: Locator;
  readonly heidiBadge: Locator;

  // Buttons
  readonly createPlaylistButton: Locator;
  readonly bulkCreateButton: Locator;
  readonly refreshButton: Locator;

  // Modals
  readonly scoreboardModal: Locator;
  readonly statsModal: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.heading = page.locator('h1').first();
    this.logo = page.locator('.logo, [data-testid="logo"]');
    this.versionBadge = page.locator('.version-badge, [data-testid="version"]');

    // Auth - prefer data-testid for reliability
    this.signInButton = page.locator('[data-testid="sign-in-button"], a[href*="/auth/spotify"], button:has-text("Sign in"), button:has-text("Login")');
    this.userAvatar = page.locator('[data-testid="user-avatar"], .user-avatar, .avatar');
    this.userName = page.locator('[data-testid="user-name"], .user-name');
    this.logoutButton = page.locator('[data-testid="logout-button"], a[href*="/auth/logout"], button:has-text("Logout"), button:has-text("Sign out")');

    // Genre list
    this.genreList = page.locator('.genre-list, [data-testid="genre-list"], #genre-container');
    this.genreItems = page.locator('.genre-item, [data-testid="genre-item"], .genre-card');
    this.genreSearchInput = page.locator('input[placeholder*="Search"], input[type="search"], #genre-search');
    this.loadingIndicator = page.locator('.loading, [data-loading], .spinner, .skeleton');
    this.emptyStateMessage = page.locator('.empty-state, [data-testid="empty-state"]');

    // Sidebar - prefer data-testid for reliability
    this.sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
    this.pioneersSection = page.locator('[data-testid="pioneers"], .pioneers, .pioneers-section');
    this.newUsersSection = page.locator('[data-testid="new-users"], .new-users');
    this.recentPlaylistsSection = page.locator('[data-testid="recent-playlists"], .recent-playlists');

    // Theme & Easter eggs - prefer data-testid for reliability
    this.themeToggle = page.locator('[data-testid="theme-toggle"], .theme-toggle, button:has-text("🌙"), button:has-text("☀️")');
    this.heidiBadge = page.locator('[data-testid="heidi-badge"], .heidi-badge, .for-heidi');

    // Buttons
    this.createPlaylistButton = page.locator('button:has-text("Create"), [data-testid="create-playlist"]');
    this.bulkCreateButton = page.locator('button:has-text("Bulk"), button:has-text("Create All"), [data-testid="bulk-create"]');
    this.refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh"]');

    // Modals
    this.scoreboardModal = page.locator('.scoreboard-modal, [data-testid="scoreboard-modal"]');
    this.statsModal = page.locator('.stats-modal, [data-testid="stats-modal"]');
  }

  /**
   * Navigate to home page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if user is logged in (UI-based check)
   */
  async isLoggedIn(): Promise<boolean> {
    // Check for user avatar or name
    const hasAvatar = await this.userAvatar.isVisible().catch(() => false);
    const hasName = await this.userName.isVisible().catch(() => false);
    const hasLogout = await this.logoutButton.isVisible().catch(() => false);

    return hasAvatar || hasName || hasLogout;
  }

  /**
   * Check authentication via API
   */
  async isAuthenticatedAPI(): Promise<boolean> {
    const response = await this.page.request.get('/session');
    const session = await response.json();
    return session.authenticated === true;
  }

  /**
   * Click sign in button
   */
  async clickSignIn(): Promise<void> {
    await this.signInButton.click();
  }

  /**
   * Click logout
   */
  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL('/');
  }

  /**
   * Toggle theme (light/dark)
   */
  async toggleTheme(): Promise<void> {
    await this.themeToggle.click();
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<'light' | 'dark'> {
    const html = this.page.locator('html');
    const theme = await html.getAttribute('data-theme');
    return theme === 'dark' ? 'dark' : 'light';
  }

  /**
   * Activate Swedish mode (click Heidi badge)
   */
  async activateSwedishMode(): Promise<void> {
    await this.heidiBadge.click();
    // Wait for Swedish text to appear
    await this.page.waitForSelector('text=/Logga|Svenska|Tack/i', { timeout: 5000 });
  }

  /**
   * Check if Swedish mode is active
   */
  async isSwedishModeActive(): Promise<boolean> {
    const body = this.page.locator('body');
    const hasSwedishClass = await body.evaluate((el) =>
      el.classList.contains('swedish-mode') ||
      el.getAttribute('data-swedish') === 'true'
    );
    return hasSwedishClass;
  }

  /**
   * Search for a genre
   */
  async searchGenre(query: string): Promise<void> {
    await this.genreSearchInput.fill(query);
    // Wait for filter to apply
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear genre search
   */
  async clearSearch(): Promise<void> {
    await this.genreSearchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get all visible genre names
   */
  async getVisibleGenreNames(): Promise<string[]> {
    const items = await this.genreItems.all();
    const names: string[] = [];

    for (const item of items) {
      const name = await item.locator('.genre-name, [data-testid="genre-name"]').textContent();
      if (name) names.push(name.trim());
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
   * Click on a genre by name
   */
  async selectGenre(genreName: string): Promise<void> {
    const genre = this.genreItems.filter({ hasText: genreName }).first();
    await genre.click();
  }

  /**
   * Wait for genres to load
   */
  async waitForGenresLoaded(): Promise<void> {
    // Wait for loading to disappear
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    // Wait for either genres or empty state
    await Promise.race([
      this.genreItems.first().waitFor({ state: 'visible', timeout: 30000 }),
      this.emptyStateMessage.waitFor({ state: 'visible', timeout: 30000 }),
    ]).catch(() => {});
  }

  /**
   * Create playlist for selected genre
   */
  async createPlaylist(): Promise<void> {
    await this.createPlaylistButton.click();
  }

  /**
   * Expect genre count
   */
  async expectGenreCount(count: number): Promise<void> {
    await expect(this.genreItems).toHaveCount(count);
  }

  /**
   * Expect to be on home page
   */
  async expectToBeOnHomePage(): Promise<void> {
    await expect(this.page).toHaveURL('/');
  }

  /**
   * Expect logged in state
   */
  async expectLoggedIn(): Promise<void> {
    await expect(this.signInButton).not.toBeVisible();
    // Should see logout or user info
    const hasUserIndicator = await Promise.race([
      this.userAvatar.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
      this.userName.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
      this.logoutButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
    ]);
    expect(hasUserIndicator).toBe(true);
  }

  /**
   * Expect logged out state
   */
  async expectLoggedOut(): Promise<void> {
    await expect(this.signInButton).toBeVisible();
  }
}
