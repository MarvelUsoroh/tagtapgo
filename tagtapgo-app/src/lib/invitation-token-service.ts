/**
 * Invitation Token Service
 * 
 * Handles generation, hashing, and verification of invitation tokens
 * for student signup. Uses cryptographically secure random generation
 * and bcrypt for hashing.
 */

import crypto from 'crypto';

/**
 * Number of bytes for token generation (32 bytes = 256 bits)
 * Results in 64 character hex string
 */
const TOKEN_BYTES = 32;

/**
 * Token expiration duration in days
 */
const TOKEN_EXPIRATION_DAYS = 7;

export class InvitationTokenService {
  /**
   * Generates a cryptographically secure random token
   * 
   * @returns A 64-character hexadecimal string (32 bytes)
   * 
   * Requirements: 1.1 - Token must be at least 32 bytes
   * Property 1: Token Generation Length
   */
  generateToken(): string {
    const buffer = crypto.randomBytes(TOKEN_BYTES);
    return buffer.toString('hex');
  }

  /**
   * Hashes a token using SHA-256 for secure, deterministic storage
   * SHA-256 is used instead of bcrypt because we need deterministic hashing
   * for database lookups. The token itself is cryptographically secure (32 bytes).
   * 
   * @param token - The plaintext token to hash
   * @returns The SHA-256 hash of the token
   * 
   * Requirements: 14.2 - Tokens must be stored in hashed form
   * Property 21: Token Hash Storage
   */
  async hashToken(token: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return hash;
  }

  /**
   * Verifies a token against its hash using constant-time comparison
   * 
   * @param token - The plaintext token to verify
   * @param hash - The SHA-256 hash to compare against
   * @returns True if the token matches the hash, false otherwise
   * 
   * Requirements: 14.3 - Use constant-time comparison to prevent timing attacks
   * Property 21: Token Hash Storage (verification)
   */
  async verifyToken(token: string, hash: string): Promise<boolean> {
    try {
      const tokenHash = await this.hashToken(token);
      // Use crypto.timingSafeEqual for constant-time comparison
      const tokenBuffer = Buffer.from(tokenHash);
      const hashBuffer = Buffer.from(hash);
      
      if (tokenBuffer.length !== hashBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(tokenBuffer, hashBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Calculates the expiration timestamp for a token
   * 
   * @param createdAt - Optional creation timestamp (defaults to now)
   * @returns Date object representing expiration time (7 days from creation)
   * 
   * Requirements: 1.3 - Token expiration must be 7 days from creation
   * Property 3: Token Expiration Timing
   */
  calculateExpiration(createdAt?: Date): Date {
    const baseDate = createdAt || new Date();
    const expirationDate = new Date(baseDate);
    expirationDate.setDate(expirationDate.getDate() + TOKEN_EXPIRATION_DAYS);
    return expirationDate;
  }

  /**
   * Checks if a token has expired
   * 
   * @param expiresAt - The expiration timestamp
   * @returns True if the token has expired, false otherwise
   */
  isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Generates a complete invitation token with hash and expiration
   * 
   * @returns Object containing the plaintext token, hash, and expiration date
   * 
   * Requirements: 1.1, 1.2, 1.3, 14.2
   * Properties: 1, 2, 3, 21
   */
  async generateInvitationToken(): Promise<{
    token: string;
    tokenHash: string;
    expiresAt: Date;
  }> {
    const token = this.generateToken();
    const tokenHash = await this.hashToken(token);
    const expiresAt = this.calculateExpiration();

    return {
      token,
      tokenHash,
      expiresAt,
    };
  }
}

// Export singleton instance
export const invitationTokenService = new InvitationTokenService();
