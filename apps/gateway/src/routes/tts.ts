import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { synthesizeSpeech } from '../services/nls.js';
import { authenticate } from '../middleware/auth.js';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const ttsSchema = z.object({
  text: z.string().min(1).max(1000),
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

      const audioBuffer = await synthesizeSpeech(parsed.data.text);
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
      const message = err instanceof Error ? err.message : '语音合成失败';
      request.log.error({ err: message }, '语音合成失败');
      return reply.status(500).send({ success: false, message });
    }
  });
}
