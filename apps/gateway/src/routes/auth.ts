import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { getSessionByCode, decryptWechatData } from '../utils/wechat.js';
import { generateInviteCode } from '../utils/invite-code.js';
import { env } from '../config/env.js';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/);

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

  app.post('/phone-login', async (request, reply) => {
    const body = request.body as { phone?: string };
    if (!body.phone || !phoneSchema.safeParse(body.phone).success) {
      return reply.status(400).send({ success: false, message: '手机号格式错误' });
    }

    let childProfile = await prisma.childProfile.findUnique({
      where: { phone: body.phone },
    });

    if (!childProfile) {
      const family = await prisma.family.create({
        data: {
          inviteCode: generateInviteCode(),
          inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          elder: { create: { name: '老人' } },
        },
      });

      childProfile = await prisma.childProfile.create({
        data: {
          userId: `phone_${body.phone}`,
          name: '家长',
          phone: body.phone,
          openid: `openid_${body.phone}`,
          isPrimary: true,
          familyId: family.id,
        },
      });
    }

    const token = app.jwt.sign(
      { phone: childProfile.phone, role: 'CHILD', familyId: childProfile.familyId },
      { expiresIn: '7d' }
    );

    return reply.send({ success: true, token, expiresIn: 604800 });
  });

  app.post('/silent-login', async (request, reply) => {
    const body = request.body as { code?: string };
    if (!body.code) {
      return reply.status(400).send({ success: false, message: 'code 必填' });
    }

    try {
      const result = await getSessionByCode(body.code);
      const openid = result.openid;

      // Try child profile first
      const childProfile = await prisma.childProfile.findUnique({
        where: { openid },
      });
      if (childProfile) {
        const token = app.jwt.sign(
          { phone: childProfile.phone, role: 'CHILD', familyId: childProfile.familyId },
          { expiresIn: '7d' }
        );
        return reply.send({ success: true, token, role: 'CHILD', expiresIn: 604800 });
      }

      // Try elder profile
      const elderProfile = await prisma.elderProfile.findUnique({
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
      return reply.send({ success: false, needRegister: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '微信登录失败';
      return reply.status(500).send({ success: false, message });
    }
  });

  app.post('/login', async (request, reply) => {
    const body = request.body as {
      openid?: string;
      sessionKey?: string;
      encryptedData?: string;
      iv?: string;
    };

    if (!body.openid || !body.sessionKey || !body.encryptedData || !body.iv) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    try {
      const phoneData = decryptWechatData(body.sessionKey, body.encryptedData, body.iv);
      const phone = String(phoneData.phoneNumber || phoneData.purePhoneNumber);

      if (!phoneSchema.safeParse(phone).success) {
        return reply.status(400).send({ success: false, message: '手机号格式错误' });
      }

      let childProfile = await prisma.childProfile.findUnique({
        where: { openid: body.openid },
      });

      if (!childProfile) {
        const family = await prisma.family.create({
          data: {
            inviteCode: generateInviteCode(),
            inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            elder: {
              create: {
                name: '老人',
              },
            },
          },
        });

        childProfile = await prisma.childProfile.create({
          data: {
            userId: body.openid,
            name: '家长',
            phone,
            openid: body.openid,
            isPrimary: true,
            familyId: family.id,
          },
        });
      } else {
        if (childProfile.phone !== phone) {
          await prisma.childProfile.update({
            where: { id: childProfile.id },
            data: { phone },
          });
          childProfile = await prisma.childProfile.findUnique({
            where: { id: childProfile.id },
          });
        }
      }

      const token = app.jwt.sign(
        { phone: childProfile!.phone, role: 'CHILD', familyId: childProfile!.familyId },
        { expiresIn: '7d' }
      );

      return reply.send({ success: true, token, expiresIn: 604800 });
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      return reply.status(500).send({ success: false, message });
    }
  });
}
