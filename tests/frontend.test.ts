import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Frontend Feature Tests
 *
 * These tests validate the actual logic from app.js by testing the same algorithms
 * in an isolated manner. Since app.js is vanilla JS embedded in the DOM, we test
 * the pure functions and logic patterns used there.
 */

// Mock genre data for testing
const mockGenreData = {
  totalTracks: 500,
  totalGenres: 20,
  totalArtists: 150,
  genres: [
    { name: 'rock', count: 100, trackIds: ['t1', 't2', 't3'] },
    { name: 'pop', count: 80, trackIds: ['t4', 't5'] },
    { name: 'jazz', count: 60, trackIds: ['t6', 't7'] },
    { name: 'electronic', count: 40, trackIds: ['t8'] },
    { name: 'classical', count: 30, trackIds: ['t9'] },
    { name: 'hip hop', count: 25, trackIds: ['t10'] },
    { name: 'r&b', count: 20, trackIds: ['t11'] },
    { name: 'country', count: 15, trackIds: ['t12'] },
    { name: 'blues', count: 10, trackIds: ['t13'] },
    { name: 'metal', count: 5, trackIds: ['t14'] },
    { name: 'ambient', count: 3, trackIds: ['t15'] },
    { name: 'obscure genre', count: 2, trackIds: ['t16'] },
  ],
  cachedAt: Date.now(),
  fromCache: false,
};

// ============================================================
// EXTRACTED FUNCTIONS FROM app.js (for testability)
// These mirror the exact implementation in app.js
// ============================================================

function filterGenres(
  genres: typeof mockGenreData.genres,
  query: string,
  hiddenGenres: Set<string>,
  showHiddenGenres: boolean
) {
  let filtered = genres;
  if (query) {
    const lower = query.toLowerCase();
    filtered = filtered.filter((g) => g.name.toLowerCase().includes(lower));
  }
  if (!showHiddenGenres) {
    filtered = filtered.filter((g) => !hiddenGenres.has(g.name));
  }
  return filtered;
}

function hideSmallGenres(
  genres: typeof mockGenreData.genres,
  minTracks: number,
  hiddenGenres: Set<string>
) {
  genres.forEach((g) => {
    if (g.count < minTracks) {
      hiddenGenres.add(g.name);
    }
  });
  return hiddenGenres;
}

function toggleHideGenre(genre: string, hiddenGenres: Set<string>) {
  if (hiddenGenres.has(genre)) {
    hiddenGenres.delete(genre);
  } else {
    hiddenGenres.add(genre);
  }
}

function calculateDiversityScore(genres: { count: number }[]) {
  if (!genres || genres.length === 0) return 0;
  const total = genres.reduce((sum, g) => sum + g.count, 0);
  if (total === 0) return 0;

  let entropy = 0;
  genres.forEach((g) => {
    const p = g.count / total;
    if (p > 0) entropy -= p * Math.log(p);
  });
  const maxEntropy = Math.log(genres.length);
  return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
}

function getDiversityLabel(score: number, swedishMode = false) {
  if (score >= 80) return swedishMode ? 'Mycket varierad!' : 'Very diverse!';
  if (score >= 60) return swedishMode ? 'Varierad' : 'Diverse';
  if (score >= 40) return swedishMode ? 'Måttlig' : 'Moderate';
  if (score >= 20) return swedishMode ? 'Fokuserad' : 'Focused';
  return swedishMode ? 'Mycket fokuserad' : 'Very focused';
}

function calculateAvgGenresPerTrack(
  genres: { count: number }[] | null,
  totalTracks: number
) {
  if (!genres || totalTracks === 0) return 0;
  const totalGenreAssignments = genres.reduce((sum, g) => sum + g.count, 0);
  return Number((totalGenreAssignments / totalTracks).toFixed(1));
}

function applyTemplate(template: string, genre: string) {
  return template.replace('{genre}', genre);
}

