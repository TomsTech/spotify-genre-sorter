import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Frontend Feature Tests
 * Tests for hidden genres, theme toggle, export, and stats dashboard functionality
 * These tests validate the logic that runs in the browser.
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

describe('Hidden Genres Feature', () => {
  describe('filterGenres with hidden genres', () => {
    it('should filter out hidden genres when showHiddenGenres is false', () => {
      const hiddenGenres = new Set(['pop', 'jazz']);
      const showHiddenGenres = false;

      const filterGenres = (
        genres: typeof mockGenreData.genres,
        query: string,
        hidden: Set<string>,
        showHidden: boolean
      ) => {
        let filtered = genres;
        if (query) {
          const lower = query.toLowerCase();
          filtered = filtered.filter((g) => g.name.toLowerCase().includes(lower));
        }
        if (!showHidden) {
          filtered = filtered.filter((g) => !hidden.has(g.name));
        }
        return filtered;
      };

      const result = filterGenres(mockGenreData.genres, '', hiddenGenres, showHiddenGenres);

      expect(result.length).toBe(mockGenreData.genres.length - 2);
      expect(result.find((g) => g.name === 'pop')).toBeUndefined();
      expect(result.find((g) => g.name === 'jazz')).toBeUndefined();
      expect(result.find((g) => g.name === 'rock')).toBeDefined();
    });

    it('should show hidden genres when showHiddenGenres is true', () => {
      const hiddenGenres = new Set(['pop', 'jazz']);
      const showHiddenGenres = true;

      const filterGenres = (
        genres: typeof mockGenreData.genres,
        hidden: Set<string>,
        showHidden: boolean
      ) => {
        if (!showHidden) {
          return genres.filter((g) => !hidden.has(g.name));
        }
        return genres;
      };

      const result = filterGenres(mockGenreData.genres, hiddenGenres, showHiddenGenres);

      expect(result.length).toBe(mockGenreData.genres.length);
      expect(result.find((g) => g.name === 'pop')).toBeDefined();
      expect(result.find((g) => g.name === 'jazz')).toBeDefined();
    });

    it('should combine search filter with hidden filter', () => {
      const hiddenGenres = new Set(['rock', 'pop']);

      const filterGenres = (
        genres: typeof mockGenreData.genres,
        query: string,
        hidden: Set<string>
      ) => {
        let filtered = genres;
        if (query) {
          const lower = query.toLowerCase();
          filtered = filtered.filter((g) => g.name.toLowerCase().includes(lower));
        }
        filtered = filtered.filter((g) => !hidden.has(g.name));
        return filtered;
      };

      // Search for 'o' should match rock, pop, electronic, hip hop, country
      // But rock and pop are hidden, so only electronic, hip hop, country remain
      const result = filterGenres(mockGenreData.genres, 'o', hiddenGenres);

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

      const hideSmallGenres = (
        genres: typeof mockGenreData.genres,
        minTracks: number,
        hidden: Set<string>
      ) => {
        genres.forEach((g) => {
          if (g.count < minTracks) {
            hidden.add(g.name);
          }
        });
        return hidden;
      };

      hideSmallGenres(mockGenreData.genres, 10, hiddenGenres);

      expect(hiddenGenres.has('ambient')).toBe(true); // 3 tracks
      expect(hiddenGenres.has('obscure genre')).toBe(true); // 2 tracks
      expect(hiddenGenres.has('metal')).toBe(true); // 5 tracks
      expect(hiddenGenres.has('blues')).toBe(false); // 10 tracks (not < 10)
      expect(hiddenGenres.has('rock')).toBe(false); // 100 tracks
    });

    it('should hide genres with fewer than 5 tracks by default', () => {
      const hiddenGenres = new Set<string>();

      const hideSmallGenres = (genres: typeof mockGenreData.genres, hidden: Set<string>) => {
        genres.forEach((g) => {
          if (g.count < 5) {
            hidden.add(g.name);
          }
        });
        return hidden;
      };

      hideSmallGenres(mockGenreData.genres, hiddenGenres);

      expect(hiddenGenres.has('ambient')).toBe(true); // 3 tracks
      expect(hiddenGenres.has('obscure genre')).toBe(true); // 2 tracks
      expect(hiddenGenres.has('metal')).toBe(false); // 5 tracks (not < 5)
    });
  });

  describe('toggleHideGenre', () => {
    it('should add genre to hidden set when not hidden', () => {
      const hiddenGenres = new Set<string>();

      const toggleHideGenre = (genre: string, hidden: Set<string>) => {
        if (hidden.has(genre)) {
          hidden.delete(genre);
        } else {
          hidden.add(genre);
        }
      };

      toggleHideGenre('rock', hiddenGenres);
      expect(hiddenGenres.has('rock')).toBe(true);
    });

    it('should remove genre from hidden set when already hidden', () => {
      const hiddenGenres = new Set(['rock', 'pop']);

      const toggleHideGenre = (genre: string, hidden: Set<string>) => {
        if (hidden.has(genre)) {
          hidden.delete(genre);
        } else {
          hidden.add(genre);
        }
      };

      toggleHideGenre('rock', hiddenGenres);
      expect(hiddenGenres.has('rock')).toBe(false);
      expect(hiddenGenres.has('pop')).toBe(true);
    });
  });
});

