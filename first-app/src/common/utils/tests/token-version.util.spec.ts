import { UnauthorizedException } from '@nestjs/common';
import {
  parseAndValidateTokenVersion,
  getCanonicalTokenVersionKey,
  getLegacyTokenVersionKey,
  syncTokenVersionToCache,
  getCachedTokenVersion,
} from '../token-version.util';

describe('TokenVersion Utilities — Unit Tests', () => {
  describe('parseAndValidateTokenVersion', () => {
    it('preserves 0 as a valid tokenVersion', () => {
      expect(parseAndValidateTokenVersion(0)).toBe(0);
      expect(parseAndValidateTokenVersion('0')).toBe(0);
    });

    it('preserves 1 as a valid tokenVersion', () => {
      expect(parseAndValidateTokenVersion(1)).toBe(1);
      expect(parseAndValidateTokenVersion('1')).toBe(1);
    });

    it('preserves positive integers', () => {
      expect(parseAndValidateTokenVersion(42)).toBe(42);
      expect(parseAndValidateTokenVersion('100')).toBe(100);
    });

    it('resolves undefined to baseline default (1)', () => {
      expect(parseAndValidateTokenVersion(undefined)).toBe(1);
    });

    it('resolves null to baseline default (1)', () => {
      expect(parseAndValidateTokenVersion(null)).toBe(1);
    });

    it('rejects negative numbers with UnauthorizedException', () => {
      expect(() => parseAndValidateTokenVersion(-1)).toThrow(UnauthorizedException);
      expect(() => parseAndValidateTokenVersion('-5')).toThrow(UnauthorizedException);
    });

    it('rejects NaN and malformed strings with UnauthorizedException', () => {
      expect(() => parseAndValidateTokenVersion('invalid_version')).toThrow(UnauthorizedException);
      expect(() => parseAndValidateTokenVersion(NaN)).toThrow(UnauthorizedException);
      expect(() => parseAndValidateTokenVersion('')).toThrow(UnauthorizedException);
    });

    it('rejects non-integer floating point numbers with UnauthorizedException', () => {
      expect(() => parseAndValidateTokenVersion(1.5)).toThrow(UnauthorizedException);
      expect(() => parseAndValidateTokenVersion('3.1415')).toThrow(UnauthorizedException);
    });
  });

  describe('Key formatting and cache functions', () => {
    it('generates canonical and legacy keys consistently', () => {
      const userId = '650000000000000000000001';
      expect(getCanonicalTokenVersionKey(userId)).toBe(`auth:token_version:${userId}`);
      expect(getLegacyTokenVersionKey(userId)).toBe(`token_version:${userId}`);
    });

    it('synchronizes tokenVersion strictly to canonical key and no longer writes legacy key', async () => {
      const storage = new Map<string, any>();
      const mockCache = {
        set: jest.fn().mockImplementation((k, v) => storage.set(k, v)),
        get: jest.fn().mockImplementation((k) => storage.get(k)),
      };

      await syncTokenVersionToCache(mockCache, 'user123', 0);
      expect(storage.get('auth:token_version:user123')).toBe(0);
      expect(storage.get('token_version:user123')).toBeUndefined();
    });

    it('reads from canonical key if present', async () => {
      const mockCache = {
        get: jest.fn().mockImplementation((k) => {
          if (k === 'auth:token_version:user123') return 3;
          return null;
        }),
      };
      const version = await getCachedTokenVersion(mockCache, 'user123');
      expect(version).toBe(3);
    });

    it('falls back to legacy key if canonical key is missing', async () => {
      const mockCache = {
        get: jest.fn().mockImplementation((k) => {
          if (k === 'token_version:user123') return 5;
          return null;
        }),
      };
      const version = await getCachedTokenVersion(mockCache, 'user123');
      expect(version).toBe(5);
    });
  });
});

