import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@xiaonuan/prisma';
import { chatCompletion } from '../services/dashscope.js';
import { env } from '../config/env.js';
import { addProfiles } from '../memory/persona-service.js';

const QUEUE_NAME = 'extraction';

export interface ExtractionJob {
  source: 'feed' | 'checkpoint' | 'conversation';
  pairingId: string;
  content: string;
  senderRole?: string;    // 'STEWARD' | 'COMPANIONEE' | 'AI' — 谁说的
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
  targetDescription: string,  // e.g. "关于被陪伴者（张美丽）的信息" | "关于发送者自己（gaotao）的信息"
) => {
  return `你是人物画像提取助手。以下文本是${targetDescription}，请从中提取客观事实。

**输出 JSON 格式**：
{
  "profiles": [
    { "category": "类别（identity/health/hobby/relationship等）", "content": "一句话客观事实", "confidence": 0.5-1.0 }
  ],
  "metadata": {
    "name": "发送者姓名（如果提到自己的名字，如'我叫王义'→'王义'）",
    "age": "年龄（如果提到）",
    "healthNotes": "健康相关（如果提到）",
    "hobbies": "爱好（如果提到）",
    "relationshipToCompanionee": "与被陪伴者的关系（如'侄子'、'女儿'、'儿子'。仅当文本明确说明发送者是被陪伴者的什么人时才提取，如'我是她的侄子'→'侄子'。不要将'喜欢聊天'等行为描述当作关系。如果文本没有明确说明发送者与被陪伴者的亲属关系，不要提取该字段）",
    "dialect": "方言偏好（如果提到）",
    "personality": "性格特征（如果提到）",
    "habits": "日常习惯（如果提到）",
    "preferences": "偏好（如果提到）",
    "recentEvents": "近期发生的事（如果提到）",
    "topicsToAvoid": "回避/敏感话题（如果提到）",
    "greetingPreference": "称呼偏好（如果提到）"
  }
}

**规则**：
- 只提取文本中明确提到的信息，不要编造
- metadata 中只保留实际提取到的字段，没有就省略该字段
- profiles 至少提取一条（如果文本有实质内容）
- 如果文本确实没有实质内容，profiles 可以为空数组

**输入文本**：${content}

**示例 1**（关于被陪伴者："她今年68岁，有两个子女"）：
{"profiles":[{"category":"identity","content":"今年68岁，有两个子女","confidence":0.95}],"metadata":{"age":"68岁"}}

**示例 2**（关于被陪伴者："奶奶最近睡眠不好，夜里容易醒"）：
{"profiles":[{"category":"health","content":"近期睡眠质量差，夜里容易醒","confidence":0.9}],"metadata":{"healthNotes":"最近睡眠不好，夜里容易醒"}}

**示例 3**（关于发送者自己："我是她的侄子，小时候是她带我长大的"）：
{"profiles":[{"category":"relationship","content":"是被陪伴者的侄子，小时候由被陪伴者带大","confidence":0.95}],"metadata":{"relationshipToCompanionee":"侄子"}}

**示例 4**（关于第三方："我孙子小明考了满分"）：
{"profiles":[{"category":"relationship","content":"孙子小明，学习优秀","confidence":0.9}],"metadata":{}}

**示例 5**（关于发送者自己："我叫王义，还在上大学，今年大四，没事就喜欢跟他聊天"）：
{"profiles":[{"category":"identity","content":"姓名王义，目前是大四学生"},{"category":"hobby","content":"喜欢与被陪伴者聊天","confidence":0.9}],"metadata":{}}`;
};

