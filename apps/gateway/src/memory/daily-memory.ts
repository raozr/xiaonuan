import { prisma } from '@xiaonuan/prisma';
import { getCompanioneeTimezone, getStartOfDay, getEndOfDay } from '../utils/timezone.js';

export async function getDailyMemory(pairingId: string): Promise<string> {
  const timezone = await getCompanioneeTimezone(pairingId);
  const now = new Date();
  const startOfDay = getStartOfDay(now, timezone);
  const endOfDay = getEndOfDay(now, timezone);

  const sessions = await prisma.session.findMany({
    where: {
      pairingId,
      endedAt: { not: null },
      updatedAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
    include: {
      checkpoints: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const summaries: string[] = [];
  for (const session of sessions) {
    const cp = session.checkpoints[0];
    if (cp?.topicSummary) {
      summaries.push(`- ${cp.topicSummary}`);
    }
  }

  if (summaries.length === 0) return '';
  return `【今日回顾】\n${summaries.join('\n')}`;
}
