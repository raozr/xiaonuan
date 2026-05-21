import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import { pruneEvents } from './event-archiver.js';

describe('event-archiver', () => {
  let pairing: any;

  beforeEach(async () => {
    pairing = await prisma.pairing.create({
      data: {
        name: 'Archive Test',
        inviteCode: `archive-test-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test', role: 'COMPANIONEE', isAI: false },
            { name: '小暖', role: 'COMPANIONEE', isAI: true },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    await prisma.eventStream.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.participant.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should keep events within 30 days', async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);

    await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        type: 'feed_message',
        content: 'Recent event',
        tags: [],
        eventTime: recent,
      },
    });

    await pruneEvents();

    const remaining = await prisma.eventStream.findMany({
      where: { pairingId: pairing.id },
    });
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.content).toBe('Recent event');
  });

  it('should delete events older than 90 days', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 100);

    await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        type: 'feed_message',
        content: 'Old event',
        tags: [],
        eventTime: old,
      },
    });

    const recent = new Date();
    recent.setDate(recent.getDate() - 10);

    await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        type: 'conversation_turn',
        content: 'Recent event',
        tags: [],
        eventTime: recent,
      },
    });

    await pruneEvents();

    const remaining = await prisma.eventStream.findMany({
      where: { pairingId: pairing.id },
    });
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.content).toBe('Recent event');
  });

  it('should return deleted count', async () => {
    const old1 = new Date();
    old1.setDate(old1.getDate() - 95);
    const old2 = new Date();
    old2.setDate(old2.getDate() - 100);

    await prisma.eventStream.createMany({
      data: [
        { pairingId: pairing.id, type: 'feed_message', content: 'Old 1', tags: [], eventTime: old1 },
        { pairingId: pairing.id, type: 'feed_message', content: 'Old 2', tags: [], eventTime: old2 },
      ],
    });

    const result = await pruneEvents();
    expect(result.deletedCount).toBe(2);
  });
});