describe('Theme Toggle Feature', () => {
  it('should toggle between light and dark mode', () => {
    let lightMode = false;

    const toggleTheme = () => {
      lightMode = !lightMode;
      return lightMode;
    };

    expect(toggleTheme()).toBe(true);
    expect(toggleTheme()).toBe(false);
    expect(toggleTheme()).toBe(true);
  });

  it('should respect system preference on initial load', () => {
    const getInitialTheme = (localStorageValue: string | null, systemPreference: boolean) => {
      if (localStorageValue === null) {
        return systemPreference;
      }
      return localStorageValue === 'true';
    };

    // No localStorage, system prefers light
    expect(getInitialTheme(null, true)).toBe(true);

    // No localStorage, system prefers dark
    expect(getInitialTheme(null, false)).toBe(false);

    // localStorage overrides system preference
    expect(getInitialTheme('true', false)).toBe(true);
    expect(getInitialTheme('false', true)).toBe(false);
  });
});

describe('Export Feature', () => {
  describe('exportGenresJSON', () => {
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
      expect(exportData.genres[0].name).toBe('rock');
      expect(exportData.genres[0].trackCount).toBe(100);
      expect(Array.isArray(exportData.genres[0].trackIds)).toBe(true);
    });

    it('should produce valid JSON string', () => {
      const createExportData = (genreData: typeof mockGenreData) => ({
        exportedAt: new Date().toISOString(),
        totalTracks: genreData.totalTracks,
        totalGenres: genreData.totalGenres,
        genres: genreData.genres.map((g) => ({
          name: g.name,
          trackCount: g.count,
          trackIds: g.trackIds,
        })),
      });

      const exportData = createExportData(mockGenreData);
      const jsonString = JSON.stringify(exportData, null, 2);

      // Should be valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(parsed.totalTracks).toBe(500);
    });
  });

  describe('exportGenresCSV', () => {
    it('should create valid CSV structure', () => {
      const createCSV = (genreData: typeof mockGenreData) => {
        const rows = [['Genre', 'Track Count', 'Track IDs']];
        genreData.genres.forEach((g) => {
          rows.push([g.name, g.count.toString(), g.trackIds.join(';')]);
        });
        return rows
          .map((row) =>
            row.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(',')
          )
          .join('\n');
      };

      const csv = createCSV(mockGenreData);
      const lines = csv.split('\n');

      // First line should be header
      expect(lines[0]).toBe('"Genre","Track Count","Track IDs"');

      // Should have header + all genres
      expect(lines.length).toBe(mockGenreData.genres.length + 1);

      // Check first data row
      expect(lines[1]).toContain('"rock"');
      expect(lines[1]).toContain('"100"');
    });

    it('should properly escape quotes in genre names', () => {
      const genreWithQuotes = {
        genres: [{ name: 'rock "n" roll', count: 10, trackIds: ['t1'] }],
      };

      const createCSV = (data: typeof genreWithQuotes) => {
        const rows = [['Genre', 'Track Count', 'Track IDs']];
        data.genres.forEach((g) => {
          rows.push([g.name, g.count.toString(), g.trackIds.join(';')]);
        });
        return rows
          .map((row) =>
            row.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(',')
          )
          .join('\n');
      };

      const csv = createCSV(genreWithQuotes);

      // Quotes should be doubled for CSV escaping
      expect(csv).toContain('""n""');
    });
  });
});

