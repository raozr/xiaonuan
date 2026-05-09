import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@xiaonuan/prisma';

export async function authenticate(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ success: false, message: '未提供认证令牌' });
    }

    const token = authHeader.slice(7);

    try {
      const decoded = await request.jwtVerify<{ role: string; phone?: string; familyId?: string; deviceId?: string }>();
      request.user = decoded;
    } catch {
      return reply.status(401).send({ success: false, message: '无效的认证令牌' });
    }
  });
}