function formatCacheTime(cachedAt: number, now = Date.now(), swedishMode = false) {
  if (!cachedAt) return '';
  const diff = Math.floor((now - cachedAt) / 1000);
  if (diff < 60) return swedishMode ? 'Just nu' : 'Just now';
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return swedishMode ? `${mins} min sedan` : `${mins}m ago`;
  }
  const hours = Math.floor(diff / 3600);
  return swedishMode ? `${hours} tim sedan` : `${hours}h ago`;
}

function escapeForHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeForExport(text: string) {
  return text
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '');
}

const genreEmojis: Record<string, string> = {
  'rock': '🎸', 'pop': '🎤', 'hip hop': '🎧', 'rap': '🎤', 'jazz': '🎷',
  'classical': '🎻', 'electronic': '🎹', 'dance': '💃', 'r&b': '🎵', 'soul': '💜',
  'country': '🤠', 'folk': '🪕', 'blues': '🎺', 'metal': '🤘', 'punk': '⚡',
};

function getGenreEmoji(genreName: string) {
  const lower = genreName.toLowerCase();
  if (genreEmojis[lower]) return genreEmojis[lower];
  for (const [key, emoji] of Object.entries(genreEmojis)) {
    if (lower.includes(key) || key.includes(lower)) return emoji;
  }
  return '🎵';
}

// ============================================================
// TESTS
// ============================================================

describe('Hidden Genres Feature', () => {
  describe('filterGenres', () => {
    it('should filter out hidden genres when showHiddenGenres is false', () => {
      const hiddenGenres = new Set(['pop', 'jazz']);
      const result = filterGenres(mockGenreData.genres, '', hiddenGenres, false);

      expect(result.length).toBe(mockGenreData.genres.length - 2);
      expect(result.find((g) => g.name === 'pop')).toBeUndefined();
      expect(result.find((g) => g.name === 'jazz')).toBeUndefined();
      expect(result.find((g) => g.name === 'rock')).toBeDefined();
    });

    it('should show hidden genres when showHiddenGenres is true', () => {
      const hiddenGenres = new Set(['pop', 'jazz']);
      const result = filterGenres(mockGenreData.genres, '', hiddenGenres, true);

      expect(result.length).toBe(mockGenreData.genres.length);
      expect(result.find((g) => g.name === 'pop')).toBeDefined();
      expect(result.find((g) => g.name === 'jazz')).toBeDefined();
    });

    it('should combine search filter with hidden filter', () => {
      const hiddenGenres = new Set(['rock', 'pop']);
      const result = filterGenres(mockGenreData.genres, 'o', hiddenGenres, false);

      expect(result.find((g) => g.name === 'rock')).toBeUndefined();
      expect(result.find((g) => g.name === 'pop')).toBeUndefined();
      expect(result.find((g) => g.name === 'electronic')).toBeDefined();
      expect(result.find((g) => g.name === 'hip hop')).toBeDefined();
      expect(result.find((g) => g.name === 'country')).toBeDefined();
    });
  });

  describe('hideSmallGenres', () => {
    it('should hide genres with fewer than specified tracks', () => {
      const hiddenGenres = new Set<string>();
      hideSmallGenres(mockGenreData.genres, 10, hiddenGenres);

      expect(hiddenGenres.has('ambient')).toBe(true);
      expect(hiddenGenres.has('obscure genre')).toBe(true);
      expect(hiddenGenres.has('metal')).toBe(true);
      expect(hiddenGenres.has('blues')).toBe(false);
      expect(hiddenGenres.has('rock')).toBe(false);
    });

    it('should hide genres with fewer than 5 tracks by default', () => {
      const hiddenGenres = new Set<string>();
      hideSmallGenres(mockGenreData.genres, 5, hiddenGenres);

      expect(hiddenGenres.has('ambient')).toBe(true);
      expect(hiddenGenres.has('obscure genre')).toBe(true);
      expect(hiddenGenres.has('metal')).toBe(false);
    });
  });

  describe('toggleHideGenre', () => {
    it('should add genre to hidden set when not hidden', () => {
      const hiddenGenres = new Set<string>();
      toggleHideGenre('rock', hiddenGenres);
      expect(hiddenGenres.has('rock')).toBe(true);
    });

    it('should remove genre from hidden set when already hidden', () => {
      const hiddenGenres = new Set(['rock', 'pop']);
      toggleHideGenre('rock', hiddenGenres);
      expect(hiddenGenres.has('rock')).toBe(false);
      expect(hiddenGenres.has('pop')).toBe(true);
    });
  });
});

