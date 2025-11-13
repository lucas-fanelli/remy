import { GeminiRecipeProvider } from '../../GeminiRecipeProvider';
import { AIRecipeRequest } from '@/domain/types/ai-provider';

// Mock the @google/generative-ai module
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn(),
      }),
    })),
  };
});

describe('GeminiRecipeProvider', () => {
  let provider: GeminiRecipeProvider;
  const mockApiKey = 'test-api-key-123';

  // Suppress console.error in tests
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GeminiRecipeProvider(mockApiKey);
  });

  describe('isConfigured', () => {
    it('should return true when API key is provided', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const emptyProvider = new GeminiRecipeProvider('');
      expect(emptyProvider.isConfigured()).toBe(false);
    });

    it('should return false when API key is missing', () => {
      const undefinedProvider = new GeminiRecipeProvider(undefined as any);
      expect(undefinedProvider.isConfigured()).toBe(false);
    });
  });

  describe('generateRecipe', () => {
    const mockRequest: AIRecipeRequest = {
      userId: 'user-123',
      ingredients: ['chicken', 'tomato', 'pasta'],
      preferences: {
        servings: 4,
        difficulty: 'medium',
        maxCookingTime: 45,
      },
    };

    const mockRecipeResponse = JSON.stringify({
      title: 'Chicken Pasta with Tomatoes',
      description: 'A delicious and easy pasta dish',
      cookingTime: 30,
      prepTime: 15,
      servings: 4,
      difficulty: 'medium',
      cuisine: 'Italian',
      ingredients: [
        { name: 'chicken breast', amount: '500', unit: 'g' },
        { name: 'tomato', amount: '3', unit: 'pieces' },
        { name: 'pasta', amount: '400', unit: 'g' },
      ],
      instructions: [
        { step: 1, description: 'Boil water and cook pasta' },
        { step: 2, description: 'Cook chicken' },
      ],
    });

    it('should generate recipe successfully', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);
      const result = await provider.generateRecipe(mockRequest);

      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-1.5-pro');
      expect(result.recipe.title).toBe('Chicken Pasta with Tomatoes');
      expect(result.recipe.ingredients).toHaveLength(3);
      expect(result.recipe.instructions).toHaveLength(2);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should build prompt with dietary restrictions', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      const requestWithDietary: AIRecipeRequest = {
        ...mockRequest,
        preferences: {
          ...mockRequest.preferences,
          dietary: ['gluten-free', 'dairy-free'],
        },
      };

      await provider.generateRecipe(requestWithDietary);

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('gluten-free')
      );
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('dairy-free')
      );
    });

    it('should build prompt with all preference options', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      const requestWithAllPrefs: AIRecipeRequest = {
        ...mockRequest,
        preferences: {
          ...mockRequest.preferences,
          dietary: ['vegan', 'nut-free'],
          mealType: 'dinner',
          servings: 4,
          spicyLevel: 'medium',
          additionalInstructions: 'Make it quick and easy for weeknight cooking',
        },
      };

      await provider.generateRecipe(requestWithAllPrefs);

      const calledPrompt = mockModel.generateContent.mock.calls[0][0];
      expect(calledPrompt).toContain('vegan');
      expect(calledPrompt).toContain('nut-free');
      expect(calledPrompt).toContain('dinner');
      expect(calledPrompt).toContain('4');
      expect(calledPrompt).toContain('medium');
      expect(calledPrompt).toContain('Make it quick and easy for weeknight cooking');
    });

    it('should throw error when provider not configured', async () => {
      const unconfiguredProvider = new GeminiRecipeProvider('');

      await expect(unconfiguredProvider.generateRecipe(mockRequest)).rejects.toThrow(
        'Gemini API is not configured. Please provide an API key.'
      );
    });

    it('should throw error when API returns invalid JSON', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue('Invalid JSON response'),
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      await expect(provider.generateRecipe(mockRequest)).rejects.toThrow('Failed to generate recipe');
    });

    it('should throw error when API call fails', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      await expect(provider.generateRecipe(mockRequest)).rejects.toThrow('Failed to generate recipe');
    });

    it('should use all provided ingredients in prompt', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);
      await provider.generateRecipe(mockRequest);

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('chicken')
      );
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('tomato')
      );
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('pasta')
      );
    });
  });

  describe('suggestSubstitutions', () => {
    it('should suggest substitutions for ingredient', async () => {
      const mockSubstitutions = JSON.stringify([
        'Greek yogurt',
        'Buttermilk',
        'Coconut milk',
        'Almond milk',
      ]);

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockSubstitutions),
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);
      const result = await provider.suggestSubstitutions('milk', 'baking');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Greek yogurt');
      expect(result).toContain('Buttermilk');
    });

    it('should throw error when provider not configured', async () => {
      const unconfiguredProvider = new GeminiRecipeProvider('');

      await expect(
        unconfiguredProvider.suggestSubstitutions('milk', 'baking')
      ).rejects.toThrow('Gemini API is not configured.');
    });

    it('should handle API errors gracefully', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      await expect(provider.suggestSubstitutions('milk', 'baking')).rejects.toThrow(
        'Failed to get substitution suggestions'
      );
    });

    it('should include context in prompt', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue('["substitution 1", "substitution 2"]'),
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);
      await provider.suggestSubstitutions('butter', 'vegan baking');

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('butter')
      );
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('vegan baking')
      );
    });
  });

  describe('getCookingAdvice', () => {
    it('should get cooking advice without context', async () => {
      const mockAdvice = 'To properly sauté vegetables, heat your pan over medium-high heat.';

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockAdvice),
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);
      const result = await provider.getCookingAdvice('How do I sauté vegetables?');

      expect(result).toBe(mockAdvice);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('How do I sauté vegetables?')
      );
    });

    it('should get cooking advice with recipe context', async () => {
      const mockAdvice = 'For this chicken pasta recipe, make sure to drain the pasta well.';

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockAdvice),
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);
      const result = await provider.getCookingAdvice('How do I do this step?', {
        recipeTitle: 'Chicken Pasta',
        currentStep: 2,
        ingredients: ['chicken', 'pasta'],
      });

      expect(result).toBe(mockAdvice);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Chicken Pasta')
      );
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Step: 2')
      );
    });

    it('should throw error when provider not configured', async () => {
      const unconfiguredProvider = new GeminiRecipeProvider('');

      await expect(
        unconfiguredProvider.getCookingAdvice('How do I cook rice?')
      ).rejects.toThrow('Gemini API is not configured.');
    });

    it('should handle API errors gracefully', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      await expect(provider.getCookingAdvice('How do I cook rice?')).rejects.toThrow(
        'Failed to get cooking advice'
      );
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit info', () => {
      const info = provider.getRateLimitInfo();

      expect(info).toHaveProperty('requestsPerMinute');
      expect(info).toHaveProperty('requestsPerDay');
      expect(info.requestsPerMinute).toBe(15);
      expect(info.requestsPerDay).toBe(1500);
    });
  });

  describe('provider metadata', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('gemini');
    });

    it('should have correct model', () => {
      expect(provider.model).toBe('gemini-1.5-pro');
    });
  });

  // Branch Coverage Tests
  describe('Branch Coverage - Missing Lines', () => {
    it('should handle non-Error instance in generateRecipe error (line 64) - branch coverage', async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue('String error instead of Error instance'),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      const mockRequest: AIRecipeRequest = {
        userId: 'user-123',
        ingredients: ['chicken', 'tomato'],
      };

      await expect(provider.generateRecipe(mockRequest)).rejects.toThrow('Failed to generate recipe: Unknown error');
    });

    it('should include cuisine in prompt when provided (line 142) - branch coverage', async () => {
      const mockRecipeResponse = JSON.stringify({
        title: 'Test Recipe',
        description: 'Test Description',
        cookingTime: 30,
        prepTime: 15,
        servings: 4,
        difficulty: 'medium',
        cuisine: 'Italian',
        ingredients: [],
        instructions: [],
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(mockRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      const requestWithCuisine: AIRecipeRequest = {
        userId: 'user-123',
        ingredients: ['chicken', 'tomato'],
        preferences: {
          cuisine: 'Mexican',
        },
      };

      await provider.generateRecipe(requestWithCuisine);

      const calledPrompt = mockModel.generateContent.mock.calls[0][0];
      expect(calledPrompt).toContain('Cuisine style: Mexican');
    });

    it('should use default values when recipe data is missing (lines 189-199) - branch coverage', async () => {
      // Mock response with minimal data (missing most fields)
      const minimalRecipeResponse = JSON.stringify({
        // Only providing empty object, all fields will use defaults
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(minimalRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      const mockRequest: AIRecipeRequest = {
        userId: 'user-123',
        ingredients: ['chicken', 'tomato'],
      };

      const result = await provider.generateRecipe(mockRequest);

      // Verify default values are used (lines 189-199)
      expect(result.recipe.title).toBe('AI Generated Recipe'); // line 189 default
      expect(result.recipe.description).toBe(''); // line 190 default
      expect(result.recipe.cookingTime).toBe(30); // line 193 default
      expect(result.recipe.prepTime).toBe(15); // line 194 default
      expect(result.recipe.servings).toBe(4); // line 195 default
      expect(result.recipe.difficulty).toBe('medium'); // line 196 default
      expect(result.recipe.cuisine).toBe('International'); // line 197 default
      expect(result.recipe.ingredients).toEqual([]); // line 198 default
      expect(result.recipe.instructions).toEqual([]); // line 199 default
    });

    it('should use partial data with defaults for missing fields - branch coverage', async () => {
      // Mock response with partial data
      const partialRecipeResponse = JSON.stringify({
        title: 'Custom Title',
        // Missing: description, cookingTime, prepTime, servings, difficulty, cuisine, ingredients, instructions
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(partialRecipeResponse),
            usageMetadata: { totalTokenCount: 500 },
          },
        }),
      };
      GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }));

      provider = new GeminiRecipeProvider(mockApiKey);

      const mockRequest: AIRecipeRequest = {
        userId: 'user-123',
        ingredients: ['chicken', 'tomato'],
      };

      const result = await provider.generateRecipe(mockRequest);

      // Verify custom value is used
      expect(result.recipe.title).toBe('Custom Title');
      // Verify defaults are used for missing fields
      expect(result.recipe.description).toBe('');
      expect(result.recipe.cookingTime).toBe(30);
      expect(result.recipe.prepTime).toBe(15);
      expect(result.recipe.servings).toBe(4);
      expect(result.recipe.difficulty).toBe('medium');
      expect(result.recipe.cuisine).toBe('International');
      expect(result.recipe.ingredients).toEqual([]);
      expect(result.recipe.instructions).toEqual([]);
    });
  });
});
