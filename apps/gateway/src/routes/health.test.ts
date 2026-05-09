import { describe, it, expect } from 'vitest';
import { app } from '../server.js';

describe('GET /health', () => {
  it('should return ok status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('xiaonuan-gateway');
  });
});
