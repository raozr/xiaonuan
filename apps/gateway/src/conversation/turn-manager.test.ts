import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@xiaonuan/prisma';
import {
  saveMessage,
  getRecentMessages,
  incrementTurnCount,
} from './turn-manager.js';

describe('Turn Manager', () => {
  let testPairing: any;
  let testSession: any;

  beforeEach(async () => {
    testPairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: `tm-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: { name: '测试被陪伴者', role: 'COMPANIONEE' },
        },
      },
    });
    testSession = await prisma.session.create({
      data: {
        pairingId: testPairing.id,
        phase: 'ACTIVE_CHAT',
        turnCount: 0,
      },
    });
  });

  afterEach(async () => {
    await prisma.sessionMessage.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.session.delete({ where: { id: testSession.id } });
    await prisma.pairing.delete({ where: { id: testPairing.id } });
  });

  it('should return the most recent messages, not the oldest', async () => {
    // Create 12 messages: alternating COMPANIONEE/AI
    for (let i = 1; i <= 12; i++) {
      await saveMessage(
        testSession.id,
        i % 2 === 1 ? 'COMPANIONEE' : 'AI',
        `msg-${i}`
      );
    }

    const recent = await getRecentMessages(testSession.id, 10);

    // Should get the most recent 10 (msg-3 through msg-12), not the oldest 10 (msg-1 through msg-10)
    expect(recent).toHaveLength(10);
    expect(recent[0]!.content).toBe('msg-3');
    expect(recent[9]!.content).toBe('msg-12');
  });

  it('should truncate content over 150 chars', async () => {
    const longText = 'a'.repeat(200);
    await saveMessage(testSession.id, 'COMPANIONEE', longText);

    const recent = await getRecentMessages(testSession.id, 10);
    expect(recent[0]!.content).toBe('a'.repeat(150) + '…');
  });

  it('should increment turn count', async () => {
    const updated = await incrementTurnCount(testSession.id);
    expect(updated.turnCount).toBe(1);
  });
});
