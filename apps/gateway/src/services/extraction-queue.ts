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
  senderRole?: string;    // 'CHILD' | 'ELDER' | 'AI' — 谁说的
  context?: string;
}

export interface ExtractionResult {
  category: string;
  content: string;
  confidence: number;
  targetParticipantId?: string; // LLM 识别的关于谁的信息
}

export interface ExtractionOutput {
  profiles: ExtractionResult[];
  targetRole: 'self' | 'other' | 'third_party'; // 关于自己/关于配对中另一个人/关于第三方
  targetName?: string;  // 如果关于第三方，记录名字
  metadata?: Record<string, string>;
}

let queue: Queue<ExtractionJob> | null = null;
let worker: Worker<ExtractionJob, ExtractionOutput> | null = null;

function connection() {
  return { url: env.REDIS_URL };
}

export async function getQueue(): Promise<Queue<ExtractionJob>> {
  if (!queue) {
    queue = new Queue<ExtractionJob>(QUEUE_NAME, { connection: connection() });
  }
  return queue;
}

export function getWorker(): Worker<ExtractionJob, ExtractionOutput> | null {
  return worker;
}

const EXTRACTION_PROMPT = (
  content: string,
  senderRole: string,
  participants: { role: string; name: string }[]
) => {
  const participantsDesc = participants.map(p => `${p.role}（${p.name}）`).join('、');

  return `你是人物画像提取助手。你需要分析一段文本，提取其中提到的人物的客观信息。

**发送者角色**：${senderRole}
**配对中的参与者**：${participantsDesc}

**重要规则**：
1. 先判断这段内容是"关于谁"的信息
   - 如果 ${senderRole} 说的是自己（如"我腰不好"），targetRole = "self"
   - 如果说的是配对中的另一位参与者（如"奶奶腰不好"），targetRole = "other"
   - 如果说的是不在配对中的人（如"我孙子小明"），targetRole = "third_party"
2. profiles 中的人物信息归到对应的人身上（通过 targetRole 区分）
3. metadata 只提取与 targetRole="self" 或 "other" 相关的信息，third_party 的信息只记录在 profiles 中

**输出 JSON 格式**：
{
  "targetRole": "self" | "other" | "third_party",
  "targetName": "如果关于第三方，记录其名字或称呼",
  "profiles": [
    { "category": "类别", "content": "一句话客观事实", "confidence": 0.5-1.0 }
  ],
  "metadata": {
    "dialect": "方言/语言偏好（如果提到）",
    "hobbies": "爱好（如果提到）",
    "healthNotes": "健康相关（如果提到）",
    "topicsToAvoid": "回避/敏感话题（如果提到）",
    "greetingPreference": "称呼偏好（如果提到）",
    "age": "年龄信息（如果提到）",
    "personality": "性格特征（如果提到）",
    "relationships": "关系描述（如'孙子小明'、'儿子经常来看'）",
    "habits": "日常习惯（如'每天早起'、'午饭后散步'）",
    "preferences": "偏好（如'喜欢喝热的'、'不喜欢吃甜食'）",
    "recentEvents": "近期发生的事（如'明天要去医院'、'上周摔了一跤'）"
  }
}

只提取文本中明确提到的信息，不要编造。metadata 中只保留实际提取的字段。

**输入文本**：${content}

**示例 1**（子女说"奶奶最近睡眠不好，夜里容易醒"）：
{"targetRole":"other","profiles":[{"category":"health","content":"近期睡眠质量差","confidence":0.9}],"metadata":{"healthNotes":"最近睡眠不好，夜里容易醒"}}

**示例 2**（子女说"我叫张伟"）：
{"targetRole":"self","profiles":[{"category":"identity","content":"名字叫张伟","confidence":0.95}],"metadata":{}}

**示例 3**（子女说"我孙子小明考了满分"）：
{"targetRole":"third_party","targetName":"小明（孙子）","profiles":[{"category":"relationship","content":"孙子小明，数学优秀","confidence":0.9}],"metadata":{}}`;
};

export async function startWorker() {
  worker = new Worker<ExtractionJob, ExtractionOutput>(
    QUEUE_NAME,
    async (job: Job<ExtractionJob>) => {
      const { source, pairingId, content, senderRole = 'CHILD', context } = job.data;

      try {
        // Get all participants in this pairing
        const participants = await prisma.participant.findMany({
          where: { pairingId },
          select: { id: true, name: true, role: true, isAI: true },
        });

        // Build participant context for the LLM prompt
        const participantList = participants.map(p => ({
          role: p.role,
          name: p.name,
        }));

        const response = await chatCompletion(
          [
            { role: 'system', content: '你是一个人物画像提取助手。分析文本，判断内容是关于谁的，并提取客观事实。' },
            { role: 'user', content: EXTRACTION_PROMPT(`${context ?? ''}\n${content}`, senderRole, participantList) },
          ],
          { temperature: 0.3, maxTokens: 512 }
        );

        const parsed = JSON.parse(response.content ?? '{}') as ExtractionOutput;
        const profiles = parsed.profiles ?? [];
        const metadata = parsed.metadata;
        const targetRole = parsed.targetRole ?? 'other';
        const targetName = parsed.targetName;

        // Determine which participant to write the metadata to
        let targetParticipantId: string | null = null;

        if (targetRole === 'self') {
          // Information about the sender themselves
          const sender = participants.find(p => p.role === senderRole && !p.isAI);
          targetParticipantId = sender?.id ?? null;
        } else if (targetRole === 'other') {
          // Information about the other participant in the pairing
          // In most cases, this means the non-sender (non-AI) participant
          const other = participants.find(p => p.role !== senderRole && !p.isAI);
          targetParticipantId = other?.id ?? null;
        } else {
          // third_party — only write to profiles, not metadata
          // Store under the sender's participant for reference
          const sender = participants.find(p => p.role === senderRole && !p.isAI);
          targetParticipantId = sender?.id ?? null;
        }

        // Merge extracted metadata into the target participant's metadata
        if (targetParticipantId && metadata && Object.keys(metadata).length > 0) {
          const participant = await prisma.participant.findUnique({
            where: { id: targetParticipantId },
          });

          if (participant) {
            const existingMeta = (participant.metadata as Record<string, string> | null) ?? {};
            const updatedMeta = { ...existingMeta };
            for (const [key, value] of Object.entries(metadata)) {
              if (value && typeof value === 'string' && value.trim()) {
                updatedMeta[key] = value.trim();
              }
            }
            await prisma.participant.update({
              where: { id: targetParticipantId },
              data: { metadata: updatedMeta },
            });
          }
        }

        // Write extracted profiles
        if (profiles.length > 0) {
          // If we couldn't identify the target, write to the non-AI participant as fallback
          const profileTargetId = targetParticipantId
            ?? participants.find(p => !p.isAI)?.id;

          if (profileTargetId) {
            await addProfiles(
              pairingId,
              profileTargetId,
              profiles.map((r) => ({
                category: r.category,
                content: r.content,
                confidence: r.confidence,
                source,
              }))
            );
          }
        }

        const first = profiles[0];
        return {
          profiles,
          metadata,
          targetRole,
          targetName,
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
