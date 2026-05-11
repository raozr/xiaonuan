import { prisma } from '@xiaonuan/prisma';
import { getElderTimezone, getStartOfDay } from '../utils/timezone.js';

export async function getShortTermMemory(familyId: string): Promise<string> {
  const timezone = await getElderTimezone(familyId);
  const now = new Date();
  const today = getStartOfDay(now, timezone);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const checkpoints = await prisma.checkpoint.findMany({
    where: {
      session: {
        familyId,
        endedAt: { not: null },
      },
      createdAt: {
        gte: threeDaysAgo,
        lt: today,
      },
    },
    orderBy: { createdAt: 'desc' },
    include: { session: true },
  });

  if (checkpoints.length === 0) return '';

  // Group by day
  const byDay = new Map<string, string[]>();
  for (const cp of checkpoints) {
    const dateStr = new Date(cp.createdAt!).toISOString().split('T')[0]!;
    if (!byDay.has(dateStr)) {
      byDay.set(dateStr, []);
    }
    const facts = byDay.get(dateStr)!;
    if (facts.length < 2) {
      const remaining = 2 - facts.length;
      facts.push(...cp.keyFacts.slice(0, remaining));
    }
  }

  const dayLabels = ['前天', '昨天'];
  const lines: string[] = [];
  const sortedDays = Array.from(byDay.keys()).sort();

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i]!;
    const facts = byDay.get(day)!;
    const label = dayLabels[Math.max(0, sortedDays.length - 1 - i)] || day;
    for (const fact of facts) {
      lines.push(`- ${label}您提到${fact}。`);
    }
  }

  if (lines.length === 0) return '';
  return `【近日动态】\n${lines.join('\n')}`;
}
