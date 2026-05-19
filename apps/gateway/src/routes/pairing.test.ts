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
      inviteCode: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      aiPersona: {
        create: {
          name: '贴心小暖',
          template: 'caring-companion',
          traits: { warm: true, humorous: true, patient: true },
          tone: '口语化',
          constraints: {},
        },
      },
    },
    include: { participants: true },
  });

  return { user, pairing };
}

describe('GET /api/pairings', () => {
  it('should return array of pairings for authenticated child', async () => {
    const { user, pairing } = await createPairingAndUser();

    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/pairings',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pairings',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/pairings/:pairingId', () => {
  it('should return pairing detail for member', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(pairing.id);

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return 403 for non-member', async () => {
    const { pairing } = await createPairingAndUser();
    const outsider = await prisma.user.create({
      data: { phone: `13999${Date.now()}`, role: 'CHILD' },
    });
    const token = app.jwt.sign({ userId: outsider.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: outsider.id } });
  });
});

describe('POST /api/pairings', () => {
  it('should create a pairing with elder info and 6-digit invite code', async () => {
    const user = await prisma.user.create({
      data: { phone: `13800${Date.now()}`, role: 'CHILD' },
    });
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pairings',
      payload: {
        elderName: '王爷爷',
        elderAge: 78,
        elderDialect: '上海话',
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.inviteCode).toMatch(/^\d{6}$/);

    await prisma.pairing.delete({ where: { id: body.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should require auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pairings',
      payload: { elderName: '王爷爷' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should require elder name', async () => {
    const user = await prisma.user.create({
      data: { phone: `13800${Date.now()}`, role: 'CHILD' },
    });
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pairings',
      payload: { elderAge: 78 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);

    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('POST /api/pairings/:pairingId/refresh-code', () => {
  it('should regenerate 6-digit invite code for existing pairing', async () => {
    const { user, pairing } = await createPairingAndUser();
    const oldCode = pairing.inviteCode;
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/pairings/${pairing.id}/refresh-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.inviteCode).toMatch(/^\d{6}$/);
    expect(body.inviteCode).not.toBe(oldCode);

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should require auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pairings/some-id/refresh-code',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('PUT /api/pairings/:pairingId/elder', () => {
  it('should update elder profile metadata', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/pairings/${pairing.id}/elder`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: '王奶奶',
        age: 78,
        dialect: '四川话',
        hobbies: '养花、听京剧',
        healthNotes: '腰不好',
        topicsToAvoid: '已故的老伴',
        greetingPreference: '称呼我老王就行',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.elder.name).toBe('王奶奶');

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should only update elder in the same pairing', async () => {
    const { user, pairing: pairingA } = await createPairingAndUser();
    const { pairing: pairingB } = await createPairingAndUser();

    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/pairings/${pairingA.id}/elder`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '改名A' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.elder.name).toBe('改名A');

    const elderB = await prisma.participant.findFirst({
      where: { pairingId: pairingB.id, role: 'ELDER', isAI: false },
    });
    expect(elderB!.name).toBe('Test Elder');

    await prisma.pairing.delete({ where: { id: pairingA.id } });
    await prisma.pairing.delete({ where: { id: pairingB.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('POST /api/pairings/bind', () => {
  it('should bind device and return JWT', async () => {
    const { pairing } = await createPairingAndUser();

    const response = await app.inject({
      method: 'POST',
      url: '/api/pairings/bind',
      payload: { inviteCode: pairing.inviteCode, deviceId: 'device-a' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('ELDER');

    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should allow new device to rebind with same invite code', async () => {
    const { pairing } = await createPairingAndUser();

    const first = await app.inject({
      method: 'POST',
      url: '/api/pairings/bind',
      payload: { inviteCode: pairing.inviteCode, deviceId: 'device-a' },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = JSON.parse(first.body);
    const firstToken = firstBody.token;

    const second = await app.inject({
      method: 'POST',
      url: '/api/pairings/bind',
      payload: { inviteCode: pairing.inviteCode, deviceId: 'device-b' },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = JSON.parse(second.body);
    expect(secondBody.success).toBe(true);
    expect(secondBody.token).toBeDefined();

    const oldDeviceCheck = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${firstToken}` },
    });
    expect(oldDeviceCheck.statusCode).toBe(401);

    await prisma.pairing.delete({ where: { id: pairing.id } });
  });

  it('should reject expired invite code', async () => {
    const { pairing } = await createPairingAndUser();
    await prisma.pairing.update({
      where: { id: pairing.id },
      data: { inviteCodeExpiresAt: new Date(Date.now() - 1000) },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pairings/bind',
      payload: { inviteCode: pairing.inviteCode, deviceId: 'device-x' },
    });

    expect(response.statusCode).toBe(410);

    await prisma.pairing.delete({ where: { id: pairing.id } });
  });
});

describe('DELETE /api/pairings/:pairingId/bind', () => {
  it('should unbind elder device for primary child', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    // First bind
    await app.inject({
      method: 'POST',
      url: '/api/pairings/bind',
      payload: { inviteCode: pairing.inviteCode, deviceId: 'device-u' },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pairings/${pairing.id}/bind`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const elder = await prisma.participant.findFirst({
      where: { pairingId: pairing.id, role: 'ELDER', isAI: false },
    });
    const meta = elder?.metadata as Record<string, string> | null;
    expect(meta?.deviceId).toBeUndefined();

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('DELETE /api/pairings/:pairingId', () => {
  it('should delete pairing for primary child', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const gone = await prisma.pairing.findUnique({ where: { id: pairing.id } });
    expect(gone).toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should reject delete by non-primary child', async () => {
    const { user: primaryUser, pairing } = await createPairingAndUser();
    const secondaryUser = await prisma.user.create({
      data: { phone: `13988${Date.now()}`, role: 'CHILD' },
    });
    // Add secondary child participant to same pairing
    await prisma.participant.create({
      data: {
        pairingId: pairing.id,
        role: 'CHILD',
        isAI: false,
        userId: secondaryUser.id,
        name: secondaryUser.phone ?? 'Secondary',
        metadata: { relationshipToElder: '子女', isPrimary: false },
      },
    });

    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pairings/${pairing.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: primaryUser.id } });
    await prisma.user.delete({ where: { id: secondaryUser.id } });
  });
});

describe('GET /api/pairings/:pairingId/daily-summary', () => {
  it('should return daily summary for today', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailySummary.create({
      data: {
        pairingId: pairing.id,
        date: today,
        moodLabel: '开心',
        duration: 45,
        topicCount: 3,
        highlights: ['聊了大儿子下周回家', '说腰今天好多了'],
        concerns: null,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/daily-summary`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.mood).toBe('开心');
    expect(body.data.duration).toBe(45);
    expect(body.data.topics).toBe(3);
    expect(body.data.highlights).toEqual(['聊了大儿子下周回家', '说腰今天好多了']);

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return null when no summary exists', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/daily-summary`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('POST /api/pairings/:pairingId/feeds', () => {
  it('should create a text feed', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

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

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should reject empty content for text feed', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

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

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('GET /api/pairings/:pairingId/feeds', () => {
  it('should return feeds in descending order', async () => {
    const { user, pairing } = await createPairingAndUser();
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    await prisma.feedMessage.create({
      data: {
        pairingId: pairing.id,
        type: 'TEXT',
        content: '第一条',
      },
    });

    await prisma.feedMessage.create({
      data: {
        pairingId: pairing.id,
        type: 'TEXT',
        content: '第二条',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pairings/${pairing.id}/feeds`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].content).toBe('第二条');
    expect(body.data[1].content).toBe('第一条');

    await prisma.pairing.delete({ where: { id: pairing.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
