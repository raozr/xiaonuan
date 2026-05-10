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
