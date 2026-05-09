import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Prisma Database Connection', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to the database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    expect(result).toEqual([{ connected: 1 }]);
  });

  it('should create and retrieve a family with elder profile', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: '999999',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: '李爷爷',
            age: 75,
            dialect: '四川话',
          },
        },
      },
      include: {
        elder: true,
      },
    });

    expect(family.id).toBeDefined();
    expect(family.inviteCode).toBe('999999');
    expect(family.elder).not.toBeNull();
    expect(family.elder?.name).toBe('李爷爷');
    expect(family.elder?.age).toBe(75);

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should enforce unique invite code constraint', async () => {
    const family1 = await prisma.family.create({
      data: {
        inviteCode: '888888',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      prisma.family.create({
        data: {
          inviteCode: '888888',
          inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.family.delete({ where: { id: family1.id } });
  });

  it('should create a session with checkpoints', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: '777777',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const session = await prisma.session.create({
      data: {
        familyId: family.id,
        phase: 'GREETING',
        checkpoints: {
          create: [
            {
              topicSummary: '聊天气',
              keyFacts: ['今天晴天', '温度25度'],
              moodSnapshot: '平静',
              checkpointId: 'cp-001',
            },
          ],
        },
      },
      include: {
        checkpoints: true,
      },
    });

    expect(session.checkpoints).toHaveLength(1);
    expect(session.checkpoints[0]?.topicSummary).toBe('聊天气');

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
  });
});
