import { prisma } from '@xiaonuan/prisma';
import { qdrant } from '../qdrant/client.js';
import { embedText } from '../services/embedding.js';

export async function memoryContext(pairingId: string) {
  const feeds = await prisma.feedMessage.findMany({
    where: { pairingId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const companionee = await prisma.participant.findFirst({
    where: { pairingId, role: 'COMPANIONEE', isAI: false },
  });

  return {
    feeds,
    companionee: companionee ?? null,
  };
}

export async function memoryRecall(
  query: string,
  pairingId: string,
  checkpointId?: string,
  topK: number = 5
) {
  let vector: number[];
  try {
    vector = await embedText(query);
  } catch (err) {
    console.error('[memoryRecall] embedding 失败，降级跳过向量检索:', err);
    return [];
  }

  const must: Array<Record<string, unknown>> = [
    { key: 'pairingId', match: { value: pairingId } },
  ];

  if (checkpointId) {
    must.push({ key: 'checkpointId', match: { value: checkpointId } });
  }

  try {
    const results = await qdrant.search('pairing_memories', {
      vector,
      limit: topK,
      filter: { must },
      with_payload: true,
    });
    return results;
  } catch (err) {
    console.error('[memoryRecall] Qdrant 查询失败，降级返回空结果:', err);
    return [];
  }
}

export async function memoryNote(
  category: string,
  content: string,
  pairingId: string
) {
  try {
    const event = await prisma.eventStream.create({
      data: {
        pairingId,
        type: 'info_extracted',
        content,
        tags: [category],
      },
    });
    return { success: true, eventId: event.id };
  } catch (err) {
    console.error('[memoryNote] 写入 EventStream 失败:', err);
    return { success: false, error: '写入失败' };
  }
}
