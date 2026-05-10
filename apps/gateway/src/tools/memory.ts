import { prisma } from '@xiaonuan/prisma';
import { qdrant } from '../qdrant/client.js';

// Placeholder embedding: deterministic pseudo-random vector from text hash.
// TODO: Replace with real embedding model (OpenAI, local, etc.)
function embedText(text: string, dim: number = 1536): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) % 2147483647;
  }
  const vec: number[] = [];
  for (let i = 0; i < dim; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483647;
    vec.push((seed / 2147483647) * 2 - 1);
  }
  return vec;
}

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
  const vector = embedText(query);

  const must: Array<Record<string, unknown>> = [
    { key: 'familyId', match: { value: familyId } },
  ];

  if (checkpointId) {
    must.push({ key: 'checkpointId', match: { value: checkpointId } });
  }

  const results = await qdrant.search('family_memories', {
    vector,
    limit: topK,
    filter: { must },
    with_payload: true,
  });

  return results;
}
