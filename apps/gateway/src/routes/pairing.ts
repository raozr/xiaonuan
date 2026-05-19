import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { generateInviteCode } from '../utils/invite-code.js';
import { verifyElderAuth } from '../middleware/auth.js';
import { transcribeVoice } from '../services/voice-service-client.js';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const createPairingSchema = z.object({
  elderName: z.string().min(1),
  elderAge: z.number().min(50).max(120).optional(),
  elderDialect: z.string().optional(),
});

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, message: '未提供认证令牌' });
  }
  try {
    await request.jwtVerify();
    await verifyElderAuth(request, reply);
  } catch {
    if (reply.sent) return;
    return reply.status(401).send({ success: false, message: '无效的认证令牌' });
  }
}

async function assertPairingMember(userId: string, pairingId: string, reply: FastifyReply) {
  const participant = await prisma.participant.findFirst({
    where: { pairingId, role: 'CHILD', userId },
  });
  if (!participant) {
    return reply.status(403).send({ success: false, message: '无权访问该配对' });
  }
  return participant;
}

function enrichPairingsWithStatus(
  pairings: any[],
  activeSessions: { pairingId: string; updatedAt: Date }[],
  lastSessions: { pairingId: string; updatedAt: Date }[]
) {
  const activeMap = new Map(activeSessions.map(s => [s.pairingId, true]));
  const lastMap = new Map(lastSessions.map(s => [s.pairingId, s.updatedAt]));

  return pairings.map(p => ({
    ...p,
    isOnline: activeMap.has(p.id) ?? false,
    lastActive: lastMap.get(p.id)?.toISOString() ?? null,
  }));
}

