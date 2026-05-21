import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';
import { generateInviteCode } from '../utils/invite-code.js';
import { verifyCompanioneeAuth } from '../middleware/auth.js';
import { transcribeVoice } from '../services/voice-service-client.js';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { emitEvent } from '../events/event-bus.js';
import { enqueueExtraction } from '../services/extraction-service.js';

const createPairingSchema = z.object({
  companioneeName: z.string().min(1),
  companioneeAge: z.number().min(50).max(120).optional(),
  companioneeDialect: z.string().optional(),
});

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, message: '未提供认证令牌' });
  }
  try {
    await request.jwtVerify();
    await verifyCompanioneeAuth(request, reply);
  } catch {
    if (reply.sent) return;
    return reply.status(401).send({ success: false, message: '无效的认证令牌' });
  }
}

export async function assertPairingMember(userId: string, pairingId: string, reply: FastifyReply) {
  const participant = await prisma.participant.findFirst({
    where: { pairingId, role: 'STEWARD', userId },
  });
  if (!participant) {
    return reply.status(403).send({ success: false, message: '无权访问该配对' });
  }
  return participant;
}

function mapCompanionee(participants: any[]) {
  return participants.find(p => p.role === 'COMPANIONEE' && !p.isAI) ?? null;
}

function enrichPairingsWithStatus(
  pairings: any[],
  activeSessions: { pairingId: string; updatedAt: Date }[],
  lastSessions: { pairingId: string; updatedAt: Date }[]
) {
  const activeMap = new Map(activeSessions.map(s => [s.pairingId, true]));
  const lastMap = new Map(lastSessions.map(s => [s.pairingId, s.updatedAt]));

  return pairings.map(p => {
    const participants = p.participants ?? [];
    const companionee = mapCompanionee(participants);
    return {
      id: p.id,
      inviteCode: p.inviteCode,
      inviteCodeExpiresAt: p.inviteCodeExpiresAt,
      companionee: companionee ? {
        id: companionee.id,
        pairingId: companionee.pairingId,
        name: companionee.name,
        gender: companionee.metadata?.gender,
        age: companionee.metadata?.age ? Number(companionee.metadata.age) : undefined,
        dialect: companionee.metadata?.dialect,
        hobbies: companionee.metadata?.hobbies,
        healthNotes: companionee.metadata?.healthNotes,
        topicsToAvoid: companionee.metadata?.topicsToAvoid,
        greetingPreference: companionee.metadata?.greetingPreference,
      } : undefined,
      isOnline: activeMap.has(p.id) ?? false,
      lastActive: lastMap.get(p.id)?.toISOString() ?? null,
    };
  });
}

