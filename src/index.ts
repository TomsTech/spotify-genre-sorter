import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth';
import api from './routes/api';
import { getSession } from './lib/session';
import { getHtml } from './generated/frontend';

// App version - increment on each deployment
const APP_VERSION = '1.4.0';
const GITHUB_REPO = 'TomsTech/spotify-genre-sorter';

const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

// Security headers middleware - fixes Google Safe Browsing warnings
app.use('*', async (c, next) => {
  await next();
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://flagcdn.com https://i.scdn.co https://avatars.githubusercontent.com https://img.shields.io",
    "connect-src 'self' https://api.spotify.com https://ko-fi.com https://cloudflareinsights.com",
    "frame-ancestors 'none'",
  ].join('; '));
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Health check - FIRST route, no middleware dependency
// Enhanced with component status for monitoring
app.get('/health', async (c) => {
  const detailed = c.req.query('detailed') === 'true';

  // Basic health check (fast)
  if (!detailed) {
    return c.json({ status: 'ok', version: APP_VERSION });
  }

  // Detailed health check with component status
  const components: Record<string, { status: string; latency?: number }> = {};

  // Check KV availability
  const kvStart = Date.now();
  try {
    await c.env.SESSIONS.get('health_check_probe');
    components.kv = { status: 'ok', latency: Date.now() - kvStart };
  } catch {
    components.kv = { status: 'error', latency: Date.now() - kvStart };
  }

  // Check secrets configured
  const secretsConfigured = !!(
    c.env.SPOTIFY_CLIENT_ID &&
    c.env.SPOTIFY_CLIENT_SECRET
  );
  components.secrets = { status: secretsConfigured ? 'ok' : 'missing' };

  // Overall status
  const allOk = Object.values(components).every(c => c.status === 'ok');

  return c.json({
    status: allOk ? 'ok' : 'degraded',
    version: APP_VERSION,
    components,
    timestamp: new Date().toISOString(),
  });
});

// Middleware (after health check so it doesn't block health)
app.use('*', logger());

// CORS - restrict to same-origin only (no cross-origin API access)
// This prevents malicious sites from making requests on behalf of users
app.use('/api/*', cors({
  origin: (origin, c) => {
    // Allow same-origin requests (origin will be null for same-origin)
    // or match the request host
    const host = c.req.header('host');
    if (!origin || origin.includes(host || '')) {
      return origin || '*';
    }
    return null; // Reject cross-origin
  },
  credentials: true,
}));

// Mount routes
app.route('/auth', auth);
app.route('/api', api);

// Setup check - verifies required secrets are configured
app.get('/setup', (c) => {
  const missing: string[] = [];
  const spotifyOnly = c.env.SPOTIFY_ONLY_AUTH === 'true' || !c.env.GITHUB_CLIENT_ID;

  // GitHub secrets only required if not in Spotify-only mode
  if (!spotifyOnly) {
    if (!c.env.GITHUB_CLIENT_ID) missing.push('GITHUB_CLIENT_ID');
    if (!c.env.GITHUB_CLIENT_SECRET) missing.push('GITHUB_CLIENT_SECRET');
  }

  // Spotify secrets always required
  if (!c.env.SPOTIFY_CLIENT_ID) missing.push('SPOTIFY_CLIENT_ID');
  if (!c.env.SPOTIFY_CLIENT_SECRET) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!c.env.SESSIONS) missing.push('SESSIONS (KV namespace)');

  if (missing.length > 0) {
    return c.json({
      configured: false,
      missing,
      authMode: spotifyOnly ? 'spotify-only' : 'github+spotify',
      message: 'Set secrets via: npx wrangler secret put SECRET_NAME'
    }, 503);
  }
  return c.json({
    configured: true,
    authMode: spotifyOnly ? 'spotify-only' : 'github+spotify',
  });
});

// Session status endpoint
app.get('/session', async (c) => {
  // Check if KV is configured
  if (!c.env.SESSIONS) {
    return c.json({ authenticated: false, error: 'KV not configured' });
  }

  const spotifyOnly = c.env.SPOTIFY_ONLY_AUTH === 'true' || !c.env.GITHUB_CLIENT_ID;

  try {
    const session = await getSession(c);
    if (!session) {
      return c.json({ authenticated: false, spotifyOnly });
    }

    // In Spotify-only mode, user is authenticated once Spotify is connected
    const isAuthenticated = spotifyOnly
      ? !!session.spotifyAccessToken
      : !!session.githubUser;

    return c.json({
      authenticated: isAuthenticated,
      spotifyOnly,
      // User info (prefer Spotify in spotify-only mode)
      user: spotifyOnly ? session.spotifyUser : session.githubUser,
      avatar: spotifyOnly ? session.spotifyAvatar : session.githubAvatar,
      // Legacy fields for compatibility
      githubUser: session.githubUser,
      githubAvatar: session.githubAvatar,
      spotifyUser: session.spotifyUser,
      spotifyConnected: !!session.spotifyAccessToken,
    });
  } catch {
    return c.json({ authenticated: false, spotifyOnly, error: 'Session error' });
  }
});

