import { RateLimitResult } from '../types/subscription';

/**
 * Rate Limiting Service Interface
 * Follows Interface Segregation Principle
 */
export interface IRateLimitService {
  /**
   * Check if a user is allowed to perform an action
   */
  checkLimit(userId: string, action: string): Promise<RateLimitResult>;

  /**
   * Record usage of a rate-limited action
   */
  recordUsage(userId: string, action: string, provider: string, model: string, success: boolean, errorMessage?: string): Promise<void>;

  /**
   * Get remaining quota for a user's action
   */
  getRemainingQuota(userId: string, action: string): Promise<number>;

  /**
   * Get usage statistics for a user
   */
  getUsageStats(userId: string, action: string, period: 'day' | 'month'): Promise<{
    used: number;
    limit: number;
    resetAt: Date;
  }>;
}
