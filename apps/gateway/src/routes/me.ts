import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@xiaonuan/prisma';

type UserPayload = {
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

    if (user.role === 'CHILD' && user.phone) {
      const childProfile = await prisma.childProfile.findUnique({
        where: { phone: user.phone },
        include: { family: { include: { elder: true } } },
      });

      if (!childProfile) {
        return reply.status(404).send({ success: false, message: '用户不存在' });
      }

      return reply.send({
        role: 'CHILD',
        name: childProfile.name,
        familyId: childProfile.familyId,
        elderName: childProfile.family.elder?.name,
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
}