// Stats endpoint - user count and hall of fame (public, no auth)
app.get('/stats', async (c) => {
  try {
    const countStr = await c.env.SESSIONS.get('stats:user_count');
    const count = countStr ? parseInt(countStr, 10) : 0;

    // Get hall of fame (first 10 users for display)
    const hallOfFame: { position: number; spotifyName: string; registeredAt: string }[] = [];
    for (let i = 1; i <= Math.min(count, 10); i++) {
      const hofKey = `hof:${String(i).padStart(3, '0')}`;
      const data = await c.env.SESSIONS.get(hofKey);
      if (data) {
        const entry = JSON.parse(data) as { position: number; spotifyName: string; registeredAt: string };
        hallOfFame.push({
          position: entry.position,
          spotifyName: entry.spotifyName,
          registeredAt: entry.registeredAt,
        });
      }
    }

    return c.json({
      userCount: count,
      launchDate: '2025-11-28',
      hallOfFame,
    });
  } catch {
    return c.json({ userCount: 0, hallOfFame: [] });
  }
});

// Deployment status endpoint - for the deployment monitor widget
app.get('/deploy-status', async (c) => {
  try {
    // Fetch latest workflow run from GitHub Actions
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/deploy.yml/runs?per_page=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Spotify-Genre-Sorter',
        },
      }
    );

    if (!response.ok) {
      // If GitHub API fails, return just the version info
      return c.json({
        version: APP_VERSION,
        deployment: null,
        error: 'Could not fetch deployment status',
      });
    }

    const data: {
      workflow_runs: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        created_at: string;
        updated_at: string;
        head_sha: string;
        actor: {
          login: string;
          avatar_url: string;
        };
      }>;
    } = await response.json();

    const latestRun = data.workflow_runs?.[0];

    if (!latestRun) {
      return c.json({
        version: APP_VERSION,
        deployment: null,
      });
    }

    // If deployment is in progress, try to get current step
    let currentStep = null;
    if (latestRun.status === 'in_progress') {
      try {
        const jobsResponse = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${latestRun.id}/jobs`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Spotify-Genre-Sorter',
            },
          }
        );
        if (jobsResponse.ok) {
          const jobsData: {
            jobs: Array<{
              name: string;
              status: string;
              steps?: Array<{ name: string; status: string }>;
            }>;
          } = await jobsResponse.json();
          const activeJob = jobsData.jobs?.find(j => j.status === 'in_progress');
          const activeStep = activeJob?.steps?.find(s => s.status === 'in_progress');
          currentStep = activeStep?.name || activeJob?.name || 'Deploying...';
        }
      } catch {
        // Ignore errors fetching job details
      }
    }

    return c.json({
      version: APP_VERSION,
      deployment: {
        id: latestRun.id,
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        startedAt: latestRun.created_at,
        updatedAt: latestRun.updated_at,
        commit: latestRun.head_sha.substring(0, 7),
        author: {
          name: latestRun.actor.login,
          avatar: latestRun.actor.avatar_url,
        },
        currentStep,
      },
    });
  } catch {
    return c.json({
      version: APP_VERSION,
      deployment: null,
      error: 'Failed to check deployment status',
    });
  }
});

// Swedish-themed favicon (Spotify logo in Swedish colours)
app.get('/favicon.svg', (c) => {
  c.header('Content-Type', 'image/svg+xml');
  return c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="swedish" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#006AA7"/>
      <stop offset="50%" style="stop-color:#FECC00"/>
      <stop offset="100%" style="stop-color:#006AA7"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="10" fill="url(#swedish)"/>
  <path fill="#fff" d="M16.586 16.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
</svg>`);
});

// PNG favicon (Swedish Spotify logo from favicon_io)
app.get('/favicon.png', (c) => {
  c.header('Content-Type', 'image/png');
  c.header('Cache-Control', 'public, max-age=31536000');
  // Base64 decoded at runtime - Swedish-themed Spotify logo
  const base64 = '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';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return c.body(bytes);
});

// ICO favicon redirect
app.get('/favicon.ico', (c) => {
  return c.redirect('/favicon.png');
});

// Main UI
app.get('/', (c) => {
  return c.html(getHtml());
});


export default app;
