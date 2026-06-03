import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { cleanLLMResponse } from '../agent/response-cleaner.js';

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  before: z.string().optional(),
});

type CompanioneeUser = {
  role: string;
  pairingId?: string;
};

function serializeMessage(message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.role === 'AI' ? cleanLLMResponse(message.content) : message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function conversationHistoryRoutes(app: FastifyInstance) {
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as CompanioneeUser | undefined;

    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role !== 'COMPANIONEE') {
      return reply.status(403).send({ success: false, message: '仅被陪伴者可查看对话历史' });
    }

    if (!user.pairingId) {
      return reply.status(400).send({ success: false, message: '缺少配对信息' });
    }

    const parsed = historyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    const pairing = await prisma.pairing.findUnique({
      where: { id: user.pairingId },
      select: { id: true },
    });
    if (!pairing) {
      return reply.status(404).send({ success: false, message: '配对不存在' });
    }

    const { limit = 50, before } = parsed.data;
    let beforeMessage: { id: string; createdAt: Date } | null = null;
    if (before) {
      beforeMessage = await prisma.sessionMessage.findFirst({
        where: {
          id: before,
          session: { pairingId: user.pairingId },
        },
        select: { id: true, createdAt: true },
      });
      if (!beforeMessage) {
        return reply.status(400).send({ success: false, message: '分页游标无效' });
      }
    }

    const messages = await prisma.sessionMessage.findMany({
      where: {
        session: { pairingId: user.pairingId },
        ...(beforeMessage
          ? {
              OR: [
                { createdAt: { lt: beforeMessage.createdAt } },
                {
                  createdAt: beforeMessage.createdAt,
                  id: { lt: beforeMessage.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const pageMessages = messages.slice(0, limit).reverse();
    const nextCursor = hasMore ? pageMessages[0]?.id ?? null : null;

    return reply.send({
      success: true,
      data: pageMessages.map(serializeMessage),
      pagination: {
        limit,
        nextCursor,
      },
    });
  });
}
