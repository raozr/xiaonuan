import { describe, it, expect } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('GET /api/me', () => {
  it('should return child profile with valid child token', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const user = await prisma.user.create({
      data: { phone: uniquePhone, name: '小明', role: 'CHILD' },
    });

    const family = await prisma.family.create({
      data: {
        inviteCode: `child-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '测试老人' } },
        children: {
          create: {
            userId: user.id,
            name: '小明',
            phone: uniquePhone,
          },
        },
      },
      include: { children: true },
    });

    const childToken = app.jwt.sign(
      { userId: user.id, role: 'CHILD' },
      { expiresIn: '7d' }
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${childToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.role).toBe('CHILD');
    expect(body.name).toBe('小明');

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return elder profile with valid elder token', async () => {
    const family = await prisma.family.create({
      data: {
        inviteCode: `elder-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: '张奶奶',
            deviceId: 'device-abc',
          },
        },
      },
      include: { elder: true },
    });

    const elderToken = app.jwt.sign(
      { familyId: family.id, role: 'ELDER', deviceId: 'device-abc' },
      { expiresIn: '365d' }
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${elderToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.role).toBe('ELDER');
    expect(body.name).toBe('张奶奶');

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('PUT /api/me', () => {
  it('should update child profile fields', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const user = await prisma.user.create({
      data: { phone: uniquePhone, name: '小明', role: 'CHILD' },
    });

    const family = await prisma.family.create({
      data: {
        inviteCode: `put-me-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '测试老人' } },
        children: {
          create: {
            userId: user.id,
            name: '小明',
            phone: uniquePhone,
          },
        },
      },
      include: { children: true },
    });

    const childToken = app.jwt.sign(
      { userId: user.id, role: 'CHILD' },
      { expiresIn: '7d' }
    );

    const response = await app.inject({
      method: 'PUT',
      url: '/api/me',
      headers: { authorization: `Bearer ${childToken}` },
      payload: {
        name: '大明',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.name).toBe('大明');

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return 401 without token', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/me',
      payload: { name: 'test' },
    });

    expect(response.statusCode).toBe(401);
  });
});
