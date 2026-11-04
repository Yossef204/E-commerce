import { UnauthorizedException } from '@nestjs/common';

export const CANONICAL_TOKEN_VERSION_PREFIX = 'auth:token_version:';
export const LEGACY_TOKEN_VERSION_PREFIX = 'token_version:';
export const TOKEN_VERSION_TTL_SECONDS = 86400 * 30; // 30 days

export function getCanonicalTokenVersionKey(userId: string): string {
  return `${CANONICAL_TOKEN_VERSION_PREFIX}${userId}`;
}

export function getLegacyTokenVersionKey(userId: string): string {
  return `${LEGACY_TOKEN_VERSION_PREFIX}${userId}`;
}

/**
 * Validates and normalizes tokenVersion.
 * 
 * Rules:
 * - Missing or null values resolve to documented default (1).
 * - Preserves valid integer values including 0 and positive numbers.
 * - Strictly rejects NaN, negative numbers, non-integers, and malformed strings.
 */
export function parseAndValidateTokenVersion(
  val: any,
  context: string = 'tokenVersion',
): number {
  if (val === undefined || val === null) {
    return 1; // Documented baseline default in user.schema.ts
  }

  if (typeof val === 'string' && val.trim() === '') {
    throw new UnauthorizedException(`Invalid ${context}: empty value`);
  }

  const num = typeof val === 'number' ? val : Number(val);

  if (Number.isNaN(num)) {
    throw new UnauthorizedException(`Invalid ${context}: NaN or malformed value (${val})`);
  }

  if (!Number.isInteger(num)) {
    throw new UnauthorizedException(`Invalid ${context}: non-integer value (${val})`);
  }

  if (num < 0) {
    throw new UnauthorizedException(`Invalid ${context}: negative value (${val})`);
  }

  return num;
}

/**
 * Synchronizes authoritative tokenVersion strictly to canonical cache key:
 * auth:token_version:${userId}.
 * 
 * The legacy key (token_version:${userId}) is no longer written to eliminate
 * split-brain writes and complete key consolidation.
 */
export async function syncTokenVersionToCache(
  cacheClient: any,
  userId: string,
  version: number,
): Promise<void> {
  if (!cacheClient || !userId) return;

  const validVersion = parseAndValidateTokenVersion(version, 'syncTokenVersion');
  const canonicalKey = getCanonicalTokenVersionKey(userId);

  try {
    if (typeof cacheClient.set === 'function') {
      // Handles both ICacheService and cache-manager Cache
      await cacheClient.set(canonicalKey, validVersion, TOKEN_VERSION_TTL_SECONDS);
    }
  } catch {
    // Non-fatal cache write failure: authoritative MongoDB remains ground truth
  }
}

/**
 * Reads tokenVersion from cache using canonical key first, falling back to legacy key.
 */
export async function getCachedTokenVersion(
  cacheClient: any,
  userId: string,
): Promise<number | null> {
  if (!cacheClient || !userId) return null;

  const canonicalKey = getCanonicalTokenVersionKey(userId);
  const legacyKey = getLegacyTokenVersionKey(userId);

  try {
    let raw: any = null;
    if (typeof cacheClient.get === 'function') {
      raw = await cacheClient.get(canonicalKey);
      if (raw === null || raw === undefined) {
        raw = await cacheClient.get(legacyKey);
      }
    }

    if (raw === null || raw === undefined) {
      return null;
    }

    return parseAndValidateTokenVersion(raw, 'cachedTokenVersion');
  } catch {
    return null;
  }
}

