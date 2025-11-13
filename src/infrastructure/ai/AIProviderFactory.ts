import { IAIRecipeProvider } from '@/domain/types/ai-provider';

/**
 * AI Provider Factory
 * Implements Factory Pattern for creating and managing AI providers
 * Follows Open/Closed Principle - Easy to add new providers without modifying existing code
 */
export class AIProviderFactory {
  private static instance: AIProviderFactory;
  private providers: Map<string, IAIRecipeProvider> = new Map();
  private defaultProviderName: string = 'gemini';

  private constructor() {}

  static getInstance(): AIProviderFactory {
    if (!AIProviderFactory.instance) {
      AIProviderFactory.instance = new AIProviderFactory();
    }
    return AIProviderFactory.instance;
  }

  /**
   * Register a new AI provider
   */
  registerProvider(name: string, provider: IAIRecipeProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: string): IAIRecipeProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`AI Provider "${name}" is not registered`);
    }
    if (!provider.isConfigured()) {
      throw new Error(`AI Provider "${name}" is not properly configured`);
    }
    return provider;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): IAIRecipeProvider {
    return this.getProvider(this.defaultProviderName);
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name.toLowerCase())) {
      throw new Error(`Cannot set default provider: "${name}" is not registered`);
    }
    this.defaultProviderName = name.toLowerCase();
  }

  /**
   * Get all registered provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }

  /**
   * Check if a provider is configured and ready to use
   */
  isProviderReady(name: string): boolean {
    const provider = this.providers.get(name.toLowerCase());
    return provider ? provider.isConfigured() : false;
  }
}
