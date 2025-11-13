import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully!\n');

    // Count tables
    const userCount = await prisma.user.count();
    const postCount = await prisma.post.count();
    const commentCount = await prisma.comment.count();
    const likeCount = await prisma.like.count();
    const followCount = await prisma.follow.count();
    const storyCount = await prisma.story.count();

    console.log('📊 Database Statistics:');
    console.log('------------------------');
    console.log(`Users:    ${userCount}`);
    console.log(`Posts:    ${postCount}`);
    console.log(`Comments: ${commentCount}`);
    console.log(`Likes:    ${likeCount}`);
    console.log(`Follows:  ${followCount}`);
    console.log(`Stories:  ${storyCount}`);
    console.log('------------------------\n');

    if (userCount > 0) {
      console.log('👥 Recent Users:');
      const users = await prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          username: true,
          email: true,
          createdAt: true,
        },
      });

      users.forEach((user) => {
        console.log(`  - @${user.username} (${user.email}) - ${user.createdAt.toLocaleDateString()}`);
      });
      console.log('');
    }

    console.log('✨ Database is ready to use!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
