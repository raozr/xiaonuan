import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import {
  createClone,
  getCloneStatus,
  deleteClone as deleteVoiceClone,
} from '../services/voice-service-client.js';

const createCloneSchema = z.object({
  pairingId: z.string().min(1),
  samples: z.array(
    z.object({
      filename: z.string().min(1),
      base64: z.string().min(1),
    })
  ).min(1).max(5),
});

async function assertPairingMember(userId: string, pairingId: string, reply: FastifyReply) {
  const participant = await prisma.participant.findFirst({
    where: { pairingId, role: 'CHILD', userId },
  });
  if (!participant) {
    return reply.status(403).send({ success: false, message: '无权访问该配对' });
  }
  return participant;
}

export async function voiceCloneRoutes(app: FastifyInstance) {
  // Create clone
  app.post('/', async (request, reply) => {
    const user = request.user;
    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const body = request.body as Record<string, unknown>;
    const parsed = createCloneSchema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { pairingId, samples } = parsed.data;
    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const audioBuffers = samples.map((s) => ({
      buffer: Buffer.from(s.base64, 'base64'),
      filename: s.filename,
    }));

    try {
      const result = await createClone(audioBuffers, pairingId);

      await prisma.voiceClone.create({
        data: {
          pairingId,
          createdBy: user.userId,
          voiceId: result.voiceId,
          status: 'READY',
          sampleUrls: samples.map((s) => s.filename),
        },
      });

      return reply.status(201).send({
        success: true,
        voiceId: result.voiceId,
        status: result.status,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: '语音复刻失败，请稍后再试' });
    }
  });

  // Get clone status
  app.get('/:voiceId', async (request, reply) => {
    const { voiceId } = request.params as { voiceId: string };
    const user = request.user;
    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const clone = await prisma.voiceClone.findFirst({
      where: { voiceId },
      include: { pairing: { include: { participants: { where: { role: 'CHILD', userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    const isMember = clone.pairing.participants.length > 0;
    const isElder = user.role === 'ELDER' && user.pairingId === clone.pairingId;
    if (!isMember && !isElder) {
      return reply.status(403).send({ success: false, message: '无权访问' });
    }

    try {
      const statusResult = await getCloneStatus(voiceId);
      return reply.send({
        success: true,
        voiceId: statusResult.voiceId,
        status: statusResult.status,
        pairingId: clone.pairingId,
        createdAt: clone.createdAt,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: '查询失败，请稍后再试' });
    }
  });

  // Delete clone
  app.delete('/:voiceId', async (request, reply) => {
    const { voiceId } = request.params as { voiceId: string };
    const user = request.user;
    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const clone = await prisma.voiceClone.findFirst({
      where: { voiceId },
      include: { pairing: { include: { participants: { where: { role: 'CHILD', userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    if (clone.pairing.participants.length === 0) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    try {
      await deleteVoiceClone(voiceId);
      await prisma.voiceClone.delete({ where: { id: clone.id } });

      return reply.send({ success: true, message: '已删除' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: '删除失败，请稍后再试' });
    }
  });

  // List clones for a pairing
  app.get('/pairing/:pairingId', async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;
    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const isMember =
      user.role === 'CHILD' &&
      (await prisma.participant.findFirst({
        where: { pairingId, role: 'CHILD', userId: user.userId },
      })) !== null;
    const isElder = user.role === 'ELDER' && user.pairingId === pairingId;
    if (!isMember && !isElder) {
      return reply.status(403).send({ success: false, message: '无权访问' });
    }

    const clones = await prisma.voiceClone.findMany({
      where: { pairingId },
      orderBy: { createdAt: 'desc' },
    });

    const activeVoice = await prisma.voiceClone.findFirst({
      where: { pairingId, status: 'READY' },
      select: { voiceId: true },
    });

    return reply.send({ success: true, data: clones, activeVoiceId: activeVoice?.voiceId ?? '' });
  });

  // Activate clone
  app.post('/:voiceId/activate', async (request, reply) => {
    const { voiceId } = request.params as { voiceId: string };
    const user = request.user;
    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const clone = await prisma.voiceClone.findFirst({
      where: { voiceId },
      include: { pairing: { include: { participants: { where: { role: 'CHILD', userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    if (clone.pairing.participants.length === 0) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    await prisma.voiceClone.update({
      where: { id: clone.id },
      data: { status: 'READY' },
    });

    return reply.send({ success: true, message: '已激活' });
  });

  // Deactivate clone
  app.post('/:voiceId/deactivate', async (request, reply) => {
    const { voiceId } = request.params as { voiceId: string };
    const user = request.user;
    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const clone = await prisma.voiceClone.findFirst({
      where: { voiceId },
      include: { pairing: { include: { participants: { where: { role: 'CHILD', userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    if (clone.pairing.participants.length === 0) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    await prisma.voiceClone.update({
      where: { id: clone.id },
      data: { status: 'PENDING' },
    });

    return reply.send({ success: true, message: '已取消激活' });
  });
}
