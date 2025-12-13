/**
 * Spotify Artists API Handlers
 *
 * Mock handlers for /artists endpoint (batch artist lookup).
 */
import { http, HttpResponse } from 'msw';
import testArtists from '../../fixtures/test-data/artists.json' with { type: 'json' };

// Configuration state
let rateLimitAfter = Infinity;
let requestCount = 0;
let slowResponseMs = 0;

export function setArtistRateLimitAfter(count: number): void {
  rateLimitAfter = count;
}

export function setSlowResponseMs(ms: number): void {
  slowResponseMs = ms;
}

export function resetArtistState(): void {
  rateLimitAfter = Infinity;
  requestCount = 0;
  slowResponseMs = 0;
}

export function getArtistRequestCount(): number {
  return requestCount;
}

const artistsMap = testArtists as Record<string, typeof testArtists.artist001>;

export const spotifyArtistHandlers = [
  // GET /artists - Batch artist lookup (up to 50 IDs)
  http.get('https://api.spotify.com/v1/artists', async ({ request }) => {
    requestCount++;

    if (requestCount > rateLimitAfter) {
      return HttpResponse.json(
        { error: { status: 429, message: 'Rate limit exceeded' } },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    // Simulate slow response if configured
    if (slowResponseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, slowResponseMs));
    }

    const url = new URL(request.url);
    const idsParam = url.searchParams.get('ids');

    if (!idsParam) {
      return HttpResponse.json(
        { error: { status: 400, message: 'Missing required parameter: ids' } },
        { status: 400 }
      );
    }

    const ids = idsParam.split(',');

    if (ids.length > 50) {
      return HttpResponse.json(
        { error: { status: 400, message: 'Maximum of 50 IDs allowed' } },
        { status: 400 }
      );
    }

    const artists = ids.map((id) => {
      const knownArtist = artistsMap[id];

      if (knownArtist) {
        return knownArtist;
      }

      // Return a generic artist for unknown IDs
      return {
        id,
        name: `Artist ${id}`,
        genres: [],
        images: [],
        popularity: 50,
        followers: { total: 1000 },
        external_urls: { spotify: `https://open.spotify.com/artist/${id}` },
      };
    });

    return HttpResponse.json({ artists });
  }),

  // GET /artists/:id - Single artist lookup
  http.get('https://api.spotify.com/v1/artists/:artistId', ({ request, params }) => {
    requestCount++;

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { status: 401, message: 'No token provided' } },
        { status: 401 }
      );
    }

    const { artistId } = params;
    const artist = artistsMap[artistId as string];

    if (!artist) {
      return HttpResponse.json(
        { error: { status: 404, message: 'Artist not found' } },
        { status: 404 }
      );
    }

    return HttpResponse.json(artist);
  }),
];
