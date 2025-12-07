/**
 * Backfill Script: totalTracksInPlaylists
 *
 * This script backfills the totalTracksInPlaylists field for existing users
 * who have the field missing or set to 0.
 *
 * Usage:
 *   npm run backfill:track-counts
 *
 * The script estimates track counts based on:
 * 1. Number of playlists created × average of 25 tracks
 *
 * This is a one-time migration script.
 */

import fs from 'fs';

// This script would need wrangler to run against KV
// For now, it documents the logic that should be added to the admin panel

console.log('=== Backfill: totalTracksInPlaylists ===');
console.log('');
console.log('This script estimates totalTracksInPlaylists for existing users.');
console.log('');
console.log('Logic:');
console.log('1. Iterate all user_stats:* keys');
console.log('2. For users with totalTracksInPlaylists === 0:');
console.log('   - Estimate: playlistsCreated × 25 (average tracks per playlist)');
console.log('3. Update the user_stats entry');
console.log('');
console.log('To run this migration:');
console.log('');
console.log('1. Via Admin Panel (recommended):');
console.log('   - Navigate to /admin');
console.log('   - Click "Run Migrations" → "Backfill Track Counts"');
console.log('');
console.log('2. Via Wrangler CLI:');
console.log('   - npx wrangler kv:key list --namespace-id=<SESSIONS_ID> --prefix=user_stats:');
console.log('   - For each key, get value and update if needed');
console.log('');

// Generate the migration code that can be pasted into admin panel or worker
const migrationCode = `
// Migration: Backfill totalTracksInPlaylists
// Run this in the admin panel or as a scheduled task

async function backfillTrackCounts(kv) {
  const AVERAGE_TRACKS_PER_PLAYLIST = 25;
  const list = await kv.list({ prefix: 'user_stats:' });
  let updated = 0;
  let skipped = 0;

  for (const key of list.keys) {
    const data = await kv.get(key.name);
    if (!data) continue;

    const stats = JSON.parse(data);

    // Skip if already has track counts
    if (stats.totalTracksInPlaylists && stats.totalTracksInPlaylists > 0) {
      skipped++;
      continue;
    }

    // Estimate based on playlists created
    const estimated = (stats.playlistsCreated || 0) * AVERAGE_TRACKS_PER_PLAYLIST;

    if (estimated > 0) {
      stats.totalTracksInPlaylists = estimated;
      await kv.put(key.name, JSON.stringify(stats));
      updated++;
      console.log(\`Updated \${stats.spotifyName}: \${estimated} estimated tracks\`);
    }
  }

  return { updated, skipped, total: list.keys.length };
}
`;

console.log('Migration code:');
console.log('```javascript');
console.log(migrationCode);
console.log('```');
console.log('');
console.log('Done! Copy the above code to run the migration.');
