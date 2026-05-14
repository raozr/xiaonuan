import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import {
  createClone,
  getCloneStatus,
  deleteClone as deleteVoiceClone,
} from '../services/voice-service-client.js';

const createCloneSchema = z.object({
  familyId: z.string().min(1),
  samples: z.array(
    z.object({
      filename: z.string().min(1),
      base64: z.string().min(1),
    })
  ).min(1).max(5),
});

async function assertFamilyMember(userId: string, familyId: string, reply: FastifyReply) {
  const member = await prisma.childProfile.findUnique({
    where: { userId_familyId: { userId, familyId } },
  });
  if (!member) {
    return reply.status(403).send({ success: false, message: '无权访问该家庭' });
  }
  return member;
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

    const { familyId, samples } = parsed.data;
    const member = await assertFamilyMember(user.userId, familyId, reply);
    if (!member) return;

    const audioBuffers = samples.map((s) => ({
      buffer: Buffer.from(s.base64, 'base64'),
      filename: s.filename,
    }));

    try {
      const result = await createClone(audioBuffers, familyId);

      await prisma.voiceClone.create({
        data: {
          familyId,
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
      const message = err instanceof Error ? err.message : '语音复刻失败';
      request.log.error({ err: message }, '语音复刻失败');
      return reply.status(500).send({ success: false, message });
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
      include: { family: { include: { children: { where: { userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    const isMember = clone.family.children.length > 0;
    const isElder = user.role === 'ELDER' && user.familyId === clone.familyId;
    if (!isMember && !isElder) {
      return reply.status(403).send({ success: false, message: '无权访问' });
    }

    try {
      const statusResult = await getCloneStatus(voiceId);
      return reply.send({
        success: true,
        voiceId: statusResult.voiceId,
        status: statusResult.status,
        familyId: clone.familyId,
        createdAt: clone.createdAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '查询失败';
      return reply.status(500).send({ success: false, message });
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
      include: { family: { include: { children: { where: { userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    if (clone.family.children.length === 0) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    try {
      await deleteVoiceClone(voiceId);
      await prisma.voiceClone.delete({ where: { id: clone.id } });

      if (clone.family.clonedVoiceId === voiceId) {
        await prisma.family.update({
          where: { id: clone.familyId },
          data: { clonedVoiceId: null },
        });
      }

      return reply.send({ success: true, message: '已删除' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      request.log.error({ err: message }, '删除音色失败');
      return reply.status(500).send({ success: false, message });
    }
  });

  // List clones for a family
  app.get('/family/:familyId', async (request, reply) => {
    const { familyId } = request.params as { familyId: string };
    const user = request.user;
    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const isMember =
      user.role === 'CHILD' &&
      (await prisma.childProfile.findUnique({
        where: { userId_familyId: { userId: user.userId, familyId } },
      })) !== null;
    const isElder = user.role === 'ELDER' && user.familyId === familyId;
    if (!isMember && !isElder) {
      return reply.status(403).send({ success: false, message: '无权访问' });
    }

    const clones = await prisma.voiceClone.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ success: true, data: clones });
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
      include: { family: { include: { children: { where: { userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    if (clone.family.children.length === 0) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    await prisma.family.update({
      where: { id: clone.familyId },
      data: { clonedVoiceId: voiceId },
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
      include: { family: { include: { children: { where: { userId: user.userId } } } } },
    });

    if (!clone) {
      return reply.status(404).send({ success: false, message: '音色不存在' });
    }

    if (clone.family.children.length === 0) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    await prisma.family.update({
      where: { id: clone.familyId },
      data: { clonedVoiceId: null },
    });

    return reply.send({ success: true, message: '已取消激活' });
  });
}
