import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@xiaonuan/prisma';

export async function verifyElderAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user || user.role !== 'ELDER' || !user.familyId) {
    return;
  }

  const elder = await prisma.elderProfile.findUnique({
    where: { familyId: user.familyId },
    select: { deviceId: true, openid: true },
  });

  if (!elder) {
    return reply.status(401).send({ success: false, message: '老人信息不存在' });
  }

  if (user.deviceId && elder.deviceId !== user.deviceId) {
    return reply.status(401).send({ success: false, message: '设备已解绑' });
  }

  if (user.openid && elder.openid !== user.openid) {
    return reply.status(401).send({ success: false, message: '认证信息无效' });
  }
}

export async function authenticate(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ success: false, message: '未提供认证令牌' });
    }

    const token = authHeader.slice(7);

    try {
      const decoded = await request.jwtVerify<{ role: string; phone?: string; familyId?: string; deviceId?: string; openid?: string }>();
      request.user = decoded;
      await verifyElderAuth(request, reply);
    } catch (err) {
      if (reply.sent) return;
      return reply.status(401).send({ success: false, message: '无效的认证令牌' });
    }
  });
}
