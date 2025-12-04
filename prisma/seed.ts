import { PrismaClient } from '@prisma/client';
import { seedRecipes } from './seed-data/recipes';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // Create a system user for seeded recipes
  console.log('👤 Creating system user for seed recipes...');
  const hashedPassword = await bcrypt.hash('Remy2024!', 10);

  const systemUser = await prisma.user.upsert({
    where: { email: 'remy@system.com' },
    update: {},
    create: {
      email: 'remy@system.com',
      username: 'RemyChef',
      password: hashedPassword,
      isVerified: true,
      isPrivate: false,
    },
  });

  console.log(`✅ System user created: ${systemUser.username} (${systemUser.email})\n`);

  // Seed recipes
  console.log(`📚 Seeding ${seedRecipes.length} recipes...\n`);

  let successCount = 0;
  let skipCount = 0;

  for (const recipe of seedRecipes) {
    try {
      // Check if recipe already exists
      const existing = await prisma.post.findFirst({
        where: {
          title: recipe.title,
          userId: systemUser.id,
        },
      });

      if (existing) {
        console.log(`⏭️  Skipping "${recipe.title}" (already exists)`);
        skipCount++;
        continue;
      }

      // Create recipe
      await prisma.post.create({
        data: {
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          userId: systemUser.id,
          cookingTime: recipe.cookingTime,
          prepTime: recipe.prepTime,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          ingredients: recipe.ingredients as any,
          instructions: recipe.instructions as any,
        },
      });

      console.log(`✅ Created: "${recipe.title}" (${recipe.difficulty})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error creating "${recipe.title}":`, error);
    }
  }

  console.log('\n📊 Seeding Summary:');
  console.log(`✅ Successfully created: ${successCount} recipes`);
  console.log(`⏭️  Skipped (already exist): ${skipCount} recipes`);
  console.log(`📚 Total recipes in database: ${successCount + skipCount}`);

  console.log('\n🎉 Database seeding completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