export async function pairingRoutes(app: FastifyInstance) {
  // List all pairings for a steward, or the single pairing for a companionee
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    if (user.role === 'STEWARD' && user.userId) {
      const stewardParticipants = await prisma.participant.findMany({
        where: { role: 'STEWARD', userId: user.userId },
        include: { pairing: true },
      });
      const pairingIds = stewardParticipants.map(cp => cp.pairing.id);

      const pairings = await prisma.pairing.findMany({
        where: { id: { in: pairingIds } },
        include: { participants: true },
      });
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

    if (user.role === 'COMPANIONEE' && user.pairingId) {
      const pairing = await prisma.pairing.findUnique({
        where: { id: user.pairingId },
        include: { participants: true },
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

    const companionee = mapCompanionee(pairing.participants);

    return reply.send({
      id: pairing.id,
      inviteCode: pairing.inviteCode,
      inviteCodeExpiresAt: pairing.inviteCodeExpiresAt,
      companionee: companionee ? {
        id: companionee.id,
        pairingId: companionee.pairingId,
        name: companionee.name,
        gender: companionee.metadata?.gender,
        age: companionee.metadata?.age ? Number(companionee.metadata.age) : undefined,
        dialect: companionee.metadata?.dialect,
        hobbies: companionee.metadata?.hobbies,
        healthNotes: companionee.metadata?.healthNotes,
        topicsToAvoid: companionee.metadata?.topicsToAvoid,
        greetingPreference: companionee.metadata?.greetingPreference,
      } : undefined,
      isOnline: undefined,
      lastActive: null,
    });
  });

  // Create a new pairing (Steward only)
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user;
    if (!user || user.role !== 'STEWARD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '仅照管者可创建配对' });
    }

    const body = request.body as Record<string, unknown>;
    const parsed = createPairingSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { companioneeName, companioneeAge, companioneeDialect } = parsed.data;

    const userData = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!userData) {
      return reply.status(404).send({ success: false, message: '用户不存在' });
    }

    const pairing = await prisma.pairing.create({
      data: {
        name: companioneeName,
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            {
              name: companioneeName,
              role: 'COMPANIONEE',
              isAI: false,
              metadata: {
                ...(companioneeAge ? { age: String(companioneeAge) } : {}),
                ...(companioneeDialect ? { dialect: companioneeDialect } : {}),
              },
            },
            {
              name: userData.phone ?? '照管者',
              role: 'STEWARD',
              isAI: false,
              userId: user.userId,
              metadata: { relationshipToCompanionee: '照管者' },
            },
            {
              name: '小暖',
              role: 'COMPANIONEE',
              isAI: true,
              metadata: { template: 'caring-companion' },
            },
          ],
        },
        aiPersona: {
          create: {
            name: '贴心小暖',
            template: 'caring-companion',
            traits: { warm: true, humorous: true, patient: true },
            tone: '口语化，多用语气助词',
            constraints: { maxDailyMessages: 50, noMedicalAdvice: true },
          },
        },
      },
    });

    const participants = await prisma.participant.findMany({
      where: { pairingId: pairing.id },
    });
    const companionee = participants.find(p => p.role === 'COMPANIONEE' && !p.isAI);
    const steward = participants.find(p => p.role === 'STEWARD' && !p.isAI);
    const aiParticipant = participants.find(p => p.isAI);

    const token = app.jwt.sign(
      { pairingId: pairing.id, role: 'STEWARD', userId: user.userId },
      { expiresIn: '7d' }
    );

    return reply.status(201).send({
      id: pairing.id,
      inviteCode: pairing.inviteCode,
      inviteCodeExpiresAt: pairing.inviteCodeExpiresAt,
      companionee,
      steward,
      ai: aiParticipant,
      token,
      expiresIn: 604800,
    });
  });

  // Refresh invite code
  app.post('/:pairingId/refresh-code', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'STEWARD' || !user.userId) {
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

  // Update companionee participant metadata
  app.put('/:pairingId/companionee', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'STEWARD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const companionee = await prisma.participant.findFirst({
      where: { pairingId, role: 'COMPANIONEE', isAI: false },
    });
    if (!companionee) {
      return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
    }

    const body = request.body as Record<string, unknown>;
    const existingMeta = (companionee.metadata as Record<string, string> | null) ?? {};
    const updatedMeta = { ...existingMeta };

    if (typeof body.name === 'string') await prisma.participant.update({ where: { id: companionee.id }, data: { name: body.name } });
    if (typeof body.age === 'number') updatedMeta.age = String(body.age);
    if (typeof body.dialect === 'string') updatedMeta.dialect = body.dialect;
    if (typeof body.hobbies === 'string') updatedMeta.hobbies = body.hobbies;
    if (typeof body.healthNotes === 'string') updatedMeta.healthNotes = body.healthNotes;
    if (typeof body.topicsToAvoid === 'string') updatedMeta.topicsToAvoid = body.topicsToAvoid;
    if (typeof body.greetingPreference === 'string') updatedMeta.greetingPreference = body.greetingPreference;

    const updated = await prisma.participant.update({
      where: { id: companionee.id },
      data: { metadata: updatedMeta },
    });

    return reply.send({ success: true, companionee: updated });
  });

  // Bind companionee device
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
      const existingCompanionee = await prisma.participant.findFirst({
        where: { role: 'COMPANIONEE', isAI: false, deviceId: body.deviceId },
        select: { id: true, pairingId: true },
      });

      if (existingCompanionee && existingCompanionee.pairingId !== pairing.id) {
        await prisma.participant.update({
          where: { id: existingCompanionee.id },
          data: { deviceId: null },
        });
      }

      const companionee = await prisma.participant.findFirst({
        where: { pairingId: pairing.id, role: 'COMPANIONEE', isAI: false },
      });
      if (!companionee) {
        return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
      }

      await prisma.participant.update({
        where: { id: companionee.id },
        data: { deviceId: body.deviceId },
      });

      const token = app.jwt.sign(
        { pairingId: pairing.id, role: 'COMPANIONEE', deviceId: body.deviceId },
        { expiresIn: '365d' }
      );

      return reply.send({
        success: true,
        token,
        role: 'COMPANIONEE',
        pairingId: pairing.id,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, message: '服务器繁忙，请稍后再试' });
    }
  });

  // Unbind companionee device
  app.delete('/:pairingId/bind', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'STEWARD' || !user.userId) {
      return reply.status(403).send({ success: false, message: '无权操作' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const companionee = await prisma.participant.findFirst({
      where: { pairingId, role: 'COMPANIONEE', isAI: false },
    });
    if (!companionee) {
      return reply.status(404).send({ success: false, message: '被陪伴者不存在' });
    }

    await prisma.participant.update({
      where: { id: companionee.id },
      data: { deviceId: null },
    });

    return reply.send({ success: true, message: '解绑成功' });
  });

  // Delete pairing (primary steward only)
  app.delete('/:pairingId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const user = request.user;

    if (!user || user.role !== 'STEWARD' || !user.userId) {
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

      // Emit event to EventStream and enqueue for persona extraction
      await emitEvent({
        pairingId,
        type: 'feed_message',
        content: content.trim(),
        tags: ['TEXT'],
      }, { immediate: true });
      await enqueueExtraction('feed', pairingId, content.trim(), member.role);

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

    // Emit event to EventStream and enqueue for persona extraction
    await emitEvent({
      pairingId,
      type: 'feed_message',
      content: asrText || '(未能识别语音内容)',
      tags: ['VOICE'],
    }, { immediate: true });
    await enqueueExtraction('feed', pairingId, asrText || '(未能识别语音内容)', member.role);

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

  app.delete('/:pairingId/feeds/:feedId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { pairingId, feedId } = request.params as { pairingId: string; feedId: string };
    const user = request.user;

    if (!user || !user.userId) {
      return reply.status(401).send({ success: false, message: '未认证' });
    }

    const member = await assertPairingMember(user.userId, pairingId, reply);
    if (!member) return;

    const feed = await prisma.feedMessage.findUnique({ where: { id: feedId } });
    if (!feed || feed.pairingId !== pairingId) {
      return reply.status(404).send({ success: false, message: '记录不存在' });
    }

    await prisma.feedMessage.delete({ where: { id: feedId } });

    return reply.send({ success: true });
  });
}
