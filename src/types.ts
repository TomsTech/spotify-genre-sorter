// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Env {
  SESSIONS: KVNamespace;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  ALLOWED_GITHUB_USERS?: string;
  SPOTIFY_ONLY_AUTH?: string; // "true" to skip GitHub auth
  BETTERSTACK_LOG_TOKEN?: string; // BetterStack Logs API token
  E2E_TEST_MODE?: string; // "true" to skip rate limiting in E2E tests
  ENVIRONMENT?: string; // "production", "staging", or "development" - used for safety guards
  ADMIN_USERS?: string; // Comma-separated list of admin usernames (GitHub or Spotify)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface UserRegistration {
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar?: string;
  githubUser?: string;
  registeredAt: string;
  lastSeenAt: string;
}
