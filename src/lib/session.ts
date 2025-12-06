import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export interface Session {
  githubUser?: string;
  githubAvatar?: string;
  spotifyUser?: string;
  spotifyUserId?: string;
  spotifyAvatar?: string;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
  spotifyExpiresAt?: number;
}

const SESSION_COOKIE = 'session_id';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function createSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  session: Session
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL }
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL,
    path: '/',
  });

  return sessionId;
}

export async function getSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>
): Promise<Session | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  const data = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const session: Session = JSON.parse(data);
  return session;
}

export async function updateSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  updates: Partial<Session>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return;

  const existing = await getSession(c);
  if (!existing) return;

  const updated = { ...existing, ...updates };
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(updated),
    { expirationTtl: SESSION_TTL }
  );
}

export async function deleteSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function generateState(): string {
  return crypto.randomUUID();
}

export async function storeState(
  kv: KVNamespace,
  state: string,
  data: Record<string, string>
): Promise<void> {
  await kv.put(`state:${state}`, JSON.stringify(data), { expirationTtl: 600 });
}

export async function verifyState(
  kv: KVNamespace,
  state: string
): Promise<Record<string, string> | null> {
  const data = await kv.get(`state:${state}`);
  if (!data) return null;
  await kv.delete(`state:${state}`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed: Record<string, string> = JSON.parse(data);
  return parsed;
}

// ================== User Statistics ==================

export interface UserStats {
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar?: string;
  totalGenresDiscovered: number;
  totalArtistsDiscovered: number;
  totalTracksAnalysed: number;
  playlistsCreated: number;
  firstSeen: string;
  lastActive: string;
  createdPlaylistIds: string[];
}

export async function getUserStats(
  kv: KVNamespace,
  spotifyId: string
): Promise<UserStats | null> {
  const data = await kv.get(`user_stats:${spotifyId}`);
  if (!data) return null;
  return JSON.parse(data) as UserStats;
}

export async function createOrUpdateUserStats(
  kv: KVNamespace,
  spotifyId: string,
  updates: Partial<UserStats>
): Promise<UserStats> {
  const existing = await getUserStats(kv, spotifyId);
  const now = new Date().toISOString();

  if (existing) {
    const updated: UserStats = {
      ...existing,
      ...updates,
      lastActive: now,
    };
    await kv.put(`user_stats:${spotifyId}`, JSON.stringify(updated));
    return updated;
  } else {
    const newStats: UserStats = {
      spotifyId,
      spotifyName: updates.spotifyName || 'Unknown',
      spotifyAvatar: updates.spotifyAvatar,
      totalGenresDiscovered: updates.totalGenresDiscovered || 0,
      totalArtistsDiscovered: updates.totalArtistsDiscovered || 0,
      totalTracksAnalysed: updates.totalTracksAnalysed || 0,
      playlistsCreated: updates.playlistsCreated || 0,
      firstSeen: now,
      lastActive: now,
      createdPlaylistIds: updates.createdPlaylistIds || [],
    };
    await kv.put(`user_stats:${spotifyId}`, JSON.stringify(newStats));
    return newStats;
  }
}

export async function incrementUserStats(
  kv: KVNamespace,
  spotifyId: string,
  field: 'totalGenresDiscovered' | 'totalArtistsDiscovered' | 'totalTracksAnalysed' | 'playlistsCreated',
  amount: number = 1
): Promise<void> {
  const existing = await getUserStats(kv, spotifyId);
  if (!existing) return;

  existing[field] += amount;
  existing.lastActive = new Date().toISOString();
  await kv.put(`user_stats:${spotifyId}`, JSON.stringify(existing));
}

export async function addPlaylistToUser(
  kv: KVNamespace,
  spotifyId: string,
  playlistId: string
): Promise<void> {
  const existing = await getUserStats(kv, spotifyId);
  if (!existing) return;

  if (!existing.createdPlaylistIds.includes(playlistId)) {
    existing.createdPlaylistIds.push(playlistId);
    existing.playlistsCreated += 1;
    existing.lastActive = new Date().toISOString();
    await kv.put(`user_stats:${spotifyId}`, JSON.stringify(existing));
  }
}

// ================== Recent Playlists Feed ==================

export interface RecentPlaylist {
  playlistId: string;
  playlistName: string;
  genre: string;
  trackCount: number;
  createdBy: {
    spotifyId: string;
    spotifyName: string;
    spotifyAvatar?: string;
  };
  createdAt: string;
  spotifyUrl: string;
}

const RECENT_PLAYLISTS_KEY = 'recent_playlists';
const MAX_RECENT_PLAYLISTS = 20;

export async function getRecentPlaylists(kv: KVNamespace): Promise<RecentPlaylist[]> {
  const data = await kv.get(RECENT_PLAYLISTS_KEY);
  if (!data) return [];
  return JSON.parse(data) as RecentPlaylist[];
}

export async function addRecentPlaylist(
  kv: KVNamespace,
  playlist: RecentPlaylist
): Promise<void> {
  const existing = await getRecentPlaylists(kv);

  // Add to front of array
  existing.unshift(playlist);

  // Keep only max entries
  const trimmed = existing.slice(0, MAX_RECENT_PLAYLISTS);

  await kv.put(RECENT_PLAYLISTS_KEY, JSON.stringify(trimmed));
}

// ================== Scoreboard ==================

export interface ScoreboardEntry {
  rank: number;
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar?: string;
  count: number;
}

export interface Scoreboard {
  byGenres: ScoreboardEntry[];
  byArtists: ScoreboardEntry[];
  byTracks: ScoreboardEntry[];
  byPlaylists: ScoreboardEntry[];
  totalUsers: number;
  updatedAt: string;
}

const SCOREBOARD_CACHE_KEY = 'scoreboard_cache';
const SCOREBOARD_CACHE_TTL = 3600; // 1 hour (was 5 min - hitting KV write limits)

const LEADERBOARD_CACHE_KEY = 'leaderboard_cache';
const LEADERBOARD_CACHE_TTL = 900; // 15 minutes - reduces 112+ KV ops to 1 read

export async function getScoreboard(kv: KVNamespace): Promise<Scoreboard | null> {
  const cached = await kv.get(SCOREBOARD_CACHE_KEY);
  if (cached) {
    const data = JSON.parse(cached) as Scoreboard;
    // Check if cache is still valid
    const cacheTime = new Date(data.updatedAt).getTime();
    if (Date.now() - cacheTime < SCOREBOARD_CACHE_TTL * 1000) {
      return data;
    }
  }
  return null;
}

export async function buildScoreboard(kv: KVNamespace): Promise<Scoreboard> {
  // List all user_stats keys
  const list = await kv.list({ prefix: 'user_stats:' });
  const allStats: UserStats[] = [];

  for (const key of list.keys) {
    const data = await kv.get(key.name);
    if (data) {
      allStats.push(JSON.parse(data) as UserStats);
    }
  }

  // Sort and rank for each category
  const makeRanking = (
    stats: UserStats[],
    field: keyof Pick<UserStats, 'totalGenresDiscovered' | 'totalArtistsDiscovered' | 'totalTracksAnalysed' | 'playlistsCreated'>
  ): ScoreboardEntry[] => {
    return stats
      .filter(s => s[field] > 0)
      .sort((a, b) => b[field] - a[field])
      .slice(0, 20)
      .map((s, i) => ({
        rank: i + 1,
        spotifyId: s.spotifyId,
        spotifyName: s.spotifyName,
        spotifyAvatar: s.spotifyAvatar,
        count: s[field],
      }));
  };

  const scoreboard: Scoreboard = {
    byGenres: makeRanking(allStats, 'totalGenresDiscovered'),
    byArtists: makeRanking(allStats, 'totalArtistsDiscovered'),
    byTracks: makeRanking(allStats, 'totalTracksAnalysed'),
    byPlaylists: makeRanking(allStats, 'playlistsCreated'),
    totalUsers: allStats.length,
    updatedAt: new Date().toISOString(),
  };

  // Cache the scoreboard
  await kv.put(SCOREBOARD_CACHE_KEY, JSON.stringify(scoreboard), { expirationTtl: SCOREBOARD_CACHE_TTL });

  return scoreboard;
}

// ================== Leaderboard Caching ==================

export interface LeaderboardData {
  pioneers: Array<{
    position: number;
    spotifyId: string;
    spotifyName: string;
    spotifyAvatar?: string;
    registeredAt: string;
  }>;
  newUsers: Array<{
    spotifyId: string;
    spotifyName: string;
    spotifyAvatar?: string;
    registeredAt: string;
  }>;
  totalUsers: number;
  updatedAt: string;
}

export async function getLeaderboard(kv: KVNamespace): Promise<LeaderboardData | null> {
  const cached = await kv.get(LEADERBOARD_CACHE_KEY);
  if (cached) {
    const data = JSON.parse(cached) as LeaderboardData;
    // Check if cache is still valid
    const cacheTime = new Date(data.updatedAt).getTime();
    if (Date.now() - cacheTime < LEADERBOARD_CACHE_TTL * 1000) {
      return data;
    }
  }
  return null;
}

export async function buildLeaderboard(kv: KVNamespace): Promise<LeaderboardData> {
  // Get pioneers (first 10 users)
  const pioneers: LeaderboardData['pioneers'] = [];
  for (let i = 1; i <= 10; i++) {
    const hofKey = `hof:${String(i).padStart(3, '0')}`;
    const data = await kv.get(hofKey);
    if (data) {
      pioneers.push(JSON.parse(data));
    }
  }

  // Get recent users (last 10 registered)
  const userList = await kv.list({ prefix: 'user:' });
  const recentUsers: LeaderboardData['newUsers'] = [];

  // Only fetch up to 50 users to limit KV reads
  for (const key of userList.keys.slice(0, 50)) {
    const data = await kv.get(key.name);
    if (data) {
      recentUsers.push(JSON.parse(data));
    }
  }

  // Sort by registeredAt descending and take last 10
  recentUsers.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

  // Get total user count
  const countStr = await kv.get('stats:user_count');
  const totalUsers = countStr ? parseInt(countStr, 10) : 0;

  const leaderboard: LeaderboardData = {
    pioneers,
    newUsers: recentUsers.slice(0, 10),
    totalUsers,
    updatedAt: new Date().toISOString(),
  };

  // Cache the leaderboard
  await kv.put(LEADERBOARD_CACHE_KEY, JSON.stringify(leaderboard), { expirationTtl: LEADERBOARD_CACHE_TTL });

  return leaderboard;
}

// ================== Analytics Tracking ==================

const ANALYTICS_KEY = 'analytics:daily';
const ANALYTICS_TTL = 86400 * 7; // 7 days

export interface AnalyticsData {
  date: string;
  pageViews: number;
  uniqueVisitors: string[];
  signIns: number;
  authFailures: number;
  errors: { message: string; path: string; timestamp: string }[];
  libraryScans: number;
  playlistsCreated: number;
  totalTracksAnalysed: number;
  kvErrors: number;
  // KV usage tracking
  kvReads: number;
  kvWrites: number;
  kvDeletes: number;
}

export interface AnalyticsSummary {
  today: AnalyticsData;
  last7Days: {
    pageViews: number;
    uniqueVisitors: number;
    signIns: number;
    authFailures: number;
    errors: number;
    libraryScans: number;
    playlistsCreated: number;
  };
  recentErrors: { message: string; path: string; timestamp: string }[];
}

function getDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

async function getDailyAnalytics(kv: KVNamespace): Promise<AnalyticsData> {
  const dateKey = getDateKey();
  const key = `${ANALYTICS_KEY}:${dateKey}`;
  const existing = await kv.get(key);

  if (existing) {
    const data = JSON.parse(existing) as AnalyticsData;
    // Ensure new fields exist (backwards compatibility)
    data.kvReads = data.kvReads || 0;
    data.kvWrites = data.kvWrites || 0;
    data.kvDeletes = data.kvDeletes || 0;
    return data;
  }

  return {
    date: dateKey,
    pageViews: 0,
    uniqueVisitors: [],
    signIns: 0,
    authFailures: 0,
    errors: [],
    libraryScans: 0,
    playlistsCreated: 0,
    totalTracksAnalysed: 0,
    kvErrors: 0,
    kvReads: 0,
    kvWrites: 0,
    kvDeletes: 0,
  };
}

async function saveDailyAnalytics(kv: KVNamespace, data: AnalyticsData): Promise<void> {
  const key = `${ANALYTICS_KEY}:${data.date}`;
  await kv.put(key, JSON.stringify(data), { expirationTtl: ANALYTICS_TTL });
}

// Analytics sampling rate - only persist 1 in N events to reduce KV writes
// Errors always persist (critical), other events are sampled
const ANALYTICS_SAMPLE_RATE = 10; // 1 in 10 events = 90% reduction in writes

export async function trackAnalyticsEvent(
  kv: KVNamespace,
  eventType: 'pageView' | 'signIn' | 'authFailure' | 'error' | 'libraryScan' | 'playlistCreated' | 'kvError',
  metadata?: { message?: string; path?: string; timestamp?: string; visitorId?: string; tracksCount?: number; count?: number }
): Promise<void> {
  try {
    // Errors always persist - they're critical for debugging
    // Other events are sampled to reduce KV writes by ~90%
    const shouldPersist = eventType === 'error' || Math.random() < (1 / ANALYTICS_SAMPLE_RATE);
    if (!shouldPersist) return;

    const analytics = await getDailyAnalytics(kv);
    // Scale up sampled events to approximate true count
    const incrementBy = (metadata?.count || 1) * (eventType === 'error' ? 1 : ANALYTICS_SAMPLE_RATE);

    switch (eventType) {
      case 'pageView':
        analytics.pageViews += incrementBy;
        if (metadata?.visitorId && !analytics.uniqueVisitors.includes(metadata.visitorId)) {
          analytics.uniqueVisitors.push(metadata.visitorId);
        }
        break;
      case 'signIn':
        analytics.signIns += incrementBy;
        break;
      case 'authFailure':
        analytics.authFailures += incrementBy;
        break;
      case 'error':
        analytics.errors.push({
          message: metadata?.message || 'Unknown error',
          path: metadata?.path || '/',
          timestamp: metadata?.timestamp || new Date().toISOString(),
        });
        // Keep only last 50 errors
        if (analytics.errors.length > 50) {
          analytics.errors = analytics.errors.slice(-50);
        }
        break;
      case 'libraryScan':
        analytics.libraryScans += incrementBy;
        if (metadata?.tracksCount) {
          analytics.totalTracksAnalysed += metadata.tracksCount * ANALYTICS_SAMPLE_RATE;
        }
        break;
      case 'playlistCreated':
        analytics.playlistsCreated += incrementBy;
        break;
      case 'kvError':
        analytics.kvErrors += incrementBy;
        break;
    }

    await saveDailyAnalytics(kv, analytics);
  } catch {
    // Silently fail - don't break the app for analytics
    console.error('Analytics tracking failed');
  }
}

export async function getAnalytics(kv: KVNamespace): Promise<AnalyticsSummary> {
  const today = await getDailyAnalytics(kv);

  // Get last 7 days
  const last7Days = {
    pageViews: 0,
    uniqueVisitors: new Set<string>(),
    signIns: 0,
    authFailures: 0,
    errors: 0,
    libraryScans: 0,
    playlistsCreated: 0,
  };

  const allErrors: { message: string; path: string; timestamp: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    const key = `${ANALYTICS_KEY}:${dateKey}`;
    const data = await kv.get(key);

    if (data) {
      const dayData = JSON.parse(data) as AnalyticsData;
      last7Days.pageViews += dayData.pageViews;
      dayData.uniqueVisitors.forEach(v => last7Days.uniqueVisitors.add(v));
      last7Days.signIns += dayData.signIns;
      last7Days.authFailures += dayData.authFailures;
      last7Days.errors += dayData.errors.length;
      last7Days.libraryScans += dayData.libraryScans;
      last7Days.playlistsCreated += dayData.playlistsCreated;
      allErrors.push(...dayData.errors);
    }
  }

  // Sort errors by timestamp descending and take last 20
  allErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    today,
    last7Days: {
      pageViews: last7Days.pageViews,
      uniqueVisitors: last7Days.uniqueVisitors.size,
      signIns: last7Days.signIns,
      authFailures: last7Days.authFailures,
      errors: last7Days.errors,
      libraryScans: last7Days.libraryScans,
      playlistsCreated: last7Days.playlistsCreated,
    },
    recentErrors: allErrors.slice(0, 20),
  };
}
