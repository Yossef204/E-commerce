export interface DecodedJwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  sellingEntityId?: string;
  entityStatus?: string | null;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

/**
 * Safely decodes a JWT payload from a given token string.
 * Returns null if the token is invalid, corrupted, or cannot be decoded.
 */
export function decodeJwtPayload(
  token: string | null | undefined,
): DecodedJwtPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT payload:', error);
    return null;
  }
}

/**
 * Checks whether a given JWT token is expired based on the exp claim.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
}
