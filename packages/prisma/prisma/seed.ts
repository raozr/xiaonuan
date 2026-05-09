import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const family = await prisma.family.create({
    data: {
      inviteCode: '123456',
      inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      elder: {
        create: {
          name: '张奶奶',
          age: 72,
          dialect: '普通话',
        },
      },
    },
  });

  console.log(`Created family with id: ${family.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
