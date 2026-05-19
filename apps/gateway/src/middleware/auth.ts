import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@xiaonuan/prisma';

export async function verifyElderAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user || user.role !== 'ELDER' || !user.pairingId) {
    return;
  }

  const participant = await prisma.participant.findFirst({
    where: { pairingId: user.pairingId, role: 'ELDER', isAI: false },
    select: { deviceId: true, openid: true },
  });

  if (!participant) {
    return reply.status(401).send({ success: false, message: '老人信息不存在' });
  }

  if (user.deviceId && participant.deviceId !== user.deviceId) {
    return reply.status(401).send({ success: false, message: '设备已解绑' });
  }

  if (user.openid && participant.openid !== user.openid) {
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
      const decoded = await request.jwtDecode<{ role: string; phone?: string; pairingId?: string; deviceId?: string; openid?: string }>();
      request.user = decoded;
      if (decoded.role === 'ELDER') {
        await verifyElderAuth(request, reply);
      }
    } catch (err) {
      if (reply.sent) return;
      return reply.status(401).send({ success: false, message: '无效的认证令牌' });
    }
  });
}
