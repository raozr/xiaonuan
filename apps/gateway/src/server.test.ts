import { describe, it, expect } from 'vitest';
import { app } from './server.js';

describe('Global error handler', () => {
  it('should return safe message on unhandled errors', async () => {
    app.get('/__test_error__', async () => {
      throw new Error('sensitive internal details');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/__test_error__',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe('服务器繁忙，请稍后再试');
    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('sensitive internal details');
  });
});
