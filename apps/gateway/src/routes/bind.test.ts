import { describe, it, expect } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('POST /api/family/bind', () => {
  it('should bind elder with valid invite code', async () => {
    // First create a family
    const token = app.jwt.sign({ phone: '13800138001', role: 'CHILD' }, { expiresIn: '7d' });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/family',
      payload: { elderName: '刘奶奶' },
      headers: { authorization: `Bearer ${token}` },
    });
    const family = JSON.parse(createResponse.body);

    // Then bind with invite code
    const response = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: {
        inviteCode: family.inviteCode,
        deviceId: 'device-123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('ELDER');

    // Verify elder profile updated with deviceId
    const elder = await prisma.elderProfile.findUnique({
      where: { familyId: family.id },
    });
    expect(elder?.deviceId).toBe('device-123');

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should return error for invalid invite code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: {
        inviteCode: '000000',
        deviceId: 'device-123',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });

  it('should return error for expired invite code', async () => {
    const uniqueCode = `999${Date.now()}`.slice(-6);
    // Create a family with expired code
    const family = await prisma.family.create({
      data: {
        inviteCode: uniqueCode,
        inviteCodeExpiresAt: new Date(Date.now() - 1000),
        elder: {
          create: { name: '测试' },
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/family/bind',
      payload: {
        inviteCode: uniqueCode,
        deviceId: 'device-123',
      },
    });

    expect(response.statusCode).toBe(410);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
  });
});
