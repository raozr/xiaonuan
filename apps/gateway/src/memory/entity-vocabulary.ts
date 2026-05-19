import { prisma } from '@xiaonuan/prisma';

const cache = new Map<string, { entities: Set<string>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearEntityCache(): void {
  cache.clear();
}

export async function getPairingEntities(pairingId: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = cache.get(pairingId);
  if (cached && cached.expiresAt > now) {
    return cached.entities;
  }

  const recentEvents = await prisma.eventStream.findMany({
    where: { pairingId },
    orderBy: { eventTime: 'desc' },
    select: { tags: true, content: true },
    take: 50,
  });

  const entities = new Set<string>();
  for (const event of recentEvents) {
    for (const tag of event.tags) {
      entities.add(tag);
    }
  }

  cache.set(pairingId, { entities, expiresAt: now + CACHE_TTL_MS });
  return entities;
}
