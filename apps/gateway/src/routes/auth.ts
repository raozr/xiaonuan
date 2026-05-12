import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { getSessionByCode } from '../utils/wechat.js';
import { generateInviteCode } from '../utils/invite-code.js';
import { env } from '../config/env.js';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/);

const registerSchema = z.object({
  code: z.string().min(1),
  role: z.enum(['CHILD', 'ELDER']),
  name: z.string().min(1),
  phone: z.string().optional(),
  inviteCode: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.get('/debug-appid', async (_request, reply) => {
    return reply.send({
      appid: env.WECHAT_APPID,
      secretPrefix: env.WECHAT_SECRET ? env.WECHAT_SECRET.slice(0, 4) + '****' : 'empty',
    });
  });

  app.post('/wechat-code', async (request, reply) => {
    const body = request.body as { code?: string };
    if (!body.code) {
      return reply.status(400).send({ success: false, message: 'code 必填' });
    }

    request.log.info({ code: body.code, appid: env.WECHAT_APPID }, '收到 wechat-code 请求');

    try {
      const result = await getSessionByCode(body.code);
      return reply.send({ success: true, openid: result.openid, sessionKey: result.session_key });
    } catch (err) {
      const message = err instanceof Error ? err.message : '微信登录失败';
      request.log.error({ code: body.code, appid: env.WECHAT_APPID, err: message }, '微信 jscode2session 失败');
      return reply.status(500).send({ success: false, message });
    }
  });

  app.post('/silent-login', async (request, reply) => {
    const body = request.body as { code?: string };
    if (!body.code) {
      return reply.status(400).send({ success: false, message: 'code 必填' });
    }

    try {
      const result = await getSessionByCode(body.code);
      const openid = result.openid;

      // Try user first (for children)
      const user = await prisma.user.findUnique({
        where: { openid },
        include: { childProfiles: true },
      });

      if (user && user.role === 'CHILD') {
        const token = app.jwt.sign(
          { userId: user.id, role: 'CHILD' },
          { expiresIn: '7d' }
        );
        return reply.send({ success: true, token, role: 'CHILD', expiresIn: 604800 });
      }

      // Try elder profile (legacy)
      const elderProfile = await prisma.elderProfile.findFirst({
        where: { openid },
      });
      if (elderProfile) {
        const token = app.jwt.sign(
          { familyId: elderProfile.familyId, role: 'ELDER', deviceId: elderProfile.deviceId },
          { expiresIn: '365d' }
        );
        return reply.send({ success: true, token, role: 'ELDER', expiresIn: 31536000 });
      }

      // Unknown openid — new user
      return reply.send({ success: false, needRegister: true, openid });
    } catch (err) {
      const message = err instanceof Error ? err.message : '微信登录失败';
      return reply.status(500).send({ success: false, message });
    }
  });

  app.post('/register', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    const { code, role, name, phone, inviteCode } = parsed.data;

    try {
      const result = await getSessionByCode(code);
      const openid = result.openid;

      // Check if openid already exists
      const existingUser = await prisma.user.findUnique({ where: { openid } });
      const existingElder = await prisma.elderProfile.findFirst({ where: { openid } });
      if (existingUser || existingElder) {
        return reply.status(409).send({ success: false, message: '该微信账号已注册' });
      }

      if (role === 'CHILD') {
        if (!phone || !phoneSchema.safeParse(phone).success) {
          return reply.status(400).send({ success: false, message: '手机号格式错误' });
        }

        // Check if phone already exists
        const existingPhone = await prisma.user.findUnique({ where: { phone } });
        if (existingPhone) {
          return reply.status(409).send({ success: false, message: '该手机号已被使用' });
        }

        // Create User
        const user = await prisma.user.create({
          data: {
            openid,
            phone,
            name,
            role: 'CHILD',
          },
        });

        const token = app.jwt.sign(
          { userId: user.id, role: 'CHILD' },
          { expiresIn: '7d' }
        );

        return reply.send({ success: true, token, role: 'CHILD' });
      }

      if (role === 'ELDER') {
        if (!inviteCode) {
          return reply.status(400).send({ success: false, message: '老人注册需要邀请码' });
        }

        const family = await prisma.family.findUnique({
          where: { inviteCode },
          include: { elder: true },
        });

        if (!family) {
          return reply.status(404).send({ success: false, message: '邀请码无效' });
        }

        if (family.inviteCodeExpiresAt && family.inviteCodeExpiresAt < new Date()) {
          return reply.status(410).send({ success: false, message: '邀请码已过期' });
        }

        await prisma.elderProfile.update({
          where: { familyId: family.id },
          data: { name, openid },
        });

        const token = app.jwt.sign(
          { familyId: family.id, role: 'ELDER' },
          { expiresIn: '365d' }
        );

        return reply.send({ success: true, token, role: 'ELDER', familyId: family.id });
      }

      return reply.status(400).send({ success: false, message: '无效的角色' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      return reply.status(500).send({ success: false, message });
    }
  });
}
