// Password rules — the single list behind the server-side zod passwordSchema and
// the checklist shown in the reset password form. Dependency-free on purpose so
// client components can import it without pulling zod into the browser bundle.
//
// The list is split BY FIELD, not by file: `label` and `issue` are what the FORM shows,
// so they are descriptors (see src/i18n/text.ts) the component renders in the current
// language, while `message` stays the English sentence `getPasswordErrors` hands to zod
// on the server — that string is part of the API's response body and must not move.
import { text, type TextDescriptor } from '@/i18n/text';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128; // mirrors PasswordService.validate

export interface PasswordRule {
  id: 'minLength' | 'maxLength' | 'uppercase' | 'lowercase' | 'number';
  /** Short form for the visible checklist */
  label: TextDescriptor;
  /** What the form shows under the password field when the rule is broken */
  issue: TextDescriptor;
  /** Validation error message, in English: the server answers with it verbatim */
  message: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'minLength',
    label: text('auth.passwordRules.labels.minLength', { min: PASSWORD_MIN_LENGTH }),
    issue: text('auth.passwordRules.issues.minLength', { min: PASSWORD_MIN_LENGTH }),
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'maxLength',
    label: text('auth.passwordRules.labels.maxLength', { max: PASSWORD_MAX_LENGTH }),
    issue: text('auth.passwordRules.issues.maxLength', { max: PASSWORD_MAX_LENGTH }),
    message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    test: (password) => password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'uppercase',
    label: text('auth.passwordRules.labels.uppercase'),
    issue: text('auth.passwordRules.issues.uppercase'),
    message: 'Password must contain at least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: text('auth.passwordRules.labels.lowercase'),
    issue: text('auth.passwordRules.issues.lowercase'),
    message: 'Password must contain at least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: text('auth.passwordRules.labels.number'),
    issue: text('auth.passwordRules.issues.number'),
    message: 'Password must contain at least one number',
    test: (password) => /\d/.test(password),
  },
];

/** What the form shows for every rule the password breaks, in rule order, ready to translate. */
export function getPasswordIssues(password: string): TextDescriptor[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.issue);
}

/**
 * The English messages zod adds as issues on the server. Kept as plain strings on purpose:
 * they travel in the `error` field of an API response, which the API error contract freezes.
 */
export function getPasswordErrors(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
}
