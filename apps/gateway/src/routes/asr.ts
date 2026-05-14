import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transcribeVoice } from '../services/voice-service-client.js';
import { authenticate } from '../middleware/auth.js';

const asrSchema = z.object({
  audioBase64: z.string().min(1),
  format: z.string().default('wav'),
  sampleRate: z.number().default(16000),
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

      const audioBuffer = Buffer.from(parsed.data.audioBase64, 'base64');
      request.log.info({ size: audioBuffer.length }, '音频数据');

      const result = await transcribeVoice(audioBuffer, parsed.data.format, parsed.data.sampleRate);
      request.log.info({ result }, '语音识别结果');

      if (!result.success || !result.text?.trim()) {
        return reply.send({ success: false, message: result.message || '未能识别到语音内容' });
      }

      return reply.send({ success: true, text: result.text });
    } catch (err) {
      const message = err instanceof Error ? err.message : '语音识别处理失败';
      request.log.error({ err: message }, '语音识别失败');
      return reply.status(500).send({ success: false, message });
    }
  });
}
