import { prisma } from '@xiaonuan/prisma';
import { qdrant } from '../qdrant/client.js';
import { embedText } from '../services/embedding.js';

export async function memoryContext(familyId: string) {
  const feeds = await prisma.familyFeed.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { elder: true },
  });

  return {
    feeds,
    elder: family?.elder ?? null,
  };
}

export async function memoryRecall(
  query: string,
  familyId: string,
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
    { key: 'familyId', match: { value: familyId } },
  ];

  if (checkpointId) {
    must.push({ key: 'checkpointId', match: { value: checkpointId } });
  }

  try {
    const results = await qdrant.search('family_memories', {
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
  category: 'PREFERENCE' | 'HEALTH' | 'EVENT' | 'PERSON' | 'PLACE',
  content: string,
  familyId: string
) {
  try {
    const feed = await prisma.familyFeed.create({
      data: {
        familyId,
        type: 'TEXT',
        category,
        content,
        isRecent: true,
      },
    });
    return { success: true, feedId: feed.id };
  } catch (err) {
    console.error('[memoryNote] 写入 FamilyFeed 失败:', err);
    return { success: false, error: '写入失败' };
  }
}
