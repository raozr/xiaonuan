import { memoryRecall } from '../tools/memory.js';
import { prisma } from '@xiaonuan/prisma';
import { getFamilyEntities } from './entity-vocabulary.js';

export async function getMidTermMemory(
  input: string,
  familyId: string
): Promise<string> {
  if (!await shouldTrigger(input, familyId)) return '';

  const [vectorResults, feeds] = await Promise.all([
    memoryRecall(input, familyId, undefined, 3),
    prisma.familyFeed.findMany({
      where: {
        familyId,
        category: { in: ['PREFERENCE', 'HEALTH'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const lines: string[] = [];

  for (const r of vectorResults) {
    const payload = r.payload as Record<string, string> | undefined;
    const content = payload?.content;
    if (content) {
      lines.push(`- ${content}`);
    }
  }

  for (const f of feeds) {
    if (f.content) {
      lines.push(`- ${f.content}`);
    }
  }

  if (lines.length === 0) return '';
  return `【相关回忆】\n${lines.join('\n')}`;
}

async function shouldTrigger(input: string, familyId: string): Promise<boolean> {
  if (input.length >= 10) return true;

  const entities = await getFamilyEntities(familyId);
  for (const entity of entities) {
    if (input.includes(entity)) return true;
  }

  return false;
}
