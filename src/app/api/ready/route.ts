import { NextResponse } from 'next/server';
import prisma from '@/lib/database/prisma';

/**
 * Readiness Probe Endpoint
 * Used by Kubernetes/Docker to determine if the application is ready to accept traffic
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
