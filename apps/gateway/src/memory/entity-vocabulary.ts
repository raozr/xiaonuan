import { prisma } from '@xiaonuan/prisma';

const cache = new Map<string, { entities: Set<string>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearEntityCache(): void {
  cache.clear();
}

export async function getFamilyEntities(familyId: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = cache.get(familyId);
  if (cached && cached.expiresAt > now) {
    return cached.entities;
  }

  const feeds = await prisma.familyFeed.findMany({
    where: {
      familyId,
      category: { in: ['PERSON', 'PLACE'] },
    },
    select: { content: true },
    take: 100,
  });

  const entities = new Set(feeds.map((f) => f.content));
  cache.set(familyId, { entities, expiresAt: now + CACHE_TTL_MS });
  return entities;
}
