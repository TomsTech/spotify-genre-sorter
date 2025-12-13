/**
 * E2E Test Fixtures
 *
 * Central export for all test fixtures and utilities.
 */

// Mock KV
export { MockKVNamespace, getGlobalMockKV, resetGlobalMockKV } from './mock-kv';

// Test data
import testUsers from './test-data/users.json' with { type: 'json' };
import testTracks from './test-data/tracks.json' with { type: 'json' };
import testArtists from './test-data/artists.json' with { type: 'json' };
import testPlaylists from './test-data/playlists.json' with { type: 'json' };

export const testData = {
  users: testUsers,
  tracks: testTracks,
  artists: testArtists,
  playlists: testPlaylists,
};

// Re-export individual data sets for convenience
export { testUsers, testTracks, testArtists, testPlaylists };

/**
 * Default test user credentials
 */
export const defaultTestUser = {
  spotifyId: testUsers.default.id,
  spotifyName: testUsers.default.display_name,
  accessToken: 'mock-access-token-e2e',
  refreshToken: 'mock-refresh-token-e2e',
};

/**
 * Create a mock session object for seeding KV
 */
export function createMockSession(overrides: Partial<{
  spotifyUser: string;
  spotifyUserId: string;
  spotifyAvatar: string;
  spotifyAccessToken: string;
  spotifyRefreshToken: string;
  spotifyExpiresAt: number;
  githubUser: string;
  githubAvatar: string;
}> = {}) {
  return {
    spotifyUser: defaultTestUser.spotifyName,
    spotifyUserId: defaultTestUser.spotifyId,
    spotifyAvatar: testUsers.default.images[0]?.url,
    spotifyAccessToken: defaultTestUser.accessToken,
    spotifyRefreshToken: defaultTestUser.refreshToken,
    spotifyExpiresAt: Date.now() + 3600000, // 1 hour from now
    ...overrides,
  };
}

/**
 * Create mock user stats for seeding KV
 */
export function createMockUserStats(overrides: Partial<{
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar: string;
  totalGenresDiscovered: number;
  totalArtistsDiscovered: number;
  totalTracksAnalysed: number;
  playlistsCreated: number;
  totalTracksInPlaylists: number;
  firstSeen: string;
  lastActive: string;
  createdPlaylistIds: string[];
}> = {}) {
  return {
    spotifyId: defaultTestUser.spotifyId,
    spotifyName: defaultTestUser.spotifyName,
    spotifyAvatar: testUsers.default.images[0]?.url,
    totalGenresDiscovered: 10,
    totalArtistsDiscovered: 8,
    totalTracksAnalysed: 20,
    playlistsCreated: 2,
    totalTracksInPlaylists: 15,
    firstSeen: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    createdPlaylistIds: [],
    ...overrides,
  };
}

/**
 * Create mock user registration for Hall of Fame
 */
export function createMockUserRegistration(overrides: Partial<{
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar: string;
  githubUser: string;
  registeredAt: string;
  lastSeenAt: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    spotifyId: defaultTestUser.spotifyId,
    spotifyName: defaultTestUser.spotifyName,
    spotifyAvatar: testUsers.default.images[0]?.url,
    registeredAt: now,
    lastSeenAt: now,
    ...overrides,
  };
}

/**
 * Create mock leaderboard data
 */
export function createMockLeaderboard() {
  return {
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
    ],
    newUsers: [
      {
        spotifyId: 'new-user-1',
        spotifyName: 'New User 1',
        spotifyAvatar: 'https://i.pravatar.cc/300?u=new1',
        registeredAt: new Date().toISOString(),
      },
    ],
    totalUsers: 10,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create mock scoreboard data
 */
export function createMockScoreboard() {
  return {
    byPlaylists: [
      { spotifyId: 'user-1', spotifyName: 'Top Creator', value: 25 },
      { spotifyId: 'user-2', spotifyName: 'Second Creator', value: 18 },
    ],
    byGenres: [
      { spotifyId: 'user-1', spotifyName: 'Genre Explorer', value: 50 },
      { spotifyId: 'user-2', spotifyName: 'Genre Fan', value: 35 },
    ],
    byArtists: [
      { spotifyId: 'user-1', spotifyName: 'Artist Collector', value: 200 },
      { spotifyId: 'user-2', spotifyName: 'Artist Fan', value: 150 },
    ],
    byTracks: [
      { spotifyId: 'user-1', spotifyName: 'Track Master', value: 5000 },
      { spotifyId: 'user-2', spotifyName: 'Track Lover', value: 3500 },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create mock genre cache data
 */
export function createMockGenreCache(overrides: Partial<{
  genres: Array<{ name: string; count: number; trackIds: string[] }>;
  totalTracks: number;
  totalGenres: number;
  totalArtists: number;
  cachedAt: number;
}> = {}) {
  return {
    genres: [
      { name: 'rock', count: 5, trackIds: ['track001', 'track002', 'track017', 'track019'] },
      { name: 'pop', count: 4, trackIds: ['track003', 'track004', 'track019'] },
      { name: 'electronic', count: 2, trackIds: ['track005', 'track006'] },
      { name: 'hip hop', count: 2, trackIds: ['track007', 'track008'] },
      { name: 'jazz', count: 1, trackIds: ['track009'] },
      { name: 'metal', count: 1, trackIds: ['track010'] },
      { name: 'country', count: 1, trackIds: ['track011'] },
      { name: 'r&b', count: 2, trackIds: ['track012', 'track020'] },
      { name: 'classical', count: 1, trackIds: ['track013'] },
      { name: 'swedish pop', count: 1, trackIds: ['track014'] },
    ],
    totalTracks: 20,
    totalGenres: 10,
    totalArtists: 12,
    cachedAt: Date.now(),
    ...overrides,
  };
}
