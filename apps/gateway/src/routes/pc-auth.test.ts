import { describe, it, expect } from 'vitest';
import { app } from '../server.js';
import { prisma } from '@xiaonuan/prisma';

const uniquePhone = () => `138${Date.now().toString().slice(-8)}`;

describe('POST /api/pc-auth/register', () => {
  it('should register a new child user with phone and password', async () => {
    const phone = uniquePhone();
    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/register',
      payload: {
        name: '测试家长',
        phone,
        password: '123456',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('CHILD');

    const dbUser = await prisma.user.findUnique({ where: { phone } });
    expect(dbUser).toBeDefined();
    expect(dbUser!.name).toBe('测试家长');
    expect(dbUser!.password).toBeDefined();
    expect(dbUser!.openid).toBeNull();

    await prisma.user.delete({ where: { id: dbUser!.id } });
  });

  it('should return 409 for duplicate phone', async () => {
    const phone = uniquePhone();
    await prisma.user.create({
      data: { name: '已有用户', phone, password: 'hashed', role: 'CHILD' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/register',
      payload: {
        name: '新用户',
        phone,
        password: '123456',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('该手机号已被注册');

    await prisma.user.delete({ where: { phone } });
  });

  it('should return 400 for invalid params', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/register',
      payload: { name: '', phone: 'invalid', password: '123' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
  });
});

describe('POST /api/pc-auth/login', () => {
  it('should login with valid phone and password', async () => {
    const phone = uniquePhone();
    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/register',
      payload: {
        name: '登录测试',
        phone,
        password: 'mypassword',
      },
    });

    expect(response.statusCode).toBe(200);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/login',
      payload: { phone, password: 'mypassword' },
    });

    expect(loginResponse.statusCode).toBe(200);
    const body = JSON.parse(loginResponse.body);
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('CHILD');

    await prisma.user.delete({ where: { phone } });
  });

  it('should return 401 for non-existent phone', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/login',
      payload: { phone: uniquePhone(), password: 'anypassword' },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('手机号或密码错误');
  });

  it('should return 401 for wrong password', async () => {
    const phone = uniquePhone();
    await app.inject({
      method: 'POST',
      url: '/api/pc-auth/register',
      payload: { name: '密码测试', phone, password: 'correct' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/login',
      payload: { phone, password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('手机号或密码错误');

    await prisma.user.delete({ where: { phone } });
  });

  it('should return 400 for invalid params', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pc-auth/login',
      payload: { phone: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
  });
});
