import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

async function createPairingAndUser() {
  const user = await prisma.user.create({
    data: {
      phone: `13900${Date.now()}${Math.floor(Math.random() * 1000)}`,
      role: 'CHILD',
    },
  });

  const pairing = await prisma.pairing.create({
    data: {
      name: 'Test Elder',
      inviteCode: `int-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      participants: {
        create: [
          {
            name: 'Test Elder',
            role: 'ELDER',
            isAI: false,
            metadata: { age: '75' },
          },
          {
            name: user.phone ?? 'Child',
            role: 'CHILD',
            isAI: false,
            userId: user.id,
            metadata: { relationshipToElder: '子女', isPrimary: true },
          },
          {
            name: '小暖',
            role: 'ELDER',
            isAI: true,
            metadata: { template: 'caring-companion' },
          },
        ],
      },
    },
    include: { participants: true },
  });

  return { user, pairing };
}

async function createElderDeviceToken(pairingId: string) {
  const elder = await prisma.participant.findFirst({
    where: { pairingId, role: 'ELDER', isAI: false },
  });
  const updatedMeta = { ...(elder?.metadata as Record<string, unknown> ?? {}), deviceId: 'int-test-device' };
  await prisma.participant.update({
    where: { id: elder!.id },
    data: { metadata: updatedMeta },
  });
  const token = app.jwt.sign(
    { pairingId, role: 'ELDER', deviceId: 'int-test-device' },
    { expiresIn: '365d' }
  );
  return token;
}

describe('Integration: Feed-to-EventStream E2E', () => {
  let user: any;
  let pairing: any;

  beforeAll(async () => {
    const result = await createPairingAndUser();
    user = result.user;
    pairing = result.pairing;
  });

  afterAll(async () => {
    await prisma.eventStream.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.participant.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should create a feed and verify EventStream row exists', async () => {
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });
    const content = `E2E feed test ${Date.now()}`;

    // Create feed
    const feedRes = await app.inject({
      method: 'POST',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'TEXT', content },
    });

    expect(feedRes.statusCode).toBe(201);
    const feedBody = JSON.parse(feedRes.body);
    expect(feedBody.success).toBe(true);

    // Verify EventStream has the event
    const events = await prisma.eventStream.findMany({
      where: { pairingId: pairing.id, content },
      orderBy: { eventTime: 'desc' },
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe('feed_message');
    expect(events[0]!.tags).toContain('TEXT');
  });
});

describe('Integration: Elder role access to shared endpoints', () => {
  let user: any;
  let pairing: any;
  let elderToken: string;

  beforeAll(async () => {
    const result = await createPairingAndUser();
    user = result.user;
    pairing = result.pairing;
    elderToken = await createElderDeviceToken(pairing.id);
  });

  afterAll(async () => {
    await prisma.eventStream.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.participant.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should deny elder from listing feeds (requires CHILD userId)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${elderToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should deny elder from listing events (requires CHILD userId)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
      headers: { authorization: `Bearer ${elderToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 for elder accessing pairing detail (requires userId)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${elderToken}` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('Integration: Multi-participant isolation', () => {
  let primaryUser: any;
  let secondaryUser: any;
  let pairing: any;

  beforeAll(async () => {
    primaryUser = await prisma.user.create({
      data: {
        phone: `13901${Date.now()}${Math.floor(Math.random() * 1000)}`,
        role: 'CHILD',
      },
    });

    secondaryUser = await prisma.user.create({
      data: {
        phone: `13902${Date.now()}${Math.floor(Math.random() * 1000)}`,
        role: 'CHILD',
      },
    });

    pairing = await prisma.pairing.create({
      data: {
        name: 'Multi-participant Test',
        inviteCode: `multi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test Elder', role: 'ELDER', isAI: false },
            {
              name: primaryUser.phone ?? 'Primary Child',
              role: 'CHILD',
              isAI: false,
              userId: primaryUser.id,
              metadata: { relationshipToElder: '子女', isPrimary: true },
            },
            {
              name: secondaryUser.phone ?? 'Secondary Child',
              role: 'CHILD',
              isAI: false,
              userId: secondaryUser.id,
              metadata: { relationshipToElder: '子女', isPrimary: false },
            },
            { name: '小暖', role: 'ELDER', isAI: true },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.eventStream.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.participant.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: secondaryUser.id } });
    await prisma.user.delete({ where: { id: primaryUser.id } });
  });

  it('should allow non-primary child to post feeds', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'TEXT', content: 'Secondary child feed' },
    });

    expect(response.statusCode).toBe(201);
  });

  it('should allow non-primary child to view events', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should prevent non-primary child from deleting pairing', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);

    // Verify pairing still exists
    const check = await prisma.pairing.findUnique({ where: { id: pairing.id } });
    expect(check).not.toBeNull();
  });

  it('should allow any child in pairing to update elder profile (no primary check)', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/pairings/${pairing.id}/elder`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Name' },
    });

    // Any CHILD participant can update elder profile (no primary-only restriction)
    expect(response.statusCode).toBe(200);
  });

  it('should prevent non-member from updating elder profile', async () => {
    const outsider = await prisma.user.create({
      data: { phone: `13999${Date.now()}`, role: 'CHILD' },
    });
    const token = app.jwt.sign({ userId: outsider.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/pairings/${pairing.id}/elder`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Hacked' },
    });

    expect(response.statusCode).toBe(403);

    await prisma.user.delete({ where: { id: outsider.id } });
  });
});
