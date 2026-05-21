import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { prisma } from '@xiaonuan/prisma';

export async function getCompanioneeTimezone(pairingId: string): Promise<string> {
  const companionee = await prisma.participant.findFirst({
    where: { pairingId, role: 'COMPANIONEE', isAI: false },
    select: { metadata: true },
  });
  const meta = (companionee?.metadata as Record<string, string> | null) ?? {};
  return meta.timezone ?? 'Asia/Shanghai';
}

export function getStartOfDay(date: Date, timezone: string): Date {
  const zoned = toZonedTime(date, timezone);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, timezone);
}

export function getEndOfDay(date: Date, timezone: string): Date {
  const zoned = toZonedTime(date, timezone);
  zoned.setHours(23, 59, 59, 999);
  return fromZonedTime(zoned, timezone);
}
