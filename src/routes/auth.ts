import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getGitHubUser,
  isUserAllowed,
} from '../lib/github';
import {
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  getCurrentUser,
  generateCodeVerifier,
  createCodeChallenge,
} from '../lib/spotify';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  generateState,
  storeState,
  verifyState,
  createOrUpdateUserStats,
  trackAnalyticsEvent,
} from '../lib/session';

// OAuth state cookie name (backup for KV eventual consistency)
const OAUTH_STATE_COOKIE = 'oauth_state';

// Helper to encode state data for cookie (base64url encoding)
function encodeStateForCookie(state: string, data: Record<string, string>): string {
  const payload = JSON.stringify({ state, data, ts: Date.now() });
  // Use base64url encoding to avoid cookie special chars
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper to decode state data from cookie
function decodeStateFromCookie(cookieValue: string): { state: string; data: Record<string, string>; ts: number } | null {
  try {
    // Restore base64 padding and decode
    const base64 = cookieValue.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as { state: string; data: Record<string, string>; ts: number };
  } catch {
    return null;
  }
}

const auth = new Hono<{ Bindings: Env }>();

// Helper to check if running in Spotify-only mode
function isSpotifyOnlyMode(env: Env): boolean {
  return env.SPOTIFY_ONLY_AUTH === 'true' || !env.GITHUB_CLIENT_ID;
}

// Helper to register/update user in the hall of fame and initialize stats
async function registerUser(
  kv: KVNamespace,
  spotifyId: string,
  spotifyName: string,
  spotifyAvatar?: string,
  githubUser?: string
): Promise<void> {
  const key = `user:${spotifyId}`;
  // PERF-011 FIX: Use cachedKV for user registration to reduce KV reads
  const existingStr = await kv.get(key); // Use direct KV here as this is infrequent and needs accuracy
  const now = new Date().toISOString();

  // Track sign-in
  await trackAnalyticsEvent(kv, 'signIn', { visitorId: spotifyId });

  if (existingStr) {
    // Update last seen
    const data = JSON.parse(existingStr) as {
      spotifyId: string;
      spotifyName: string;
      spotifyAvatar?: string;
      githubUser?: string;
      registeredAt: string;
      lastSeenAt: string;
    };
    data.lastSeenAt = now;
    data.spotifyName = spotifyName;
    if (spotifyAvatar) data.spotifyAvatar = spotifyAvatar;
    if (githubUser) data.githubUser = githubUser;
    // PERF-011 FIX: Use immediate write for user data (critical)
    await kv.put(key, JSON.stringify(data));

    // Update user stats (name/avatar might have changed) - already uses cachedKV
    await createOrUpdateUserStats(kv, spotifyId, {
      spotifyName,
      spotifyAvatar,
    });
  } else {
    // New user registration
    const registration = {
      spotifyId,
      spotifyName,
      spotifyAvatar,
      githubUser,
      registeredAt: now,
      lastSeenAt: now,
    };
    // PERF-011 FIX: Write immediately for new user registration (critical)
    await kv.put(key, JSON.stringify(registration));

    // Update user count - direct KV for accuracy
    const countStr = await kv.get('stats:user_count');
    const count = countStr ? parseInt(countStr, 10) : 0;
    await kv.put('stats:user_count', String(count + 1));

    // Add to hall of fame list (first 100 users) - direct KV (infrequent)
    if (count < 100) {
      const hofKey = `hof:${String(count + 1).padStart(3, '0')}`;
      await kv.put(hofKey, JSON.stringify({
        position: count + 1,
        spotifyId,
        spotifyName,
        spotifyAvatar,
        registeredAt: now,
      }));
    }

    // Initialize user stats for scoreboard - already uses cachedKV
    await createOrUpdateUserStats(kv, spotifyId, {
      spotifyName,
      spotifyAvatar,
    });
  }
}

// GitHub OAuth - initiate
auth.get('/github', async (c) => {
  if (isSpotifyOnlyMode(c.env)) {
    return c.redirect('/auth/spotify');
  }

  const state = generateState();
  const stateData = { provider: 'github' };

  // Store state in KV (primary)
  await storeState(c.env.SESSIONS, state, stateData);

  // Also store in cookie as backup for KV eventual consistency
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  setCookie(c, OAUTH_STATE_COOKIE, encodeStateForCookie(state, stateData), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });

  const redirectUri = new URL('/auth/github/callback', c.req.url).toString();
  const clientId = c.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: 'GitHub OAuth not configured' }, 500);
  }
  const url = getGitHubAuthUrl(clientId, redirectUri, state);

  return c.redirect(url);
});

