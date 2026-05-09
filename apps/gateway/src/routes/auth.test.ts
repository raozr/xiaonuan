import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server.js';

describe('POST /api/auth/verify-code', () => {
  it('should return success for valid phone number', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { phone: '13800138000' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('验证码已发送');
  });

  it('should return error for invalid phone number', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { phone: '123' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('should return JWT token for valid code', async () => {
    // First request a code
    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { phone: '13800138000' },
    });
    const verifyBody = JSON.parse(verifyResponse.body);
    const code = verifyBody.code;

    // Then login with the code
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { phone: '13800138000', code },
    });

    expect(loginResponse.statusCode).toBe(200);
    const body = JSON.parse(loginResponse.body);
    expect(body.token).toBeDefined();
    expect(body.expiresIn).toBe(604800); // 7 days in seconds
  });

  it('should return error for invalid code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { phone: '13800138000', code: '000000' },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});
