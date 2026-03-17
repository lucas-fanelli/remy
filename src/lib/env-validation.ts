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
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;

  // AI (Optional for MVP)
  GEMINI_API_KEY?: string;

  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_APP_URL: string;
}

class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
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
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'NODE_ENV',
    'NEXT_PUBLIC_APP_URL',
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

  // Validate URL formats
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_APP_URL);
    } catch {
      errors.push(`Invalid NEXT_PUBLIC_APP_URL format: ${process.env.NEXT_PUBLIC_APP_URL}`);
    }
  }

  if (process.env.NEXTAUTH_URL) {
    try {
      new URL(process.env.NEXTAUTH_URL);
    } catch {
      errors.push(`Invalid NEXTAUTH_URL format: ${process.env.NEXTAUTH_URL}`);
    }
  }

  // Validate DATABASE_URL format (both postgres:// and postgresql:// are valid)
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith('postgresql://') &&
    !process.env.DATABASE_URL.startsWith('postgres://')
  ) {
    errors.push('DATABASE_URL must start with postgresql:// or postgres://');
  }

  // Production-specific validations
  if (process.env.NODE_ENV === 'production') {
    // Check for insecure secrets
    const insecureSecrets = ['your-super-secret', 'change-this', 'secret', 'password', 'test'];

    const jwtSecret = process.env.JWT_SECRET?.toLowerCase() || '';
    const nextAuthSecret = process.env.NEXTAUTH_SECRET?.toLowerCase() || '';

    for (const insecure of insecureSecrets) {
      if (jwtSecret.includes(insecure)) {
        errors.push(
          'JWT_SECRET appears to be insecure. Use a strong, random secret in production.'
        );
      }
      if (nextAuthSecret.includes(insecure)) {
        errors.push(
          'NEXTAUTH_SECRET appears to be insecure. Use a strong, random secret in production.'
        );
      }
    }

    // Check secret length
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET should be at least 32 characters long in production.');
    }
    if (nextAuthSecret.length < 32) {
      errors.push('NEXTAUTH_SECRET should be at least 32 characters long in production.');
    }
  }

  // Warnings for optional but recommended variables
  if (!process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  GEMINI_API_KEY is not set. AI recipe generation features will not work.');
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
    NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
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
