import * as crypto from 'crypto';

export class CryptoTokenUtil {
  /**
   * Computes a deterministic SHA-256 hex digest of the raw token.
   * Ensures high-speed, secure, server-side token identity tracking.
   */
  static hashToken(token: string): string {
    if (!token || typeof token !== 'string') {
      return '';
    }
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates a random cryptographically secure unique identifier (JTI).
   */
  static generateJti(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

