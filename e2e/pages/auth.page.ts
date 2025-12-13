/**
 * Auth Page Object Model
 *
 * Handles OAuth flow interactions and auth-related pages.
 */
import { Page, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to Spotify auth endpoint
   */
  async goToSpotifyAuth(): Promise<void> {
    await this.page.goto('/auth/spotify');
  }

  /**
   * Navigate to GitHub auth endpoint
   */
  async goToGitHubAuth(): Promise<void> {
    await this.page.goto('/auth/github');
  }

  /**
   * Navigate to logout endpoint
   */
  async logout(): Promise<void> {
    await this.page.goto('/auth/logout');
    await this.page.waitForURL('/');
  }

  /**
   * Simulate OAuth callback with authorization code
   */
  async simulateSpotifyCallback(options: {
    code?: string;
    state?: string;
    error?: string;
  } = {}): Promise<void> {
    const { code = 'mock-code-123', state = 'mock-state-456', error } = options;

    if (error) {
      await this.page.goto(`/auth/spotify/callback?error=${encodeURIComponent(error)}`);
    } else {
      await this.page.goto(
        `/auth/spotify/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      );
    }
  }

  /**
   * Simulate GitHub OAuth callback
   */
  async simulateGitHubCallback(options: {
    code?: string;
    state?: string;
    error?: string;
  } = {}): Promise<void> {
    const { code = 'mock-gh-code', state = 'mock-gh-state', error } = options;

    if (error) {
      await this.page.goto(`/auth/github/callback?error=${encodeURIComponent(error)}`);
    } else {
      await this.page.goto(
        `/auth/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      );
    }
  }

  /**
   * Check if redirected to Spotify
   */
  async expectRedirectToSpotify(): Promise<void> {
    // In mock mode, might redirect to mock server or stay on callback
    await expect(this.page).toHaveURL(/accounts\.spotify\.com|localhost:3001|\/auth\/spotify/);
  }

  /**
   * Check if on error page
   */
  async expectErrorParam(errorType: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`error=${errorType}`));
  }

  /**
   * Check if successfully authenticated and on home page
   */
  async expectSuccessfulAuth(): Promise<void> {
    await expect(this.page).toHaveURL('/');
    // Should not have error param
    expect(this.page.url()).not.toContain('error=');
  }

  /**
   * Get current error from URL
   */
  async getErrorFromUrl(): Promise<string | null> {
    const url = new URL(this.page.url());
    return url.searchParams.get('error');
  }

  /**
   * Check session status via API
   */
  async getSessionStatus(): Promise<{
    authenticated: boolean;
    spotifyUser?: string;
    spotifyUserId?: string;
  }> {
    const response = await this.page.request.get('/session');
    return response.json();
  }

  /**
   * Wait for authentication to complete
   */
  async waitForAuth(expectedState: 'authenticated' | 'unauthenticated', timeout = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getSessionStatus();

      if (expectedState === 'authenticated' && status.authenticated) {
        return;
      }
      if (expectedState === 'unauthenticated' && !status.authenticated) {
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Timeout waiting for auth state: ${expectedState}`);
  }
}
