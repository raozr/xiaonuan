import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('GET /api/pairings/:pairingId/events', () => {
  let user: any;
  let pairing: any;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        phone: `13900${Date.now()}${Math.floor(Math.random() * 1000)}`,
        role: 'STEWARD',
      },
    });

    pairing = await prisma.pairing.create({
      data: {
        name: 'Test Companionee',
        inviteCode: `events-test-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test Companionee', role: 'COMPANIONEE', isAI: false },
            {
              name: user.phone ?? 'Child',
              role: 'STEWARD',
              isAI: false,
              userId: user.id,
              metadata: { relationshipToCompanionee: '家人', isPrimary: true },
            },
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
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return events for a pairing', async () => {
    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });

    await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        type: 'feed_message',
        content: '妈妈明天要去医院',
        tags: ['TEXT'],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].content).toBe('妈妈明天要去医院');
  });

  it('should filter by event type', async () => {
    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });

    await prisma.eventStream.createMany({
      data: [
        { pairingId: pairing.id, type: 'feed_message', content: '文字消息', tags: ['TEXT'] },
        { pairingId: pairing.id, type: 'conversation_extracted', content: '对话摘要', tags: [] },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events?type=feed_message`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].type).toBe('feed_message');
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 for non-member', async () => {
    const outsider = await prisma.user.create({
      data: { phone: `13999${Date.now()}`, role: 'STEWARD' },
    });
    const token = app.jwt.sign({ userId: outsider.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);

    await prisma.user.delete({ where: { id: outsider.id } });
  });
});

describe('GET /api/pairings/:pairingId/events/today', () => {
  let user: any;
  let pairing: any;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        phone: `13901${Date.now()}${Math.floor(Math.random() * 1000)}`,
        role: 'STEWARD',
      },
    });

    pairing = await prisma.pairing.create({
      data: {
        name: 'Test Companionee',
        inviteCode: `events-today-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test Companionee', role: 'COMPANIONEE', isAI: false },
            {
              name: user.phone ?? 'Child',
              role: 'STEWARD',
              isAI: false,
              userId: user.id,
              metadata: { relationshipToCompanionee: '家人', isPrimary: true },
            },
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
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return today events only', async () => {
    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });

    // Today event
    await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        type: 'feed_message',
        content: '今天的消息',
        tags: ['TEXT'],
        eventTime: new Date(),
      },
    });

    // Old event (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    await prisma.eventStream.create({
      data: {
        pairingId: pairing.id,
        type: 'feed_message',
        content: '昨天的消息',
        tags: ['TEXT'],
        eventTime: yesterday,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events/today`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].content).toBe('今天的消息');
  });

  it('should return empty when no today events', async () => {
    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events/today`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});
