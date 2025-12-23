import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  paginationSchema,
  searchSchema,
} from '../../schemas';
import { ZodError } from 'zod';

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
      expect(result.limit).toBe(10);
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