export function detectTarget(content: string, senderRole: string, participants: { role: string; name: string; isAI: boolean }[]): { targetDescription: string; shouldSkip: boolean } {
  // Heuristic: look for self-referential relationship statements
  // Covers: "我是他的侄子", "他是我的叔叔"/"他是我爸", "我叫王义", "我在北京上班", "我从小...", "我们"
  const hasSelfRelationship = /我是[她他的](的)?[一-龥]{1,4}|[她他]是我的(的)?[一-龥]{1,4}|[她他]是我[一-龥]{1,4}|我叫|我在[A-Za-z一-龥]{2,}|我[从小]|我们/.test(content);
  // Look for companionee-referential statements (pronoun + attribute about the companionee)
  const hasCompanioneeAttr = /[她他]今年|[她他]有[两几个]|[她他]身体|[她他]最[爱喜]|[她他].*岁/.test(content);

  const companionee = participants.find(p => p.role === 'COMPANIONEE' && !p.isAI);
  const sender = participants.find(p => p.role === senderRole && !p.isAI);

  if (hasSelfRelationship) {
    return {
      targetDescription: `关于发送者自己${sender ? '（' + sender.name + '）' : ''}的信息`,
      shouldSkip: false,
    };
  }

  if (hasCompanioneeAttr) {
    return {
      targetDescription: `关于被陪伴者${companionee ? '（' + companionee.name + '）' : ''}的信息`,
      shouldSkip: false,
    };
  }

  // Fallback — default to companionee
  return {
    targetDescription: `关于被陪伴者${companionee ? '（' + companionee.name + '）' : ''}的信息`,
    shouldSkip: false,
  };
}

export async function startWorker() {
  worker = new Worker<ExtractionJob, ExtractionOutput>(
    QUEUE_NAME,
    async (job: Job<ExtractionJob>) => {
      const { source, pairingId, content, senderRole = 'STEWARD', context } = job.data;

      try {
        // Get all participants in this pairing
        const participants = await prisma.participant.findMany({
          where: { pairingId },
          select: { id: true, name: true, role: true, isAI: true },
        });

        // Determine target description using heuristic instead of relying on LLM
        const { targetDescription, shouldSkip } = detectTarget(content, senderRole, participants);
        if (shouldSkip) return { profiles: [], targetRole: 'other', metadata: {} };

        const response = await chatCompletion(
          [
            { role: 'system', content: '你是一个人物画像提取助手。从给定的文本中提取客观事实信息。' },
            { role: 'user', content: EXTRACTION_PROMPT(`${context ?? ''}\n${content}`, targetDescription) },
          ],
          { temperature: 0.3, maxTokens: 512 }
        );

        // Strip markdown code blocks if present (LLM may return ```json ... ```)
        let rawContent = response.content ?? '{}';
        rawContent = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const parsed = JSON.parse(rawContent) as ExtractionOutput;
        const profiles = (parsed.profiles ?? []).filter(p =>
          p.content && p.content.length > 0 && p.confidence > 0.3
        );
        const metadata = parsed.metadata;

        // Determine target participant: companionee for "about companionee" text, sender for "about self" text
        let targetParticipantId: string | null = null;
        if (targetDescription.includes('关于被陪伴者')) {
          const companionee = participants.find(p => p.role === 'COMPANIONEE' && !p.isAI);
          targetParticipantId = companionee?.id ?? null;
        } else if (targetDescription.includes('关于发送者自己')) {
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

            // If a name was extracted and the participant's current name looks like a phone number, update it
            const extractedName = metadata.name?.trim();
            let nameUpdate: { name?: string } = {};
            if (extractedName && /^\d{11}$/.test(participant.name)) {
              nameUpdate = { name: extractedName };
            }

            for (const [key, value] of Object.entries(metadata)) {
              if (key === 'name') continue; // name is handled separately
              if (value && typeof value === 'string' && value.trim()) {
                updatedMeta[key] = value.trim();
              }
            }
            await prisma.participant.update({
              where: { id: targetParticipantId },
              data: { metadata: updatedMeta, ...nameUpdate },
            });
          }
        }

        // Write extracted profiles
        if (profiles.length > 0 && targetParticipantId) {
          await addProfiles(
            pairingId,
            targetParticipantId,
            profiles.map((r) => ({
              category: r.category,
              content: r.content,
              confidence: r.confidence,
              source,
            }))
          );
        }

        return { profiles, metadata, targetRole: 'other' };
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
