import { describe, it, expect } from 'vitest';
import { validateTrackIds } from '../src/routes/api';

describe('validateTrackIds', () => {
  it('should validate valid track ids', () => {
    const validIds = ['01234567890123456789ab', 'abcdefghijklmnopqrstuv'];
    const result = validateTrackIds(validIds);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toEqual(validIds);
    }
  });

  it('should return error for non-array', () => {
    const result = validateTrackIds('not-an-array');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('trackIds must be an array');
    }
  });

  it('should return error for empty array', () => {
    const result = validateTrackIds([]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('trackIds cannot be empty');
    }
  });

  it('should return error for too many tracks', () => {
    // MAX_TRACK_IDS is 10000
    const tooMany = new Array(10001).fill('01234567890123456789ab');
    const result = validateTrackIds(tooMany);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('trackIds exceeds maximum');
    }
  });

  it('should return error for invalid track format (wrong length)', () => {
    const invalidIds = ['short', '01234567890123456789ab'];
    const result = validateTrackIds(invalidIds);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Invalid track ID format detected');
    }
  });

  it('should return error for invalid track format (wrong characters)', () => {
    const invalidIds = ['01234567890123456789-+', '01234567890123456789ab'];
    const result = validateTrackIds(invalidIds);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Invalid track ID format detected');
    }
  });

  it('should return error for invalid track format (not a string)', () => {
    const invalidIds = [123, '01234567890123456789ab'];
    const result = validateTrackIds(invalidIds);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Invalid track ID format detected');
    }
  });
});
