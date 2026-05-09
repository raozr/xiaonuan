import { describe, it, expect } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('GET /api/me', () => {
  it('should return child profile with valid child token', async () => {
    // Create a family
    const family = await prisma.family.create({
      data: {
        inviteCode: `child-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '测试老人' } },
        children: {
          create: {
            userId: `user-child-${Date.now()}`,
            name: '小明',
            phone: `13800${Date.now()}`.slice(-5),
          },
        },
      },
      include: { children: true },
    });

    const childToken = app.jwt.sign(
      { phone: '13800138001', role: 'CHILD' },
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

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
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

    // Cleanup
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
