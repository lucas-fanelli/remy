import { PrismaClient } from '@prisma/client';
import { IRateLimitService } from '@/domain/services/IRateLimitService';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { RateLimitResult, SubscriptionTier, SUBSCRIPTION_LIMITS } from '@/domain/types/subscription';

/**
 * Rate Limiting Service Implementation
 * Handles subscription-based rate limiting for AI operations
 * Follows Single Responsibility Principle
 */
export class RateLimitService implements IRateLimitService {
  constructor(
    private prisma: PrismaClient,
    private userRepository: IUserRepository
  ) {}

  async checkLimit(userId: string, action: string): Promise<RateLimitResult> {
    // Get user's subscription tier
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tier = (user.subscriptionTier as SubscriptionTier) || SubscriptionTier.FREE;
    const limits = SUBSCRIPTION_LIMITS[tier];

    // Check if subscription has expired (for paid tiers)
    if (tier !== SubscriptionTier.FREE && user.subscriptionExpiresAt) {
      if (new Date() > new Date(user.subscriptionExpiresAt)) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(user.subscriptionExpiresAt),
          tier,
          reason: 'Subscription has expired',
        };
      }
    }

    // CHEF tier has unlimited usage
    if (tier === SubscriptionTier.CHEF) {
      return {
        allowed: true,
        remaining: -1, // Unlimited
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        tier,
      };
    }

    // Check daily limit
    const dailyUsage = await this.getUsageCount(userId, action, 'day');
    const dailyLimit = limits.aiRecipesPerDay;

    if (dailyUsage >= dailyLimit) {
      const resetAt = this.getDailyResetTime();
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        tier,
        reason: `Daily limit of ${dailyLimit} ${action} requests exceeded`,
      };
    }

    // Check monthly limit
    const monthlyUsage = await this.getUsageCount(userId, action, 'month');
    const monthlyLimit = limits.aiRecipesPerMonth;

    if (monthlyUsage >= monthlyLimit) {
      const resetAt = this.getMonthlyResetTime();
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        tier,
        reason: `Monthly limit of ${monthlyLimit} ${action} requests exceeded`,
      };
    }

    // Calculate remaining quota (use the more restrictive limit)
    const remainingDaily = dailyLimit - dailyUsage;
    const remainingMonthly = monthlyLimit - monthlyUsage;
    const remaining = Math.min(remainingDaily, remainingMonthly);

    return {
      allowed: true,
      remaining,
      resetAt: this.getDailyResetTime(),
      tier,
    };
  }

  async recordUsage(
    userId: string,
    action: string,
    provider: string,
    model: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.prisma.aIUsageLog.create({
      data: {
        userId,
        action,
        provider,
        model,
        success,
        errorMessage,
        tokensUsed: 0, // Will be updated if available
      },
    });
  }

  async getRemainingQuota(userId: string, action: string): Promise<number> {
    const result = await this.checkLimit(userId, action);
    return result.remaining;
  }

  async getUsageStats(
    userId: string,
    action: string,
    period: 'day' | 'month'
  ): Promise<{ used: number; limit: number; resetAt: Date }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tier = (user.subscriptionTier as SubscriptionTier) || SubscriptionTier.FREE;
    const limits = SUBSCRIPTION_LIMITS[tier];

    const used = await this.getUsageCount(userId, action, period);
    const limit = period === 'day' ? limits.aiRecipesPerDay : limits.aiRecipesPerMonth;
    const resetAt = period === 'day' ? this.getDailyResetTime() : this.getMonthlyResetTime();

    return { used, limit, resetAt };
  }

  /**
   * Get usage count for a specific period
   */
  private async getUsageCount(userId: string, action: string, period: 'day' | 'month'): Promise<number> {
    const now = new Date();
    const startDate = period === 'day'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const count = await this.prisma.aIUsageLog.count({
      where: {
        userId,
        action,
        success: true, // Only count successful requests
        createdAt: {
          gte: startDate,
        },
      },
    });

    return count;
  }

  /**
   * Get the next daily reset time (midnight UTC)
   */
  private getDailyResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Get the next monthly reset time (first day of next month)
   */
  private getMonthlyResetTime(): Date {
    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return nextMonth;
  }
}
