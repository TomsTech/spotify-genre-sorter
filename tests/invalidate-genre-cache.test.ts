import { describe, it, expect, vi } from 'vitest';
import { invalidateGenreCache, GENRE_CACHE_PREFIX } from '../src/routes/api';

describe('invalidateGenreCache', () => {
  it('should call kv.delete with the correct cache key', async () => {
    // Arrange
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockKv = {
      delete: mockDelete,
    } as unknown as KVNamespace;
    const spotifyUserId = 'testuser123';

    // Act
    await invalidateGenreCache(mockKv, spotifyUserId);

    // Assert
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(`${GENRE_CACHE_PREFIX}${spotifyUserId}`);
  });
});
