import { describe, expectTypeOf, test } from 'vitest';
import type { Env } from '../src/types';

describe('Types', () => {
  test('Env should match expected configuration fields', () => {
    // Assert that Env contains the exact expected properties.
    // If someone changes types.ts and removes or adds something, this will throw an error.
    expectTypeOf<Env>().toMatchTypeOf<{
      SESSIONS: KVNamespace;
      GITHUB_CLIENT_ID?: string;
      GITHUB_CLIENT_SECRET?: string;
      SPOTIFY_CLIENT_ID: string;
      SPOTIFY_CLIENT_SECRET: string;
      ALLOWED_GITHUB_USERS?: string;
      SPOTIFY_ONLY_AUTH?: string;
      BETTERSTACK_LOG_TOKEN?: string;
      E2E_TEST_MODE?: string;
      ENVIRONMENT?: string;
      ADMIN_USERS?: string;
    }>();
  });
});
