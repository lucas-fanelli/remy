import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Readiness Probe Endpoint
 * Used by Kubernetes/Docker to determine if the application is ready to accept traffic
 *
 * This checks if all required services are available before routing traffic
 *
 * Returns:
 * - 200: Application is ready to serve traffic
 * - 503: Application is not ready (still initializing or dependencies unavailable)
 */
export async function GET() {
  try {
    // Check critical dependencies
    const checks = await Promise.all([
      // Database connectivity
      prisma.$queryRaw`SELECT 1`.then(() => ({ database: 'ready' })).catch(() => ({ database: 'not_ready' })),

      // Environment variables
      Promise.resolve({
        environment: process.env.DATABASE_URL && process.env.JWT_SECRET ? 'ready' : 'not_ready',
      }),
    ]);

    const allChecks = Object.assign({}, ...checks);
    const isReady = Object.values(allChecks).every((status) => status === 'ready');

    if (!isReady) {
      return NextResponse.json(
        {
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          checks: allChecks,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: allChecks,
    });
  } catch (error) {
    console.error('Readiness check failed:', error);

    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
