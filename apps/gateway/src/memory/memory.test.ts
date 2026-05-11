import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyMemory } from './daily-memory.js';
import { getShortTermMemory } from './short-term-memory.js';
import { buildMemoryContext } from './context-builder.js';

vi.mock('@xiaonuan/prisma', () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    checkpoint: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    familyFeed: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../tools/memory.js', () => ({
  memoryRecall: vi.fn(),
}));

import { prisma } from '@xiaonuan/prisma';
import { memoryRecall } from '../tools/memory.js';
import { getMidTermMemory } from './mid-term-memory.js';

describe('daily-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty string when no ended sessions today', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);

    const result = await getDailyMemory('family-123');
    expect(result).toBe('');
  });

  it('should format topic summaries from today ended sessions', async () => {
    const today = new Date();
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [
          { topicSummary: '聊到儿子周末回家', createdAt: today },
        ],
      },
      {
        id: 'session-2',
        checkpoints: [
          { topicSummary: '提到膝盖不舒服', createdAt: today },
        ],
      },
    ] as any);

    const result = await getDailyMemory('family-123');
    expect(result).toContain('【今日回顾】');
    expect(result).toContain('聊到儿子周末回家');
    expect(result).toContain('提到膝盖不舒服');
  });

  it('should use latest checkpoint per session', async () => {
    const today = new Date();
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [
          { topicSummary: '最新摘要', createdAt: today },
          { topicSummary: '旧摘要', createdAt: new Date(today.getTime() - 10000) },
        ],
      },
    ] as any);

    const result = await getDailyMemory('family-123');
    expect(result).toContain('最新摘要');
    expect(result).not.toContain('旧摘要');
  });
});

describe('short-term-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty string when no checkpoints in window', async () => {
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await getShortTermMemory('family-123');
    expect(result).toBe('');
  });

  it('should aggregate keyFacts within 3 days excluding today', async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([
      {
        id: 'cp-1',
        keyFacts: ['天气转凉注意添衣', '和隔壁李阿姨通电话'],
        createdAt: twoDaysAgo,
        session: { familyId: 'family-123' },
      },
    ] as any);

    const result = await getShortTermMemory('family-123');
    expect(result).toContain('【近日动态】');
    expect(result).toContain('天气转凉注意添衣');
    expect(result).toContain('和隔壁李阿姨通电话');
  });

  it('should limit to 2 keyFacts per day', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([
      {
        id: 'cp-1',
        keyFacts: ['事实1', '事实2', '事实3'],
        createdAt: yesterday,
        session: { familyId: 'family-123' },
      },
    ] as any);

    const result = await getShortTermMemory('family-123');
    const matches = result.match(/- /g);
    expect(matches?.length).toBe(2);
  });
});

describe('context-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findMany).mockReset();
    vi.mocked(prisma.checkpoint.findMany).mockReset();
    vi.mocked(prisma.familyFeed.findMany).mockReset();
    vi.mocked(memoryRecall).mockReset();
  });

  it('should include daily and short-term in first 3 turns', async () => {
    const today = new Date();
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([
      {
        id: 'session-1',
        checkpoints: [{ topicSummary: '今天摘要', createdAt: today }],
      },
    ] as any);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 2,
      input: '你好',
    });

    expect(result).toContain('【今日回顾】');
  });

  it('should omit daily and short-term after turn 3', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 4,
      input: '你好',
    });

    expect(result).toBe('');
  });

  it('should omit empty layers', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([]);

    const result = await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 1,
      input: '你好',
    });

    expect(result).toBe('');
  });

  it('should fetch daily and short-term memory concurrently', async () => {
    const callTimes: Record<string, number> = {};

    (prisma.session.findMany as any).mockImplementationOnce(async () => {
      callTimes.sessionFindMany = Date.now();
      await new Promise((r) => setTimeout(r, 50));
      return [];
    });

    (prisma.checkpoint.findMany as any).mockImplementationOnce(async () => {
      callTimes.checkpointFindMany = Date.now();
      await new Promise((r) => setTimeout(r, 50));
      return [];
    });

    await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 1,
      input: '你好',
    });

    const diff = Math.abs((callTimes.sessionFindMany ?? 0) - (callTimes.checkpointFindMany ?? 0));
    expect(diff).toBeLessThan(20);
  });

  it('should tolerate failures in individual memory layers', async () => {
    vi.mocked(prisma.session.findMany).mockRejectedValueOnce(new Error('DB down'));
    vi.mocked(prisma.checkpoint.findMany).mockResolvedValueOnce([
      {
        id: 'cp-1',
        keyFacts: ['事实A'],
        createdAt: new Date(Date.now() - 86400000),
        session: { familyId: 'family-123' },
      },
    ] as any);

    const result = await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 1,
      input: '你好',
    });

    expect(result).not.toContain('【今日回顾】');
    expect(result).toContain('【近日动态】');
  });
});