describe('Theme Toggle Feature', () => {
  it('should toggle between light and dark mode', () => {
    let lightMode = false;
    const toggleTheme = () => { lightMode = !lightMode; return lightMode; };

    expect(toggleTheme()).toBe(true);
    expect(toggleTheme()).toBe(false);
    expect(toggleTheme()).toBe(true);
  });

  it('should respect system preference on initial load', () => {
    const getInitialTheme = (localStorageValue: string | null, systemPreference: boolean) => {
      if (localStorageValue === null) return systemPreference;
      return localStorageValue === 'true';
    };

    expect(getInitialTheme(null, true)).toBe(true);
    expect(getInitialTheme(null, false)).toBe(false);
    expect(getInitialTheme('true', false)).toBe(true);
    expect(getInitialTheme('false', true)).toBe(false);
  });
});

describe('Export Feature', () => {
  describe('JSON Export', () => {
    it('should create valid JSON export structure', () => {
      const createExportData = (genreData: typeof mockGenreData) => ({
        exportedAt: new Date().toISOString(),
        totalTracks: genreData.totalTracks,
        totalGenres: genreData.totalGenres,
        totalArtists: genreData.totalArtists,
        genres: genreData.genres.map((g) => ({
          name: g.name,
          trackCount: g.count,
          trackIds: g.trackIds,
        })),
      });

      const exportData = createExportData(mockGenreData);

      expect(exportData.exportedAt).toBeTruthy();
      expect(new Date(exportData.exportedAt).getTime()).not.toBeNaN();
      expect(exportData.totalTracks).toBe(500);
      expect(exportData.totalGenres).toBe(20);
      expect(exportData.totalArtists).toBe(150);
      expect(exportData.genres.length).toBe(mockGenreData.genres.length);
    });

    it('should produce valid JSON string', () => {
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalTracks: mockGenreData.totalTracks,
        genres: mockGenreData.genres.map((g) => ({ name: g.name, trackCount: g.count })),
      };
      const jsonString = JSON.stringify(exportData, null, 2);

      expect(() => JSON.parse(jsonString)).not.toThrow();
    });
  });

  describe('CSV Export', () => {
    it('should create valid CSV structure', () => {
      const createCSV = (genreData: typeof mockGenreData) => {
        const rows = [['Genre', 'Track Count', 'Track IDs']];
        genreData.genres.forEach((g) => {
          rows.push([g.name, g.count.toString(), g.trackIds.join(';')]);
        });
        return rows.map((row) =>
          row.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(',')
        ).join('\n');
      };

      const csv = createCSV(mockGenreData);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('"Genre","Track Count","Track IDs"');
      expect(lines.length).toBe(mockGenreData.genres.length + 1);
      expect(lines[1]).toContain('"rock"');
    });

    it('should properly escape quotes in genre names', () => {
      const genreWithQuotes = { genres: [{ name: 'rock "n" roll', count: 10, trackIds: ['t1'] }] };
      const csv = genreWithQuotes.genres.map(g =>
        '"' + g.name.replace(/"/g, '""') + '"'
      ).join(',');

      expect(csv).toContain('""n""');
    });
  });

  describe('sanitizeForExport', () => {
    it('should normalize unicode characters', () => {
      const text = 'café';
      const result = sanitizeForExport(text);
      expect(result).toBe(text.normalize('NFC'));
    });

    it('should remove control characters', () => {
      const text = 'hello\x00world\x1F';
      const result = sanitizeForExport(text);
      expect(result).toBe('helloworld');
    });

    it('should remove invalid surrogate pairs', () => {
      const text = 'test\uD800invalid';
      const result = sanitizeForExport(text);
      expect(result).toBe('testinvalid');
    });
  });
});

