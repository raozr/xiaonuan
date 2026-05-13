import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

async function createUserAndFamily(elderName: string, overrides?: { inviteCode?: string; deviceId?: string }) {
  const user = await prisma.user.create({
    data: {
      phone: `13900${Date.now()}${Math.floor(Math.random() * 1000)}`,
      role: 'CHILD',
    },
  });

  const family = await prisma.family.create({
    data: {
      inviteCode: overrides?.inviteCode ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      elder: {
        create: {
          name: elderName,
          deviceId: overrides?.deviceId ?? null,
        },
      },
      children: {
        create: {
          userId: user.id,
          name: user.phone,
          phone: user.phone,
          isPrimary: true,
        },
      },
    },
    include: { elder: true, children: true },
  });

  return { user, family };
}

describe('GET /api/family', () => {
  it('should return array of families for authenticated child', async () => {
    const { user, family } = await createUserAndFamily('李爷爷');

    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/family',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    const found = body.find((f: any) => f.id === family.id);
    expect(found).toBeDefined();
    expect(found.elder.name).toBe('李爷爷');
    expect(typeof found.isOnline).toBe('boolean');

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/family',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/family/:familyId', () => {
  it('should return family detail for member', async () => {
    const { user, family } = await createUserAndFamily('张奶奶');
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/family/${family.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(family.id);
    expect(body.elder.name).toBe('张奶奶');

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return 403 for non-member', async () => {
    const { family } = await createUserAndFamily('王爷爷');
    const outsider = await prisma.user.create({
      data: { phone: `13999${Date.now()}`, role: 'CHILD' },
    });
    const token = app.jwt.sign({ userId: outsider.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/family/${family.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: outsider.id } });
  });
});

describe('POST /api/family', () => {
  it('should create a family with elder info and 6-digit invite code', async () => {
    const user = await prisma.user.create({
      data: { phone: `13800${Date.now()}`, role: 'CHILD' },
    });
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/family',
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
    expect(body.elder.name).toBe('王爷爷');

    await prisma.family.delete({ where: { id: body.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should require auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/family',
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
      url: '/api/family',
      payload: { elderAge: 78 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);

    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('POST /api/family/:familyId/refresh-code', () => {
  it('should regenerate 6-digit invite code for existing family', async () => {
    const { user, family } = await createUserAndFamily('赵奶奶');
    const oldCode = family.inviteCode;
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/family/${family.id}/refresh-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.inviteCode).toMatch(/^\d{6}$/);
    expect(body.inviteCode).not.toBe(oldCode);

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should require auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/family/some-id/refresh-code',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('PUT /api/family/:familyId/elder', () => {
  it('should update elder profile', async () => {
    const { user, family } = await createUserAndFamily('测试老人');
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/family/${family.id}/elder`,
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
    expect(body.elder.age).toBe(78);
    expect(body.elder.hobbies).toBe('养花、听京剧');

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should only update elder in the same family', async () => {
    const { user, family: familyA } = await createUserAndFamily('老人A');
    const { family: familyB } = await createUserAndFamily('老人B');

    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/family/${familyA.id}/elder`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '改名A' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.elder.name).toBe('改名A');

    const elderB = await prisma.elderProfile.findUnique({
      where: { familyId: familyB.id },
    });
    expect(elderB!.name).toBe('老人B');

    await prisma.family.delete({ where: { id: familyA.id } });
    await prisma.family.delete({ where: { id: familyB.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('POST /api/family/bind', () => {
  it('should bind device and return JWT', async () => {
    const { family } = await createUserAndFamily('绑定老人');

    const response = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: { inviteCode: family.inviteCode, deviceId: 'device-a' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('ELDER');

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should reject second device with same invite code', async () => {
    const { family } = await createUserAndFamily('已绑定老人');

    const first = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: { inviteCode: family.inviteCode, deviceId: 'device-a' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: { inviteCode: family.inviteCode, deviceId: 'device-b' },
    });
    expect(second.statusCode).toBe(409);
    const body = JSON.parse(second.body);
    expect(body.message).toContain('已被绑定');

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should reject expired invite code', async () => {
    const { family } = await createUserAndFamily('过期老人', { inviteCode: `exp-${Date.now()}` });
    await prisma.family.update({
      where: { id: family.id },
      data: { inviteCodeExpiresAt: new Date(Date.now() - 1000) },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: { inviteCode: family.inviteCode, deviceId: 'device-x' },
    });

    expect(response.statusCode).toBe(410);

    await prisma.family.delete({ where: { id: family.id } });
  });
});

describe('DELETE /api/family/:familyId/bind', () => {
  it('should unbind elder device for primary child', async () => {
    const { user, family } = await createUserAndFamily('解绑老人', { deviceId: 'device-u' });
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/family/${family.id}/bind`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const elder = await prisma.elderProfile.findUnique({ where: { familyId: family.id } });
    expect(elder!.deviceId).toBeNull();

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('DELETE /api/family/:familyId', () => {
  it('should delete family for primary child', async () => {
    const { user, family } = await createUserAndFamily('删除家庭');
    const token = app.jwt.sign({ userId: user.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/family/${family.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const gone = await prisma.family.findUnique({ where: { id: family.id } });
    expect(gone).toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should reject delete by non-primary child', async () => {
    const { user: primaryUser, family } = await createUserAndFamily('主要子女');
    const secondaryUser = await prisma.user.create({
      data: { phone: `13988${Date.now()}`, role: 'CHILD' },
    });
    await prisma.childProfile.create({
      data: {
        userId: secondaryUser.id,
        familyId: family.id,
        name: secondaryUser.phone,
        phone: secondaryUser.phone,
        isPrimary: false,
      },
    });

    const token = app.jwt.sign({ userId: secondaryUser.id, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/family/${family.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: primaryUser.id } });
    await prisma.user.delete({ where: { id: secondaryUser.id } });
  });
});