export async function pairingRoutes(app: FastifyInstance) {
  // List all pairings for a child, or the single pairing for an elder
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role === 'CHILD' && user.userId) {
      const childParticipants = await prisma.participant.findMany({
        where: { role: 'CHILD', userId: user.userId },
        include: { pairing: true },
      });
      const pairings = childParticipants.map(cp => cp.pairing);
      const pairingIds = pairings.map(p => p.id);

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const [activeSessions, lastSessions] = await Promise.all([
        prisma.session.findMany({
          where: {
            pairingId: { in: pairingIds },
            endedAt: null,
            updatedAt: { gte: thirtyMinutesAgo },
          },
          select: { pairingId: true, updatedAt: true },
        }),
        prisma.session.findMany({
          where: { pairingId: { in: pairingIds } },
          orderBy: { updatedAt: 'desc' },
          distinct: ['pairingId'],
          select: { pairingId: true, updatedAt: true },
        }),
      ]);

      return reply.send(enrichPairingsWithStatus(pairings, activeSessions, lastSessions));
    }

    if (user.role === 'ELDER' && user.pairingId) {
      const pairing = await prisma.pairing.findUnique({
        where: { id: user.pairingId },
      });
      if (!pairing) {
        return reply.status(404).send({ success: false, message: '配对不存在' });
      }

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const [activeSessions, lastSessions] = await Promise.all([
        prisma.session.findMany({
          where: {
            pairingId: pairing.id,
            endedAt: null,
            updatedAt: { gte: thirtyMinutesAgo },
          },
          select: { pairingId: true, updatedAt: true },
        }),
        prisma.session.findMany({
          where: { pairingId: pairing.id },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { pairingId: true, updatedAt: true },
        }),
      ]);

      return reply.send(enrichPairingsWithStatus([pairing], activeSessions, lastSessions));
    }

    return reply.status(400).send({ success: false, message: '无效的用户角色' });
  });

  // Get a single pairing detail
  app.get('/:pairingId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const pairing = await prisma.pairing.findUnique({
      where: { id: pairingId },
      include: { participants: true },
    });

    if (!pairing) {
      return reply.status(404).send({ success: false, message: '配对不存在' });
    }

    return reply.send(pairing);
  });

  // Create a new pairing (Child only)
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '仅子女可创建配对' });
    }

    const body = request.body as Record<string, unknown>;
    const parsed = createPairingSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { elderName, elderAge, elderDialect } = parsed.data;

    const userData = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!userData) {
      return reply.status(404).send({ success: false, message: '用户不存在' });
    }

    const pairing = await prisma.pairing.create({
      data: {
        name: elderName,
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            {
              name: elderName,
              role: 'ELDER',
              isAI: false,
              metadata: {
                ...(elderAge ? { age: String(elderAge) } : {}),
                ...(elderDialect ? { dialect: elderDialect } : {}),
              },
            },
            {
              name: userData.phone ?? '子女',
              role: 'CHILD',
              isAI: false,
              userId: user.userId,
              metadata: { relationshipToElder: '子女' },
            },
          ],
        },
      },
    });

    const elderParticipant = await prisma.participant.findFirst({
      where: { pairingId: pairing.id, role: 'ELDER' },
    });

    return reply.status(201).send({
      id: pairing.id,
      inviteCode: pairing.inviteCode,
      inviteCodeExpiresAt: pairing.inviteCodeExpiresAt,
      elder: elderParticipant,
    });
  });

  // Refresh invite code
  app.post('/:pairingId/refresh-code', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const pairing = await prisma.pairing.update({
      where: { id: pairingId },
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({
      inviteCode: pairing.inviteCode,
      inviteCodeExpiresAt: pairing.inviteCodeExpiresAt,
    });
  });

  // Update elder participant metadata
  app.put('/:pairingId/elder', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const elder = await prisma.participant.findFirst({
      where: { pairingId, role: 'ELDER', isAI: false },
    });
    if (!elder) {
      return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
    }

    const body = request.body as Record<string, unknown>;
    const existingMeta = (elder.metadata as Record<string, string> | null) ?? {};
    const updatedMeta = { ...existingMeta };

    if (typeof body.name === 'string') await prisma.participant.update({ where: { id: elder.id }, data: { name: body.name } });
    if (typeof body.age === 'number') updatedMeta.age = String(body.age);
    if (typeof body.dialect === 'string') updatedMeta.dialect = body.dialect;
    if (typeof body.hobbies === 'string') updatedMeta.hobbies = body.hobbies;
    if (typeof body.healthNotes === 'string') updatedMeta.healthNotes = body.healthNotes;
    if (typeof body.topicsToAvoid === 'string') updatedMeta.topicsToAvoid = body.topicsToAvoid;
    if (typeof body.greetingPreference === 'string') updatedMeta.greetingPreference = body.greetingPreference;

    const updated = await prisma.participant.update({
      where: { id: elder.id },
      data: { metadata: updatedMeta },
    });

    return reply.send({ success: true, elder: updated });
  });

  // Bind elder device
  app.post('/bind', async (request, reply) => {
    try {
      const body = request.body as { inviteCode?: string; deviceId?: string };

      if (!body.inviteCode || !body.deviceId) {
        return reply.status(400).send({ success: false, message: '邀请码和设备标识必填' });
      }

      const pairing = await prisma.pairing.findUnique({
        where: { inviteCode: body.inviteCode },
      });

      if (!pairing) {
        return reply.status(404).send({ success: false, message: '邀请码无效' });
      }

      if (pairing.inviteCodeExpiresAt && pairing.inviteCodeExpiresAt < new Date()) {
        return reply.status(410).send({ success: false, message: '邀请码已过期' });
      }

      // If this device is already bound to another pairing, unbind it first
      const existingElder = await prisma.participant.findFirst({
        where: { role: 'ELDER', isAI: false },
        select: { id: true, pairingId: true, metadata: true },
      });

      if (existingElder) {
        const existingMeta = (existingElder.metadata as Record<string, string> | null) ?? {};
        const existingDeviceId = existingMeta.deviceId;
        if (existingDeviceId === body.deviceId && existingElder.pairingId !== pairing.id) {
          const { deviceId: _, ...restMeta } = existingMeta;
          await prisma.participant.update({
            where: { id: existingElder.id },
            data: { metadata: restMeta },
          });
        }
      }

      const elder = await prisma.participant.findFirst({
        where: { pairingId: pairing.id, role: 'ELDER', isAI: false },
      });
      if (!elder) {
        return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
      }

      const existingMeta = (elder.metadata as Record<string, string> | null) ?? {};
      const updatedMeta = { ...existingMeta, deviceId: body.deviceId };
      await prisma.participant.update({
        where: { id: elder.id },
        data: { metadata: updatedMeta },
      });

      const token = app.jwt.sign(
        { pairingId: pairing.id, role: 'ELDER', deviceId: body.deviceId },
        { expiresIn: '365d' }
      );

      return reply.send({
        success: true,
        token,
        role: 'ELDER',
        pairingId: pairing.id,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, message: '服务器繁忙，请稍后再试' });
    }
  });

  // Unbind elder device
  app.delete('/:pairingId/bind', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const elder = await prisma.participant.findFirst({
      where: { pairingId, role: 'ELDER', isAI: false },
    });
    if (!elder) {
      return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
    }

    const existingMeta = (elder.metadata as Record<string, string> | null) ?? {};
    const { deviceId: _, ...restMeta } = existingMeta;
    await prisma.participant.update({
      where: { id: elder.id },
      data: { metadata: restMeta },
    });

    return reply.send({ success: true, message: '解绑成功' });
  });

  // Delete pairing (primary child only)
  app.delete('/:pairingId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'CHILD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const isPrimary = ((member.metadata as Record<string, unknown> | null)?.isPrimary) === true;
    if (!isPrimary) {
      return reply.status(403).send({ success: false, message: '仅主要家庭成员可删除配对' });
    }

    await prisma.pairing.delete({ where: { id: pairingId } });

    return reply.send({ success: true, message: '配对已删除' });
  });

  // Daily Summary
  app.get('/:pairingId/daily-summary', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = await prisma.dailySummary.findUnique({
      where: {
        pairingId_date: {
          pairingId,
          date: today,
        },
      },
    });

    if (!summary) {
      return reply.send({ success: true, data: null });
    }

    return reply.send({
      success: true,
      data: {
        mood: summary.moodLabel,
        duration: summary.duration,
        topics: summary.topicCount,
        highlights: summary.highlights,
        concerns: summary.concerns,
      },
    });
  });

  // Pairing Feeds (via EventStream)
  const createFeedSchema = z.object({
    type: z.enum(['TEXT', 'VOICE']),
    content: z.string().optional(),
    audioBase64: z.string().optional(),
  });

  app.post('/:pairingId/feeds', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const body = request.body as Record<string, unknown>;
    const parsed = createFeedSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { type, content, audioBase64 } = parsed.data;
    const baseUrl = `${request.protocol}://${request.hostname}${request.port ? ':' + request.port : ''}`;

    if (type === 'TEXT') {
      if (!content || !content.trim()) {
        return reply.status(400).send({ success: false, message: '内容不能为空' });
      }

      const feed = await prisma.feedMessage.create({
        data: {
          pairingId,
          type: 'TEXT',
          content: content.trim(),
        },
      });

      return reply.status(201).send({ success: true, data: feed });
    }

    // VOICE
    if (!audioBase64) {
      return reply.status(400).send({ success: false, message: '音频数据不能为空' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const fileName = `${randomUUID()}.mp3`;
    const feedsDir = join(process.cwd(), 'public', 'feeds');
    await mkdir(feedsDir, { recursive: true });
    const filePath = join(feedsDir, fileName);
    await writeFile(filePath, audioBuffer);

    const audioUrl = `${baseUrl}/feeds/${fileName}`;

    let asrText = '';
    try {
      const asrResult = await transcribeVoice(audioBuffer, 'mp3', 16000);
      asrText = asrResult.success ? (asrResult.text ?? '') : '';
    } catch (asrErr: any) {
      app.log.error('[Feed] ASR failed:', asrErr.message || String(asrErr));
    }

    const feed = await prisma.feedMessage.create({
      data: {
        pairingId,
        type: 'VOICE',
        content: asrText || '(未能识别语音内容)',
        audioUrl,
      },
    });

    return reply.status(201).send({ success: true, data: feed });
  });

  app.get('/:pairingId/feeds', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const feeds = await prisma.feedMessage.findMany({
      where: { pairingId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return reply.send({ success: true, data: feeds });
  });
}
