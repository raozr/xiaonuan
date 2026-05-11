import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('GET /api/family', () => {
  it('should return family for authenticated child', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `get-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '李爷爷' } },
        children: {
          create: {
            userId: `child-get-${Date.now()}`,
            name: '小李',
            phone: `13900${Date.now()}`.slice(-5),
          },
        },
      },
      include: { children: true },
    });

    const childPhone = family.children[0]!.phone;
    const token = app.jwt.sign({ phone: childPhone, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/family',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(family.id);
    expect(body.elder.name).toBe('李爷爷');

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/family',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/family', () => {
  it('should create a family with elder info', async () => {
    const token = app.jwt.sign({ phone: '13800138001', role: 'CHILD' }, { expiresIn: '7d' });

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
    const token = app.jwt.sign({ phone: '13800138001', role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/family',
      payload: {
        elderAge: 78,
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});

describe('POST /api/family/invite-code', () => {
  it('should regenerate invite code for existing family', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/family',
      payload: {
        elderName: '赵奶奶',
      },
      headers: { authorization: `Bearer ${app.jwt.sign({ phone: '13800138001', role: 'CHILD' }, { expiresIn: '7d' })}` },
    });
    const family = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: '/api/family/invite-code',
      payload: { familyId: family.id },
      headers: { authorization: `Bearer ${app.jwt.sign({ phone: '13800138001', role: 'CHILD' }, { expiresIn: '7d' })}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.inviteCode).toMatch(/^\d{6}$/);
    expect(body.inviteCode).not.toBe(family.inviteCode);

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should require auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/family/invite-code',
      payload: { familyId: 'some-id' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('PUT /api/family/elder', () => {
  it('should update elder profile', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `put-elder-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '测试老人' } },
        children: {
          create: {
            userId: `user-put-elder-${Date.now()}`,
            name: '小李',
            phone: `13900${Date.now()}`.slice(-5),
          },
        },
      },
      include: { children: true },
    });

    const childPhone = family.children[0]!.phone;
    const token = app.jwt.sign({ phone: childPhone, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/family/elder',
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
  });

  it('should only update elder in the same family', async () => {
    const familyA = await prisma.family.create({
      data: {
        inviteCode: `fa-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '老人A' } },
        children: {
          create: {
            userId: `ua-${Date.now()}`,
            name: '子女A',
            phone: `13900${Date.now()}`.slice(-5),
          },
        },
      },
      include: { children: true },
    });

    const familyB = await prisma.family.create({
      data: {
        inviteCode: `fb-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '老人B' } },
        children: {
          create: {
            userId: `ub-${Date.now()}`,
            name: '子女B',
            phone: `13901${Date.now()}`.slice(-5),
          },
        },
      },
      include: { children: true },
    });

    const tokenA = app.jwt.sign({ phone: familyA.children[0]!.phone, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/family/elder',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: '改名A',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.elder.name).toBe('改名A');

    // Verify elderB was not affected
    const elderB = await prisma.elderProfile.findUnique({
      where: { familyId: familyB.id },
    });
    expect(elderB!.name).toBe('老人B');

    await prisma.family.delete({ where: { id: familyA.id } });
    await prisma.family.delete({ where: { id: familyB.id } });
  });
});

describe('GET /api/family/settings', () => {
  it('should return complete family settings', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `settings-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: '张爷爷',
            age: 80,
            hobbies: '下棋',
          },
        },
        children: {
          create: [
            {
              userId: `c1-${Date.now()}`,
              name: '大儿子',
              phone: `13900${Date.now()}`.slice(-5),
              relationshipToElder: '儿子',
            },
          ],
        },
      },
      include: { children: true },
    });

    const childPhone = family.children[0]!.phone;
    const token = app.jwt.sign({ phone: childPhone, role: 'CHILD' }, { expiresIn: '7d' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/family/settings',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.elder.name).toBe('张爷爷');
    expect(body.elder.age).toBe(80);
    expect(body.elder.hobbies).toBe('下棋');
    expect(body.children).toHaveLength(1);
    expect(body.children[0].name).toBe('大儿子');
    expect(body.children[0].relationshipToElder).toBe('儿子');

    await prisma.family.delete({ where: { id: family.id } });
  });
});
