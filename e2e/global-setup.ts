/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to:
 * - Start the mock server
 * - Seed initial test data
 * - Set up any global state
 */
import { FullConfig } from '@playwright/test';
import { startMockServer } from './mocks/mock-server';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n🚀 E2E Global Setup Starting...\n');

  // Start MSW mock server if using mocks
  if (process.env.E2E_USE_MOCKS !== 'false') {
    startMockServer();
    console.log('✅ Mock server started');
  }

  // Create local KV data directory for wrangler
  const kvDataDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'kv', 'e2e-local-sessions');

  if (!fs.existsSync(kvDataDir)) {
    fs.mkdirSync(kvDataDir, { recursive: true });
    console.log(`✅ Created KV data directory: ${kvDataDir}`);
  }

  // Seed initial test data into local KV
  // Note: Wrangler uses SQLite for local KV, so we seed via API calls instead
  await seedTestData(config);

  console.log('\n✅ E2E Global Setup Complete\n');
}

async function seedTestData(config: FullConfig): Promise<void> {
  // Initial data to seed (will be seeded via first test run or API)
  const seedData = {
    // User count
    'stats:user_count': '5',

    // Hall of Fame pioneers
    'hof:001': JSON.stringify({
      position: 1,
      spotifyId: 'pioneer-user-1',
      spotifyName: 'First Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
      registeredAt: '2024-01-01T00:00:00Z',
    }),
    'hof:002': JSON.stringify({
      position: 2,
      spotifyId: 'pioneer-user-2',
      spotifyName: 'Second Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
      registeredAt: '2024-01-02T00:00:00Z',
    }),
    'hof:003': JSON.stringify({
      position: 3,
      spotifyId: 'pioneer-user-3',
      spotifyName: 'Third Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer3',
      registeredAt: '2024-01-03T00:00:00Z',
    }),

    // User registrations
    'user:pioneer-user-1': JSON.stringify({
      spotifyId: 'pioneer-user-1',
      spotifyName: 'First Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer1',
      registeredAt: '2024-01-01T00:00:00Z',
      lastSeenAt: '2024-12-01T00:00:00Z',
    }),
    'user:pioneer-user-2': JSON.stringify({
      spotifyId: 'pioneer-user-2',
      spotifyName: 'Second Pioneer',
      spotifyAvatar: 'https://i.pravatar.cc/300?u=pioneer2',
      registeredAt: '2024-01-02T00:00:00Z',
      lastSeenAt: '2024-12-01T00:00:00Z',
    }),

    // User stats for scoreboard
    'user_stats:pioneer-user-1': JSON.stringify({
      spotifyId: 'pioneer-user-1',
      spotifyName: 'First Pioneer',
      totalGenresDiscovered: 25,
      totalArtistsDiscovered: 100,
      totalTracksAnalysed: 500,
      playlistsCreated: 10,
      totalTracksInPlaylists: 200,
      firstSeen: '2024-01-01T00:00:00Z',
      lastActive: '2024-12-01T00:00:00Z',
      createdPlaylistIds: [],
    }),

    // Recent playlists feed
    'recent_playlists': JSON.stringify([
      {
        id: 'recent-playlist-1',
        name: 'rock (from Likes)',
        genre: 'rock',
        trackCount: 25,
        userId: 'pioneer-user-1',
        userName: 'First Pioneer',
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      {
        id: 'recent-playlist-2',
        name: 'pop (from Likes)',
        genre: 'pop',
        trackCount: 18,
        userId: 'pioneer-user-2',
        userName: 'Second Pioneer',
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      },
    ]),
  };

  // Write seed data to a JSON file that can be loaded by tests
  const seedFilePath = path.join(process.cwd(), 'e2e', '.seed-data.json');
  fs.writeFileSync(seedFilePath, JSON.stringify(seedData, null, 2));
  console.log(`✅ Seed data written to ${seedFilePath}`);
}

export default globalSetup;
