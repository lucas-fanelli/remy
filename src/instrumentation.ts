export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('./lib/env-validation');
    try {
      validateEnvironment();
    } catch (error) {
      console.error(error);
    }

    // Warn about in-memory rate limiting in serverless environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.warn(
        '[security] In-memory rate limiting is per-instance only and ineffective in serverless. ' +
          'Consider replacing with Redis/Upstash/Vercel KV for production rate limiting.'
      );
    }
  }
}
