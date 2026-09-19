// Password rules — the single list behind the server-side zod passwordSchema and
// the checklist shown in the reset password form. Dependency-free on purpose so
// client components can import it without pulling zod into the browser bundle.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128; // mirrors PasswordService.validate

export interface PasswordRule {
  id: 'minLength' | 'maxLength' | 'uppercase' | 'lowercase' | 'number';
  /** Short form for the visible checklist */
  label: string;
  /** Validation error message */
  message: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'minLength',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'maxLength',
    label: `At most ${PASSWORD_MAX_LENGTH} characters`,
    message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    test: (password) => password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    message: 'Password must contain at least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    message: 'Password must contain at least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    message: 'Password must contain at least one number',
    test: (password) => /\d/.test(password),
  },
];

/** Messages of every rule the password breaks, in rule order (empty when it is valid). */
export function getPasswordErrors(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
}
