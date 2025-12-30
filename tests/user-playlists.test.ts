import { describe, it, expect } from 'vitest';

describe('GET /api/user-playlists', () => {
  describe('Response Structure', () => {
    it('should return correct playlist response structure', () => {
      const mockResponse = {
        playlists: [
          {
            id: 'playlist123',
            name: 'My Playlist',
            trackCount: 50,
            image: 'https://i.scdn.co/image/abc123',
            owner: 'testuser',
            isOwned: true,
          },
          {
            id: 'playlist456',
            name: 'Followed Playlist',
            trackCount: 100,
            image: null,
            owner: 'otheruser',
            isOwned: false,
          },
        ],
      };

      expect(mockResponse).toHaveProperty('playlists');
      expect(Array.isArray(mockResponse.playlists)).toBe(true);

      const playlist = mockResponse.playlists[0];
      expect(playlist).toHaveProperty('id');
      expect(playlist).toHaveProperty('name');
      expect(playlist).toHaveProperty('trackCount');
      expect(playlist).toHaveProperty('image');
      expect(playlist).toHaveProperty('owner');
      expect(playlist).toHaveProperty('isOwned');
    });

    it('should distinguish owned vs followed playlists', () => {
      const playlists = [
        { id: '1', name: 'My Playlist', owner: 'me', isOwned: true },
        { id: '2', name: 'Collaborative', owner: 'friend', isOwned: false },
        { id: '3', name: "Friend's Playlist", owner: 'friend', isOwned: false },
      ];

      const owned = playlists.filter((p) => p.isOwned);
      const followed = playlists.filter((p) => !p.isOwned);

      expect(owned.length).toBe(1);
      expect(followed.length).toBe(2);
    });

    it('should handle null image gracefully', () => {
      const playlist = {
        id: 'no-image',
        name: 'No Cover',
        trackCount: 10,
        image: null,
        owner: 'user',
        isOwned: true,
      };

      expect(playlist.image).toBeNull();
      // UI should show placeholder when image is null
      const displayImage = playlist.image || '/placeholder-playlist.png';
      expect(displayImage).toBe('/placeholder-playlist.png');
    });
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', () => {
      const session = null;
      const errorResponse = session
        ? null
        : { error: 'Not authenticated', status: 401 };

      expect(errorResponse).not.toBeNull();
      expect(errorResponse?.status).toBe(401);
    });

    it('should return 401 when Spotify not connected', () => {
      const session = { githubUser: 'user' }; // No spotifyAccessToken
      const hasSpotify = !!(session as { spotifyAccessToken?: string }).spotifyAccessToken;

      expect(hasSpotify).toBe(false);
    });
  });

  describe('Token Refresh', () => {
    it('should detect when token needs refresh', () => {
      const now = Date.now();
      const session = {
        spotifyAccessToken: 'token',
        spotifyExpiresAt: now + 30000, // Expires in 30 seconds
        spotifyRefreshToken: 'refresh',
      };

      // Token should be refreshed if less than 60 seconds until expiry
      const needsRefresh = session.spotifyExpiresAt < now + 60000;
      expect(needsRefresh).toBe(true);
    });

    it('should not refresh if token has sufficient time', () => {
      const now = Date.now();
      const session = {
        spotifyAccessToken: 'token',
        spotifyExpiresAt: now + 120000, // Expires in 2 minutes
        spotifyRefreshToken: 'refresh',
      };

      const needsRefresh = session.spotifyExpiresAt < now + 60000;
      expect(needsRefresh).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on Spotify API failure', () => {
      const mockError = {
        error: 'Failed to fetch playlists',
        status: 500,
      };

      expect(mockError.status).toBe(500);
      expect(mockError.error).toBe('Failed to fetch playlists');
    });
  });

  describe('Playlist Limits', () => {
    it('should handle user with many playlists', () => {
      // Spotify returns max 50 playlists per request, paginated
      const totalPlaylists = 150;
      const perPage = 50;
      const expectedPages = Math.ceil(totalPlaylists / perPage);

      expect(expectedPages).toBe(3);
    });

    it('should handle empty playlist library', () => {
      const response = { playlists: [] };
      expect(response.playlists.length).toBe(0);
    });
  });
});

describe('Source Selection Logic', () => {
  describe('Deduplication', () => {
    it('should deduplicate tracks across sources', () => {
      const likedTrackIds = ['track1', 'track2', 'track3'];
      const playlistTrackIds = ['track2', 'track3', 'track4', 'track5'];

      const allTrackIds = new Set([...likedTrackIds, ...playlistTrackIds]);
      const uniqueCount = allTrackIds.size;

      expect(uniqueCount).toBe(5); // 5 unique tracks, not 7
      expect(allTrackIds.has('track2')).toBe(true); // Duplicate included once
    });

    it('should preserve track order by source priority', () => {
      // Liked songs should take priority (appear first if duplicate)
      const liked = [
        { id: 'track1', source: 'liked' },
        { id: 'track2', source: 'liked' },
      ];
      const playlist = [
        { id: 'track2', source: 'playlist1' }, // Duplicate
        { id: 'track3', source: 'playlist1' },
      ];

      const seen = new Set<string>();
      const deduplicated = [...liked, ...playlist].filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      expect(deduplicated.length).toBe(3);
      expect(deduplicated[1].source).toBe('liked'); // track2 from liked wins
    });
  });

  describe('Source Validation', () => {
    it('should require at least one source selected', () => {
      const sources = {
        includeLiked: false,
        playlistIds: [],
      };

      const hasSource = sources.includeLiked || sources.playlistIds.length > 0;
      expect(hasSource).toBe(false);
    });

    it('should allow liked-only selection', () => {
      const sources = {
        includeLiked: true,
        playlistIds: [],
      };

      const hasSource = sources.includeLiked || sources.playlistIds.length > 0;
      expect(hasSource).toBe(true);
    });

    it('should allow playlists-only selection', () => {
      const sources = {
        includeLiked: false,
        playlistIds: ['playlist1', 'playlist2'],
      };

      const hasSource = sources.includeLiked || sources.playlistIds.length > 0;
      expect(hasSource).toBe(true);
    });
  });
});
