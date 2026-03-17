export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('./lib/env-validation');
    try {
      validateEnvironment();
    } catch (error) {
      console.error(error);
    }
  }
}
