/**
 * Spotify Playlists API Handlers
 *
 * Mock handlers for playlist creation and modification.
 */
import { http, HttpResponse } from 'msw';
import testPlaylists from '../../fixtures/test-data/playlists.json' with { type: 'json' };
import testUsers from '../../fixtures/test-data/users.json' with { type: 'json' };

// Track created playlists for assertions
const createdPlaylists: Array<{
  id: string;
  name: string;
  description: string;
  trackUris: string[];
  createdAt: string;
}> = [];

// Configuration
let failPlaylistCreation = false;
let existingPlaylistNames: string[] = ['rock (from Likes)']; // Simulate existing duplicate

export function setFailPlaylistCreation(fail: boolean): void {
  failPlaylistCreation = fail;
}

export function setExistingPlaylistNames(names: string[]): void {
  existingPlaylistNames = names;
}

export function getCreatedPlaylists(): typeof createdPlaylists {
  return [...createdPlaylists];
}

export function resetPlaylistState(): void {
  createdPlaylists.length = 0;
  failPlaylistCreation = false;
  existingPlaylistNames = ['rock (from Likes)'];
}

export const spotifyPlaylistHandlers = [
  // POST /users/:userId/playlists - Create playlist
  http.post('https://api.spotify.com/v1/users/:userId/playlists', async ({ request, params }) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    if (failPlaylistCreation) {
      return HttpResponse.json(
        { error: { status: 500, message: 'Internal server error' } },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      name: string;
      description?: string;
      public?: boolean;
    };

    const { userId } = params;
    const playlistId = `mock-playlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newPlaylist = {
      id: playlistId,
      name: body.name,
      description: body.description || '',
      public: body.public ?? false,
      collaborative: false,
      images: [],
      owner: {
        id: userId as string,
        display_name: testUsers.default.display_name,
      },
      tracks: { total: 0 },
      external_urls: { spotify: `https://open.spotify.com/playlist/${playlistId}` },
      snapshot_id: `snapshot-${Date.now()}`,
    };

    createdPlaylists.push({
      id: playlistId,
      name: body.name,
      description: body.description || '',
      trackUris: [],
      createdAt: new Date().toISOString(),
    });

    return HttpResponse.json(newPlaylist, { status: 201 });
  }),

  // POST /playlists/:playlistId/tracks - Add tracks to playlist
  http.post('https://api.spotify.com/v1/playlists/:playlistId/tracks', async ({ request, params }) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { uris: string[] };
    const { playlistId } = params;

    // Find the playlist in our created list and update it
    const playlist = createdPlaylists.find((p) => p.id === playlistId);
    if (playlist) {
      playlist.trackUris.push(...body.uris);
    }

    return HttpResponse.json({
      snapshot_id: `snapshot-${Date.now()}`,
    });
  }),

  // GET /playlists/:playlistId/tracks - Get playlist tracks (for scan-playlist)
  http.get('https://api.spotify.com/v1/playlists/:playlistId/tracks', ({ request, params }) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const { playlistId } = params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Check if it's one of our created playlists
    const playlist = createdPlaylists.find((p) => p.id === playlistId);

    if (!playlist) {
      // Return empty tracks for unknown playlists
      return HttpResponse.json({
        items: [],
        total: 0,
        limit,
        offset,
        next: null,
        previous: null,
      });
    }

    // Generate track items from stored URIs
    const trackItems = playlist.trackUris.map((uri, index) => {
      const trackId = uri.replace('spotify:track:', '');
      return {
        added_at: playlist.createdAt,
        added_by: { id: testUsers.default.id },
        is_local: false,
        track: {
          id: trackId,
          name: `Track ${index + 1}`,
          artists: [{ id: 'artist-1', name: 'Test Artist' }],
          album: {
            id: 'album-1',
            name: 'Test Album',
            images: [{ url: 'https://i.pravatar.cc/300', height: 300, width: 300 }],
          },
          duration_ms: 180000,
          external_urls: { spotify: `https://open.spotify.com/track/${trackId}` },
        },
      };
    });

    const items = trackItems.slice(offset, offset + limit);
    const hasNext = offset + limit < trackItems.length;

    return HttpResponse.json({
      items,
      total: trackItems.length,
      limit,
      offset,
      next: hasNext
        ? `https://api.spotify.com/v1/playlists/${playlistId as string}/tracks?limit=${limit}&offset=${offset + limit}`
        : null,
      previous: null,
    });
  }),

  // GET /playlists/:playlistId - Get playlist details
  http.get('https://api.spotify.com/v1/playlists/:playlistId', ({ request, params }) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const { playlistId } = params;

    // Check if it's one of our pre-defined playlists
    const createdPlaylist = Object.values(testPlaylists.created).find(
      (p) => p.id === playlistId
    );

    if (createdPlaylist) {
      return HttpResponse.json(createdPlaylist);
    }

    // Check recently created playlists
    const recentPlaylist = createdPlaylists.find((p) => p.id === playlistId);
    if (recentPlaylist) {
      return HttpResponse.json({
        id: recentPlaylist.id,
        name: recentPlaylist.name,
        description: recentPlaylist.description,
        public: false,
        collaborative: false,
        images: [],
        owner: {
          id: testUsers.default.id,
          display_name: testUsers.default.display_name,
        },
        tracks: { total: recentPlaylist.trackUris.length },
        external_urls: { spotify: `https://open.spotify.com/playlist/${recentPlaylist.id}` },
        snapshot_id: `snapshot-${Date.now()}`,
      });
    }

    return HttpResponse.json(
      { error: { status: 404, message: 'Playlist not found' } },
      { status: 404 }
    );
  }),

  // GET /me/playlists - User's playlists (for duplicate detection)
  http.get('https://api.spotify.com/v1/users/:userId/playlists', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Include existing playlists for duplicate detection
    const existingItems = existingPlaylistNames.map((name, i) => ({
      id: `existing-${i}`,
      name,
      description: 'Existing playlist',
      public: false,
      owner: { id: testUsers.default.id },
      tracks: { total: 10 },
    }));

    // Include recently created playlists
    const recentItems = createdPlaylists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      public: false,
      owner: { id: testUsers.default.id },
      tracks: { total: p.trackUris.length },
    }));

    const allItems = [...existingItems, ...recentItems];
    const items = allItems.slice(offset, offset + limit);

    return HttpResponse.json({
      items,
      total: allItems.length,
      limit,
      offset,
      next: offset + limit < allItems.length
        ? `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset + limit}`
        : null,
      previous: null,
    });
  }),
];