describe('mid-term-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty for short input without entities', async () => {
    const result = await getMidTermMemory('嗯', 'family-123');
    expect(result).toBe('');
  });

  it('should trigger for long input (>= 10 chars)', async () => {
    vi.mocked(memoryRecall).mockResolvedValueOnce([
      { id: '1', score: 0.9, payload: { content: '喜欢早上去公园打太极' } },
    ] as any);
    vi.mocked(prisma.familyFeed.findMany).mockResolvedValueOnce([]);

    const result = await getMidTermMemory('我喜欢早上打太极', 'family-123');
    expect(result).toContain('【相关回忆】');
    expect(result).toContain('喜欢早上去公园打太极');
  });

  it('should trigger for input with entity words', async () => {
    vi.mocked(memoryRecall).mockResolvedValueOnce([]);
    vi.mocked(prisma.familyFeed.findMany).mockResolvedValueOnce([
      { id: '1', content: '腰不好，避免久坐', category: 'HEALTH' },
    ] as any);

    const result = await getMidTermMemory('腰', 'family-123');
    expect(result).toContain('腰不好，避免久坐');
  });

  it('should return empty when both sources empty', async () => {
    vi.mocked(memoryRecall).mockResolvedValueOnce([]);
    vi.mocked(prisma.familyFeed.findMany).mockResolvedValueOnce([]);

    const result = await getMidTermMemory('今天天气不错今天天气不错', 'family-123');
    expect(result).toBe('');
  });
});

describe('greeting-hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findFirst).mockReset();
    vi.mocked(prisma.checkpoint.findFirst).mockReset();
  });

  it('should return empty when last session was within 3 days', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 86400000),
    } as any);

    const { getGreetingHint } = await import('./greeting-hint.js');
    const result = await getGreetingHint('family-123');
    expect(result).toBe('');
  });

  it('should return hint when last session was over 3 days ago', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 5 * 86400000),
    } as any);
    vi.mocked(prisma.checkpoint.findFirst).mockResolvedValueOnce({
      nextTopicHint: '想聊聊孙子的事',
    } as any);

    const { getGreetingHint } = await import('./greeting-hint.js');
    const result = await getGreetingHint('family-123');
    expect(result).toContain('【未尽话题】');
    expect(result).toContain('想聊聊孙子的事');
  });

  it('should return empty when no previous session exists', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce(null);

    const { getGreetingHint } = await import('./greeting-hint.js');
    const result = await getGreetingHint('family-123');
    expect(result).toBe('');
  });

  it('should inject greeting hint in GREETING phase', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 5 * 86400000),
    } as any);
    vi.mocked(prisma.checkpoint.findFirst).mockResolvedValueOnce({
      nextTopicHint: '想聊聊孙子的事',
    } as any);

    const result = await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 1,
      input: '你好',
      phase: 'GREETING',
    });

    expect(result).toContain('【未尽话题】');
    expect(result).toContain('想聊聊孙子的事');
  });

  it('should omit greeting hint in non-GREETING phase', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValueOnce({
      endedAt: new Date(Date.now() - 5 * 86400000),
    } as any);

    const result = await buildMemoryContext({
      familyId: 'family-123',
      turnCount: 1,
      input: '你好',
      phase: 'ACTIVE_CHAT',
    });

    expect(result).not.toContain('【未尽话题】');
  });
});
