import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { getSessionByCode } from '../utils/wechat.js';
import { generateInviteCode } from '../utils/invite-code.js';
import { env } from '../config/env.js';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/);

const registerSchema = z.object({
  code: z.string().min(1),
  role: z.enum(['STEWARD', 'COMPANIONEE']),
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
      request.log.error({ code: body.code, appid: env.WECHAT_APPID, err }, '微信 jscode2session 失败');
      return reply.status(500).send({ success: false, message: '微信登录失败，请稍后再试' });
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

      // Try user first (for stewards)
      const user = await prisma.user.findUnique({
        where: { openid },
        include: { participants: true },
      });

      if (user && user.role === 'STEWARD') {
        const token = app.jwt.sign(
          { userId: user.id, role: 'STEWARD' },
          { expiresIn: '7d' }
        );
        return reply.send({ success: true, token, role: 'STEWARD', expiresIn: 604800 });
      }

      // Try companionee participant
      const companionee = await prisma.participant.findFirst({
        where: { openid, role: 'COMPANIONEE', isAI: false },
      });
      if (companionee) {
        const token = app.jwt.sign(
          { pairingId: companionee.pairingId, role: 'COMPANIONEE', deviceId: (companionee.metadata as Record<string, string> | null)?.deviceId },
          { expiresIn: '365d' }
        );
        return reply.send({ success: true, token, role: 'COMPANIONEE', expiresIn: 31536000 });
      }

      // Unknown openid — new user
      return reply.send({ success: false, needRegister: true, openid });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: '微信登录失败，请稍后再试' });
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

      // Check if openid already exists in User or Participant
      const existingUser = await prisma.user.findUnique({ where: { openid } });
      const existingCompanionee = await prisma.participant.findFirst({ where: { openid, role: 'COMPANIONEE', isAI: false } });
      if (existingUser || existingCompanionee) {
        return reply.status(409).send({ success: false, message: '该微信账号已注册' });
      }

      if (role === 'STEWARD') {
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
            role: 'STEWARD',
          },
        });

        const token = app.jwt.sign(
          { userId: user.id, role: 'STEWARD' },
          { expiresIn: '7d' }
        );

        return reply.send({ success: true, token, role: 'STEWARD' });
      }

      if (role === 'COMPANIONEE') {
        if (!inviteCode) {
          return reply.status(400).send({ success: false, message: '被陪伴者注册需要邀请码' });
        }

        const pairing = await prisma.pairing.findUnique({
          where: { inviteCode },
        });

        if (!pairing) {
          return reply.status(404).send({ success: false, message: '邀请码无效' });
        }

        if (pairing.inviteCodeExpiresAt && pairing.inviteCodeExpiresAt < new Date()) {
          return reply.status(410).send({ success: false, message: '邀请码已过期' });
        }

        const companionee = await prisma.participant.findFirst({
          where: { pairingId: pairing.id, role: 'COMPANIONEE', isAI: false },
        });
        if (!companionee) {
          return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
        }

        await prisma.participant.update({
          where: { id: companionee.id },
          data: { name, openid },
        });

        const token = app.jwt.sign(
          { pairingId: pairing.id, role: 'COMPANIONEE' },
          { expiresIn: '365d' }
        );

        return reply.send({ success: true, token, role: 'COMPANIONEE', pairingId: pairing.id });
      }

      return reply.status(400).send({ success: false, message: '无效的角色' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: '注册失败，请稍后再试' });
    }
  });
}
