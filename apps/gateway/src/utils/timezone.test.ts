import { describe, it, expect } from 'vitest';
import { getStartOfDay, getEndOfDay } from './timezone.js';

describe('timezone', () => {
  it('should return correct UTC boundaries for Asia/Shanghai', () => {
    // 2026-05-11 16:00 UTC = 2026-05-12 00:00 Shanghai
    const shanghaiMidnightUtc = new Date('2026-05-11T16:00:00Z');
    const start = getStartOfDay(shanghaiMidnightUtc, 'Asia/Shanghai');
    expect(start.toISOString()).toBe('2026-05-11T16:00:00.000Z');

    const end = getEndOfDay(shanghaiMidnightUtc, 'Asia/Shanghai');
    expect(end.toISOString()).toBe('2026-05-12T15:59:59.999Z');
  });

  it('should return correct UTC boundaries for America/New_York', () => {
    // 2026-05-11 04:00 UTC = 2026-05-11 00:00 NY (EDT, UTC-4)
    const nyMidnightUtc = new Date('2026-05-11T04:00:00Z');
    const start = getStartOfDay(nyMidnightUtc, 'America/New_York');
    expect(start.toISOString()).toBe('2026-05-11T04:00:00.000Z');
  });

  it('should handle cross-midnight correctly for Shanghai', () => {
    // 2026-05-11 15:59 UTC = 2026-05-11 23:59 Shanghai (still "today")
    const justBeforeMidnight = new Date('2026-05-11T15:59:00Z');
    const start = getStartOfDay(justBeforeMidnight, 'Asia/Shanghai');
    // Shanghai 2026-05-11 00:00 = UTC 2026-05-10 16:00
    expect(start.toISOString()).toBe('2026-05-10T16:00:00.000Z');
  });
});
