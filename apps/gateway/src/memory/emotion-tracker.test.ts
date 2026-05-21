import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentMoods, getCurrentMood } from './emotion-tracker.js';
import { prisma } from '@xiaonuan/prisma';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    eventStream: {
      findMany: vi.fn(),
    },
  },
}));

describe('emotion-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty when no mood events exist', async () => {
    vi.mocked(prisma.eventStream.findMany).mockResolvedValue([]);

    const moods = await getRecentMoods('pairing-123');
    expect(moods).toEqual([]);
  });

  it('should extract moods from mood_change events', async () => {
    vi.mocked(prisma.eventStream.findMany)
      .mockResolvedValueOnce([
        {
          content: '心情低落',
          eventTime: new Date('2026-05-18T10:00:00Z'),
          payload: { mood: 'sad' },
        },
      ] as any)
      .mockResolvedValueOnce([]);

    const moods = await getRecentMoods('pairing-123');
    expect(moods).toHaveLength(1);
    expect(moods[0]!.mood).toBe('sad');
    expect(moods[0]!.source).toBe('mood_change');
  });

  it('should extract moodSnapshot from conversation_extracted events', async () => {
    vi.mocked(prisma.eventStream.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          content: '聊到家庭聚餐',
          eventTime: new Date('2026-05-17T14:00:00Z'),
          payload: { moodSnapshot: '开心，期待家人团聚' },
        },
      ] as any);

    const moods = await getRecentMoods('pairing-123');
    expect(moods).toHaveLength(1);
    expect(moods[0]!.mood).toBe('开心，期待家人团聚');
    expect(moods[0]!.source).toBe('checkpoint');
  });

  it('should sort moods by time descending and limit', async () => {
    vi.mocked(prisma.eventStream.findMany)
      .mockResolvedValueOnce([
        { content: '焦虑', eventTime: new Date('2026-05-15T10:00:00Z'), payload: { mood: '焦虑' } },
        { content: '平静', eventTime: new Date('2026-05-18T10:00:00Z'), payload: { mood: '平静' } },
      ] as any)
      .mockResolvedValueOnce([]);

    const moods = await getRecentMoods('pairing-123', 1);
    expect(moods).toHaveLength(1);
    expect(moods[0]!.mood).toBe('平静');
  });

  it('getCurrentMood should return latest mood', async () => {
    vi.mocked(prisma.eventStream.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          content: '',
          eventTime: new Date('2026-05-18T10:00:00Z'),
          payload: { moodSnapshot: '心情不错' },
        },
      ] as any);

    const mood = await getCurrentMood('pairing-123');
    expect(mood).toBe('心情不错');
  });

  it('getCurrentMood should return null when no moods', async () => {
    vi.mocked(prisma.eventStream.findMany).mockResolvedValue([]);

    const mood = await getCurrentMood('pairing-123');
    expect(mood).toBeNull();
  });
});
