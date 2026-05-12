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
  // List all families for a child, or the single family for an elder
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role === 'CHILD' && user.userId) {
      const childProfiles = await prisma.childProfile.findMany({
        where: { userId: user.userId },
        include: { family: { include: { elder: true } } },
      });
      const families = childProfiles.map(cp => cp.family);
      return reply.send(families);
    }

    if (user.role === 'ELDER' && user.familyId) {
      const family = await prisma.family.findUnique({
        where: { id: user.familyId },
        include: { elder: true },
      });
      if (!family) {
        return reply.status(404).send({ success: false, message: '家庭不存在' });
      }
      return reply.send([family]); // Return as array for consistency
    }

    return reply.status(400).send({ success: false, message: '无效的用户角色' });
  });

  // Get a single family detail
  app.get('/:familyId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { familyId } = request.params as { familyId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    // Verify ownership
    const membership = await prisma.childProfile.findUnique({
      where: { userId_familyId: { userId: user.userId, familyId } },
      include: { family: { include: { elder: true, children: true } } }
    });

    if (!membership) {
      return reply.status(403).send({ success: false, message: '无权访问该家庭' });
    }

    return reply.send(membership.family);
  });

  // Create a new family (Child only)
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '仅子女可创建家庭' });
    }

    const body = request.body as Record<string, unknown>;
    const parsed = createFamilySchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { elderName, elderAge, elderDialect } = parsed.data;

    // Get current user info to propagate to the new profile
    const userData = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!userData) {
      return reply.status(404).send({ success: false, message: '用户不存在' });
    }

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
        children: {
          create: {
            userId: user.userId,
            name: userData.phone, // Default name to phone or something sensible
            phone: userData.phone || '',
            openid: userData.openid,
            isPrimary: true,
          }
        }
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

  // Refresh invite code
  app.post('/:familyId/refresh-code', { preHandler: [requireAuth] }, async (request, reply) => {
    const { familyId } = request.params as { familyId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    // Verify ownership
    const membership = await prisma.childProfile.findUnique({
      where: { userId_familyId: { userId: user.userId, familyId } }
    });
    if (!membership) {
      return reply.status(403).send({ success: false, message: '无权访问该家庭' });
    }

    const family = await prisma.family.update({
      where: { id: familyId },
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

  // Update elder profile
  app.put('/:familyId/elder', { preHandler: [requireAuth] }, async (request, reply) => {
    const { familyId } = request.params as { familyId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    // Verify ownership
    const membership = await prisma.childProfile.findUnique({
      where: { userId_familyId: { userId: user.userId, familyId } }
    });
    if (!membership) {
      return reply.status(403).send({ success: false, message: '无权访问该家庭' });
    }

    const body = request.body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};

    if (typeof body.name === 'string') updateData.name = body.name;
    if (typeof body.age === 'number') updateData.age = body.age;
    if (typeof body.dialect === 'string') updateData.dialect = body.dialect;
    if (typeof body.hobbies === 'string') updateData.hobbies = body.hobbies;
    if (typeof body.healthNotes === 'string') updateData.healthNotes = body.healthNotes;
    if (typeof body.topicsToAvoid === 'string') updateData.topicsToAvoid = body.topicsToAvoid;
    if (typeof body.greetingPreference === 'string') updateData.greetingPreference = body.greetingPreference;

    const updated = await prisma.elderProfile.update({
      where: { familyId },
      data: updateData,
    });

    return reply.send({ success: true, elder: updated });
  });

  // Bind elder device
  app.post('/bind', async (request, reply) => {
    const body = request.body as { inviteCode?: string; deviceId?: string };

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

    if (family.elder?.deviceId && family.elder.deviceId !== body.deviceId) {
      return reply.status(409).send({ success: false, message: '该老人已被绑定，请先解绑' });
    }

    await prisma.elderProfile.update({
      where: { familyId: family.id },
      data: {
        deviceId: body.deviceId,
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

  // Unbind elder device
  app.delete('/:familyId/bind', { preHandler: [requireAuth] }, async (request, reply) => {
    const { familyId } = request.params as { familyId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    // Verify ownership
    const membership = await prisma.childProfile.findUnique({
      where: { userId_familyId: { userId: user.userId, familyId } }
    });
    if (!membership) {
      return reply.status(403).send({ success: false, message: '无权访问该家庭' });
    }

    await prisma.elderProfile.update({
      where: { familyId },
      data: { deviceId: null },
    });

    return reply.send({ success: true, message: '解绑成功' });
  });
}