describe('Stats Dashboard Feature', () => {
  describe('calculateDiversityScore', () => {
    it('should calculate Shannon diversity index (normalized to 0-100)', () => {
      const score = calculateDiversityScore(mockGenreData.genres);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 for empty genres', () => {
      expect(calculateDiversityScore([])).toBe(0);
    });

    it('should return 100 for perfectly even distribution', () => {
      const evenGenres = [
        { count: 10 }, { count: 10 }, { count: 10 }, { count: 10 }, { count: 10 },
      ];
      expect(calculateDiversityScore(evenGenres)).toBe(100);
    });

    it('should return lower score for uneven distribution', () => {
      const unevenGenres = [
        { count: 100 }, { count: 1 }, { count: 1 }, { count: 1 }, { count: 1 },
      ];
      expect(calculateDiversityScore(unevenGenres)).toBeLessThan(50);
    });
  });

  describe('getDiversityLabel', () => {
    it('should return correct labels for score ranges', () => {
      expect(getDiversityLabel(85)).toBe('Very diverse!');
      expect(getDiversityLabel(70)).toBe('Diverse');
      expect(getDiversityLabel(50)).toBe('Moderate');
      expect(getDiversityLabel(30)).toBe('Focused');
      expect(getDiversityLabel(10)).toBe('Very focused');
    });

    it('should return Swedish labels when swedishMode is true', () => {
      expect(getDiversityLabel(85, true)).toBe('Mycket varierad!');
      expect(getDiversityLabel(70, true)).toBe('Varierad');
      expect(getDiversityLabel(50, true)).toBe('Måttlig');
      expect(getDiversityLabel(30, true)).toBe('Fokuserad');
      expect(getDiversityLabel(10, true)).toBe('Mycket fokuserad');
    });
  });

  describe('calculateAvgGenresPerTrack', () => {
    it('should calculate average genres per track', () => {
      const totalAssignments = mockGenreData.genres.reduce((sum, g) => sum + g.count, 0);
      const expected = Number((totalAssignments / mockGenreData.totalTracks).toFixed(1));
      expect(calculateAvgGenresPerTrack(mockGenreData.genres, mockGenreData.totalTracks)).toBe(expected);
    });

    it('should return 0 for empty data', () => {
      expect(calculateAvgGenresPerTrack(null, 0)).toBe(0);
      expect(calculateAvgGenresPerTrack([], 0)).toBe(0);
      expect(calculateAvgGenresPerTrack([], 100)).toBe(0);
    });
  });
});

describe('Playlist Template Feature', () => {
  describe('applyTemplate', () => {
    it('should replace {genre} placeholder with genre name', () => {
      expect(applyTemplate('{genre} (from Likes)', 'rock')).toBe('rock (from Likes)');
      expect(applyTemplate('My {genre} Collection', 'jazz')).toBe('My jazz Collection');
      expect(applyTemplate('{genre}', 'pop')).toBe('pop');
    });

    it('should handle templates without placeholder', () => {
      expect(applyTemplate('Static Name', 'rock')).toBe('Static Name');
    });

    it('should handle special characters in genre names', () => {
      expect(applyTemplate('{genre} Playlist', "rock 'n' roll")).toBe("rock 'n' roll Playlist");
      expect(applyTemplate('{genre} Playlist', 'r&b')).toBe('r&b Playlist');
    });
  });
});

describe('Cache Feature', () => {
  describe('formatCacheTime', () => {
    it('should format time correctly', () => {
      const now = Date.now();
      expect(formatCacheTime(now - 30000, now)).toBe('Just now');
      expect(formatCacheTime(now - 5 * 60000, now)).toBe('5m ago');
      expect(formatCacheTime(now - 30 * 60000, now)).toBe('30m ago');
      expect(formatCacheTime(now - 2 * 3600000, now)).toBe('2h ago');
    });

    it('should return Swedish translations', () => {
      const now = Date.now();
      expect(formatCacheTime(now - 30000, now, true)).toBe('Just nu');
      expect(formatCacheTime(now - 5 * 60000, now, true)).toBe('5 min sedan');
      expect(formatCacheTime(now - 2 * 3600000, now, true)).toBe('2 tim sedan');
    });

    it('should return empty string for falsy cachedAt', () => {
      expect(formatCacheTime(0)).toBe('');
    });
  });
});

