import { ZodError } from 'zod';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  passwordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  paginationSchema,
  searchSchema,
} from '../../schemas';

describe('Validation Schemas - Unit Tests', () => {
  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test1234',
        fullName: 'Test User',
      };

      const result = registerSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should validate without optional fullName', () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test1234',
      };

      const result = registerSchema.parse(validData);
      expect(result).toBeDefined();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test1234',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('should reject username shorter than 3 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'ab',
        password: 'Test1234',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject username longer than 30 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'a'.repeat(31),
        password: 'Test1234',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject username with special characters', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'test@user',
        password: 'Test1234',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should accept username with underscores', () => {
      const validData = {
        email: 'test@example.com',
        username: 'test_user',
        password: 'Test1234',
      };

      const result = registerSchema.parse(validData);
      expect(result.username).toBe('test_user');
    });

    it('should reject password shorter than 8 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject password without uppercase', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'test1234',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject password without lowercase', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TEST1234',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject password without number', () => {
      const invalidData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestTest',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        emailOrUsername: 'testuser',
        password: 'Test1234',
      };

      const result = loginSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should accept email as emailOrUsername', () => {
      const validData = {
        emailOrUsername: 'test@example.com',
        password: 'Test1234',
      };

      const result = loginSchema.parse(validData);
      expect(result).toBeDefined();
    });

    it('should reject empty emailOrUsername', () => {
      const invalidData = {
        emailOrUsername: '',
        password: 'Test1234',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty password', () => {
      const invalidData = {
        emailOrUsername: 'testuser',
        password: '',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow();
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate correct password change data', () => {
      const validData = {
        oldPassword: 'OldPass123',
        newPassword: 'NewPass123',
      };

      const result = changePasswordSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid new password', () => {
      const invalidData = {
        oldPassword: 'OldPass123',
        newPassword: 'weak',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty old password', () => {
      const invalidData = {
        oldPassword: '',
        newPassword: 'NewPass123',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow();
    });
  });

  describe('passwordSchema (shared by register, change password and reset password)', () => {
    it('should accept a password that meets every rule', () => {
      expect(passwordSchema.parse('Password1')).toBe('Password1');
    });

    it.each([
      ['Ab1', 'Password must be at least 8 characters'],
      [`Aa1${'x'.repeat(126)}`, 'Password must be at most 128 characters'],
      ['password1', 'Password must contain at least one uppercase letter'],
      ['PASSWORD1', 'Password must contain at least one lowercase letter'],
      ['Passwordd', 'Password must contain at least one number'],
    ])('should reject "%s"', (password, message) => {
      const result = passwordSchema.safeParse(password);

      expect(result.success).toBe(false);
      expect(result.error?.errors.map((e) => e.message)).toEqual([message]);
    });

    it('should accept a password of exactly 128 characters', () => {
      expect(passwordSchema.safeParse(`Aa1${'x'.repeat(125)}`).success).toBe(true);
    });

    it('should report every broken rule, in rule order', () => {
      const result = passwordSchema.safeParse('weak');

      expect(result.error?.errors.map((e) => e.message)).toEqual([
        'Password must be at least 8 characters',
        'Password must contain at least one uppercase letter',
        'Password must contain at least one number',
      ]);
    });

    it('should reject values that are not strings', () => {
      expect(passwordSchema.safeParse(12345678).success).toBe(false);
    });

    it.each(['Ab1', 'password1', 'PASSWORD1', 'Passwordd'])(
      'should apply the same rules to registration, change password and reset for "%s"',
      (password) => {
        const register = registerSchema.safeParse({
          email: 'a@example.com',
          username: 'chef',
          password,
        });
        const change = changePasswordSchema.safeParse({ oldPassword: 'x', newPassword: password });
        const reset = resetPasswordSchema.safeParse({ token: 't', password });

        const messages = (r: typeof register | typeof change | typeof reset) =>
          r.success ? [] : r.error.errors.map((e) => e.message);
        expect(messages(register)).toEqual(messages(reset));
        expect(messages(change)).toEqual(messages(reset));
        expect(messages(reset).length).toBeGreaterThan(0);
      }
    );
  });

  describe('forgotPasswordSchema', () => {
    it('should accept an email or a username', () => {
      expect(forgotPasswordSchema.parse({ emailOrUsername: 'chef@example.com' })).toEqual({
        emailOrUsername: 'chef@example.com',
      });
      expect(forgotPasswordSchema.parse({ emailOrUsername: 'chef' })).toEqual({
        emailOrUsername: 'chef',
      });
    });

    it('should trim surrounding whitespace', () => {
      expect(forgotPasswordSchema.parse({ emailOrUsername: '  chef  ' })).toEqual({
        emailOrUsername: 'chef',
      });
    });

    it('should reject a blank identifier', () => {
      expect(() => forgotPasswordSchema.parse({ emailOrUsername: '   ' })).toThrow(ZodError);
    });

    it('should reject a missing identifier', () => {
      expect(() => forgotPasswordSchema.parse({})).toThrow(ZodError);
    });

    it('should reject an identifier longer than 254 characters', () => {
      expect(() => forgotPasswordSchema.parse({ emailOrUsername: 'a'.repeat(255) })).toThrow(
        ZodError
      );
    });
  });

  describe('resetPasswordSchema', () => {
    it('should accept a token and a valid password', () => {
      const data = { token: 'raw-token', password: 'Password1' };

      expect(resetPasswordSchema.parse(data)).toEqual(data);
    });

    it('should reject a missing token', () => {
      expect(() => resetPasswordSchema.parse({ password: 'Password1' })).toThrow(ZodError);
    });

    it('should reject an empty token', () => {
      expect(() => resetPasswordSchema.parse({ token: '', password: 'Password1' })).toThrow(
        ZodError
      );
    });

    it('should reject an absurdly long token', () => {
      expect(() =>
        resetPasswordSchema.parse({ token: 'a'.repeat(257), password: 'Password1' })
      ).toThrow(ZodError);
    });

    it('should reject a weak password', () => {
      expect(() => resetPasswordSchema.parse({ token: 'raw-token', password: 'weak' })).toThrow(
        ZodError
      );
    });
  });

  describe('updateProfileSchema', () => {
    it('should validate correct profile update data', () => {
      const validData = {
        fullName: 'Updated Name',
        bio: 'Updated bio',
        avatar: 'https://example.com/avatar.jpg',
        website: 'https://example.com',
        isPrivate: true,
      };

      const result = updateProfileSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should accept partial updates', () => {
      const validData = {
        fullName: 'Updated Name',
      };

      const result = updateProfileSchema.parse(validData);
      expect(result.fullName).toBe('Updated Name');
    });

    it('should reject fullName longer than 50 characters', () => {
      const invalidData = {
        fullName: 'a'.repeat(51),
      };

      expect(() => updateProfileSchema.parse(invalidData)).toThrow();
    });

    it('should reject bio longer than 300 characters', () => {
      const invalidData = {
        bio: 'a'.repeat(301),
      };

      expect(() => updateProfileSchema.parse(invalidData)).toThrow();
    });

    it('should accept avatar as relative path (legacy)', () => {
      const validData = {
        avatar: '/uploads/avatars/image.jpg',
      };

      const result = updateProfileSchema.parse(validData);
      expect(result.avatar).toBe('/uploads/avatars/image.jpg');
    });

    it('should accept avatar as Cloudinary URL', () => {
      const validData = {
        avatar: 'https://res.cloudinary.com/demo/image/upload/v1234567890/avatars/abc123.jpg',
      };

      const result = updateProfileSchema.parse(validData);
      expect(result.avatar).toBe(
        'https://res.cloudinary.com/demo/image/upload/v1234567890/avatars/abc123.jpg'
      );
    });

    it('should accept avatar as absolute URL', () => {
      const validData = {
        avatar: 'https://example.com/avatar.jpg',
      };

      const result = updateProfileSchema.parse(validData);
      expect(result.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should reject invalid website URL', () => {
      const invalidData = {
        website: 'not-a-url',
      };

      expect(() => updateProfileSchema.parse(invalidData)).toThrow();
    });

    it('should accept empty object', () => {
      const validData = {};

      const result = updateProfileSchema.parse(validData);
      expect(result).toEqual({});
    });
  });

  describe('paginationSchema', () => {
    it('should validate correct pagination data', () => {
      const validData = {
        page: 1,
        limit: 10,
      };

      const result = paginationSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should coerce string to number', () => {
      const validData = {
        page: '2',
        limit: '20',
      };

      const result = paginationSchema.parse(validData);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });

    it('should use default values', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should reject negative page', () => {
      const invalidData = {
        page: -1,
        limit: 10,
      };

      expect(() => paginationSchema.parse(invalidData)).toThrow();
    });

    it('should reject zero page', () => {
      const invalidData = {
        page: 0,
        limit: 10,
      };

      expect(() => paginationSchema.parse(invalidData)).toThrow();
    });

    it('should reject limit greater than 100', () => {
      const invalidData = {
        page: 1,
        limit: 101,
      };

      expect(() => paginationSchema.parse(invalidData)).toThrow();
    });
  });

  describe('searchSchema', () => {
    it('should validate correct search data', () => {
      const validData = {
        query: 'test',
        limit: 10,
      };

      const result = searchSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should use default limit', () => {
      const validData = {
        query: 'test',
      };

      const result = searchSchema.parse(validData);
      expect(result.limit).toBe(20);
    });

    it('should coerce limit to number', () => {
      const validData = {
        query: 'test',
        limit: '20',
      };

      const result = searchSchema.parse(validData);
      expect(result.limit).toBe(20);
    });

    it('should reject empty query', () => {
      const invalidData = {
        query: '',
        limit: 10,
      };

      expect(() => searchSchema.parse(invalidData)).toThrow();
    });

    it('should reject limit greater than 50', () => {
      const invalidData = {
        query: 'test',
        limit: 51,
      };

      expect(() => searchSchema.parse(invalidData)).toThrow();
    });
  });
});
