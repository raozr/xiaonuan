import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@xiaonuan/prisma';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/);

const registerSchema = z.object({
  name: z.string().min(1).max(20),
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  password: z.string().min(6).max(32),
});

const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  password: z.string().min(1),
});

export async function pcAuthRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { name, phone, password } = parsed.data;

    try {
      const existingUser = await prisma.user.findUnique({ where: { phone } });
      if (existingUser) {
        return reply.status(409).send({ success: false, message: '该手机号已被注册' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name,
          phone,
          password: hashedPassword,
          role: 'CHILD',
        },
      });

      const token = app.jwt.sign(
        { userId: user.id, role: 'CHILD' },
        { expiresIn: '7d' }
      );

      return reply.send({ success: true, token, role: 'CHILD', expiresIn: 604800 });
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      request.log.error({ err: message }, 'PC注册失败');
      return reply.status(500).send({ success: false, message });
    }
  });

  app.post('/login', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { phone, password } = parsed.data;

    try {
      const user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user || !user.password) {
        return reply.status(401).send({ success: false, message: '手机号或密码错误' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return reply.status(401).send({ success: false, message: '手机号或密码错误' });
      }

      const token = app.jwt.sign(
        { userId: user.id, role: 'CHILD' },
        { expiresIn: '7d' }
      );

      return reply.send({ success: true, token, role: 'CHILD', expiresIn: 604800 });
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      request.log.error({ err: message }, 'PC登录失败');
      return reply.status(500).send({ success: false, message });
    }
  });
}
