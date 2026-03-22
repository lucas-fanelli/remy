import { z } from 'zod';

// Authentication Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  fullName: z.string().optional(),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
});

// User Profile Schemas
export const updateProfileSchema = z.object({
  fullName: z.string().max(50, 'Full name must be at most 50 characters').nullable().optional(),
  bio: z.string().max(300, 'Bio must be at most 300 characters').nullable().optional(),
  avatar: z.string().nullable().optional(), // Allow any string path (relative or absolute URL)
  website: z
    .union([
      z.literal(''),
      z
        .string()
        .url('Invalid website URL')
        .refine((url) => {
          try {
            const parsed = new URL(url);
            return !parsed.username && !parsed.password;
          } catch {
            return true; // Let the .url() check handle invalid URLs
          }
        }, 'URL must not contain credentials')
        .refine((url) => {
          try {
            return ['http:', 'https:'].includes(new URL(url).protocol);
          } catch {
            return false;
          }
        }, 'Website must use http:// or https://'),
    ])
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  isPrivate: z.boolean().optional(),
});

// Query Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1, 'Search query is required'),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
