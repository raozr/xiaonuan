import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

// Mock the event-bus and extraction-service to verify calls
vi.mock('../events/event-bus.js', () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/extraction-service.js', () => ({
  enqueueExtraction: vi.fn().mockResolvedValue('mock-job-id'),
}));

import { emitEvent } from '../events/event-bus.js';
import { enqueueExtraction } from '../services/extraction-service.js';

describe('POST /api/pairings/:pairingId/feeds', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Create a user and pairing
    const user = await prisma.user.create({
      data: {
        phone: `13900${Date.now()}${Math.floor(Math.random() * 1000)}`,
        role: 'STEWARD',
      },
    });

    const pairing = await prisma.pairing.create({
      data: {
        name: 'Test Companionee',
        inviteCode: `feed-test-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            {
              name: 'Test Companionee',
              role: 'COMPANIONEE',
              isAI: false,
            },
            {
              name: user.phone ?? 'Child',
              role: 'STEWARD',
              isAI: false,
              userId: user.id,
              metadata: { relationshipToCompanionee: '家人', isPrimary: true },
            },
            {
              name: '小暖',
              role: 'COMPANIONEE',
              isAI: true,
            },
          ],
        },
      },
    });

    (globalThis as any).__testUser = user;
    (globalThis as any).__testPairing = pairing;
  });

  afterEach(async () => {
    const pairing = (globalThis as any).__testPairing;
    if (pairing) {
      await prisma.participant.deleteMany({ where: { pairingId: pairing.id } });
      await prisma.pairing.delete({ where: { id: pairing.id } });
    }
    const user = (globalThis as any).__testUser;
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should create a text feed', async () => {
    const user = (globalThis as any).__testUser;
    const pairing = (globalThis as any).__testPairing;

    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'TEXT',
        content: '妈妈明天要去医院复查',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('妈妈明天要去医院复查');
    expect(body.data.type).toBe('TEXT');

    // Verify EventStream emit
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        pairingId: pairing.id,
        type: 'feed_message',
        content: '妈妈明天要去医院复查',
        tags: ['TEXT'],
      }),
      { immediate: true }
    );

    // Verify Bull Queue enqueue
    expect(enqueueExtraction).toHaveBeenCalledWith(
      'feed',
      pairing.id,
      '妈妈明天要去医院复查',
      'STEWARD'
    );
  });

  it('should reject empty content for text feed', async () => {
    const user = (globalThis as any).__testUser;
    const pairing = (globalThis as any).__testPairing;

    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'TEXT',
        content: '  ',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(emitEvent).not.toHaveBeenCalled();
    expect(enqueueExtraction).not.toHaveBeenCalled();
  });
});
