import { describe, it, expect, vi } from 'vitest';
import { app } from '../server.js';
import * as wechat from '../utils/wechat.js';
import { prisma } from '@xiaonuan/prisma';

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
    expect(body.message).toBe('invalid code');
  });
});

describe('POST /api/auth/login', () => {
  it('should create family and child profile for new user', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid = `new_openid_${Date.now()}`;
    vi.spyOn(wechat, 'decryptWechatData').mockReturnValueOnce({
      phoneNumber: uniquePhone,
      purePhoneNumber: uniquePhone,
      countryCode: '86',
      watermark: { appid: process.env.WECHAT_APPID },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        openid: uniqueOpenid,
        sessionKey: 'test_key',
        encryptedData: 'test_data',
        iv: 'test_iv',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();

    const child = await prisma.childProfile.findUnique({
      where: { openid: uniqueOpenid },
      include: { family: { include: { elder: true } } },
    });
    expect(child).toBeDefined();
    expect(child!.phone).toBe(uniquePhone);
    expect(child!.name).toBe('家长');
    expect(child!.isPrimary).toBe(true);
    expect(child!.family).toBeDefined();
    expect(child!.family.elder).toBeDefined();
    expect(child!.family.elder!.name).toBe('老人');

    // Cleanup
    await prisma.family.delete({ where: { id: child!.familyId } });
  });

  it('should not recreate family for existing user', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid = `existing_openid_${Date.now()}`;
    vi.spyOn(wechat, 'decryptWechatData').mockReturnValueOnce({
      phoneNumber: uniquePhone,
      watermark: { appid: process.env.WECHAT_APPID },
    });

    // Pre-create user
    const family = await prisma.family.create({
      data: {
        inviteCode: Math.floor(100000 + Math.random() * 900000).toString(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '李爷爷' } },
      },
    });
    const child = await prisma.childProfile.create({
      data: {
        userId: uniqueOpenid,
        name: '小李',
        phone: uniquePhone,
        openid: uniqueOpenid,
        familyId: family.id,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        openid: uniqueOpenid,
        sessionKey: 'test_key',
        encryptedData: 'test_data',
        iv: 'test_iv',
      },
    });

    expect(response.statusCode).toBe(200);

    const childAfter = await prisma.childProfile.findUnique({
      where: { openid: uniqueOpenid },
    });
    expect(childAfter!.familyId).toBe(family.id);

    // Cleanup
    await prisma.family.delete({ where: { id: family.id } });
  });

  it('should return error for missing params', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { openid: 'test' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('参数错误');
  });

  it('should return error when decryption fails', async () => {
    vi.spyOn(wechat, 'decryptWechatData').mockImplementationOnce(() => {
      throw new Error('解密失败');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        openid: 'test_openid',
        sessionKey: 'test_key',
        encryptedData: 'bad_data',
        iv: 'test_iv',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('解密失败');
  });
});

describe('POST /api/auth/silent-login', () => {
  it('should return token for existing child profile', async () => {
    const uniquePhone = `138${Date.now().toString().slice(-8)}`;
    const uniqueOpenid = `silent_child_${Date.now()}`;

    const family = await prisma.family.create({
      data: {
        inviteCode: Math.floor(100000 + Math.random() * 900000).toString(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: { create: { name: '李爷爷' } },
      },
    });
    await prisma.childProfile.create({
      data: {
        userId: uniqueOpenid,
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
  });

  it('should return token for existing elder profile', async () => {
    const uniqueOpenid = `silent_elder_${Date.now()}`;

    const family = await prisma.family.create({
      data: {
        inviteCode: Math.floor(100000 + Math.random() * 900000).toString(),
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

  it('should return needRegister for unknown openid', async () => {
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
    expect(body.message).toBe('invalid code');
  });
});
