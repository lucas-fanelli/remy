import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  IAIRecipeProvider,
  AIRecipeRequest,
  AIRecipeResponse,
  RateLimitInfo,
  CookingContext,
} from '@/domain/types/ai-provider';
import { Recipe, Ingredient, Instruction } from '@/domain/types/recipe';

/**
 * Gemini AI Provider Implementation
 * Implements IAIRecipeProvider interface for Google's Gemini API
 * Follows Single Responsibility Principle - only handles Gemini interactions
 */
export class GeminiRecipeProvider implements IAIRecipeProvider {
  readonly name = 'gemini';
  readonly model = 'gemini-1.5-pro';

  private genAI: GoogleGenerativeAI | null = null;

  constructor(private apiKey: string) {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  isConfigured(): boolean {
    return this.genAI !== null && this.apiKey !== '';
  }

  getRateLimitInfo(): RateLimitInfo {
    return {
      requestsPerMinute: 15,
      requestsPerDay: 1500,
      costPerRequest: 0,
    };
  }

  async generateRecipe(request: AIRecipeRequest): Promise<AIRecipeResponse> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API is not configured. Please provide an API key.');
    }

    const prompt = this.buildRecipePrompt(request);
    const model = this.genAI!.getGenerativeModel({ model: this.model });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const recipe = this.parseRecipeResponse(text, request);

      return {
        recipe,
        provider: this.name,
        model: this.model,
        tokensUsed: response.usageMetadata?.totalTokenCount,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Failed to generate recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async suggestSubstitutions(ingredient: string, context: string): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API is not configured.');
    }

    const prompt = `You are a professional chef. Suggest 3-5 suitable substitutions for "${ingredient}" in the context: "${context}".

    Respond with ONLY a JSON array of strings, like this:
    ["substitute 1", "substitute 2", "substitute 3"]

    No additional text or formatting.`;

    const model = this.genAI!.getGenerativeModel({ model: this.model });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Gemini substitution error:', error);
      throw new Error('Failed to get substitution suggestions');
    }
  }

  async getCookingAdvice(question: string, context?: CookingContext): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API is not configured.');
    }

    let prompt = `You are a professional chef and cooking instructor. Answer this cooking question concisely and helpfully:\n\n${question}`;

    if (context) {
      prompt += `\n\nContext:`;
      if (context.recipeTitle) prompt += `\n- Recipe: ${context.recipeTitle}`;
      if (context.currentStep) prompt += `\n- Current Step: ${context.currentStep}`;
      if (context.ingredients) prompt += `\n- Ingredients: ${context.ingredients.join(', ')}`;
    }

    const model = this.genAI!.getGenerativeModel({ model: this.model });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini advice error:', error);
      throw new Error('Failed to get cooking advice');
    }
  }

  /**
   * Build a detailed prompt for recipe generation
   */
  private buildRecipePrompt(request: AIRecipeRequest): string {
    const { ingredients, preferences } = request;

    let prompt = `You are a professional chef. Create a detailed, delicious recipe using these ingredients: ${ingredients.join(', ')}.

REQUIREMENTS:
- The recipe MUST use at least 80% of the provided ingredients
- Create an appetizing, creative title
- Write a compelling description (2-3 sentences)
- Provide exact measurements for all ingredients
- Write clear, step-by-step instructions
- Include prep time and cooking time
- Specify difficulty level and number of servings

`;

    if (preferences) {
      if (preferences.cuisine) prompt += `- Cuisine style: ${preferences.cuisine}\n`;
      if (preferences.difficulty) prompt += `- Difficulty: ${preferences.difficulty}\n`;
      if (preferences.maxCookingTime) prompt += `- Maximum cooking time: ${preferences.maxCookingTime} minutes\n`;
      if (preferences.dietary && preferences.dietary.length > 0) {
        prompt += `- Dietary restrictions: ${preferences.dietary.join(', ')}\n`;
      }
      if (preferences.mealType) prompt += `- Meal type: ${preferences.mealType}\n`;
      if (preferences.servings) prompt += `- Servings: ${preferences.servings}\n`;
      if (preferences.spicyLevel) prompt += `- Spicy level: ${preferences.spicyLevel}\n`;
      if (preferences.additionalInstructions) {
        prompt += `- Additional requirements: ${preferences.additionalInstructions}\n`;
      }
    }

    prompt += `
Respond with ONLY a JSON object in this EXACT format (no additional text):
{
  "title": "Recipe Title",
  "description": "Description of the dish",
  "cuisine": "Cuisine type",
  "difficulty": "easy|medium|hard",
  "prepTime": 15,
  "cookingTime": 30,
  "servings": 4,
  "ingredients": [
    {"name": "ingredient name", "amount": "1", "unit": "cup"}
  ],
  "instructions": [
    {"step": 1, "description": "First step instructions"}
  ]
}`;

    return prompt;
  }

  /**
   * Parse Gemini's response into a Recipe object
   */
  private parseRecipeResponse(text: string, request: AIRecipeRequest): Recipe {
    try {
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const data = JSON.parse(cleanText);

      // Create a complete recipe object
      const recipe: Recipe = {
        id: '', // Will be set when saved to database
        title: data.title || 'AI Generated Recipe',
        description: data.description || '',
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=600&fit=crop', // Placeholder
        userId: request.userId,
        cookingTime: data.cookingTime || 30,
        prepTime: data.prepTime || 15,
        servings: data.servings || 4,
        difficulty: data.difficulty || 'medium',
        cuisine: data.cuisine || 'International',
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        caption: `AI-generated recipe using: ${request.ingredients.join(', ')}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return recipe;
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Response text:', text);
      throw new Error('Failed to parse recipe from AI response. The AI may have returned invalid JSON.');
    }
  }
}
