const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNotifications() {
  try {
    // Get users first
    const users = await prisma.user.findMany({
      select: { id: true, username: true }
    });

    console.log('\n=== Users ===\n');
    users.forEach(u => console.log(`${u.username}: ${u.id}`));

    const notifications = await prisma.notification.findMany({
      include: {
        sender: { select: { username: true, id: true } },
        recipient: { select: { username: true, id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n=== Total notifications:', notifications.length, '===\n');

    notifications.forEach(n => {
      console.log(`${n.type} notification:`);
      console.log(`  From: ${n.sender.username} (${n.senderId})`);
      console.log(`  To: ${n.recipient.username} (${n.recipientId})`);
      console.log(`  Read: ${n.isRead}`);
      console.log(`  Created: ${n.createdAt}`);
      console.log('');
    });

    // Also check follows
    const follows = await prisma.follow.findMany({
      include: {
        follower: { select: { username: true } },
        following: { select: { username: true } }
      }
    });

    console.log('\n=== Total follows:', follows.length, '===\n');
    follows.forEach(f => {
      console.log(`${f.follower.username} follows ${f.following.username}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();