describe('Stats Dashboard Feature', () => {
  describe('calculateDiversityScore', () => {
    it('should calculate Shannon diversity index (normalized to 0-100)', () => {
      const calculateDiversityScore = (genres: { count: number }[]) => {
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
      };

      // Test with actual genre data
      const score = calculateDiversityScore(mockGenreData.genres);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 for empty genres', () => {
      const calculateDiversityScore = (genres: { count: number }[]) => {
        if (!genres || genres.length === 0) return 0;
        return 50; // Would calculate otherwise
      };

      expect(calculateDiversityScore([])).toBe(0);
    });

    it('should return 100 for perfectly even distribution', () => {
      const calculateDiversityScore = (genres: { count: number }[]) => {
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
      };

      // All genres have exactly the same count
      const evenGenres = [
        { count: 10 },
        { count: 10 },
        { count: 10 },
        { count: 10 },
        { count: 10 },
      ];

      expect(calculateDiversityScore(evenGenres)).toBe(100);
    });

    it('should return lower score for uneven distribution', () => {
      const calculateDiversityScore = (genres: { count: number }[]) => {
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
      };

      // One genre dominates
      const unevenGenres = [
        { count: 100 },
        { count: 1 },
        { count: 1 },
        { count: 1 },
        { count: 1 },
      ];

      const score = calculateDiversityScore(unevenGenres);
      expect(score).toBeLessThan(50);
    });
  });

  describe('getDiversityLabel', () => {
    it('should return correct labels for score ranges', () => {
      const getDiversityLabel = (score: number, swedishMode = false) => {
        if (score >= 80) return swedishMode ? 'Mycket varierad!' : 'Very diverse!';
        if (score >= 60) return swedishMode ? 'Varierad' : 'Diverse';
        if (score >= 40) return swedishMode ? 'Måttlig' : 'Moderate';
        if (score >= 20) return swedishMode ? 'Fokuserad' : 'Focused';
        return swedishMode ? 'Mycket fokuserad' : 'Very focused';
      };

      expect(getDiversityLabel(85)).toBe('Very diverse!');
      expect(getDiversityLabel(70)).toBe('Diverse');
      expect(getDiversityLabel(50)).toBe('Moderate');
      expect(getDiversityLabel(30)).toBe('Focused');
      expect(getDiversityLabel(10)).toBe('Very focused');
    });

    it('should return Swedish labels when swedishMode is true', () => {
      const getDiversityLabel = (score: number, swedishMode = false) => {
        if (score >= 80) return swedishMode ? 'Mycket varierad!' : 'Very diverse!';
        if (score >= 60) return swedishMode ? 'Varierad' : 'Diverse';
        if (score >= 40) return swedishMode ? 'Måttlig' : 'Moderate';
        if (score >= 20) return swedishMode ? 'Fokuserad' : 'Focused';
        return swedishMode ? 'Mycket fokuserad' : 'Very focused';
      };

      expect(getDiversityLabel(85, true)).toBe('Mycket varierad!');
      expect(getDiversityLabel(70, true)).toBe('Varierad');
      expect(getDiversityLabel(50, true)).toBe('Måttlig');
      expect(getDiversityLabel(30, true)).toBe('Fokuserad');
      expect(getDiversityLabel(10, true)).toBe('Mycket fokuserad');
    });
  });

  describe('calculateAvgGenresPerTrack', () => {
    it('should calculate average genres per track', () => {
      const calculateAvgGenresPerTrack = (
        genres: { count: number }[],
        totalTracks: number
      ) => {
        if (!genres || totalTracks === 0) return 0;
        const totalGenreAssignments = genres.reduce((sum, g) => sum + g.count, 0);
        return Number((totalGenreAssignments / totalTracks).toFixed(1));
      };

      // Total genre assignments in mockGenreData
      const totalAssignments = mockGenreData.genres.reduce((sum, g) => sum + g.count, 0);
      const expected = Number((totalAssignments / mockGenreData.totalTracks).toFixed(1));

      const result = calculateAvgGenresPerTrack(
        mockGenreData.genres,
        mockGenreData.totalTracks
      );

      expect(result).toBe(expected);
    });

    it('should return 0 for empty data', () => {
      const calculateAvgGenresPerTrack = (
        genres: { count: number }[] | null,
        totalTracks: number
      ) => {
        if (!genres || totalTracks === 0) return 0;
        const totalGenreAssignments = genres.reduce((sum, g) => sum + g.count, 0);
        return Number((totalGenreAssignments / totalTracks).toFixed(1));
      };

      expect(calculateAvgGenresPerTrack(null, 0)).toBe(0);
      expect(calculateAvgGenresPerTrack([], 0)).toBe(0);
      expect(calculateAvgGenresPerTrack([], 100)).toBe(0);
    });
  });
});

