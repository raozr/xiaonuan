import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { prisma } from '@xiaonuan/prisma';

export async function getElderTimezone(familyId: string): Promise<string> {
  const elder = await prisma.elderProfile.findUnique({
    where: { familyId },
    select: { timezone: true },
  });
  return elder?.timezone ?? 'Asia/Shanghai';
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