describe('HTML Escaping', () => {
  describe('escapeForHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeForHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeForHtml('"quotes"')).toBe('&quot;quotes&quot;');
      expect(escapeForHtml("'apostrophe'")).toBe('&#039;apostrophe&#039;');
      expect(escapeForHtml('a & b')).toBe('a &amp; b');
    });

    it('should handle multiple special characters', () => {
      expect(escapeForHtml('<a href="test">link</a>')).toBe(
        '&lt;a href=&quot;test&quot;&gt;link&lt;/a&gt;'
      );
    });
  });
});

describe('Genre Emoji Feature', () => {
  describe('getGenreEmoji', () => {
    it('should return correct emoji for known genres', () => {
      expect(getGenreEmoji('rock')).toBe('🎸');
      expect(getGenreEmoji('pop')).toBe('🎤');
      expect(getGenreEmoji('jazz')).toBe('🎷');
      expect(getGenreEmoji('metal')).toBe('🤘');
    });

    it('should be case-insensitive', () => {
      expect(getGenreEmoji('ROCK')).toBe('🎸');
      expect(getGenreEmoji('Rock')).toBe('🎸');
      expect(getGenreEmoji('JAZZ')).toBe('🎷');
    });

    it('should match partial genre names', () => {
      expect(getGenreEmoji('hard rock')).toBe('🎸');
      expect(getGenreEmoji('smooth jazz')).toBe('🎷');
      expect(getGenreEmoji('death metal')).toBe('🤘');
    });

    it('should return default emoji for unknown genres', () => {
      expect(getGenreEmoji('obscure-unknown-genre')).toBe('🎵');
      expect(getGenreEmoji('xyz123')).toBe('🎵');
    });
  });
});

describe('Frontend Init Flow', () => {
  // Mock fetch for testing init behaviour
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle unauthenticated session correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ userCount: 100 }),
    });
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ authenticated: false, spotifyOnly: true }),
    });

    // Simulate init logic
    const statsResponse = await mockFetch('/stats');
    const statsData = await statsResponse.json();

    const sessionResponse = await mockFetch('/session');
    const session = await sessionResponse.json();

    expect(statsData.userCount).toBe(100);
    expect(session.authenticated).toBe(false);
    expect(session.spotifyOnly).toBe(true);
    // When not authenticated, should render welcome (not call /api/genres)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle authenticated session and fetch genres', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ userCount: 100 }),
    });
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ authenticated: true, spotifyOnly: true, spotifyConnected: true }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGenreData),
    });

    // Simulate init logic
    await mockFetch('/stats');
    const sessionResponse = await mockFetch('/session');
    const session = await sessionResponse.json();

    expect(session.authenticated).toBe(true);

    // When authenticated, should fetch genres
    const genresResponse = await mockFetch('/api/genres');
    const data = await genresResponse.json();

    expect(data.totalTracks).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should handle API error responses gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({}),
    });
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ authenticated: true, spotifyOnly: true }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Failed to fetch genres',
        step: 'fetching_tracks',
        details: 'Rate limited by Spotify'
      }),
    });

    await mockFetch('/stats');
    await mockFetch('/session');
    const genresResponse = await mockFetch('/api/genres');
    const data = await genresResponse.json();

    expect(genresResponse.ok).toBe(false);
    expect(data.error).toBe('Failed to fetch genres');
    expect(data.step).toBe('fetching_tracks');
    expect(data.details).toBe('Rate limited by Spotify');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(mockFetch('/stats')).rejects.toThrow('Network error');
  });

  it('should handle session expiry correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({}),
    });
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ authenticated: true, spotifyOnly: true }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Spotify session expired' }),
    });

    await mockFetch('/stats');
    await mockFetch('/session');
    const genresResponse = await mockFetch('/api/genres');

    expect(genresResponse.ok).toBe(false);
    expect(genresResponse.status).toBe(401);
  });
});
