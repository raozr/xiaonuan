import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@xiaonuan/prisma';
import { chatCompletion } from '../services/dashscope.js';
import { env } from '../config/env.js';
import { addProfiles } from '../memory/persona-service.js';

const QUEUE_NAME = 'extraction';

export interface ExtractionJob {
  source: 'feed' | 'checkpoint';
  pairingId: string;
  content: string;
  context?: string;
}

export interface ExtractionResult {
  category: string;
  content: string;
  confidence: number;
}

let queue: Queue<ExtractionJob> | null = null;
let worker: Worker<ExtractionJob, ExtractionResult> | null = null;

function connection() {
  return { url: env.REDIS_URL };
}

export async function getQueue(): Promise<Queue<ExtractionJob>> {
  if (!queue) {
    queue = new Queue<ExtractionJob>(QUEUE_NAME, { connection: connection() });
  }
  return queue;
}

export function getWorker(): Worker<ExtractionJob, ExtractionResult> | null {
  return worker;
}

const EXTRACTION_PROMPT = (content: string) => `请从以下内容中提取人物画像条目（JSON 数组），每条包含 category, content, confidence(0-1)。

输入：${content}

要求：
- category 为 hobby/health/preference/habit/person/place/event 之一
- content 为一句话的客观事实
- confidence 为置信度，0.5-1.0
- 只提取明确的、可验证的事实

示例输出：
[{"category":"hobby","content":"喜欢听京剧","confidence":0.95}]`;

export async function startWorker() {
  worker = new Worker<ExtractionJob, ExtractionResult>(
    QUEUE_NAME,
    async (job: Job<ExtractionJob>) => {
      const { source, pairingId, content, context } = job.data;

      try {
        const response = await chatCompletion(
          [
            { role: 'system', content: '你是一个人物画像提取助手。从文本中提取关于老人的客观事实。' },
            { role: 'user', content: EXTRACTION_PROMPT(`${context ?? ''}\n${content}`) },
          ],
          { temperature: 0.3, maxTokens: 256 }
        );

        const results: ExtractionResult[] = JSON.parse(response.content ?? '[]');

        // Find the elder participant for this pairing
        const elder = await prisma.participant.findFirst({
          where: { pairingId, role: 'ELDER', isAI: false },
        });

        if (!elder) {
          throw new Error(`ELDER participant not found for pairing ${pairingId}`);
        }

        // Write extracted profiles
        const created = await addProfiles(
          pairingId,
          elder.id,
          results.map((r) => ({
            category: r.category,
            content: r.content,
            confidence: r.confidence,
            source,
          }))
        );

        const first = results[0];
        return {
          category: first?.category ?? 'event',
          content: first?.content ?? '',
          confidence: first?.confidence ?? 0.5,
        };
      } catch (err) {
        console.error('[LLMExtraction] Worker 处理失败:', err);
        throw err;
      }
    },
    {
      connection: connection(),
      concurrency: 3,
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400 },
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[LLMExtraction] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  return worker;
}

export async function shutdownWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}

process.on('SIGTERM', () => {
  void shutdownWorker();
});
process.on('SIGINT', () => {
  void shutdownWorker();
});
