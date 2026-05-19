import { prisma } from '@xiaonuan/prisma';
import type { EventType } from '@xiaonuan/prisma';

export async function getTodayEvents(pairingId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.eventStream.findMany({
    where: {
      pairingId,
      eventTime: { gte: today },
    },
    orderBy: { eventTime: 'asc' },
  });
}

export async function getRecentEvents(pairingId: string, limit = 20) {
  return prisma.eventStream.findMany({
    where: { pairingId },
    orderBy: { eventTime: 'desc' },
    take: limit,
  });
}

export async function getEventsByType(
  pairingId: string,
  type: EventType,
  limit = 20
) {
  return prisma.eventStream.findMany({
    where: { pairingId, type },
    orderBy: { eventTime: 'desc' },
    take: limit,
  });
}
