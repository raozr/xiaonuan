import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

describe('POST /api/family', () => {
  it('should create a family with elder info', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/family',
      payload: {
        elderName: '王爷爷',
        elderAge: 78,
        elderDialect: '上海话',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.inviteCode).toMatch(/^\d{6}$/);
    expect(body.elder.name).toBe('王爷爷');

    // Cleanup
    await prisma.family.delete({ where: { id: body.id } });
  });

  it('should require elder name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/family',
      payload: {
        elderAge: 78,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});

describe('POST /api/family/invite-code', () => {
  it('should regenerate invite code for existing family', async () => {
    // First create a family
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/family',
      payload: {
        elderName: '赵奶奶',
      },
    });
    const family = JSON.parse(createResponse.body);

    // Then regenerate invite code
    const response = await app.inject({
      method: 'POST',
      url: '/api/family/invite-code',
      payload: { familyId: family.id },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.inviteCode).toMatch(/^\d{6}$/);
    expect(body.inviteCode).not.toBe(family.inviteCode);

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
  });
});
