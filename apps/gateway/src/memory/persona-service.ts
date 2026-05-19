import { prisma } from '@xiaonuan/prisma';

export async function getTopProfiles(pairingId: string, limit = 5) {
  return prisma.personaProfile.findMany({
    where: { pairingId },
    orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });
}

export async function getProfilesByCategories(
  pairingId: string,
  categories: string[],
  limit = 5
) {
  return prisma.personaProfile.findMany({
    where: { pairingId, category: { in: categories } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function addProfiles(
  pairingId: string,
  participantId: string,
  profiles: Array<{
    category: string;
    content: string;
    confidence: number;
    source?: string;
  }>
) {
  if (profiles.length === 0) return 0;

  const result = await prisma.personaProfile.createMany({
    data: profiles.map((p) => ({
      pairingId,
      participantId,
      category: p.category,
      content: p.content,
      confidence: p.confidence,
      source: p.source ?? null,
    })),
  });

  return result.count;
}
