import { Hono } from 'hono';
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
} from '../lib/spotify';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  generateState,
  storeState,
  verifyState,
} from '../lib/session';

const auth = new Hono<{ Bindings: Env }>();

// Helper to check if running in Spotify-only mode
function isSpotifyOnlyMode(env: Env): boolean {
  return env.SPOTIFY_ONLY_AUTH === 'true' || !env.GITHUB_CLIENT_ID;
}

// Helper to register/update user in the hall of fame
async function registerUser(
  kv: KVNamespace,
  spotifyId: string,
  spotifyName: string,
  spotifyAvatar?: string,
  githubUser?: string
): Promise<void> {
  const key = `user:${spotifyId}`;
  const existing = await kv.get(key);
  const now = new Date().toISOString();

  if (existing) {
    // Update last seen
    const data = JSON.parse(existing);
    data.lastSeenAt = now;
    data.spotifyName = spotifyName;
    if (spotifyAvatar) data.spotifyAvatar = spotifyAvatar;
    if (githubUser) data.githubUser = githubUser;
    await kv.put(key, JSON.stringify(data));
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
    await kv.put(key, JSON.stringify(registration));

    // Update user count
    const countStr = await kv.get('stats:user_count');
    const count = countStr ? parseInt(countStr, 10) : 0;
    await kv.put('stats:user_count', String(count + 1));

    // Add to hall of fame list (first 100 users)
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
  }
}

// GitHub OAuth - initiate
auth.get('/github', async (c) => {
  if (isSpotifyOnlyMode(c.env)) {
    return c.redirect('/auth/spotify');
  }

  const state = generateState();
  await storeState(c.env.SESSIONS, state, { provider: 'github' });

  const redirectUri = new URL('/auth/github/callback', c.req.url).toString();
  const url = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID!, redirectUri, state);

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
    return c.redirect('/?error=github_denied');
  }

  if (!code || !state) {
    return c.redirect('/?error=invalid_request');
  }

  const stateData = await verifyState(c.env.SESSIONS, state);
  if (!stateData || stateData.provider !== 'github') {
    return c.redirect('/?error=invalid_state');
  }

  try {
    const accessToken = await exchangeGitHubCode(
      code,
      c.env.GITHUB_CLIENT_ID!,
      c.env.GITHUB_CLIENT_SECRET!
    );

    const user = await getGitHubUser(accessToken);

    if (!isUserAllowed(user.login, c.env.ALLOWED_GITHUB_USERS || '')) {
      return c.redirect('/?error=not_allowed');
    }

    await createSession(c, {
      githubUser: user.login,
      githubAvatar: user.avatar_url,
    });

    return c.redirect('/');
  } catch (err) {
    console.error('GitHub auth error:', err);
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

  const state = generateState();
  await storeState(c.env.SESSIONS, state, {
    provider: 'spotify',
    spotifyOnly: spotifyOnly ? 'true' : 'false',
  });

  const redirectUri = new URL('/auth/spotify/callback', c.req.url).toString();
  const url = getSpotifyAuthUrl(c.env.SPOTIFY_CLIENT_ID, redirectUri, state);

  return c.redirect(url);
});

// Spotify OAuth - callback
auth.get('/spotify/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect('/?error=spotify_denied');
  }

  if (!code || !state) {
    return c.redirect('/?error=invalid_request');
  }

  const stateData = await verifyState(c.env.SESSIONS, state);
  if (!stateData || stateData.provider !== 'spotify') {
    return c.redirect('/?error=invalid_state');
  }

  const spotifyOnly = stateData.spotifyOnly === 'true';

  // In GitHub mode, require existing session
  let session = await getSession(c);
  if (!spotifyOnly && !session) {
    return c.redirect('/?error=not_logged_in');
  }

  try {
    const redirectUri = new URL('/auth/spotify/callback', c.req.url).toString();
    const tokens = await exchangeSpotifyCode(
      code,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      redirectUri
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
    return c.redirect('/?error=spotify_auth_failed');
  }
});

// Logout
auth.get('/logout', async (c) => {
  await deleteSession(c);
  return c.redirect('/');
});

export default auth;
