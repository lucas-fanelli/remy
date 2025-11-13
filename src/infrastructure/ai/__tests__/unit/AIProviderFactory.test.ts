import { AIProviderFactory } from '../../AIProviderFactory';
import { IAIRecipeProvider } from '@/domain/types/ai-provider';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('AIProviderFactory', () => {
  let factory: AIProviderFactory;
  let mockProvider1: DeepMockProxy<IAIRecipeProvider>;
  let mockProvider2: DeepMockProxy<IAIRecipeProvider>;

  beforeEach(() => {
    // Reset singleton for testing
    (AIProviderFactory as any).instance = null;
    factory = AIProviderFactory.getInstance();

    mockProvider1 = mockDeep<IAIRecipeProvider>();
    mockProvider1.name = 'gemini';
    mockProvider1.isConfigured.mockReturnValue(true);

    mockProvider2 = mockDeep<IAIRecipeProvider>();
    mockProvider2.name = 'openai';
    mockProvider2.isConfigured.mockReturnValue(true);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AIProviderFactory.getInstance();
      const instance2 = AIProviderFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create only one instance', () => {
      const instances = [];
      for (let i = 0; i < 10; i++) {
        instances.push(AIProviderFactory.getInstance());
      }

      const firstInstance = instances[0];
      expect(instances.every(instance => instance === firstInstance)).toBe(true);
    });
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      factory.registerProvider('gemini', mockProvider1 as any);

      const provider = factory.getProvider('gemini');
      expect(provider).toBe(mockProvider1);
    });

    it('should register multiple providers', () => {
      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('openai', mockProvider2 as any);

      const provider1 = factory.getProvider('gemini');
      const provider2 = factory.getProvider('openai');

      expect(provider1).toBe(mockProvider1);
      expect(provider2).toBe(mockProvider2);
    });

    it('should overwrite provider if registered twice', () => {
      const newMockProvider = mockDeep<IAIRecipeProvider>();
      newMockProvider.name = 'gemini';
      newMockProvider.isConfigured.mockReturnValue(true);

      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('gemini', newMockProvider as any);

      const provider = factory.getProvider('gemini');
      expect(provider).toBe(newMockProvider);
      expect(provider).not.toBe(mockProvider1);
    });
  });

  describe('getProvider', () => {
    beforeEach(() => {
      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('openai', mockProvider2 as any);
    });

    it('should get registered provider', () => {
      const provider = factory.getProvider('gemini');
      expect(provider).toBe(mockProvider1);
    });

    it('should throw error for unregistered provider', () => {
      expect(() => factory.getProvider('claude')).toThrow(
        'AI Provider "claude" is not registered'
      );
    });

    it('should be case insensitive', () => {
      const provider1 = factory.getProvider('Gemini');
      const provider2 = factory.getProvider('GEMINI');
      const provider3 = factory.getProvider('gemini');

      expect(provider1).toBe(mockProvider1);
      expect(provider2).toBe(mockProvider1);
      expect(provider3).toBe(mockProvider1);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return empty array when no providers registered', () => {
      const providers = factory.getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it('should return all registered provider names', () => {
      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('openai', mockProvider2 as any);

      const providers = factory.getAvailableProviders();
      expect(providers).toEqual(['gemini', 'openai']);
    });

    it('should return all provider names in order', () => {
      const mockProvider3 = mockDeep<IAIRecipeProvider>();
      mockProvider3.name = 'claude';
      mockProvider3.isConfigured.mockReturnValue(true);

      factory.registerProvider('openai', mockProvider2 as any);
      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('claude', mockProvider3 as any);

      const providers = factory.getAvailableProviders();
      expect(providers).toHaveLength(3);
      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
      expect(providers).toContain('claude');
    });
  });

  describe('hasProvider', () => {
    beforeEach(() => {
      factory.registerProvider('gemini', mockProvider1 as any);
    });

    it('should return true for registered provider', () => {
      expect(factory.hasProvider('gemini')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(factory.hasProvider('openai')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(factory.hasProvider('Gemini')).toBe(true);
      expect(factory.hasProvider('GEMINI')).toBe(true);
      expect(factory.hasProvider('gemini')).toBe(true);
    });
  });

  describe('getProvider - configuration checks', () => {
    it('should throw error when provider is not configured', () => {
      const unconfiguredProvider = mockDeep<IAIRecipeProvider>();
      unconfiguredProvider.isConfigured.mockReturnValue(false);

      factory.registerProvider('unconfigured', unconfiguredProvider as any);

      expect(() => factory.getProvider('unconfigured')).toThrow(
        'AI Provider "unconfigured" is not properly configured'
      );
    });

    it('should return provider when properly configured', () => {
      factory.registerProvider('gemini', mockProvider1 as any);

      const provider = factory.getProvider('gemini');
      expect(provider).toBe(mockProvider1);
      expect(mockProvider1.isConfigured).toHaveBeenCalled();
    });
  });

  describe('getDefaultProvider', () => {
    beforeEach(() => {
      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('openai', mockProvider2 as any);
    });

    it('should return gemini as default provider', () => {
      const provider = factory.getDefaultProvider();
      expect(provider).toBe(mockProvider1);
    });

    it('should throw error if default provider not registered', () => {
      // Reset and don't register gemini
      (AIProviderFactory as any).instance = null;
      factory = AIProviderFactory.getInstance();

      expect(() => factory.getDefaultProvider()).toThrow(
        'AI Provider "gemini" is not registered'
      );
    });
  });

  describe('setDefaultProvider', () => {
    beforeEach(() => {
      factory.registerProvider('gemini', mockProvider1 as any);
      factory.registerProvider('openai', mockProvider2 as any);
    });

    it('should set default provider successfully', () => {
      factory.setDefaultProvider('openai');

      const provider = factory.getDefaultProvider();
      expect(provider).toBe(mockProvider2);
    });

    it('should throw error when setting unregistered provider as default', () => {
      expect(() => factory.setDefaultProvider('claude')).toThrow(
        'Cannot set default provider: "claude" is not registered'
      );
    });

    it('should be case insensitive when setting default', () => {
      factory.setDefaultProvider('OpenAI');

      const provider = factory.getDefaultProvider();
      expect(provider).toBe(mockProvider2);
    });

    it('should allow changing default provider multiple times', () => {
      factory.setDefaultProvider('openai');
      expect(factory.getDefaultProvider()).toBe(mockProvider2);

      factory.setDefaultProvider('gemini');
      expect(factory.getDefaultProvider()).toBe(mockProvider1);
    });
  });

  describe('isProviderReady', () => {
    it('should return true when provider is configured', () => {
      factory.registerProvider('gemini', mockProvider1 as any);

      expect(factory.isProviderReady('gemini')).toBe(true);
    });

    it('should return false when provider is not configured', () => {
      const unconfiguredProvider = mockDeep<IAIRecipeProvider>();
      unconfiguredProvider.isConfigured.mockReturnValue(false);

      factory.registerProvider('broken', unconfiguredProvider as any);

      expect(factory.isProviderReady('broken')).toBe(false);
    });

    it('should return false when provider is not registered', () => {
      expect(factory.isProviderReady('nonexistent')).toBe(false);
    });

    it('should be case insensitive', () => {
      factory.registerProvider('gemini', mockProvider1 as any);

      expect(factory.isProviderReady('Gemini')).toBe(true);
      expect(factory.isProviderReady('GEMINI')).toBe(true);
    });
  });
});
