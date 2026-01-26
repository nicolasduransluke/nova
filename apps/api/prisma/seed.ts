import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'demo@nova.app' },
    update: {},
    create: {
      id: 'demo-user-001',
      email: 'demo@nova.app',
      name: 'Demo User',
      metadata: JSON.stringify({ timezone: 'America/New_York' }),
    },
  });

  console.log('Created user:', user.email);

  // Create profile for user
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      weight: 75,
      height: 175,
      age: 30,
      sex: 'male',
      objective: 'weight_loss',
    },
  });

  console.log('Created profile for user');

  // Create some sample daily entries
  const entries = [
    {
      userId: user.id,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      type: 'custom',
      data: JSON.stringify({ weight: 76 }),
      novaPoints: 15,
    },
    {
      userId: user.id,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
      type: 'custom',
      data: JSON.stringify({ weight: 75.5 }),
      novaPoints: 15,
    },
    {
      userId: user.id,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      type: 'exercise',
      data: JSON.stringify({ type: 'running', duration: 30 }),
      novaPoints: 20,
    },
  ];

  for (const entry of entries) {
    await prisma.dailyEntry.create({ data: entry });
  }

  console.log('Created sample daily entries');

  console.log('Seeding complete!');
  console.log('');
  console.log('Demo user credentials:');
  console.log('  User ID: demo-user-001');
  console.log('  Email: demo@nova.app');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
