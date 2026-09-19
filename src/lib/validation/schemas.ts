import { z } from 'zod';
import { INVALID_RESET_TOKEN_MESSAGE } from '@/domain/errors';
import { getPasswordErrors } from './passwordRules';

// Authentication Schemas

// Password rules shared by registration, change password and reset password.
// The rules themselves live in passwordRules.ts so the client can show and check
// the very same list without importing zod.
export const passwordSchema = z.string().superRefine((password, ctx) => {
  for (const message of getPasswordErrors(password)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: passwordSchema,
  fullName: z.string().optional(),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  emailOrUsername: z
    .string()
    .trim()
    .min(1, 'Email or username is required')
    .max(254, 'Email or username is too long'),
});

export const resetPasswordSchema = z.object({
  // A malformed token is just another invalid link: same generic message as an
  // unknown, used or expired one, so the client shows its invalid-link state
  token: z
    .string({
      required_error: INVALID_RESET_TOKEN_MESSAGE,
      invalid_type_error: INVALID_RESET_TOKEN_MESSAGE,
    })
    .min(1, INVALID_RESET_TOKEN_MESSAGE)
    .max(256, INVALID_RESET_TOKEN_MESSAGE),
  password: passwordSchema,
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
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
