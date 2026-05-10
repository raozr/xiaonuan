import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { generateInviteCode } from '../utils/invite-code.js';

const createFamilySchema = z.object({
  elderName: z.string().min(1),
  elderAge: z.number().min(50).max(120).optional(),
  elderDialect: z.string().optional(),
});

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, message: '未提供认证令牌' });
  }
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ success: false, message: '无效的认证令牌' });
  }
}

export async function familyRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user as { role: string; phone?: string; familyId?: string } | undefined;
    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role === 'CHILD' && user.phone) {
      const childProfile = await prisma.childProfile.findUnique({
        where: { phone: user.phone },
        include: { family: { include: { elder: true } } },
      });
      if (!childProfile || !childProfile.family) {
        return reply.status(404).send({ success: false, message: '家庭不存在' });
      }
      return reply.send(childProfile.family);
    }

    if (user.role === 'ELDER' && user.familyId) {
      const family = await prisma.family.findUnique({
        where: { id: user.familyId },
        include: { elder: true },
      });
      if (!family) {
        return reply.status(404).send({ success: false, message: '家庭不存在' });
      }
      return reply.send(family);
    }

    return reply.status(400).send({ success: false, message: '无效的用户角色' });
  });

  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = createFamilySchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { elderName, elderAge, elderDialect } = parsed.data;

    const family = await prisma.family.create({
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: elderName,
            age: elderAge,
            dialect: elderDialect,
          },
        },
      },
      include: {
        elder: true,
      },
    });

    return reply.status(201).send({
      id: family.id,
      inviteCode: family.inviteCode,
      inviteCodeExpiresAt: family.inviteCodeExpiresAt,
      elder: family.elder,
    });
  });

  app.post('/invite-code', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { familyId?: string };

    if (!body.familyId) {
      return reply.status(400).send({ success: false, message: 'familyId 必填' });
    }

    const family = await prisma.family.update({
      where: { id: body.familyId },
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({
      inviteCode: family.inviteCode,
      inviteCodeExpiresAt: family.inviteCodeExpiresAt,
    });
  });

  app.post('/bind', async (request, reply) => {
    const body = request.body as { inviteCode?: string; deviceId?: string; openid?: string };

    if (!body.inviteCode || !body.deviceId) {
      return reply.status(400).send({ success: false, message: '邀请码和设备标识必填' });
    }

    const family = await prisma.family.findUnique({
      where: { inviteCode: body.inviteCode },
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
      data: {
        deviceId: body.deviceId,
        ...(body.openid ? { openid: body.openid } : {}),
      },
    });

    const token = app.jwt.sign(
      { familyId: family.id, role: 'ELDER', deviceId: body.deviceId },
      { expiresIn: '365d' }
    );

    return reply.send({
      success: true,
      token,
      role: 'ELDER',
      familyId: family.id,
    });
  });
}
