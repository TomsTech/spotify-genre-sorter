/**
 * Wait Helpers for E2E Tests
 *
 * Custom wait utilities for common async operations.
 */
import { Page, expect } from '@playwright/test';

/**
 * Wait for network to be idle (no pending requests)
 */
export async function waitForNetworkIdle(page: Page, timeout = 30000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for a specific API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 30000
): Promise<Response> {
  const response = await page.waitForResponse(
    (res) => {
      const url = res.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
  return response;
}

/**
 * Wait for element to have specific text
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string | RegExp,
  timeout = 10000
): Promise<void> {
  const locator = page.locator(selector);
  await expect(locator).toHaveText(text, { timeout });
}

/**
 * Wait for element to be visible and stable
 */
export async function waitForStable(
  page: Page,
  selector: string,
  timeout = 10000
): Promise<void> {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible', timeout });
  // Wait a bit for animations to settle
  await page.waitForTimeout(100);
}

/**
 * Wait for loading indicators to disappear
 */
export async function waitForLoadingComplete(page: Page, timeout = 30000): Promise<void> {
  const loadingSelectors = [
    '.loading',
    '[data-loading="true"]',
    '.spinner',
    '.skeleton',
    '[aria-busy="true"]',
  ];

  for (const selector of loadingSelectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      await locator.first().waitFor({ state: 'hidden', timeout }).catch(() => {});
    }
  }
}

/**
 * Wait for toast/notification to appear and optionally disappear
 */
export async function waitForToast(
  page: Page,
  options: {
    text?: string | RegExp;
    waitForDismiss?: boolean;
    timeout?: number;
  } = {}
): Promise<void> {
  const { text, waitForDismiss = false, timeout = 10000 } = options;

  const toastSelectors = [
    '.toast',
    '.notification',
    '[role="alert"]',
    '.success-message',
    '.error-message',
  ];

  let found = false;
  for (const selector of toastSelectors) {
    const locator = page.locator(selector);
    try {
      await locator.first().waitFor({ state: 'visible', timeout: 2000 });
      if (text) {
        await expect(locator.first()).toHaveText(text, { timeout: 2000 });
      }
      found = true;

      if (waitForDismiss) {
        await locator.first().waitFor({ state: 'hidden', timeout });
      }
      break;
    } catch {
      continue;
    }
  }

  if (!found) {
    throw new Error('Toast notification not found');
  }
}

/**
 * Retry an action until it succeeds or times out
 */
export async function retry<T>(
  action: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, timeout = 30000 } = options;
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (Date.now() - startTime > timeout) {
      throw lastError || new Error('Retry timeout');
    }

    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Poll until a condition is true
 */
export async function pollUntil(
  condition: () => Promise<boolean>,
  options: {
    intervalMs?: number;
    timeout?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { intervalMs = 500, timeout = 30000, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timeout: ${message}`);
}
