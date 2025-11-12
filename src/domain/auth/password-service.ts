/**
 * Password hashing and verification service
 * Layer 2: Infrastructure
 */

import * as bcrypt from 'bcrypt';
import { logger } from '@infrastructure/logging/logger';

const SALT_ROUNDS = 10;

/**
 * Password service for hashing and verification
 */
export class PasswordService {
  /**
   * Hash a password
   * @param password - Plain text password
   * @returns Hashed password
   */
  async hash(password: string): Promise<string> {
    try {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      logger.debug('Password hashed successfully');
      return hashed;
    } catch (error) {
      logger.error({ error }, 'Failed to hash password');
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against a hash
   * @param password - Plain text password
   * @param hashedPassword - Hashed password to compare against
   * @returns True if password matches
   */
  async verify(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      logger.debug({ isMatch }, 'Password verification completed');
      return isMatch;
    } catch (error) {
      logger.error({ error }, 'Failed to verify password');
      throw new Error('Password verification failed');
    }
  }

  /**
   * Check if a password needs rehashing (algorithm changed, rounds changed, etc.)
   * @param hashedPassword - Hashed password to check
   * @returns True if password needs rehashing
   */
  needsRehash(hashedPassword: string): boolean {
    try {
      const rounds = bcrypt.getRounds(hashedPassword);
      return rounds !== SALT_ROUNDS;
    } catch (error) {
      logger.warn({ error }, 'Failed to check if password needs rehashing');
      return false;
    }
  }
}

// Export singleton instance
export const passwordService = new PasswordService();
