import { PasswordService } from '../../PasswordService';

describe('PasswordService - Unit Tests', () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    passwordService = new PasswordService();
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'Test1234';
      const hashed = await passwordService.hash(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(20);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'Test1234';
      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashed = await passwordService.hash(password);

      expect(hashed).toBeDefined();
    });
  });

  describe('compare', () => {
    it('should return true for matching password', async () => {
      const password = 'Test1234';
      const hashed = await passwordService.hash(password);
      const result = await passwordService.compare(password, hashed);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'Test1234';
      const wrongPassword = 'Wrong1234';
      const hashed = await passwordService.hash(password);
      const result = await passwordService.compare(wrongPassword, hashed);

      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const password = 'Test1234';
      const hashed = await passwordService.hash(password);
      const result = await passwordService.compare('', hashed);

      expect(result).toBe(false);
    });
  });

  describe('validate', () => {
    it('should return true for valid password', () => {
      const validPasswords = ['Test1234', 'Password123', 'SecurePass1', 'MyP@ssw0rd'];

      validPasswords.forEach((password) => {
        expect(passwordService.validate(password)).toBe(true);
      });
    });

    it('should return false for password without uppercase', () => {
      const password = 'test1234';
      expect(passwordService.validate(password)).toBe(false);
    });

    it('should return false for password without lowercase', () => {
      const password = 'TEST1234';
      expect(passwordService.validate(password)).toBe(false);
    });

    it('should return false for password without number', () => {
      const password = 'TestPassword';
      expect(passwordService.validate(password)).toBe(false);
    });

    it('should return false for password shorter than 8 characters', () => {
      const password = 'Test123';
      expect(passwordService.validate(password)).toBe(false);
    });

    it('should return false for empty password', () => {
      const password = '';
      expect(passwordService.validate(password)).toBe(false);
    });

    it('should return false for password longer than 128 characters', () => {
      const password = 'A'.repeat(100) + 'a1' + 'B'.repeat(30);
      expect(passwordService.validate(password)).toBe(false);
    });

    it('should return false for undefined password', () => {
      expect(passwordService.validate(undefined as any)).toBe(false);
    });

    it('should return false for null password', () => {
      expect(passwordService.validate(null as any)).toBe(false);
    });
  });
});
