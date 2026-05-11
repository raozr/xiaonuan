import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recognizeSpeech } from '../services/nls.js';
import { authenticate } from '../middleware/auth.js';

const asrSchema = z.object({
  audioBase64: z.string().min(1),
  format: z.string().default('wav'),
});

export async function asrRoutes(app: FastifyInstance) {
  await authenticate(app);

  app.post('/transcribe', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = asrSchema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误' });
    }

    try {
      request.log.info('开始语音识别...');

      // base64 → Buffer
      const audioBuffer = Buffer.from(parsed.data.audioBase64, 'base64');
      request.log.info({ size: audioBuffer.length }, '音频数据');

      // NLS 一句话识别
      const text = await recognizeSpeech(audioBuffer, parsed.data.format, 16000);
      request.log.info({ text }, '语音识别结果');

      if (!text.trim()) {
        return reply.send({ success: false, message: '未能识别到语音内容' });
      }

      return reply.send({ success: true, text });
    } catch (err) {
      const message = err instanceof Error ? err.message : '语音识别处理失败';
      request.log.error({ err: message }, '语音识别失败');
      return reply.status(500).send({ success: false, message });
    }
  });
}
