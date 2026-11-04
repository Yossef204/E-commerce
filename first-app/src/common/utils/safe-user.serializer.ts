/**
 * Centralized Safe User Serializer
 * Strips all authentication secrets, password hashes, OTPs, and internal security fields
 * while preserving all business profile fields and contract compatibility.
 */
export function serializeSafeUser<T = any>(userDoc: any): T {
  if (!userDoc) return userDoc;

  const raw =
    typeof userDoc.toObject === 'function'
      ? userDoc.toObject()
      : typeof userDoc === 'object'
        ? { ...userDoc }
        : userDoc;

  if (typeof raw !== 'object' || raw === null) {
    return raw as T;
  }

  const {
    password,
    emailVerificationOtpHash,
    emailVerificationOtpExpiresAt,
    resetTokenHash,
    resetOtpHash,
    resetOtpExpiresAt,
    refreshTokenHash,
    consumedTokenHashes,
    tokenVersion,
    ...safeUser
  } = raw;

  return safeUser as T;
}

export function serializeSafeUsers<T = any>(users: any[]): T[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => serializeSafeUser<T>(u));
}

