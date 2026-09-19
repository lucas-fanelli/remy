import { z } from 'zod';
import { INVALID_RESET_TOKEN_MESSAGE } from '@/domain/errors';
import messages from '@/i18n/messages/en/validation.json';
import { getPasswordErrors } from './passwordRules';

// The messages zod answers with live in the `validation` namespace, and the server reads the
// ENGLISH catalogue: the API contract is that the sentence in the body never changes language
// (see src/lib/api/errorCodes.ts). Spanish is there for the client that renders these per
// field - it knows which field failed, which the joined sentence in the response does not say.

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
  email: z.string().email(messages.email.invalid),
  username: z
    .string()
    .min(3, messages.username.tooShort)
    .max(30, messages.username.tooLong)
    .regex(/^[a-zA-Z0-9_]+$/, messages.username.charset),
  password: passwordSchema,
  fullName: z.string().optional(),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, messages.emailOrUsername.required),
  password: z.string().min(1, messages.password.required),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, messages.password.oldRequired),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  emailOrUsername: z
    .string()
    .trim()
    .min(1, messages.emailOrUsername.required)
    .max(254, messages.emailOrUsername.tooLong),
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
  fullName: z.string().max(50, messages.fullName.tooLong).nullable().optional(),
  bio: z.string().max(300, messages.bio.tooLong).nullable().optional(),
  avatar: z.string().nullable().optional(), // Allow any string path (relative or absolute URL)
  website: z
    .union([
      z.literal(''),
      z
        .string()
        .url(messages.website.invalid)
        .refine((url) => {
          try {
            const parsed = new URL(url);
            return !parsed.username && !parsed.password;
          } catch {
            return true; // Let the .url() check handle invalid URLs
          }
        }, messages.website.credentials)
        .refine((url) => {
          try {
            return ['http:', 'https:'].includes(new URL(url).protocol);
          } catch {
            return false;
          }
        }, messages.website.protocol),
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
  query: z.string().trim().min(1, messages.search.queryRequired),
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
