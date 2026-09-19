/**
 * Environment Variable Validation
 * Validates all required environment variables on application startup
 * Prevents runtime errors due to missing configuration
 */

interface EnvConfig {
  // Database
  DATABASE_URL: string;

  // JWT Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // NextAuth
  NEXTAUTH_SECRET: string;

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: string;

  // AI (Optional for MVP)
  GEMINI_API_KEY?: string;

  // Email (Optional - password reset emails are not sent without the key)
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  // Application
  NODE_ENV: 'development' | 'production' | 'test';
}

class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * Compute Shannon entropy of a string (bits per character).
 * Used to detect low-randomness secrets like repeated characters or dictionary words.
 */
function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Validates that all required environment variables are present
 * @throws {EnvironmentValidationError} if validation fails
 */
export function validateEnvironment(): EnvConfig {
  const errors: string[] = [];

  // Required variables
  const required: (keyof EnvConfig)[] = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'NEXTAUTH_SECRET',
    'NODE_ENV',
    'CLOUDINARY_CLOUD_NAME',
  ];

  // Check for missing required variables
  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate NODE_ENV values
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }

  // Validate DATABASE_URL format (postgres://, postgresql://, and prisma+postgres:// are valid)
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith('postgresql://') &&
    !process.env.DATABASE_URL.startsWith('postgres://') &&
    !process.env.DATABASE_URL.startsWith('prisma+postgres://')
  ) {
    errors.push('DATABASE_URL must start with postgresql://, postgres://, or prisma+postgres://');
  }

  // Production-specific validations
  if (process.env.NODE_ENV === 'production') {
    // Check for insecure secrets — only flag short secrets or exact placeholder matches.
    // Substring checks on long random secrets would false-positive on words like "secret".
    const insecurePlaceholders = ['your-super-secret', 'change-this', 'your-secret-key'];
    const MIN_SECRET_LENGTH = 32;

    const jwtSecret = process.env.JWT_SECRET || '';
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || '';

    if (jwtSecret.length < MIN_SECRET_LENGTH) {
      errors.push(
        `JWT_SECRET is too short (${jwtSecret.length} chars). Use at least ${MIN_SECRET_LENGTH} random characters.`
      );
    }
    if (nextAuthSecret.length < MIN_SECRET_LENGTH) {
      errors.push(
        `NEXTAUTH_SECRET is too short (${nextAuthSecret.length} chars). Use at least ${MIN_SECRET_LENGTH} random characters.`
      );
    }

    for (const insecure of insecurePlaceholders) {
      if (jwtSecret.toLowerCase().includes(insecure)) {
        errors.push(
          'JWT_SECRET appears to be a placeholder. Use a strong, random secret in production.'
        );
      }
      if (nextAuthSecret.toLowerCase().includes(insecure)) {
        errors.push(
          'NEXTAUTH_SECRET appears to be a placeholder. Use a strong, random secret in production.'
        );
      }
    }

    // 2.5 bits = catches repeated-character secrets (e.g., "aaaa...") while
    // accepting hex secrets (~4.0 bits) and base64 secrets (~5.7 bits).
    if (jwtSecret.length >= MIN_SECRET_LENGTH && shannonEntropy(jwtSecret) < 2.5) {
      errors.push('JWT_SECRET has low entropy. Use a cryptographically random secret.');
    }
    if (nextAuthSecret.length >= MIN_SECRET_LENGTH && shannonEntropy(nextAuthSecret) < 2.5) {
      errors.push('NEXTAUTH_SECRET has low entropy. Use a cryptographically random secret.');
    }
  }

  // Validate JWT_EXPIRES_IN format (e.g., "7d", "24h", "60m", "3600s")
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
  if (jwtExpiresIn && !/^\d+[smhd]$/.test(jwtExpiresIn)) {
    const warnings: string[] = [];
    warnings.push('JWT_EXPIRES_IN should match format like "7d", "24h", "60m", "3600s"');
    warnings.forEach((w) => console.warn(`\u26A0\uFE0F  ${w}`));
  }

  // Warnings for optional but recommended variables
  if (!process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  GEMINI_API_KEY is not set. AI recipe generation features will not work.');
  }
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'test') {
    console.warn(
      '⚠️  RESEND_API_KEY is not set. Password reset emails will not be sent' +
        (process.env.NODE_ENV === 'development' ? ' (the link is printed to this console).' : '.')
    );
  }

  // If there are errors, throw
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment validation failed:',
      '',
      ...errors.map((err) => `  • ${err}`),
      '',
      'Please check your .env file and ensure all required variables are set.',
      'See .env.example for reference.',
    ].join('\n');

    throw new EnvironmentValidationError(errorMessage);
  }

  // Success - log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment variables validated successfully');
  }

  // Return typed config
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME!,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
  };
}

/**
 * Get validated environment config
 * Call this once at application startup
 */
export function getEnvConfig(): EnvConfig {
  return validateEnvironment();
}

// NOTE: Call validateEnvironment() or getEnvConfig() explicitly at app startup.
// Auto-validation on import was removed to prevent CI/CD build failures when
// runtime-only secrets (DATABASE_URL, etc.) aren't available during build.
