/**
 * Unit tests for PasswordService
 */

import { describe, it, expect } from 'vitest';
import { PasswordService } from '@domain/auth/password-service';

describe('PasswordService', () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    passwordService = new PasswordService();
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe('string');
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'MySecurePassword123!';
      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      // Bcrypt uses salts, so same password should produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should hash different passwords differently', async () => {
      const hash1 = await passwordService.hash('Password1!');
      const hash2 = await passwordService.hash('Password2!');

      expect(hash1).not.toBe(hash2);
    });

    it('should start with bcrypt identifier', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hashed).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      const isValid = await passwordService.verify(password, hashed);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      const isValid = await passwordService.verify('WrongPassword!', hashed);

      expect(isValid).toBe(false);
    });

    it('should reject password with different case', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      const isValid = await passwordService.verify('mysecurepassword123!', hashed);

      expect(isValid).toBe(false);
    });

    it('should reject password with extra characters', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      const isValid = await passwordService.verify('MySecurePassword123!extra', hashed);

      expect(isValid).toBe(false);
    });

    it('should reject password missing characters', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await passwordService.hash(password);

      const isValid = await passwordService.verify('MySecurePassword123', hashed);

      expect(isValid).toBe(false);
    });

    it('should handle empty password gracefully', async () => {
      const hashed = await passwordService.hash('ValidPassword123!');

      const isValid = await passwordService.verify('', hashed);

      expect(isValid).toBe(false);
    });
  });

  describe('hash and verify integration', () => {
    it('should work for multiple passwords', async () => {
      const passwords = [
        'Password1!',
        'AnotherPassword2@',
        'YetAnotherPassword3#',
        'ComplexP@ssw0rd!',
      ];

      for (const password of passwords) {
        const hashed = await passwordService.hash(password);
        const isValid = await passwordService.verify(password, hashed);
        expect(isValid).toBe(true);
      }
    });

    it('should maintain hash security with special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hashed = await passwordService.hash(password);
      const isValid = await passwordService.verify(password, hashed);

      expect(isValid).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const password = 'Пароль123!'; // Cyrillic password
      const hashed = await passwordService.hash(password);
      const isValid = await passwordService.verify(password, hashed);

      expect(isValid).toBe(true);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(100) + 'A1!';
      const hashed = await passwordService.hash(password);
      const isValid = await passwordService.verify(password, hashed);

      expect(isValid).toBe(true);
    });
  });
});
