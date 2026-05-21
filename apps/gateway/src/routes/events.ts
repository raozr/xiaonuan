import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { requireAuth, assertPairingMember } from './pairing.js';

const listQuerySchema = z.object({
  type: z.string().optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function eventsRoutes(app: FastifyInstance) {
  // List events with pagination and filtering
  app.get('/:pairingId/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const query = request.query as Record<string, string | undefined>;
    const parsed = listQuerySchema.safeParse(query);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    const { type, page = 1, limit = 50, from, to } = parsed.data;

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { pairingId };
    if (type) where.type = type;
    if (from || to) {
      where.eventTime = {};
      if (from) (where.eventTime as Record<string, unknown>).gte = from;
      if (to) (where.eventTime as Record<string, unknown>).lte = to;
    }

    const [events, total] = await Promise.all([
      prisma.eventStream.findMany({
        where,
        orderBy: { eventTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.eventStream.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: events,
      pagination: { page, limit, total },
    });
  });

  // Today events shortcut
  app.get('/:pairingId/events/today', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = await prisma.eventStream.findMany({
      where: {
        pairingId,
        eventTime: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { eventTime: 'asc' },
    });

    return reply.send({
      success: true,
      data: events,
    });
  });
}
