import { describe, it, expect } from 'vitest';
import { aggregateGenresFromTracks } from '../src/routes/api';

describe('aggregateGenresFromTracks', () => {
  it('should aggregate genres correctly for a single track with one artist', () => {
    const tracks = [
      { track: { id: 't1', artists: [{ id: 'a1' }] } }
    ];
    const artistGenreMap = new Map([
      ['a1', ['rock', 'pop']]
    ]);

    const result = aggregateGenresFromTracks(tracks, artistGenreMap);

    expect(result.size).toBe(2);
    expect(result.get('rock')).toEqual({ count: 1, trackIds: ['t1'] });
    expect(result.get('pop')).toEqual({ count: 1, trackIds: ['t1'] });
  });

  it('should not double-count a genre if multiple artists on the same track have the same genre', () => {
    const tracks = [
      { track: { id: 't1', artists: [{ id: 'a1' }, { id: 'a2' }] } }
    ];
    const artistGenreMap = new Map([
      ['a1', ['rock']],
      ['a2', ['rock', 'indie']]
    ]);

    const result = aggregateGenresFromTracks(tracks, artistGenreMap);

    expect(result.size).toBe(2);
    expect(result.get('rock')).toEqual({ count: 1, trackIds: ['t1'] }); // Only counted once
    expect(result.get('indie')).toEqual({ count: 1, trackIds: ['t1'] });
  });

  it('should accumulate genres across multiple tracks', () => {
    const tracks = [
      { track: { id: 't1', artists: [{ id: 'a1' }] } },
      { track: { id: 't2', artists: [{ id: 'a2' }] } }
    ];
    const artistGenreMap = new Map([
      ['a1', ['rock', 'pop']],
      ['a2', ['rock', 'metal']]
    ]);

    const result = aggregateGenresFromTracks(tracks, artistGenreMap);

    expect(result.size).toBe(3);
    expect(result.get('rock')).toEqual({ count: 2, trackIds: ['t1', 't2'] });
    expect(result.get('pop')).toEqual({ count: 1, trackIds: ['t1'] });
    expect(result.get('metal')).toEqual({ count: 1, trackIds: ['t2'] });
  });

  it('should append to an existing genreData map if provided', () => {
    const tracks = [
      { track: { id: 't1', artists: [{ id: 'a1' }] } }
    ];
    const artistGenreMap = new Map([
      ['a1', ['rock']]
    ]);
    const existingData = new Map([
      ['rock', { count: 1, trackIds: ['t0'] }],
      ['jazz', { count: 1, trackIds: ['t0'] }]
    ]);

    const result = aggregateGenresFromTracks(tracks, artistGenreMap, existingData);

    expect(result).toBe(existingData); // Should mutate and return the same map
    expect(result.size).toBe(2);
    expect(result.get('rock')).toEqual({ count: 2, trackIds: ['t0', 't1'] });
    expect(result.get('jazz')).toEqual({ count: 1, trackIds: ['t0'] });
  });

  it('should handle artists with no genres', () => {
    const tracks = [
      { track: { id: 't1', artists: [{ id: 'a1' }] } }
    ];
    const artistGenreMap = new Map<string, string[]>(); // Empty map

    const result = aggregateGenresFromTracks(tracks, artistGenreMap);

    expect(result.size).toBe(0);
  });

  it('should handle empty tracks array', () => {
    const tracks: any[] = [];
    const artistGenreMap = new Map([['a1', ['rock']]]);

    const result = aggregateGenresFromTracks(tracks, artistGenreMap);

    expect(result.size).toBe(0);
  });
});
