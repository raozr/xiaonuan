import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import { getTodayEvents, getRecentEvents, getEventsByType } from '../memory/event-stream.js';

describe('EventStream Query Service', () => {
  let testPairing: any;

  beforeEach(async () => {
    testPairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: `es-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试被陪伴者', role: 'COMPANIONEE' },
        },
      },
    });

    // Seed events
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await prisma.eventStream.createMany({
      data: [
        {
          pairingId: testPairing.id,
          type: 'conversation_turn',
          content: '昨天的对话',
          eventTime: yesterday,
        },
        {
          pairingId: testPairing.id,
          type: 'feed_message',
          content: '今天的动态',
          eventTime: now,
          tags: ['daily'],
        },
        {
          pairingId: testPairing.id,
          type: 'info_extracted',
          content: '喜欢喝茶',
          eventTime: now,
          tags: ['hobby'],
          payload: { category: 'hobby' },
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.eventStream.deleteMany({ where: { pairingId: testPairing.id } });
    await prisma.pairing.delete({ where: { id: testPairing.id } });
  });

  it('getTodayEvents should return only today events', async () => {
    const today = await getTodayEvents(testPairing.id);

    expect(today).toHaveLength(2);
    expect(today.map(e => e.content)).toContain('今天的动态');
    expect(today.map(e => e.content)).toContain('喜欢喝茶');
    expect(today.map(e => e.content)).not.toContain('昨天的对话');
  });

  it('getRecentEvents should return most recent events', async () => {
    const recent = await getRecentEvents(testPairing.id, 2);

    expect(recent).toHaveLength(2);
    expect(recent[0]!.eventTime.getTime()).toBeGreaterThanOrEqual(recent[1]!.eventTime.getTime());
  });

  it('getEventsByType should filter by type', async () => {
    const feedEvents = await getEventsByType(testPairing.id, 'feed_message');

    expect(feedEvents).toHaveLength(1);
    expect(feedEvents[0]!.content).toBe('今天的动态');
  });

  it('getEventsByType with empty result', async () => {
    const moodEvents = await getEventsByType(testPairing.id, 'mood_change');

    expect(moodEvents).toHaveLength(0);
  });
});
