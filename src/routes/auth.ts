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

// GitHub OAuth - initiate
auth.get('/github', async (c) => {
  const state = generateState();
  await storeState(c.env.SESSIONS, state, { provider: 'github' });

  const redirectUri = new URL('/auth/github/callback', c.req.url).toString();
  const url = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID, redirectUri, state);

  return c.redirect(url);
});

// GitHub OAuth - callback
auth.get('/github/callback', async (c) => {
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
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET
    );

    const user = await getGitHubUser(accessToken);

    if (!isUserAllowed(user.login, c.env.ALLOWED_GITHUB_USERS)) {
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

// Spotify OAuth - initiate
auth.get('/spotify', async (c) => {
  const session = await getSession(c);
  if (!session) {
    return c.redirect('/?error=not_logged_in');
  }

  const state = generateState();
  await storeState(c.env.SESSIONS, state, { provider: 'spotify' });

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

  const session = await getSession(c);
  if (!session) {
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

    await updateSession(c, {
      spotifyAccessToken: tokens.access_token,
      spotifyRefreshToken: tokens.refresh_token,
      spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
    });

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
