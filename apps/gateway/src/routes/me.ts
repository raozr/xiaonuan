import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@xiaonuan/prisma';

type UserPayload = {
  userId?: string;
  role: string;
  phone?: string;
  familyId?: string;
  deviceId?: string;
};

export async function meRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload | undefined;

    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role === 'CHILD' && user.userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        include: { childProfiles: true },
      });

      if (!dbUser) {
        return reply.status(404).send({ success: false, message: '用户不存在' });
      }

      return reply.send({
        role: 'CHILD',
        name: dbUser.name,
        phone: dbUser.phone,
        familyCount: dbUser.childProfiles.length,
      });
    }

    if (user.role === 'ELDER' && user.familyId) {
      const elderProfile = await prisma.elderProfile.findUnique({
        where: { familyId: user.familyId },
      });

      if (!elderProfile) {
        return reply.status(404).send({ success: false, message: '老人信息不存在' });
      }

      return reply.send({
        role: 'ELDER',
        name: elderProfile.name,
        familyId: user.familyId,
      });
    }

    return reply.status(400).send({ success: false, message: '无效的用户角色' });
  });

  app.put('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload | undefined;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证或非子女用户' });
    }

    const body = request.body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};

    if (typeof body.name === 'string') updateData.name = body.name;

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
    });

    return reply.send({
      success: true,
      name: updated.name,
    });
  });
}
