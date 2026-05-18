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

  it('should create a pairing with participants and AI persona', async () => {
    const pairing = await prisma.pairing.create({
      data: {
        name: '奶奶陪伴',
        inviteCode: '999999',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: '张奶奶', role: 'ELDER', metadata: { dialect: '四川话', timezone: 'Asia/Shanghai' } },
            { name: '小明', role: 'CHILD', phone: '13800138000' },
            { name: '小暖AI', role: 'CHILD', isAI: true },
          ],
        },
        aiPersona: {
          create: {
            name: '贴心小暖',
            template: 'caring-companion',
            traits: { warm: true, patient: true, respectful: true },
            tone: 'caring',
          },
        },
      },
      include: {
        participants: true,
        aiPersona: true,
      },
    });

    expect(pairing.id).toBeDefined();
    expect(pairing.inviteCode).toBe('999999');
    expect(pairing.participants).toHaveLength(3);
    expect(pairing.participants.some((p) => p.isAI)).toBe(true);
    expect(pairing.participants.some((p) => p.role === 'ELDER' && !p.isAI)).toBe(true);
    expect(pairing.aiPersona).not.toBeNull();
    expect(pairing.aiPersona?.name).toBe('贴心小暖');

    // Cleanup
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should enforce unique invite code constraint', async () => {
    const pairing1 = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: '888888',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      prisma.pairing.create({
        data: {
          name: 'Test Pairing 2',
          inviteCode: '888888',
          inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.pairing.delete({ where: { id: pairing1.id } });
  });

  it('should create a session with checkpoints under a pairing', async () => {
    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: '777777',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const session = await prisma.session.create({
      data: {
        pairingId: pairing.id,
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
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should create EventStream events and PersonaProfile entries', async () => {
    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: '666666',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test Elder', role: 'ELDER' },
          ],
        },
      },
      include: {
        participants: true,
      },
    });

    const elder = pairing.participants[0]!;

    const event = await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        actorId: elder.id,
        type: 'feed_message',
        content: '奶奶今天吃了两碗饭',
        tags: ['health', 'diet'],
        payload: { meal: 'lunch', amount: 'large' },
      },
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe('feed_message');
    expect(event.tags).toContain('health');

    const profile = await prisma.personaProfile.create({
      data: {
        pairingId: pairing.id,
        participantId: elder.id,
        category: 'health',
        content: '食欲良好，午餐吃两碗饭',
        confidence: 0.8,
        source: 'feed',
      },
    });

    expect(profile.id).toBeDefined();
    expect(profile.confidence).toBe(0.8);

    // Cleanup
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should create FeedMessage without category field', async () => {
    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: '555555',
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const feed = await prisma.feedMessage.create({
      data: {
        pairingId: pairing.id,
        type: 'TEXT',
        content: '今天天气真好',
      },
    });

    expect(feed.id).toBeDefined();
    expect(feed.content).toBe('今天天气真好');
    // FeedMessage should NOT have a category field
    expect(feed).not.toHaveProperty('category');

    // Cleanup
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });
});
