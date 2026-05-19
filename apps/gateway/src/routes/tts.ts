import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { synthesizeVoice } from '../services/voice-service-client.js';
import { resolveVoiceId } from '../services/voice.js';
import { authenticate } from '../middleware/auth.js';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@xiaonuan/prisma';

const ttsSchema = z.object({
  text: z.string().min(1).max(1000),
  pairingId: z.string().optional(),
});

const TTS_DIR = path.resolve(process.cwd(), 'public', 'tts');

async function ensureTtsDir() {
  try {
    await fs.mkdir(TTS_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export async function ttsRoutes(app: FastifyInstance) {
  await authenticate(app);
  await ensureTtsDir();

  app.post('/synthesize', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = ttsSchema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    try {
      request.log.info({ text: parsed.data.text }, '开始语音合成...');

      let voiceId: string | undefined;
      const user = request.user;

      if (user?.role === 'ELDER' && user.pairingId) {
        voiceId = await resolveVoiceId(user.pairingId);
      } else if (user?.role === 'CHILD' && parsed.data.pairingId && user.userId) {
        const member = await prisma.participant.findFirst({
          where: { pairingId: parsed.data.pairingId, role: 'CHILD', userId: user.userId },
        });
        if (member) {
          voiceId = await resolveVoiceId(parsed.data.pairingId);
        }
      }

      const result = await synthesizeVoice(parsed.data.text, voiceId);

      const downloadRes = await fetch(result.audioUrl);
      if (!downloadRes.ok) {
        throw new Error(`下载合成音频失败: ${downloadRes.status}`);
      }
      const arrayBuffer = await downloadRes.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('TTS 未返回音频数据');
      }

      const fileName = `${randomUUID()}.mp3`;
      const filePath = path.join(TTS_DIR, fileName);
      await fs.writeFile(filePath, audioBuffer);

      request.log.info({ fileName, size: audioBuffer.length }, '语音合成完成');

      return reply.send({
        success: true,
        audioUrl: `/tts/${fileName}`,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ success: false, message: '语音合成失败，请稍后再试' });
    }
  });
}
