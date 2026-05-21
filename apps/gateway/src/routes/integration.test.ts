import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

async function createPairingAndUser() {
  const user = await prisma.user.create({
    data: {
      phone: `13900${Date.now()}${Math.floor(Math.random() * 1000)}`,
      role: 'STEWARD',
    },
  });

  const pairing = await prisma.pairing.create({
    data: {
      name: 'Test Companionee',
      inviteCode: `int-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      participants: {
        create: [
          {
            name: 'Test Companionee',
            role: 'COMPANIONEE',
            isAI: false,
            metadata: { age: '75' },
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
            metadata: { template: 'caring-companion' },
          },
        ],
      },
    },
    include: { participants: true },
  });

  return { user, pairing };
}

async function createCompanioneeDeviceToken(pairingId: string) {
  const companionee = await prisma.participant.findFirst({
    where: { pairingId, role: 'COMPANIONEE', isAI: false },
  });
  const updatedMeta = { ...(companionee?.metadata as Record<string, unknown> ?? {}), deviceId: 'int-test-device' };
  await prisma.participant.update({
    where: { id: companionee!.id },
    data: { metadata: updatedMeta },
  });
  const token = app.jwt.sign(
    { pairingId, role: 'COMPANIONEE', deviceId: 'int-test-device' },
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
    const token = app.jwt.sign({ userId: user.id, role: 'STEWARD' }, { expiresIn: '7d' });
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

describe('Integration: Companionee role access to shared endpoints', () => {
  let user: any;
  let pairing: any;
  let companioneeToken: string;

  beforeAll(async () => {
    const result = await createPairingAndUser();
    user = result.user;
    pairing = result.pairing;
    companioneeToken = await createCompanioneeDeviceToken(pairing.id);
  });

  afterAll(async () => {
    await prisma.eventStream.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.participant.deleteMany({ where: { pairingId: pairing.id } });
    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should deny companionee from listing feeds (requires STEWARD userId)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${companioneeToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should deny companionee from listing events (requires STEWARD userId)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
      headers: { authorization: `Bearer ${companioneeToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 for companionee accessing pairing detail (requires userId)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${companioneeToken}` },
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
        role: 'STEWARD',
      },
    });

    secondaryUser = await prisma.user.create({
      data: {
        phone: `13902${Date.now()}${Math.floor(Math.random() * 1000)}`,
        role: 'STEWARD',
      },
    });

    pairing = await prisma.pairing.create({
      data: {
        name: 'Multi-participant Test',
        inviteCode: `multi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test Companionee', role: 'COMPANIONEE', isAI: false },
            {
              name: primaryUser.phone ?? 'Primary Steward',
              role: 'STEWARD',
              isAI: false,
              userId: primaryUser.id,
              metadata: { relationshipToCompanionee: '家人', isPrimary: true },
            },
            {
              name: secondaryUser.phone ?? 'Secondary Steward',
              role: 'STEWARD',
              isAI: false,
              userId: secondaryUser.id,
              metadata: { relationshipToCompanionee: '家人', isPrimary: false },
            },
            { name: '小暖', role: 'COMPANIONEE', isAI: true },
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

  it('should allow non-primary steward to post feeds', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'TEXT', content: 'Secondary child feed' },
    });

    expect(response.statusCode).toBe(201);
  });

  it('should allow non-primary steward to view events', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should prevent non-primary steward from deleting pairing', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'STEWARD' }, { expiresIn: '7d' });

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

  it('should allow any steward in pairing to update companionee profile (no primary check)', async () => {
    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/pairings/${pairing.id}/companionee`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Name' },
    });

    // Any STEWARD participant can update companionee profile (no primary-only restriction)
    expect(response.statusCode).toBe(200);
  });

  it('should prevent non-member from updating companionee profile', async () => {
    const outsider = await prisma.user.create({
      data: { phone: `13999${Date.now()}`, role: 'STEWARD' },
    });
    const token = app.jwt.sign({ userId: outsider.id, role: 'STEWARD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/pairings/${pairing.id}/companionee`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Hacked' },
    });

    expect(response.statusCode).toBe(403);

    await prisma.user.delete({ where: { id: outsider.id } });
  });
});