// GitHub OAuth - callback
auth.get('/github/callback', async (c) => {
  if (isSpotifyOnlyMode(c.env)) {
    return c.redirect('/');
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'GitHub OAuth denied' });
    return c.redirect('/?error=github_denied');
  }

  if (!code || !state) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'Invalid OAuth request' });
    return c.redirect('/?error=invalid_request');
  }

  // Try KV first, then fall back to cookie for eventual consistency issues
  let stateData = await verifyState(c.env.SESSIONS, state);

  // If KV lookup failed, try the cookie backup
  if (!stateData) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const cookieValue = getCookie(c, OAUTH_STATE_COOKIE);
    if (cookieValue) {
      const cookieData = decodeStateFromCookie(cookieValue);
      if (cookieData && cookieData.state === state && Date.now() - cookieData.ts < 600000) {
        stateData = cookieData.data;
        console.log('OAuth state recovered from cookie (KV eventual consistency fallback)');
      }
    }
  }

  // Always clean up the cookie
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });

  if (!stateData || stateData.provider !== 'github') {
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'Invalid OAuth state' });
    return c.redirect('/?error=invalid_state');
  }

  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.redirect('/?error=auth_failed');
  }

  try {
    const accessToken = await exchangeGitHubCode(code, clientId, clientSecret);

    const user = await getGitHubUser(accessToken);

    if (!isUserAllowed(user.login, c.env.ALLOWED_GITHUB_USERS || '')) {
      await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: `User not allowed: ${user.login}` });
      return c.redirect('/?error=not_allowed');
    }

    await createSession(c, {
      githubUser: user.login,
      githubAvatar: user.avatar_url,
    });

    return c.redirect('/');
  } catch (err) {
    console.error('GitHub auth error:', err);
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: `GitHub auth failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    return c.redirect('/?error=auth_failed');
  }
});

// Spotify OAuth - initiate (works for both modes)
auth.get('/spotify', async (c) => {
  const spotifyOnly = isSpotifyOnlyMode(c.env);

  // In GitHub mode, require session first
  if (!spotifyOnly) {
    const session = await getSession(c);
    if (!session) {
      return c.redirect('/?error=not_logged_in');
    }
  }

  // Generate PKCE code verifier and challenge for enhanced security
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);

  const state = generateState();
  const stateData = {
    provider: 'spotify',
    spotifyOnly: spotifyOnly ? 'true' : 'false',
    codeVerifier, // Store verifier to use in callback
  };

  // Store state in KV (primary)
  await storeState(c.env.SESSIONS, state, stateData);

  // Also store in cookie as backup for KV eventual consistency across edge locations
  // Cookie travels with the user's browser, ensuring state is always available
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  setCookie(c, OAUTH_STATE_COOKIE, encodeStateForCookie(state, stateData), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes (same as KV TTL)
    path: '/',
  });

  const redirectUri = new URL('/auth/spotify/callback', c.req.url).toString();
  const url = getSpotifyAuthUrl(c.env.SPOTIFY_CLIENT_ID, redirectUri, state, codeChallenge);

  return c.redirect(url);
});

// Spotify OAuth - callback
auth.get('/spotify/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'Spotify OAuth denied' });
    return c.redirect('/?error=spotify_denied');
  }

  if (!code || !state) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'Invalid Spotify OAuth request' });
    return c.redirect('/?error=invalid_request');
  }

  // Try KV first, then fall back to cookie for eventual consistency issues
  let stateData = await verifyState(c.env.SESSIONS, state);

  // If KV lookup failed, try the cookie backup
  if (!stateData) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const cookieValue = getCookie(c, OAUTH_STATE_COOKIE);
    if (cookieValue) {
      const cookieData = decodeStateFromCookie(cookieValue);
      // Verify the state matches and cookie isn't too old (10 min max)
      if (cookieData && cookieData.state === state && Date.now() - cookieData.ts < 600000) {
        stateData = cookieData.data;
        console.log('OAuth state recovered from cookie (KV eventual consistency fallback)');
      }
    }
  }

  // Always clean up the cookie
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });

  if (!stateData || stateData.provider !== 'spotify') {
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'Invalid Spotify OAuth state' });
    return c.redirect('/?error=invalid_state');
  }

  const spotifyOnly = stateData.spotifyOnly === 'true';
  const codeVerifier = stateData.codeVerifier; // Retrieve PKCE verifier

  // In GitHub mode, require existing session
  const session = await getSession(c);
  if (!spotifyOnly && !session) {
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: 'Not logged in (GitHub mode)' });
    return c.redirect('/?error=not_logged_in');
  }

  try {
    const redirectUri = new URL('/auth/spotify/callback', c.req.url).toString();
    const tokens = await exchangeSpotifyCode(
      code,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      redirectUri,
      codeVerifier // Pass PKCE verifier for token exchange
    );

    // Get Spotify user info
    const spotifyUser = await getCurrentUser(tokens.access_token);

    if (spotifyOnly) {
      // Create new session with Spotify as primary identity
      await createSession(c, {
        spotifyUser: spotifyUser.display_name,
        spotifyUserId: spotifyUser.id,
        spotifyAvatar: spotifyUser.images?.[0]?.url,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
      });
    } else {
      // Update existing session with Spotify tokens
      await updateSession(c, {
        spotifyUser: spotifyUser.display_name,
        spotifyUserId: spotifyUser.id,
        spotifyAvatar: spotifyUser.images?.[0]?.url,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
      });
    }

    // Register user in hall of fame
    await registerUser(
      c.env.SESSIONS,
      spotifyUser.id,
      spotifyUser.display_name,
      spotifyUser.images?.[0]?.url,
      session?.githubUser
    );

    return c.redirect('/');
  } catch (err) {
    console.error('Spotify auth error:', err);
    await trackAnalyticsEvent(c.env.SESSIONS, 'authFailure', { message: `Spotify auth failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    return c.redirect('/?error=spotify_auth_failed');
  }
});

// Logout
auth.get('/logout', async (c) => {
  await deleteSession(c);
  return c.redirect('/');
});

export default auth;
