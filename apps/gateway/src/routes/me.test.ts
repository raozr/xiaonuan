import { describe, it, expect } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('GET /api/me', () => {
  it('should return child profile with valid child token', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const user = await prisma.user.create({
      data: { phone: uniquePhone, name: '小明', role: 'CHILD' },
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

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return elder profile with valid elder token', async () => {
    const pairing = await prisma.pairing.create({
      data: {
        inviteCode: `elder-${Date.now()}`,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        name: 'Test Pairing',
        participants: {
          create: [
            { name: '张奶奶', role: 'ELDER', isAI: false, deviceId: 'device-abc' },
            { name: '小暖', role: 'ELDER', isAI: true },
          ],
        },
      },
      include: { participants: true },
    });

    const elderParticipant = pairing.participants.find(p => p.role === 'ELDER' && !p.isAI);

    const elderToken = app.jwt.sign(
      { pairingId: pairing.id, role: 'ELDER', deviceId: 'device-abc' },
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

    await prisma.pairing.delete({ where: { id: pairing.id } });
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
