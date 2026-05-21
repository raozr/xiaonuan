import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import { emitEvent, flushEvents, shutdownEventBus } from '../events/event-bus.js';

describe('EventBus', () => {
  let testPairing: any;

  beforeEach(async () => {
    testPairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: `eb-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试被陪伴者', role: 'COMPANIONEE' },
        },
      },
    });
  });

  afterEach(async () => {
    await shutdownEventBus();
    await prisma.eventStream.deleteMany({ where: { pairingId: testPairing.id } });
    await prisma.pairing.delete({ where: { id: testPairing.id } });
  });

  it('should flush events to database', async () => {
    await emitEvent({
      pairingId: testPairing.id,
      type: 'feed_message',
      content: '对方今天吃了米饭',
    }, { immediate: true });

    const events = await prisma.eventStream.findMany({
      where: { pairingId: testPairing.id },
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.content).toBe('对方今天吃了米饭');
    expect(events[0]!.type).toBe('feed_message');
  });

  it('should include optional fields when provided', async () => {
    await emitEvent({
      pairingId: testPairing.id,
      type: 'info_extracted',
      content: '喜欢听京剧',
      tags: ['hobby'],
      payload: { category: 'hobby', confidence: 0.9 },
    }, { immediate: true });

    const events = await prisma.eventStream.findMany({
      where: { pairingId: testPairing.id },
    });

    expect(events[0]!.tags).toContain('hobby');
    expect(events[0]!.payload).toEqual({ category: 'hobby', confidence: 0.9 });
  });

  it('should batch flush buffered events', async () => {
    // Emit 3 events (below threshold of 10)
    for (let i = 0; i < 3; i++) {
      await emitEvent({
        pairingId: testPairing.id,
        type: 'conversation_turn',
        content: `对话轮次 ${i + 1}`,
      });
    }

    // Force flush
    await flushEvents();

    const events = await prisma.eventStream.findMany({
      where: { pairingId: testPairing.id },
      orderBy: { eventTime: 'asc' },
    });

    expect(events).toHaveLength(3);
    expect(events[0]!.content).toBe('对话轮次 1');
    expect(events[2]!.content).toBe('对话轮次 3');
  });
});
