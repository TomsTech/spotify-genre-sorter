/**
 * KV Seeding Utilities for E2E Tests
 *
 * Utilities for seeding test data into the local KV store.
 */
import fs from 'fs';
import path from 'path';

/**
 * Seed data file path (used by global setup)
 */
export const SEED_DATA_PATH = path.join(process.cwd(), 'e2e', '.seed-data.json');

/**
 * Write seed data to file (for wrangler local KV)
 */
export function writeSeedData(data: Record<string, unknown>): void {
  const serialised = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ])
  );
  fs.writeFileSync(SEED_DATA_PATH, JSON.stringify(serialised, null, 2));
}

/**
 * Read seed data from file
 */
export function readSeedData(): Record<string, string> {
  if (!fs.existsSync(SEED_DATA_PATH)) {
    return {};
  }
  const content = fs.readFileSync(SEED_DATA_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Clear seed data file
 */
export function clearSeedData(): void {
  if (fs.existsSync(SEED_DATA_PATH)) {
    fs.unlinkSync(SEED_DATA_PATH);
  }
}

/**
 * Create initial seed data for tests
 */
export function createInitialSeedData(): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    // User count
    'stats:user_count': '10',

    // Hall of Fame pioneers
    'hof:001': {
      position: 1,
      spotifyId: 'pioneer-1',
      spotifyName: 'First Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
      registeredAt: '2024-01-01T00:00:00Z',
    },
    'hof:002': {
      position: 2,
      spotifyId: 'pioneer-2',
      spotifyName: 'Second Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
      registeredAt: '2024-01-02T00:00:00Z',
    },
    'hof:003': {
      position: 3,
      spotifyId: 'pioneer-3',
      spotifyName: 'Third Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer3',
      registeredAt: '2024-01-03T00:00:00Z',
    },

    // User registrations
    'user:pioneer-1': {
      spotifyId: 'pioneer-1',
      spotifyName: 'First Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
      registeredAt: '2024-01-01T00:00:00Z',
      lastSeenAt: now,
    },
    'user:pioneer-2': {
      spotifyId: 'pioneer-2',
      spotifyName: 'Second Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
      registeredAt: '2024-01-02T00:00:00Z',
      lastSeenAt: now,
    },

    // User stats for scoreboard
    'user_stats:pioneer-1': {
      spotifyId: 'pioneer-1',
      spotifyName: 'First Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
      totalGenresDiscovered: 35,
      totalArtistsDiscovered: 150,
      totalTracksAnalysed: 800,
      playlistsCreated: 15,
      totalTracksInPlaylists: 350,
      firstSeen: '2024-01-01T00:00:00Z',
      lastActive: now,
      createdPlaylistIds: [],
    },
    'user_stats:pioneer-2': {
      spotifyId: 'pioneer-2',
      spotifyName: 'Second Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
      totalGenresDiscovered: 28,
      totalArtistsDiscovered: 120,
      totalTracksAnalysed: 650,
      playlistsCreated: 12,
      totalTracksInPlaylists: 280,
      firstSeen: '2024-01-02T00:00:00Z',
      lastActive: now,
      createdPlaylistIds: [],
    },

    // Recent playlists
    'recent_playlists': [
      {
        id: 'recent-1',
        name: 'indie rock (from Likes)',
        genre: 'indie rock',
        trackCount: 32,
        userId: 'pioneer-1',
        userName: 'First Pioneer',
        userAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
        createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      },
      {
        id: 'recent-2',
        name: 'electronic (from Likes)',
        genre: 'electronic',
        trackCount: 45,
        userId: 'pioneer-2',
        userName: 'Second Pioneer',
        userAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      {
        id: 'recent-3',
        name: 'pop (from Likes)',
        genre: 'pop',
        trackCount: 28,
        userId: 'pioneer-1',
        userName: 'First Pioneer',
        userAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      },
    ],

    // Leaderboard cache
    'leaderboard_cache': {
      pioneers: [
        {
          position: 1,
          spotifyId: 'pioneer-1',
          spotifyName: 'First Pioneer',
          spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
          registeredAt: '2024-01-01T00:00:00Z',
        },
        {
          position: 2,
          spotifyId: 'pioneer-2',
          spotifyName: 'Second Pioneer',
          spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
          registeredAt: '2024-01-02T00:00:00Z',
        },
        {
          position: 3,
          spotifyId: 'pioneer-3',
          spotifyName: 'Third Pioneer',
          spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer3',
          registeredAt: '2024-01-03T00:00:00Z',
        },
      ],
      newUsers: [],
      totalUsers: 10,
      updatedAt: now,
    },

    // Scoreboard cache
    'scoreboard_cache': {
      byPlaylists: [
        { spotifyId: 'pioneer-1', spotifyName: 'First Pioneer', value: 15 },
        { spotifyId: 'pioneer-2', spotifyName: 'Second Pioneer', value: 12 },
      ],
      byGenres: [
        { spotifyId: 'pioneer-1', spotifyName: 'First Pioneer', value: 35 },
        { spotifyId: 'pioneer-2', spotifyName: 'Second Pioneer', value: 28 },
      ],
      byArtists: [
        { spotifyId: 'pioneer-1', spotifyName: 'First Pioneer', value: 150 },
        { spotifyId: 'pioneer-2', spotifyName: 'Second Pioneer', value: 120 },
      ],
      byTracks: [
        { spotifyId: 'pioneer-1', spotifyName: 'First Pioneer', value: 800 },
        { spotifyId: 'pioneer-2', spotifyName: 'Second Pioneer', value: 650 },
      ],
      updatedAt: now,
    },
  };
}

/**
 * Merge additional seed data with initial data
 */
export function mergeSeedData(
  initial: Record<string, unknown>,
  additional: Record<string, unknown>
): Record<string, unknown> {
  return { ...initial, ...additional };
}

/**
 * Create a mock session in seed data
 */
export function createSessionSeedData(
  sessionId: string,
  session: {
    spotifyUser?: string;
    spotifyUserId?: string;
    spotifyAvatar?: string;
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
    spotifyExpiresAt?: number;
  }
): Record<string, unknown> {
  return {
    [`session:${sessionId}`]: {
      spotifyUser: session.spotifyUser || 'Test User',
      spotifyUserId: session.spotifyUserId || 'test-user-id',
      spotifyAvatar: session.spotifyAvatar || 'https://i.pravatar.cc/300?u=test',
      spotifyAccessToken: session.spotifyAccessToken || 'mock-access-token',
      spotifyRefreshToken: session.spotifyRefreshToken || 'mock-refresh-token',
      spotifyExpiresAt: session.spotifyExpiresAt || Date.now() + 3600000,
    },
  };
}
