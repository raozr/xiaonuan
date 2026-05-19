import { prisma } from '@xiaonuan/prisma';
import { chatCompletion } from '../services/dashscope.js';
import { embedText } from '../services/embedding.js';
import { qdrant } from '../qdrant/client.js';
import { emitEvent } from '../events/event-bus.js';

export async function generateCheckpoint(sessionId: string): Promise<void> {
  const messages = await prisma.sessionMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length < 2) return;

  const conversation = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `请根据以下对话记录生成一个checkpoint摘要，JSON格式：
${conversation}

要求：
{
  "topicSummary": "30字以内的话题摘要",
  "keyFacts": [
    {"fact": "关键事实1", "category": "PREFERENCE|HEALTH|PERSON|PLACE|EVENT"},
    {"fact": "关键事实2", "category": "..."}
  ],
  "moodSnapshot": "20字以内的情绪快照",
  "nextTopicHint": "可选的下次话题提示"
}`;

  let checkpointData: {
    topicSummary: string;
    keyFacts: Array<{ fact: string; category: string }>;
    moodSnapshot: string;
    nextTopicHint?: string;
  };

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: '你是一个对话摘要生成助手。' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.7, maxTokens: 512 }
    );
    checkpointData = JSON.parse(response.content ?? '{}');
  } catch (err) {
    console.error('[Checkpoint] LLM 生成失败:', err);
    return;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { pairingId: true },
  });

  if (!session) return;
  const { pairingId } = session;

  const flatKeyFacts = checkpointData.keyFacts.map((k) => k.fact);

  // Prisma upsert
  const prismaPromise = prisma.checkpoint.upsert({
    where: { checkpointId: sessionId },
    update: {
      topicSummary: checkpointData.topicSummary,
      keyFacts: flatKeyFacts,
      moodSnapshot: checkpointData.moodSnapshot,
      nextTopicHint: checkpointData.nextTopicHint || null,
    },
    create: {
      sessionId,
      checkpointId: sessionId,
      topicSummary: checkpointData.topicSummary,
      keyFacts: flatKeyFacts,
      moodSnapshot: checkpointData.moodSnapshot,
      nextTopicHint: checkpointData.nextTopicHint || null,
    },
  });

  // Qdrant write
  const qdrantPromise = (async () => {
    try {
      const text = `${checkpointData.topicSummary}; ${flatKeyFacts.join('; ')}`;
      const vector = await embedText(text);
      await qdrant.upsert('pairing_memories', {
        points: [
          {
            id: sessionId,
            vector,
            payload: {
              pairingId,
              sessionId,
              checkpointId: sessionId,
              content: text,
              type: 'checkpoint',
              createdAt: new Date().toISOString(),
            },
          },
        ],
      });
    } catch (err) {
      console.error('[Checkpoint] Qdrant 写入失败:', err);
    }
  })();

  // EventStream write (immediate to avoid race with buffer flush)
  const eventPromise = (async () => {
    try {
      await emitEvent({
        pairingId,
        type: 'conversation_extracted',
        content: checkpointData.topicSummary,
        tags: flatKeyFacts,
        payload: {
          keyFacts: checkpointData.keyFacts,
          moodSnapshot: checkpointData.moodSnapshot,
          nextTopicHint: checkpointData.nextTopicHint,
        },
      }, { immediate: true });
    } catch (err) {
      console.error('[Checkpoint] EventStream 写入失败:', err);
    }
  })();

  await Promise.allSettled([prismaPromise, qdrantPromise, eventPromise]);
}
