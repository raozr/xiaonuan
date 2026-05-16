import { describe, it, expect, vi } from 'vitest';
import { app } from '../server.js';
import * as wechat from '../utils/wechat.js';
import { prisma } from '@xiaonuan/prisma';

function generateInviteCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

describe('POST /api/auth/wechat-code', () => {
  it('should return openid and sessionKey for valid code', async () => {
    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: 'test_openid_123',
      session_key: 'test_session_key_456',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/wechat-code',
      payload: { code: 'valid_wechat_code' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.openid).toBe('test_openid_123');
    expect(body.sessionKey).toBe('test_session_key_456');
  });

  it('should return error when code is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/wechat-code',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('code 必填');
  });

  it('should return error when wechat api fails', async () => {
    vi.spyOn(wechat, 'getSessionByCode').mockRejectedValueOnce(new Error('invalid code'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/wechat-code',
      payload: { code: 'invalid_code' },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('微信登录失败，请稍后再试');
  });
});

describe('POST /api/auth/register', () => {
  it('should create family and child profile for new child user', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid = `reg_child_${Date.now()}`;
    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: uniqueOpenid,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        code: 'valid_code',
        role: 'CHILD',
        name: '小明家长',
        phone: uniquePhone,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('CHILD');

    const dbUser = await prisma.user.findUnique({
      where: { openid: uniqueOpenid },
      include: { childProfiles: true },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser!.phone).toBe(uniquePhone);
    expect(dbUser!.name).toBe('小明家长');
    expect(dbUser!.childProfiles.length).toBe(0);

    await prisma.user.delete({ where: { id: dbUser!.id } });
  });

  it('should bind elder to existing family', async () => {
    const uniqueOpenid = `reg_elder_${Date.now()}`;
    const inviteCode = generateInviteCode();

    const family = await prisma.family.create({
      data: {
        inviteCode,
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '占位老人' } },
      },
    });

    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: uniqueOpenid,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        code: 'valid_code',
        role: 'ELDER',
        name: '张爷爷',
        phone: '13800138000',
        inviteCode,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('ELDER');

    const elder = await prisma.elderProfile.findUnique({
      where: { familyId: family.id },
    });
    expect(elder).toBeDefined();
    expect(elder!.name).toBe('张爷爷');
    expect(elder!.openid).toBe(uniqueOpenid);

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should return 409 for duplicate openid', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid = `dup_openid_${Date.now()}`;

    const family = await prisma.family.create({
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '老人' } },
      },
    });

    const existingUser = await prisma.user.create({
      data: {
        phone: uniquePhone,
        openid: uniqueOpenid,
        role: 'CHILD',
      },
    });

    await prisma.childProfile.create({
      data: {
        userId: existingUser.id,
        name: '家长',
        phone: uniquePhone,
        openid: uniqueOpenid,
        familyId: family.id,
      },
    });

    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: uniqueOpenid,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        code: 'valid_code',
        role: 'CHILD',
        name: '另一名家长',
        phone: `139${Date.now().toString().slice(-8)}`,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  });

  it('should return 409 for duplicate phone', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid1 = `phone_dup_1_${Date.now()}`;
    const uniqueOpenid2 = `phone_dup_2_${Date.now()}`;

    const family = await prisma.family.create({
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '老人' } },
      },
    });

    const existingUser = await prisma.user.create({
      data: {
        phone: uniquePhone,
        openid: uniqueOpenid1,
        role: 'CHILD',
      },
    });

    await prisma.childProfile.create({
      data: {
        userId: existingUser.id,
        name: '家长A',
        phone: uniquePhone,
        openid: uniqueOpenid1,
        familyId: family.id,
      },
    });

    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: uniqueOpenid2,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        code: 'valid_code',
        role: 'CHILD',
        name: '家长B',
        phone: uniquePhone,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  });

  it('should return 404 for invalid invite code', async () => {
    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: `elder_${Date.now()}`,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        code: 'valid_code',
        role: 'ELDER',
        name: '张爷爷',
        phone: '13800138000',
        inviteCode: '00000000',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });

  it('should return 400 for missing params', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { code: 'test' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('参数错误');
  });
});

describe('POST /api/auth/silent-login', () => {
  it('should return token for existing child profile', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid = `silent_child_${Date.now()}`;

    const family = await prisma.family.create({
      data: {
        inviteCode: Math.floor(10000000 + Math.random() * 90000000).toString(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '李爷爷' } },
      },
    });

    const user = await prisma.user.create({
      data: {
        phone: uniquePhone,
        openid: uniqueOpenid,
        role: 'CHILD',
      },
    });

    await prisma.childProfile.create({
      data: {
        userId: user.id,
        name: '小李',
        phone: uniquePhone,
        openid: uniqueOpenid,
        familyId: family.id,
      },
    });

    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: uniqueOpenid,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/silent-login',
      payload: { code: 'valid_code' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('CHILD');

    await prisma.family.delete({ where: { id: family.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should return token for existing elder profile', async () => {
    const uniqueOpenid = `silent_elder_${Date.now()}`;

    const family = await prisma.family.create({
      data: {
        inviteCode: Math.floor(10000000 + Math.random() * 90000000).toString(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '王奶奶', openid: uniqueOpenid } },
      },
    });

    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: uniqueOpenid,
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/silent-login',
      payload: { code: 'valid_code' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('ELDER');

    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should return needRegister and openid for unknown openid', async () => {
    vi.spyOn(wechat, 'getSessionByCode').mockResolvedValueOnce({
      openid: 'unknown_openid',
      session_key: 'test_session_key',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/silent-login',
      payload: { code: 'valid_code' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.needRegister).toBe(true);
    expect(body.openid).toBe('unknown_openid');
  });

  it('should return error when wechat api fails', async () => {
    vi.spyOn(wechat, 'getSessionByCode').mockRejectedValueOnce(new Error('invalid code'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/silent-login',
      payload: { code: 'invalid_code' },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('微信登录失败，请稍后再试');
  });
});
