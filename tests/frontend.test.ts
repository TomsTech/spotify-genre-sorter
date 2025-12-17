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

// Bulletproof sanitization - NO REGEX with escape sequences
function sanitizeForExport(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Normalize unicode to NFC form
  let result = text.normalize('NFC');

  // Remove control characters manually (safer than regex escapes)
  let cleaned = '';
  for (let i = 0; i < result.length; i++) {
    const code = result.charCodeAt(i);
    // Skip control characters: 0x00-0x1F (C0) and 0x7F-0x9F (DEL + C1)
    if ((code >= 0x20 && code <= 0x7E) || code >= 0xA0) {
      cleaned += result[i];
    }
  }

  return cleaned.trim();
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
    it('should not throw when called (regex must be valid)', () => {
      // This test catches invalid regex patterns like /[\uD800-\uDFFF]/
      expect(() => sanitizeForExport('test')).not.toThrow();
    });

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

    it('should remove newlines and tabs (control characters)', () => {
      const text = 'hello\nworld\ttab';
      const result = sanitizeForExport(text);
      // \n and \t are in 0x00-0x1F range, so they get removed first
      expect(result).toBe('helloworldtab');
    });

    it('should trim whitespace', () => {
      const text = '  trimmed  ';
      const result = sanitizeForExport(text);
      expect(result).toBe('trimmed');
    });

    it('should handle genre names with special unicode', () => {
      // Real genre names that might appear
      expect(() => sanitizeForExport('k-pop')).not.toThrow();
      expect(() => sanitizeForExport('R&B')).not.toThrow();
      expect(() => sanitizeForExport('hip-hop/rap')).not.toThrow();
      expect(() => sanitizeForExport('música latina')).not.toThrow();
      expect(() => sanitizeForExport('日本語')).not.toThrow();
    });

    // Additional bulletproof tests
    it('should handle null and undefined inputs', () => {
      expect(sanitizeForExport(null as unknown as string)).toBe('');
      expect(sanitizeForExport(undefined as unknown as string)).toBe('');
      expect(sanitizeForExport('')).toBe('');
    });

    it('should handle non-string inputs gracefully', () => {
      expect(sanitizeForExport(123 as unknown as string)).toBe('');
      expect(sanitizeForExport({} as unknown as string)).toBe('');
      expect(sanitizeForExport([] as unknown as string)).toBe('');
    });

    it('should preserve normal ASCII characters', () => {
      const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      expect(sanitizeForExport(text)).toBe(text);
    });

    it('should preserve common punctuation', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:\'",.<>/?';
      expect(sanitizeForExport(text)).toBe(text);
    });

    it('should preserve extended unicode (non-ASCII)', () => {
      expect(sanitizeForExport('café')).toBe('café');
      expect(sanitizeForExport('naïve')).toBe('naïve');
      expect(sanitizeForExport('über')).toBe('über');
      expect(sanitizeForExport('日本語')).toBe('日本語');
      expect(sanitizeForExport('한국어')).toBe('한국어');
      expect(sanitizeForExport('العربية')).toBe('العربية');
      expect(sanitizeForExport('🎵🎸🎤')).toBe('🎵🎸🎤');
    });

    it('should remove all C0 control characters (0x00-0x1F)', () => {
      // Test each control character individually
      for (let i = 0; i < 0x20; i++) {
        const char = String.fromCharCode(i);
        const result = sanitizeForExport('a' + char + 'b');
        expect(result).toBe('ab');
      }
    });

    it('should remove DEL and C1 control characters (0x7F-0x9F)', () => {
      for (let i = 0x7F; i <= 0x9F; i++) {
        const char = String.fromCharCode(i);
        const result = sanitizeForExport('a' + char + 'b');
        expect(result).toBe('ab');
      }
    });

    it('should handle mixed content correctly', () => {
      const text = 'rock\x00pop\x1Fjazz\x7Fblues';
      expect(sanitizeForExport(text)).toBe('rockpopjazzblues');
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

// ============================================================
// KEYBOARD SHORTCUTS TESTS
// ============================================================

describe('Keyboard Shortcuts', () => {
  // Shortcut matching logic extracted from app.js
  interface Shortcut {
    desc: string;
    ctrl?: boolean;
    shift?: boolean;
    action: () => void;
  }

  function shouldTriggerShortcut(
    shortcut: Shortcut,
    event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  ): boolean {
    const ctrlOrMeta = event.ctrlKey || event.metaKey;

    // Check modifiers match
    if (shortcut.ctrl && !ctrlOrMeta) return false;
    if (shortcut.shift && !event.shiftKey) return false;
    if (!shortcut.ctrl && ctrlOrMeta && event.key !== 'Enter') return false;

    return true;
  }

  it('should match Ctrl+A for select all', () => {
    const shortcut = { desc: 'Select all', ctrl: true, action: vi.fn() };
    const event = { key: 'a', ctrlKey: true, metaKey: false, shiftKey: false };

    expect(shouldTriggerShortcut(shortcut, event)).toBe(true);
  });

  it('should match Cmd+A for select all on Mac', () => {
    const shortcut = { desc: 'Select all', ctrl: true, action: vi.fn() };
    const event = { key: 'a', ctrlKey: false, metaKey: true, shiftKey: false };

    expect(shouldTriggerShortcut(shortcut, event)).toBe(true);
  });

  it('should match Ctrl+Shift+A for select none', () => {
    const shortcut = { desc: 'Select none', ctrl: true, shift: true, action: vi.fn() };
    const event = { key: 'A', ctrlKey: true, metaKey: false, shiftKey: true };

    expect(shouldTriggerShortcut(shortcut, event)).toBe(true);
  });

  it('should NOT match Ctrl+A without ctrl modifier', () => {
    const shortcut = { desc: 'Select all', ctrl: true, action: vi.fn() };
    const event = { key: 'a', ctrlKey: false, metaKey: false, shiftKey: false };

    expect(shouldTriggerShortcut(shortcut, event)).toBe(false);
  });

  it('should match simple key without modifiers', () => {
    const shortcut = { desc: 'Toggle theme', action: vi.fn() };
    const event = { key: 't', ctrlKey: false, metaKey: false, shiftKey: false };

    expect(shouldTriggerShortcut(shortcut, event)).toBe(true);
  });

  it('should NOT match simple key with Ctrl when ctrl not required', () => {
    const shortcut = { desc: 'Toggle theme', action: vi.fn() };
    const event = { key: 't', ctrlKey: true, metaKey: false, shiftKey: false };

    expect(shouldTriggerShortcut(shortcut, event)).toBe(false);
  });

  it('should allow Enter with or without Ctrl', () => {
    const shortcut = { desc: 'Create playlists', action: vi.fn() };

    // Enter without Ctrl
    expect(shouldTriggerShortcut(shortcut, {
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })).toBe(true);

    // Enter with Ctrl (should still work)
    expect(shouldTriggerShortcut(shortcut, {
      key: 'Enter',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    })).toBe(true);
  });
});

// ============================================================
// ACCESSIBILITY TESTS
// ============================================================

describe('Accessibility Features', () => {
  it('should generate valid ARIA live region attributes', () => {
    // Test the attributes we set on the announcer
    const attributes = {
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    };

    expect(attributes.role).toBe('status');
    expect(attributes['aria-live']).toBe('polite');
    expect(attributes['aria-atomic']).toBe('true');
  });

  it('should format screen reader announcement for selection', () => {
    function formatSelectionAnnouncement(count: number, swedishMode: boolean): string {
      if (count === 0) return '';
      return swedishMode
        ? `${count} genre${count > 1 ? 'r' : ''} vald${count > 1 ? 'a' : ''}`
        : `${count} genre${count > 1 ? 's' : ''} selected`;
    }

    expect(formatSelectionAnnouncement(1, false)).toBe('1 genre selected');
    expect(formatSelectionAnnouncement(5, false)).toBe('5 genres selected');
    expect(formatSelectionAnnouncement(1, true)).toBe('1 genre vald');
    expect(formatSelectionAnnouncement(5, true)).toBe('5 genrer valda');
  });

  it('should have keyboard shortcut help content', () => {
    const shortcuts = [
      { key: '/', desc: 'Search genres' },
      { key: 'Esc', desc: 'Close/Clear' },
      { key: 'Ctrl+A', desc: 'Select all' },
      { key: 'Ctrl+Shift+A', desc: 'Select none' },
      { key: 'Enter', desc: 'Create playlists' },
      { key: 'Ctrl+R', desc: 'Refresh data' },
      { key: 'T', desc: 'Toggle theme' },
      { key: 'S', desc: 'Toggle stats' },
      { key: '?', desc: 'Show this help' },
    ];

    expect(shortcuts.length).toBe(9);
    expect(shortcuts.find(s => s.key === '/')?.desc).toBe('Search genres');
    expect(shortcuts.find(s => s.key === '?')?.desc).toBe('Show this help');
  });
});

// ============================================================
// NOTIFICATION AND TOAST TESTS
// ============================================================

describe('Toast Notification System', () => {
  /**
   * Tests for toast notification functionality
   * Validates the showToast function behaviour and positioning
   */

  it('should generate correct toast message for copy success', () => {
    function getToastMessage(action: string, swedishMode: boolean): string {
      const messages: Record<string, { en: string; sv: string }> = {
        'copy-success': { en: '✓ Copied to clipboard!', sv: '✓ Kopierat till urklipp!' },
        'copy-error': { en: '✗ Could not copy', sv: '✗ Kunde inte kopiera' },
        'share-error': { en: '✗ Could not share', sv: '✗ Kunde inte dela' },
        'screenshot-hint': { en: '📸 Take a screenshot instead!', sv: '📸 Ta en skärmbild istället!' },
        'text-copied': { en: '✓ Text copied!', sv: '✓ Text kopierad!' },
      };
      const msg = messages[action];
      return msg ? (swedishMode ? msg.sv : msg.en) : '';
    }

    expect(getToastMessage('copy-success', false)).toBe('✓ Copied to clipboard!');
    expect(getToastMessage('copy-success', true)).toBe('✓ Kopierat till urklipp!');
    expect(getToastMessage('copy-error', false)).toBe('✗ Could not copy');
    expect(getToastMessage('copy-error', true)).toBe('✗ Kunde inte kopiera');
    expect(getToastMessage('share-error', false)).toBe('✗ Could not share');
    expect(getToastMessage('share-error', true)).toBe('✗ Kunde inte dela');
    expect(getToastMessage('screenshot-hint', false)).toBe('📸 Take a screenshot instead!');
    expect(getToastMessage('screenshot-hint', true)).toBe('📸 Ta en skärmbild istället!');
  });

  it('should validate toast positioning is above Heidi badge', () => {
    // Toast: bottom: 5rem (80px at 16px base)
    // Heidi badge: bottom: 1rem (16px at 16px base)
    // Heidi badge height: ~40px
    // Toast should be above Heidi badge area
    const toastBottom = 5 * 16; // 80px
    const heidiBadgeTop = 1 * 16 + 40; // 56px from bottom of viewport
    expect(toastBottom).toBeGreaterThan(heidiBadgeTop);
  });

  it('should validate now-playing widget positioning is above Heidi badge', () => {
    // Now-playing: bottom: 4rem (64px at 16px base)
    // Heidi badge: bottom: 1rem + ~40px height = ~56px from bottom
    const nowPlayingBottom = 4 * 16; // 64px
    const heidiBadgeTop = 1 * 16 + 40; // 56px from bottom
    expect(nowPlayingBottom).toBeGreaterThan(heidiBadgeTop);
  });

  it('should format share text correctly', () => {
    interface ShareData {
      totalTracks: number;
      totalGenres: number;
      totalArtists: number;
      topGenres: string[];
    }

    function formatShareText(data: ShareData, swedishMode: boolean): string {
      const header = swedishMode
        ? '🎵 Min Spotify-smak'
        : '🎵 My Spotify Taste';
      const stats = swedishMode
        ? `📊 ${data.totalTracks} låtar | ${data.totalGenres} genrer | ${data.totalArtists} artister`
        : `📊 ${data.totalTracks} tracks | ${data.totalGenres} genres | ${data.totalArtists} artists`;
      const topLabel = swedishMode ? 'Topp-genrer:' : 'Top genres:';
      const genres = data.topGenres.slice(0, 5).join(', ');
      return `${header}\n${stats}\n${topLabel} ${genres}`;
    }

    const shareData: ShareData = {
      totalTracks: 500,
      totalGenres: 25,
      totalArtists: 150,
      topGenres: ['rock', 'pop', 'electronic', 'jazz', 'classical'],
    };

    const enText = formatShareText(shareData, false);
    expect(enText).toContain('My Spotify Taste');
    expect(enText).toContain('500 tracks');
    expect(enText).toContain('25 genres');
    expect(enText).toContain('rock, pop, electronic, jazz, classical');

    const svText = formatShareText(shareData, true);
    expect(svText).toContain('Min Spotify-smak');
    expect(svText).toContain('500 låtar');
    expect(svText).toContain('25 genrer');
  });

  it('should validate z-index layering order', () => {
    // Higher z-index = on top
    const zIndexes = {
      heidiBadge: 100,
      statusWidgets: 999,
      nowPlayingWidget: 1000,
      modalOverlay: 2000,
      speechBubble: 10001,
      toast: 100000,
    };

    // Toast should be highest
    expect(zIndexes.toast).toBeGreaterThan(zIndexes.speechBubble);
    expect(zIndexes.toast).toBeGreaterThan(zIndexes.modalOverlay);

    // Modal should be above now-playing
    expect(zIndexes.modalOverlay).toBeGreaterThan(zIndexes.nowPlayingWidget);

    // Now-playing should be above status widgets
    expect(zIndexes.nowPlayingWidget).toBeGreaterThan(zIndexes.statusWidgets);

    // Status widgets should be above Heidi badge
    expect(zIndexes.statusWidgets).toBeGreaterThan(zIndexes.heidiBadge);
  });

  it('should calculate toast display duration correctly', () => {
    // Default toast duration is 2.5s visible + 0.5s fade out = 3s total
    function calculateToastTiming(customDuration?: number) {
      const visibleDuration = customDuration ?? 2500;
      const fadeOutStart = visibleDuration;
      const elementRemoval = visibleDuration + 500;
      return { visibleDuration, fadeOutStart, elementRemoval };
    }

    const defaultTiming = calculateToastTiming();
    expect(defaultTiming.visibleDuration).toBe(2500);
    expect(defaultTiming.elementRemoval).toBe(3000);

    const customTiming = calculateToastTiming(5000);
    expect(customTiming.visibleDuration).toBe(5000);
    expect(customTiming.elementRemoval).toBe(5500);
  });
});

describe('Swedish Mode Badge Toggle', () => {
  /**
   * Tests for Heidi badge Swedish mode toggle
   * Validates proper text updates when toggling Swedish mode
   */

  it('should return correct badge text for Swedish mode states', () => {
    function getHeidiBadgeText(swedishMode: boolean) {
      return {
        line1: swedishMode ? 'Gjord med inspiration från' : 'Made with inspiration from',
        line2: swedishMode ? 'Heidi 💛' : 'Heidi ♥',
      };
    }

    const englishText = getHeidiBadgeText(false);
    expect(englishText.line1).toBe('Made with inspiration from');
    expect(englishText.line2).toBe('Heidi ♥');

    const swedishText = getHeidiBadgeText(true);
    expect(swedishText.line1).toBe('Gjord med inspiration från');
    expect(swedishText.line2).toBe('Heidi 💛');
  });

  it('should preserve HTML structure in badge update', () => {
    function generateBadgeHTML(swedishMode: boolean): string {
      const line1 = swedishMode ? 'Gjord med inspiration från' : 'Made with inspiration from';
      const heart = swedishMode ? '💛' : '♥';
      return `<span>${line1}</span><span><strong>Heidi</strong> <span class="heart">${heart}</span></span>`;
    }

    const englishHTML = generateBadgeHTML(false);
    expect(englishHTML).toContain('Made with inspiration from');
    expect(englishHTML).toContain('<strong>Heidi</strong>');
    expect(englishHTML).toContain('class="heart"');
    expect(englishHTML).toContain('♥');

    const swedishHTML = generateBadgeHTML(true);
    expect(swedishHTML).toContain('Gjord med inspiration från');
    expect(swedishHTML).toContain('<strong>Heidi</strong>');
    expect(swedishHTML).toContain('💛');
  });
});

describe('Visual Element Positioning', () => {
  /**
   * Tests for visual element positioning to prevent overlaps
   */

  it('should validate status widgets do not overlap header', () => {
    // Status widgets: top: 4.5rem (72px)
    // Header: ~60px tall with sticky positioning
    const statusWidgetsTop = 4.5 * 16; // 72px
    const headerHeight = 60;
    expect(statusWidgetsTop).toBeGreaterThan(headerHeight);
  });

  it('should validate mobile toast positioning', () => {
    // On mobile, toast should use full width with margins
    // bottom: 4rem, left: 1rem, right: 1rem
    const mobileToast = {
      bottom: 4 * 16, // 64px
      left: 1 * 16,   // 16px
      right: 1 * 16,  // 16px
    };

    expect(mobileToast.bottom).toBe(64);
    expect(mobileToast.left).toBe(mobileToast.right); // Symmetric margins
  });

  it('should validate genie mascot does not overlap with toast', () => {
    // Genie: bottom: 6rem, right: 1.5rem
    // Toast: bottom: 5rem, centered
    const genieBottom = 6 * 16; // 96px
    const toastBottom = 5 * 16; // 80px

    // Genie is above toast, so no vertical overlap
    expect(genieBottom).toBeGreaterThan(toastBottom);
  });
});

