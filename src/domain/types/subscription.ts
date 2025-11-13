/**
 * Subscription and Rate Limiting Types
 */

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  CHEF = 'chef',
}

export interface SubscriptionLimits {
  aiRecipesPerDay: number;
  aiRecipesPerMonth: number;
  canAccessMultipleProviders: boolean;
  allowedProviders: string[];
  priorityQueue: boolean;
}

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  [SubscriptionTier.FREE]: {
    aiRecipesPerDay: 3,
    aiRecipesPerMonth: 30,
    canAccessMultipleProviders: false,
    allowedProviders: ['gemini'],
    priorityQueue: false,
  },
  [SubscriptionTier.BASIC]: {
    aiRecipesPerDay: 10,
    aiRecipesPerMonth: 150,
    canAccessMultipleProviders: false,
    allowedProviders: ['gemini'],
    priorityQueue: false,
  },
  [SubscriptionTier.PRO]: {
    aiRecipesPerDay: 50,
    aiRecipesPerMonth: 1000,
    canAccessMultipleProviders: true,
    allowedProviders: ['gemini', 'openai'],
    priorityQueue: true,
  },
  [SubscriptionTier.CHEF]: {
    aiRecipesPerDay: -1, // Unlimited
    aiRecipesPerMonth: -1, // Unlimited
    canAccessMultipleProviders: true,
    allowedProviders: ['gemini', 'openai', 'claude'],
    priorityQueue: true,
  },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  tier: SubscriptionTier;
  reason?: string;
}

export interface AIUsageRecord {
  id: string;
  userId: string;
  action: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}
