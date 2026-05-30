import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const pairing = await prisma.pairing.upsert({
    where: { inviteCode: '123456' },
    update: {
      inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    create: {
      name: '张奶奶的家庭',
      inviteCode: '123456',
      inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      participants: {
        create: [
          {
            name: '张奶奶',
            role: 'COMPANIONEE',
            isAI: false,
            metadata: {
              age: 72,
              dialect: '普通话',
              timezone: 'Asia/Shanghai',
            },
          },
          {
            name: '小暖',
            role: 'COMPANIONEE',
            isAI: true,
            metadata: {
              template: 'caring-companion',
            },
          },
        ],
      },
    },
  });

  console.log(`Seeded pairing with id: ${pairing.id}`);
  console.log('Invite code: 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
