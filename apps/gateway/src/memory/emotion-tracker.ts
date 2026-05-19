import { prisma } from '@xiaonuan/prisma';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface MoodEntry {
  mood: string;
  eventTime: Date;
  source: string;
}

export async function getRecentMoods(
  pairingId: string,
  limit = 7
): Promise<MoodEntry[]> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);

  const [moodChanges, convExtracted] = await Promise.all([
    prisma.eventStream.findMany({
      where: { pairingId, type: 'mood_change', eventTime: { gte: since } },
      orderBy: { eventTime: 'desc' },
      select: { content: true, eventTime: true, payload: true },
      take: limit * 2,
    }),
    prisma.eventStream.findMany({
      where: {
        pairingId,
        type: 'conversation_extracted',
        eventTime: { gte: since },
      },
      orderBy: { eventTime: 'desc' },
      select: { content: true, eventTime: true, payload: true },
      take: limit * 2,
    }),
  ]);

  const moods: MoodEntry[] = [];

  for (const e of moodChanges) {
    const payload = e.payload as Record<string, unknown> | null;
    moods.push({
      mood: (payload?.mood as string) ?? e.content,
      eventTime: e.eventTime,
      source: 'mood_change',
    });
  }

  for (const e of convExtracted) {
    const payload = e.payload as Record<string, unknown> | null;
    const moodSnapshot = payload?.moodSnapshot as string | undefined;
    if (moodSnapshot) {
      moods.push({
        mood: moodSnapshot,
        eventTime: e.eventTime,
        source: 'checkpoint',
      });
    }
  }

  moods.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
  return moods.slice(0, limit);
}

export async function getCurrentMood(pairingId: string): Promise<string | null> {
  const moods = await getRecentMoods(pairingId, 1);
  return moods.length > 0 ? moods[0]!.mood : null;
}