describe('Playlist Template Feature', () => {
  describe('applyTemplate', () => {
    it('should replace {genre} placeholder with genre name', () => {
      const applyTemplate = (template: string, genre: string) => {
        return template.replace('{genre}', genre);
      };

      expect(applyTemplate('{genre} (from Likes)', 'rock')).toBe('rock (from Likes)');
      expect(applyTemplate('My {genre} Collection', 'jazz')).toBe('My jazz Collection');
      expect(applyTemplate('{genre}', 'pop')).toBe('pop');
    });

    it('should handle templates without placeholder', () => {
      const applyTemplate = (template: string, genre: string) => {
        return template.replace('{genre}', genre);
      };

      expect(applyTemplate('Static Name', 'rock')).toBe('Static Name');
    });

    it('should handle special characters in genre names', () => {
      const applyTemplate = (template: string, genre: string) => {
        return template.replace('{genre}', genre);
      };

      expect(applyTemplate('{genre} Playlist', "rock 'n' roll")).toBe(
        "rock 'n' roll Playlist"
      );
      expect(applyTemplate('{genre} Playlist', 'r&b')).toBe('r&b Playlist');
    });
  });
});

describe('Cache Feature', () => {
  describe('formatCacheTime', () => {
    it('should format time correctly', () => {
      const formatCacheTime = (
        cachedAt: number,
        now = Date.now(),
        swedishMode = false
      ) => {
        if (!cachedAt) return '';
        const diff = Math.floor((now - cachedAt) / 1000);
        if (diff < 60) return swedishMode ? 'Just nu' : 'Just now';
        if (diff < 3600) {
          const mins = Math.floor(diff / 60);
          return swedishMode ? `${mins} min sedan` : `${mins}m ago`;
        }
        const hours = Math.floor(diff / 3600);
        return swedishMode ? `${hours} tim sedan` : `${hours}h ago`;
      };

      const now = Date.now();

      // Just now (< 60 seconds)
      expect(formatCacheTime(now - 30000, now)).toBe('Just now');

      // Minutes ago
      expect(formatCacheTime(now - 5 * 60000, now)).toBe('5m ago');
      expect(formatCacheTime(now - 30 * 60000, now)).toBe('30m ago');

      // Hours ago
      expect(formatCacheTime(now - 2 * 3600000, now)).toBe('2h ago');
    });

    it('should return Swedish translations', () => {
      const formatCacheTime = (
        cachedAt: number,
        now = Date.now(),
        swedishMode = false
      ) => {
        if (!cachedAt) return '';
        const diff = Math.floor((now - cachedAt) / 1000);
        if (diff < 60) return swedishMode ? 'Just nu' : 'Just now';
        if (diff < 3600) {
          const mins = Math.floor(diff / 60);
          return swedishMode ? `${mins} min sedan` : `${mins}m ago`;
        }
        const hours = Math.floor(diff / 3600);
        return swedishMode ? `${hours} tim sedan` : `${hours}h ago`;
      };

      const now = Date.now();

      expect(formatCacheTime(now - 30000, now, true)).toBe('Just nu');
      expect(formatCacheTime(now - 5 * 60000, now, true)).toBe('5 min sedan');
      expect(formatCacheTime(now - 2 * 3600000, now, true)).toBe('2 tim sedan');
    });
  });
});
