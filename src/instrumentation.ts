export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('./lib/env-validation');
    try {
      validateEnvironment();
    } catch (error) {
      console.error(error);
      if (process.env.NODE_ENV === 'production') throw error;
    }

    // Warn about in-memory rate limiting in serverless environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.warn(
        '[security] In-memory rate limiting is per-instance only and ineffective in serverless. ' +
          'Consider replacing with Redis/Upstash/Vercel KV for production rate limiting.'
      );
    }

    // Non-blocking check for GIN index on Post.ingredients (performance optimization)
    try {
      const { default: prisma } = await import('./lib/database/prisma');
      const result = await prisma.$queryRaw`
        SELECT 1 FROM pg_indexes WHERE indexname = 'Post_ingredients_gin_idx'
      `;
      if (!Array.isArray(result) || result.length === 0) {
        console.warn(
          '[performance] GIN index on Post.ingredients is missing. ' +
            'Run: prisma/migrations/manual/add_gin_index_ingredients.sql'
        );
      }
    } catch {
      /* Skip if DB not available during build */
    }
  }
}
