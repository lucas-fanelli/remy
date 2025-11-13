/**
 * Test script to verify recipe matching works with seeded data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRecipeMatching() {
  console.log('🧪 Testing Recipe Matching with Seeded Data\n');

  // Test Case 1: User with chicken, tomato, and pasta
  console.log('📋 Test Case 1: Basic Pantry (chicken, tomato, pasta)');
  const testPantry1 = ['chicken', 'tomato', 'pasta', 'garlic', 'olive oil'];
  await findMatches(testPantry1);

  console.log('\n' + '='.repeat(70) + '\n');

  // Test Case 2: User with lots of ingredients
  console.log('📋 Test Case 2: Well-Stocked Pantry');
  const testPantry2 = [
    'chicken breast', 'beef', 'salmon', 'egg', 'milk', 'butter',
    'tomato', 'onion', 'garlic', 'carrot', 'bell pepper',
    'pasta', 'rice', 'flour', 'sugar',
    'olive oil', 'soy sauce', 'salt', 'pepper',
  ];
  await findMatches(testPantry2);

  console.log('\n' + '='.repeat(70) + '\n');

  // Test Case 3: Vegetarian pantry
  console.log('📋 Test Case 3: Vegetarian Pantry');
  const testPantry3 = [
    'quinoa', 'chickpeas', 'sweet potato', 'kale', 'avocado',
    'tahini', 'lemon', 'olive oil', 'cumin',
  ];
  await findMatches(testPantry3);
}

async function findMatches(pantryItems: string[]) {
  console.log(`Pantry Items: ${pantryItems.join(', ')}\n`);

  // Get all recipes
  const recipes = await prisma.post.findMany({
    where: {
      ingredients: { not: null },
    },
    select: {
      id: true,
      title: true,
      ingredients: true,
      difficulty: true,
      cookingTime: true,
      cuisine: true,
    },
  });

  console.log(`Found ${recipes.length} recipes in database\n`);

  // Calculate matches
  const matches: Array<{
    title: string;
    cuisine: string;
    difficulty: string;
    cookingTime: number;
    matchPercentage: number;
    missingIngredients: string[];
  }> = [];

  for (const recipe of recipes) {
    const recipeIngredients = recipe.ingredients as Array<{
      name: string;
      amount: number;
      unit: string;
    }>;

    if (!recipeIngredients || recipeIngredients.length === 0) continue;

    let matchedCount = 0;
    const missingIngredients: string[] = [];

    for (const recipeIng of recipeIngredients) {
      const matched = pantryItems.some((pantryItem) =>
        ingredientMatches(pantryItem, recipeIng.name)
      );

      if (matched) {
        matchedCount++;
      } else {
        missingIngredients.push(recipeIng.name);
      }
    }

    const matchPercentage = Math.round(
      (matchedCount / recipeIngredients.length) * 100
    );

    matches.push({
      title: recipe.title || 'Untitled',
      cuisine: recipe.cuisine || 'Unknown',
      difficulty: recipe.difficulty || 'unknown',
      cookingTime: recipe.cookingTime || 0,
      matchPercentage,
      missingIngredients,
    });
  }

  // Sort by match percentage
  matches.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Categorize
  const readyToCook = matches.filter((m) => m.matchPercentage === 100);
  const almostThere = matches.filter(
    (m) => m.matchPercentage >= 70 && m.matchPercentage < 100
  );
  const needMore = matches.filter((m) => m.matchPercentage < 70);

  // Display results
  console.log(`🟢 Ready to Cook (100% match): ${readyToCook.length} recipes`);
  readyToCook.forEach((recipe) => {
    console.log(
      `   ✓ ${recipe.title} (${recipe.cuisine}, ${recipe.difficulty}, ${recipe.cookingTime}min)`
    );
  });

  console.log(
    `\n🟡 Almost There (70-99% match): ${almostThere.length} recipes`
  );
  almostThere.slice(0, 5).forEach((recipe) => {
    console.log(
      `   • ${recipe.title} - ${recipe.matchPercentage}% match (${recipe.cuisine}, ${recipe.difficulty})`
    );
    console.log(`     Missing: ${recipe.missingIngredients.slice(0, 3).join(', ')}${recipe.missingIngredients.length > 3 ? '...' : ''}`);
  });

  console.log(`\n🔴 Need More Ingredients (<70% match): ${needMore.length} recipes`);
  needMore.slice(0, 3).forEach((recipe) => {
    console.log(
      `   • ${recipe.title} - ${recipe.matchPercentage}% match (${recipe.cuisine})`
    );
  });
}

function ingredientMatches(pantryItem: string, recipeIngredient: string): boolean {
  const normalized1 = normalizeIngredient(pantryItem);
  const normalized2 = normalizeIngredient(recipeIngredient);

  return (
    normalized1 === normalized2 ||
    normalized1.includes(normalized2) ||
    normalized2.includes(normalized1)
  );
}

function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/s$/, '') // Remove plural 's'
    .replace(/es$/, '') // Remove plural 'es'
    .replace(/[^a-z0-9]/g, ''); // Remove special chars
}

// Run the test
testRecipeMatching()
  .then(() => {
    console.log('\n✅ Recipe matching test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
