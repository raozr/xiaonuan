import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/);

const codeStore = new Map<string, { code: string; expiresAt: number }>();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/verify-code', async (request, reply) => {
    const body = request.body as { phone?: string };
    const result = phoneSchema.safeParse(body.phone);

    if (!result.success) {
      return reply.status(400).send({ success: false, message: '手机号格式错误' });
    }

    const phone = result.data;
    const code = generateCode();
    codeStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

    // TODO: integrate real SMS service
    return reply.send({ success: true, message: '验证码已发送', code });
  });

  app.post('/login', async (request, reply) => {
    const body = request.body as { phone?: string; code?: string };
    const phoneResult = phoneSchema.safeParse(body.phone);

    if (!phoneResult.success || !body.code) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    const phone = phoneResult.data;
    const stored = codeStore.get(phone);

    if (!stored || stored.code !== body.code || Date.now() > stored.expiresAt) {
      return reply.status(401).send({ success: false, message: '验证码错误或已过期' });
    }

    codeStore.delete(phone);

    const token = app.jwt.sign(
      { phone, role: 'CHILD' },
      { expiresIn: '7d' }
    );

    return reply.send({ success: true, token, expiresIn: 604800 });
  });
}
