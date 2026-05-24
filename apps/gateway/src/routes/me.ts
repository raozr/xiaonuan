import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@xiaonuan/prisma';
import bcrypt from 'bcryptjs';

type UserPayload = {
  userId?: string;
  role: string;
  phone?: string;
  pairingId?: string;
  deviceId?: string;
};

export async function meRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload | undefined;

    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role === 'STEWARD' && user.userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        include: { participants: true },
      });

      if (!dbUser) {
        return reply.status(404).send({ success: false, message: '用户不存在' });
      }

      return reply.send({
        role: 'STEWARD',
        name: dbUser.name,
        phone: dbUser.phone,
        pairingCount: dbUser.participants.length,
      });
    }

    if (user.role === 'COMPANIONEE' && user.pairingId) {
      const companionee = await prisma.participant.findFirst({
        where: { pairingId: user.pairingId, role: 'COMPANIONEE', isAI: false },
      });

      if (!companionee) {
        return reply.status(404).send({ success: false, message: '被陪伴者信息不存在' });
      }

      return reply.send({
        role: 'COMPANIONEE',
        name: companionee.name,
        pairingId: user.pairingId,
      });
    }

    return reply.status(400).send({ success: false, message: '无效的用户角色' });
  });

  app.put('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload | undefined;

    if (!user || user.role !== 'STEWARD' || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证或非照管者用户' });
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

  // Change password
  app.put('/password', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as UserPayload | undefined;

    if (!user || user.role !== 'STEWARD' || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证或非照管者用户' });
    }

    const body = request.body as Record<string, unknown>;
    const oldPassword = body.oldPassword as string;
    const newPassword = body.newPassword as string;

    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return reply.status(400).send({ success: false, message: '旧密码和新密码不能为空，新密码至少6位' });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { password: true },
    });

    if (!dbUser || !dbUser.password) {
      return reply.status(400).send({ success: false, message: '当前用户未设置密码' });
    }

    const isValid = await bcrypt.compare(oldPassword, dbUser.password);
    if (!isValid) {
      return reply.status(400).send({ success: false, message: '旧密码不正确' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.userId },
      data: { password: hashed },
    });

    return reply.send({ success: true, message: '密码修改成功' });
  });
}
